from datetime import datetime, timezone
from pathlib import Path
import re
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.main as main
from app.database import Base, DirectMessage, Favorite, FriendRequest, Friendship, Game, GameInvite, Notification, OAuthIdentity, User, WishlistItem


client = TestClient(main.app)


@pytest.fixture
def social_db():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine,
        tables=[
            User.__table__,
            FriendRequest.__table__,
            Friendship.__table__,
            DirectMessage.__table__,
            GameInvite.__table__,
            Notification.__table__,
            OAuthIdentity.__table__,
            Game.__table__,
            Favorite.__table__,
            WishlistItem.__table__,
        ],
    )
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        main.app.dependency_overrides.clear()
        session.close()


def use_social_api(user, db):
    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.get_db] = lambda: db
    return client


def create_users(db):
    alice = User(email="alice@example.com", public_id="alice-id", public_nickname="Alice", steam_id="alice-steam", steam_avatar="https://avatar/alice")
    bob = User(email="bob@example.com", public_id="bob-id", public_nickname="Bob")
    charlie = User(email="charlie@example.com", public_id="charlie-id", public_nickname="Charlie")
    hidden = User(email="hidden@example.com", public_id="hidden-id", public_nickname=None)
    db.add_all([alice, bob, charlie, hidden])
    db.commit()
    return alice, bob, charlie, hidden


def test_profile_visibility_defaults_to_public_for_existing_user(social_db):
    user = User(email="existing@example.com", public_id="existing-id")
    social_db.add(user)
    social_db.commit()
    social_db.refresh(user)

    assert (
        user.library_visibility,
        user.favorites_visibility,
        user.wishlist_visibility,
        user.steam_visibility,
    ) == ("public", "public", "public", "public")


@pytest.mark.parametrize("field", ["library_visibility", "favorites_visibility", "wishlist_visibility", "steam_visibility"])
def test_profile_rejects_invalid_visibility_values(social_db, field):
    alice, *_ = create_users(social_db)

    response = use_social_api(alice, social_db).patch("/profile", json={field: "team"})

    assert response.status_code == 422


def test_profile_patch_persists_each_visibility_independently(social_db):
    alice, *_ = create_users(social_db)

    response = use_social_api(alice, social_db).patch(
        "/profile",
        json={
            "library_visibility": "friends",
            "favorites_visibility": "private",
            "wishlist_visibility": "public",
            "steam_visibility": "friends",
        },
    )

    assert response.status_code == 200
    assert {
        field: response.json()[field]
        for field in ("library_visibility", "favorites_visibility", "wishlist_visibility", "steam_visibility")
    } == {
        "library_visibility": "friends",
        "favorites_visibility": "private",
        "wishlist_visibility": "public",
        "steam_visibility": "friends",
    }
    social_db.refresh(alice)
    assert alice.library_visibility == "friends"
    assert alice.favorites_visibility == "private"
    assert alice.wishlist_visibility == "public"
    assert alice.steam_visibility == "friends"


@pytest.mark.parametrize(
    ("viewer", "visibility", "visible"),
    [
        ("owner", "private", True),
        ("friend", "friends", True),
        ("stranger", "friends", False),
        ("anonymous", "public", True),
        ("anonymous", "private", False),
    ],
)
def test_public_profile_library_visibility_does_not_leak_hidden_data(social_db, viewer, visibility, visible):
    alice, bob, charlie, _hidden = create_users(social_db)
    bob.library_visibility = visibility
    social_db.add(Game(owner_id=bob.id, title="Secret game", source="manual"))
    social_db.add(Friendship(user_low_id=min(alice.id, bob.id), user_high_id=max(alice.id, bob.id)))
    social_db.commit()
    current_user = {"owner": bob, "friend": alice, "stranger": charlie}.get(viewer)
    main.app.dependency_overrides[main.get_db] = lambda: social_db
    main.app.dependency_overrides[main.get_optional_current_user] = lambda: current_user

    response = client.get(f"/users/{bob.public_id}")

    assert response.status_code == 200
    library = response.json()["library"]
    if visible:
        assert library["status"] == "ready"
        assert library["data"][0]["title"] == "Secret game"
    else:
        assert library == {"status": "hidden", "data": [], "message": "This section is private."}
        assert "Secret game" not in response.text


def test_public_profile_returns_owned_library_and_collection_covers(social_db):
    alice, bob, *_ = create_users(social_db)
    social_db.add_all([
        Game(owner_id=bob.id, title="Zelda", source="manual"),
        Game(owner_id=bob.id, title="Astro", source="psn", img_icon_url="https://cover/astro"),
        Game(owner_id=bob.id, title="Baldur", source="steam", external_id="42", img_icon_url="hash"),
        Favorite(user_id=bob.id, catalog_game_id=1, title="Favorite", cover_url="https://cover/favorite"),
        WishlistItem(user_id=bob.id, catalog_game_id=2, title="Wishlist", cover_url="https://cover/wishlist"),
    ])
    social_db.commit()
    main.app.dependency_overrides[main.get_db] = lambda: social_db
    main.app.dependency_overrides[main.get_optional_current_user] = lambda: alice

    response = client.get(f"/users/{bob.public_id}")

    assert response.status_code == 200
    payload = response.json()
    assert [game["title"] for game in payload["library"]["data"]] == ["Astro", "Baldur", "Zelda"]
    assert payload["favorites"]["data"][0]["cover_url"] == "https://cover/favorite"
    assert payload["wishlist"]["data"][0]["cover_url"] == "https://cover/wishlist"


def test_friend_profile_returns_friend_bio_avatar_and_library(monkeypatch, social_db):
    alice, bob, charlie, _ = create_users(social_db)
    bob.bio = "Steam collector"
    bob.steam_id = "bob-steam"
    async def fake_owned_games(steam_id):
        assert steam_id == "bob-steam"
        return [{"appid": 620, "name": "Portal 2", "playtime_forever": 120, "img_icon_url": "icon"}]
    monkeypatch.setattr(main, "fetch_owned_games", fake_owned_games)
    social_db.add_all([
        Friendship(user_low_id=min(alice.id, bob.id), user_high_id=max(alice.id, bob.id)),
    ])
    social_db.commit()

    response = use_social_api(alice, social_db).get(f"/friends/{bob.id}/profile")

    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["id"] == str(bob.id)
    assert payload["user"]["bio"] == "Steam collector"
    assert payload["library"]["status"] == "ready"
    assert payload["library"]["data"][0]["title"] == "Portal 2"
    assert use_social_api(charlie, social_db).get(f"/friends/{bob.id}/profile").status_code == 404


def test_friend_shared_games_match_saved_source_and_external_id_only(social_db):
    alice, bob, charlie, _ = create_users(social_db)
    social_db.add_all([
        Friendship(user_low_id=min(alice.id, bob.id), user_high_id=max(alice.id, bob.id)),
        Game(owner_id=alice.id, title="Portal Two", source="steam", external_id="620"),
        Game(owner_id=bob.id, title="Portal 2", source="steam", external_id="620"),
        Game(owner_id=alice.id, title="Same title", source="manual", external_id="first"),
        Game(owner_id=bob.id, title="Same title", source="manual", external_id="second"),
    ])
    social_db.commit()

    response = use_social_api(alice, social_db).get(f"/friends/{bob.id}/shared-games")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "data": [{"source": "steam", "external_id": "620", "title": "Portal 2", "cover_url": None}],
        "message": None,
    }
    assert use_social_api(alice, social_db).get(f"/friends/{charlie.id}/shared-games").status_code == 404


def test_friend_shared_games_respects_library_visibility(social_db):
    alice, bob, *_ = create_users(social_db)
    bob.library_visibility = "private"
    social_db.add_all([
        Friendship(user_low_id=min(alice.id, bob.id), user_high_id=max(alice.id, bob.id)),
        Game(owner_id=alice.id, title="Portal 2", source="steam", external_id="620"),
        Game(owner_id=bob.id, title="Portal 2", source="steam", external_id="620"),
    ])
    social_db.commit()

    response = use_social_api(alice, social_db).get(f"/friends/{bob.id}/shared-games")

    assert response.status_code == 200
    assert response.json() == {
        "status": "private",
        "data": [],
        "message": "This library is private.",
    }


def test_game_invite_preserves_canonical_identity_and_notifies_both_parties(social_db):
    alice, bob, charlie, _ = create_users(social_db)
    social_db.add(Friendship(user_low_id=alice.id, user_high_id=bob.id))
    social_db.commit()

    created = use_social_api(alice, social_db).post(
        "/game-invites",
        json={
            "recipient_id": str(bob.id),
            "game_name": "Portal 2",
            "source": "steam",
            "external_id": "620",
        },
    )

    assert created.status_code == 201
    assert created.json()["source"] == "steam"
    assert created.json()["external_id"] == "620"
    incoming = use_social_api(bob, social_db).get("/game-invites")
    assert [invite["id"] for invite in incoming.json()] == [created.json()["id"]]
    assert use_social_api(charlie, social_db).post(
        f"/game-invites/{created.json()['id']}/response",
        json={"status": "accepted"},
    ).status_code == 404
    accepted = use_social_api(bob, social_db).post(
        f"/game-invites/{created.json()['id']}/response",
        json={"status": "accepted"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    assert any(item["type"] == "game_invite" for item in use_social_api(bob, social_db).get("/notifications").json())
    assert any(item["type"] == "game_invite_response" for item in use_social_api(alice, social_db).get("/notifications").json())


def test_social_profile_nickname_and_player_search_are_public_but_private_fields_are_not(social_db):
    alice, bob, charlie, _hidden = create_users(social_db)
    api = use_social_api(alice, social_db)

    updated = api.patch("/social/me", json={"nickname": "  ALICE_PLAYER  "})
    assert updated.status_code == 200
    assert updated.json()["nickname"] == "ALICE_PLAYER"
    assert api.patch("/social/me", json={"nickname": "bob"}).status_code == 409
    assert api.patch("/social/me", json={"nickname": "Straße"}).status_code == 422

    players = api.get("/social/players?q=ar&limit=1")
    assert players.status_code == 200
    assert players.json()["players"] == [{"public_id": charlie.public_id, "nickname": "Charlie", "avatar": None}]
    assert players.json()["next_cursor"] is None
    assert "email" not in players.text and "steam_id" not in players.text

    profile = api.get(f"/social/profiles/{bob.public_id}")
    assert profile.status_code == 200
    assert profile.json() == {
        "public_id": bob.public_id,
        "nickname": "Bob",
        "avatar": None,
        "relationship": "none",
    }
    assert "email" not in profile.text and "steam_id" not in profile.text


def test_friend_request_lifecycle_includes_cancel_and_restricts_other_users(social_db):
    alice, bob, charlie, _hidden = create_users(social_db)
    request = use_social_api(alice, social_db).post("/social/friend-requests", json={"public_id": bob.public_id})
    assert request.status_code == 201
    request_id = request.json()["id"]
    assert request.json()["status"] == "pending"
    assert use_social_api(alice, social_db).post("/social/friend-requests", json={"public_id": alice.public_id}).status_code == 400
    assert use_social_api(alice, social_db).post("/social/friend-requests", json={"public_id": bob.public_id}).status_code == 409
    assert use_social_api(charlie, social_db).post(f"/social/friend-requests/{request_id}/accept").status_code == 403
    assert use_social_api(charlie, social_db).delete(f"/social/friend-requests/{request_id}").status_code == 403

    cancelled = use_social_api(alice, social_db).delete(f"/social/friend-requests/{request_id}")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    accepted_request = use_social_api(alice, social_db).post("/social/friend-requests", json={"public_id": bob.public_id})
    assert social_db.query(FriendRequest).count() == 1
    accepted = use_social_api(bob, social_db).post(f"/social/friend-requests/{accepted_request.json()['id']}/accept")
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    assert use_social_api(alice, social_db).get(f"/social/profiles/{bob.public_id}").json()["relationship"] == "friends"
    mine = use_social_api(bob, social_db).get("/social/me")
    assert mine.json()["friends"] == [{"id": str(alice.id), "public_id": alice.public_id, "nickname": "Alice", "avatar": alice.steam_avatar}]


@pytest.mark.parametrize("status", ["cancelled", "declined", "accepted"])
def test_legacy_friend_routes_hide_and_reject_resolved_requests(social_db, status):
    alice, bob, _charlie, _hidden = create_users(social_db)
    friend_request = FriendRequest(
        sender_id=alice.id,
        recipient_id=bob.id,
        status=status,
    )
    social_db.add(friend_request)
    social_db.commit()

    outgoing = use_social_api(alice, social_db).get("/friends/requests")
    incoming = use_social_api(bob, social_db).get("/friends/requests/incoming")
    accepted = use_social_api(bob, social_db).post(
        f"/friends/requests/{friend_request.id}/accept",
    )

    assert outgoing.status_code == 200
    assert outgoing.json() == []
    assert incoming.status_code == 200
    assert incoming.json() == []
    assert accepted.status_code == 404
    assert social_db.query(Friendship).count() == 0


def test_messages_require_confirmed_friendship_trim_text_and_page_backwards(social_db):
    alice, bob, charlie, _hidden = create_users(social_db)
    api = use_social_api(alice, social_db)
    assert api.post(f"/social/friends/{bob.id}/messages", json={"text": "hello"}).status_code == 403

    friendship = Friendship(user_low_id=alice.id, user_high_id=bob.id)
    social_db.add(friendship)
    social_db.commit()
    assert api.post(f"/social/friends/{bob.id}/messages", json={"text": "   "}).status_code == 422
    assert api.post(f"/social/friends/{bob.id}/messages", json={"text": "x" * 2001}).status_code == 422
    created = api.post(f"/social/friends/{bob.id}/messages", json={"text": "  hello  "})
    assert created.status_code == 201
    assert created.json()["text"] == "hello"

    social_db.add_all([
        DirectMessage(friendship_id=friendship.id, author_id=alice.id, text="first", created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)),
        DirectMessage(friendship_id=friendship.id, author_id=bob.id, text="second", created_at=datetime(2026, 1, 2, tzinfo=timezone.utc)),
        DirectMessage(friendship_id=friendship.id, author_id=alice.id, text="third", created_at=datetime(2026, 1, 3, tzinfo=timezone.utc)),
    ])
    social_db.commit()
    latest = api.get(f"/social/friends/{bob.id}/messages?limit=2")
    assert latest.status_code == 200
    assert [message["text"] for message in latest.json()["messages"]] == ["third", "hello"]
    older = api.get(f"/social/friends/{bob.id}/messages?limit=2&cursor={latest.json()['next_cursor']}")
    assert [message["text"] for message in older.json()["messages"]] == ["first", "second"]
    assert use_social_api(charlie, social_db).get(f"/social/friends/{alice.id}/messages").status_code == 403


def test_common_games_use_the_exact_friends_private_steam_links(monkeypatch, social_db):
    alice, bob, _charlie, _hidden = create_users(social_db)
    bob.steam_id = "bob-steam"
    social_db.add(Friendship(user_low_id=alice.id, user_high_id=bob.id))
    social_db.commit()
    requested_steam_ids = []

    async def fake_fetch_owned_games(steam_id):
        requested_steam_ids.append(steam_id)
        if steam_id == "alice-steam":
            return [
                {
                    "appid": 1,
                    "name": "Deep Rock Galactic",
                    "playtime_forever": 120,
                    "playtime_2weeks": 0,
                    "img_icon_url": "alice-icon",
                },
                {
                    "appid": 2,
                    "name": "Portal 2",
                    "playtime_forever": 60,
                    "playtime_2weeks": 0,
                    "img_icon_url": None,
                },
            ]
        return [
            {
                "appid": 1,
                "name": "Deep Rock Galactic",
                "playtime_forever": 300,
                "playtime_2weeks": 10,
                "img_icon_url": "bob-icon",
            },
            {
                "appid": 3,
                "name": "Helldivers 2",
                "playtime_forever": 90,
                "playtime_2weeks": 20,
                "img_icon_url": None,
            },
        ]

    monkeypatch.setattr(main, "fetch_owned_games", fake_fetch_owned_games)

    response = use_social_api(alice, social_db).get(
        f"/social/friends/{bob.id}/common-games",
    )

    assert response.status_code == 200
    assert requested_steam_ids == ["alice-steam", "bob-steam"]
    assert response.json() == {
        "games": [
            {
                "appid": 1,
                "name": "Deep Rock Galactic",
                "img_icon_url": "alice-icon",
            },
        ],
    }
    assert "steam_id" not in response.text
    assert "playtime" not in response.text


def test_common_games_require_friendship_and_both_linked_accounts(monkeypatch, social_db):
    alice, bob, charlie, _hidden = create_users(social_db)
    calls = []

    async def fake_fetch_owned_games(steam_id):
        calls.append(steam_id)
        return []

    monkeypatch.setattr(main, "fetch_owned_games", fake_fetch_owned_games)

    not_friends = use_social_api(alice, social_db).get(
        f"/social/friends/{charlie.id}/common-games",
    )
    assert not_friends.status_code == 403

    social_db.add(Friendship(user_low_id=alice.id, user_high_id=bob.id))
    social_db.commit()
    missing_link = use_social_api(alice, social_db).get(
        f"/social/friends/{bob.id}/common-games",
    )

    assert missing_link.status_code == 409
    assert "steam_id" not in missing_link.text
    assert calls == []


def test_friendship_model_enforces_canonical_pair_and_social_migration_exists():
    high = uuid.UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")
    low = uuid.UUID("00000000-0000-0000-0000-000000000001")
    friendship = Friendship(user_low_id=high, user_high_id=low)
    assert friendship.user_low_id == low
    assert friendship.user_high_id == high
    assert any(
        constraint.sqltext.text == "user_low_id < user_high_id"
        for constraint in Friendship.__table__.constraints
        if hasattr(constraint, "sqltext")
    )

    versions = Path("alembic/versions")
    historical_revisions = {
        "a1b2c3d4e5f6_add_user_profile_fields.py",
        "d5e6f7a8b9c0_add_game_catalogue_id.py",
        "e6f7a8b9c0d1_add_social_features.py",
        "f7a8b9c0d1e2_add_collections_and_price_alerts.py",
    }
    assert all((versions / revision).is_file() for revision in historical_revisions)
    social_migration = versions / "b2c3d4e5f6a7_add_social_features.py"
    contents = social_migration.read_text(encoding="utf-8")
    assert 'revision = "b2c3d4e5f6a7"' in contents
    assert 'down_revision = "f7a8b9c0d1e2"' in contents
    revision_ids = [
        re.search(r"revision(?:\s*:\s*[^=]+)?\s*=\s*['\"]([^'\"]+)['\"]", path.read_text(encoding="utf-8")).group(1)
        for path in versions.glob("*.py")
    ]
    assert len(revision_ids) == len(set(revision_ids))


def test_social_migration_removes_legacy_friend_request_pair_constraint_before_lifecycle_upgrade():
    migration = Path("alembic/versions/b2c3d4e5f6a7_add_social_features.py").read_text(encoding="utf-8")

    assert 'op.drop_constraint("uq_friend_request_pair", "friend_requests", type_="unique")' in migration
    assert "DELETE FROM friend_requests AS duplicate" in migration
    assert "USING friend_requests AS retained" in migration
    assert 'op.create_unique_constraint("uq_friend_request_pair", "friend_requests", ["sender_id", "recipient_id"])' in migration
