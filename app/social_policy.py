"""Shared contact policy. Pair mutations serialize on both users in UUID order."""
from datetime import datetime, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError

from app.database import User, Friendship, SocialBlock, SteamFriendSuppression, FriendRequest, GameInvite, Conversation, Notification, DirectMessage, Message


def pair(first, second):
    return tuple(sorted((first, second), key=str))


def lock_pair(db, first, second):
    return db.query(User).filter(User.id.in_(pair(first, second))).order_by(User.id).with_for_update().all()


def blocked(db, first, second):
    if first == second:
        return False
    return db.query(SocialBlock).filter(or_(
        and_(SocialBlock.blocker_id == first, SocialBlock.blocked_id == second),
        and_(SocialBlock.blocker_id == second, SocialBlock.blocked_id == first),
    )).first() is not None


def visible_user_filter(viewer_id):
    return ~User.id.in_(
        select(SocialBlock.blocked_id).where(SocialBlock.blocker_id == viewer_id).union(
            select(SocialBlock.blocker_id).where(SocialBlock.blocked_id == viewer_id)
        )
    )


def insert_once(db, model, **values):
    """Unique constraints arbitrate simultaneous first writes, preserving outer work."""
    existing = db.query(model).filter_by(**values).first()
    if existing:
        return existing, False
    try:
        with db.begin_nested():
            row = model(**values)
            db.add(row)
            db.flush()
        return row, True
    except IntegrityError:
        existing = db.query(model).filter_by(**values).first()
        if existing is None:
            raise
        return existing, False


def suppress_import(db, first, second):
    low, high = pair(first, second)
    insert_once(db, SteamFriendSuppression, user_low_id=low, user_high_id=high)


def remove_friendship(db, first, second):
    low, high = pair(first, second)
    suppress_import(db, first, second)
    friendship = db.query(Friendship).filter_by(user_low_id=low, user_high_id=high).first()
    if friendship:
        history = db.query(DirectMessage).filter_by(friendship_id=friendship.id).all()
        if history:
            conversation, _ = insert_once(db, Conversation, user_low_id=low, user_high_id=high)
            for item in history:
                if db.get(Message, item.id) is None:
                    db.add(Message(id=item.id, conversation_id=conversation.id, sender_id=item.author_id,
                                   body=item.text, created_at=item.created_at))
            db.flush()
    db.query(Friendship).filter_by(user_low_id=low, user_high_id=high).delete(synchronize_session="fetch")


def close_contact(db, first, second):
    """Close pending contact and remove its notifications, including legacy payloads."""
    requests = db.query(FriendRequest).filter(or_(
        and_(FriendRequest.sender_id == first, FriendRequest.recipient_id == second),
        and_(FriendRequest.sender_id == second, FriendRequest.recipient_id == first),
    )).all()
    invites = db.query(GameInvite).filter(or_(
        and_(GameInvite.sender_id == first, GameInvite.recipient_id == second),
        and_(GameInvite.sender_id == second, GameInvite.recipient_id == first),
    )).all()
    low, high = pair(first, second)
    conversations = db.query(Conversation).filter_by(user_low_id=low, user_high_id=high).all()
    ids = {str(item.id) for item in [*requests, *invites, *conversations]}
    for item in requests:
        if item.status == "pending":
            item.status = "cancelled"
    for item in invites:
        if item.status == "pending":
            item.status = "cancelled"
            item.responded_at = datetime.now(timezone.utc)
    for item in db.query(Notification).filter(Notification.user_id.in_([first, second])).all():
        payload = item.payload or {}
        peer = second if item.user_id == first else first
        if any(str(payload.get(key)) in ids for key in ("request_id", "invite_id", "conversation_id")) or str(payload.get("friend_id")) == str(peer) or str(payload.get("actor_id")) == str(peer):
            db.delete(item)
