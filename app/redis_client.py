import os

from redis.asyncio import Redis

REDIS_URL = os.getenv("REDIS_URL")
if not REDIS_URL:
    raise RuntimeError("REDIS_URL is not set")

redis_client = Redis.from_url(
    REDIS_URL,
    decode_responses=True,)