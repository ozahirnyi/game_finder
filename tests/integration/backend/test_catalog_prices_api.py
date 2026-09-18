from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

pytestmark = pytest.mark.integration


async def run_cached(_key, _ttl, fetch):
    return await fetch()


def test_catalog_title_fallback_uses_resolved_steam_edition_for_history(
    api_client, app_main, monkeypatch
):
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_game_detail",
        AsyncMock(return_value={"name": "The Witcher 3: Wild Hunt", "steam_appid": None}),
    )
    monkeypatch.setattr(
        app_main,
        "fetch_steam_store_game_price",
        AsyncMock(return_value={
            "appid": 292030,
            "itad_id": "steam:292030",
            "title": "The Witcher 3: Wild Hunt - Complete Edition",
            "current": {"shop": "Steam", "price": {"amount": 1349, "currency": "UAH"}},
            "is_free": False,
            "url": "https://store.steampowered.com/app/292030/",
        }),
    )
    history = AsyncMock(return_value={"history": [{
        "timestamp": "2026-09-01T00:00:00Z",
        "shop": "Steam",
        "price": {"amount": 14.99, "currency": "USD"},
    }]})
    monkeypatch.setattr(app_main, "fetch_game_price_history", history)
    cached = AsyncMock(side_effect=run_cached)
    monkeypatch.setattr(app_main, "get_json_cached", cached)

    response = api_client.get("/prices/games/1942", params={"country": "UA"})

    assert response.status_code == 200
    assert response.json()["current"]["price"] == {"amount": 1349.0, "currency": "UAH"}
    assert response.json()["history"][0]["price"] == {"amount": 14.99, "currency": "USD"}
    history.assert_awaited_once_with(
        "The Witcher 3: Wild Hunt - Complete Edition",
        country="UA",
        steam_appid=292030,
    )
    assert cached.await_args.args[0].startswith("price_history_title_v5:")


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

    async def fetch_catalog(title, *_args, **_kwargs):
        return {"results": {
            "Hades": [{
                "id": 30,
                "name": "Hades",
                "rating": 91.2,
                "genres": ["Role-playing (RPG)"],
                "platforms": ["PlayStation 5"],
            }],
            "Not on PS5": [{"id": 31, "name": "Not on PS5", "platforms": ["Xbox Series X|S"]}],
            "No catalog mapping": [],
        }[title]}

    monkeypatch.setattr(app_main, "fetch_igdb_games", fetch_catalog)
    monkeypatch.setattr(app_main, "get_json_cached", run_cached)

    response = api_client.get(
        "/search/games",
        params=[("q", "hades"), ("on_sale", "true"), ("platform", "ps5")],
    )

    assert response.status_code == 200
    assert [(item["id"], item["name"], item["steam_appid"]) for item in response.json()["results"]] == [
        (30, "Hades", 1),
    ]
    result = response.json()["results"][0]
    assert result["rating"] == 91.2
    assert result["genres"] == ["Role-playing (RPG)"]
    assert result["platforms"] == ["PlayStation 5"]
    assert result["current"] == {"cut": 50}


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

    response = api_client.get(
        "/search/games",
        params={"on_sale": "true", "q": "Black Myth: Wukong"},
    )

    assert response.status_code == 200
    assert [(item["id"], item["name"], item["steam_appid"]) for item in response.json()["results"]] == [
        (333, "Black Myth: Wukong", 2358720),
    ]


def test_sale_discovery_uses_exact_title_lookup_without_waiting_for_steam_id_mapping(
    api_client, app_main, monkeypatch
):
    monkeypatch.setattr(
        app_main,
        "fetch_steam_store_deals",
        AsyncMock(return_value=[{"steam_appid": 2358720, "name": "Black Myth: Wukong", "current": {"cut": 20}}]),
    )
    external_id_lookup = AsyncMock(return_value=None)
    monkeypatch.setattr(app_main, "fetch_igdb_game_by_steam_appid", external_id_lookup)
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
    assert response.json()["results"][0]["id"] == 333
    external_id_lookup.assert_not_awaited()


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
    assert "igdb_search_v5" in cached.await_args.args[0]


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
        "hero_image": None,
        "steam_appid": None,
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


def test_catalog_steam_price_history_keeps_steam_current_and_url_while_enriching_itad_history(api_client, app_main, monkeypatch):
    detail = AsyncMock(return_value={"name": "Hades", "steam_appid": 1145350})
    steam_detail = {
        "itad_id": "steam:1145350", "title": "Hades", "url": "https://store.steampowered.com/app/1145350/",
        "current": {"shop": "Steam", "price": {"amount": 399, "currency": "UAH"}},
        "is_free": False, "deals": [], "history": [],
    }
    history = {
        "itad_id": "itad-1", "title": "ITAD listing", "url": "https://reseller.example/hades",
        "current": {"shop": "Reseller", "price": {"amount": 9.99, "currency": "USD"}},
        "is_free": True, "deals": [{"shop": "Reseller", "url": "https://reseller.example/hades"}],
        "history": [{"timestamp": "2025-01-01T00:00:00Z", "shop": "Steam", "price": {"amount": 299, "currency": "UAH"}}],
        "history_low_all": {"amount": 199, "currency": "UAH"},
    }
    fetch_history = AsyncMock(return_value=history)
    platform_detail = AsyncMock(return_value=steam_detail)
    cached = AsyncMock(side_effect=run_cached)
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", detail)
    monkeypatch.setattr(app_main, "fetch_game_price_history", fetch_history)
    monkeypatch.setattr(app_main, "fetch_steam_store_game_detail", platform_detail)
    monkeypatch.setattr(app_main, "get_json_cached", cached)

    response = api_client.get("/prices/games/42", params={"country": " ua "})

    assert response.status_code == 200
    assert response.json()["itad_id"] == steam_detail["itad_id"]
    assert response.json()["title"] == steam_detail["title"]
    assert response.json()["url"] == steam_detail["url"]
    assert response.json()["current"]["shop"] == "Steam"
    assert response.json()["current"]["price"] == steam_detail["current"]["price"]
    assert response.json()["is_free"] is False
    assert response.json()["history"][0]["price"] == history["history"][0]["price"]
    assert response.json()["history_low_all"] is None
    assert cached.await_args.args[0].startswith("price_history_v3:")
    assert response.json()["history_available"] is True
    fetch_history.assert_awaited_once_with("Hades", country="UA", steam_appid=1145350)
    platform_detail.assert_awaited_once_with(1145350, country="UA")


def test_catalog_price_history_keeps_steam_history_in_its_source_currency(
    api_client, app_main, monkeypatch, user_factory, auth_as
):
    auth_as(user_factory(email="polish-price@example.com", price_country_code="PL"))
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_game_detail",
        AsyncMock(return_value={"name": "Hades", "steam_appid": 1145350}),
    )
    steam = {
        "itad_id": "steam:1145350",
        "title": "Hades",
        "url": "https://store.steampowered.com/app/1145350/",
        "current": {"shop": "Steam", "price": {"amount": 79.99, "currency": "PLN"}},
        "is_free": False,
        "deals": [],
        "history": [],
    }
    history = {
        "itad_id": "itad-hades",
        "title": "Hades",
        "current": {"shop": "Humble Store", "price": {"amount": 9.99, "currency": "USD"}},
        "history_low_all": {"amount": 4.99, "currency": "USD"},
        "history": [
            {"timestamp": "2026-08-01T00:00:00Z", "shop": "Steam", "price": {"amount": 9.99, "currency": "USD"}},
            {"timestamp": "2026-08-08T00:00:00Z", "shop": "Humble Store", "price": {"amount": 4.99, "currency": "USD"}},
            {"timestamp": "2026-08-15T00:00:00Z", "shop": " steam ", "price": {"amount": 8.99, "currency": "EUR"}},
        ],
    }
    steam_detail = AsyncMock(return_value=steam)
    fetch_history = AsyncMock(return_value=history)
    monkeypatch.setattr(app_main, "fetch_steam_store_game_detail", steam_detail)
    monkeypatch.setattr(app_main, "fetch_game_price_history", fetch_history)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/42", params={"country": "UA"})

    assert response.status_code == 200
    assert response.json()["current"]["shop"] == "Steam"
    assert response.json()["current"]["price"] == {"amount": 79.99, "currency": "PLN"}
    assert response.json()["url"] == steam["url"]
    assert [
        (point["shop"].strip(), point["price"])
        for point in response.json()["history"]
    ] == [
        ("Steam", {"amount": 9.99, "currency": "USD"}),
        ("steam", {"amount": 8.99, "currency": "EUR"}),
    ]
    assert response.json()["history_low_all"] is None
    assert response.json()["history_available"] is True
    assert response.json()["provider_message"] is None
    steam_detail.assert_awaited_once_with(1145350, country="PL")
    fetch_history.assert_awaited_once_with("Hades", country="PL", steam_appid=1145350)


def test_catalog_price_history_does_not_use_itad_current_when_exact_steam_lookup_fails(
    api_client, app_main, monkeypatch
):
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_game_detail",
        AsyncMock(return_value={"name": "Unmatched Catalog Title", "steam_appid": None}),
    )
    monkeypatch.setattr(
        app_main,
        "fetch_steam_store_game_price",
        AsyncMock(side_effect=HTTPException(status_code=404, detail="Steam game missing")),
    )
    monkeypatch.setattr(
        app_main,
        "fetch_game_price_history",
        AsyncMock(return_value={
            "itad_id": "itad-unmatched",
            "title": "Unmatched Catalog Title",
            "url": "https://www.humblebundle.com/store/unmatched",
            "current": {"shop": "Humble Store", "price": {"amount": 9.99, "currency": "USD"}},
            "history": [
                {"timestamp": "2026-08-01T00:00:00Z", "shop": "Steam", "price": {"amount": 12.99, "currency": "USD"}},
                {"timestamp": "2026-08-08T00:00:00Z", "shop": "Humble Store", "price": {"amount": 9.99, "currency": "USD"}},
            ],
        }),
    )
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/42", params={"country": "DE"})

    assert response.status_code == 200
    assert response.json()["current"] is None
    assert response.json()["url"] is None
    assert [
        (point["shop"], point["price"])
        for point in response.json()["history"]
    ] == [("Steam", {"amount": 12.99, "currency": "USD"})]


def test_price_history_uses_catalog_title_when_app_id_resolution_needs_a_title(api_client, app_main, monkeypatch):
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_game_detail",
        AsyncMock(return_value={"name": "Hades", "steam_appid": 1145350}),
    )
    monkeypatch.setattr(app_main, "fetch_steam_store_game_detail", AsyncMock(return_value={
        "itad_id": "steam:1145350", "title": "Hades", "url": "https://store.steampowered.com/app/1145350/",
        "current": None, "is_free": False, "deals": [], "history": [],
    }))
    history = AsyncMock(return_value={"itad_id": "itad-1", "title": "Hades", "deals": []})
    monkeypatch.setattr(app_main, "fetch_game_price_history", history)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/42")

    assert response.status_code == 200
    history.assert_awaited_once_with("Hades", country="US", steam_appid=1145350)


def test_price_history_falls_back_to_steam_on_itad_502(api_client, app_main, monkeypatch):
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", AsyncMock(return_value={"name": "Hades", "steam_appid": 1145350}))
    monkeypatch.setattr(app_main, "fetch_game_price_history", AsyncMock(side_effect=HTTPException(502, "ITAD down")))
    steam = {"itad_id": "steam:1145350", "title": "Hades", "url": "https://store.steampowered.com/app/1145350/", "current": None, "is_free": False, "deals": [], "history": []}
    platform_detail = AsyncMock(return_value=steam)
    monkeypatch.setattr(app_main, "fetch_steam_store_game_detail", platform_detail)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/42")

    assert response.status_code == 200
    assert response.json()["itad_id"] == steam["itad_id"]
    assert response.json()["title"] == steam["title"]
    assert response.json()["deals"] == []
    assert response.json()["history_available"] is False
    platform_detail.assert_awaited_once_with(1145350, country="US")


def test_price_history_falls_back_to_steam_on_itad_404(api_client, app_main, monkeypatch):
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", AsyncMock(return_value={"name": "Hades", "steam_appid": 1145350}))
    monkeypatch.setattr(app_main, "fetch_game_price_history", AsyncMock(side_effect=HTTPException(404, "ITAD game missing")))
    steam = {"itad_id": "steam:1145350", "title": "Hades", "url": "https://store.steampowered.com/app/1145350/", "current": None, "is_free": False, "deals": [], "history": []}
    monkeypatch.setattr(app_main, "fetch_steam_store_game_detail", AsyncMock(return_value=steam))
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/42")

    assert response.status_code == 200
    assert response.json()["history_available"] is False


def test_steam_price_history_uses_steam_title_and_falls_back_on_itad_404(api_client, app_main, monkeypatch):
    detail = AsyncMock(return_value={
        "itad_id": "steam:1145350", "title": "Hades", "url": "https://store.steampowered.com/app/1145350/",
        "current": {"shop": "Steam", "price": {"amount": 19.99, "currency": "USD"}},
        "is_free": False, "deals": [], "history": [],
    })
    history = AsyncMock(side_effect=HTTPException(404, "ITAD game missing"))
    monkeypatch.setattr(app_main, "fetch_steam_store_game_detail", detail)
    monkeypatch.setattr(app_main, "fetch_game_price_history", history)

    response = api_client.get("/prices/steam-games/1145350")

    assert response.status_code == 200
    assert response.json()["history_available"] is False
    history.assert_awaited_once_with("Hades", country="US", steam_appid=1145350)
    detail.assert_awaited_once_with(1145350, country="US")


def test_steam_price_history_keeps_country_specific_current_price_and_usd_history(api_client, app_main, monkeypatch):
    async def steam_detail(_appid, country):
        currency, amount = {"UA": ("UAH", 399), "TR": ("TRY", 199)}[country]
        return {
            "itad_id": "steam:1145350", "title": "Hades", "url": "https://store.steampowered.com/app/1145350/",
            "current": {"shop": "Steam", "price": {"amount": amount, "currency": currency}},
            "is_free": False, "deals": [], "history": [],
        }

    history = AsyncMock(return_value={
        "itad_id": "itad-hades", "title": "ITAD Hades", "url": "https://reseller.example/hades",
        "current": {"shop": "Reseller", "price": {"amount": 9.99, "currency": "USD"}},
        "is_free": True, "history": [{"timestamp": "2025-01-01T00:00:00Z", "shop": "Steam", "price": {"amount": 4.99, "currency": "USD"}}],
        "deals": [],
    })
    monkeypatch.setattr(app_main, "fetch_steam_store_game_detail", steam_detail)
    monkeypatch.setattr(app_main, "fetch_game_price_history", history)

    ukraine = api_client.get("/prices/steam-games/1145350", params={"country": "ua"})
    turkey = api_client.get("/prices/steam-games/1145350", params={"country": "tr"})

    assert ukraine.status_code == 200
    assert turkey.status_code == 200
    assert ukraine.json()["current"]["price"] == {"amount": 399, "currency": "UAH"}
    assert turkey.json()["current"]["price"] == {"amount": 199, "currency": "TRY"}
    assert ukraine.json()["url"] == "https://store.steampowered.com/app/1145350/"
    assert ukraine.json()["history"][0]["price"] == {"amount": 4.99, "currency": "USD"}
    assert turkey.json()["history"][0]["price"] == {"amount": 4.99, "currency": "USD"}
    assert ukraine.json()["history_available"] is True
    assert turkey.json()["history_available"] is True
    assert history.await_args_list[0].kwargs["country"] == "UA"
    assert history.await_args_list[1].kwargs["country"] == "TR"


def test_steam_price_history_keeps_free_status_when_itad_reports_zero_price(api_client, app_main, monkeypatch):
    monkeypatch.setattr(app_main, "fetch_steam_store_game_detail", AsyncMock(return_value={
        "itad_id": "steam:620", "title": "Portal 2", "url": "https://store.steampowered.com/app/620/",
        "current": None, "is_free": True, "deals": [], "history": [],
    }))
    monkeypatch.setattr(app_main, "fetch_game_price_history", AsyncMock(return_value={
        "itad_id": "itad-portal-2", "title": "Portal 2", "url": "https://reseller.example/portal-2",
        "current": {"shop": "Reseller", "price": {"amount": 0, "currency": "USD"}},
        "is_free": False, "deals": [], "history": [],
    }))

    response = api_client.get("/prices/steam-games/620")

    assert response.status_code == 200
    assert response.json()["is_free"] is True
    assert response.json()["current"] is None
    assert response.json()["url"] == "https://store.steampowered.com/app/620/"


def test_price_history_uses_itad_title_lookup_when_igdb_has_no_steam_appid(api_client, app_main, monkeypatch):
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_game_detail",
        AsyncMock(return_value={"name": "Black Myth: Wukong", "steam_appid": None}),
    )
    history = AsyncMock(return_value={"itad_id": "itad-2358720", "title": "Black Myth: Wukong", "deals": [], "history": []})
    fallback = AsyncMock(side_effect=HTTPException(404, "Steam game missing"))
    monkeypatch.setattr(app_main, "fetch_game_price_history", history)
    monkeypatch.setattr(app_main, "fetch_steam_store_game_price", fallback)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/136879", params={"country": "ua"})

    assert response.status_code == 200
    assert response.json()["title"] == "Black Myth: Wukong"
    assert response.json()["history_available"] is True
    history.assert_awaited_once_with("Black Myth: Wukong", country="UA")
    fallback.assert_awaited_once_with("Black Myth: Wukong", country="UA")


def test_catalog_title_price_uses_exact_steam_price_and_keeps_itad_history(api_client, app_main, monkeypatch):
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_game_detail",
        AsyncMock(return_value={"name": "Portal 2", "steam_appid": None}),
    )
    steam = {
        "itad_id": "steam:620", "title": "Portal 2", "url": "https://store.steampowered.com/app/620/",
        "current": {"shop": "Steam", "price": {"amount": 225, "currency": "UAH"}},
        "is_free": False, "deals": [], "history": [],
    }
    history = {
        "itad_id": "itad-portal-2", "title": "Portal 2", "url": "https://reseller.example/portal-2",
        "current": {"shop": "Reseller", "price": {"amount": 9.99, "currency": "USD"}},
        "is_free": True, "deals": [{"shop": "Reseller", "url": "https://reseller.example/portal-2"}],
        "history": [{"timestamp": "2025-01-01T00:00:00Z", "shop": "Steam", "price": {"amount": 49, "currency": "UAH"}}],
        "history_low_all": {"amount": 49, "currency": "UAH"},
    }
    steam_price = AsyncMock(return_value=steam)
    fetch_history = AsyncMock(return_value=history)
    monkeypatch.setattr(app_main, "fetch_steam_store_game_price", steam_price)
    monkeypatch.setattr(app_main, "fetch_game_price_history", fetch_history)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/72", params={"country": "ua"})

    assert response.status_code == 200
    assert response.json()["current"]["shop"] == "Steam"
    assert response.json()["current"]["price"] == steam["current"]["price"]
    assert response.json()["is_free"] is False
    assert response.json()["url"] == steam["url"]
    assert response.json()["history"][0]["price"] == history["history"][0]["price"]
    assert response.json()["history_low_all"] is None
    assert response.json()["history_available"] is True
    steam_price.assert_awaited_once_with("Portal 2", country="UA")
    fetch_history.assert_awaited_once_with("Portal 2", country="UA")


def test_catalog_title_price_preserves_exact_free_steam_result_when_itad_fails(api_client, app_main, monkeypatch):
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_game_detail",
        AsyncMock(return_value={"name": "Dota 2", "steam_appid": None}),
    )
    steam = {
        "itad_id": "steam:570", "title": "Dota 2", "url": "https://store.steampowered.com/app/570/",
        "current": None, "is_free": True, "deals": [], "history": [],
    }
    steam_price = AsyncMock(return_value=steam)
    monkeypatch.setattr(app_main, "fetch_steam_store_game_price", steam_price)
    monkeypatch.setattr(app_main, "fetch_game_price_history", AsyncMock(side_effect=HTTPException(502, "ITAD down")))
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/73", params={"country": "us"})

    assert response.status_code == 200
    assert response.json()["current"] is None
    assert response.json()["is_free"] is True
    assert response.json()["url"] == steam["url"]
    assert response.json()["history"] == []
    assert response.json()["history_available"] is False
    steam_price.assert_awaited_once_with("Dota 2", country="US")


def test_catalog_title_price_preserves_steam_current_and_action_when_itad_fails(api_client, app_main, monkeypatch):
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_game_detail",
        AsyncMock(return_value={"name": "Portal 2", "steam_appid": None}),
    )
    steam = {
        "itad_id": "steam:620", "title": "Portal 2", "url": "https://store.steampowered.com/app/620/",
        "current": {"shop": "Steam", "price": {"amount": 225, "currency": "UAH"}},
        "is_free": False, "deals": [], "history": [],
    }
    monkeypatch.setattr(app_main, "fetch_steam_store_game_price", AsyncMock(return_value=steam))
    monkeypatch.setattr(app_main, "fetch_game_price_history", AsyncMock(side_effect=HTTPException(502, "ITAD down")))
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/72", params={"country": "ua"})

    assert response.status_code == 200
    assert response.json()["current"]["shop"] == "Steam"
    assert response.json()["current"]["price"] == steam["current"]["price"]
    assert response.json()["url"] == steam["url"]
    assert response.json()["history"] == []
    assert response.json()["history_available"] is False


def test_non_steam_catalog_history_does_not_expose_itad_reseller_data(api_client, app_main, monkeypatch):
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_game_detail",
        AsyncMock(return_value={"name": "Black Myth: Wukong", "steam_appid": None}),
    )
    monkeypatch.setattr(app_main, "fetch_game_price_history", AsyncMock(return_value={
        "itad_id": "itad-2358720", "title": "Black Myth: Wukong", "url": "https://reseller.example/game",
        "current": {"shop": "Reseller", "price": {"amount": 59.99, "currency": "USD"}, "url": "https://reseller.example/game"},
        "deals": [{"shop": "Reseller", "url": "https://reseller.example/game"}], "history": [],
    }))
    monkeypatch.setattr(app_main, "fetch_steam_store_game_price", AsyncMock(side_effect=HTTPException(404, "Steam game missing")))
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/136879")

    assert response.status_code == 200
    assert response.json()["url"] is None
    assert response.json()["current"] is None
    assert response.json()["deals"] == []


def test_price_history_falls_back_to_steam_when_itad_title_lookup_is_unavailable(api_client, app_main, monkeypatch):
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_game_detail",
        AsyncMock(return_value={"name": "Black Myth: Wukong", "steam_appid": None}),
    )
    monkeypatch.setattr(app_main, "fetch_game_price_history", AsyncMock(side_effect=HTTPException(502, "ITAD down")))
    fallback = AsyncMock(return_value={"itad_id": "steam:2358720", "title": "Black Myth: Wukong", "deals": []})
    monkeypatch.setattr(app_main, "fetch_steam_store_game_price", fallback)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/136879")

    assert response.status_code == 200
    assert response.json()["history_available"] is False
    fallback.assert_awaited_once_with("Black Myth: Wukong", country="US")


def test_homepage_deals_enriches_and_normalizes_payload(api_client, app_main, monkeypatch):
    deal = {"steam_appid": 108600, "name": "Project Zomboid", "background_image": "https://images.test/steam-capsule.jpg", "url": "https://deal.test", "current": None, "history_low_all": None}
    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(return_value=[deal]))
    igdb = AsyncMock(return_value={"id": 42, "name": "Project Zomboid", "background_image": "https://images.test/catalog.jpg", "hero_image": "https://images.test/wide.jpg"})
    monkeypatch.setattr(app_main, "fetch_igdb_game_by_steam_appid", igdb)
    cached = AsyncMock(side_effect=run_cached)
    monkeypatch.setattr(app_main, "get_json_cached", cached)

    response = api_client.get("/prices/deals", params={"country": "ua", "page_size": 1})

    assert response.status_code == 200
    assert cached.await_args.args[0].startswith("steam_store_deals_v2:")
    assert response.json()["results"][0]["id"] == 42
    assert response.json()["results"][0]["hero_image"] == "https://images.test/wide.jpg"
    igdb.assert_awaited_once_with(108600)


def test_homepage_deals_falls_back_to_an_exact_catalog_title(api_client, app_main, monkeypatch):
    deal = {"steam_appid": 2358720, "name": "Black Myth: Wukong", "background_image": None, "url": "https://deal.test", "current": None, "history_low_all": None}
    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(return_value=[deal]))
    monkeypatch.setattr(app_main, "fetch_igdb_game_by_steam_appid", AsyncMock(return_value=None))
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_games",
        AsyncMock(return_value={"results": [{"id": 136879, "name": "Black Myth: Wukong"}]}),
    )
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/deals", params={"country": "ua", "page_size": 1})

    assert response.status_code == 200
    assert response.json()["results"][0]["id"] == 136879


def test_genre_deals_uses_authenticated_favorite_genres(api_client, app_main, monkeypatch, user_factory, auth_as):
    user = user_factory(email="genre-deals@example.com", favorite_genres=["RPG"], steam_country_code="UA")
    auth_as(user)
    candidate = {"steam_appid": 42, "name": "Hades", "background_image": None, "url": "https://deal.test", "current": None, "history_low_all": None}
    monkeypatch.setattr(app_main, "fetch_steam_store_deal_candidates", AsyncMock(return_value={"candidates": [candidate], "popular": [candidate]}))
    igdb_result = {"id": 42, "name": "Hades", "genres": ["RPG"], "hero_image": "https://images.test/hades-wide.jpg"}

    async def steam_cache(_country, fetch):
        return await fetch(_country)

    igdb_batches = AsyncMock(return_value={"Hades": [igdb_result]})

    async def igdb_cache(deals, fetch):
        results = await fetch([deal["name"] for deal in deals])
        return {deal["steam_appid"]: {"results": results[deal["name"]]} for deal in deals}

    monkeypatch.setattr(app_main, "get_cached_steam_deal_candidates", steam_cache)
    monkeypatch.setattr(app_main, "get_cached_igdb_deal_matches", igdb_cache)
    monkeypatch.setattr(app_main, "fetch_igdb_games_batches", igdb_batches)
    cached = AsyncMock(side_effect=run_cached)
    monkeypatch.setattr(app_main, "get_json_cached", cached)

    response = api_client.get("/prices/genre-deals")

    assert response.status_code == 200
    assert response.json()["sections"][0]["genre"] == "rpg"
    assert response.json()["sections"][0]["results"][0]["id"] == 42
    assert response.json()["sections"][0]["results"][0]["hero_image"] == "https://images.test/hades-wide.jpg"
    assert cached.await_args.args[0].startswith("steam_genre_deals_v6:")
    igdb_batches.assert_awaited_once_with(["Hades"])
