"""Refresh stale Steam contact snapshots once; run this in a dedicated worker service."""
import asyncio
import os
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal, SteamSocialSnapshot, User
from app.steam import fetch_steam_social_contacts


async def refresh_stale_snapshots() -> int:
    stale_minutes = max(1, int(os.getenv("STEAM_SOCIAL_REFRESH_STALE_MINUTES", "60")))
    batch_size = max(1, min(100, int(os.getenv("STEAM_SOCIAL_REFRESH_BATCH_SIZE", "25"))))
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=stale_minutes)
    db = SessionLocal()
    refreshed = 0
    try:
        users = db.query(User).filter(User.steam_id.isnot(None)).limit(batch_size).all()
        for user in users:
            snapshot = db.query(SteamSocialSnapshot).filter(SteamSocialSnapshot.owner_id == user.id).first()
            if snapshot and snapshot.refreshed_at and snapshot.refreshed_at >= cutoff:
                continue
            if not snapshot:
                snapshot = SteamSocialSnapshot(owner_id=user.id, contacts=[])
                db.add(snapshot)
            try:
                snapshot.contacts = await fetch_steam_social_contacts(user.steam_id)
                snapshot.refreshed_at = datetime.now(timezone.utc)
                snapshot.last_error = None
                refreshed += 1
            except Exception as exc:
                snapshot.last_error = str(getattr(exc, "detail", "Steam refresh failed"))[:255]
            db.commit()
    finally:
        db.close()
    return refreshed


if __name__ == "__main__":
    print(f"Refreshed {asyncio.run(refresh_stale_snapshots())} Steam social snapshots")
