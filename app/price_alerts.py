import asyncio
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import Notification, PriceAlert, SessionLocal, User
from app.prices import fetch_game_price_history
from app.telegram import send_telegram_message


@dataclass
class PriceAlertRunResult:
    users_checked: int = 0
    games_checked: int = 0
    alerts_sent: int = 0
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


def alert_matches_deal(alert, deal: dict[str, Any]) -> bool:
    price = (deal.get("price") or {}).get("amount")
    cut = deal.get("cut") or 0
    if price is None:
        return False
    if alert.mode == "any_discount":
        return cut > 0
    if alert.mode == "target_price":
        return price <= alert.threshold
    return cut >= alert.threshold


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
    history_low = price_data.get("history_low_all") or {}
    history_amount = history_low.get("amount")
    history_currency = history_low.get("currency")

    lines = [
        f"{game_title} is on sale.",
        f"Now: {amount} {currency} at {shop} ({cut}% off).",
    ]
    if regular_amount is not None:
        lines.append(f"Regular: {regular_amount} {currency}.")
    if history_amount is not None and history_currency:
        lines.append(f"Historical low: {history_amount} {history_currency}.")
    if deal_url:
        lines.append(deal_url)
    return "\n".join(lines)


async def check_price_alerts(db: Session) -> PriceAlertRunResult:
    result = PriceAlertRunResult()
    alerts = db.query(PriceAlert).all()
    result.users_checked = len({alert.user_id for alert in alerts})

    for alert in alerts:
        user = db.get(User, alert.user_id)
        if user is None:
            continue
        country = (user.steam_country_code or "US").strip().upper()
        if len(country) != 2:
            country = "US"
        result.games_checked += 1
        try:
            price_data = await fetch_game_price_history(alert.title, country=country)
            deal = price_data.get("current")
            alert_key = build_price_alert_key(deal) if deal else None
            if not deal or not alert_key or alert_key == alert.last_deal_key or not alert_matches_deal(alert, deal):
                continue

            delivered = False
            if alert.in_app:
                db.add(Notification(
                    user_id=user.id,
                    event_type="price_alert",
                    target_kind="catalog_game" if alert.identity_kind == "rawg" else "offer",
                    game_id=alert.identity_value if alert.identity_kind == "rawg" else None,
                    price_alert_id=alert.id,
                    offer_url=deal.get("url") or price_data.get("url"),
                ))
                delivered = True
            if alert.telegram and user.telegram_chat_id:
                message = format_price_alert_message(alert.title, price_data)
                if message and send_telegram_message(user.telegram_chat_id, message):
                    delivered = True
            if delivered:
                alert.last_deal_key = alert_key
                result.alerts_sent += 1
            db.commit()
        except HTTPException:
            result.errors += 1
            db.rollback()
        except Exception:
            result.errors += 1
            db.rollback()

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
