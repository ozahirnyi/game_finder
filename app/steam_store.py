from typing import Any

import httpx
from fastapi import HTTPException


STEAM_STORE_BASE_URL = "https://store.steampowered.com"


def _money_from_steam_cents(cents: int | None, currency: str | None) -> dict[str, Any] | None:
    if cents is None or not currency:
        return None
    return {"amount": round(cents / 100, 2), "currency": currency}


def _steam_deal(item: dict[str, Any]) -> dict[str, Any] | None:
    appid = item.get("id")
    name = (item.get("name") or "").strip()
    discount = int(item.get("discount_percent") or 0)
    if item.get("type") != 0 or not appid or not name or discount <= 0:
        return None

    currency = item.get("currency")
    current = {
        "shop": "Steam",
        "price": _money_from_steam_cents(item.get("final_price"), currency),
        "regular": _money_from_steam_cents(item.get("original_price"), currency),
        "cut": discount,
        "url": f"https://store.steampowered.com/app/{appid}/",
        "timestamp": None,
    }
    if not current["price"]:
        return None

    return {
        "steam_appid": int(appid),
        "name": name,
        "background_image": item.get("large_capsule_image") or item.get("header_image"),
        "url": current["url"],
        "current": current,
        "history_low_all": None,
    }


async def fetch_steam_store_deals(country: str = "US", page_size: int = 12) -> list[dict[str, Any]]:
    params = {"cc": country, "l": "english"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(f"{STEAM_STORE_BASE_URL}/api/featuredcategories", params=params)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Steam Store request failed: {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Steam Store request failed") from exc

    data = response.json()
    candidates = [
        *(data.get("top_sellers") or {}).get("items", []),
        *(data.get("specials") or {}).get("items", []),
    ]
    seen: set[int] = set()
    deals = []
    for item in candidates:
        deal = _steam_deal(item)
        if not deal or deal["steam_appid"] in seen:
            continue
        seen.add(deal["steam_appid"])
        deals.append(deal)
        if len(deals) >= page_size:
            break
    return deals
