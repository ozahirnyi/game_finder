import os
from typing import Any

import httpx
from fastapi import HTTPException


ITAD_BASE_URL = "https://api.isthereanydeal.com"


def get_itad_api_key() -> str:
    return os.getenv("ITAD_API_KEY") or os.getenv("ISTHEREANYDEAL_API_KEY") or ""


def _money(value: dict[str, Any] | None) -> dict[str, Any] | None:
    if not value:
        return None
    amount = value.get("amount")
    currency = value.get("currency")
    if amount is None or not currency:
        return None
    return {"amount": amount, "currency": currency}


def _deal(value: dict[str, Any] | None) -> dict[str, Any] | None:
    if not value:
        return None
    return {
        "shop": (value.get("shop") or {}).get("name"),
        "price": _money(value.get("price")),
        "regular": _money(value.get("regular")),
        "cut": value.get("cut"),
        "url": value.get("url"),
        "timestamp": value.get("timestamp"),
    }


def _itad_error_message(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        data = {}

    reason = data.get("reason_phrase") or data.get("detail") or data.get("message")
    if isinstance(reason, str) and reason.strip():
        return reason.strip()
    return "request failed"


async def fetch_game_price_history(title: str, country: str = "US") -> dict[str, Any]:
    api_key = get_itad_api_key()
    if not api_key:
        raise HTTPException(status_code=503, detail="ITAD_API_KEY is not configured")

    headers = {"ITAD-API-Key": api_key}
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
            lookup = await client.get(
                f"{ITAD_BASE_URL}/games/lookup/v1",
                params={"title": title},
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
    if not price_items:
        raise HTTPException(status_code=404, detail="Price data not found for this game")

    item = price_items[0]
    history_low = item.get("historyLow") or {}
    deals = [_deal(deal) for deal in item.get("deals") or []]

    return {
        "itad_id": game_id,
        "title": game.get("title") or title,
        "url": (game.get("urls") or {}).get("game") or f"https://isthereanydeal.com/game/id:{game_id}/",
        "current": _deal((item.get("deals") or [None])[0]) if item.get("deals") else None,
        "history_low_all": _money(history_low.get("all")),
        "history_low_1y": _money(history_low.get("y1")),
        "history_low_3m": _money(history_low.get("m3")),
        "deals": [deal for deal in deals if deal is not None],
    }
