import asyncio

import httpx
import pytest
from fastapi import HTTPException

from app.integrations import rawg
from app import prices, steam, telegram


class FakeResponse:
    def __init__(self, payload=None, status_code=200, text="", error=None):
        self._payload = payload or {}
        self.status_code = status_code
        self.text = text
        self._error = error

    def raise_for_status(self):
        if self._error == "timeout":
            raise httpx.TimeoutException("timed out")
        if self._error == "request":
            raise httpx.RequestError("connection failed")
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"HTTP {self.status_code}",
                request=httpx.Request("GET", "https://provider.test"),
                response=httpx.Response(self.status_code, request=httpx.Request("GET", "https://provider.test"), json=self._payload),
            )

    def json(self):
        return self._payload


class FakeAsyncClient:
    def __init__(self, response=None, responses=None, *args, **kwargs):
        self.response = response
        self.responses = iter(responses) if responses is not None else None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def get(self, *args, **kwargs):
        return next(self.responses) if self.responses is not None else self.response

    async def post(self, *args, **kwargs):
        return next(self.responses) if self.responses is not None else self.response


@pytest.mark.anyio
async def test_rawg_search_normalizes_results(monkeypatch):
    monkeypatch.setattr(rawg, "RAWG_API_KEY", "key")
    monkeypatch.setattr(rawg.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(
        response=FakeResponse({"results": [{"id": 1, "name": "Game", "genres": [{"name": "RPG"}, {}]}]})
    ))

    assert await rawg.fetch_rawg_games("game") == {
        "results": [{"id": 1, "name": "Game", "released": None, "background_image": None, "genres": ["RPG"]}]
    }


@pytest.mark.parametrize("error,status", [("timeout", 504), ("request", 502), (None, 502)])
@pytest.mark.anyio
async def test_rawg_errors_map_to_rawg_error(monkeypatch, error, status):
    monkeypatch.setattr(rawg, "RAWG_API_KEY", "key")
    monkeypatch.setattr(rawg.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(response=FakeResponse(status_code=500, error=error)))

    with pytest.raises(rawg.RAWGError) as exc:
        await rawg.fetch_rawg_games("game")
    assert exc.value.status_code == status


@pytest.mark.anyio
async def test_rawg_detail_upcoming_and_trending_happy_paths(monkeypatch):
    monkeypatch.setattr(rawg, "RAWG_API_KEY", "key")
    monkeypatch.setattr(rawg.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(response=FakeResponse({"id": 1, "name": "Game", "genres": [{"name": "RPG"}], "platforms": [{"platform": {"name": "PC"}}]})))
    assert (await rawg.fetch_rawg_game_detail(1))["platforms"] == ["PC"]
    monkeypatch.setattr(rawg.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(response=FakeResponse({"results": [{"id": 2, "name": "Soon"}]})))
    assert (await rawg.fetch_rawg_upcoming_games())["results"][0]["name"] == "Soon"
    monkeypatch.setattr(rawg.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(response=FakeResponse({"results": [{"id": 3, "name": "Hot"}]})))
    assert (await rawg.fetch_rawg_trending_games())["results"][0]["name"] == "Hot"


@pytest.mark.anyio
async def test_itad_price_history_normalizes_deals(monkeypatch):
    monkeypatch.setenv("ITAD_API_KEY", "key")
    responses = [
        FakeResponse({"found": True, "game": {"id": "g1", "title": "Game", "urls": {"game": "url"}}}),
        FakeResponse([{"historyLow": {"all": {"amount": 5, "currency": "USD"}}, "deals": [{"shop": {"name": "Store"}, "price": {"amount": 6, "currency": "USD"}}]}]),
        FakeResponse([{"timestamp": "2026-08-01T00:00:00+00:00", "shop": {"name": "Store"}, "deal": {"price": {"amount": 6, "currency": "USD"}}}]),
    ]
    monkeypatch.setattr(prices.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(responses=responses))
    result = await prices.fetch_game_price_history("Game")
    assert result["itad_id"] == "g1"
    assert result["current"]["shop"] == "Store"
    assert result["history_low_all"] == {"amount": 5, "currency": "USD"}
    assert result["history"][0]["timestamp"] == "2026-08-01T00:00:00+00:00"


@pytest.mark.anyio
async def test_itad_http_errors_map_to_http_exception(monkeypatch):
    monkeypatch.setenv("ITAD_API_KEY", "key")
    monkeypatch.setattr(prices.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(response=FakeResponse({"detail": "bad key"}, 401)))
    with pytest.raises(HTTPException) as exc:
        await prices.fetch_game_price_history("Game")
    assert exc.value.status_code == 502


@pytest.mark.anyio
async def test_steam_owned_games_normalizes_and_sorts(monkeypatch):
    monkeypatch.setenv("STEAM_API_KEY", "key")
    payload = {"response": {"games": [{"appid": 1, "name": "A", "playtime_forever": 2}, {"appid": 2, "playtime_forever": 9}]}}
    monkeypatch.setattr(steam.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(response=FakeResponse(payload)))
    result = await steam.fetch_owned_games("steam")
    assert [game["appid"] for game in result] == [2, 1]
    assert result[0]["name"] == "Steam app 2"


@pytest.mark.anyio
async def test_steam_owned_games_private_library_and_http_error(monkeypatch):
    monkeypatch.setenv("STEAM_API_KEY", "key")
    monkeypatch.setattr(steam.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(response=FakeResponse({"response": {}})))
    with pytest.raises(HTTPException) as exc:
        await steam.fetch_owned_games("steam")
    assert exc.value.status_code == 409
    monkeypatch.setattr(steam.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(response=FakeResponse(status_code=403)))
    with pytest.raises(HTTPException) as exc:
        await steam.fetch_owned_games("steam")
    assert exc.value.status_code == 502


@pytest.mark.anyio
async def test_steam_friends_and_profile_normalize(monkeypatch):
    monkeypatch.setenv("STEAM_API_KEY", "key")
    friends = {"friendslist": {"friends": [{"steamid": "2", "friend_since": 1}, {"steamid": "1", "friend_since": 3}]}}
    profiles = {"response": {"players": [{"steamid": "1", "personaname": "One", "avatarfull": "avatar", "loccountrycode": "ua"}]}}
    monkeypatch.setattr(steam.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(response=FakeResponse(friends)))
    monkeypatch.setattr(steam, "fetch_steam_profiles", lambda ids: asyncio.sleep(0, result={"1": {"persona_name": "One", "avatar": "avatar"}}))
    result, total = await steam.fetch_steam_friends("steam")
    assert total == 2 and result[0]["steam_id"] == "1" and result[0]["persona_name"] == "One"
    monkeypatch.setattr(steam.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(response=FakeResponse(profiles)))
    assert (await steam.fetch_steam_profile("1"))["country_code"] == "UA"


def test_telegram_link_and_send(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_USERNAME", "@playfinder_bot")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "secret")
    token = telegram.create_telegram_link_token()
    assert token and telegram.build_telegram_link_url(token).endswith(f"?start={token}")
    calls = []
    monkeypatch.setattr(telegram.httpx, "post", lambda *args, **kwargs: calls.append((args, kwargs)) or FakeResponse(status_code=200))
    assert telegram.send_telegram_message("42", "hello") is True
    assert calls[0][1]["json"]["chat_id"] == "42"


def test_telegram_send_without_token(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    assert telegram.send_telegram_message("42", "hello") is False
