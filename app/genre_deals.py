from collections.abc import Awaitable, Callable
from typing import Any

from app.integrations.rawg import RAWGError


DEFAULT_DEAL_GENRES = ("Action", "RPG", "Adventure", "Strategy", "Indie")
MAX_DEALS_PER_GENRE = 5
DEFAULT_GENRE_ORDER = {genre.casefold(): index for index, genre in enumerate(DEFAULT_DEAL_GENRES)}


def normalize_genre(value: str) -> str:
    return value.strip().casefold()


def select_deal_genres(favorite_genres: list[str] | None) -> list[str]:
    selected = []
    seen = set()
    for genre in favorite_genres or []:
        cleaned = genre.strip()
        normalized = normalize_genre(cleaned)
        if cleaned and normalized not in seen:
            selected.append(cleaned)
            seen.add(normalized)
        if len(selected) == 5:
            break
    return selected


async def _enrich_deal(
    deal: dict[str, Any],
    fetch_rawg_games: Callable[[str, int], Awaitable[dict[str, Any]]],
) -> tuple[dict[str, Any], set[str]]:
    try:
        rawg = await fetch_rawg_games(deal["name"], 1)
        results = [game for game in rawg.get("results", []) if game.get("id")]
        match = next(
            (game for game in results if normalize_genre(game.get("name") or "") == normalize_genre(deal["name"])),
            results[0] if results else None,
        )
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


def _fallback_genres(selected: list[str], enriched: list[tuple[dict[str, Any], set[str]]]) -> list[str]:
    selected_normalized = {normalize_genre(genre) for genre in selected}
    counts: dict[str, int] = {}
    for _, item_genres in enriched:
        for genre in item_genres:
            if genre not in selected_normalized:
                counts[genre] = counts.get(genre, 0) + 1
    ranked = sorted(
        counts,
        key=lambda genre: (-counts[genre], DEFAULT_GENRE_ORDER.get(genre, len(DEFAULT_DEAL_GENRES)), genre),
    )
    genres = [*selected]
    for genre in ranked:
        if len(genres) == 5:
            break
        genres.append(next((name for name in DEFAULT_DEAL_GENRES if normalize_genre(name) == genre), genre.title()))
    for genre in DEFAULT_DEAL_GENRES:
        if len(genres) == 5:
            break
        if normalize_genre(genre) not in {normalize_genre(item) for item in genres}:
            genres.append(genre)
    return genres


async def build_genre_deal_groups(
    country: str,
    favorite_genres: list[str] | None,
    fetch_candidates: Callable[[str], Awaitable[dict[str, list[dict[str, Any]]]]],
    fetch_rawg_games: Callable[[str, int], Awaitable[dict[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    selected_genres = select_deal_genres(favorite_genres)
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
    genres = _fallback_genres(selected_genres, list(rawg_by_appid.values()))
    sections = [{"genre": genre, "results": []} for genre in genres]
    for section in sections:
        selected = normalize_genre(section["genre"])
        for item, item_genres in rawg_by_appid.values():
            if selected in item_genres and len(section["results"]) < MAX_DEALS_PER_GENRE:
                section["results"].append(item)
    return {"popular": popular, "sections": sections}
