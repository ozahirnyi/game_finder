import pytest

from app.database import DirectMessage, FriendRequest, Friendship


pytestmark = pytest.mark.integration


def make_user(user_factory, email, public_id, nickname):
    return user_factory(
        email=email,
        public_id=public_id,
        public_nickname=nickname,
    )


def create_request(api_client, auth_as, sender, recipient):
    auth_as(sender)
    response = api_client.post(
        "/social/friend-requests",
        json={"public_id": recipient.public_id},
    )
    assert response.status_code == 201
    return response


def test_create_friend_request_persists_pending_row(
    api_client, db_session, user_factory, auth_as
):
    sender = make_user(user_factory, "sender@example.com", "sender", "Sender")
    recipient = make_user(user_factory, "recipient@example.com", "recipient", "Recipient")

    response = create_request(api_client, auth_as, sender, recipient)

    request = db_session.query(FriendRequest).one()
    assert response.json()["id"] == str(request.id)
    assert request.sender_id == sender.id
    assert request.recipient_id == recipient.id
    assert request.status == "pending"
    assert db_session.query(Friendship).count() == 0


def test_accept_friend_request_creates_friendship_and_updates_request(
    api_client, db_session, user_factory, auth_as
):
    sender = make_user(user_factory, "accept-sender@example.com", "accept-sender", "Sender")
    recipient = make_user(user_factory, "accept-recipient@example.com", "accept-recipient", "Recipient")
    request_id = create_request(api_client, auth_as, sender, recipient).json()["id"]

    auth_as(recipient)
    response = api_client.post(f"/social/friend-requests/{request_id}/accept")

    assert response.status_code == 200
    request = db_session.query(FriendRequest).one()
    friendship = db_session.query(Friendship).one()
    assert request.status == "accepted"
    assert {friendship.user_low_id, friendship.user_high_id} == {sender.id, recipient.id}


@pytest.mark.parametrize(
    ("endpoint", "expected_status", "actor"),
    [
        ("decline", "declined", "recipient"),
        ("cancel", "cancelled", "sender"),
    ],
)
def test_friend_request_decline_and_cancel_transitions(
    endpoint, expected_status, actor, api_client, db_session, user_factory, auth_as
):
    sender = make_user(user_factory, f"{endpoint}-sender@example.com", f"{endpoint}-sender", "Sender")
    recipient = make_user(user_factory, f"{endpoint}-recipient@example.com", f"{endpoint}-recipient", "Recipient")
    request_id = create_request(api_client, auth_as, sender, recipient).json()["id"]

    auth_as(recipient if actor == "recipient" else sender)
    response = (
        api_client.post(f"/social/friend-requests/{request_id}/{endpoint}")
        if endpoint == "decline"
        else api_client.delete(f"/social/friend-requests/{request_id}")
    )

    assert response.status_code == 200
    assert db_session.query(FriendRequest).one().status == expected_status
    assert db_session.query(Friendship).count() == 0


def test_third_user_cannot_accept_or_cancel_request_and_db_is_unchanged(
    api_client, db_session, user_factory, auth_as
):
    sender = make_user(user_factory, "third-sender@example.com", "third-sender", "Sender")
    recipient = make_user(user_factory, "third-recipient@example.com", "third-recipient", "Recipient")
    third = make_user(user_factory, "third-observer@example.com", "third-observer", "Observer")
    request_id = create_request(api_client, auth_as, sender, recipient).json()["id"]

    auth_as(third)
    accept = api_client.post(f"/social/friend-requests/{request_id}/accept")
    cancel = api_client.delete(f"/social/friend-requests/{request_id}")

    assert accept.status_code == 403
    assert cancel.status_code == 403
    assert db_session.query(FriendRequest).one().status == "pending"
    assert db_session.query(Friendship).count() == 0


def test_messages_require_friendship_and_persist_trimmed_text(
    api_client, db_session, user_factory, auth_as
):
    sender = make_user(user_factory, "message-sender@example.com", "message-sender", "Sender")
    recipient = make_user(user_factory, "message-recipient@example.com", "message-recipient", "Recipient")
    request_id = create_request(api_client, auth_as, sender, recipient).json()["id"]
    auth_as(recipient)
    assert api_client.post(f"/social/friend-requests/{request_id}/accept").status_code == 200

    auth_as(sender)
    response = api_client.post(
        f"/social/friends/{recipient.id}/messages",
        json={"text": "  hello friend  "},
    )

    assert response.status_code == 201
    message = db_session.query(DirectMessage).one()
    assert message.author_id == sender.id
    assert message.text == "hello friend"
    assert response.json()["text"] == "hello friend"


def test_non_friend_cannot_send_message_or_write_row(
    api_client, db_session, user_factory, auth_as
):
    sender = make_user(user_factory, "nonfriend-sender@example.com", "nonfriend-sender", "Sender")
    stranger = make_user(user_factory, "nonfriend-stranger@example.com", "nonfriend-stranger", "Stranger")

    auth_as(sender)
    response = api_client.post(
        f"/social/friends/{stranger.id}/messages",
        json={"text": "should not persist"},
    )

    assert response.status_code == 403
    assert db_session.query(DirectMessage).count() == 0
