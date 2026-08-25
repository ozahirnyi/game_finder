"""Persistent business-E2E fixture lifecycle.

This module is intentionally operational-only.  Fixture classification never
appears in public Pydantic schemas or API request handling.
"""

from __future__ import annotations

import os
import re
import uuid
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.auth import hash_password
from app.database import (
    Conversation, DirectMessage, E2EFixtureAudit, E2EFixtureMember, E2EFixtureRun, Favorite,
    FriendRequest, Friendship, Game, GameInvite, Message, Notification,
    OAuthIdentity, PriceAlert, User, WishlistItem,
)

FIXTURE_KEY_RE = re.compile(r"^[a-z][a-z0-9-]{2,95}$")
FORBIDDEN_MARKER_RE = re.compile(r"(?:test|qa|e2e|fixture|run[-_ ]?id)", re.IGNORECASE)

MANIFEST = (
    {"role": "mara", "name": "Mara Ellison", "nickname": "MaraEllison", "password_env": "E2E_FIXTURE_MARA_PASSWORD"},
    {"role": "jonas", "name": "Jonas Reed", "nickname": "JonasReed", "password_env": "E2E_FIXTURE_JONAS_PASSWORD"},
)

ENTITY_MODELS = OrderedDict([
    ("users", User), ("games", Game), ("friend_requests", FriendRequest),
    ("friendships", Friendship), ("conversations", Conversation), ("messages", Message),
    ("direct_messages", DirectMessage), ("game_invites", GameInvite),
    ("notifications", Notification), ("favorites", Favorite),
    ("wishlist_items", WishlistItem), ("price_alerts", PriceAlert),
    ("oauth_identities", OAuthIdentity),
])


def validate_fixture_key(fixture_key: str) -> str:
    key = fixture_key.strip().lower()
    if not FIXTURE_KEY_RE.fullmatch(key):
        raise ValueError("fixture key must be 3-96 lowercase letters, digits, or hyphens")
    return key


def validate_user_facing_fields(values: dict[str, Any]) -> None:
    user_facing_fields = {"name", "nickname", "display_name", "public_nickname", "bio", "message", "body", "title", "game_name"}
    for field, value in values.items():
        if field in user_facing_fields and value and FORBIDDEN_MARKER_RE.search(str(value)):
            raise ValueError(f"fixture marker is forbidden in user-facing field: {field}")


def _run(db: Session, fixture_key: str, environment: str | None = None) -> E2EFixtureRun:
    run = db.query(E2EFixtureRun).filter(E2EFixtureRun.fixture_key == fixture_key).one_or_none()
    if run is None:
        run = E2EFixtureRun(
            fixture_key=fixture_key,
            environment=environment or os.getenv("E2E_ENVIRONMENT", "local"),
            actor=os.getenv("USER") or os.getenv("USERNAME"),
        )
        db.add(run)
        db.flush()
    return run


def _record_members(db: Session, run: E2EFixtureRun, inventory: dict[str, list[str]]) -> None:
    existing = {(item.entity_type, item.entity_id) for item in db.query(E2EFixtureMember).filter(E2EFixtureMember.run_id == run.id)}
    for entity_type, ids in inventory.items():
        for entity_id in ids:
            if (entity_type, entity_id) not in existing:
                db.add(E2EFixtureMember(run_id=run.id, entity_type=entity_type, entity_id=entity_id))


def _audit(db: Session, fixture_key: str, action: str, dry_run: bool = False) -> None:
    db.add(E2EFixtureAudit(fixture_key=fixture_key, action=action, actor=os.getenv("USER") or os.getenv("USERNAME"), dry_run=dry_run))


def inventory_fixture(db: Session, fixture_key: str) -> dict[str, Any]:
    key = validate_fixture_key(fixture_key)
    users = db.query(User).filter(User.e2e_fixture_key == key).all()
    user_ids = {user.id for user in users}
    games = db.query(Game).filter((Game.e2e_fixture_key == key) | Game.owner_id.in_(user_ids or [uuid.UUID(int=0)])).all()
    game_ids = {game.id for game in games}
    pairs = lambda model, *columns: db.query(model).filter(or_(*[column.in_(user_ids) for column in columns])).all() if user_ids else []
    entities: dict[str, list[str]] = {
        "users": [str(item.id) for item in users], "games": [str(item.id) for item in games],
        "friend_requests": [str(item.id) for item in pairs(FriendRequest, FriendRequest.sender_id, FriendRequest.recipient_id)],
        "friendships": [str(item.id) for item in pairs(Friendship, Friendship.user_low_id, Friendship.user_high_id)],
        "conversations": [str(item.id) for item in pairs(Conversation, Conversation.user_low_id, Conversation.user_high_id)],
        "game_invites": [str(item.id) for item in pairs(GameInvite, GameInvite.sender_id, GameInvite.recipient_id)],
        "notifications": [str(item.id) for item in db.query(Notification).filter(Notification.user_id.in_(user_ids or [uuid.UUID(int=0)])).all()],
        "favorites": [str(item.id) for item in db.query(Favorite).filter(Favorite.user_id.in_(user_ids or [uuid.UUID(int=0)])).all()],
        "wishlist_items": [str(item.id) for item in db.query(WishlistItem).filter(WishlistItem.user_id.in_(user_ids or [uuid.UUID(int=0)])).all()],
        "oauth_identities": [str(item.id) for item in db.query(OAuthIdentity).filter(OAuthIdentity.user_id.in_(user_ids or [uuid.UUID(int=0)])).all()],
    }
    conversation_ids = {uuid.UUID(item) for item in entities["conversations"]}
    friendship_ids = {uuid.UUID(item) for item in entities["friendships"]}
    wishlist_ids = {uuid.UUID(item) for item in entities["wishlist_items"]}
    entities["messages"] = [str(item.id) for item in db.query(Message).filter(Message.conversation_id.in_(conversation_ids or [uuid.UUID(int=0)])).all()]
    entities["direct_messages"] = [str(item.id) for item in db.query(DirectMessage).filter(DirectMessage.friendship_id.in_(friendship_ids or [uuid.UUID(int=0)])).all()]
    entities["price_alerts"] = [str(item.id) for item in db.query(PriceAlert).filter(PriceAlert.wishlist_item_id.in_(wishlist_ids or [uuid.UUID(int=0)])).all()]
    return {"fixture_key": key, "counts": {name: len(ids) for name, ids in entities.items()}, "ids": entities}


def seed_fixture(db: Session, fixture_key: str, *, environment: str | None = None) -> dict[str, Any]:
    key = validate_fixture_key(fixture_key)
    domain = os.getenv("E2E_FIXTURE_EMAIL_DOMAIN", "").strip().lower()
    if not domain or "." not in domain:
        raise RuntimeError("E2E_FIXTURE_EMAIL_DOMAIN must be configured for seeding")
    run = _run(db, key, environment)
    users: list[User] = []
    for spec in MANIFEST:
        validate_user_facing_fields(spec)
        # The stable role alias is intentionally independent of the operational
        # key; keys belong in inventory metadata, never in user-facing fields.
        email = os.getenv(f"E2E_FIXTURE_{spec['role'].upper()}_EMAIL", f"{spec['role']}@{domain}").strip().lower()
        user = db.query(User).filter(User.e2e_fixture_key == key, User.display_name == spec["name"]).one_or_none()
        if user is None:
            user = User(email=email, display_name=spec["name"], public_nickname=spec["nickname"], e2e_fixture_key=key, e2e_fixture_hidden=True, password_hash=hash_password(os.environ[spec["password_env"]]))
            db.add(user)
        else:
            user.email = email
            user.password_hash = hash_password(os.environ[spec["password_env"]])
            user.display_name, user.public_nickname, user.e2e_fixture_hidden = spec["name"], spec["nickname"], True
        users.append(user)
        db.flush()
    db.commit()
    result = inventory_fixture(db, key)
    _record_members(db, run, result["ids"])
    _audit(db, key, "seed")
    db.commit()
    return result


def set_fixture_hidden(db: Session, fixture_key: str, hidden: bool, *, dry_run: bool = False) -> dict[str, Any]:
    result = inventory_fixture(db, fixture_key)
    if not dry_run:
        db.query(User).filter(User.e2e_fixture_key == result["fixture_key"]).update({User.e2e_fixture_hidden: hidden}, synchronize_session=False)
    _audit(db, result["fixture_key"], "hide" if hidden else "unhide", dry_run)
    if not dry_run:
        db.commit()
    return {**result, "action": "hide" if hidden else "unhide", "dry_run": dry_run}


def delete_fixture(db: Session, fixture_key: str, *, confirm: str | None = None, dry_run: bool = False) -> dict[str, Any]:
    result = inventory_fixture(db, fixture_key)
    key = result["fixture_key"]
    if not dry_run and confirm != key:
        raise ValueError("delete requires --confirm with the exact fixture key")
    if not dry_run:
        users = db.query(User).filter(User.e2e_fixture_key == key).all()
        _audit(db, key, "delete", dry_run)
        user_ids = {user.id for user in users}
        fixture_conversations = [item.id for item in db.query(Conversation).filter(Conversation.user_low_id.in_(user_ids), Conversation.user_high_id.in_(user_ids)).all()]
        fixture_friendships = [item.id for item in db.query(Friendship).filter(Friendship.user_low_id.in_(user_ids), Friendship.user_high_id.in_(user_ids)).all()]
        fixture_requests = [item.id for item in db.query(FriendRequest).filter(FriendRequest.sender_id.in_(user_ids), FriendRequest.recipient_id.in_(user_ids)).all()]
        fixture_invites = [item.id for item in db.query(GameInvite).filter(GameInvite.sender_id.in_(user_ids), GameInvite.recipient_id.in_(user_ids)).all()]
        fixture_messages = [item.id for item in db.query(Message).filter(Message.conversation_id.in_(fixture_conversations or [uuid.UUID(int=0)])).all()]
        fixture_direct_messages = [item.id for item in db.query(DirectMessage).filter(DirectMessage.friendship_id.in_(fixture_friendships or [uuid.UUID(int=0)])).all()]
        fixture_wishlist = [item.id for item in db.query(WishlistItem).filter(WishlistItem.user_id.in_(user_ids)).all()]
        delete_groups = (
            (PriceAlert, [item.id for item in db.query(PriceAlert).filter(PriceAlert.wishlist_item_id.in_(fixture_wishlist or [uuid.UUID(int=0)])).all()]),
            (Message, fixture_messages), (DirectMessage, fixture_direct_messages), (GameInvite, fixture_invites),
            (Notification, [item.id for item in db.query(Notification).filter(Notification.user_id.in_(user_ids)).all()]),
            (Favorite, [item.id for item in db.query(Favorite).filter(Favorite.user_id.in_(user_ids)).all()]),
            (WishlistItem, fixture_wishlist), (FriendRequest, fixture_requests), (Friendship, fixture_friendships),
            (Conversation, fixture_conversations), (OAuthIdentity, [item.id for item in db.query(OAuthIdentity).filter(OAuthIdentity.user_id.in_(user_ids)).all()]),
            (Game, [item.id for item in db.query(Game).filter(or_(Game.e2e_fixture_key == key, Game.owner_id.in_(user_ids))).all()]), (User, [item.id for item in users]),
        )
        for model, ids in delete_groups:
            if ids:
                db.query(model).filter(model.id.in_(ids)).delete(synchronize_session=False)
        run = db.query(E2EFixtureRun).filter(E2EFixtureRun.fixture_key == key).one_or_none()
        if run:
            db.delete(run)
        db.commit()
    return {**result, "action": "delete", "dry_run": dry_run}
