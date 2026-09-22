import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from app.integrations.igdb import IGDBError


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


def _apply_catalog_media(deal: dict[str, Any], catalog: dict[str, Any] | None) -> dict[str, Any]:
    enriched = dict(deal)
    for field in (
        "hero_image", "screenshot_image", "cover_width", "cover_height", "hero_width", "hero_height",
        "screenshot_width", "screenshot_height",
    ):
        value = catalog.get(field) if catalog else None
        if value is not None:
            enriched[field] = value
    return enriched


def _enrich_deal(deal: dict[str, Any], results: list[dict[str, Any]]) -> tuple[dict[str, Any], set[str]]:
    match = next(
        (game for game in results if normalize_genre(game.get("name") or "") == normalize_genre(deal["name"])),
        results[0] if results else None,
    )
    item = _apply_catalog_media({
        "id": match.get("id") if match else None,
        "steam_appid": deal["steam_appid"],
        "name": deal["name"],
        "released": match.get("released") if match else None,
        "cover_image": match.get("cover_image") if match else None,
        "background_image": deal.get("background_image") or (match.get("background_image") if match else None),
        "url": deal.get("url"),
        "current": deal.get("current"),
        "history_low_all": deal.get("history_low_all"),
    }, match)
    return item, {normalize_genre(genre) for genre in (match or {}).get("genres", [])}


def _unenriched_deal(deal: dict[str, Any]) -> tuple[dict[str, Any], set[str]]:
    return {
        "id": None,
        "steam_appid": deal["steam_appid"],
        "name": deal["name"],
        "released": None,
        "cover_image": None,
        "background_image": deal.get("background_image"),
        "url": deal.get("url"),
        "current": deal.get("current"),
        "history_low_all": deal.get("history_low_all"),
    }, set()


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
    candidates: dict[str, list[dict[str, Any]]] | Callable[[str], Awaitable[dict[str, list[dict[str, Any]]]]],
    fetch_igdb_matches: Callable[
        [list[dict[str, Any]], Callable[[list[str]], Awaitable[dict[str, list[dict[str, Any]]]]]],
        Awaitable[dict[int, dict[str, list[dict[str, Any]]]]],
    ],
    fetch_igdb_batches: Callable[[list[str]], Awaitable[dict[str, list[dict[str, Any]]]]] | Callable[[list[int], str], Awaitable[dict[int, list[str]]]] | None = None,
    fetch_steam_genres: Callable[[list[int], str], Awaitable[dict[int, list[str]]]] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    if callable(candidates):
        legacy_fetch_candidates = candidates
        legacy_fetch_igdb_games = fetch_igdb_matches
        legacy_fetch_steam_genres = fetch_steam_genres or fetch_igdb_batches
        candidates = await legacy_fetch_candidates(country)

        async def legacy_batches(titles: list[str]) -> dict[str, list[dict[str, Any]]]:
            results: dict[str, list[dict[str, Any]]] = {}
            for title in titles:
                response = await legacy_fetch_igdb_games(title, 1)  # type: ignore[call-arg]
                results[title] = response.get("results", [])
            return results

        async def legacy_matches(
            deals: list[dict[str, Any]],
            fetch_batches: Callable[[list[str]], Awaitable[dict[str, list[dict[str, Any]]]]],
        ) -> dict[int, dict[str, list[dict[str, Any]]]]:
            responses = await fetch_batches([deal["name"] for deal in deals])
            return {
                deal["steam_appid"]: {"results": responses.get(deal["name"], [])}
                for deal in deals
            }

        fetch_igdb_matches = legacy_matches
        fetch_igdb_batches = legacy_batches
        fetch_steam_genres = legacy_fetch_steam_genres  # type: ignore[assignment]

    assert fetch_igdb_batches is not None
    selected_genres = select_deal_genres(favorite_genres)
    deals_by_appid = {
        deal["steam_appid"]: deal
        for deal in [*candidates["candidates"], *candidates["popular"]]
        if isinstance(deal.get("steam_appid"), int) and deal["steam_appid"] > 0
    }
    try:
        matches = await fetch_igdb_matches(list(deals_by_appid.values()), fetch_igdb_batches)
    except (asyncio.TimeoutError, IGDBError):
        matches = {}
    igdb_by_appid: dict[int, tuple[dict[str, Any], set[str]]] = {}
    for appid, deal in deals_by_appid.items():
        cached = matches.get(appid, {})
        results = cached.get("results", []) if isinstance(cached, dict) else []
        igdb_by_appid[appid] = _enrich_deal(deal, results) if results else _unenriched_deal(deal)

    if fetch_steam_genres:
        missing_genres = [appid for appid, (_, genres) in igdb_by_appid.items() if not genres]
        try:
            steam_genres = await fetch_steam_genres(missing_genres, country)
        except Exception:
            steam_genres = {}
        for appid, genres in steam_genres.items():
            if appid in igdb_by_appid and genres:
                item, _ = igdb_by_appid[appid]
                igdb_by_appid[appid] = item, {normalize_genre(genre) for genre in genres}

    popular = []
    for deal in candidates["popular"]:
        enriched = igdb_by_appid.get(deal["steam_appid"])
        if enriched is None:
            enriched = _unenriched_deal(deal)
            igdb_by_appid[deal["steam_appid"]] = enriched
        popular.append(enriched[0])
    genres = _fallback_genres(selected_genres, list(igdb_by_appid.values()))
    sections = [{"genre": genre, "results": []} for genre in genres]
    for section in sections:
        selected = normalize_genre(section["genre"])
        for item, item_genres in igdb_by_appid.values():
            if selected in item_genres and len(section["results"]) < MAX_DEALS_PER_GENRE:
                section["results"].append(item)
    return {"popular": popular, "sections": sections}
