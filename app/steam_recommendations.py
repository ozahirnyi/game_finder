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
    fetch_igdb_similar_games,
    fetch_igdb_trending_games,
)
from app.redis_client import cache_get, cache_set
from app.recommendation_catalog import fetch_recommendation_catalog_games, normalize_preference_genre

CACHE_TTL_SECONDS = 24 * 60 * 60
MAX_PREFERENCE_SEEDS = 4
SIMILAR_CANDIDATES_PER_SEED = 6
MAX_PREFERENCE_GENRES = 3


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
    # Steam wishlist rows store an appid in the legacy catalog_game_id field.
    if getattr(item, "source", None) == "steam" or getattr(item, "link_state", None) == "quarantined":
        return None
    if getattr(item, "source", None) == "psn" and getattr(item, "link_state", None) != "linked":
        return None
    value = getattr(item, "catalog_game_id", None)
    return value if isinstance(value, int) and not isinstance(value, bool) and value > 0 else None


def _steam_appid(item) -> int | None:
    if getattr(item, "source", None) != "steam" or getattr(item, "link_state", None) == "quarantined":
        return None
    value = str(getattr(item, "external_id", "") or "")
    return int(value) if value.isascii() and value.isdigit() and int(value) > 0 else None


def _collection_fingerprint(items: list) -> list[tuple]:
    return sorted(
        (
            str(getattr(item, "source", "") or ""),
            str(getattr(item, "external_id", "") or ""),
            _catalog_id(item) or 0,
            str(getattr(item, "link_state", "") or ""),
            str(getattr(item, "title", "") or "").casefold(),
            int(getattr(item, "playtime_forever", 0) or 0),
        )
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
    if not isinstance(igdb_id, int) or isinstance(igdb_id, bool) or igdb_id < 1 or not title:
        return None
    return {
        "id": igdb_id,
        "name": title,
        "background_image": game.get("background_image"),
        "genres": _labels(game, "genres"),
        "platforms": _labels(game, "platforms"),
        "steam_appid": game.get("steam_appid"),
    }


def _add_weighted_labels(weights: dict[str, float], labels: list[str], weight: float, *, genres: bool = False) -> None:
    for label in labels:
        key = normalize_preference_genre(label) if genres else label.casefold()
        weights[key] = weights.get(key, 0.0) + weight


async def _preference_weights(user, saved_games: list, steam_games: list[dict], favorites: list, wishlist: list) -> tuple[dict[str, float], dict[str, float], set[int], dict[int, float]]:
    genre_weights: dict[str, float] = {}
    platform_weights: dict[str, float] = {}
    steam_catalog_ids: set[int] = set()
    seed_weights: dict[int, float] = {}
    _add_weighted_labels(genre_weights, _labels({"genres": getattr(user, "favorite_genres", None) or []}, "genres"), 4.0, genres=True)
    _add_weighted_labels(platform_weights, _labels({"platforms": getattr(user, "platforms", None) or []}, "platforms"), 2.0)

    ids = sorted({catalog_id for item in [*saved_games, *favorites, *wishlist] if (catalog_id := _catalog_id(item)) is not None})
    try:
        catalog_games = await fetch_igdb_games_by_ids(ids) if ids else {}
    except Exception:
        catalog_games = {}
    appids = list(dict.fromkeys([
        *(game["appid"] for game in steam_games if isinstance(game.get("appid"), int) and not isinstance(game["appid"], bool) and game["appid"] > 0),
        *(_steam_appid(item) for item in [*favorites, *wishlist] if _steam_appid(item) is not None),
    ]))
    try:
        steam_catalog_games = await fetch_igdb_games_by_steam_appids(appids) if appids else {}
    except Exception:
        steam_catalog_games = {}
    steam_catalog_ids.update(
        game["id"] for game in (_verified_catalog_game(steam_catalog_games.get(appid)) for appid in appids) if game
    )

    def add_game(game: dict, genre_weight: float, platform_weight: float) -> None:
        _add_weighted_labels(genre_weights, game["genres"], genre_weight, genres=True)
        _add_weighted_labels(platform_weights, game["platforms"], platform_weight)
        seed_weights[game["id"]] = max(seed_weights.get(game["id"], 0.0), genre_weight)

    for items, genre_weight, platform_weight in [(saved_games, 2.0, 1.0), (favorites, 8.0, 4.0), (wishlist, 3.0, 1.5)]:
        seen: set[int] = set()
        for item in items:
            catalog_id = _catalog_id(item)
            game = _verified_catalog_game(catalog_games.get(catalog_id)) if catalog_id else None
            if game and game["id"] != catalog_id:
                game = None
            if game is None and items is not saved_games:
                game = _verified_catalog_game(steam_catalog_games.get(_steam_appid(item)))
            if game and game["id"] not in seen:
                seen.add(game["id"])
                add_game(game, genre_weight, platform_weight)

    ranked_steam_games = sorted(
        (game for game in steam_games if isinstance(game.get("appid"), int) and not isinstance(game["appid"], bool) and game["appid"] > 0 and int(game.get("playtime_forever") or 0) > 0),
        key=lambda game: (-max(int(game.get("playtime_forever") or 0), 0), game["appid"]),
    )[:12]
    for steam_game in ranked_steam_games:
        game = _verified_catalog_game(steam_catalog_games.get(steam_game["appid"]))
        if game:
            playtime = max(int(steam_game.get("playtime_forever") or 0), 0)
            interest = 2.0 + min(playtime, 12000) / 1200
            add_game(game, interest, interest / 2)
    return genre_weights, platform_weights, steam_catalog_ids, seed_weights


async def _preference_candidates(genre_weights: dict[str, float], platform_weights: dict[str, float], seed_weights: dict[int, float]) -> tuple[list[dict], dict[int, float]]:
    """Expand a small deterministic set of tastes; keep partial provider results."""
    seeds = sorted(seed_weights, key=lambda game_id: (-seed_weights[game_id], game_id))[:MAX_PREFERENCE_SEEDS]
    genres = sorted(genre_weights, key=lambda genre: (-genre_weights[genre], genre))[:MAX_PREFERENCE_GENRES]
    responses = await asyncio.gather(
        *(fetch_igdb_similar_games(game_id, limit=SIMILAR_CANDIDATES_PER_SEED) for game_id in seeds),
        *(fetch_recommendation_catalog_games({"genres": [genre], "platforms": list(platform_weights)}, limit=12) for genre in genres),
        return_exceptions=True,
    )
    candidates: list[dict] = []
    affinities: dict[int, float] = {}
    for index, response in enumerate(responses):
        if not isinstance(response, list):
            continue
        limit = SIMILAR_CANDIDATES_PER_SEED if index < len(seeds) else 12
        for raw_game in response[:limit]:
            game = _verified_catalog_game(raw_game)
            if game is None:
                continue
            candidates.append(game)
            if index < len(seeds):
                affinities[game["id"]] = max(affinities.get(game["id"], 0.0), seed_weights[seeds[index]])
            else:
                # Theme filters (Action/Horror) need not appear in IGDB's genre labels.
                affinities[game["id"]] = max(affinities.get(game["id"], 0.0), genre_weights[genres[index - len(seeds)]])
    return candidates, affinities


def _steam_library_with_saved(steam_games: list[dict], saved_games: list) -> list[dict]:
    """A persisted Steam snapshot still supplies identity when live Steam is down."""
    merged = {game["appid"]: dict(game) for game in steam_games if isinstance(game.get("appid"), int) and not isinstance(game["appid"], bool) and game["appid"] > 0}
    for item in saved_games:
        appid = _steam_appid(item)
        if appid is None:
            continue
        playtime = max(int(getattr(item, "playtime_forever", 0) or 0), 0)
        if appid not in merged:
            merged[appid] = {"appid": appid, "name": getattr(item, "title", ""), "playtime_forever": playtime}
    return list(merged.values())


def _recommendation_reason(game: dict, user) -> tuple[str, list[str]]:
    genres = _labels(game, "genres")
    favorite_genres = {normalize_preference_genre(str(value)) for value in (getattr(user, "favorite_genres", None) or [])}
    profile_matches = [genre for genre in genres if normalize_preference_genre(genre) in favorite_genres]
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
    steam_games = _steam_library_with_saved(steam_games, saved_games)
    fingerprint = _personal_fingerprint(user, saved_games, steam_games, favorites, wishlist)
    key = f"steam_recommendations:v6:{user.id}:{fingerprint}"
    try:
        cached = await cache_get(key)
        if cached is not None:
            return cached
    except Exception:
        pass
    excluded_ids = {catalog_id for item in [*saved_games, *favorites, *wishlist] if (catalog_id := _catalog_id(item)) is not None}
    excluded_appids = {game["appid"] for game in steam_games}
    excluded_appids.update(appid for item in [*favorites, *wishlist] if (appid := _steam_appid(item)) is not None)
    excluded_titles = {str(game.get("name") or "").strip().casefold() for game in steam_games}
    excluded_titles.update(str(getattr(item, "title", "") or "").strip().casefold() for item in [*saved_games, *favorites, *wishlist])
    try:
        catalog = await fetch_igdb_trending_games(page=1, page_size=24)
    except Exception:
        catalog = {"results": []}
    genre_weights, platform_weights, steam_catalog_ids, seed_weights = await _preference_weights(user, saved_games, steam_games, favorites, wishlist)
    preference_candidates, affinities = await _preference_candidates(genre_weights, platform_weights, seed_weights)
    excluded_ids.update(steam_catalog_ids)
    candidates = [game for raw_game in [*catalog.get("results", []), *preference_candidates] if (game := _verified_catalog_game(raw_game)) is not None]
    # Identity evidence from either provider result applies to every duplicate.
    excluded_ids.update(game["id"] for game in candidates if game["steam_appid"] in excluded_appids)
    available: list[dict] = []
    seen_ids: set[int] = set()
    seen_titles: set[str] = set()
    for candidate in candidates:
        title_key = candidate["name"].casefold()
        if candidate["id"] in excluded_ids or candidate["steam_appid"] in excluded_appids or title_key in excluded_titles or candidate["id"] in seen_ids or title_key in seen_titles:
            continue
        seen_ids.add(candidate["id"])
        seen_titles.add(title_key)
        candidate["score"] = sum(genre_weights.get(normalize_preference_genre(genre), 0.0) for genre in candidate["genres"]) + sum(platform_weights.get(platform.casefold(), 0.0) for platform in candidate["platforms"]) + affinities.get(candidate["id"], 0.0)
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
