import asyncio
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException
from jose import JWTError, jwt

from app.auth import ALGORITHM, SECRET_KEY


STEAM_OPENID_URL = "https://steamcommunity.com/openid/login"
STEAM_ID_PATTERN = re.compile(r"/id/(\d+)$")
STEAM_STATE_EXPIRE_MINUTES = 10


def get_steam_api_key() -> str:
    return os.getenv("STEAM_API_KEY") or os.getenv("STEAM_WEB_API_KEY") or ""


def create_steam_state(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "typ": "steam_link",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=STEAM_STATE_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_steam_state(state: str) -> str:
    try:
        payload = jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid Steam link state")
    if payload.get("typ") != "steam_link" or not isinstance(payload.get("sub"), str):
        raise HTTPException(status_code=400, detail="Invalid Steam link state")
    return payload["sub"]


def build_steam_login_url(return_to: str, realm: str) -> str:
    params = {
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "checkid_setup",
        "openid.return_to": return_to,
        "openid.realm": realm,
        "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    }
    return f"{STEAM_OPENID_URL}?{urlencode(params)}"


def extract_steam_id(claimed_id: str | None) -> str:
    if not claimed_id:
        raise HTTPException(status_code=400, detail="Steam did not return an account id")
    match = STEAM_ID_PATTERN.search(claimed_id)
    if not match:
        raise HTTPException(status_code=400, detail="Steam returned an invalid account id")
    return match.group(1)


async def verify_steam_openid(query_params: dict[str, str]) -> str:
    payload = {key: value for key, value in query_params.items() if key.startswith("openid.")}
    if not payload:
        raise HTTPException(status_code=400, detail="Missing Steam OpenID response")
    payload["openid.mode"] = "check_authentication"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(STEAM_OPENID_URL, data=payload)
            response.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not verify Steam login")

    if "is_valid:true" not in response.text:
        raise HTTPException(status_code=400, detail="Steam login verification failed")
    return extract_steam_id(query_params.get("openid.claimed_id"))


def normalize_country_code(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    code = value.strip().upper()
    if len(code) != 2 or not code.isalpha():
        return None
    return code


async def fetch_steam_profile(steam_id: str) -> dict[str, str | None]:
    api_key = get_steam_api_key()
    if not api_key:
        return {"persona_name": None, "avatar": None, "country_code": None}

    params = {"key": api_key, "steamids": steam_id}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/",
                params=params,
            )
            response.raise_for_status()
    except httpx.HTTPError:
        return {"persona_name": None, "avatar": None, "country_code": None}

    players = response.json().get("response", {}).get("players", [])
    player = players[0] if players else {}
    return {
        "persona_name": player.get("personaname"),
        "avatar": player.get("avatarfull") or player.get("avatarmedium") or player.get("avatar"),
        "country_code": normalize_country_code(player.get("loccountrycode")),
    }


async def fetch_steam_profiles(steam_ids: list[str]) -> dict[str, dict[str, str | None]]:
    api_key = get_steam_api_key()
    if not api_key or not steam_ids:
        return {}

    profiles: dict[str, dict[str, str | None]] = {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for index in range(0, len(steam_ids), 100):
                batch = steam_ids[index : index + 100]
                response = await client.get(
                    "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/",
                    params={"key": api_key, "steamids": ",".join(batch)},
                )
                response.raise_for_status()
                for player in response.json().get("response", {}).get("players", []):
                    steam_id = str(player.get("steamid") or "")
                    if steam_id:
                        profiles[steam_id] = {
                            "persona_name": player.get("personaname"),
                            "avatar": player.get("avatarfull") or player.get("avatarmedium") or player.get("avatar"),
                            "country_code": normalize_country_code(player.get("loccountrycode")),
                            "current_game": player.get("gameextrainfo"),
                        }
    except httpx.HTTPError:
        return profiles
    return profiles


async def fetch_steam_friends(steam_id: str, limit: int = 24) -> list[dict[str, Any]]:
    api_key = get_steam_api_key()
    if not api_key:
        raise HTTPException(status_code=503, detail="STEAM_API_KEY is not configured")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.steampowered.com/ISteamUser/GetFriendList/v0001/",
                params={"key": api_key, "steamid": steam_id, "relationship": "friend"},
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {401, 403}:
            raise HTTPException(status_code=409, detail="Steam friends list is private or unavailable")
        raise HTTPException(status_code=502, detail="Steam friends request failed")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Steam friends request failed")

    friends = response.json().get("friendslist", {}).get("friends")
    if friends is None:
        raise HTTPException(status_code=409, detail="Steam friends list is private or unavailable")

    sorted_friends = sorted(friends, key=lambda item: item.get("friend_since") or 0, reverse=True)
    selected = sorted_friends[: max(1, min(limit, 50))]
    profile_map = await fetch_steam_profiles([str(friend.get("steamid")) for friend in selected if friend.get("steamid")])

    return [
        {
            "steam_id": str(friend.get("steamid")),
            "persona_name": profile_map.get(str(friend.get("steamid")), {}).get("persona_name"),
            "avatar": profile_map.get(str(friend.get("steamid")), {}).get("avatar"),
            "current_game": profile_map.get(str(friend.get("steamid")), {}).get("current_game"),
            "friend_since": friend.get("friend_since"),
        }
        for friend in selected
        if friend.get("steamid")
    ]


async def fetch_owned_games(steam_id: str) -> list[dict[str, Any]]:
    api_key = get_steam_api_key()
    if not api_key:
        raise HTTPException(status_code=503, detail="STEAM_API_KEY is not configured")

    params = {
        "key": api_key,
        "steamid": steam_id,
        "include_appinfo": 1,
        "include_played_free_games": 1,
        "format": "json",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/",
                params=params,
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {401, 403}:
            raise HTTPException(status_code=502, detail="Steam rejected the API key")
        raise HTTPException(status_code=502, detail="Steam library request failed")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Steam library request failed")

    games = response.json().get("response", {}).get("games")
    if games is None:
        raise HTTPException(
            status_code=409,
            detail="Steam library is private or unavailable. Make Steam game details public and try again.",
        )

    normalized = [
        {
            "appid": game.get("appid"),
            "name": game.get("name") or f"Steam app {game.get('appid')}",
            "playtime_forever": game.get("playtime_forever", 0),
            "playtime_2weeks": game.get("playtime_2weeks", 0),
            "img_icon_url": game.get("img_icon_url"),
        }
        for game in games
        if game.get("appid") is not None
    ]
    return sorted(normalized, key=lambda item: item["playtime_forever"], reverse=True)


async def fetch_steam_social_contacts(steam_id: str, limit: int = 24) -> list[dict[str, Any]]:
    """Fetch a small, display-only Steam contact snapshot; never changes site friendships."""
    friends = await fetch_steam_friends(steam_id, limit=max(1, min(limit, 50)))
    semaphore = asyncio.Semaphore(5)

    async def enrich(friend: dict[str, Any]) -> dict[str, Any]:
        async with semaphore:
            recent_games: list[str] = []
            try:
                api_key = get_steam_api_key()
                if api_key:
                    async with httpx.AsyncClient(timeout=8.0) as client:
                        response = await client.get(
                            "https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/",
                            params={"key": api_key, "steamid": friend["steam_id"], "format": "json"},
                        )
                        response.raise_for_status()
                        recent_games = [str(game.get("name")) for game in response.json().get("response", {}).get("games", [])[:5] if game.get("name")]
            except httpx.HTTPError:
                pass
            return {**friend, "recent_games": recent_games}

    return await asyncio.gather(*(enrich(friend) for friend in friends))
