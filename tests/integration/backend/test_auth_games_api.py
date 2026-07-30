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
