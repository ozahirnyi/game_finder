import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.openai_client import get_recommendation
from app.integrations.igdb import (
    fetch_igdb_games_by_ids,
    fetch_igdb_games_by_steam_appids,
    fetch_igdb_games,
    fetch_igdb_trending_games,
)
from app.redis_client import cache_get, cache_set

CACHE_TTL_SECONDS = 24 * 60 * 60


def build_steam_recommendation_prompt(games: list[dict], extra_prompt: str | None = None) -> str:
    top_games = games[:10]
    if not top_games:
        raise HTTPException(status_code=409, detail="Steam library has no playable history yet")
    game_lines = [
        f"{index}. {game.get('name')} - {round(int(game.get('playtime_forever') or 0) / 60, 1)} hours played"
        for index, game in enumerate(top_games, start=1)
    ]
    request = (extra_prompt or "").strip() or "Recommend games I am likely to enjoy next based on my most played Steam games."
    return "\n".join([request, "", "My most played Steam games:", *game_lines, "", "Use the playtime as the strongest preference signal.", "Avoid recommending games that are already in this Steam list."])


def build_steam_library_fingerprint(games: list[dict]) -> str:
    normalized = sorted((int(game["appid"]), int(game.get("playtime_forever") or 0), int(game.get("playtime_2weeks") or 0)) for game in games if game.get("appid") is not None)
    return hashlib.sha256(json.dumps(normalized, separators=(",", ":")).encode()).hexdigest()


async def normalize_recommendations(result: dict, owned_titles: set[str]) -> list[dict]:
    normalized = []
    seen = set()
    for item in result.get("recommendations", []):
        title = str(item.get("title") or "").strip()
        key = title.casefold()
        if not title or key in owned_titles or key in seen:
            continue
        seen.add(key)
        enriched = {"title": title, "reason": item.get("reason") or "", "tags": item.get("tags") or [], "igdb_id": None, "cover_url": None}
        try:
            matches = await fetch_igdb_games(title, page=1)
            match = next((game for game in matches.get("results", []) if str(game.get("name") or "").casefold() == key), None)
            if match:
                enriched.update(title=match["name"], igdb_id=match.get("id"), cover_url=match.get("background_image"))
        except Exception:
            pass
        normalized.append(enriched)
    return normalized


async def get_cached_steam_recommendations(user_id: uuid.UUID, games: list[dict], extra_prompt: str | None = None) -> dict:
    key = f"steam_recommendations:v2:{user_id}:{build_steam_library_fingerprint(games)}"
    try:
        cached = await cache_get(key)
        if cached is not None:
            return cached
    except Exception:
        pass
    result = await asyncio.to_thread(get_recommendation, build_steam_recommendation_prompt(games, extra_prompt), sorted({int(game["appid"]) for game in games if game.get("appid") is not None}))
    result = {
        "recommendations": await normalize_recommendations(result, {str(game.get("name") or "").strip().casefold() for game in games}),
        "cache_expires_at": (datetime.now(timezone.utc) + timedelta(seconds=CACHE_TTL_SECONDS)).isoformat(),
    }
    try:
        await cache_set(key, result, CACHE_TTL_SECONDS)
    except Exception:
        pass
    return result


def _catalog_id(item) -> int | None:
    value = getattr(item, "catalog_game_id", None)
    return value if isinstance(value, int) and not isinstance(value, bool) and value > 0 else None


def _collection_fingerprint(items: list) -> list[tuple[int, str]]:
    return sorted(
        (_catalog_id(item) or 0, str(getattr(item, "title", "") or "").casefold())
        for item in items
    )


def _personal_fingerprint(user, saved_games: list, steam_games: list[dict], favorites: list, wishlist: list) -> str:
    payload = {
        "steam": sorted((int(game.get("appid") or 0), int(game.get("playtime_forever") or 0)) for game in steam_games),
        "saved": _collection_fingerprint(saved_games),
        "favorites": _collection_fingerprint(favorites),
        "wishlist": _collection_fingerprint(wishlist),
        "genres": sorted(str(value).casefold() for value in (getattr(user, "favorite_genres", None) or [])),
        "platforms": sorted(str(value).casefold() for value in (getattr(user, "platforms", None) or [])),
        "bio": str(getattr(user, "bio", None) or "").casefold(),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _labels(game: dict, key: str) -> list[str]:
    return [str(value).strip() for value in game.get(key) or [] if str(value).strip()]


def _verified_catalog_game(game: dict | None) -> dict | None:
    if not isinstance(game, dict):
        return None
    igdb_id = game.get("id")
    title = str(game.get("name") or "").strip()
    if not isinstance(igdb_id, int) or igdb_id < 1 or not title:
        return None
    return {
        "id": igdb_id,
        "name": title,
        "background_image": game.get("background_image"),
        "genres": _labels(game, "genres"),
        "platforms": _labels(game, "platforms"),
    }


def _add_weighted_labels(weights: dict[str, float], labels: list[str], weight: float) -> None:
    for label in labels:
        key = label.casefold()
        weights[key] = weights.get(key, 0.0) + weight


async def _preference_weights(user, saved_games: list, steam_games: list[dict], favorites: list, wishlist: list) -> tuple[dict[str, float], dict[str, float], set[int]]:
    genre_weights: dict[str, float] = {}
    platform_weights: dict[str, float] = {}
    steam_catalog_ids: set[int] = set()
    _add_weighted_labels(genre_weights, _labels({"genres": getattr(user, "favorite_genres", None) or []}, "genres"), 4.0)
    _add_weighted_labels(platform_weights, _labels({"platforms": getattr(user, "platforms", None) or []}, "platforms"), 2.0)

    async def add_collection(items: list, genre_weight: float, platform_weight: float) -> None:
        ids = [catalog_id for item in items if (catalog_id := _catalog_id(item)) is not None]
        try:
            catalog_games = await fetch_igdb_games_by_ids(ids)
        except Exception:
            catalog_games = {}
        for game in (_verified_catalog_game(catalog_games.get(igdb_id)) for igdb_id in ids):
            if game:
                _add_weighted_labels(genre_weights, game["genres"], genre_weight)
                _add_weighted_labels(platform_weights, game["platforms"], platform_weight)

    await add_collection(saved_games, 2.0, 1.0)
    await add_collection(favorites, 8.0, 4.0)
    await add_collection(wishlist, 3.0, 1.5)

    appids = [game.get("appid") for game in steam_games if isinstance(game.get("appid"), int) and game["appid"] > 0]
    try:
        steam_catalog_games = await fetch_igdb_games_by_steam_appids(appids)
    except Exception:
        steam_catalog_games = {}
    steam_catalog_ids.update(
        game["id"] for game in (_verified_catalog_game(value) for value in steam_catalog_games.values()) if game
    )
    ranked_steam_games = sorted(
        (game for game in steam_games if isinstance(game.get("appid"), int) and game["appid"] > 0),
        key=lambda game: (-max(int(game.get("playtime_forever") or 0), 0), game["appid"]),
    )[:12]
    for steam_game in ranked_steam_games:
        game = _verified_catalog_game(steam_catalog_games.get(steam_game["appid"]))
        if game:
            playtime = max(int(steam_game.get("playtime_forever") or 0), 0)
            interest = 2.0 + min(playtime, 12000) / 1200
            _add_weighted_labels(genre_weights, game["genres"], interest)
            _add_weighted_labels(platform_weights, game["platforms"], interest / 2)
    return genre_weights, platform_weights, steam_catalog_ids


def _recommendation_reason(game: dict, user) -> tuple[str, list[str]]:
    genres = _labels(game, "genres")
    favorite_genres = {str(value).casefold() for value in (getattr(user, "favorite_genres", None) or [])}
    profile_matches = [genre for genre in genres if genre.casefold() in favorite_genres]
    if profile_matches:
        return f"Matches your favorite genres: {', '.join(profile_matches[:2])}.", profile_matches[:3]
    platforms = _labels(game, "platforms")
    profile_platforms = {str(value).casefold() for value in (getattr(user, "platforms", None) or [])}
    platform_matches = [platform for platform in platforms if platform.casefold() in profile_platforms]
    if platform_matches:
        return f"Available on your preferred platforms: {', '.join(platform_matches[:2])}.", genres[:3]
    return "Matches signals from your library and collections.", genres[:3]


async def get_personalized_recommendations(user, saved_games: list, steam_games: list[dict], favorites: list | None = None, wishlist: list | None = None) -> dict:
    favorites = favorites or []
    wishlist = wishlist or []
    fingerprint = _personal_fingerprint(user, saved_games, steam_games, favorites, wishlist)
    key = f"steam_recommendations:v5:{user.id}:{fingerprint}"
    try:
        cached = await cache_get(key)
        if cached is not None:
            return cached
    except Exception:
        pass
    excluded_ids = {catalog_id for item in [*saved_games, *favorites, *wishlist] if (catalog_id := _catalog_id(item)) is not None}
    excluded_titles = {str(game.get("name") or "").strip().casefold() for game in steam_games}
    excluded_titles.update(str(getattr(item, "title", "") or "").strip().casefold() for item in [*saved_games, *favorites, *wishlist])
    try:
        catalog = await fetch_igdb_trending_games(page=1, page_size=24)
    except Exception:
        catalog = {"results": []}
    genre_weights, platform_weights, steam_catalog_ids = await _preference_weights(user, saved_games, steam_games, favorites, wishlist)
    excluded_ids.update(steam_catalog_ids)
    available: list[dict] = []
    seen_ids: set[int] = set()
    seen_titles: set[str] = set()
    for raw_candidate in catalog.get("results", []):
        candidate = _verified_catalog_game(raw_candidate)
        if candidate is None:
            continue
        title_key = candidate["name"].casefold()
        if candidate["id"] in excluded_ids or title_key in excluded_titles or candidate["id"] in seen_ids or title_key in seen_titles:
            continue
        seen_ids.add(candidate["id"])
        seen_titles.add(title_key)
        candidate["score"] = sum(genre_weights.get(genre.casefold(), 0.0) for genre in candidate["genres"]) + sum(platform_weights.get(platform.casefold(), 0.0) for platform in candidate["platforms"])
        available.append(candidate)
    selected = sorted(available, key=lambda game: (-game["score"], game["name"].casefold(), game["id"]))[:6]
    recommendations = []
    for candidate in selected:
        reason, tags = _recommendation_reason(candidate, user)
        recommendations.append({
            "title": candidate["name"], "reason": reason, "tags": tags,
            "igdb_id": candidate["id"], "cover_url": candidate["background_image"],
        })
    result = {"recommendations": recommendations, "cache_expires_at": (datetime.now(timezone.utc) + timedelta(seconds=CACHE_TTL_SECONDS)).isoformat()}
    try:
        await cache_set(key, result, CACHE_TTL_SECONDS)
    except Exception:
        pass
    return result
