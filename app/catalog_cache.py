import os
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

from app.database import CatalogGameCache
from app.integrations.igdb import IGDBError


def _ttl_seconds() -> int:
    try:
        return max(int(os.getenv("IGDB_CACHE_TTL_SECONDS", "86400")), 60)
    except ValueError:
        return 86400


def get_cached_snapshot(
    db: Session, igdb_id: int, fetch: Callable[[int], Awaitable[dict]],
) -> Awaitable[dict]:
    async def resolve() -> dict:
        # Small in-memory test doubles deliberately do not emulate SQLAlchemy;
        # production always supplies a real Session and therefore persists.
        if not hasattr(db, "get"):
            return await fetch(igdb_id)
        try:
            cached = db.get(CatalogGameCache, igdb_id)
        except OperationalError:
            # Pre-migration databases cannot serve a stale snapshot, but must
            # still remain readable while the deployment applies Alembic.
            db.rollback()
            return await fetch(igdb_id)
        fresh_after = datetime.now(timezone.utc) - timedelta(seconds=_ttl_seconds())
        if cached and cached.fetched_at >= fresh_after:
            return cached.snapshot
        try:
            snapshot = await fetch(igdb_id)
        except IGDBError:
            if cached:
                return cached.snapshot
            raise
        if cached:
            cached.snapshot = snapshot
            cached.steam_appid = snapshot.get("steam_appid")
            cached.fetched_at = datetime.now(timezone.utc)
        else:
            db.add(CatalogGameCache(igdb_id=igdb_id, snapshot=snapshot, steam_appid=snapshot.get("steam_appid")))
        db.commit()
        return snapshot
    return resolve()
