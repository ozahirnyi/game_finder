import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import DirectMessage, FriendRequest, Friendship, GameInvite, Notification, User


def canonical_pair(first: uuid.UUID, second: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    return tuple(sorted((first, second), key=str))


def require_friendship(db: Session, user_id: uuid.UUID, friend_id: uuid.UUID) -> Friendship:
    low, high = canonical_pair(user_id, friend_id)
    friendship = db.query(Friendship).filter_by(user_low_id=low, user_high_id=high).first()
    if friendship is None:
        raise HTTPException(status_code=403, detail="Only confirmed friends can use this feature")
    return friendship


def relationship_for(db: Session, viewer_id: uuid.UUID, profile_id: uuid.UUID) -> str:
    if viewer_id == profile_id:
        return "self"
    low, high = canonical_pair(viewer_id, profile_id)
    if db.query(Friendship).filter_by(user_low_id=low, user_high_id=high).first():
        return "friends"
    request = db.query(FriendRequest).filter(
        FriendRequest.status == "pending",
        ((FriendRequest.sender_id == viewer_id) & (FriendRequest.recipient_id == profile_id))
        | ((FriendRequest.sender_id == profile_id) & (FriendRequest.recipient_id == viewer_id)),
    ).first()
    if request is None:
        return "none"
    return "outgoing" if request.sender_id == viewer_id else "incoming"


def search_profiles(db: Session, viewer_id: uuid.UUID, query: str) -> list[User]:
    query = query.strip()
    if len(query) < 2:
        return []
    return db.query(User).filter(User.display_name.ilike(f"{query}%")).order_by(User.display_name, User.profile_id).limit(20).all()


def create_friend_request(db: Session, sender: User, *, profile_id: str | None, friend_code: str | None) -> FriendRequest:
    if bool(profile_id) == bool(friend_code):
        raise HTTPException(status_code=422, detail="Provide exactly one friend code or profile id")
    recipient = db.query(User).filter(User.profile_id == profile_id).first() if profile_id else db.query(User).filter(User.friend_code == friend_code).first()
    if recipient is None:
        raise HTTPException(status_code=404, detail="User not found")
    if recipient.id == sender.id:
        raise HTTPException(status_code=409, detail="You cannot add yourself")
    try:
        require_friendship(db, sender.id, recipient.id)
    except HTTPException:
        pass
    else:
        raise HTTPException(status_code=409, detail="You are already friends")
    active = db.query(FriendRequest).filter(
        FriendRequest.status == "pending",
        ((FriendRequest.sender_id == sender.id) & (FriendRequest.recipient_id == recipient.id))
        | ((FriendRequest.sender_id == recipient.id) & (FriendRequest.recipient_id == sender.id)),
    ).first()
    if active:
        raise HTTPException(status_code=409, detail="A friend request is already pending")
    request = FriendRequest(sender_id=sender.id, recipient_id=recipient.id)
    db.add(request)
    db.flush()
    db.add(Notification(user_id=recipient.id, event_type="friend_request", target_kind="friend_request", friend_request_id=request.id))
    db.commit()
    db.refresh(request)
    return request


def transition_friend_request(db: Session, actor_id: uuid.UUID, request_id: uuid.UUID, action: str) -> FriendRequest:
    request = db.query(FriendRequest).filter(FriendRequest.id == request_id).first()
    if request is None or actor_id not in (request.sender_id, request.recipient_id):
        raise HTTPException(status_code=404, detail="Friend request not found")
    allowed = {"accept", "reject"} if actor_id == request.recipient_id else {"cancel"}
    if action not in allowed:
        raise HTTPException(status_code=403, detail="You cannot perform this action")
    target = {"accept": "accepted", "reject": "rejected", "cancel": "cancelled"}[action]
    if request.status != "pending":
        if request.status == target:
            return request
        raise HTTPException(status_code=409, detail="Friend request is no longer pending")
    request.status = target
    if target == "accepted":
        low, high = canonical_pair(request.sender_id, request.recipient_id)
        if not db.query(Friendship).filter_by(user_low_id=low, user_high_id=high).first():
            db.add(Friendship(user_low_id=low, user_high_id=high))
    db.commit()
    db.refresh(request)
    return request


def list_notifications(db: Session, user_id: uuid.UUID) -> list[Notification]:
    return db.query(Notification).filter(Notification.user_id == user_id).order_by(Notification.created_at.desc()).all()


def profile_payload(db: Session, viewer_id: uuid.UUID, user: User) -> dict[str, str]:
    return {"profile_id": user.profile_id, "display_name": user.display_name, "relationship": relationship_for(db, viewer_id, user.id)}


def social_me(db: Session, user: User) -> dict:
    friends = []
    for friendship in db.query(Friendship).filter((Friendship.user_low_id == user.id) | (Friendship.user_high_id == user.id)).all():
        friend_id = friendship.user_high_id if friendship.user_low_id == user.id else friendship.user_low_id
        friend = db.query(User).filter(User.id == friend_id).first()
        if friend:
            friends.append(profile_payload(db, user.id, friend))
    requests = db.query(FriendRequest).filter(
        ((FriendRequest.sender_id == user.id) | (FriendRequest.recipient_id == user.id)), FriendRequest.status == "pending"
    ).all()
    return {
        "profile_id": user.profile_id,
        "display_name": user.display_name,
        "friend_code": user.friend_code,
        "friends": friends,
        "incoming": [{"id": str(item.id), **profile_payload(db, user.id, db.query(User).filter(User.id == item.sender_id).one())} for item in requests if item.recipient_id == user.id],
        "outgoing": [{"id": str(item.id), **profile_payload(db, user.id, db.query(User).filter(User.id == item.recipient_id).one())} for item in requests if item.sender_id == user.id],
    }


def send_message(db: Session, author_id: uuid.UUID, friend_id: uuid.UUID, text: str) -> DirectMessage:
    text = text.strip()
    if not text or len(text) > 2000:
        raise HTTPException(status_code=422, detail="Message must contain 1 to 2000 characters")
    friendship = require_friendship(db, author_id, friend_id)
    message = DirectMessage(friendship_id=friendship.id, author_id=author_id, text=text)
    db.add(message); db.flush()
    db.add(Notification(user_id=friend_id, event_type="message", target_kind="message", friendship_id=friendship.id, direct_message_id=message.id))
    db.commit(); db.refresh(message)
    return message


def list_messages(db: Session, user_id: uuid.UUID, friend_id: uuid.UUID) -> list[DirectMessage]:
    friendship = require_friendship(db, user_id, friend_id)
    return db.query(DirectMessage).filter(DirectMessage.friendship_id == friendship.id).order_by(DirectMessage.created_at).limit(50).all()


def create_invite(db: Session, sender_id: uuid.UUID, recipient_id: uuid.UUID, game_id: str, game_title: str) -> GameInvite:
    friendship = require_friendship(db, sender_id, recipient_id)
    if not game_id or not game_title.strip():
        raise HTTPException(status_code=422, detail="A game is required")
    existing = db.query(GameInvite).filter_by(friendship_id=friendship.id, sender_id=sender_id, recipient_id=recipient_id, game_id=str(game_id), status="pending").first()
    if existing:
        raise HTTPException(status_code=409, detail="A game invite is already pending")
    invite = GameInvite(friendship_id=friendship.id, sender_id=sender_id, recipient_id=recipient_id, game_id=str(game_id), game_title=game_title.strip())
    db.add(invite); db.flush()
    db.add(Notification(user_id=recipient_id, event_type="game_invite", target_kind="game_invite", friendship_id=friendship.id, game_invite_id=invite.id))
    db.commit(); db.refresh(invite)
    return invite


def transition_invite(db: Session, actor_id: uuid.UUID, invite_id: uuid.UUID, action: str) -> GameInvite:
    invite = db.query(GameInvite).filter(GameInvite.id == invite_id).first()
    if invite is None or actor_id not in (invite.sender_id, invite.recipient_id):
        raise HTTPException(status_code=404, detail="Game invite not found")
    allowed = {"accept", "decline"} if actor_id == invite.recipient_id else {"cancel"}
    if action not in allowed:
        raise HTTPException(status_code=403, detail="You cannot perform this action")
    target = {"accept": "accepted", "decline": "declined", "cancel": "cancelled"}[action]
    if invite.status != "pending":
        if invite.status == target: return invite
        raise HTTPException(status_code=409, detail="Game invite is no longer pending")
    invite.status = target
    if action in {"accept", "decline"}:
        db.add(Notification(user_id=invite.sender_id, event_type="game_invite_response", target_kind="game_invite", friendship_id=invite.friendship_id, game_invite_id=invite.id))
    db.commit(); db.refresh(invite)
    return invite
