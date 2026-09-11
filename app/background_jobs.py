"""Shared state rules for durable background work."""

import uuid

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from arq import create_pool

from app.database import BackgroundJob

JOB_STATUSES = frozenset({"queued", "running", "succeeded", "failed"})
TERMINAL_JOB_STATUSES = frozenset({"succeeded", "failed"})


def is_terminal_status(status: str) -> bool:
    return status in TERMINAL_JOB_STATUSES


def find_active_job(db: Session, owner_id: uuid.UUID, operation: str, idempotency_key: str) -> BackgroundJob | None:
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
    db: Session, owner_id: uuid.UUID, operation: str, idempotency_key: str, payload: dict
) -> BackgroundJob:
    existing = find_active_job(db, owner_id, operation, idempotency_key)
    if existing:
        return existing
    job = BackgroundJob(owner_id=owner_id, operation=operation, idempotency_key=idempotency_key, payload=payload)
    db.add(job)
    try:
        db.commit()
    except IntegrityError:
        # The partial unique index resolves a concurrent request accepted by a
        # different web worker.  Return that active row instead of duplicating work.
        db.rollback()
        existing = find_active_job(db, owner_id, operation, idempotency_key)
        if existing:
            return existing
        raise
    db.refresh(job)
    return job


async def dispatch_job(job: BackgroundJob) -> None:
    from app.worker import redis_settings

    redis = await create_pool(redis_settings())
    try:
        await redis.enqueue_job("run_background_job", str(job.id))
    finally:
        await redis.aclose()
