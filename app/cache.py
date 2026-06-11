import hashlib
import json
import logging
from app.redis_client import cache_set, cache_get

logger = logging.getLogger(__name__)


def build_cache_key(prefix: str, **kwargs) -> str:
    normalized = json.dumps(kwargs, sort_keys=True, default=str)
    hashed = hashlib.sha256(normalized.encode()).hexdigest()
    return f"{prefix}:{hashed}"


async def get_json_cached(key: str, ttl: int, fetch_func):
    cached = cache_get(key)
    if cached is not None:
        return cached
    data = await fetch_func()
    cache_set(key, data, ttl)
    return data
