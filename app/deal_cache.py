import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from app.cache import build_cache_key, cache_get, cache_set


STEAM_DEAL_CANDIDATES_TTL = 3600
IGDB_DEAL_MATCH_TTL = 604800
GENRE_DEALS_TTL = 21600


def canonical_deal_genres(genres: list[str] | tuple[str, ...]) -> tuple[str, ...]:
    return tuple(sorted({genre.strip().casefold() for genre in genres if genre and genre.strip()}))


def steam_deal_candidates_key(country: str) -> str:
    return build_cache_key("steam_deal_candidates_v1", country=country.upper())


def igdb_deal_match_key(steam_appid: int) -> str:
    return build_cache_key("igdb_deal_match_v1", steam_appid=steam_appid)


async def get_cached_steam_deal_candidates(
    country: str,
    fetch_candidates: Callable[[str], Awaitable[dict[str, list[dict[str, Any]]]]],
) -> dict[str, list[dict[str, Any]]]:
    normalized_country = country.upper()
    key = steam_deal_candidates_key(normalized_country)
    cached = await cache_get(key)
    if cached is not None:
        return cached
    candidates = await fetch_candidates(normalized_country)
    await cache_set(key, candidates, STEAM_DEAL_CANDIDATES_TTL)
    return candidates


async def get_cached_igdb_deal_matches(
    deals: list[dict[str, Any]],
    fetch_batches: Callable[[list[str]], Awaitable[dict[str, list[dict[str, Any]]]]],
) -> dict[int, dict[str, list[dict[str, Any]]]]:
    unique_deals = {
        deal["steam_appid"]: deal
        for deal in deals
        if isinstance(deal.get("steam_appid"), int)
        and not isinstance(deal.get("steam_appid"), bool)
        and deal["steam_appid"] > 0
    }
    appids = list(unique_deals)
    cached_values = await asyncio.gather(*(cache_get(igdb_deal_match_key(appid)) for appid in appids))
    matches = {
        appid: cached
        for appid, cached in zip(appids, cached_values, strict=True)
        if isinstance(cached, dict) and isinstance(cached.get("results"), list)
    }
    missing_appids = [appid for appid in appids if appid not in matches]
    if not missing_appids:
        return matches

    missing_titles = [str(unique_deals[appid].get("name", "")).strip() for appid in missing_appids]
    responses = await fetch_batches(missing_titles)
    fresh = {
        appid: {"results": list(responses.get(str(unique_deals[appid].get("name", "")).strip(), []))}
        for appid in missing_appids
    }
    await asyncio.gather(
        *(cache_set(igdb_deal_match_key(appid), response, IGDB_DEAL_MATCH_TTL) for appid, response in fresh.items())
    )
    matches.update(fresh)
    return matches
