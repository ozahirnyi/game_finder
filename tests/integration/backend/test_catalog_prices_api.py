from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.integrations.rawg import RAWGError


pytestmark = pytest.mark.integration


async def run_cached(_key, _ttl, fetch):
    return await fetch()


def test_search_games_normalizes_query_and_uses_cache_boundary(api_client, app_main, monkeypatch):
    fetch_rawg = AsyncMock(return_value={"results": [{"id": 1, "name": "Hades"}]})
    cached = AsyncMock(side_effect=run_cached)
    monkeypatch.setattr(app_main, "fetch_rawg_games", fetch_rawg)
    monkeypatch.setattr(app_main, "get_json_cached", cached)

    response = api_client.get("/search/games", params={"q": "  HADES  ", "page": 2})

    assert response.status_code == 200
    assert response.json()["results"][0]["name"] == "Hades"
    fetch_rawg.assert_awaited_once_with("hades", page=2)
    assert cached.await_count == 1


@pytest.mark.parametrize("params", [{"q": "   "}, {"q": "hades", "page": 0}])
def test_search_games_rejects_invalid_query_or_page(api_client, params):
    response = api_client.get("/search/games", params=params)
    assert response.status_code == 400


def test_search_games_maps_rawg_error(api_client, app_main, monkeypatch):
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=RAWGError("upstream", 503)))

    response = api_client.get("/search/games", params={"q": "hades"})

    assert response.status_code == 503
    assert response.json()["detail"] == "upstream"


def test_catalog_detail_normalizes_response(api_client, app_main, monkeypatch):
    detail = {
        "id": 42,
        "name": "Hades",
        "released": "2020-09-17",
        "background_image": "https://img.test/hades.jpg",
        "description_raw": "A dungeon crawler",
        "rating": 4.5,
        "genres": ["Action"],
        "platforms": ["PC"],
    }
    fetch = AsyncMock(return_value=detail)
    monkeypatch.setattr(app_main, "fetch_rawg_game_detail", fetch)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/catalog/games/42")

    assert response.status_code == 200
    assert response.json() == detail
    fetch.assert_awaited_once_with(42)


@pytest.mark.parametrize("path", ["/catalog/games/0", "/catalog/games/-1"])
def test_catalog_detail_rejects_invalid_id(api_client, path):
    assert api_client.get(path).status_code == 400


@pytest.mark.parametrize("path, fetch_name, args", [
    ("/catalog/upcoming-games", "fetch_rawg_upcoming_games", {"page": 2, "page_size": 5}),
    ("/catalog/trending-games", "fetch_rawg_trending_games", {"page": 3, "page_size": 6}),
])
def test_catalog_lists_validate_pagination_and_call_fetcher(
    api_client, app_main, monkeypatch, path, fetch_name, args
):
    fetch = AsyncMock(return_value={"results": [{"id": 7, "name": "Game"}]})
    monkeypatch.setattr(app_main, fetch_name, fetch)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get(path, params=args)

    assert response.status_code == 200
    fetch.assert_awaited_once_with(**args)


@pytest.mark.parametrize("params", [{"page": 0}, {"page_size": 0}, {"page_size": 21}])
def test_catalog_lists_reject_invalid_pagination(api_client, params):
    assert api_client.get("/catalog/upcoming-games", params=params).status_code == 400


def test_price_history_uses_itad_success(api_client, app_main, monkeypatch):
    detail = AsyncMock(return_value={"name": "Hades"})
    history = {"itad_id": "itad-1", "title": "Hades", "deals": []}
    fetch_history = AsyncMock(return_value=history)
    fallback = AsyncMock()
    monkeypatch.setattr(app_main, "fetch_rawg_game_detail", detail)
    monkeypatch.setattr(app_main, "fetch_game_price_history", fetch_history)
    monkeypatch.setattr(app_main, "fetch_steam_store_game_price", fallback)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/42", params={"country": " ua "})

    assert response.status_code == 200
    assert response.json()["itad_id"] == history["itad_id"]
    assert response.json()["title"] == history["title"]
    assert response.json()["deals"] == []
    fetch_history.assert_awaited_once_with("Hades", country="UA")
    fallback.assert_not_awaited()


def test_price_history_falls_back_to_steam_on_itad_502(api_client, app_main, monkeypatch):
    monkeypatch.setattr(app_main, "fetch_rawg_game_detail", AsyncMock(return_value={"name": "Hades"}))
    monkeypatch.setattr(app_main, "fetch_game_price_history", AsyncMock(side_effect=HTTPException(502, "ITAD down")))
    steam = {"itad_id": "steam:42", "title": "Hades", "deals": []}
    fallback = AsyncMock(return_value=steam)
    monkeypatch.setattr(app_main, "fetch_steam_store_game_price", fallback)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/42")

    assert response.status_code == 200
    assert response.json()["itad_id"] == steam["itad_id"]
    assert response.json()["title"] == steam["title"]
    assert response.json()["deals"] == []
    fallback.assert_awaited_once_with("Hades", country="US")


def test_homepage_deals_enriches_and_normalizes_payload(api_client, app_main, monkeypatch):
    deal = {"name": "Hades", "background_image": None, "url": "https://deal.test", "current": None, "history_low_all": None}
    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(return_value=[deal]))
    rawg = AsyncMock(return_value={"results": [{"id": 42, "name": "Hades", "released": "2020-09-17", "background_image": "https://img.test"}]})
    monkeypatch.setattr(app_main, "fetch_rawg_games", rawg)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/deals", params={"country": "ua", "page_size": 1})

    assert response.status_code == 200
    assert response.json()["results"][0]["id"] == 42
    rawg.assert_awaited_once_with("Hades", page=1)


def test_genre_deals_uses_authenticated_favorite_genres(api_client, app_main, monkeypatch, user_factory, auth_as):
    user = user_factory(email="genre-deals@example.com", favorite_genres=["RPG"], steam_country_code="UA")
    auth_as(user)
    candidate = {"steam_appid": 42, "name": "Hades", "background_image": None, "url": "https://deal.test", "current": None, "history_low_all": None}
    monkeypatch.setattr(app_main, "fetch_steam_store_deal_candidates", AsyncMock(return_value={"candidates": [candidate], "popular": [candidate]}))
    rawg = AsyncMock(return_value={"results": [{"id": 42, "name": "Hades", "genres": ["RPG"]}]})
    monkeypatch.setattr(app_main, "fetch_rawg_games", rawg)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/genre-deals")

    assert response.status_code == 200
    assert response.json()["sections"][0]["genre"] == "RPG"
    assert response.json()["sections"][0]["results"][0]["id"] == 42
    rawg.assert_awaited_with("Hades", 1)
