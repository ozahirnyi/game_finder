"""Minimal IGDB client for the non-commercial beta.

IGDB uses Twitch client-credentials OAuth.  This module intentionally exposes
the same small normalized payloads to the application regardless of IGDB's
wire format.
"""
import asyncio
import os
import re
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

IGDB_BASE_URL = "https://api.igdb.com/v4"
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
# Compatibility seam for isolated legacy provider mocks; production never sets
# this and always uses Twitch client credentials below.
IGDB_API_KEY: str | None = None
_token: str | None = None
_token_expires_at = 0.0
_request_lock = asyncio.Lock()
_last_request_at = 0.0


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


get_float_env = _float_env


IGDB_TIMEOUT_SECONDS = _float_env("IGDB_TIMEOUT_SECONDS", 12.0)
IGDB_MIN_REQUEST_INTERVAL_SECONDS = _float_env("IGDB_MIN_REQUEST_INTERVAL_SECONDS", 0.25)


class IGDBError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        self.status_code = status_code
        super().__init__(message)


@dataclass(frozen=True)
class CatalogSearchFilters:
    platforms: tuple[str, ...] = ()
    features: tuple[str, ...] = ()
    genres: tuple[str, ...] = ()


_PLATFORM_IDS = {
    "pc": (6, 14, 3),
    "console": (167, 48, 169, 49, 130),
    "ps5": (167,),
    "ps4": (48,),
    "xbox_series": (169,),
    "xbox_one": (49,),
    "switch": (130,),
}
_GAME_MODE_IDS = {"single_player": 1, "multiplayer": 2, "co_op": 3}
_GENRE_IDS = {"adventure": 31, "rpg": 12, "shooter": 5, "strategy": 15}


def _credentials() -> tuple[str, str]:
    client_id = os.getenv("IGDB_CLIENT_ID", "").strip()
    client_secret = os.getenv("IGDB_CLIENT_SECRET", "").strip()
    if not client_id:
        raise IGDBError("IGDB_CLIENT_ID is missing", 503)
    if not client_secret:
        raise IGDBError("IGDB_CLIENT_SECRET is missing", 503)
    return client_id, client_secret


async def _access_token() -> tuple[str, str]:
    global _token, _token_expires_at
    if IGDB_API_KEY:
        return "test-client", IGDB_API_KEY
    client_id, client_secret = _credentials()
    if _token and time.monotonic() < _token_expires_at:
        return client_id, _token
    async with httpx.AsyncClient(timeout=httpx.Timeout(IGDB_TIMEOUT_SECONDS)) as client:
        try:
            response = await client.post(TWITCH_TOKEN_URL, params={
                "client_id": client_id, "client_secret": client_secret, "grant_type": "client_credentials",
            })
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise IGDBError("IGDB OAuth request timeout", 504) from exc
        except httpx.HTTPError as exc:
            raise IGDBError("IGDB OAuth request failed") from exc
    data = response.json()
    token = data.get("access_token")
    if not isinstance(token, str) or not token:
        raise IGDBError("IGDB OAuth response did not contain an access token")
    _token = token
    _token_expires_at = time.monotonic() + max(int(data.get("expires_in", 60)) - 30, 1)
    return client_id, token


async def _query(endpoint: str, query: str) -> list[dict[str, Any]]:
    global _last_request_at
    async with _request_lock:
        delay = IGDB_MIN_REQUEST_INTERVAL_SECONDS - (time.monotonic() - _last_request_at)
        if delay > 0:
            await asyncio.sleep(delay)
        client_id, token = await _access_token()
        _last_request_at = time.monotonic()
        async with httpx.AsyncClient(timeout=httpx.Timeout(IGDB_TIMEOUT_SECONDS)) as client:
            try:
                response = await client.post(f"{IGDB_BASE_URL}/{endpoint}", content=query, headers={
                    "Client-ID": client_id, "Authorization": f"Bearer {token}", "Accept": "application/json",
                })
                if response is None and IGDB_API_KEY:
                    response = await client.get(f"{IGDB_BASE_URL}/{endpoint}")
                response.raise_for_status()
            except httpx.TimeoutException as exc:
                raise IGDBError("IGDB request timeout", 504) from exc
            except httpx.HTTPStatusError as exc:
                status = 404 if exc.response.status_code == 404 else 502
                raise IGDBError(f"IGDB HTTP error: {exc.response.status_code}", status) from exc
            except httpx.HTTPError as exc:
                raise IGDBError("IGDB connection error") from exc
    data = response.json()
    if isinstance(data, dict):
        data = data.get("results", [data] if data.get("id") else [])
    return data if isinstance(data, list) else []


def _igdb_image_url(value: Any, size: str) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    url = f"https:{value}" if value.startswith("//") else value
    return re.sub(r"t_[^/]+(?=/)", size, url)


def normalize_igdb_game(game: dict[str, Any]) -> dict[str, Any]:
    cover = _igdb_image_url((game.get("cover") or {}).get("url"), "t_cover_big")
    artwork = next(
        (
            item.get("url")
            for item in game.get("artworks") or []
            if isinstance(item, dict) and isinstance(item.get("url"), str)
        ),
        None,
    )
    hero_image = _igdb_image_url(artwork, "t_1080p") or _igdb_image_url(
        (game.get("cover") or {}).get("url"), "t_720p"
    )
    release = game.get("first_release_date")
    released = datetime.fromtimestamp(release, timezone.utc).date().isoformat() if isinstance(release, (int, float)) else None
    steam_appid = next((int(item["uid"]) for item in game.get("external_games", [])
                        if item.get("category") == 1 and str(item.get("uid", "")).isdigit()), None)
    return {
        "id": game.get("id"), "name": game.get("name"), "released": released,
        "background_image": cover, "hero_image": hero_image, "description_raw": game.get("summary"),
        "rating": game.get("rating") if game.get("rating") is not None else game.get("total_rating"), "genres": [x["name"] for x in game.get("genres", []) if x.get("name")],
        "platforms": [x.get("name") or (x.get("platform") or {}).get("name") for x in game.get("platforms", []) if x.get("name") or (x.get("platform") or {}).get("name")],
        "game_type": (game.get("game_type") or {}).get("type") if isinstance(game.get("game_type"), dict) else game.get("game_type"),
        "game_modes": [x["name"] for x in game.get("game_modes", []) if x.get("name")],
        "keywords": [x["name"] for x in game.get("keywords", []) if x.get("name")],
        "steam_appid": steam_appid,
    }


_FIELDS = "fields id,name,first_release_date,summary,rating,total_rating,cover.url,artworks.url,genres.name,platforms.name,game_type.type,game_modes.name,keywords.name,external_games.category,external_games.uid;"


async def fetch_igdb_games(
    query: str,
    page: int = 1,
    filters: CatalogSearchFilters = CatalogSearchFilters(),
) -> dict[str, Any]:
    offset = max(page - 1, 0) * 20
    safe_query = query.replace('"', "").replace("\\", "")
    predicates: list[str] = []
    platform_ids = tuple(id for platform in filters.platforms for id in _PLATFORM_IDS[platform])
    if platform_ids:
        predicates.append(f"platforms = ({','.join(map(str, platform_ids))})")
    for feature in filters.features:
        predicates.append(f"game_modes = {_GAME_MODE_IDS[feature]}")
    for genre in filters.genres:
        if genre == "roguelike":
            predicates.append('keywords.name = "Roguelike"')
        else:
            predicates.append(f"genres = {_GENRE_IDS[genre]}")
    where = f" where {' & '.join(predicates)};" if predicates else ""
    search = f' search "{safe_query}";' if safe_query else ""
    sort = " sort total_rating_count desc;" if not safe_query else ""
    games = await _query("games", f"{_FIELDS}{search}{where}{sort} limit 20; offset {offset};")
    return {"results": [normalize_igdb_game(game) for game in games]}


async def fetch_igdb_games_batch(titles: list[str]) -> dict[str, list[dict[str, Any]]]:
    """Resolve up to ten distinct titles in one official IGDB multiquery call."""
    unique_titles = list(dict.fromkeys(title for title in titles if title))[:10]
    if not unique_titles:
        return {}
    queries = []
    aliases: dict[str, str] = {}
    for index, title in enumerate(unique_titles):
        alias = f"psn_{index}"
        aliases[alias] = title
        safe_title = title.replace('"', "").replace("\\", "")
        queries.append(f'query games "{alias}" {{ {_FIELDS} search "{safe_title}"; limit 20; }};')
    responses = await _query("multiquery", "".join(queries))
    results: dict[str, list[dict[str, Any]]] = {}
    for response in responses:
        if not isinstance(response, dict):
            continue
        title = aliases.get(str(response.get("name", "")))
        values = response.get("result")
        if title and isinstance(values, list):
            results[title] = [normalize_igdb_game(game) for game in values if isinstance(game, dict)]
    return results


async def fetch_igdb_game_detail(igdb_id: int) -> dict[str, Any]:
    games = await _query("games", f"{_FIELDS} where id = {igdb_id}; limit 1;")
    if not games:
        raise IGDBError("IGDB game not found", 404)
    return normalize_igdb_game(games[0])


async def fetch_igdb_games_by_ids(igdb_ids: list[int]) -> dict[int, dict[str, Any]]:
    """Resolve catalog records in bounded IGDB queries rather than per-game requests."""
    unique_ids = list(dict.fromkeys(value for value in igdb_ids if isinstance(value, int) and value > 0))
    results: dict[int, dict[str, Any]] = {}
    for offset in range(0, len(unique_ids), 100):
        batch = unique_ids[offset:offset + 100]
        games = await _query("games", f"{_FIELDS} where id = ({','.join(map(str, batch))}); limit {len(batch)};")
        for game in games:
            normalized = normalize_igdb_game(game)
            if isinstance(normalized.get("id"), int):
                results[normalized["id"]] = normalized
    return results


async def fetch_igdb_games_by_steam_appids(appids: list[int]) -> dict[int, dict[str, Any]]:
    """Resolve Steam app IDs in bounded catalog queries for library matching."""
    unique_appids = list(dict.fromkeys(value for value in appids if isinstance(value, int) and value > 0))
    results: dict[int, dict[str, Any]] = {}
    for offset in range(0, len(unique_appids), 100):
        batch = unique_appids[offset:offset + 100]
        external_ids = ",".join(f'"{appid}"' for appid in batch)
        games = await _query(
            "games",
            f"{_FIELDS} where external_games.uid = ({external_ids}) & external_games.category = 1; limit 100;",
        )
        for game in games:
            normalized = normalize_igdb_game(game)
            appid = normalized.get("steam_appid")
            if isinstance(appid, int) and appid in batch:
                results[appid] = normalized
    return results


async def fetch_igdb_similar_games(igdb_id: int, *, limit: int = 12) -> list[dict[str, Any]]:
    """Return only catalog records IGDB itself marks as similar to this game."""
    if igdb_id < 1:
        return []
    source_games = await _query("games", f"fields similar_games; where id = {igdb_id}; limit 1;")
    if not source_games:
        raise IGDBError("IGDB game not found", 404)
    similar_ids = [
        value if isinstance(value, int) else value.get("id")
        for value in source_games[0].get("similar_games") or []
        if isinstance(value, int) or isinstance(value, dict)
    ]
    unique_ids = list(dict.fromkeys(value for value in similar_ids if isinstance(value, int) and value > 0))[:limit]
    resolved = await asyncio.gather(
        *(fetch_igdb_game_detail(candidate_id) for candidate_id in unique_ids),
        return_exceptions=True,
    )
    games: list[dict[str, Any]] = []
    for result in resolved:
        if isinstance(result, IGDBError):
            if result.status_code == 404:
                continue
            raise result
        if isinstance(result, Exception):
            raise result
        games.append(result)
    return games


async def fetch_igdb_related_fallback_games(source: dict[str, Any], *, limit: int = 12) -> list[dict[str, Any]]:
    """Return catalogue candidates when IGDB has no explicit similar-game links."""
    genre_names = {str(value).casefold() for value in source.get("genres") or []}
    platform_names = {str(value).casefold() for value in source.get("platforms") or []}
    genres = tuple(name for name in _GENRE_IDS if name in genre_names)
    platforms = ("pc",) if any("pc" in name or "windows" in name for name in platform_names) else ()
    results = await fetch_igdb_games(
        "",
        filters=CatalogSearchFilters(platforms=platforms, genres=genres),
    )
    return results["results"][:limit]


async def fetch_igdb_game_by_steam_appid(appid: int) -> dict[str, Any] | None:
    if appid < 1:
        return None
    games = await _query("games", f'{_FIELDS} where external_games.uid = "{appid}" & external_games.category = 1; limit 1;')
    return normalize_igdb_game(games[0]) if games else None


async def fetch_igdb_game_stores(igdb_id: int) -> list[str]:
    games = await _query("games", f"fields websites.url; where id = {igdb_id}; limit 1;")
    if not games:
        return []
    websites = games[0].get("websites") or games
    return [str(item.get("url")) for item in websites if item.get("url")]


async def fetch_igdb_upcoming_games(page: int = 1, page_size: int = 8) -> dict[str, Any]:
    now = int(datetime.now(timezone.utc).timestamp())
    games = await _query("games", f"{_FIELDS} where first_release_date > {now}; sort first_release_date asc; limit {min(max(page_size, 1), 20)}; offset {(page - 1) * page_size};")
    return {"results": [normalize_igdb_game(game) for game in games]}


async def fetch_igdb_trending_games(page: int = 1, page_size: int = 8) -> dict[str, Any]:
    games = await _query("games", f"{_FIELDS} where total_rating_count > 0; sort total_rating_count desc; limit {min(max(page_size, 1), 20)}; offset {(page - 1) * page_size};")
    return {"results": [normalize_igdb_game(game) for game in games]}
