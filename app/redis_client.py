import json
import os
import logging
import redis.asyncio as redis
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")


try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
except Exception:
    redis_client = None


async def cache_get(key: str):
    if not redis_client:
        return None
    try:
        value = await redis_client.get(key)
        if not value:
            return None
        return json.loads(value)
    except Exception as e:
        logger.warning(f"Redis read failed: {e}")
        return None


async def cache_set(key: str, value, ttl: int):
    if not redis_client:
        logger.warning("Redis is not initialized")
        return
    try:
        await redis_client.setex(key,ttl,json.dumps(value))
    except Exception as e:
        logger.warning(f"Redis write failed: {e}")
