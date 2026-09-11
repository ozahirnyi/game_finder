"""ARQ worker handlers for durable user-initiated actions."""

import asyncio
import os
import uuid
from datetime import datetime, timezone

from arq.connections import RedisSettings
from fastapi.encoders import jsonable_encoder
from app.openai_client import get_recommendation
from app.database import BackgroundJob, SessionLocal
from app.integrations.igdb import fetch_igdb_games_batch
from app.recommendations import enrich_recommendations


class BackgroundJobOperationError(RuntimeError):
    """Raised when a durable job cannot be executed safely."""


async def execute_background_operation(_db, job) -> dict:
    if job.operation == "recommendations":
        generated = await asyncio.to_thread(
            get_recommendation,
            job.payload["prompt"],
            job.payload.get("liked_game_ids", []),
        )
        enriched = await enrich_recommendations(
            generated.get("recommendations", []), fetch_igdb_games_batch
        )
        return {"recommendations": enriched}
    raise BackgroundJobOperationError("Unsupported background operation")


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(os.getenv("REDIS_URL", "redis://redis:6379/0"))


async def run_background_job(_ctx: dict, job_id: str) -> None:
    """Claim one queued job and persist a safe terminal result."""
    db = SessionLocal()
    job = None
    try:
        parsed_job_id = uuid.UUID(job_id)
        claimed = (
            db.query(BackgroundJob)
            .filter(BackgroundJob.id == parsed_job_id, BackgroundJob.status == "queued")
            .update(
                {"status": "running", "updated_at": datetime.now(timezone.utc)},
                synchronize_session=False,
            )
        )
        db.commit()
        if not claimed:
            return
        job = db.get(BackgroundJob, parsed_job_id)
        job.result = jsonable_encoder(await execute_background_operation(db, job))
        job.status, job.error = "succeeded", None
        db.commit()
    except Exception:
        if job is not None:
            job.status = "failed"
            job.error = "The background action could not be completed. Please retry."
            db.commit()
        raise
    finally:
        db.close()


class WorkerSettings:
    functions = [run_background_job]
    redis_settings = redis_settings()
    max_jobs = 4
    max_tries = 1
