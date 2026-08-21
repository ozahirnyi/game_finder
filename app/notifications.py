from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.database import Notification


def create_notification(
    db: Session, user_id: UUID, notification_type: str, payload: dict[str, Any]
) -> Notification:
    notification = Notification(user_id=user_id, type=notification_type, payload=payload)
    db.add(notification)
    return notification


def friend_request_payload(*, request_id: UUID, from_name: str) -> dict[str, str]:
    return {"request_id": str(request_id), "from": from_name}


def friend_request_accepted_payload(
    *, friend_id: UUID, public_id: str, by: str
) -> dict[str, str]:
    return {"friend_id": str(friend_id), "public_id": public_id, "by": by}


def message_payload(*, conversation_id: UUID, from_name: str, preview: str) -> dict[str, str]:
    return {"conversation_id": str(conversation_id), "from": from_name, "preview": preview}


def game_invite_payload(*, invite_id: UUID, from_name: str, game_name: str) -> dict[str, str]:
    return {"invite_id": str(invite_id), "from": from_name, "game_name": game_name}


def game_invite_response_payload(*, invite_id: UUID, by: str, status: str) -> dict[str, str]:
    return {"invite_id": str(invite_id), "by": by, "status": status}


def price_alert_payload(*, catalog_game_id: int, message: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"catalog_game_id": catalog_game_id}
    if message:
        payload["message"] = message
    return payload
