from collections.abc import Awaitable, Callable
from typing import Any

from app.integrations.rawg import RAWGError


DEFAULT_DEAL_GENRES = ("Action", "RPG", "Adventure", "Strategy", "Indie")
MAX_DEALS_PER_GENRE = 5


def normalize_genre(value: str) -> str:
    return value.strip().casefold()


def select_deal_genres(favorite_genres: list[str] | None) -> list[str]:
    selected = [genre.strip() for genre in favorite_genres or [] if genre.strip()][:5]
    return selected or list(DEFAULT_DEAL_GENRES)


async def _enrich_deal(
    deal: dict[str, Any],
    fetch_rawg_games: Callable[[str, int], Awaitable[dict[str, Any]]],
) -> tuple[dict[str, Any], set[str]]:
    try:
        rawg = await fetch_rawg_games(deal["name"], 1)
        match = next((game for game in rawg.get("results", []) if game.get("id")), None)
    except RAWGError:
        match = None
    item = {
        "id": match.get("id") if match else None,
        "name": deal["name"],
        "released": match.get("released") if match else None,
        "background_image": deal.get("background_image") or (match.get("background_image") if match else None),
        "url": deal.get("url"),
        "current": deal.get("current"),
        "history_low_all": deal.get("history_low_all"),
    }
    return item, {normalize_genre(genre) for genre in (match or {}).get("genres", [])}


async def build_genre_deal_groups(
    country: str,
    favorite_genres: list[str] | None,
    fetch_candidates: Callable[[str], Awaitable[dict[str, list[dict[str, Any]]]]],
    fetch_rawg_games: Callable[[str, int], Awaitable[dict[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    genres = select_deal_genres(favorite_genres)
    sections = [{"genre": genre, "results": []} for genre in genres]
    candidates = await fetch_candidates(country)
    rawg_by_appid: dict[int, tuple[dict[str, Any], set[str]]] = {}
    for deal in candidates["candidates"]:
        rawg_by_appid[deal["steam_appid"]] = await _enrich_deal(deal, fetch_rawg_games)

    popular = []
    for deal in candidates["popular"]:
        enriched = rawg_by_appid.get(deal["steam_appid"])
        if enriched is None:
            enriched = await _enrich_deal(deal, fetch_rawg_games)
            rawg_by_appid[deal["steam_appid"]] = enriched
        popular.append(enriched[0])
    for section in sections:
        selected = normalize_genre(section["genre"])
        for item, item_genres in rawg_by_appid.values():
            if selected in item_genres and len(section["results"]) < MAX_DEALS_PER_GENRE:
                section["results"].append(item)
    return {"popular": popular, "sections": sections}
