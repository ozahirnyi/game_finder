import asyncio
from unittest.mock import AsyncMock, Mock

from app.integrations import rawg


def test_rawg_search_preserves_platform_names(monkeypatch):
    async def exercise():
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"results": [{
            "id": 8, "name": "Hades II", "released": "2025-09-25",
            "background_image": "cover.jpg",
            "platforms": [{"platform": {"name": "PC"}}, {"platform": {"name": "PlayStation 5"}}],
        }]}
        client = AsyncMock()
        client.get.return_value = response
        context = AsyncMock()
        context.__aenter__.return_value = client
        monkeypatch.setattr(rawg.httpx, "AsyncClient", Mock(return_value=context))

        payload = await rawg.fetch_rawg_games("Hades II")

        assert payload["results"][0]["platforms"] == ["PC", "PlayStation 5"]

    asyncio.run(exercise())
