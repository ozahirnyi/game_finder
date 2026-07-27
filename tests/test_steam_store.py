import pytest

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
