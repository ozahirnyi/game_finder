from datetime import datetime, timedelta, timezone

import pytest

from app.auth import decode_access_token
from app.database import OAuthAuthorizationTransaction


pytestmark = pytest.mark.integration


def test_google_status_reflects_configuration(api_client, app_main, monkeypatch):
    monkeypatch.setattr(app_main, "google_configured", lambda: False)
    assert api_client.get("/auth/google/status").json() == {"configured": False}

    monkeypatch.setattr(app_main, "google_configured", lambda: True)
    assert api_client.get("/auth/google/status").json() == {"configured": True}


def test_google_login_url_persists_transaction(api_client, app_main, db_session, monkeypatch):
    monkeypatch.setattr(app_main, "google_configured", lambda: True)
    monkeypatch.setattr(app_main, "build_google_authorization_url", lambda state, verifier, nonce: f"https://accounts.test/auth?state={state}")

    response = api_client.get("/auth/google/login-url")

    assert response.status_code == 200
    assert response.json()["url"].startswith("https://accounts.test/auth?state=")
    transaction = db_session.query(OAuthAuthorizationTransaction).one()
    assert transaction.mode == "login"
    assert transaction.user_id is None
    assert transaction.code_verifier
    assert transaction.nonce


def test_google_link_url_binds_transaction_to_authenticated_user(api_client, app_main, db_session, user_factory, auth_as, monkeypatch):
    user = auth_as(user_factory(email="google-link@example.com"))
    monkeypatch.setattr(app_main, "google_configured", lambda: True)
    monkeypatch.setattr(app_main, "build_google_authorization_url", lambda state, verifier, nonce: "https://accounts.test/link")

    response = api_client.post("/auth/google/link-url")

    assert response.status_code == 200
    assert response.json() == {"url": "https://accounts.test/link"}
    transaction = db_session.query(OAuthAuthorizationTransaction).one()
    assert transaction.mode == "link"
    assert transaction.user_id == user.id


def test_google_exchange_returns_token_and_consumes_result_transaction(api_client, app_main, db_session, user_factory, monkeypatch):
    monkeypatch.setattr(app_main, "utcnow", lambda: datetime.now())
    user = user_factory(email="google-exchange@example.com")
    transaction = OAuthAuthorizationTransaction(
        state="google-result-state",
        code_verifier="consumed",
        nonce="consumed",
        mode="result",
        exchange_code="google-exchange-code-1234567890",
        result_user_id=user.id,
        expires_at=datetime.now() + timedelta(minutes=1),
    )
    db_session.add(transaction)
    db_session.commit()

    response = api_client.post("/auth/google/exchange", json={"exchange_code": transaction.exchange_code})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert decode_access_token(body["access_token"])["sub"] == str(user.id)
    assert db_session.query(OAuthAuthorizationTransaction).filter_by(state=transaction.state).one_or_none() is None


def test_telegram_me_reports_unlinked_and_linked_account(api_client, user_factory, auth_as):
    user = user_factory(email="telegram-me@example.com")
    auth_as(user)
    response = api_client.get("/telegram/me")
    assert response.status_code == 200
    assert response.json()["linked"] is False

    user.telegram_chat_id = "chat-1"
    user.telegram_username = "player"
    user.telegram_linked_at = datetime.now(timezone.utc)
    response = api_client.get("/telegram/me")
    assert response.status_code == 200
    assert response.json()["linked"] is True
    assert response.json()["username"] == "player"


def test_telegram_link_url_persists_token(api_client, app_main, db_session, user_factory, auth_as, monkeypatch):
    user = auth_as(user_factory(email="telegram-link@example.com"))
    monkeypatch.setattr(app_main, "telegram_configured", lambda: True)
    monkeypatch.setattr(app_main, "create_telegram_link_token", lambda: "telegram-token")
    monkeypatch.setattr(app_main, "build_telegram_link_url", lambda token: f"https://t.me/playfinder?start={token}")

    response = api_client.post("/telegram/link-url")

    assert response.status_code == 200
    assert response.json()["configured"] is True
    assert response.json()["url"] == "https://t.me/playfinder?start=telegram-token"
    db_session.refresh(user)
    assert user.telegram_link_token == "telegram-token"


def test_telegram_link_url_reuses_existing_token(api_client, app_main, user_factory, auth_as, monkeypatch):
    user = auth_as(user_factory(email="telegram-existing@example.com", telegram_link_token="existing-token"))
    monkeypatch.setattr(app_main, "telegram_configured", lambda: True)
    monkeypatch.setattr(app_main, "create_telegram_link_token", lambda: pytest.fail("token should not be regenerated"))
    monkeypatch.setattr(app_main, "build_telegram_link_url", lambda token: f"https://t.me/playfinder?start={token}")

    response = api_client.post("/telegram/link-url")

    assert response.status_code == 200
    assert response.json()["url"].endswith("existing-token")


def test_telegram_unlink_clears_account_fields(api_client, db_session, user_factory, auth_as):
    user = auth_as(user_factory(email="telegram-unlink@example.com", telegram_chat_id="chat-2", telegram_username="old", telegram_linked_at=datetime.now(timezone.utc)))

    response = api_client.delete("/telegram/me")

    assert response.status_code == 200
    assert response.json()["linked"] is False
    db_session.refresh(user)
    assert user.telegram_chat_id is None
    assert user.telegram_username is None
    assert user.telegram_linked_at is None


def test_telegram_test_alert_requires_link_and_sends_message(api_client, app_main, user_factory, auth_as, monkeypatch):
    user = auth_as(user_factory(email="telegram-alert-test@example.com"))
    assert api_client.post("/telegram/test-alert").status_code == 409

    user.telegram_chat_id = "chat-3"
    sent = []
    monkeypatch.setattr(app_main, "send_telegram_message", lambda chat_id, text: sent.append((chat_id, text)) or True)
    response = api_client.post("/telegram/test-alert")

    assert response.status_code == 200
    assert response.json() == {"status": "sent"}
    assert sent[0][0] == "chat-3"


def test_telegram_webhook_links_user_and_persists_fields(api_client, app_main, db_session, user_factory, monkeypatch):
    user = user_factory(email="telegram-webhook@example.com", telegram_link_token="link-token")
    linked_at = datetime(2025, 1, 2, tzinfo=timezone.utc)
    monkeypatch.setattr(app_main, "get_telegram_webhook_secret", lambda: "webhook-secret")
    monkeypatch.setattr(app_main, "telegram_linked_at", lambda: linked_at)
    monkeypatch.setattr(app_main, "send_telegram_message", lambda chat_id, text: True)

    response = api_client.post(
        "/telegram/webhook/webhook-secret",
        json={"message": {"text": "/start link-token", "chat": {"id": 42}, "from": {"username": "telegram_player"}}},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "linked"}
    db_session.refresh(user)
    assert user.telegram_chat_id == "42"
    assert user.telegram_username == "telegram_player"
    assert user.telegram_linked_at == linked_at.replace(tzinfo=None)
