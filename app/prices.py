import os
from calendar import monthrange
from datetime import datetime, timezone
from math import isfinite
from typing import Any

import httpx
from fastapi import HTTPException


ITAD_BASE_URL = "https://api.isthereanydeal.com"


def get_itad_api_key() -> str:
    return os.getenv("ITAD_API_KEY") or os.getenv("ISTHEREANYDEAL_API_KEY") or ""


def _money(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    amount = value.get("amount")
    currency = value.get("currency")
    if isinstance(amount, bool) or not isinstance(amount, (int, float)) or not isfinite(amount) or amount < 0 or not isinstance(currency, str) or not currency.strip():
        return None
    return {"amount": amount, "currency": currency}


def _deal(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    timestamp = value.get("timestamp")
    shop = value.get("shop") if isinstance(value.get("shop"), dict) else {}
    return {
        "shop": shop.get("name"),
        "price": _money(value.get("price")),
        "regular": _money(value.get("regular")),
        "cut": value.get("cut"),
        "url": value.get("url"),
        "timestamp": timestamp if timestamp is None or _timestamp(timestamp) is not None else None,
    }


def _history_point(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {"timestamp": None, "shop": None, "price": None, "regular": None}
    deal = value.get("deal") if isinstance(value.get("deal"), dict) else {}
    shop = value.get("shop") if isinstance(value.get("shop"), dict) else {}
    return {"timestamp": value.get("timestamp"), "shop": shop.get("name"), "price": _money(deal.get("price")), "regular": _money(deal.get("regular"))}


def _timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


def price_history_since(now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    current = current.astimezone(timezone.utc)
    month = current.month - 6
    year = current.year
    if month < 1:
        month += 12
        year -= 1
    return current.replace(
        year=year,
        month=month,
        day=min(current.day, monthrange(year, month)[1]),
    ).isoformat()


def normalize_price_history(deals: list[dict[str, Any]], history_points: list[dict[str, Any]], *, now: datetime | None = None) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    """Keep valid provider data compact, chronological, and safe for charting."""
    valid_deals = [deal for deal in (_deal(value) for value in deals) if deal and deal.get("price")]
    current = min(
        valid_deals,
        key=lambda deal: (float(deal["price"]["amount"]), str(deal["price"]["currency"]), str(deal.get("shop") or ""), str(deal.get("url") or "")),
        default=None,
    )
    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)
    current_time = current_time.astimezone(timezone.utc)
    cutoff_month = current_time.month - 6
    cutoff_year = current_time.year
    if cutoff_month < 1:
        cutoff_month += 12
        cutoff_year -= 1
    cutoff = current_time.replace(
        year=cutoff_year,
        month=cutoff_month,
        day=min(current_time.day, monthrange(cutoff_year, cutoff_month)[1]),
    )
    weekly: dict[tuple[int, int], tuple[datetime, dict[str, Any]]] = {}
    for raw_point in history_points:
        point = _history_point(raw_point)
        point_time = _timestamp(point.get("timestamp"))
        price = point.get("price")
        if point_time is None or point_time < cutoff or point_time > current_time or not price:
            continue
        week = point_time.isocalendar()
        key = (week.year, week.week)
        existing = weekly.get(key)
        if existing is None or (float(price["amount"]), str(price["currency"]), point_time) < (float(existing[1]["price"]["amount"]), str(existing[1]["price"]["currency"]), existing[0]):
            weekly[key] = (point_time, point)
    return current, [point for _time, point in sorted(weekly.values(), key=lambda item: item[0])]


def _itad_error_message(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        data = {}

    reason = data.get("reason_phrase") or data.get("detail") or data.get("message")
    if isinstance(reason, str) and reason.strip():
        return reason.strip()
    return "request failed"


async def fetch_game_price_history(title: str, country: str = "US", steam_appid: int | None = None) -> dict[str, Any]:
    api_key = get_itad_api_key()
    if not api_key:
        raise HTTPException(status_code=503, detail="ITAD_API_KEY is not configured")

    headers = {"ITAD-API-Key": api_key}
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
            lookup = await client.get(
                f"{ITAD_BASE_URL}/games/lookup/v1",
                params={"appid": steam_appid} if steam_appid else {"title": title},
            )
            lookup.raise_for_status()
            lookup_data = lookup.json()
            if not lookup_data.get("found") or not lookup_data.get("game"):
                raise HTTPException(status_code=404, detail="Price data not found for this game")

            game = lookup_data["game"]
            game_id = game["id"]
            prices = await client.post(
                f"{ITAD_BASE_URL}/games/prices/v3",
                params={"country": country, "capacity": 5, "vouchers": "true"},
                json=[game_id],
            )
            prices.raise_for_status()
            history = await client.get(
                f"{ITAD_BASE_URL}/games/history/v2",
                params={"id": game_id, "country": country, "since": price_history_since()},
            )
            history.raise_for_status()
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {401, 403}:
            reason = _itad_error_message(exc.response)
            raise HTTPException(status_code=502, detail=f"IsThereAnyDeal rejected the API key: {reason}")
        if exc.response.status_code == 429:
            raise HTTPException(status_code=429, detail="IsThereAnyDeal rate limit reached")
        reason = _itad_error_message(exc.response)
        raise HTTPException(status_code=502, detail=f"Price history request failed: {reason}")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Price history request failed")

    price_items = prices.json()
    if not isinstance(price_items, list) or not price_items or not isinstance(price_items[0], dict):
        raise HTTPException(status_code=404, detail="Price data not found for this game")

    item = price_items[0]
    history_low = item.get("historyLow") or {}
    history_data = history.json()
    history_points = history_data if isinstance(history_data, list) else history_data.get("history", [])
    history_points = history_points if isinstance(history_points, list) else []
    deal_values = item.get("deals") if isinstance(item.get("deals"), list) else []
    current, normalized_history = normalize_price_history(deal_values, history_points)
    deals = [deal for deal in (_deal(value) for value in deal_values) if deal and deal.get("price")]

    return {
        "itad_id": game_id,
        "title": game.get("title") or title,
        "url": (game.get("urls") or {}).get("game") or f"https://isthereanydeal.com/game/id:{game_id}/",
        "current": current,
        "history_low_all": _money(history_low.get("all")),
        "history_low_1y": _money(history_low.get("y1")),
        "history_low_3m": _money(history_low.get("m3")),
        "deals": [deal for deal in deals if deal is not None],
        "history": normalized_history,
    }
