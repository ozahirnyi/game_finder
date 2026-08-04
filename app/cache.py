import hashlib
import json
import logging
from app.redis_client import cache_set, cache_get

logger = logging.getLogger(__name__)
STALE_CACHE_TTL = 86400


def build_cache_key(prefix: str, **kwargs) -> str:
    normalized = json.dumps(kwargs, sort_keys=True, default=str)
    hashed = hashlib.sha256(normalized.encode()).hexdigest()
    return f"{prefix}:{hashed}"


async def get_json_cached(key: str, ttl: int, fetch_func):
    cached = await cache_get(key)
    if cached is not None:
        return cached
    try:
        data = await fetch_func()
    except Exception:
        stale = await cache_get(f"{key}:stale")
        if stale is not None:
            return stale
        raise
    await cache_set(key, data, ttl)
    await cache_set(f"{key}:stale", data, STALE_CACHE_TTL)
    return data
