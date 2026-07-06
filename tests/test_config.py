from app.integrations.rawg import get_float_env
from app.main import get_allowed_origins
from app.openai_client import fallback_or_raise
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


def test_ai_fallback_can_be_disabled(monkeypatch):
    monkeypatch.setenv("AI_FALLBACK_ENABLED", "false")

    try:
        fallback_or_raise("dark rpg", "OpenAI unavailable")
    except HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail == "OpenAI unavailable"
    else:
        raise AssertionError("fallback_or_raise should raise when fallback is disabled")
