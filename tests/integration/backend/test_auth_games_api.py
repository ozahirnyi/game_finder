import uuid

import pytest

from app.database import Game, User


pytestmark = pytest.mark.integration


def test_register_persists_user_without_exposing_password_hash(api_client, db_session):
    response = api_client.post(
        "/auth/register",
        json={"email": "NewPlayer@example.com", "password": "strong-password"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "newplayer@example.com"
    assert "password_hash" not in body

    user = db_session.query(User).filter_by(email="newplayer@example.com").one()
    assert user.password_hash
    assert user.password_hash != "strong-password"


def test_email_registrations_get_unique_public_profiles_and_are_searchable(api_client, db_session, user_factory, auth_as):
    auth_as(user_factory(email="viewer@example.com", public_nickname="alex"))
    registrations = [
        api_client.post("/auth/register", json={"email": email, "password": "strong-password"})
        for email in ("alex@one.example", "alex@two.example")
    ]

    assert [response.status_code for response in registrations] == [200, 200]
    users = [db_session.query(User).filter_by(email=email).one() for email in ("alex@one.example", "alex@two.example")]
    nicknames = [user.public_nickname for user in users]
    assert all(nicknames)
    assert len({nickname.lower() for nickname in nicknames}) == 2
    assert "alex" not in {nickname.lower() for nickname in nicknames}
    assert [response.json()["public_nickname"] for response in registrations] == nicknames

    search = api_client.get("/users/search", params={"q": "alex"})
    assert search.status_code == 200
    assert {item["public_id"] for item in search.json()} >= {user.public_id for user in users}
    for user in users:
        profile = api_client.get(f"/users/{user.public_id}")
        assert profile.status_code == 200
        assert profile.json()["public_id"] == user.public_id
        assert profile.json()["nickname"] == user.public_nickname


def test_friend_search_finds_a_changed_public_nickname(api_client, user_factory, auth_as):
    viewer = user_factory(email="search-viewer@example.com", public_nickname="Viewer")
    target = user_factory(
        email="search-target@example.com",
        display_name="old-display",
        public_nickname="OldAlias",
    )
    user_factory(
        email="search-no-profile@example.com",
        display_name="newalias-shadow",
        public_nickname=None,
    )
    auth_as(target)
    assert api_client.patch("/social/me", json={"nickname": "NewAlias"}).status_code == 200
    auth_as(viewer)

    response = api_client.get("/users/search", params={"q": "newalias"})

    assert response.status_code == 200
    assert [user["public_id"] for user in response.json()] == [target.public_id]


def test_registration_retries_when_another_user_takes_the_generated_identity(
    api_client, db_session, monkeypatch
):
    real_commit = db_session.commit
    race_inserted = False

    def commit_after_competing_registration():
        nonlocal race_inserted
        if not race_inserted:
            race_inserted = True
            pending = next(user for user in db_session.new if isinstance(user, User))
            db_session.expunge(pending)
            db_session.add(
                User(
                    email="competitor@example.com",
                    display_name=pending.display_name,
                    public_nickname=pending.public_nickname,
                )
            )
            real_commit()
            db_session.add(pending)
        return real_commit()

    monkeypatch.setattr(db_session, "commit", commit_after_competing_registration)
    response = api_client.post(
        "/auth/register", json={"email": "race@example.com", "password": "strong-password"}
    )

    assert response.status_code == 200
    competitor = db_session.query(User).filter_by(email="competitor@example.com").one()
    registered = db_session.query(User).filter_by(email="race@example.com").one()
    assert registered.display_name != competitor.display_name
    assert registered.public_nickname.lower() != competitor.public_nickname.lower()


def test_registration_returns_conflict_when_email_is_claimed_during_commit(
    api_client, db_session, monkeypatch
):
    real_commit = db_session.commit
    race_inserted = False

    def commit_after_same_email_registration():
        nonlocal race_inserted
        if not race_inserted:
            race_inserted = True
            pending = next(user for user in db_session.new if isinstance(user, User))
            db_session.expunge(pending)
            db_session.add(
                User(
                    email=pending.email,
                    display_name=pending.display_name,
                    public_nickname=pending.public_nickname,
                )
            )
            real_commit()
            db_session.add(pending)
        return real_commit()

    monkeypatch.setattr(db_session, "commit", commit_after_same_email_registration)
    response = api_client.post(
        "/auth/register", json={"email": "same@example.com", "password": "strong-password"}
    )

    assert response.status_code == 409
    assert db_session.query(User).filter_by(email="same@example.com").count() == 1


def test_duplicate_register_returns_conflict_without_creating_second_user(
    api_client, db_session
):
    payload = {"email": "duplicate@example.com", "password": "strong-password"}

    first = api_client.post("/auth/register", json=payload)
    second = api_client.post("/auth/register", json=payload)

    assert first.status_code == 200
    assert second.status_code == 409
    assert db_session.query(User).filter_by(email="duplicate@example.com").count() == 1


def test_login_returns_bearer_token_that_can_call_auth_me(api_client, db_session):
    api_client.post(
        "/auth/register",
        json={"email": "login@example.com", "password": "strong-password"},
    )

    response = api_client.post(
        "/auth/login",
        data={"username": "login@example.com", "password": "strong-password"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]

    me = api_client.get(
        "/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "login@example.com"


def test_current_user_can_create_list_get_update_and_delete_games(
    api_client, db_session, user_factory, auth_as
):
    user = auth_as(user_factory(email="owner@example.com"))
    create = api_client.post(
        "/games", json={"title": "Hades", "notes": "play soon", "info": " roguelike "}
    )

    assert create.status_code == 201
    game_id = create.json()["id"]
    game_uuid = uuid.UUID(game_id)
    stored = db_session.query(Game).filter_by(id=game_uuid).one()
    assert stored.owner_id == user.id
    assert stored.title == "Hades"

    listed = api_client.get("/games")
    fetched = api_client.get(f"/games/{game_id}")
    assert listed.status_code == 200
    assert [game["id"] for game in listed.json()] == [game_id]
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "Hades"

    updated = api_client.patch(f"/games/{game_id}", json={"title": "Hades II", "notes": "done"})
    assert updated.status_code == 200
    db_session.expire_all()
    stored = db_session.query(Game).filter_by(id=game_uuid).one()
    assert stored.title == "Hades II"
    assert stored.notes == "done"

    deleted = api_client.delete(f"/games/{game_id}")
    assert deleted.status_code == 204
    assert db_session.query(Game).filter_by(id=game_uuid).one_or_none() is None


def test_other_user_cannot_get_update_or_delete_game(api_client, db_session, user_factory, auth_as):
    owner = user_factory(email="owner@example.com")
    other = user_factory(email="other@example.com")
    auth_as(owner)
    created = api_client.post("/games", json={"title": "Owner game", "notes": "original"})
    game_id = created.json()["id"]
    game_uuid = uuid.UUID(game_id)
    original = db_session.query(Game).filter_by(id=game_uuid).one()

    auth_as(other)
    assert api_client.get(f"/games/{game_id}").status_code == 404
    assert api_client.patch(f"/games/{game_id}", json={"title": "stolen"}).status_code == 404
    assert api_client.delete(f"/games/{game_id}").status_code == 404

    db_session.expire_all()
    unchanged = db_session.query(Game).filter_by(id=game_uuid).one()
    assert unchanged.owner_id == owner.id
    assert unchanged.title == original.title == "Owner game"
    assert unchanged.notes == original.notes == "original"
