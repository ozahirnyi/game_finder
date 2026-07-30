import pytest

from app.database import Conversation, Friendship, GameInvite, FriendRequest, Message, Notification


pytestmark = pytest.mark.integration


def make_user(user_factory, email, nickname):
    return user_factory(email=email, public_nickname=nickname)


def make_friends(db_session, first, second):
    friendship = Friendship(user_low_id=first.id, user_high_id=second.id)
    db_session.add(friendship)
    db_session.commit()
    return friendship


def test_legacy_friend_requests_cover_lists_create_accept_and_owner_checks(
    api_client, db_session, user_factory, auth_as
):
    sender = make_user(user_factory, "legacy-sender@example.com", "Sender")
    recipient = make_user(user_factory, "legacy-recipient@example.com", "Recipient")
    outsider = make_user(user_factory, "legacy-outsider@example.com", "Outsider")

    auth_as(sender)
    created = api_client.post(
        "/friends/requests", json={"recipient_id": str(recipient.id), "message": "hello"}
    )
    assert created.status_code == 201
    request_id = created.json()["id"]
    assert api_client.get("/friends/requests").json()[0]["message"] == "hello"
    assert api_client.get("/friends/requests/incoming").json() == []

    auth_as(recipient)
    assert api_client.get("/friends/requests/incoming").json()[0]["id"] == request_id
    assert api_client.get("/friends/requests").json() == []
    assert api_client.post(f"/friends/requests/{request_id}/accept").status_code == 200
    assert db_session.query(FriendRequest).count() == 0
    assert db_session.query(Friendship).count() == 1

    auth_as(outsider)
    assert api_client.post(f"/friends/requests/{request_id}/accept").status_code == 404
    assert api_client.delete(f"/friends/requests/{request_id}").status_code == 404


def test_legacy_friend_request_delete_and_invalid_create_branches(
    api_client, db_session, user_factory, auth_as
):
    sender = make_user(user_factory, "legacy-delete-sender@example.com", "Sender")
    recipient = make_user(user_factory, "legacy-delete-recipient@example.com", "Recipient")
    auth_as(sender)
    assert api_client.post("/friends/requests", json={"recipient_id": str(sender.id)}).status_code == 400
    assert api_client.post("/friends/requests", json={"recipient_id": str(recipient.id)}).status_code == 201
    request = db_session.query(FriendRequest).one()
    assert api_client.post("/friends/requests", json={"recipient_id": str(recipient.id)}).status_code == 409
    auth_as(recipient)
    assert api_client.post("/friends/requests", json={"recipient_id": str(sender.id)}).status_code == 409
    assert api_client.delete(f"/friends/requests/{request.id}").status_code == 204
    assert db_session.query(FriendRequest).count() == 0


def test_legacy_friends_list_profile_and_delete_with_scoping(
    api_client, db_session, user_factory, auth_as
):
    user = make_user(user_factory, "legacy-friend-user@example.com", "Friend")
    friend = make_user(user_factory, "legacy-friend@example.com", "Best Friend")
    stranger = make_user(user_factory, "legacy-stranger@example.com", "Stranger")
    make_friends(db_session, user, friend)

    auth_as(user)
    assert api_client.get("/friends").json()[0]["user"]["id"] == str(friend.id)
    profile = api_client.get(f"/friends/{friend.id}/profile")
    assert profile.status_code == 200
    assert profile.json()["library"]["status"] == "empty"
    assert api_client.get(f"/friends/{stranger.id}/profile").status_code == 404
    assert api_client.delete(f"/friends/{stranger.id}").status_code == 404
    assert api_client.delete(f"/friends/{friend.id}").status_code == 204
    assert db_session.query(Friendship).count() == 0


def test_legacy_conversations_messages_persist_read_state_and_scope(
    api_client, db_session, user_factory, auth_as
):
    sender = make_user(user_factory, "legacy-conversation-sender@example.com", "Sender")
    recipient = make_user(user_factory, "legacy-conversation-recipient@example.com", "Recipient")
    outsider = make_user(user_factory, "legacy-conversation-outsider@example.com", "Outsider")
    make_friends(db_session, sender, recipient)

    auth_as(sender)
    assert api_client.post("/conversations", json={"recipient_id": str(outsider.id)}).status_code == 403
    created = api_client.post("/conversations", json={"recipient_id": str(recipient.id)})
    assert created.status_code == 201
    conversation_id = created.json()["id"]
    assert api_client.post("/conversations", json={"recipient_id": str(recipient.id)}).json()["id"] == conversation_id
    assert api_client.post(f"/conversations/{conversation_id}/messages", json={"body": "  hi  "}).status_code == 201

    auth_as(recipient)
    assert api_client.get("/conversations").json()[0]["unread_count"] == 1
    messages = api_client.get(f"/conversations/{conversation_id}/messages")
    assert messages.status_code == 200
    assert messages.json()[0]["body"] == "hi"
    assert db_session.query(Message).one().read_at is not None
    auth_as(outsider)
    assert api_client.get(f"/conversations/{conversation_id}/messages").status_code == 404


def test_legacy_game_invites_persist_response_and_reject_non_owners(
    api_client, db_session, user_factory, auth_as
):
    sender = make_user(user_factory, "legacy-invite-sender@example.com", "Sender")
    recipient = make_user(user_factory, "legacy-invite-recipient@example.com", "Recipient")
    outsider = make_user(user_factory, "legacy-invite-outsider@example.com", "Outsider")
    make_friends(db_session, sender, recipient)
    auth_as(sender)
    assert api_client.post("/game-invites", json={"recipient_id": str(outsider.id), "game_name": "X"}).status_code == 403
    created = api_client.post("/game-invites", json={"recipient_id": str(recipient.id), "game_name": "  Elden Ring  ", "game_id": 1})
    assert created.status_code == 201
    invite_id = created.json()["id"]
    assert api_client.get("/game-invites").json()[0]["status"] == "pending"
    auth_as(outsider)
    assert api_client.post(f"/game-invites/{invite_id}/response", json={"status": "accepted"}).status_code == 404
    auth_as(recipient)
    assert api_client.post(f"/game-invites/{invite_id}/response", json={"status": "accepted"}).status_code == 200
    assert db_session.query(GameInvite).one().status == "accepted"
    assert api_client.post(f"/game-invites/{invite_id}/response", json={"status": "declined"}).status_code == 409


def test_legacy_notifications_filter_mark_read_read_all_and_owner_scope(
    api_client, db_session, user_factory, auth_as
):
    user = make_user(user_factory, "legacy-notification-user@example.com", "User")
    outsider = make_user(user_factory, "legacy-notification-outsider@example.com", "Outsider")
    unread = Notification(user_id=user.id, type="test", payload={"value": 1})
    read = Notification(user_id=user.id, type="old", payload={}, read_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc))
    db_session.add_all([unread, read, Notification(user_id=outsider.id, type="private", payload={})])
    db_session.commit()
    auth_as(user)
    assert len(api_client.get("/notifications?unread_only=true").json()) == 1
    assert api_client.post(f"/notifications/{unread.id}/read").status_code == 200
    assert db_session.get(Notification, unread.id).read_at is not None
    assert api_client.post(f"/notifications/{outsider.id}/read").status_code == 404
    second = Notification(user_id=user.id, type="second", payload={})
    db_session.add(second)
    db_session.commit()
    assert api_client.post("/notifications/read-all").status_code == 204
    assert all(item.read_at is not None for item in db_session.query(Notification).filter(Notification.user_id == user.id).all())


def test_social_invite_link_uses_frontend_url(api_client, user_factory, auth_as, monkeypatch):
    user = make_user(user_factory, "legacy-link@example.com", "Link User")
    monkeypatch.setenv("FRONTEND_PUBLIC_URL", "https://playfinder.example")
    auth_as(user)
    response = api_client.get("/social/invite-link")
    assert response.status_code == 200
    assert response.json() == {"url": f"https://playfinder.example/friends?add={user.display_name}"}
