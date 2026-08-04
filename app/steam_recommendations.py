import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.openai_client import get_recommendation
from app.integrations.igdb import fetch_igdb_games, fetch_igdb_trending_games
from app.redis_client import cache_get, cache_set
from app.steam_store import fetch_steam_store_deal_candidates

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


def _personal_fingerprint(user, saved_games: list, steam_games: list[dict]) -> str:
    payload = {"steam": sorted((int(game.get("appid") or 0), int(game.get("playtime_forever") or 0)) for game in steam_games), "saved": sorted(str(game.title).casefold() for game in saved_games), "genres": sorted(str(value).casefold() for value in (getattr(user, "favorite_genres", None) or [])), "platforms": sorted(str(value).casefold() for value in (getattr(user, "platforms", None) or [])), "bio": str(getattr(user, "bio", None) or "").casefold()}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


async def enrich_steam_candidate(candidate: dict) -> dict:
    title = str(candidate.get("name") or "").strip()
    enriched = {**candidate, "igdb_id": None}
    if not title:
        return enriched
    try:
        matches = await fetch_igdb_games(title, page=1)
        match = next(
            (
                game
                for game in matches.get("results", [])
                if str(game.get("name") or "").casefold() == title.casefold()
            ),
            None,
        )
        if match:
            enriched["igdb_id"] = match.get("id")
            enriched["background_image"] = match.get("background_image") or candidate.get("background_image")
    except Exception:
        pass
    return enriched


async def get_personalized_recommendations(user, saved_games: list, steam_games: list[dict]) -> dict:
    fingerprint = _personal_fingerprint(user, saved_games, steam_games)
    key = f"steam_recommendations:v4:{user.id}:{fingerprint}"
    try:
        cached = await cache_get(key)
        if cached is not None:
            return cached
    except Exception:
        pass
    owned_ids = {int(game.get("appid") or 0) for game in steam_games}
    excluded = {str(game.get("name") or "").casefold() for game in steam_games} | {str(game.title).casefold() for game in saved_games}
    try:
        candidates = (await fetch_steam_store_deal_candidates()).get("candidates", [])
    except Exception:
        candidates = []
    available = [candidate for candidate in candidates if int(candidate.get("steam_appid") or 0) not in owned_ids and str(candidate.get("name") or "").casefold() not in excluded]
    popular_fallback = False
    if not available:
        try:
            trending = await fetch_igdb_trending_games(page=1, page_size=12)
            available = [
                {
                    "name": game["name"],
                    "igdb_id": game.get("id"),
                    "background_image": game.get("background_image"),
                }
                for game in trending.get("results", [])
                if str(game.get("name") or "").casefold() not in excluded
            ]
            popular_fallback = True
        except Exception:
            pass
    offset = int(fingerprint[:8], 16) % max(len(available), 1)
    selected_candidates = (available[offset:] + available[:offset])[:6]
    selected = (
        selected_candidates
        if popular_fallback
        else await asyncio.gather(*(enrich_steam_candidate(candidate) for candidate in selected_candidates))
    )
    reason = "Popular game selected because personalized catalog is unavailable." if popular_fallback else "Available on Steam and selected from your library and profile signals."
    result = {"recommendations": [{"title": candidate["name"], "reason": reason, "tags": [], "igdb_id": candidate.get("igdb_id"), "cover_url": candidate.get("background_image")} for candidate in selected], "cache_expires_at": (datetime.now(timezone.utc) + timedelta(seconds=CACHE_TTL_SECONDS)).isoformat()}
    try:
        await cache_set(key, result, CACHE_TTL_SECONDS)
    except Exception:
        pass
    return result
