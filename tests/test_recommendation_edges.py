import json
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.openai_client as openai_client
import app.main as app_main
import app.steam_recommendations as steam_recommendations
from app.recommendation_quota import QuotaSnapshot
from app.schemas import RecommendationRequest


def _games():
    return [{"appid": 10, "name": "Owned", "playtime_forever": 60}]


@pytest.mark.anyio
async def test_recommendations_enqueue_without_calling_the_provider(monkeypatch):
    snapshot = QuotaSnapshot(3, 3, None, datetime(2026, 9, 2, tzinfo=timezone.utc))
    calls = {"checked": 0, "dispatched": []}
    user = type("User", (), {"id": uuid.uuid4()})()
    job = SimpleNamespace(id=uuid.uuid4(), status="queued", result=None, error=None)

    def check_quota(_db, user_id):
        assert user_id == user.id
        calls["checked"] += 1
        return snapshot

    monkeypatch.setattr(app_main, "check_quota_available", check_quota)
    monkeypatch.setattr(app_main, "enqueue_or_get_job", lambda *_args: job)
    monkeypatch.setattr(
        app_main,
        "get_recommendation",
        lambda *_args: (_ for _ in ()).throw(AssertionError("provider must run in worker")),
    )

    async def dispatch(queued_job):
        calls["dispatched"].append(queued_job.id)

    monkeypatch.setattr(app_main, "dispatch_job", dispatch)

    result = await app_main.recommendations.__wrapped__(
        object(), RecommendationRequest(prompt="cozy games"), object(), user
    )

    assert result.id == job.id
    assert calls == {"checked": 1, "dispatched": [job.id]}


@pytest.mark.anyio
async def test_recommendations_do_not_call_the_provider_during_submission(monkeypatch):
    snapshot = QuotaSnapshot(3, 3, None, datetime(2026, 9, 2, tzinfo=timezone.utc))
    user = type("User", (), {"id": uuid.uuid4()})()
    job = SimpleNamespace(id=uuid.uuid4(), status="running", result=None, error=None)
    monkeypatch.setattr(app_main, "check_quota_available", lambda *_args: snapshot)
    monkeypatch.setattr(app_main, "enqueue_or_get_job", lambda *_args: job)
    monkeypatch.setattr(app_main, "get_recommendation", lambda *_args: (_ for _ in ()).throw(AssertionError("inline provider call")))

    result = await app_main.recommendations.__wrapped__(
        object(), RecommendationRequest(prompt="cozy games"), object(), user
    )

    assert result.status == "running"


@pytest.mark.anyio
async def test_worker_propagates_catalog_resolution_failure_to_its_failure_boundary(monkeypatch):
    snapshot = QuotaSnapshot(3, 3, None, datetime(2026, 9, 2, tzinfo=timezone.utc))
    from app import worker
    monkeypatch.setattr(worker, "get_recommendation", lambda *_args: {"recommendations": [{"title": "Hades"}]})

    async def catalog_failure(*_args):
        raise RuntimeError("catalog unavailable")

    monkeypatch.setattr(worker, "enrich_recommendations", catalog_failure)

    with pytest.raises(RuntimeError, match="catalog unavailable"):
        await worker.execute_background_operation(
            object(), SimpleNamespace(operation="recommendations", payload={"prompt": "cozy games"})
        )


@pytest.mark.anyio
async def test_steam_library_cache_miss_calls_ai_normalizes_and_sets_cache(monkeypatch):
    calls = {}

    async def cache_get(key):
        calls["key"] = key
        return None

    async def cache_set(key, value, ttl):
        calls["set"] = (key, value, ttl)

    def ai(prompt, excluded):
        calls["ai"] = (prompt, excluded)
        return {"recommendations": [{"title": " Hades ", "reason": "fun", "tags": ["action"]}]}

    async def normalize(result, owned):
        calls["normalize"] = (result, owned)
        return [{"title": "Hades"}]

    monkeypatch.setattr(steam_recommendations, "cache_get", cache_get)
    monkeypatch.setattr(steam_recommendations, "cache_set", cache_set)
    monkeypatch.setattr(steam_recommendations, "get_recommendation", ai)
    monkeypatch.setattr(steam_recommendations, "normalize_recommendations", normalize)
    result = await steam_recommendations.get_cached_steam_recommendations(uuid.uuid4(), _games(), "request")
    assert result["recommendations"] == [{"title": "Hades"}]
    assert calls["ai"][1] == [10]
    assert calls["set"][2] == steam_recommendations.CACHE_TTL_SECONDS


@pytest.mark.anyio
async def test_steam_cache_get_and_set_errors_are_ignored(monkeypatch):
    async def broken_get(_key):
        raise RuntimeError("redis down")

    async def broken_set(*_args):
        raise RuntimeError("redis down")

    monkeypatch.setattr(steam_recommendations, "cache_get", broken_get)
    monkeypatch.setattr(steam_recommendations, "cache_set", broken_set)
    monkeypatch.setattr(steam_recommendations, "get_recommendation", lambda *_: {"recommendations": []})
    assert (await steam_recommendations.get_cached_steam_recommendations(uuid.uuid4(), _games()))["recommendations"] == []


def test_openai_get_client_requires_key_and_constructs_client(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
        openai_client.get_client()
    created = {}
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(openai_client, "OpenAI", lambda **kwargs: created.update(kwargs) or "client")
    assert openai_client.get_client() == "client"
    assert created == {"api_key": "test-key", "max_retries": 0}


def test_openai_recommendation_success_and_timeout_config(monkeypatch):
    class Responses:
        def create(self, **kwargs):
            assert kwargs["timeout"] == 2.5
            return type("Response", (), {"output_text": json.dumps({"recommendations": [{"title": "Hades", "reason": "fast", "tags": []}]})})()

    monkeypatch.setattr(openai_client, "get_client", lambda: type("Client", (), {"responses": Responses()})())
    monkeypatch.setenv("OPENAI_TIMEOUT_SECONDS", "2.5")
    result = openai_client.get_recommendation("action", [1])
    assert result["recommendations"][0]["title"] == "Hades"
    monkeypatch.setenv("OPENAI_TIMEOUT_SECONDS", "bad")
    with pytest.raises(HTTPException, match="must be a number"):
        openai_client.get_recommendation("action", [])


@pytest.mark.parametrize("error_name,detail,status", [
    ("RateLimitError", "fallback", None),
    ("APIConnectionError", "fallback", None),
    ("APITimeoutError", "fallback", None),
    ("AuthenticationError", "authentication or permission", 503),
    ("PermissionDeniedError", "authentication or permission", 503),
    ("APIStatusError", "fallback", None),
    ("ValueError", "fallback", None),
    ("RuntimeError", "recommendations failed", 500),
])
def test_openai_error_branches_and_fallback(monkeypatch, error_name, detail, status):
    error_type = {"ValueError": ValueError, "RuntimeError": RuntimeError}.get(error_name, type(error_name, (Exception,), {}))
    if error_name not in {"ValueError", "RuntimeError"}:
        monkeypatch.setattr(openai_client, error_name, error_type)
    if error_name == "APIStatusError":
        error_type.__init__ = lambda self: setattr(self, "status_code", 429)
    monkeypatch.setattr(openai_client, "get_client", lambda: type("Client", (), {"responses": type("R", (), {"create": lambda *_a, **_k: (_ for _ in ()).throw(error_type())})()})())
    monkeypatch.setattr(openai_client, "fallback_recommendations", lambda prompt: {"fallback": prompt})
    monkeypatch.setenv("AI_FALLBACK_ENABLED", "true")
    if status is None:
        assert openai_client.get_recommendation("prompt", []) == {"fallback": "prompt"}
    else:
        with pytest.raises(HTTPException) as exc:
            openai_client.get_recommendation("prompt", [])
        assert exc.value.status_code == status
        assert detail in str(exc.value.detail)


def test_openai_fallback_disabled_raises_503(monkeypatch):
    error_type = type("RateLimitError", (Exception,), {})
    monkeypatch.setattr(openai_client, "RateLimitError", error_type)
    monkeypatch.setattr(openai_client, "get_client", lambda: type("C", (), {"responses": type("R", (), {"create": lambda *_a, **_k: (_ for _ in ()).throw(error_type())})()})())
    monkeypatch.setenv("AI_FALLBACK_ENABLED", "false")
    with pytest.raises(HTTPException, match="rate limit"):
        openai_client.get_recommendation("prompt", [])


def test_openai_provider_failure_is_unavailable_by_default(monkeypatch):
    error_type = type("RateLimitError", (Exception,), {})
    monkeypatch.setattr(openai_client, "RateLimitError", error_type)
    monkeypatch.setattr(
        openai_client,
        "get_client",
        lambda: type("C", (), {"responses": type("R", (), {"create": lambda *_a, **_k: (_ for _ in ()).throw(error_type())})()})(),
    )
    monkeypatch.delenv("AI_FALLBACK_ENABLED", raising=False)

    with pytest.raises(HTTPException) as exc:
        openai_client.get_recommendation("prompt", [])

    assert exc.value.status_code == 503
    assert exc.value.detail["code"] == "ai_recommendations_unavailable"
