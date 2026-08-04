import httpx
import pytest
from fastapi import HTTPException

from app import google_auth, prices
from app.integrations import igdb


class Response:
    def __init__(self, payload=None, status_code=200):
        self.payload = payload if payload is not None else {}
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("GET", "https://provider.test")
            raise httpx.HTTPStatusError(
                f"HTTP {self.status_code}",
                request=request,
                response=httpx.Response(self.status_code, request=request, json=self.payload),
            )

    def json(self):
        return self.payload


class AsyncClient:
    def __init__(self, get_result=None, post_result=None, error=None, *args, **kwargs):
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


def status_error(status):
    request = httpx.Request("GET", "https://provider.test")
    return httpx.HTTPStatusError("failure", request=request, response=httpx.Response(status, request=request))


def test_google_configured_requires_all_credentials(monkeypatch):
    for name in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"):
        monkeypatch.delenv(name, raising=False)
        assert google_auth.google_configured() is False
        monkeypatch.setenv(name, " value ")
    assert google_auth.google_configured() is True


@pytest.mark.anyio
async def test_google_exchange_success_and_http_error(monkeypatch):
    for name, value in {
        "GOOGLE_CLIENT_ID": "client",
        "GOOGLE_CLIENT_SECRET": "secret",
        "GOOGLE_REDIRECT_URI": "https://app.test/callback",
    }.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setattr(google_auth.httpx, "AsyncClient", lambda *a, **k: AsyncClient(post_result=Response({"id_token": "token"})))
    assert await google_auth.exchange_google_code("code", "verifier") == {"id_token": "token"}
    monkeypatch.setattr(google_auth.httpx, "AsyncClient", lambda *a, **k: AsyncClient(post_result=Response(status_code=400)))
    with pytest.raises(httpx.HTTPStatusError):
        await google_auth.exchange_google_code("code", "verifier")


@pytest.mark.anyio
async def test_google_verify_success_nonce_and_claim_errors(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client")
    monkeypatch.setattr(google_auth.httpx, "AsyncClient", lambda *a, **k: AsyncClient(get_result=Response({"keys": [{"kid": "key"}]})))
    monkeypatch.setattr(google_auth.jwt, "get_unverified_header", lambda token: {"kid": "key"})
    claims = {"iss": "accounts.google.com", "nonce": "nonce", "email_verified": True, "email": "a@b.test", "sub": "sub"}
    monkeypatch.setattr(google_auth.jwt, "decode", lambda *a, **k: claims)
    assert await google_auth.verify_google_id_token("token", "nonce") == claims
    with pytest.raises(ValueError, match="Invalid Google identity token"):
        await google_auth.verify_google_id_token("token", "wrong")
    claims["email"] = None
    with pytest.raises(ValueError, match="email is not verified"):
        await google_auth.verify_google_id_token("token", "nonce")


@pytest.mark.anyio
async def test_google_verify_maps_jwks_http_and_jwt_errors(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client")
    monkeypatch.setattr(google_auth.httpx, "AsyncClient", lambda *a, **k: AsyncClient(error=status_error(500)))
    with pytest.raises(httpx.HTTPStatusError):
        await google_auth.verify_google_id_token("token", "nonce")
    monkeypatch.setattr(google_auth.httpx, "AsyncClient", lambda *a, **k: AsyncClient(get_result=Response({"keys": [{"kid": "key"}]})))
    monkeypatch.setattr(google_auth.jwt, "get_unverified_header", lambda token: {"kid": "key"})
    monkeypatch.setattr(google_auth.jwt, "decode", lambda *a, **k: (_ for _ in ()).throw(google_auth.JWTError("bad")))
    with pytest.raises(ValueError, match="Invalid Google identity token"):
        await google_auth.verify_google_id_token("token", "nonce")


@pytest.mark.anyio
@pytest.mark.parametrize("function", [igdb.fetch_igdb_games, igdb.fetch_igdb_upcoming_games, igdb.fetch_igdb_trending_games, igdb.fetch_igdb_game_detail])
async def test_igdb_functions_require_api_key(monkeypatch, function):
    monkeypatch.setattr(igdb, "IGDB_API_KEY", None)
    with pytest.raises(igdb.IGDBError, match="missing"):
        if function is igdb.fetch_igdb_games:
            await function("game")
        elif function is igdb.fetch_igdb_game_detail:
            await function(1)
        else:
            await function()


@pytest.mark.anyio
@pytest.mark.parametrize("function", [igdb.fetch_igdb_upcoming_games, igdb.fetch_igdb_trending_games])
@pytest.mark.parametrize("error", [httpx.TimeoutException("timeout"), httpx.RequestError("request")])
async def test_igdb_list_errors(monkeypatch, function, error):
    monkeypatch.setattr(igdb, "IGDB_API_KEY", "key")
    monkeypatch.setattr(igdb.httpx, "AsyncClient", lambda *a, **k: AsyncClient(error=error))
    with pytest.raises(igdb.IGDBError) as exc:
        await function()
    assert exc.value.status_code in {502, 504}


@pytest.mark.anyio
@pytest.mark.parametrize("status,expected", [(404, 404), (500, 502)])
async def test_igdb_detail_http_status(monkeypatch, status, expected):
    monkeypatch.setattr(igdb, "IGDB_API_KEY", "key")
    monkeypatch.setattr(igdb.httpx, "AsyncClient", lambda *a, **k: AsyncClient(get_result=Response(status_code=status)))
    with pytest.raises(igdb.IGDBError) as exc:
        await igdb.fetch_igdb_game_detail(1)
    assert exc.value.status_code == expected


@pytest.mark.parametrize("payload,expected", [({"reason_phrase": " bad "}, "bad"), ({"detail": "detail"}, "detail"), ({"message": "message"}, "message"), ({}, "request failed")])
def test_itad_error_message_variations(payload, expected):
    assert prices._itad_error_message(Response(payload)) == expected


@pytest.mark.anyio
@pytest.mark.parametrize("status,expected", [(401, 502), (429, 429), (500, 502)])
async def test_itad_price_history_status_errors(monkeypatch, status, expected):
    monkeypatch.setenv("ITAD_API_KEY", "key")
    monkeypatch.setattr(prices.httpx, "AsyncClient", lambda *a, **k: AsyncClient(get_result=Response({"detail": "bad"}, status)))
    with pytest.raises(HTTPException) as exc:
        await prices.fetch_game_price_history("Game")
    assert exc.value.status_code == expected


@pytest.mark.anyio
async def test_itad_empty_lookup_prices_and_transport_error(monkeypatch):
    monkeypatch.setenv("ITAD_API_KEY", "key")
    monkeypatch.setattr(prices.httpx, "AsyncClient", lambda *a, **k: AsyncClient(get_result=Response({"found": False})))
    with pytest.raises(HTTPException) as exc:
        await prices.fetch_game_price_history("Game")
    assert exc.value.status_code == 404
    responses = [Response({"found": True, "game": {"id": "g"}}), Response([])]
    monkeypatch.setattr(prices.httpx, "AsyncClient", lambda *a, **k: AsyncClient(get_result=responses[0], post_result=responses[1]))
    with pytest.raises(HTTPException) as exc:
        await prices.fetch_game_price_history("Game")
    assert exc.value.status_code == 404
    monkeypatch.setattr(prices.httpx, "AsyncClient", lambda *a, **k: AsyncClient(error=httpx.RequestError("offline")))
    with pytest.raises(HTTPException) as exc:
        await prices.fetch_game_price_history("Game")
    assert exc.value.status_code == 502
