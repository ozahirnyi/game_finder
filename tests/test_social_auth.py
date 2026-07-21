from datetime import timedelta
import uuid

from app.database import OAuthAuthorizationTransaction, OAuthIdentity, User
from app.google_auth import utcnow
from app.social_auth import (
    consume_authorization_transaction,
    create_exchange_result,
    consume_exchange_result,
    resolve_google_user,
)


class Query:
    def __init__(self, items):
        self.items = items

    def filter_by(self, **values):
        return Query([item for item in self.items if all(getattr(item, key) == value for key, value in values.items())])

    def first(self):
        return self.items[0] if self.items else None


class Session:
    def __init__(self):
        self.items = []

    def add(self, item):
        self.items.append(item)

    def delete(self, item):
        self.items.remove(item)

    def query(self, model):
        return Query([item for item in self.items if isinstance(item, model)])

    def flush(self):
        for item in self.items:
            if getattr(item, "id", None) is None:
                item.id = uuid.uuid4()

    def commit(self):
        pass


def test_google_resolution_reuses_normalized_email_and_creates_identity():
    db = Session()
    existing = User(id=uuid.uuid4(), email="player@example.com", password_hash="hash")
    db.add(existing)

    user = resolve_google_user(db, "google-subject", " Player@Example.COM ")

    assert user is existing
    identity = db.query(OAuthIdentity).filter_by(provider="google", provider_subject="google-subject").first()
    assert identity is not None
    assert identity.user_id == existing.id


def test_exchange_result_is_single_use():
    db = Session()
    user_id = uuid.uuid4()

    exchange_code = create_exchange_result(db, user_id)

    assert consume_exchange_result(db, exchange_code) == user_id
    assert consume_exchange_result(db, exchange_code) is None


def test_expired_exchange_result_is_rejected():
    db = Session()
    transaction = OAuthAuthorizationTransaction(
        state="state", code_verifier="consumed", nonce="consumed", mode="result",
        exchange_code="expired-code", result_user_id=uuid.uuid4(), expires_at=utcnow() - timedelta(seconds=1),
    )
    db.add(transaction)

    assert consume_exchange_result(db, "expired-code") is None


def test_authorization_transaction_is_consumed_before_provider_call():
    db = Session()
    transaction = OAuthAuthorizationTransaction(
        state="state", code_verifier="verifier", nonce="nonce", mode="google_login",
        expires_at=utcnow() + timedelta(minutes=1),
    )
    db.add(transaction)

    assert consume_authorization_transaction(db, "state", "google_login") is transaction
    assert db.query(OAuthAuthorizationTransaction).filter_by(state="state").first() is None
