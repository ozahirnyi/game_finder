import os
import asyncio
import httpx
from datetime import date, timedelta
from typing import Any


RAWG_BASE_URL = "https://api.rawg.io/api"
RAWG_API_KEY = os.getenv("RAWG_API_KEY")


def get_float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    try:
        return float(value)
    except ValueError:
        return default


RAWG_TIMEOUT_SECONDS = get_float_env("RAWG_TIMEOUT_SECONDS", 12.0)


class RAWGError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        self.status_code = status_code
        super().__init__(message)


async def fetch_rawg_games(query: str, page: int = 1) -> dict[str, Any]:
    if not RAWG_API_KEY:
        raise RAWGError("RAWG_API_KEY is missing")
    url = f"{RAWG_BASE_URL}/games"
    params = {
        "key": RAWG_API_KEY,
        "search": query,
        "page": page,
    }
    timeout = httpx.Timeout(RAWG_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
        except httpx.TimeoutException as e:
            raise RAWGError("RAWG request timeout",status_code=504) from e
        except httpx.RequestError as e:
            raise RAWGError("RAWG connection error",status_code=502) from e
        except httpx.HTTPStatusError as e:
            raise RAWGError(f"RAWG HTTP error: {e.response.status_code}",status_code=502) from e
    data = response.json()
    return {
        "results": [
            {
                "id": game.get("id"),
                "name": game.get("name"),
                "released": game.get("released"),
                "background_image": game.get("background_image"),
            }
            for game in data.get("results", [])
        ]
    }


async def fetch_rawg_upcoming_games(page: int = 1, page_size: int = 8) -> dict[str, Any]:
    if not RAWG_API_KEY:
        raise RAWGError("RAWG_API_KEY is missing")
    today = date.today()
    future = today + timedelta(days=365)
    url = f"{RAWG_BASE_URL}/games"
    params = {
        "key": RAWG_API_KEY,
        "dates": f"{today.isoformat()},{future.isoformat()}",
        "ordering": "-added",
        "page": page,
        "page_size": min(max(page_size, 1), 20),
    }
    timeout = httpx.Timeout(RAWG_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
        except httpx.TimeoutException as e:
            raise RAWGError("RAWG request timeout", status_code=504) from e
        except httpx.RequestError as e:
            raise RAWGError("RAWG connection error", status_code=502) from e
        except httpx.HTTPStatusError as e:
            raise RAWGError(f"RAWG HTTP error: {e.response.status_code}", status_code=502) from e
    data = response.json()
    return {
        "results": [
            {
                "id": game.get("id"),
                "name": game.get("name"),
                "released": game.get("released"),
                "background_image": game.get("background_image"),
            }
            for game in data.get("results", [])
        ]
    }


async def fetch_rawg_trending_games(page: int = 1, page_size: int = 8) -> dict[str, Any]:
    if not RAWG_API_KEY:
        raise RAWGError("RAWG_API_KEY is missing")
    today = date.today()
    week_start = today - timedelta(days=7)
    url = f"{RAWG_BASE_URL}/games"
    params = {
        "key": RAWG_API_KEY,
        "dates": f"{week_start.isoformat()},{today.isoformat()}",
        "ordering": "-added",
        "page": page,
        "page_size": min(max(page_size, 1), 20),
    }
    timeout = httpx.Timeout(RAWG_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
        except httpx.TimeoutException as e:
            raise RAWGError("RAWG request timeout", status_code=504) from e
        except httpx.RequestError as e:
            raise RAWGError("RAWG connection error", status_code=502) from e
        except httpx.HTTPStatusError as e:
            raise RAWGError(f"RAWG HTTP error: {e.response.status_code}", status_code=502) from e
    data = response.json()
    return {
        "results": [
            {
                "id": game.get("id"),
                "name": game.get("name"),
                "released": game.get("released"),
                "background_image": game.get("background_image"),
            }
            for game in data.get("results", [])
        ]
    }


async def fetch_rawg_game_detail(rawg_id: int) -> dict[str, Any]:
    if not RAWG_API_KEY:
        raise RAWGError("RAWG_API_KEY is missing")
    url = f"{RAWG_BASE_URL}/games/{rawg_id}"
    params = {"key": RAWG_API_KEY}
    timeout = httpx.Timeout(RAWG_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(2):
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                break
            except httpx.TimeoutException as e:
                if attempt == 1:
                    raise RAWGError("RAWG request timeout", status_code=504) from e
                await asyncio.sleep(0.3)
            except httpx.RequestError as e:
                if attempt == 1:
                    raise RAWGError("RAWG connection error", status_code=502) from e
                await asyncio.sleep(0.3)
            except httpx.HTTPStatusError as e:
                status = 404 if e.response.status_code == 404 else 502
                raise RAWGError(f"RAWG HTTP error: {e.response.status_code}", status_code=status) from e
    data = response.json()
    return {
        "id": data.get("id"),
        "name": data.get("name"),
        "released": data.get("released"),
        "background_image": data.get("background_image"),
        "description_raw": data.get("description_raw"),
        "rating": data.get("rating"),
        "genres": [genre.get("name") for genre in data.get("genres", []) if genre.get("name")],
        "platforms": [
            item.get("platform", {}).get("name")
            for item in data.get("platforms", [])
            if item.get("platform", {}).get("name")
        ],
    }
