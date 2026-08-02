import asyncio
from typing import Any

import httpx
from fastapi import HTTPException


STEAM_STORE_BASE_URL = "https://store.steampowered.com"
EXPECTED_CURRENCY_BY_COUNTRY = {"UA": "UAH"}


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


def _has_expected_currency(deal: dict[str, Any], country: str) -> bool:
    expected_currency = EXPECTED_CURRENCY_BY_COUNTRY.get(country.upper())
    if expected_currency is None:
        return True
    return deal["current"]["price"]["currency"] == expected_currency


async def fetch_steam_store_deals(country: str = "US", page_size: int = 12) -> list[dict[str, Any]]:
    payload = await fetch_steam_store_deal_candidates(country)
    return payload["candidates"][:page_size]


async def fetch_steam_store_game_price(title: str, country: str = "US") -> dict[str, Any]:
    params = {"term": title, "cc": country, "l": "english"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            search = await client.get(f"{STEAM_STORE_BASE_URL}/api/storesearch/", params=params)
            search.raise_for_status()
            items = search.json().get("items") or []
            item = next(
                (candidate for candidate in items if (candidate.get("name") or "").casefold() == title.casefold()),
                next((candidate for candidate in items if candidate.get("type") == "game"), None),
            )
            if not item or not item.get("id"):
                raise HTTPException(status_code=404, detail="Steam price data not found for this game")
            appid = int(item["id"])
            detail = await client.get(
                f"{STEAM_STORE_BASE_URL}/api/appdetails",
                params={"appids": appid, "cc": country, "l": "english"},
            )
            detail.raise_for_status()
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Steam Store request failed") from exc

    data = (detail.json().get(str(appid)) or {}).get("data") or {}
    overview = data.get("price_overview") or {}
    price = _money_from_steam_cents(overview.get("final"), overview.get("currency"))
    if price is None:
        raise HTTPException(status_code=404, detail="Steam price data not found for this game")
    regular = _money_from_steam_cents(overview.get("initial"), overview.get("currency"))
    url = f"https://store.steampowered.com/app/{appid}/"
    return {
        "itad_id": f"steam:{appid}",
        "title": data.get("name") or item.get("name") or title,
        "url": url,
        "current": {
            "shop": "Steam", "price": price,
            "regular": regular if regular != price else None,
            "cut": int(overview.get("discount_percent") or 0),
            "url": url, "timestamp": None,
        },
        "history_low_all": None, "history_low_1y": None,
        "history_low_3m": None, "deals": [],
    }


async def fetch_steam_store_game_genres(appids: list[int], country: str = "US") -> dict[int, list[str]]:
    """Return Steam storefront genres for the supplied app IDs without failing a deals page."""
    ids = list(dict.fromkeys(appid for appid in appids if appid > 0))
    if not ids:
        return {}
    async with httpx.AsyncClient(timeout=15.0) as client:
        async def fetch_one(appid: int) -> tuple[int, list[str]]:
            try:
                response = await client.get(
                    f"{STEAM_STORE_BASE_URL}/api/appdetails",
                    params={"appids": appid, "cc": country, "l": "english"},
                )
                response.raise_for_status()
            except httpx.HTTPError:
                return appid, []
            data = (response.json().get(str(appid)) or {}).get("data") or {}
            return appid, [genre["description"] for genre in data.get("genres") or [] if genre.get("description")]

        return dict(await asyncio.gather(*(fetch_one(appid) for appid in ids)))


async def fetch_steam_store_deal_candidates(country: str = "US", page_size: int = 60) -> dict[str, list[dict[str, Any]]]:
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
    top_sellers = (data.get("top_sellers") or {}).get("items", [])
    candidates = [
        *top_sellers,
        *((data.get("specials") or {}).get("items", [])),
        *((data.get("new_releases") or {}).get("items", [])),
    ]
    popular = []
    popular_seen: set[int] = set()
    for item in [*top_sellers, *((data.get("specials") or {}).get("items", []))]:
        deal = _steam_deal(item)
        if deal and _has_expected_currency(deal, country) and deal["steam_appid"] not in popular_seen:
            popular.append(deal)
            popular_seen.add(deal["steam_appid"])
        if len(popular) == 4:
            break
    seen: set[int] = set()
    deals = []
    rejected_currency_count = 0
    for item in candidates:
        deal = _steam_deal(item)
        if not deal or deal["steam_appid"] in seen:
            continue
        seen.add(deal["steam_appid"])
        if not _has_expected_currency(deal, country):
            rejected_currency_count += 1
            continue
        deals.append(deal)
        if len(deals) >= page_size:
            break
    if country.upper() == "UA" and rejected_currency_count and not deals:
        raise HTTPException(status_code=502, detail="Steam Store did not return Ukrainian prices")
    return {"popular": popular, "candidates": deals}
