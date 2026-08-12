from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

pytestmark = pytest.mark.integration


async def run_cached(_key, _ttl, fetch):
    return await fetch()


def test_search_games_accepts_structured_discovery_filters(api_client, app_main, monkeypatch):
    captured = {}

    async def fetch_igdb(query, page=1, filters=None):
        captured["query"] = query
        captured["filters"] = filters
        return {"results": []}

    monkeypatch.setattr(app_main, "fetch_igdb_games", fetch_igdb)
    monkeypatch.setattr(app_main, "get_json_cached", run_cached)

    response = api_client.get("/search/games", params=[("platform", "pc"), ("feature", "co_op")])

    assert response.status_code == 200
    assert captured["query"] == ""
    assert captured["filters"].platforms == ("pc",)
    assert captured["filters"].features == ("co_op",)


def test_search_games_combines_text_and_platform_filter(api_client, app_main, monkeypatch):
    captured = {}

    async def fetch_igdb(query, page=1, filters=None):
        captured["query"] = query
        captured["filters"] = filters
        return {"results": []}

    monkeypatch.setattr(app_main, "fetch_igdb_games", fetch_igdb)
    monkeypatch.setattr(app_main, "get_json_cached", run_cached)

    response = api_client.get("/search/games", params={"q": "Hades", "platform": "ps5"})

    assert response.status_code == 200
    assert captured["query"] == "hades"
    assert captured["filters"].platforms == ("ps5",)


def test_sale_discovery_returns_only_confirmed_current_deals_matching_all_filters(
    api_client, app_main, monkeypatch
):
    monkeypatch.setattr(
        app_main,
        "fetch_steam_store_deals",
        AsyncMock(return_value=[
            {"steam_appid": 1, "name": "Hades", "current": {"cut": 50}},
            {"steam_appid": 2, "name": "Not on PS5", "current": {"cut": 40}},
            {"steam_appid": 3, "name": "No catalog mapping", "current": {"cut": 25}},
        ]),
    )

    async def fetch_catalog(steam_appid):
        return {
            1: {"id": 30, "name": "Hades", "platforms": ["PlayStation 5"]},
            2: {"id": 31, "name": "Not on PS5", "platforms": ["Xbox Series X|S"]},
            3: None,
        }[steam_appid]

    monkeypatch.setattr(app_main, "fetch_igdb_game_by_steam_appid", fetch_catalog)
    monkeypatch.setattr(app_main, "get_json_cached", run_cached)

    response = api_client.get(
        "/search/games",
        params=[("q", "hades"), ("on_sale", "true"), ("platform", "ps5")],
    )

    assert response.status_code == 200
    assert [(item["id"], item["name"], item["steam_appid"]) for item in response.json()["results"]] == [
        (30, "Hades", 1),
    ]


def test_sale_discovery_excludes_deals_without_a_current_discount(api_client, app_main, monkeypatch):
    monkeypatch.setattr(
        app_main,
        "fetch_steam_store_deals",
        AsyncMock(return_value=[{"steam_appid": 1, "name": "Hades", "current": {"cut": 0}}]),
    )
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_game_by_steam_appid",
        AsyncMock(return_value={"id": 30, "name": "Hades", "platforms": ["Windows"]}),
    )
    monkeypatch.setattr(app_main, "get_json_cached", run_cached)

    response = api_client.get("/search/games", params={"on_sale": "true"})

    assert response.status_code == 200
    assert response.json()["results"] == []


def test_sale_discovery_falls_back_to_an_exact_title_catalog_match(api_client, app_main, monkeypatch):
    monkeypatch.setattr(
        app_main,
        "fetch_steam_store_deals",
        AsyncMock(return_value=[{"steam_appid": 2358720, "name": "Black Myth: Wukong", "current": {"cut": 20}}]),
    )
    monkeypatch.setattr(app_main, "fetch_igdb_game_by_steam_appid", AsyncMock(return_value=None))
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_games",
        AsyncMock(return_value={"results": [
            {"id": 333, "name": "Black Myth: Wukong", "platforms": ["PC (Microsoft Windows)"]},
        ]}),
    )
    monkeypatch.setattr(app_main, "get_json_cached", run_cached)

    response = api_client.get("/search/games", params={"on_sale": "true"})

    assert response.status_code == 200
    assert [(item["id"], item["name"], item["steam_appid"]) for item in response.json()["results"]] == [
        (333, "Black Myth: Wukong", 2358720),
    ]


def test_search_games_normalizes_query_and_uses_cache_boundary(api_client, app_main, monkeypatch):
    fetch_igdb = AsyncMock(return_value={"results": [{
        "id": 999,
        "name": "Hades",
        "released": "2020-09-17",
        "background_image": "https://img.test/hades.jpg",
        "steam_appid": 1145360,
    }]})
    cached = AsyncMock(side_effect=run_cached)
    monkeypatch.setattr(app_main, "fetch_igdb_games", fetch_igdb)
    monkeypatch.setattr(app_main, "get_json_cached", cached)

    response = api_client.get("/search/games", params={"q": "  HADES  ", "page": 2})

    assert response.status_code == 200
    assert response.json()["results"][0]["name"] == "Hades"
    assert response.json()["results"][0]["id"] == 999
    assert "source" not in response.json()["results"][0]
    fetch_igdb.assert_awaited_once_with("hades", page=2, filters=app_main.CatalogSearchFilters())
    assert cached.await_count == 1
    assert "igdb_search_v4" in cached.await_args.args[0]


@pytest.mark.parametrize("params", [{"q": "hades", "page": 0}, {"platform": "unsupported"}])
def test_search_games_rejects_invalid_query_or_page(api_client, params):
    response = api_client.get("/search/games", params=params)
    assert response.status_code == 400


def test_search_games_maps_igdb_error(api_client, app_main, monkeypatch):
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_games",
        AsyncMock(side_effect=app_main.IGDBError("IGDB request failed", 502)),
    )
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/search/games", params={"q": "hades"})

    assert response.status_code == 502
    assert response.json()["detail"] == "IGDB request failed"


def test_search_ranks_exact_title_before_partial_matches(api_client, app_main, monkeypatch):
    async def cached(_key, _ttl, fetch):
        return await fetch()

    fetch_igdb = AsyncMock(return_value={"results": [
        {"id": 1, "name": "Portal 2: In Motion", "rating": None},
        {"id": 2, "name": "Portal Maze 2", "rating": 99},
        {"id": 3, "name": "Portal 2", "rating": 95},
    ]})
    monkeypatch.setattr(app_main, "fetch_igdb_games", fetch_igdb)
    monkeypatch.setattr(app_main, "get_json_cached", cached)

    response = api_client.get("/search/games", params={"q": "portal 2"})

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["results"]] == [3, 1, 2]


def test_search_expands_known_game_aliases(api_client, app_main, monkeypatch):
    async def cached(_key, _ttl, fetch):
        return await fetch()

    fetch_igdb = AsyncMock(return_value={"results": [{"id": 730, "name": "Counter-Strike 2"}]})
    monkeypatch.setattr(app_main, "fetch_igdb_games", fetch_igdb)
    monkeypatch.setattr(app_main, "get_json_cached", cached)

    response = api_client.get("/search/games", params={"q": "cs2"})

    assert response.status_code == 200
    fetch_igdb.assert_awaited_once_with("counter-strike 2", page=1, filters=app_main.CatalogSearchFilters())


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
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", fetch)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/catalog/games/42")

    assert response.status_code == 200
    assert response.json() == detail
    fetch.assert_awaited_once_with(42)


@pytest.mark.parametrize("path", ["/catalog/games/0", "/catalog/games/-1"])
def test_catalog_detail_rejects_invalid_id(api_client, path):
    assert api_client.get(path).status_code == 400


@pytest.mark.parametrize("path, fetch_name, args", [
    ("/catalog/upcoming-games", "fetch_igdb_upcoming_games", {"page": 2, "page_size": 5}),
    ("/catalog/trending-games", "fetch_igdb_trending_games", {"page": 3, "page_size": 6}),
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
    detail = AsyncMock(return_value={"name": "Hades", "steam_appid": 1145350})
    history = {"itad_id": "itad-1", "title": "Hades", "deals": []}
    fetch_history = AsyncMock(return_value=history)
    fallback = AsyncMock()
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", detail)
    monkeypatch.setattr(app_main, "fetch_game_price_history", fetch_history)
    monkeypatch.setattr(app_main, "fetch_steam_store_game_price", fallback)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/42", params={"country": " ua "})

    assert response.status_code == 200
    assert response.json()["itad_id"] == history["itad_id"]
    assert response.json()["title"] == history["title"]
    assert response.json()["deals"] == []
    fetch_history.assert_awaited_once_with("1145350", country="UA", steam_appid=1145350)
    fallback.assert_not_awaited()


def test_price_history_falls_back_to_steam_on_itad_502(api_client, app_main, monkeypatch):
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", AsyncMock(return_value={"name": "Hades", "steam_appid": 1145350}))
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
    fallback.assert_awaited_once_with("1145350", country="US")


def test_homepage_deals_enriches_and_normalizes_payload(api_client, app_main, monkeypatch):
    deal = {"steam_appid": 1145360, "name": "Hades", "background_image": None, "url": "https://deal.test", "current": None, "history_low_all": None}
    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(return_value=[deal]))
    igdb = AsyncMock(return_value={"id": 42, "name": "Hades", "released": "2020-09-17", "background_image": "https://img.test"})
    monkeypatch.setattr(app_main, "fetch_igdb_game_by_steam_appid", igdb)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/deals", params={"country": "ua", "page_size": 1})

    assert response.status_code == 200
    assert response.json()["results"][0]["id"] == 42
    igdb.assert_awaited_once_with(1145360)


def test_genre_deals_uses_authenticated_favorite_genres(api_client, app_main, monkeypatch, user_factory, auth_as):
    user = user_factory(email="genre-deals@example.com", favorite_genres=["RPG"], steam_country_code="UA")
    auth_as(user)
    candidate = {"steam_appid": 42, "name": "Hades", "background_image": None, "url": "https://deal.test", "current": None, "history_low_all": None}
    monkeypatch.setattr(app_main, "fetch_steam_store_deal_candidates", AsyncMock(return_value={"candidates": [candidate], "popular": [candidate]}))
    igdb = AsyncMock(return_value={"results": [{"id": 42, "name": "Hades", "genres": ["RPG"]}]})
    monkeypatch.setattr(app_main, "fetch_igdb_games", igdb)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/genre-deals")

    assert response.status_code == 200
    assert response.json()["sections"][0]["genre"] == "RPG"
    assert response.json()["sections"][0]["results"][0]["id"] == 42
    igdb.assert_awaited_with("Hades", 1)
