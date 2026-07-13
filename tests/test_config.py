from app.integrations.rawg import get_float_env
from app.main import get_allowed_origins, get_backend_public_url, get_frontend_url
from app.openai_client import fallback_or_raise, fallback_recommendations, get_recommendation
from fastapi import HTTPException


def test_get_float_env_uses_default_for_missing_empty_or_invalid_values(monkeypatch):
    monkeypatch.delenv("RAWG_TIMEOUT_SECONDS", raising=False)
    assert get_float_env("RAWG_TIMEOUT_SECONDS", 12.0) == 12.0

    monkeypatch.setenv("RAWG_TIMEOUT_SECONDS", "")
    assert get_float_env("RAWG_TIMEOUT_SECONDS", 12.0) == 12.0

    monkeypatch.setenv("RAWG_TIMEOUT_SECONDS", "not-a-number")
    assert get_float_env("RAWG_TIMEOUT_SECONDS", 12.0) == 12.0


def test_get_float_env_parses_valid_float(monkeypatch):
    monkeypatch.setenv("RAWG_TIMEOUT_SECONDS", "3.5")
    assert get_float_env("RAWG_TIMEOUT_SECONDS", 12.0) == 3.5


def test_get_allowed_origins_reads_comma_separated_frontend_origins(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://web.example.com, http://localhost:3000/")

    origins = get_allowed_origins()

    assert "http://localhost:3000" in origins
    assert "https://web.example.com" in origins


def test_get_frontend_url_prefers_public_frontend_url(monkeypatch):
    monkeypatch.setenv("FRONTEND_PUBLIC_URL", "https://web.example.com/")
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://other.example.com")

    assert get_frontend_url() == "https://web.example.com"


def test_get_backend_public_url_uses_railway_https(monkeypatch):
    class Request:
        base_url = "http://internal.example/"

    monkeypatch.delenv("BACKEND_PUBLIC_URL", raising=False)
    monkeypatch.setenv("RAILWAY_PUBLIC_DOMAIN", "game-finder.up.railway.app")

    assert get_backend_public_url(Request()) == "https://game-finder.up.railway.app"


def test_ai_fallback_can_be_disabled(monkeypatch):
    monkeypatch.setenv("AI_FALLBACK_ENABLED", "false")

    try:
        fallback_or_raise("dark rpg", "OpenAI unavailable")
    except HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail == "OpenAI unavailable"
    else:
        raise AssertionError("fallback_or_raise should raise when fallback is disabled")


def test_fallback_uses_steam_like_game_titles():
    data = fallback_recommendations(
        "My most played Steam games:\n1. Portal - 12.0 hours played\n2. Half-Life 2 - 8.0 hours played"
    )

    titles = [item["title"] for item in data["recommendations"]]
    assert "The Talos Principle 2" in titles
    assert len(titles) == 8
    assert len(set(titles)) == 8


def test_missing_openai_key_does_not_use_fallback(monkeypatch):
    monkeypatch.setenv("AI_FALLBACK_ENABLED", "true")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    try:
        get_recommendation("dark rpg", [])
    except HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail == "OpenAI client is not configured"
    else:
        raise AssertionError("missing OPENAI_API_KEY should not return fallback recommendations")


def test_invalid_openai_timeout_does_not_use_fallback(monkeypatch):
    class FakeResponses:
        def create(self, **_kwargs):
            raise AssertionError("client call should not happen when timeout config is invalid")

    class FakeClient:
        responses = FakeResponses()

    monkeypatch.setenv("AI_FALLBACK_ENABLED", "true")
    monkeypatch.setenv("OPENAI_TIMEOUT_SECONDS", "not-a-number")
    monkeypatch.setattr("app.openai_client.get_client", lambda: FakeClient())

    try:
        get_recommendation("dark rpg", [])
    except HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail == "OPENAI_TIMEOUT_SECONDS must be a number"
    else:
        raise AssertionError("invalid OPENAI_TIMEOUT_SECONDS should not return fallback recommendations")


def test_unexpected_openai_client_error_does_not_use_fallback(monkeypatch):
    class FakeResponses:
        def create(self, **_kwargs):
            raise RuntimeError("SDK mismatch")

    class FakeClient:
        responses = FakeResponses()

    monkeypatch.setenv("AI_FALLBACK_ENABLED", "true")
    monkeypatch.setenv("OPENAI_TIMEOUT_SECONDS", "8")
    monkeypatch.setattr("app.openai_client.get_client", lambda: FakeClient())

    try:
        get_recommendation("dark rpg", [])
    except HTTPException as exc:
        assert exc.status_code == 500
        assert exc.detail == "OpenAI recommendations failed"
    else:
        raise AssertionError("unexpected OpenAI client errors should not return fallback recommendations")
