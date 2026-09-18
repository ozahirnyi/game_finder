import asyncio
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import Game, PriceAlert, SessionLocal, User, WishlistItem
from app.notifications import create_notification, price_alert_payload
from app.price_region import normalize_price_country
from app.steam_store import fetch_steam_store_game_detail, fetch_steam_store_game_price
from app.telegram import send_telegram_message


@dataclass
class PriceAlertRunResult:
    users_checked: int = 0
    games_checked: int = 0
    alerts_sent: int = 0
    in_app_notifications_created: int = 0
    errors: int = 0


def price_alerts_enabled() -> bool:
    return os.getenv("PRICE_ALERT_WATCHER_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


def price_alert_interval_seconds() -> int:
    return max(300, int(os.getenv("PRICE_ALERT_INTERVAL_SECONDS", "86400") or "86400"))


def price_alert_initial_delay_seconds() -> int:
    return max(0, int(os.getenv("PRICE_ALERT_INITIAL_DELAY_SECONDS", "60") or "60"))


def price_alert_min_cut() -> int:
    return max(1, int(os.getenv("PRICE_ALERT_MIN_CUT", "1") or "1"))


def build_price_alert_key(deal: dict[str, Any]) -> str | None:
    price = deal.get("price") or {}
    amount = price.get("amount")
    currency = price.get("currency")
    cut = deal.get("cut")
    shop = deal.get("shop") or ""
    url = deal.get("url") or ""
    if amount is None or not currency or cut is None:
        return None
    return f"{shop}|{amount}|{currency}|{cut}|{url}"


def price_alert_country(user: User) -> str:
    return normalize_price_country(getattr(user, "price_country_code", None))


def wishlist_steam_appid(item: WishlistItem) -> int | None:
    if getattr(item, "source", None) != "steam":
        return None
    try:
        appid = int(getattr(item, "external_id", ""))
    except (TypeError, ValueError):
        return None
    return appid if appid > 0 else None


async def fetch_steam_alert_price(
    title: str, country: str, steam_appid: int | None = None
) -> dict[str, Any]:
    if steam_appid is not None:
        return await fetch_steam_store_game_detail(steam_appid, country=country)
    return await fetch_steam_store_game_price(title, country=country, exact_title_only=True)


def format_price_alert_message(game_title: str, price_data: dict[str, Any]) -> str | None:
    deal = price_data.get("current")
    if not deal:
        return None

    price = deal.get("price") or {}
    regular = deal.get("regular") or {}
    amount = price.get("amount")
    currency = price.get("currency")
    cut = deal.get("cut") or 0
    if amount is None or not currency or cut < price_alert_min_cut():
        return None

    regular_amount = regular.get("amount")
    shop = deal.get("shop") or "a store"
    deal_url = deal.get("url") or price_data.get("url")
    lines = [
        f"{game_title} is on sale.",
        f"Now: {amount} {currency} at {shop} ({cut}% off).",
    ]
    if regular_amount is not None:
        lines.append(f"Regular: {regular_amount} {currency}.")
    if deal_url:
        lines.append(deal_url)
    return "\n".join(lines)


def alert_matches(alert: PriceAlert, deal: dict[str, Any]) -> bool:
    amount = (deal.get("price") or {}).get("amount")
    cut = deal.get("cut")
    return (
        amount is not None
        and cut is not None
        and (alert.target_price is None or amount <= alert.target_price)
        and (alert.target_discount is None or cut >= alert.target_discount)
    )


async def check_persisted_price_alerts(db: Session, result: PriceAlertRunResult) -> None:
    alerts = db.query(PriceAlert).all()
    for alert in alerts:
        if "in_app" not in (alert.delivery_channels or []):
            continue
        item = db.query(WishlistItem).filter(
            WishlistItem.id == alert.wishlist_item_id,
            WishlistItem.user_id == alert.user_id,
        ).first()
        user = db.query(User).filter(User.id == alert.user_id).first()
        if not item or not user:
            continue
        country = price_alert_country(user)
        try:
            price_data = await fetch_steam_alert_price(
                item.title, country=country, steam_appid=wishlist_steam_appid(item)
            )
            deal = price_data.get("current")
            alert_key = build_price_alert_key(deal) if deal else None
            if not deal or not alert_key or not alert_matches(alert, deal) or alert.last_notification_key == alert_key:
                continue
            create_notification(
                db,
                alert.user_id,
                "price_alert",
                price_alert_payload(catalog_game_id=item.catalog_game_id),
            )
            alert.last_notification_key = alert_key
            alert.last_delivered_at = datetime.now(timezone.utc)
            result.in_app_notifications_created += 1
            db.commit()
        except HTTPException:
            result.errors += 1
            db.rollback()
        except Exception:
            result.errors += 1
            db.rollback()


async def check_price_alerts(db: Session) -> PriceAlertRunResult:
    result = PriceAlertRunResult()
    users = db.query(User).filter(User.telegram_chat_id.isnot(None)).all()
    result.users_checked = len(users)

    for user in users:
        country = price_alert_country(user)

        games = db.query(Game).filter(Game.owner_id == user.id, Game.source == "manual").all()
        for game in games:
            result.games_checked += 1
            game.price_alert_checked_at = datetime.now(timezone.utc)
            try:
                price_data = await fetch_steam_alert_price(game.title, country=country)
                deal = price_data.get("current")
                message = format_price_alert_message(game.title, price_data)
                alert_key = build_price_alert_key(deal) if deal else None

                if message and alert_key and alert_key != game.price_alert_last_key:
                    sent = send_telegram_message(user.telegram_chat_id, message)
                    if sent:
                        game.price_alert_last_key = alert_key
                        game.price_alert_last_at = datetime.now(timezone.utc)
                        game.price_alert_last_cut = deal.get("cut")
                        price = deal.get("price") or {}
                        game.price_alert_last_amount = price.get("amount")
                        game.price_alert_last_currency = price.get("currency")
                        result.alerts_sent += 1
                db.commit()
            except HTTPException:
                result.errors += 1
                db.rollback()
            except Exception:
                result.errors += 1
                db.rollback()

    await check_persisted_price_alerts(db, result)

    return result


async def run_price_alerts_once() -> PriceAlertRunResult:
    db = SessionLocal()
    try:
        return await check_price_alerts(db)
    finally:
        db.close()


async def price_alert_watcher_loop() -> None:
    await asyncio.sleep(price_alert_initial_delay_seconds())
    while True:
        await run_price_alerts_once()
        await asyncio.sleep(price_alert_interval_seconds())
