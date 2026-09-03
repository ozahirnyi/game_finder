from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi import HTTPException
from jose import jwt

from app import steam, steam_store
from app.auth import ALGORITHM, SECRET_KEY


class FakeResponse:
    def __init__(self, payload=None, status_code=200, text="is_valid:true"):
        self._payload = payload or {}
        self.status_code = status_code
        self.text = text

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("GET", "https://fake.test")
            raise httpx.HTTPStatusError("failure", request=request, response=self)

    def json(self):
        return self._payload


class FakeAsyncClient:
    def __init__(self, responses=None, error=None):
        self.responses = iter(responses or [])
        self.error = error
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        if self.error:
            raise self.error
        return next(self.responses)

    async def post(self, url, **kwargs):
        self.calls.append(("POST", url, kwargs))
        if self.error:
            raise self.error
        return next(self.responses)


def client_factory(monkeypatch, module, responses=None, error=None):
    client = FakeAsyncClient(responses, error)
    monkeypatch.setattr(module.httpx, "AsyncClient", lambda *a, **k: client)
    return client


def deal(appid=1, currency="USD", name="Game", discount=50, final=999, type=0):
    return {"id": appid, "type": type, "name": name, "discount_percent": discount,
            "currency": currency, "final_price": final, "original_price": 1999,
            "header_image": "header"}


def test_steam_key_and_state_edges(monkeypatch):
    monkeypatch.delenv("STEAM_API_KEY", raising=False)
    monkeypatch.delenv("STEAM_WEB_API_KEY", raising=False)
    assert steam.get_steam_api_key() == ""
    monkeypatch.setenv("STEAM_WEB_API_KEY", "fallback")
    assert steam.get_steam_api_key() == "fallback"
    state = steam.create_steam_state("user-1")
    assert steam.decode_steam_state(state) == "user-1"
    for token in ["bad", jwt.encode({"sub": "u", "typ": "wrong"}, SECRET_KEY, algorithm=ALGORITHM),
                  jwt.encode({"sub": "u", "typ": "steam_link", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}, SECRET_KEY, algorithm=ALGORITHM)]:
        with pytest.raises(HTTPException) as exc:
            steam.decode_steam_state(token)
        assert exc.value.status_code == 400


def test_login_url_and_id_validation():
    url = steam.build_steam_login_url("https://app/callback", "https://app")
    params = parse_qs(urlparse(url).query)
    assert params["openid.mode"] == ["checkid_setup"]
    assert params["openid.return_to"] == ["https://app/callback"]
    assert steam.extract_steam_id("https://steamcommunity.com/id/765") == "765"
    for value in [None, "https://steamcommunity.com/id/not-an-id"]:
        with pytest.raises(HTTPException):
            steam.extract_steam_id(value)


@pytest.mark.anyio
async def test_openid_verification_success_invalid_and_transport(monkeypatch):
    query = {"openid.claimed_id": "https://steamcommunity.com/id/123", "openid.sig": "x"}
    client = client_factory(monkeypatch, steam, [FakeResponse(text="is_valid:true")])
    assert await steam.verify_steam_openid(query) == "123"
    assert client.calls[0][2]["data"]["openid.mode"] == "check_authentication"
    client_factory(monkeypatch, steam, [FakeResponse(text="is_valid:false")])
    with pytest.raises(HTTPException, match="verification failed"):
        await steam.verify_steam_openid(query)
    client_factory(monkeypatch, steam, error=httpx.ConnectError("offline"))
    with pytest.raises(HTTPException) as exc:
        await steam.verify_steam_openid(query)
    assert exc.value.status_code == 502
    with pytest.raises(HTTPException, match="Missing"):
        await steam.verify_steam_openid({"other": "value"})


def test_country_normalization():
    assert steam.normalize_country_code(" ua ") == "UA"
    assert steam.normalize_country_code("USA") is None
    assert steam.normalize_country_code("1!") is None
    assert steam.normalize_country_code(None) is None


@pytest.mark.anyio
async def test_profiles_missing_private_and_batches(monkeypatch):
    monkeypatch.delenv("STEAM_API_KEY", raising=False)
    assert await steam.fetch_steam_profile("1") == {"persona_name": None, "avatar": None, "country_code": None}
    assert await steam.fetch_steam_profiles([]) == {}
    monkeypatch.setenv("STEAM_API_KEY", "key")
    client_factory(monkeypatch, steam, [FakeResponse({"response": {"players": []}})])
    assert (await steam.fetch_steam_profile("1"))["avatar"] is None
    client_factory(monkeypatch, steam, error=httpx.ConnectError("offline"))
    assert (await steam.fetch_steam_profile("1"))["persona_name"] is None
    ids = [str(i) for i in range(101)]
    client_factory(monkeypatch, steam, [FakeResponse({"response": {"players": [{"steamid": "1", "personaname": "One"}]}}),
                                        FakeResponse({"response": {"players": [{"steamid": "100", "avatar": "a"}]}})])
    result = await steam.fetch_steam_profiles(ids)
    assert set(result) == {"1", "100"}
    client_factory(monkeypatch, steam, [FakeResponse({"response": {"players": [{"steamid": "1"}]}}), FakeResponse(status_code=500)])
    assert await steam.fetch_steam_profiles(ids) == {"1": {"persona_name": None, "avatar": None, "country_code": None}}


@pytest.mark.anyio
async def test_friends_edges(monkeypatch):
    monkeypatch.delenv("STEAM_API_KEY", raising=False)
    with pytest.raises(HTTPException) as exc:
        await steam.fetch_steam_friends("1")
    assert exc.value.status_code == 503
    monkeypatch.setenv("STEAM_API_KEY", "key")
    for response in [FakeResponse({"friendslist": {}}), FakeResponse(status_code=403), FakeResponse(status_code=500)]:
        client_factory(monkeypatch, steam, [response])
        with pytest.raises(HTTPException):
            await steam.fetch_steam_friends("1")
    client_factory(monkeypatch, steam, error=httpx.ConnectError("offline"))
    with pytest.raises(HTTPException) as exc:
        await steam.fetch_steam_friends("1")
    assert exc.value.status_code == 502
    friends = {"friendslist": {"friends": [{"steamid": "2", "friend_since": 1}, {"steamid": "1", "friend_since": 3}]}}
    client_factory(monkeypatch, steam, [FakeResponse(friends)])
    monkeypatch.setattr(steam, "fetch_steam_profiles", lambda ids: __import__("asyncio").sleep(0, result={}))
    result, total = await steam.fetch_steam_friends("1", limit=1, offset=1)
    assert total == 2 and result[0]["steam_id"] == "2"


@pytest.mark.anyio
async def test_owned_games_edges(monkeypatch):
    monkeypatch.delenv("STEAM_API_KEY", raising=False)
    with pytest.raises(HTTPException):
        await steam.fetch_owned_games("1")
    monkeypatch.setenv("STEAM_API_KEY", "key")
    client_factory(monkeypatch, steam, [FakeResponse({"response": {}})])
    with pytest.raises(HTTPException) as exc:
        await steam.fetch_owned_games("1")
    assert exc.value.status_code == 409
    for status in [401, 500]:
        client_factory(monkeypatch, steam, [FakeResponse(status_code=status)])
        with pytest.raises(HTTPException):
            await steam.fetch_owned_games("1")
    client_factory(monkeypatch, steam, error=httpx.ConnectError("offline"))
    with pytest.raises(HTTPException):
        await steam.fetch_owned_games("1")
    client_factory(monkeypatch, steam, [FakeResponse({"response": {"games": [
        {"appid": 2, "playtime_forever": 1}, {"appid": None, "playtime_forever": 999}
    ]}})])
    assert (await steam.fetch_owned_games("1"))[0]["name"] == "Steam app 2"


def test_steam_store_helpers():
    assert steam_store._money_from_steam_cents(None, "USD") is None
    assert steam_store._money_from_steam_cents(0, "USD")["amount"] == 0
    assert steam_store._money_from_steam_cents(1, None) is None
    assert steam_store._steam_deal({"type": 0, "id": 1, "name": "x", "discount_percent": 0}) is None
    assert steam_store._steam_deal(deal(final=None)) is None
    assert steam_store._steam_deal(deal(name=" ")) is None
    assert steam_store._steam_deal(deal(type=1)) is None
    valid = steam_store._steam_deal(deal())
    assert valid["steam_appid"] == 1
    assert steam_store._has_expected_currency(valid, "US")
    assert not steam_store._has_expected_currency({"current": {"price": {"currency": "USD"}}}, "UA")


@pytest.mark.anyio
async def test_store_deals_filter_fallback_and_page_size(monkeypatch):
    payload = {"top_sellers": {"items": [deal(1), deal(2, currency="RUB")]},
               "specials": {"items": [deal(3), deal(4)]},
               "new_releases": {"items": [{"type": 1, "id": 99}, deal(5)]}}
    client_factory(monkeypatch, steam_store, [FakeResponse(payload)])
    assert [d["steam_appid"] for d in await steam_store.fetch_steam_store_deals("US", 2)] == [1, 2]
    client_factory(monkeypatch, steam_store, [FakeResponse(payload)])
    assert len((await steam_store.fetch_steam_store_deal_candidates("US", 1))["candidates"]) == 1
    client_factory(monkeypatch, steam_store, [FakeResponse({"top_sellers": {"items": [deal(currency="RUB")]}, "specials": {}, "new_releases": {}})])
    with pytest.raises(HTTPException):
        await steam_store.fetch_steam_store_deal_candidates("UA")


@pytest.mark.anyio
async def test_store_game_price_success_no_price_not_found_and_error(monkeypatch):
    search = {"items": [{"id": 9, "type": "game", "name": "Fallback"}]}
    detail = {"9": {"data": {"name": "Fallback", "price_overview": {"final": 100, "initial": 200, "currency": "USD", "discount_percent": 50}}}}
    client_factory(monkeypatch, steam_store, [FakeResponse(search), FakeResponse(detail)])
    result = await steam_store.fetch_steam_store_game_price("fallback")
    assert result["itad_id"] == "steam:9" and result["current"]["cut"] == 50
    client_factory(monkeypatch, steam_store, [FakeResponse({"items": []})])
    with pytest.raises(HTTPException) as exc:
        await steam_store.fetch_steam_store_game_price("missing")
    assert exc.value.status_code == 404
    client_factory(monkeypatch, steam_store, [FakeResponse({"items": [{"id": 9, "name": "x"}]}), FakeResponse({"9": {"data": {}}})])
    with pytest.raises(HTTPException):
        await steam_store.fetch_steam_store_game_price("x")
    client_factory(monkeypatch, steam_store, error=httpx.ConnectError("offline"))
    with pytest.raises(HTTPException) as exc:
        await steam_store.fetch_steam_store_game_price("x")
    assert exc.value.status_code == 502


@pytest.mark.anyio
async def test_store_game_price_prefers_a_priced_title_match_over_an_unpriced_result(monkeypatch):
    search = {
        "items": [
            {"id": 5006530, "type": "app", "name": "The Witcher 3: Wild Hunt — Songs of the Past"},
            {
                "id": 292030,
                "type": "app",
                "name": "The Witcher 3: Wild Hunt - Complete Edition",
                "price": {"currency": "USD", "initial": 4999, "final": 4999},
            },
        ]
    }
    detail = {
        "292030": {
            "data": {
                "name": "The Witcher 3: Wild Hunt - Complete Edition",
                "price_overview": {"final": 4999, "initial": 4999, "currency": "USD"},
            }
        }
    }
    client = client_factory(monkeypatch, steam_store, [FakeResponse(search), FakeResponse(detail)])

    result = await steam_store.fetch_steam_store_game_price("The Witcher 3: Wild Hunt")

    assert result["appid"] == 292030
    assert client.calls[1][2]["params"]["appids"] == 292030


@pytest.mark.anyio
async def test_store_candidates_error(monkeypatch):
    client_factory(monkeypatch, steam_store, [FakeResponse(status_code=503)])
    with pytest.raises(HTTPException, match="503"):
        await steam_store.fetch_steam_store_deal_candidates()
    client_factory(monkeypatch, steam_store, error=httpx.ConnectError("offline"))
    with pytest.raises(HTTPException) as exc:
        await steam_store.fetch_steam_store_deal_candidates()
    assert exc.value.status_code == 502
