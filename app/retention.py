import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import Notification, PriceAlert, User, WishlistItem
from app.schemas import PriceAlertCreate, WishlistItemCreate


def list_wishlist_items(db: Session, user_id: uuid.UUID) -> list[WishlistItem]:
    return (
        db.query(WishlistItem)
        .filter(WishlistItem.user_id == user_id)
        .order_by(WishlistItem.created_at.desc())
        .all()
    )


def create_wishlist_item(
    db: Session, user: User, data: WishlistItemCreate
) -> WishlistItem:
    existing = (
        db.query(WishlistItem)
        .filter(
            WishlistItem.user_id == user.id,
            WishlistItem.identity_kind == data.identity_kind,
            WishlistItem.identity_value == data.identity_value,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This game is already in your wishlist.")

    item = WishlistItem(user_id=user.id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def delete_wishlist_item(db: Session, user_id: uuid.UUID, item_id: uuid.UUID) -> bool:
    item = (
        db.query(WishlistItem)
        .filter(WishlistItem.id == item_id, WishlistItem.user_id == user_id)
        .first()
    )
    if item is None:
        return False
    db.delete(item)
    db.commit()
    return True


def create_price_alert(
    db: Session, user: User, data: PriceAlertCreate, telegram
) -> PriceAlert:
    if data.telegram and not (telegram.configured and telegram.linked):
        raise HTTPException(
            status_code=409,
            detail="Connect Telegram in Profile before enabling Telegram alerts.",
        )

    query = db.query(PriceAlert).filter(
        PriceAlert.user_id == user.id,
        PriceAlert.identity_kind == data.identity_kind,
        PriceAlert.identity_value == data.identity_value,
        PriceAlert.mode == data.mode,
    )
    if data.threshold is None:
        query = query.filter(PriceAlert.threshold.is_(None))
    else:
        query = query.filter(PriceAlert.threshold == data.threshold)
    if query.first():
        raise HTTPException(status_code=409, detail="You already have this price alert.")

    alert = PriceAlert(user_id=user.id, **data.model_dump())
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def list_price_alerts(db: Session, user_id: uuid.UUID) -> list[PriceAlert]:
    return (
        db.query(PriceAlert)
        .filter(PriceAlert.user_id == user_id)
        .order_by(PriceAlert.created_at.desc())
        .all()
    )


def delete_price_alert(db: Session, user_id: uuid.UUID, alert_id: uuid.UUID) -> bool:
    alert = (
        db.query(PriceAlert)
        .filter(PriceAlert.id == alert_id, PriceAlert.user_id == user_id)
        .first()
    )
    if alert is None:
        return False
    db.delete(alert)
    db.commit()
    return True


def list_price_notifications(db: Session, user_id: uuid.UUID) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .all()
    )


def mark_price_notification_read(
    db: Session, user_id: uuid.UUID, notification_id: uuid.UUID
) -> Notification | None:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if notification is None:
        return None
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
    return notification
