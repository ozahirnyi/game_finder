import asyncio
import hashlib
import json
import logging
from app.redis_client import cache_set, cache_get

logger = logging.getLogger(__name__)
STALE_CACHE_TTL = 86400
_refresh_tasks = {}


def build_cache_key(prefix: str, **kwargs) -> str:
    normalized = json.dumps(kwargs, sort_keys=True, default=str)
    hashed = hashlib.sha256(normalized.encode()).hexdigest()
    return f"{prefix}:{hashed}"


async def _refresh_cache(key: str, ttl: int, fetch_func):
    try:
        data = await fetch_func()
        await cache_set(key, data, ttl)
        await cache_set(f"{key}:stale", data, STALE_CACHE_TTL)
    except Exception:
        logger.exception("Background cache refresh failed for key %s", key)
    finally:
        _refresh_tasks.pop(key, None)


def _start_background_refresh(key: str, ttl: int, fetch_func):
    task = _refresh_tasks.get(key)
    if task is None or task.done():
        _refresh_tasks[key] = asyncio.create_task(_refresh_cache(key, ttl, fetch_func))


async def get_json_cached(
    key: str, ttl: int, fetch_func, *, stale_while_revalidate: bool = False,
):
    cached = await cache_get(key)
    if cached is not None:
        return cached
    stale_key = f"{key}:stale"
    stale = await cache_get(stale_key)
    if stale is not None and stale_while_revalidate:
        _start_background_refresh(key, ttl, fetch_func)
        return stale
    try:
        data = await fetch_func()
    except Exception:
        if stale is None:
            stale = await cache_get(stale_key)
        if stale is not None:
            return stale
        raise
    await cache_set(key, data, ttl)
    await cache_set(stale_key, data, STALE_CACHE_TTL)
    return data
