import time
import uuid
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import create_engine, String, DateTime, ForeignKey, Float, Integer, Index, text, UniqueConstraint, CheckConstraint, func, column, JSON
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Mapped, mapped_column
from sqlalchemy.exc import OperationalError


load_dotenv()
echo = os.getenv("DEBUG", "false").lower() == "true"

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set")
engine = create_engine(DATABASE_URL, echo=echo)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Game(Base):
    __tablename__ = "games"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255))
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    info: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual", server_default="manual")
    external_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    playtime_forever: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    playtime_2weeks: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    img_icon_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    price_alert_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    price_alert_last_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    price_alert_last_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    price_alert_last_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    price_alert_last_currency: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    price_alert_last_cut: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=lambda: datetime.now(timezone.utc))
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),ForeignKey("users.id"),nullable=False)

    __table_args__ = (
        Index(
            "ix_games_owner_source_external_id",
            "owner_id",
            "source",
            "external_id",
            unique=True,
            postgresql_where=text("external_id IS NOT NULL"),
        ),
    )

    def __repr__(self) -> str:
        return f"Game(id={self.id!r}, title={self.title!r}, notes={self.notes!r}, info={self.info!r}, created_at={self.created_at!r})"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index(
            "uq_users_public_nickname_casefold",
            func.lower(column("public_nickname")),
            unique=True,
            postgresql_where=text("public_nickname IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255),nullable=False, unique=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255),nullable=True)
    steam_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, unique=True)
    steam_persona_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    steam_avatar: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    steam_country_code: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    steam_linked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    telegram_chat_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, unique=True)
    telegram_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    telegram_link_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    telegram_linked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    public_nickname: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    platforms_visibility: Mapped[str] = mapped_column(String(16), nullable=False, default="everyone", server_default="everyone")
    current_game_visibility: Mapped[str] = mapped_column(String(16), nullable=False, default="everyone", server_default="everyone")
    recent_games_visibility: Mapped[str] = mapped_column(String(16), nullable=False, default="everyone", server_default="everyone")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=lambda: datetime.now(timezone.utc))


class FriendshipRequest(Base):
    __tablename__ = "friendship_requests"
    __table_args__ = (
        UniqueConstraint("requester_id", "recipient_id", name="uq_friendship_request_direction"),
        CheckConstraint("requester_id <> recipient_id", name="ck_friendship_request_not_self"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recipient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", server_default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("user_low_id", "user_high_id", name="uq_friendship_canonical_pair"),
        CheckConstraint("user_low_id < user_high_id", name="ck_friendship_canonical_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_low_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user_high_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class FriendshipInvite(Base):
    __tablename__ = "friendship_invites"

    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    token_digest: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    rotated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PsnContact(Base):
    __tablename__ = "psn_contacts"
    __table_args__ = (UniqueConstraint("owner_id", "normalized_online_id", name="uq_psn_contact_owner_normalized_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    online_id: Mapped[str] = mapped_column(String(16), nullable=False)
    normalized_online_id: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ManualActivity(Base):
    __tablename__ = "manual_activities"

    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    current_game: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recent_games: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class SteamSocialSnapshot(Base):
    __tablename__ = "steam_social_snapshots"

    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    contacts: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    last_error: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    refreshed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class OAuthIdentity(Base):
    __tablename__ = "oauth_identities"
    __table_args__ = (
        UniqueConstraint("provider", "provider_subject", name="uq_oauth_identity_provider_subject"),
        UniqueConstraint("user_id", "provider", name="uq_oauth_identity_user_provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class OAuthAuthorizationTransaction(Base):
    __tablename__ = "oauth_authorization_transactions"

    state: Mapped[str] = mapped_column(String(128), primary_key=True)
    code_verifier: Mapped[str] = mapped_column(String(128), nullable=False)
    nonce: Mapped[str] = mapped_column(String(128), nullable=False)
    mode: Mapped[str] = mapped_column(String(16), nullable=False)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    exchange_code: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    result_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def wait_for_db(engine):
    for i in range(30):
        try:
            with engine.connect():
                return
        except OperationalError:
            print(f"DB not ready... retry {i+1}/30")
            time.sleep(1)
    raise Exception("DB not ready after retries")
