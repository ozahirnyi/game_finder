import pytest
from fastapi import HTTPException

from app import steam_store


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
    async def fake_get(self, _url, *, params):
        assert params["appids"] == "10,20"

        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                return {
                    "10": {"data": {"genres": [{"description": "Action"}, {"description": "RPG"}]}},
                    "20": {"success": False},
                }

        return Response()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    assert await steam_store.fetch_steam_store_game_genres([10, 20], "US") == {10: ["Action", "RPG"], 20: []}
