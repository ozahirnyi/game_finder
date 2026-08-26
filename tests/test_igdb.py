import pytest
from datetime import datetime, timedelta, timezone


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
            "game_type": {"type": 0},
            "external_games": [{"category": 1, "uid": "1145350"}],
        }
    )

    assert result["id"] == 274755
    assert result["name"] == "Hades II"
    assert result["background_image"].startswith("https://")
    assert result["steam_appid"] == 1145350
    assert result["genres"] == ["RPG"]
    assert result["game_type"] == 0


def test_normalize_igdb_game_uses_total_rating_when_critic_rating_is_missing():
    from app.integrations.igdb import normalize_igdb_game

    assert normalize_igdb_game({"id": 1, "name": "Rated", "total_rating": 87.5})["rating"] == 87.5


@pytest.mark.anyio
async def test_igdb_roguelike_filter_uses_real_keyword_metadata(monkeypatch):
    import app.integrations.igdb as client

    captured = {}

    async def query(_endpoint, query):
        captured["query"] = query
        return []

    monkeypatch.setattr(client, "_query", query)

    await client.fetch_igdb_games(
        "",
        filters=client.CatalogSearchFilters(genres=("roguelike",)),
    )

    assert 'keywords.name = "Roguelike"' in captured["query"]
    assert "game_type.type" in captured["query"]


@pytest.mark.anyio
async def test_igdb_discovery_filters_use_a_single_valid_sort(monkeypatch):
    import app.integrations.igdb as client

    captured = {}

    async def query(_endpoint, statement):
        captured["statement"] = statement
        return []

    monkeypatch.setattr(client, "_query", query)

    await client.fetch_igdb_games(
        "",
        filters=client.CatalogSearchFilters(platforms=("pc",), genres=("adventure",)),
    )

    assert "platforms = (6,14,3) & genres = 31" in captured["statement"]
    assert "sort total_rating_count desc;" in captured["statement"]
    assert "sort total_rating_count desc, rating desc;" not in captured["statement"]


@pytest.mark.anyio
async def test_igdb_uses_the_real_game_mode_ids(monkeypatch):
    import app.integrations.igdb as client

    captured = {}

    async def query(_endpoint, statement):
        captured["statement"] = statement
        return []

    monkeypatch.setattr(client, "_query", query)

    await client.fetch_igdb_games(
        "",
        filters=client.CatalogSearchFilters(features=("single_player", "multiplayer", "co_op")),
    )

    assert "game_modes = 1" in captured["statement"]
    assert "game_modes = 2" in captured["statement"]
    assert "game_modes = 3" in captured["statement"]


@pytest.mark.anyio
async def test_igdb_missing_credentials_is_a_service_error(monkeypatch):
    monkeypatch.delenv("IGDB_CLIENT_ID", raising=False)
    monkeypatch.delenv("IGDB_CLIENT_SECRET", raising=False)
    from app.integrations.igdb import IGDBError, fetch_igdb_games

    with pytest.raises(IGDBError, match="IGDB_CLIENT_ID"):
        await fetch_igdb_games("Hades")

    monkeypatch.setenv("IGDB_CLIENT_ID", "client")
    with pytest.raises(IGDBError, match="IGDB_CLIENT_SECRET"):
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
async def test_igdb_oauth_rejects_missing_token_and_empty_detail(monkeypatch):
    import app.integrations.igdb as client
    class Response:
        def raise_for_status(self): pass
        def json(self): return {}
    class Http:
        async def __aenter__(self): return self
        async def __aexit__(self, *_): pass
        async def post(self, *_args, **_kwargs): return Response()
    client._token = None
    monkeypatch.setenv("IGDB_CLIENT_ID", "client")
    monkeypatch.setenv("IGDB_CLIENT_SECRET", "secret")
    monkeypatch.setattr(client.httpx, "AsyncClient", lambda **_: Http())
    with pytest.raises(client.IGDBError, match="access token"):
        await client._access_token()
    async def empty(*_): return []
    monkeypatch.setattr(client, "_query", empty)
    with pytest.raises(client.IGDBError, match="not found"):
        await client.fetch_igdb_game_detail(1)


@pytest.mark.anyio
@pytest.mark.parametrize("error,status", [(__import__("httpx").TimeoutException("timeout"), 504), (__import__("httpx").RequestError("offline"), 502)])
async def test_igdb_oauth_and_query_map_transport_errors(monkeypatch, error, status):
    import app.integrations.igdb as client
    import httpx
    class Http:
        async def __aenter__(self): return self
        async def __aexit__(self, *_): pass
        async def post(self, *_args, **_kwargs): raise error
    client._token = None
    monkeypatch.setenv("IGDB_CLIENT_ID", "client")
    monkeypatch.setenv("IGDB_CLIENT_SECRET", "secret")
    monkeypatch.setattr(client.httpx, "AsyncClient", lambda **_: Http())
    with pytest.raises(client.IGDBError) as exc:
        await client._access_token()
    assert exc.value.status_code == status

    async def token(): return "client", "token"
    monkeypatch.setattr(client, "_access_token", token)
    with pytest.raises(client.IGDBError) as exc:
        await client._query("games", "fields id;")
    assert exc.value.status_code == status


@pytest.mark.anyio
async def test_igdb_query_maps_http_status_and_normalizes_payload(monkeypatch):
    import httpx
    import app.integrations.igdb as client

    class Response:
        status_code = 404
        request = httpx.Request("POST", "https://example.test")
        def raise_for_status(self):
            raise httpx.HTTPStatusError("missing", request=self.request, response=self)
    class Http:
        async def __aenter__(self): return self
        async def __aexit__(self, *_): pass
        async def post(self, *_args, **_kwargs): return Response()
    async def token(): return "client", "token"

    monkeypatch.setattr(client, "_access_token", token)
    monkeypatch.setattr(client.httpx, "AsyncClient", lambda **_: Http())
    with pytest.raises(client.IGDBError) as exc:
        await client._query("games", "fields id;")
    assert exc.value.status_code == 404

    class PayloadResponse:
        def raise_for_status(self): pass
        def json(self): return {"id": 2}
    class PayloadHttp:
        async def __aenter__(self): return self
        async def __aexit__(self, *_): pass
        async def post(self, *_args, **_kwargs): return PayloadResponse()
    monkeypatch.setattr(client.httpx, "AsyncClient", lambda **_: PayloadHttp())
    assert await client._query("games", "fields id;") == [{"id": 2}]


def test_catalog_cache_ttl_uses_safe_default_for_invalid_value(monkeypatch):
    from app.catalog_cache import _ttl_seconds

    monkeypatch.setenv("IGDB_CACHE_TTL_SECONDS", "not-a-number")
    assert _ttl_seconds() == 86400


@pytest.mark.anyio
async def test_catalog_cache_falls_back_to_fetch_before_migration():
    from sqlalchemy.exc import OperationalError
    from app.catalog_cache import get_cached_snapshot

    class Db:
        rolled_back = False
        def get(self, *_): raise OperationalError("select", {}, RuntimeError("missing table"))
        def rollback(self): self.rolled_back = True
    db = Db()
    async def fetch(_): return {"id": 11}

    assert await get_cached_snapshot(db, 11, fetch) == {"id": 11}
    assert db.rolled_back


@pytest.mark.anyio
async def test_catalog_cache_handles_simple_doubles_and_new_entries():
    from app.catalog_cache import get_cached_snapshot
    from app.integrations.igdb import IGDBError

    class NoSession: pass
    async def snapshot(_): return {"id": 12}
    assert await get_cached_snapshot(NoSession(), 12, snapshot) == {"id": 12}

    class Db:
        added = None
        def get(self, *_): return None
        def add(self, value): self.added = value
        def commit(self): pass
    db = Db()
    assert await get_cached_snapshot(db, 12, snapshot) == {"id": 12}
    assert db.added.igdb_id == 12

    async def unavailable(_): raise IGDBError("offline")
    with pytest.raises(IGDBError):
        await get_cached_snapshot(db, 13, unavailable)


@pytest.mark.anyio
async def test_igdb_helpers_query_strict_steam_id_and_catalog_lists(monkeypatch):
    import app.integrations.igdb as client

    calls = []
    async def query(endpoint, statement):
        calls.append(statement)
        if "websites.url" in statement:
            return [{"websites": [{"url": "https://store.example/game"}]}]
        return [{"id": 77, "name": "Exact", "external_games": [{"category": 1, "uid": "123"}]}]
    monkeypatch.setattr(client, "_query", query)

    assert await client.fetch_igdb_game_by_steam_appid(0) is None
    assert (await client.fetch_igdb_game_by_steam_appid(123))["steam_appid"] == 123
    assert 'external_games.uid = "123"' in calls[-1]
    assert await client.fetch_igdb_game_stores(77) == ["https://store.example/game"]
    assert (await client.fetch_igdb_upcoming_games())["results"][0]["id"] == 77
    assert (await client.fetch_igdb_trending_games())["results"][0]["id"] == 77


@pytest.mark.anyio
async def test_igdb_legacy_mock_seam_and_list_helpers(monkeypatch):
    import app.integrations.igdb as client

    assert client._float_env("IGDB_TEST_INVALID_FLOAT", 1.5) == 1.5
    monkeypatch.setenv("IGDB_TEST_INVALID_FLOAT", "invalid")
    assert client._float_env("IGDB_TEST_INVALID_FLOAT", 1.5) == 1.5
    monkeypatch.setattr(client, "IGDB_API_KEY", "mock-key")
    assert await client._access_token() == ("test-client", "mock-key")

    class Response:
        def raise_for_status(self): pass
        def json(self): return [{"id": 44, "name": "Mock"}]
    class Http:
        async def __aenter__(self): return self
        async def __aexit__(self, *_): pass
        async def post(self, *_args, **_kwargs): return None
        async def get(self, *_args, **_kwargs): return Response()
    monkeypatch.setattr(client.httpx, "AsyncClient", lambda **_: Http())
    assert (await client.fetch_igdb_games("Mock"))["results"][0]["id"] == 44
    assert (await client.fetch_igdb_game_detail(44))["name"] == "Mock"

    async def empty(*_): return []
    monkeypatch.setattr(client, "_query", empty)
    assert await client.fetch_igdb_game_stores(44) == []


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


@pytest.mark.anyio
async def test_catalog_cache_uses_fresh_and_refreshes_stale_entries():
    from app.catalog_cache import get_cached_snapshot
    from app.database import CatalogGameCache
    fresh = CatalogGameCache(igdb_id=8, snapshot={"id": 8}, fetched_at=datetime.now(timezone.utc))
    class Db:
        def __init__(self, cached): self.cached, self.commits = cached, 0
        def get(self, *_): return self.cached
        def commit(self): self.commits += 1
        def add(self, value): self.cached = value
    async def unexpected(_): raise AssertionError("fresh cache must be used")
    assert await get_cached_snapshot(Db(fresh), 8, unexpected) == {"id": 8}
    stale = CatalogGameCache(igdb_id=9, snapshot={"id": 9}, fetched_at=datetime.now(timezone.utc) - timedelta(days=2))
    db = Db(stale)
    async def fetch(_): return {"id": 9, "steam_appid": 10}
    assert await get_cached_snapshot(db, 9, fetch) == {"id": 9, "steam_appid": 10}
    assert db.commits == 1 and stale.steam_appid == 10
