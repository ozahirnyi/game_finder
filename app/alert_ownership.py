"""Pause price alerts for wishlist games now present in the owner's library."""

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.database import PriceAlert, WishlistItem
from app.game_identity import owned_library_games
from app.notifications import create_notification


def item_is_owned(db: Session, user_id: uuid.UUID, item: WishlistItem) -> bool:
    if item.source == "steam":
        try:
            appid = int(item.external_id)
        except (TypeError, ValueError):
            return False
        return bool(owned_library_games(db, user_id, steam_appid=appid))
    if item.source == "catalog":
        return bool(owned_library_games(db, user_id, catalog_game_id=item.catalog_game_id))
    return False


def pause_owned_alerts(
    db: Session, user_id: uuid.UUID, *, steam_owned_appids: set[int] | None = None
) -> int:
    alerts = db.query(PriceAlert).filter(
        PriceAlert.user_id == user_id, PriceAlert.paused_at.is_(None)
    ).all()
    paused = 0
    for alert in alerts:
        item = db.query(WishlistItem).filter(
            WishlistItem.id == alert.wishlist_item_id, WishlistItem.user_id == user_id
        ).first()
        live_steam_owned = (
            item is not None
            and item.source == "steam"
            and item.external_id is not None
            and item.external_id.isdigit()
            and int(item.external_id) in (steam_owned_appids or set())
        )
        if item is None or not (item_is_owned(db, user_id, item) or live_steam_owned):
            continue
        alert.paused_at = datetime.now(timezone.utc)
        alert.pause_reason = "owned"
        create_notification(db, user_id, "price_alert_paused", {
            "wishlist_item_id": str(item.id),
            "source": item.source,
            "external_id": item.external_id,
            "title": item.title,
        })
        paused += 1
    return paused
