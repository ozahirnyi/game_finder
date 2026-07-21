from datetime import timedelta
from datetime import datetime, timezone
import uuid

from sqlalchemy.orm import Session

from app.database import OAuthAuthorizationTransaction, OAuthIdentity, User
from app.google_auth import normalize_email, random_token, utcnow


def consume_authorization_transaction(
    db: Session,
    state: str,
    expected_mode: str,
) -> OAuthAuthorizationTransaction | None:
    transaction = db.query(OAuthAuthorizationTransaction).filter_by(state=state).first()
    if not transaction:
        return None
    db.delete(transaction)
    db.commit()
    if transaction.mode != expected_mode or transaction.expires_at <= utcnow():
        return None
    return transaction


def create_exchange_result(db: Session, user_id: uuid.UUID) -> str:
    exchange_code = random_token()
    db.add(
        OAuthAuthorizationTransaction(
            state=random_token(),
            code_verifier="consumed",
            nonce="consumed",
            mode="result",
            exchange_code=exchange_code,
            result_user_id=user_id,
            expires_at=utcnow() + timedelta(seconds=60),
        )
    )
    db.commit()
    return exchange_code


def consume_exchange_result(db: Session, exchange_code: str) -> uuid.UUID | None:
    transaction = db.query(OAuthAuthorizationTransaction).filter_by(
        exchange_code=exchange_code,
        mode="result",
    ).first()
    if not transaction:
        return None
    db.delete(transaction)
    db.commit()
    if transaction.expires_at <= utcnow() or not transaction.result_user_id:
        return None
    return transaction.result_user_id


def resolve_google_user(db: Session, subject: str, email: str) -> User:
    identity = db.query(OAuthIdentity).filter_by(
        provider="google",
        provider_subject=subject,
    ).first()
    if identity:
        user = db.query(User).filter_by(id=identity.user_id).first()
        if user:
            return user
        raise ValueError("Google identity belongs to a missing account")

    normalized_email = normalize_email(email)
    user = db.query(User).filter_by(email=normalized_email).first()
    if not user:
        user = User(email=normalized_email, password_hash=None)
        db.add(user)
        db.flush()

    db.add(
        OAuthIdentity(
            user_id=user.id,
            provider="google",
            provider_subject=subject,
            email=normalized_email,
        )
    )
    db.commit()
    return user


def resolve_steam_user(db: Session, steam_id: str, profile: dict[str, str | None]) -> User:
    user = db.query(User).filter_by(steam_id=steam_id).first()
    if user:
        return user

    user = User(
        email=f"steam-{steam_id}@steam.invalid",
        password_hash=None,
        steam_id=steam_id,
        steam_persona_name=profile.get("persona_name"),
        steam_avatar=profile.get("avatar"),
        steam_country_code=profile.get("country_code"),
        steam_linked_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.flush()
    db.commit()
    return user
