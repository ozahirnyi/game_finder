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
from app.database import Base, DirectMessage, FriendRequest, Friendship, User


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
        tables=[User.__table__, FriendRequest.__table__, Friendship.__table__, DirectMessage.__table__],
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
