import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.openai_client import get_recommendation
from app.integrations.rawg import fetch_rawg_games
from app.redis_client import cache_get, cache_set

CACHE_TTL_SECONDS = 6 * 60 * 60


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
        enriched = {"title": title, "reason": item.get("reason") or "", "tags": item.get("tags") or [], "rawg_id": None, "cover_url": None}
        try:
            matches = await fetch_rawg_games(title, page=1)
            match = next((game for game in matches.get("results", []) if str(game.get("name") or "").casefold() == key), None)
            if match:
                enriched.update(title=match["name"], rawg_id=match.get("id"), cover_url=match.get("background_image"))
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
