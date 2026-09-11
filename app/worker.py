"""ARQ worker handlers for durable user-initiated actions."""

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

from arq.connections import RedisSettings
from arq import cron
from fastapi.encoders import jsonable_encoder
from app.openai_client import get_recommendation
from app.database import BackgroundJob, SessionLocal
from app.integrations.igdb import fetch_igdb_games_batch
from app.recommendations import enrich_recommendations
from app.recommendation_quota import consume_quota
from app.background_jobs import dispatch_job_id

LEASE_DURATION = timedelta(minutes=15)
LEASE_HEARTBEAT_SECONDS = 30


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


async def execute_and_consume_quota(db, job) -> dict:
    result = await execute_background_operation(db, job)
    consume_quota(db, job.owner_id)
    return result


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(os.getenv("REDIS_URL", "redis://redis:6379/0"))


async def run_background_job(_ctx: dict, job_id: str) -> None:
    """Claim one queued job and persist a safe terminal result."""
    db = SessionLocal()
    job = None
    lease_token = str(uuid.uuid4())
    heartbeat_stop = asyncio.Event()
    heartbeat_task = None
    try:
        parsed_job_id = uuid.UUID(job_id)
        now = datetime.now(timezone.utc)
        claimed = (
            db.query(BackgroundJob)
            .filter(BackgroundJob.id == parsed_job_id, BackgroundJob.status == "queued")
            .update(
                {
                    "status": "running",
                    "lease_token": lease_token,
                    "lease_expires_at": now + LEASE_DURATION,
                    "updated_at": now,
                },
                synchronize_session=False,
            )
        )
        db.commit()
        if not claimed:
            return
        job = db.get(BackgroundJob, parsed_job_id)
        heartbeat_task = asyncio.create_task(
            _extend_lease_until_complete(parsed_job_id, lease_token, heartbeat_stop)
        )
        job.result = jsonable_encoder(await execute_and_consume_quota(db, job))
        completed = (
            db.query(BackgroundJob)
            .filter(
                BackgroundJob.id == parsed_job_id,
                BackgroundJob.status == "running",
                BackgroundJob.lease_token == lease_token,
            )
            .update(
                {
                    "status": "succeeded",
                    "error": None,
                    "lease_token": None,
                    "lease_expires_at": None,
                    "updated_at": datetime.now(timezone.utc),
                },
                synchronize_session=False,
            )
        )
        db.commit()
        if not completed:
            return
    except Exception:
        if job is not None:
            db.query(BackgroundJob).filter(
                BackgroundJob.id == job.id,
                BackgroundJob.status == "running",
                BackgroundJob.lease_token == lease_token,
            ).update(
                {
                    "status": "failed",
                    "error": "The background action could not be completed. Please retry.",
                    "lease_token": None,
                    "lease_expires_at": None,
                    "updated_at": datetime.now(timezone.utc),
                },
                synchronize_session=False,
            )
            db.commit()
        raise
    finally:
        heartbeat_stop.set()
        if heartbeat_task is not None:
            await heartbeat_task
        db.close()


async def _extend_lease_until_complete(job_id: uuid.UUID, lease_token: str, stop: asyncio.Event) -> None:
    while True:
        try:
            await asyncio.wait_for(stop.wait(), timeout=LEASE_HEARTBEAT_SECONDS)
            return
        except TimeoutError:
            db = SessionLocal()
            try:
                db.query(BackgroundJob).filter(
                    BackgroundJob.id == job_id,
                    BackgroundJob.status == "running",
                    BackgroundJob.lease_token == lease_token,
                ).update(
                    {
                        "lease_expires_at": datetime.now(timezone.utc) + LEASE_DURATION,
                        "updated_at": datetime.now(timezone.utc),
                    },
                    synchronize_session=False,
                )
                db.commit()
            finally:
                db.close()


async def recover_background_jobs(_ctx: dict) -> None:
    """Re-deliver queued work and reclaim leases from dead workers."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        db.query(BackgroundJob).filter(
            BackgroundJob.status == "running",
            BackgroundJob.lease_expires_at < now,
        ).update(
            {
                "status": "queued",
                "lease_token": None,
                "lease_expires_at": None,
                "updated_at": now,
            },
            synchronize_session=False,
        )
        job_ids = [
            str(job_id)
            for (job_id,) in db.query(BackgroundJob.id)
            .filter(BackgroundJob.status == "queued")
            .order_by(BackgroundJob.created_at)
            .limit(100)
            .all()
        ]
        db.commit()
    finally:
        db.close()
    for queued_job_id in job_ids:
        try:
            await dispatch_job_id(queued_job_id)
        except Exception:
            # The next cron pass retries durable queued work after broker recovery.
            return


class WorkerSettings:
    functions = [run_background_job]
    redis_settings = redis_settings()
    max_jobs = 4
    max_tries = 1
    cron_jobs = [cron(recover_background_jobs, second=0, run_at_startup=True)]
