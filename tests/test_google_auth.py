from urllib.parse import parse_qs, urlparse

from app.google_auth import build_google_authorization_url, code_challenge, normalize_email
from app.main import steam_sign_in_email


def test_google_authorization_url_uses_oidc_pkce(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://api.example.test/auth/google/callback")

    url = build_google_authorization_url("state-value", "verifier-value", "nonce-value")
    query = parse_qs(urlparse(url).query)

    assert query["response_type"] == ["code"]
    assert query["scope"] == ["openid email profile"]
    assert query["state"] == ["state-value"]
    assert query["nonce"] == ["nonce-value"]
    assert query["code_challenge_method"] == ["S256"]
    assert query["code_challenge"] == [code_challenge("verifier-value")]


def test_email_normalization_is_case_insensitive():
    assert normalize_email("  Player@Example.COM ") == "player@example.com"


def test_steam_only_accounts_use_a_stable_non_deliverable_email():
    assert steam_sign_in_email("76561198000000000") == "steam-76561198000000000@steam.invalid"
