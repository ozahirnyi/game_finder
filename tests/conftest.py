import os

import pytest


os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("RAWG_API_KEY", "test-rawg-key")


@pytest.fixture(autouse=True)
def no_live_external_http(monkeypatch):
    """Block unmocked external HTTP calls across the backend test suite."""
    import httpx

    async def blocked_async_http(*_args, **_kwargs):
        raise AssertionError("Live external HTTP is forbidden in backend tests")

    def blocked_sync_http(*_args, **_kwargs):
        raise AssertionError("Live external HTTP is forbidden in backend tests")

    monkeypatch.setattr(httpx.AsyncClient, "request", blocked_async_http)
    monkeypatch.setattr(httpx.AsyncClient, "get", blocked_async_http)
    monkeypatch.setattr(httpx.AsyncClient, "post", blocked_async_http)
    monkeypatch.setattr(httpx, "get", blocked_sync_http)
    monkeypatch.setattr(httpx, "post", blocked_sync_http)
