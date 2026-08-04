from io import BytesIO

import httpx
import pytest
from fastapi import HTTPException
from openpyxl import Workbook

from app import google_auth, prices, psn_export, telegram
from app.integrations import igdb


class FakeResponse:
    def __init__(self, payload=None, status_code=200):
        self.payload = payload if payload is not None else {}
        self.status_code = status_code

    def json(self):
        return self.payload

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("GET", "https://fake.test")
            raise httpx.HTTPStatusError(
                "provider failure",
                request=request,
                response=httpx.Response(self.status_code, request=request, json=self.payload),
            )


class FakeAsyncClient:
    def __init__(self, get_result=None, post_result=None, error=None, **_kwargs):
        self.get_result = get_result
        self.post_result = post_result
        self.error = error

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def get(self, *args, **kwargs):
        if self.error:
            raise self.error
        return self.get_result

    async def post(self, *args, **kwargs):
        if self.error:
            raise self.error
        return self.post_result


@pytest.mark.anyio
@pytest.mark.parametrize("error", [httpx.TimeoutException("timeout"), httpx.RequestError("offline")])
async def test_igdb_detail_retries_then_maps_provider_errors(monkeypatch, error):
    monkeypatch.setattr(igdb, "IGDB_API_KEY", "key")
    monkeypatch.setattr(igdb.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(error=error))
    monkeypatch.setattr(igdb.asyncio, "sleep", lambda *_: _completed())

    with pytest.raises(igdb.IGDBError) as exc:
        await igdb.fetch_igdb_game_detail(7)
    assert exc.value.status_code == (504 if isinstance(error, httpx.TimeoutException) else 502)


async def _completed():
    return None


@pytest.mark.anyio
@pytest.mark.parametrize("function", [igdb.fetch_igdb_upcoming_games, igdb.fetch_igdb_trending_games])
async def test_igdb_list_maps_http_status_error(monkeypatch, function):
    monkeypatch.setattr(igdb, "IGDB_API_KEY", "key")
    monkeypatch.setattr(igdb.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(get_result=FakeResponse({}, 503)))
    with pytest.raises(igdb.IGDBError, match="503") as exc:
        await function()
    assert exc.value.status_code == 502


@pytest.mark.anyio
async def test_itad_success_uses_title_and_url_fallback_and_country(monkeypatch):
    monkeypatch.setenv("ITAD_API_KEY", "key")
    calls = []

    class Client(FakeAsyncClient):
        async def get(self, url, **kwargs):
            calls.append(("get", url, kwargs))
            return FakeResponse({"found": True, "game": {"id": "g1"}})

        async def post(self, url, **kwargs):
            calls.append(("post", url, kwargs))
            return FakeResponse([{"deals": [], "historyLow": {}}])

    monkeypatch.setattr(prices.httpx, "AsyncClient", Client)
    result = await prices.fetch_game_price_history("Fallback title", country="UA")
    assert result["title"] == "Fallback title"
    assert result["url"].endswith("id:g1/")
    assert calls[1][2]["params"]["country"] == "UA"


def _xlsx(rows, sheet="Game Library"):
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = sheet
    for row in rows:
        worksheet.append(row)
    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()


def test_psn_parser_skips_invalid_values_and_missing_columns():
    content = _xlsx([("Game Title", "Other"), (None, "x"), (123, "x"), (" " * 256, "x"), ("Valid", "x")])
    assert psn_export.parse_psn_export(content) == ["Valid"]
    with pytest.raises(HTTPException, match="No game list"):
        psn_export.parse_psn_export(_xlsx([("Email",), ("a@test",)], sheet="Account"))


def test_psn_parser_handles_short_transaction_rows():
    content = _xlsx([("Game Name", "Content Type"), ("Game",), ("Hades", "Game")], sheet="Transaction Detail")
    assert psn_export.parse_psn_export(content) == ["Hades"]
    assert psn_export.normalize_title(None) is None
    assert psn_export.normalize_title("x" * 256) is None


@pytest.mark.anyio
async def test_google_verify_rejects_unknown_signing_key(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client")
    monkeypatch.setattr(google_auth.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient(get_result=FakeResponse({"keys": []})))
    monkeypatch.setattr(google_auth.jwt, "get_unverified_header", lambda token: {"kid": "missing"})
    with pytest.raises(ValueError, match="Unknown Google signing key"):
        await google_auth.verify_google_id_token("token", "nonce")


def test_telegram_configuration_url_parse_and_send_edges(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_BOT_USERNAME", raising=False)
    assert telegram.telegram_configured() is False
    with pytest.raises(HTTPException, match="username"):
        telegram.build_telegram_link_url("token")
    with pytest.raises(HTTPException, match="chat id"):
        telegram.parse_start_token({"message": {"text": "/start token", "chat": {}}})

    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "bot")
    monkeypatch.setattr(telegram.httpx, "post", lambda *a, **k: FakeResponse(status_code=500))
    assert telegram.send_telegram_message("1", "hello") is False
    assert telegram.telegram_linked_at().tzinfo is not None
