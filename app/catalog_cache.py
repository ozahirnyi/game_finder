import os
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError

from app.database import CatalogGameCache
from app.integrations.igdb import IGDBError


_SNAPSHOT_FORMAT_KEY = "_catalog_snapshot_format"
_SNAPSHOT_FORMAT_VERSION = 3


def _stored_snapshot(snapshot: dict) -> dict:
    return {**snapshot, _SNAPSHOT_FORMAT_KEY: _SNAPSHOT_FORMAT_VERSION}


def _public_snapshot(snapshot: dict) -> dict:
    return {key: value for key, value in snapshot.items() if key != _SNAPSHOT_FORMAT_KEY}


def _is_current_snapshot(snapshot: object) -> bool:
    return isinstance(snapshot, dict) and snapshot.get(_SNAPSHOT_FORMAT_KEY) == _SNAPSHOT_FORMAT_VERSION


def catalog_steam_appid(db: Session, igdb_id: int) -> int | None:
    if not hasattr(db, "get"):
        return None
    try:
        cached = db.get(CatalogGameCache, igdb_id)
    except OperationalError:
        db.rollback()
        return None
    if cached is None:
        return None
    appid = cached.steam_appid or (cached.snapshot or {}).get("steam_appid")
    return appid if isinstance(appid, int) and not isinstance(appid, bool) and appid > 0 else None


def remember_catalog_steam_identities(db: Session, games: list[dict]) -> None:
    """Retain catalog ↔ Steam identities resolved by discovery."""
    if not hasattr(db, "get"):
        return
    changed = False
    try:
        for game in games:
            igdb_id, appid = game.get("id"), game.get("steam_appid")
            if not all(isinstance(value, int) and not isinstance(value, bool) and value > 0 for value in (igdb_id, appid)):
                continue
            if db.query(CatalogGameCache).filter(CatalogGameCache.steam_appid == appid, CatalogGameCache.igdb_id != igdb_id).first():
                continue
            cached = db.get(CatalogGameCache, igdb_id)
            if cached is None:
                db.add(CatalogGameCache(igdb_id=igdb_id, snapshot={"id": igdb_id}, steam_appid=appid))
            elif cached.steam_appid != appid or cached.snapshot.get("steam_appid") != appid:
                cached.steam_appid = appid
                cached.snapshot = {**cached.snapshot, "steam_appid": appid}
            else:
                continue
            changed = True
    except OperationalError:
        db.rollback()
        return
    if changed:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


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
        fetched_at = cached.fetched_at if cached else None
        if fetched_at is not None and fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)
        if cached and fetched_at >= fresh_after and _is_current_snapshot(cached.snapshot):
            snapshot = _public_snapshot(cached.snapshot)
            if snapshot.get("steam_appid") is None and cached.steam_appid:
                snapshot["steam_appid"] = cached.steam_appid
            return snapshot
        try:
            snapshot = await fetch(igdb_id)
        except IGDBError:
            if cached:
                # Never expose the internal format marker, including when an
                # old record is the only safe fallback during an IGDB outage.
                snapshot = _public_snapshot(cached.snapshot)
                if snapshot.get("steam_appid") is None and cached.steam_appid:
                    snapshot["steam_appid"] = cached.steam_appid
                return snapshot
            raise
        if cached and snapshot.get("steam_appid") is None and cached.steam_appid:
            snapshot = {**snapshot, "steam_appid": cached.steam_appid}
        if cached:
            cached.snapshot = _stored_snapshot(snapshot)
            cached.steam_appid = snapshot.get("steam_appid")
            cached.fetched_at = datetime.now(timezone.utc)
        else:
            db.add(CatalogGameCache(igdb_id=igdb_id, snapshot=_stored_snapshot(snapshot), steam_appid=snapshot.get("steam_appid")))
        db.commit()
        return snapshot
    return resolve()
