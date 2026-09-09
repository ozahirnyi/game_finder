"""Regression coverage for the social policy and explicit-read messaging API."""
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.main as main
from app.database import Base, User, Friendship, Conversation, Message, Game, FriendRequest, GameInvite, Notification


@pytest.fixture
def social():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    alice = User(email="alice@fix.test", public_nickname="Alice", steam_id="steam-alice")
    bob = User(email="bob@fix.test", public_nickname="Bob", steam_id="steam-bob")
    charlie = User(email="charlie@fix.test", public_nickname="Charlie")
    db.add_all([alice, bob, charlie]); db.commit()
    db.add(Friendship(user_low_id=min(alice.id, bob.id), user_high_id=max(alice.id, bob.id))); db.commit()
    main.app.dependency_overrides[main.get_db] = lambda: db
    main.app.dependency_overrides[main.get_current_user] = lambda: alice
    main.app.dependency_overrides[main.get_optional_current_user] = lambda: alice
    yield TestClient(main.app), db, alice, bob, charlie
    main.app.dependency_overrides.clear()
    db.close(); engine.dispose()


def conversation(client, bob):
    response = client.post("/conversations", json={"recipient_id": str(bob.id)})
    assert response.status_code == 201
    return response.json()["id"]


def test_fetch_is_not_read_and_explicit_read_is_bounded(social):
    client, db, alice, bob, _ = social
    cid = conversation(client, bob)
    now = datetime.now(timezone.utc)
    messages = [Message(conversation_id=uuid.UUID(cid), sender_id=bob.id, body=str(i), created_at=now + timedelta(seconds=i)) for i in range(3)]
    db.add_all(messages); db.commit()
    result = client.get(f"/conversations/{cid}/messages").json()
    assert all(item["read_at"] is None for item in result)
    assert client.post(f"/conversations/{cid}/read", json={"message_id": str(messages[1].id)}).status_code == 204
    db.expire_all()
    assert messages[0].read_at and messages[1].read_at
    assert messages[2].read_at is None
    assert client.get(f"/conversations/{cid}").json()["unread_count"] == 1


def test_message_cursors_are_scoped_and_have_stable_tie_order(social):
    client, db, alice, bob, charlie = social
    cid = conversation(client, bob)
    now = datetime.now(timezone.utc)
    ids = sorted([uuid.uuid4() for _ in range(5)])
    messages = [Message(id=ids[i-1], conversation_id=uuid.UUID(cid), sender_id=bob.id, body=str(i), created_at=now) for i in range(1, 6)]
    db.add_all(messages); db.commit()
    assert [m["body"] for m in client.get(f"/conversations/{cid}/messages", params={"after_id": str(messages[0].id), "limit": 2}).json()] == ["2", "3"]
    assert [m["body"] for m in client.get(f"/conversations/{cid}/messages", params={"before_id": str(messages[3].id), "limit": 2}).json()] == ["2", "3"]
    other = Conversation(user_low_id=min(alice.id, charlie.id), user_high_id=max(alice.id, charlie.id))
    db.add(other); db.flush()
    foreign = Message(conversation_id=other.id, sender_id=charlie.id, body="private")
    db.add(foreign); db.commit()
    assert client.get(f"/conversations/{cid}/messages", params={"after_id": str(foreign.id)}).status_code == 400
    assert client.post(f"/conversations/{cid}/read", json={"message_id": str(foreign.id)}).status_code == 400


def test_message_retry_is_idempotent_and_removal_keeps_read_only_history(social):
    client, db, alice, bob, _ = social
    cid = conversation(client, bob)
    payload = {"body": "hello", "client_message_id": str(uuid.uuid4())}
    first = client.post(f"/conversations/{cid}/messages", json=payload)
    second = client.post(f"/conversations/{cid}/messages", json=payload)
    assert first.json()["id"] == second.json()["id"]
    assert db.query(Message).count() == 1
    assert db.query(Notification).count() == 1
    assert client.delete(f"/friends/{bob.id}").status_code == 204
    assert client.get(f"/conversations/{cid}").json()["can_message"] is False
    assert client.get("/conversations").json()[0]["can_message"] is False
    assert len(client.get(f"/conversations/{cid}/messages").json()) == 1
    assert client.post(f"/conversations/{cid}/messages", json={"body": "no"}).status_code == 403


def test_block_is_bidirectional_and_unblock_does_not_restore_friendship(social):
    client, db, alice, bob, _ = social
    cid = conversation(client, bob)
    client.post(f"/conversations/{cid}/messages", json={"body": "hello"})
    request = FriendRequest(sender_id=bob.id, recipient_id=alice.id)
    invite = GameInvite(sender_id=bob.id, recipient_id=alice.id, game_name="Portal")
    db.add_all([request, invite]); db.commit()
    for _ in range(2):
        assert client.put(f"/social/blocks/{bob.id}").status_code == 204
    assert client.get("/social/blocks").json()[0]["user"]["id"] == str(bob.id)
    assert client.get("/conversations").json() == []
    assert client.get(f"/conversations/{cid}/messages").status_code == 404
    for viewer, target in [(alice, bob), (bob, alice)]:
        main.app.dependency_overrides[main.get_current_user] = lambda: viewer
        main.app.dependency_overrides[main.get_optional_current_user] = lambda: viewer
        assert client.get(f"/users/{target.public_id}").status_code == 404
        assert client.get(f"/social/profiles/{target.public_id}").status_code == 404
        assert target.public_id not in client.get("/social/players").text
        assert client.post("/friends/requests", json={"recipient_id": str(target.id)}).status_code == 404
        assert client.post("/social/friend-requests", json={"public_id": target.public_id}).status_code == 404
        assert client.get("/notifications").json() == []
    main.app.dependency_overrides[main.get_current_user] = lambda: alice
    for _ in range(2):
        assert client.delete(f"/social/blocks/{bob.id}").status_code == 204
    assert client.get("/friends").json() == []
    assert db.get(FriendRequest, request.id).status != "pending"
    assert db.get(GameInvite, invite.id).status != "pending"


def test_steam_sync_is_throttled_and_never_undoes_removal(social, monkeypatch):
    client, db, alice, bob, charlie = social
    charlie.steam_id = "steam-charlie"; db.commit()
    calls = []
    async def friends(*args, **kwargs):
        calls.append(1)
        return [{"steam_id": bob.steam_id}, {"steam_id": charlie.steam_id}], 2
    monkeypatch.setattr(main, "fetch_steam_friends", friends)
    assert client.delete(f"/friends/{bob.id}").status_code == 204
    result = client.post("/steam/friends/sync")
    assert result.status_code == 200
    assert result.json()["added"] == 1
    assert client.post("/steam/friends/sync").json()["status"] == "skipped"
    assert len(calls) == 1
    assert client.post("/steam/friends/sync?force=true").json()["added"] == 0
    assert {item["user"]["id"] for item in client.get("/friends").json()} == {str(charlie.id)}


def test_friend_library_reports_failure_and_provider_detail_identity(social, monkeypatch):
    client, db, alice, bob, _ = social
    db.add(Game(owner_id=bob.id, title="Saved", source="manual", catalog_game_id=42, link_state="linked", playtime_forever=125)); db.commit()
    async def failed(*args):
        raise main.HTTPException(status_code=502, detail="Steam unavailable")
    monkeypatch.setattr(main, "fetch_owned_games", failed)
    result = client.get(f"/friends/{bob.id}/profile").json()["library"]
    assert result["status"] == "partial"
    assert result["message"]
    assert result["data"][0]["playtime_forever"] == 125
    assert result["data"][0]["detail_game_id"] == "42"
    assert result["data"][0]["detail_source"] is None
    async def owned(*args):
        return [{"appid": 400, "name": "Portal", "playtime_forever": 121}]
    monkeypatch.setattr(main, "fetch_owned_games", owned)
    item = client.get(f"/friends/{bob.id}/profile").json()["library"]["data"][1]
    assert (item["detail_game_id"], item["detail_source"], item["playtime_forever"]) == ("400", "steam", 121)


def test_removal_preserves_legacy_message_history(social):
    client, db, alice, bob, _ = social
    sent = client.post(f"/social/friends/{bob.id}/messages", json={"text": "old conversation"})
    assert sent.status_code == 201
    assert client.delete(f"/friends/{bob.id}").status_code == 204
    chats = client.get("/conversations").json()
    assert len(chats) == 1
    assert chats[0]["can_message"] is False
    history = client.get(f"/conversations/{chats[0]['id']}/messages").json()
    assert history[0]["body"] == "old conversation"
    assert history[0]["id"] == sent.json()["id"]


def test_legacy_message_send_appears_in_canonical_chat_immediately(social):
    client, db, alice, bob, _ = social
    sent = client.post(f"/social/friends/{bob.id}/messages", json={"text": "legacy client"})
    assert sent.status_code == 201
    chats = client.get("/conversations").json()
    assert len(chats) == 1
    history = client.get(f"/conversations/{chats[0]['id']}/messages").json()
    assert history[0]["id"] == sent.json()["id"]


def test_legacy_common_games_respects_private_library(social, monkeypatch):
    client, db, alice, bob, _ = social
    bob.library_visibility = "private"
    db.commit()
    async def unexpected(*args):
        pytest.fail("Private library must not be fetched")
    monkeypatch.setattr(main, "fetch_owned_games", unexpected)
    assert client.get(f"/social/friends/{bob.id}/common-games").status_code == 403


def test_message_retry_conflicts_and_blocked_routes(social):
    client, db, alice, bob, charlie = social
    cid = conversation(client, bob)
    key = str(uuid.uuid4())
    assert client.post(f"/conversations/{cid}/messages", json={"body": "hello", "client_message_id": key}).status_code == 201
    assert client.post(f"/conversations/{cid}/messages", json={"body": "changed", "client_message_id": key}).status_code == 409
    assert client.post(f"/conversations/{cid}/messages", json={"body": "   "}).status_code == 422
    assert client.put(f"/social/blocks/{bob.id}").status_code == 204
    for path in [f"/conversations/{cid}", f"/friends/{bob.id}/profile", f"/friends/{bob.id}/shared-games"]:
        assert client.get(path).status_code == 404
    assert client.post(f"/conversations/{cid}/messages", json={"body": "hidden"}).status_code == 404
    assert client.post(f"/social/friends/{bob.id}/messages", json={"text": "hidden"}).status_code == 403
    assert client.post("/game-invites", json={"recipient_id": str(bob.id), "game_name": "Portal"}).status_code == 403
    assert client.get(f"/social/friends/{bob.id}/common-games").status_code == 403


def test_manual_reconnect_and_sync_failure_do_not_erase_suppression(social, monkeypatch):
    client, db, alice, bob, _ = social
    assert client.delete(f"/friends/{bob.id}").status_code == 204
    request = client.post("/friends/requests", json={"recipient_id": str(bob.id)}).json()
    main.app.dependency_overrides[main.get_current_user] = lambda: bob
    assert client.post(f"/friends/requests/{request['id']}/accept").status_code == 200
    assert len(client.get("/friends").json()) == 1
    assert client.delete(f"/friends/{alice.id}").status_code == 204
    async def failed(*args, **kwargs):
        raise RuntimeError("provider down")
    monkeypatch.setattr(main, "fetch_steam_friends", failed)
    assert client.post("/steam/friends/sync").json()["status"] == "unavailable"
    async def friends(*args, **kwargs):
        assert kwargs == {"limit": None, "include_profiles": False}
        return [{"steam_id": alice.steam_id}], 1
    monkeypatch.setattr(main, "fetch_steam_friends", friends)
    assert client.post("/steam/friends/sync?force=true").json()["added"] == 0


def test_public_profile_identity_and_google_link_state(social):
    from app.database import OAuthIdentity
    client, db, alice, bob, _ = social
    assert client.get(f"/users/{bob.public_id}").json()["user_id"] == str(bob.id)
    assert client.get("/profile").json()["google_linked"] is False
    db.add(OAuthIdentity(user_id=alice.id, provider="google", provider_subject="google-alice"))
    db.commit()
    assert client.get("/profile").json()["google_linked"] is True


def test_blocked_chats_do_not_consume_visible_pagination(social):
    client, db, alice, bob, charlie = social
    db.add(Friendship(user_low_id=min(alice.id, charlie.id), user_high_id=max(alice.id, charlie.id)))
    db.commit()
    visible_id = conversation(client, charlie)
    conversation(client, bob)
    assert client.put(f"/social/blocks/{bob.id}").status_code == 204
    assert [row["id"] for row in client.get("/conversations?limit=1").json()] == [visible_id]
