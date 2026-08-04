import pytest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace


def test_normalize_igdb_game_uses_igdb_identity_and_steam_external_id():
    from app.integrations.igdb import normalize_igdb_game

    result = normalize_igdb_game(
        {
            "id": 274755,
            "name": "Hades II",
            "first_release_date": 1712880000,
            "cover": {"url": "//images.igdb.com/igdb/image/upload/t_thumb/cover.jpg"},
            "genres": [{"name": "RPG"}],
            "platforms": [{"name": "PC (Microsoft Windows)"}],
            "external_games": [{"category": 1, "uid": "1145350"}],
        }
    )

    assert result["id"] == 274755
    assert result["name"] == "Hades II"
    assert result["background_image"].startswith("https://")
    assert result["steam_appid"] == 1145350
    assert result["genres"] == ["RPG"]


@pytest.mark.anyio
async def test_igdb_missing_credentials_is_a_service_error(monkeypatch):
    monkeypatch.delenv("IGDB_CLIENT_ID", raising=False)
    monkeypatch.delenv("IGDB_CLIENT_SECRET", raising=False)
    from app.integrations.igdb import IGDBError, fetch_igdb_games

    with pytest.raises(IGDBError, match="IGDB_CLIENT_ID"):
        await fetch_igdb_games("Hades")


@pytest.mark.anyio
async def test_igdb_oauth_token_is_cached(monkeypatch):
    import app.integrations.igdb as client

    class Response:
        def raise_for_status(self): pass
        def json(self): return {"access_token": "token", "expires_in": 3600}
    class Http:
        async def __aenter__(self): return self
        async def __aexit__(self, *_): pass
        async def post(self, *_args, **_kwargs): return Response()

    client._token = None
    client._token_expires_at = 0
    monkeypatch.setenv("IGDB_CLIENT_ID", "client")
    monkeypatch.setenv("IGDB_CLIENT_SECRET", "secret")
    monkeypatch.setattr(client.httpx, "AsyncClient", lambda **_: Http())
    assert await client._access_token() == ("client", "token")
    assert await client._access_token() == ("client", "token")


@pytest.mark.anyio
async def test_catalog_cache_returns_stale_snapshot_when_igdb_is_down():
    from app.catalog_cache import get_cached_snapshot
    from app.database import CatalogGameCache
    from app.integrations.igdb import IGDBError

    cached = CatalogGameCache(igdb_id=7, snapshot={"id": 7, "name": "Cached"}, fetched_at=datetime.now(timezone.utc) - timedelta(days=2))
    class Db:
        def get(self, _model, _id): return cached
        def commit(self): raise AssertionError("stale fallback must not write")
    async def unavailable(_id): raise IGDBError("offline")
    assert await get_cached_snapshot(Db(), 7, unavailable) == {"id": 7, "name": "Cached"}
