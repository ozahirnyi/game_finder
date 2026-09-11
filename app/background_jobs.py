"""Shared state rules for durable background work."""

import uuid
import os
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError

from app.database import BackgroundJob

JOB_STATUSES = frozenset({"queued", "running", "succeeded", "failed"})
TERMINAL_JOB_STATUSES = frozenset({"succeeded", "failed"})


def is_terminal_status(status: str) -> bool:
    return status in TERMINAL_JOB_STATUSES


def requires_redis_dispatch(job, now: datetime) -> bool:
    """Return whether a durable job needs another broker delivery attempt."""
    return job.status == "queued" or (
        job.status == "running"
        and job.lease_expires_at is not None
        and job.lease_expires_at < now
    )


def find_active_job(
    db, owner_id: uuid.UUID, operation: str, idempotency_key: str
) -> BackgroundJob | None:
    return (
        db.query(BackgroundJob)
        .filter(
            BackgroundJob.owner_id == owner_id,
            BackgroundJob.operation == operation,
            BackgroundJob.idempotency_key == idempotency_key,
            BackgroundJob.status.in_(("queued", "running")),
        )
        .first()
    )


def enqueue_or_get_job(
    db, owner_id: uuid.UUID, operation: str, idempotency_key: str, payload: dict, reserve=None
) -> BackgroundJob:
    existing = find_active_job(db, owner_id, operation, idempotency_key)
    if existing:
        return existing
    job = BackgroundJob(
        owner_id=owner_id,
        operation=operation,
        idempotency_key=idempotency_key,
        payload=payload,
    )
    db.add(job)
    try:
        if reserve is not None:
            reserve()
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = find_active_job(db, owner_id, operation, idempotency_key)
        if existing:
            return existing
        raise
    db.refresh(job)
    return job


def redis_settings():
    from arq.connections import RedisSettings

    return RedisSettings.from_dsn(os.getenv("REDIS_URL", "redis://redis:6379/0"))


async def dispatch_job(job: BackgroundJob) -> None:
    await dispatch_job_id(str(job.id))


async def dispatch_job_id(job_id: str) -> None:
    from arq import create_pool

    redis = await create_pool(redis_settings())
    try:
        await redis.enqueue_job("run_background_job", job_id)
    finally:
        await redis.aclose()
