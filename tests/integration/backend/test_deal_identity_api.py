from unittest.mock import AsyncMock

import pytest


@pytest.mark.parametrize("candidate", [
    {"id": 42, "name": "Portal 2"},
    {"id": 42, "name": "Portal 2", "steam_appid": 999},
])
def test_home_deal_title_fallback_requires_verified_steam_identity(api_client, app_main, monkeypatch, candidate):
    async def cache(_key, _ttl, fetch, **_kwargs):
        return await fetch()
    monkeypatch.setattr(app_main, "get_json_cached", cache)
    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(return_value=[{"steam_appid": 620, "name": "Portal 2"}]))
    monkeypatch.setattr(app_main, "fetch_igdb_game_by_steam_appid", AsyncMock(return_value=None))
    monkeypatch.setattr(app_main, "fetch_igdb_games", AsyncMock(return_value={"results": [candidate]}))
    response = api_client.get("/prices/deals")
    assert response.status_code == 200
    assert response.json()["results"][0]["id"] is None
    assert response.json()["results"][0]["steam_appid"] == 620
