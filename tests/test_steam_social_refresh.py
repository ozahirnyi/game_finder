import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, SteamSocialSnapshot, User
from scripts import run_steam_social_refresh as refresh_worker


def test_refresh_selects_stale_and_missing_snapshots_before_batch_limit(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = session_factory()
    now = datetime.now(timezone.utc)
    fresh_users = [
        User(email=f"fresh-{index}@example.com", password_hash="hash", steam_id=f"fresh-{index}")
        for index in range(3)
    ]
    stale_user = User(email="stale@example.com", password_hash="hash", steam_id="stale")
    missing_user = User(email="missing@example.com", password_hash="hash", steam_id="missing")
    db.add_all([*fresh_users, stale_user, missing_user])
    db.commit()
    db.add_all(
        [
            *(SteamSocialSnapshot(owner_id=user.id, contacts=[], refreshed_at=now) for user in fresh_users),
            SteamSocialSnapshot(owner_id=stale_user.id, contacts=[], refreshed_at=now - timedelta(hours=2)),
        ]
    )
    db.commit()
    fetched_steam_ids = []

    async def fetch_contacts(steam_id):
        fetched_steam_ids.append(steam_id)
        return []

    monkeypatch.setenv("STEAM_SOCIAL_REFRESH_STALE_MINUTES", "60")
    monkeypatch.setenv("STEAM_SOCIAL_REFRESH_BATCH_SIZE", "2")
    monkeypatch.setattr(refresh_worker, "SessionLocal", session_factory)
    monkeypatch.setattr(refresh_worker, "fetch_steam_social_contacts", fetch_contacts)

    class NaiveDatetime:
        @staticmethod
        def now(_timezone=None):
            return now.replace(tzinfo=None)

    monkeypatch.setattr(refresh_worker, "datetime", NaiveDatetime)

    try:
        assert asyncio.run(refresh_worker.refresh_stale_snapshots()) == 2
        assert set(fetched_steam_ids) == {"stale", "missing"}
    finally:
        db.close()
        Base.metadata.drop_all(engine)
        engine.dispose()
