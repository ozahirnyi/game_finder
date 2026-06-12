import json
import os
import redis
from dotenv import load_dotenv


from redis.asyncio import Redis


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
except Exception:
    redis_client = None


def cache_get(key: str):
    if not redis_client:
        return None
    try:
        value = redis_client.get(key)
        if not value:
            return None
        return json.loads(value)
    except Exception:
        return None


def cache_set(key: str, value, ttl: int):
    if not redis_client:
        return
    try:
        redis_client.setex(key,ttl,json.dumps(value))
    except Exception:
        return