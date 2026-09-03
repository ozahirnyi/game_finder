import pytest
from fastapi import HTTPException

from app import steam_store


@pytest.mark.anyio
async def test_steam_search_uses_portrait_library_cover(monkeypatch):
    async def fake_get(self, *_args, **_kwargs):
        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                return {"items": [{"id": 1145360, "name": "Hades"}]}

        return Response()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    results = await steam_store.fetch_steam_store_search("hades")

    assert results[0]["background_image"] == (
        "https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/library_600x900.jpg"
    )


@pytest.mark.anyio
async def test_price_lookup_accepts_store_search_app_results(monkeypatch):
    async def fake_get(self, url, *, params):
        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                if url.endswith("storesearch/"):
                    return {"items": [{"id": 3240220, "name": "Grand Theft Auto V Enhanced", "type": "app"}]}
                return {"3240220": {"data": {"name": "Grand Theft Auto V Enhanced", "price_overview": {"final": 1979, "initial": 4499, "currency": "USD"}}}}

        return Response()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    result = await steam_store.fetch_steam_store_game_price("Grand Theft Auto V")

    assert result["appid"] == 3240220
    assert result["current"]["price"] == {"amount": 19.79, "currency": "USD"}


@pytest.mark.anyio
async def test_popular_deals_fill_from_specials_after_discounted_top_sellers(monkeypatch):
    async def fake_get(self, *_args, **_kwargs):
        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                def item(appid, name):
                    return {
                        "id": appid,
                        "type": 0,
                        "name": name,
                        "discount_percent": 50,
                        "currency": "USD",
                        "final_price": 999,
                        "original_price": 1999,
                    }

                return {
                    "top_sellers": {"items": [item(1, "Top deal")]},
                    "specials": {"items": [item(1, "Top deal"), item(2, "Special two"), item(3, "Special three"), item(4, "Special four")]},
                    "new_releases": {"items": []},
                }

        return Response()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    payload = await steam_store.fetch_steam_store_deal_candidates("US")

    assert [deal["steam_appid"] for deal in payload["popular"]] == [1, 2, 3, 4]


@pytest.mark.anyio
async def test_ukrainian_deals_reject_ruble_prices(monkeypatch):
    async def fake_get(self, *_args, **_kwargs):
        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                ruble_deal = {
                    "id": 1,
                    "type": 0,
                    "name": "Incorrect regional price",
                    "discount_percent": 50,
                    "currency": "RUB",
                    "final_price": 24600,
                    "original_price": 29000,
                }
                return {
                    "top_sellers": {"items": [ruble_deal]},
                    "specials": {"items": []},
                    "new_releases": {"items": []},
                }

        return Response()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    with pytest.raises(HTTPException, match="Ukrainian prices") as exc_info:
        await steam_store.fetch_steam_store_deal_candidates("UA")

    assert exc_info.value.status_code == 502


@pytest.mark.anyio
async def test_steam_genre_lookup_returns_store_categories_and_tolerates_missing_app(monkeypatch):
    requested_appids = []

    async def fake_get(self, _url, *, params):
        requested_appids.append(params["appids"])

        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                appid = int(params["appids"])
                return {str(appid): {"data": {"genres": [{"description": "Action"}, {"description": "RPG"}]}}} if appid == 10 else {"20": {"success": False}}

        return Response()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    assert await steam_store.fetch_steam_store_game_genres([10, 20], "US") == {10: ["Action", "RPG"], 20: []}
    assert sorted(requested_appids) == [10, 20]


def test_steam_deal_helpers_reject_incomplete_data_and_enforce_regional_currency():
    assert steam_store._money_from_steam_cents(None, "USD") is None
    assert steam_store._money_from_steam_cents(1999, None) is None
    assert steam_store._money_from_steam_cents(1999, "USD") == {"amount": 19.99, "currency": "USD"}
    assert steam_store._steam_deal({"id": 1, "name": "Game", "type": 1, "discount_percent": 50}) is None
    assert steam_store._steam_deal({"id": 1, "name": "Game", "type": 0, "discount_percent": 0}) is None

    deal = steam_store._steam_deal({
        "id": 1,
        "name": "Game",
        "type": 0,
        "discount_percent": 50,
        "currency": "UAH",
        "final_price": 19900,
        "original_price": 39900,
        "large_capsule_image": "https://images.test/wide.jpg",
    })

    assert deal["background_image"] == "https://images.test/wide.jpg"
    assert steam_store._has_expected_currency(deal, "UA") is True
    assert steam_store._has_expected_currency({**deal, "current": {**deal["current"], "price": {"amount": 19.99, "currency": "USD"}}}, "UA") is False


@pytest.mark.anyio
async def test_steam_store_game_detail_maps_catalog_fields(monkeypatch):
    async def fake_get(self, _url, *, params):
        assert params == {"appids": 10, "cc": "UA", "l": "english"}

        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                return {"10": {"data": {
                    "name": "Portal",
                    "header_image": "https://images.test/portal.jpg",
                    "short_description": "A puzzle game",
                    "genres": [{"description": "Puzzle"}],
                    "platforms": {"windows": True, "mac": False},
                    "release_date": {"date": "10 Oct, 2007"},
                    "metacritic": {"score": 90},
                    "price_overview": {"final": 499, "initial": 999, "currency": "UAH", "discount_percent": 50},
                }}}

        return Response()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    detail = await steam_store.fetch_steam_store_game_detail(10, "UA")

    assert detail["title"] == "Portal"
    assert detail["platforms"] == ["windows"]
    assert detail["current"]["price"] == {"amount": 4.99, "currency": "UAH"}
    assert detail["current"]["regular"] == {"amount": 9.99, "currency": "UAH"}


@pytest.mark.anyio
async def test_steam_store_game_detail_returns_not_found_for_empty_payload(monkeypatch):
    async def fake_get(self, _url, *, params):
        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                return {"10": {"data": {}}}

        return Response()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    with pytest.raises(HTTPException, match="Steam game not found") as exc:
        await steam_store.fetch_steam_store_game_detail(10)

    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_steam_search_skips_incomplete_results_and_obeys_page_size(monkeypatch):
    async def fake_get(self, _url, *, params):
        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                return {"items": [
                    {"id": None, "name": "Missing id"},
                    {"id": 1, "name": ""},
                    {"id": 2, "name": "First"},
                    {"id": 3, "name": "Second"},
                ]}

        return Response()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    assert await steam_store.fetch_steam_store_search("first", page_size=1) == [{
        "steam_appid": 2,
        "name": "First",
        "background_image": "https://cdn.cloudflare.steamstatic.com/steam/apps/2/library_600x900.jpg",
        "url": "https://store.steampowered.com/app/2/",
    }]


@pytest.mark.anyio
async def test_steam_price_lookup_rejects_missing_store_price(monkeypatch):
    async def fake_get(self, url, *, params):
        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                if url.endswith("storesearch/"):
                    return {"items": [{"id": 10, "name": "Portal", "type": "game"}]}
                return {"10": {"data": {"name": "Portal", "price_overview": {}}}}

        return Response()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    with pytest.raises(HTTPException, match="Steam price data not found") as exc:
        await steam_store.fetch_steam_store_game_price("Portal")

    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_steam_price_lookup_rejects_an_empty_search_result(monkeypatch):
    async def fake_get(self, _url, *, params):
        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                return {"items": []}

        return Response()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    with pytest.raises(HTTPException, match="Steam price data not found") as exc:
        await steam_store.fetch_steam_store_game_price("Missing")

    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_steam_genre_lookup_filters_invalid_ids_and_tolerates_request_errors(monkeypatch):
    async def fake_get(self, _url, *, params):
        if params["appids"] == 20:
            raise steam_store.httpx.RequestError("offline")

        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                return {"10": {"data": {"genres": [{"description": "Action"}]}}}

        return Response()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    assert await steam_store.fetch_steam_store_game_genres([], "US") == {}
    assert await steam_store.fetch_steam_store_game_genres([10, 20, 10, 0], "US") == {
        10: ["Action"],
        20: [],
    }


@pytest.mark.anyio
async def test_steam_deals_returns_the_requested_candidate_slice(monkeypatch):
    async def candidates(country):
        assert country == "UA"
        return {"popular": [], "candidates": [{"steam_appid": 1}, {"steam_appid": 2}]}

    monkeypatch.setattr(steam_store, "fetch_steam_store_deal_candidates", candidates)

    assert await steam_store.fetch_steam_store_deals("UA", page_size=1) == [{"steam_appid": 1}]


@pytest.mark.anyio
@pytest.mark.parametrize("operation", [steam_store.fetch_steam_store_game_price, steam_store.fetch_steam_store_game_detail])
async def test_steam_store_maps_transport_errors_to_bad_gateway(monkeypatch, operation):
    async def fake_get(self, _url, *, params):
        raise steam_store.httpx.RequestError("offline")

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    with pytest.raises(HTTPException, match="Steam Store request failed") as exc:
        if operation is steam_store.fetch_steam_store_game_price:
            await operation("Portal")
        else:
            await operation(10)

    assert exc.value.status_code == 502


@pytest.mark.anyio
async def test_steam_deal_candidates_map_transport_errors_to_bad_gateway(monkeypatch):
    async def fake_get(self, _url, *, params):
        raise steam_store.httpx.RequestError("offline")

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    with pytest.raises(HTTPException, match="Steam Store request failed") as exc:
        await steam_store.fetch_steam_store_deal_candidates("US")

    assert exc.value.status_code == 502
