import importlib

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base
from app.database import User


def test_social_identity_allows_duplicate_display_names_and_generates_safe_ids():
    crud = importlib.import_module("app.crud")
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()

    first = crud.create_user(db, "first@example.test", "hash", "Alex")
    second = crud.create_user(db, "second@example.test", "hash", "Alex")

    assert first.display_name == second.display_name == "Alex"
    assert first.profile_id != second.profile_id
    assert first.friend_code != second.friend_code


def test_user_create_requires_a_display_name():
    schemas = importlib.import_module("app.schemas")

    with pytest.raises(Exception):
        schemas.UserCreate(email="a@example.test", password="password")


def test_nickname_search_returns_minimal_duplicate_matches():
    social = importlib.import_module("app.social")
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    viewer = User(email="viewer@example.test", display_name="Viewer")
    alex_one = User(email="alex-one@example.test", display_name="Alex")
    alex_two = User(email="alex-two@example.test", display_name="Alex")
    db.add_all([viewer, alex_one, alex_two])
    db.commit()

    result = social.search_profiles(db, viewer.id, "Al")

    assert {item.profile_id for item in result} == {alex_one.profile_id, alex_two.profile_id}
    assert all(item.display_name == "Alex" for item in result)


def test_request_accept_creates_canonical_friendship_and_notification():
    social = importlib.import_module("app.social")
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    sender = User(email="sender@example.test", display_name="Sender")
    recipient = User(email="recipient@example.test", display_name="Recipient")
    db.add_all([sender, recipient])
    db.commit()

    request = social.create_friend_request(db, sender, profile_id=recipient.profile_id, friend_code=None)
    result = social.transition_friend_request(db, recipient.id, request.id, "accept")

    assert result.status == "accepted"
    assert social.require_friendship(db, sender.id, recipient.id).id
    assert social.list_notifications(db, recipient.id)[0].event_type == "friend_request"


def test_friendship_lookup_rejects_a_user_with_only_an_unrelated_friendship():
    social = importlib.import_module("app.social")
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    alice = User(email="alice@example.test", display_name="Alice")
    bob = User(email="bob@example.test", display_name="Bob")
    carol = User(email="carol@example.test", display_name="Carol")
    db.add_all([alice, bob, carol])
    db.commit()
    request = social.create_friend_request(db, alice, profile_id=bob.profile_id, friend_code=None)
    social.transition_friend_request(db, bob.id, request.id, "accept")

    with pytest.raises(Exception, match="Only confirmed friends"):
        social.require_friendship(db, alice.id, carol.id)


def test_social_routes_hide_email_and_allow_request_by_profile_id():
    import app.main as main

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    sender = User(email="sender-route@example.test", display_name="Sender")
    recipient = User(email="recipient-route@example.test", display_name="Recipient")
    db.add_all([sender, recipient])
    db.commit()
    main.app.dependency_overrides[main.get_db] = lambda: db
    main.app.dependency_overrides[main.get_current_user] = lambda: sender
    client = TestClient(main.app)
    try:
        profile = client.get(f"/social/profiles/{recipient.profile_id}")
        request = client.post("/social/friend-requests", json={"profile_id": recipient.profile_id})
        assert profile.status_code == 200
        assert "email" not in profile.json()
        assert request.status_code == 201
    finally:
        main.app.dependency_overrides.clear()


def test_confirmed_friends_can_send_messages_and_invites():
    social = importlib.import_module("app.social")
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    sender = User(email="message-sender@example.test", display_name="Sender")
    recipient = User(email="message-recipient@example.test", display_name="Recipient")
    db.add_all([sender, recipient]); db.commit()
    request = social.create_friend_request(db, sender, profile_id=recipient.profile_id, friend_code=None)
    social.transition_friend_request(db, recipient.id, request.id, "accept")

    message = social.send_message(db, sender.id, recipient.id, "  Ready?  ")
    invite = social.create_invite(db, sender.id, recipient.id, "30", "Hades")
    social.transition_invite(db, recipient.id, invite.id, "accept")

    assert message.text == "Ready?"
    assert social.list_messages(db, recipient.id, sender.id)[0].id == message.id
    assert social.list_notifications(db, sender.id)[0].event_type == "game_invite_response"
