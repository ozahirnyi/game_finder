import os
import httpx
from typing import Any


RAWG_BASE_URL = "https://api.rawg.io/api"
RAWG_API_KEY = os.getenv("RAWG_API_KEY")


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
    timeout = httpx.Timeout(5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
        except httpx.TimeoutException as e:
            raise RAWGError("RAWG request timeout",status_code=504) from e
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


async def fetch(query: str, page: int = 1) -> dict[str, Any]:
    return await fetch_rawg_games(query, page=page)