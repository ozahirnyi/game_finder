from datetime import datetime, timedelta, timezone

import pytest

from app.database import OAuthAuthorizationTransaction, OAuthIdentity, User


pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def sqlite_utcnow(app_main, monkeypatch):
    monkeypatch.setattr(app_main, "utcnow", lambda: datetime.now())


def location(response):
    return response.headers["location"]


def test_google_callback_rejects_error_and_missing_parameters(api_client):
    failed = api_client.get("/auth/google/callback?error=access_denied", follow_redirects=False)
    missing = api_client.get("/auth/google/callback?code=code-only", follow_redirects=False)

    assert failed.status_code == 303
    assert "provider=google" in location(failed)
    assert "error=authorization_failed" in location(failed)
    assert missing.status_code == 303
    assert "error=authorization_failed" in location(missing)


def test_google_callback_rejects_invalid_and_expired_state(api_client, db_session):
    expired = OAuthAuthorizationTransaction(
        state="expired-google", code_verifier="v", nonce="n", mode="login",
        expires_at=datetime.now() - timedelta(minutes=1),
    )
    db_session.add(expired)
    db_session.commit()

    invalid = api_client.get("/auth/google/callback?code=c&state=unknown", follow_redirects=False)
    response = api_client.get("/auth/google/callback?code=c&state=expired-google", follow_redirects=False)

    assert invalid.status_code == 303 and "error=invalid_state" in location(invalid)
    assert response.status_code == 303 and "error=invalid_state" in location(response)
    assert db_session.get(OAuthAuthorizationTransaction, "expired-google") is None


def test_google_callback_creates_user_identity_and_exchange_transaction(api_client, app_main, db_session, monkeypatch):
    db_session.add(OAuthAuthorizationTransaction(
        state="google-state", code_verifier="verifier", nonce="nonce", mode="login",
        expires_at=datetime.now() + timedelta(minutes=5),
    ))
    db_session.commit()
    async def exchange(code, verifier):
        assert (code, verifier) == ("oauth-code", "verifier")
        return {"id_token": "id-token"}
    async def verify(token, nonce):
        assert (token, nonce) == ("id-token", "nonce")
        return {"sub": "google-sub", "email": "New@Example.COM", "name": "New Player"}
    monkeypatch.setattr(app_main, "exchange_google_code", exchange)
    monkeypatch.setattr(app_main, "verify_google_id_token", verify)
    monkeypatch.setattr(app_main, "random_token", lambda: "result-code")

    response = api_client.get("/auth/google/callback?code=oauth-code&state=google-state", follow_redirects=False)

    assert response.status_code == 303
    assert "exchange_code=result-code" in location(response)
    user = db_session.query(User).filter_by(email="new@example.com").one()
    assert db_session.query(OAuthIdentity).filter_by(provider_subject="google-sub", user_id=user.id).count() == 1
    result = db_session.query(OAuthAuthorizationTransaction).filter_by(exchange_code="result-code").one()
    assert result.result_user_id == user.id


def test_google_callback_external_failure_is_redirect_and_consumes_state(api_client, app_main, db_session, monkeypatch):
    db_session.add(OAuthAuthorizationTransaction(
        state="google-failure", code_verifier="v", nonce="n", mode="login",
        expires_at=datetime.now() + timedelta(minutes=5),
    ))
    db_session.commit()
    async def fail(*_args):
        raise RuntimeError("provider down")
    monkeypatch.setattr(app_main, "exchange_google_code", fail)

    response = api_client.get("/auth/google/callback?code=c&state=google-failure", follow_redirects=False)

    assert response.status_code == 303 and "error=authentication_failed" in location(response)
    assert db_session.get(OAuthAuthorizationTransaction, "google-failure") is None


@pytest.mark.parametrize("path", ["/auth/google/exchange", "/auth/steam/exchange"])
def test_oauth_exchange_rejects_unknown_code(api_client, path):
    response = api_client.post(path, json={"exchange_code": "unknown-exchange-code-123"})
    assert response.status_code == 401


def test_google_exchange_returns_token_and_deletes_result(api_client, app_main, db_session, user_factory, monkeypatch):
    user = user_factory(email="callback-exchange@example.com")
    transaction = OAuthAuthorizationTransaction(
        state="google-result", code_verifier="v", nonce="n", mode="result",
        exchange_code="google-result-exchange-code", result_user_id=user.id,
        expires_at=datetime.now() + timedelta(minutes=5),
    )
    db_session.add(transaction)
    db_session.commit()
    response = api_client.post("/auth/google/exchange", json={"exchange_code": transaction.exchange_code})
    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert db_session.get(OAuthAuthorizationTransaction, "google-result") is None


def test_steam_login_url_persists_login_transaction(api_client, app_main, db_session, monkeypatch):
    monkeypatch.setattr(app_main, "build_steam_login_url", lambda callback, realm: f"https://steam.test/login?return={callback}")
    response = api_client.get("/auth/steam/login-url")
    assert response.status_code == 200
    assert "https://steam.test/login" in response.json()["url"]
    transaction = db_session.query(OAuthAuthorizationTransaction).one()
    assert transaction.mode == "steam_login"
    assert transaction.state in response.json()["url"]


def test_steam_sign_in_callback_rejects_missing_or_invalid_state(api_client, db_session):
    missing = api_client.get("/auth/steam/callback", follow_redirects=False)
    invalid = api_client.get("/auth/steam/callback?state=missing", follow_redirects=False)
    assert missing.status_code == 303 and "error=authorization_failed" in location(missing)
    assert invalid.status_code == 303 and "error=invalid_state" in location(invalid)


def test_steam_sign_in_callback_creates_user_and_exchange_result(api_client, app_main, db_session, monkeypatch):
    db_session.add(OAuthAuthorizationTransaction(
        state="steam-state", code_verifier="unused", nonce="unused", mode="steam_login",
        expires_at=datetime.now() + timedelta(minutes=5),
    ))
    db_session.commit()
    async def verify(_params):
        return "76561198000000001"
    async def profile(_steam_id):
        return {"persona_name": "Steam Player", "avatar": "avatar", "country_code": "UA"}
    monkeypatch.setattr(app_main, "verify_steam_openid", verify)
    monkeypatch.setattr(app_main, "fetch_steam_profile", profile)
    monkeypatch.setattr(app_main, "random_token", lambda: "steam-result")

    response = api_client.get("/auth/steam/callback?state=steam-state&openid.mode=id_res", follow_redirects=False)

    assert response.status_code == 303 and "exchange_code=steam-result" in location(response)
    user = db_session.query(User).filter_by(steam_id="76561198000000001").one()
    assert user.steam_persona_name == "Steam Player"
    assert db_session.query(OAuthAuthorizationTransaction).filter_by(exchange_code="steam-result", result_user_id=user.id).count() == 1


def test_steam_sign_in_callback_provider_failure_returns_redirect(api_client, app_main, db_session, monkeypatch):
    db_session.add(OAuthAuthorizationTransaction(
        state="steam-failure", code_verifier="unused", nonce="unused", mode="steam_login",
        expires_at=datetime.now() + timedelta(minutes=5),
    ))
    db_session.commit()
    async def fail(_params):
        raise RuntimeError("invalid openid")
    monkeypatch.setattr(app_main, "verify_steam_openid", fail)
    response = api_client.get("/auth/steam/callback?state=steam-failure", follow_redirects=False)
    assert response.status_code == 303 and "error=authentication_failed" in location(response)
    assert db_session.get(OAuthAuthorizationTransaction, "steam-failure") is None


def test_authenticated_steam_login_url_uses_user_state(api_client, app_main, user_factory, auth_as, monkeypatch):
    user = auth_as(user_factory(email="steam-link@example.com"))
    monkeypatch.setattr(app_main, "create_steam_state", lambda user_id: f"state-for-{user_id}")
    monkeypatch.setattr(app_main, "build_steam_login_url", lambda callback, realm: callback)
    response = api_client.get("/steam/login-url")
    assert response.status_code == 200
    assert f"state-for-{user.id}" in response.json()["url"]


def test_authenticated_steam_callback_links_profile(api_client, app_main, db_session, user_factory, auth_as, monkeypatch):
    user = auth_as(user_factory(email="steam-link-success@example.com"))
    monkeypatch.setattr(app_main, "decode_steam_state", lambda state: str(user.id))
    async def verify(_params): return "76561198000000002"
    async def profile(_steam_id): return {"persona_name": "Linked", "avatar": "a", "country_code": "UA"}
    monkeypatch.setattr(app_main, "verify_steam_openid", verify)
    monkeypatch.setattr(app_main, "fetch_steam_profile", profile)
    response = api_client.get("/steam/callback?state=valid", follow_redirects=False)
    assert response.status_code == 303 and "linked=1" in location(response)
    db_session.refresh(user)
    assert user.steam_id == "76561198000000002"
    assert user.steam_persona_name == "Linked"


def test_authenticated_steam_callback_redirects_decode_error(api_client, app_main, user_factory, auth_as, monkeypatch):
    auth_as(user_factory(email="steam-link-invalid@example.com"))
    from fastapi import HTTPException
    monkeypatch.setattr(app_main, "decode_steam_state", lambda _state: (_ for _ in ()).throw(HTTPException(status_code=400, detail="Invalid Steam link state")))
    response = api_client.get("/steam/callback?state=bad", follow_redirects=False)
    assert response.status_code == 303
    assert "error=Invalid+Steam+link+state" in location(response)
