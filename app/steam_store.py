import asyncio
import re
import unicodedata
from typing import Any

import httpx
from fastapi import HTTPException


STEAM_STORE_BASE_URL = "https://store.steampowered.com"
EXPECTED_CURRENCY_BY_COUNTRY = {"UA": "UAH"}
_STORE_TITLE_NOISE = re.compile(r"[™®©]")
_STORE_TITLE_WORDS = re.compile(r"[^a-z0-9]+")
_STORE_ACCESSORY_WORDS = {"dlc", "soundtrack", "artbook", "ost"}
_CATALOG_EDITION_SUFFIXES = {
    "complete edition",
    "definitive edition",
    "the definitive edition",
    "enhanced",
    "special edition",
}


def _normalized_store_title(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", _STORE_TITLE_NOISE.sub("", value)).casefold()
    normalized = _STORE_TITLE_WORDS.sub(" ", normalized).strip()
    roman_numerals = {"i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7", "viii": "8", "ix": "9", "x": "10"}
    return " ".join(roman_numerals.get(word, word) for word in normalized.split())


def _steam_store_candidate_score(title: str, candidate: dict[str, Any]) -> int | None:
    """Rank only conservative, purchasable title matches from Steam search."""
    candidate_title = str(candidate.get("name") or "").strip()
    if not candidate_title:
        return None
    requested = _normalized_store_title(title)
    offered = _normalized_store_title(candidate_title)
    if not requested or not offered:
        return None
    if candidate_title.casefold() == title.casefold():
        score = 100
    elif offered == requested:
        score = 90
    elif offered.startswith(f"{requested} "):
        score = 80
    else:
        return None
    words = set(offered.split())
    if words & _STORE_ACCESSORY_WORDS:
        score -= 30
    return score


def _rank_steam_store_candidates(title: str, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    scored = [
        (score, index, candidate)
        for index, candidate in enumerate(candidates)
        if (score := _steam_store_candidate_score(title, candidate)) is not None
    ]
    return [
        candidate
        for _score, _has_search_price, _index, candidate in sorted(
            ((score, bool(candidate.get("price")), index, candidate) for score, index, candidate in scored),
            key=lambda item: (-item[0], -item[1], item[2]),
        )
    ]


def _is_exact_steam_store_title(title: str, candidate: dict[str, Any]) -> bool:
    requested = _normalized_store_title(title)
    offered = _normalized_store_title(str(candidate.get("name") or ""))
    return bool(requested) and offered == requested


def _is_catalog_steam_title(title: str, candidate: dict[str, Any]) -> bool:
    requested = _normalized_store_title(title)
    offered = _normalized_store_title(str(candidate.get("name") or ""))
    if not requested:
        return False
    if offered == requested:
        return True
    if not offered.startswith(f"{requested} "):
        return False
    suffix = offered[len(requested) + 1:]
    return suffix in _CATALOG_EDITION_SUFFIXES


def _steam_appdetails_data(payload: dict[str, Any], appid: int) -> dict[str, Any]:
    direct = payload.get(str(appid))
    if isinstance(direct, dict) and isinstance(direct.get("data"), dict):
        return direct["data"]
    for result in payload.values():
        if not isinstance(result, dict):
            continue
        data = result.get("data")
        if isinstance(data, dict) and data.get("steam_appid") == appid:
            return data
    return {}


async def fetch_steam_store_search(query: str, page_size: int = 20) -> list[dict[str, Any]]:
    params = {"term": query, "l": "english", "cc": "us"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(f"{STEAM_STORE_BASE_URL}/api/storesearch/", params=params)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Steam Store request failed: {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Steam Store request failed") from exc

    results = []
    for item in response.json().get("items", []):
        appid = item.get("id")
        name = (item.get("name") or "").strip()
        if not appid or not name:
            continue
        results.append({
            "steam_appid": int(appid),
            "name": name,
            "cover_image": f"https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/library_600x900.jpg",
            "background_image": f"https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/library_600x900.jpg",
            "url": f"{STEAM_STORE_BASE_URL}/app/{appid}/",
        })
        if len(results) >= page_size:
            break
    return results


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
        "cover_image": None,
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


async def fetch_steam_store_game_price(
    title: str,
    country: str = "US",
    exact_title_only: bool = False,
    allow_known_editions: bool = False,
) -> dict[str, Any]:
    params = {"term": title, "cc": country, "l": "english"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            search = await client.get(f"{STEAM_STORE_BASE_URL}/api/storesearch/", params=params)
            search.raise_for_status()
            items = search.json().get("items") or []
            candidates = [
                candidate
                for candidate in items
                if candidate.get("id") and candidate.get("type") in {"game", "app"}
            ]
            ranked_candidates = _rank_steam_store_candidates(title, candidates)
            if exact_title_only:
                ranked_candidates = [
                    candidate
                    for candidate in ranked_candidates
                    if _is_exact_steam_store_title(title, candidate)
                ]
            elif allow_known_editions:
                ranked_candidates = [
                    candidate
                    for candidate in ranked_candidates
                    if _is_catalog_steam_title(title, candidate)
                ]
            if not ranked_candidates:
                raise HTTPException(status_code=404, detail="Steam price data not found for this game")
            item = None
            detail = None
            appid = 0
            for candidate in ranked_candidates:
                candidate_appid = int(candidate["id"])
                candidate_detail = await client.get(
                    f"{STEAM_STORE_BASE_URL}/api/appdetails",
                    params={"appids": candidate_appid, "cc": country, "l": "english"},
                )
                candidate_detail.raise_for_status()
                candidate_data = _steam_appdetails_data(candidate_detail.json(), candidate_appid)
                overview = candidate_data.get("price_overview") or {}
                if not candidate_data.get("is_free") and _money_from_steam_cents(overview.get("final"), overview.get("currency")) is None:
                    continue
                item, detail, appid = candidate, candidate_detail, candidate_appid
                break
            if item is None or detail is None:
                raise HTTPException(status_code=404, detail="Steam price data not found for this game")
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Steam Store request failed") from exc

    data = _steam_appdetails_data(detail.json(), appid)
    is_free = bool(data.get("is_free"))
    overview = data.get("price_overview") or {}
    price = _money_from_steam_cents(overview.get("final"), overview.get("currency"))
    if price is None and not is_free:
        raise HTTPException(status_code=404, detail="Steam price data not found for this game")
    regular = _money_from_steam_cents(overview.get("initial"), overview.get("currency"))
    url = f"https://store.steampowered.com/app/{appid}/"
    return {
        "appid": appid,
        "itad_id": f"steam:{appid}",
        "title": data.get("name") or item.get("name") or title,
        "name": data.get("name") or item.get("name") or title,
        "background_image": data.get("header_image"),
        "description_raw": data.get("short_description"),
        "genres": [genre["description"] for genre in data.get("genres") or [] if genre.get("description")],
        "platforms": ["PC"],
        "url": url,
        "current": {
            "shop": "Steam", "price": price,
            "regular": regular if regular != price else None,
            "cut": int(overview.get("discount_percent") or 0),
            "url": url, "timestamp": None,
        },
        "history_low_all": None, "history_low_1y": None,
        "history_low_3m": None, "deals": [], "is_free": is_free,
    }


async def fetch_steam_store_game_detail(appid: int, country: str = "US") -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{STEAM_STORE_BASE_URL}/api/appdetails",
                params={"appids": appid, "cc": country, "l": "english"},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Steam Store request failed") from exc

    data = _steam_appdetails_data(response.json(), appid)
    is_free = bool(data.get("is_free"))
    if not data:
        raise HTTPException(status_code=404, detail="Steam game not found")

    overview = data.get("price_overview") or {}
    price = _money_from_steam_cents(overview.get("final"), overview.get("currency"))
    regular = _money_from_steam_cents(overview.get("initial"), overview.get("currency"))
    url = f"{STEAM_STORE_BASE_URL}/app/{appid}/"
    return {
        "appid": appid,
        "itad_id": f"steam:{appid}",
        "title": data.get("name") or str(appid),
        "name": data.get("name") or str(appid),
        "background_image": data.get("header_image"),
        "description_raw": data.get("short_description"),
        "genres": [genre["description"] for genre in data.get("genres") or [] if genre.get("description")],
        "platforms": [name for name, enabled in (data.get("platforms") or {}).items() if enabled] or ["PC"],
        "released": (data.get("release_date") or {}).get("date") or None,
        "rating": (data.get("metacritic") or {}).get("score"),
        "url": url,
        "current": {
            "shop": "Steam", "price": price,
            "regular": regular if regular != price else None,
            "cut": int(overview.get("discount_percent") or 0),
            "url": url, "timestamp": None,
        } if price else None,
        "history_low_all": None, "history_low_1y": None,
        "history_low_3m": None, "deals": [], "history": [], "is_free": is_free,
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
