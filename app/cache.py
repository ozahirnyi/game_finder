import hashlib
import json
import logging
from typing import Callable, Awaitable, Any
from app.redis_client import redis_client


logger = logging.getLogger(__name__)


def build_cache_key(prefix: str, **params) -> str:
    normalized = json.dumps(
        params,
        sort_keys=True,
        separators=(",", ":"),
        default=str)
    digest = hashlib.sha1(normalized.encode()).hexdigest()
    return f"{prefix}:{digest}"


async def get_json_cached(key: str, ttl: int, fetch_fn: Callable[[], Awaitable[Any]],):
    key = key.strip()
    try:
        cached = await redis_client.get(key)
        if cached:
            try:
                logger.info(f"cache HIT: {key}")
                return json.loads(cached)
            except json.JSONDecodeError:
                await redis_client.delete(key)
    except Exception as e:
        logger.warning(f"Redis read failed: {e}")
    logger.info(f"cache MISS: {key}")
    data = await fetch_fn()
    try:
        await redis_client.set(key, json.dumps(data), ex=ttl)
    except Exception as e:
        logger.warning(f"Redis write failed: {e}")
    return data

