from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
import uuid

from sqlalchemy.orm import Session

from app.database import AIRecommendationQuota, User


DAILY_LIMIT = 3
COOLDOWN = timedelta(seconds=60)


@dataclass(frozen=True)
class QuotaSnapshot:
    limit: int
    remaining: int
    cooldown_until: datetime | None
    reset_at: datetime


class QuotaDenied(Exception):
    def __init__(self, code: str, message: str, snapshot: QuotaSnapshot):
        self.code = code
        self.message = message
        self.snapshot = snapshot
        super().__init__(message)


def get_quota_status(
    db: Session, user_id: uuid.UUID, now: datetime | None = None
) -> QuotaSnapshot:
    current = _utc(now)
    row = db.get(
        AIRecommendationQuota,
        (user_id, current.date()),
        populate_existing=True,
    )
    if row is None:
        return QuotaSnapshot(
            limit=DAILY_LIMIT,
            remaining=DAILY_LIMIT,
            cooldown_until=None,
            reset_at=_reset_at(current),
        )
    return _snapshot(row, current)


def reserve_quota(
    db: Session, user_id: uuid.UUID, now: datetime | None = None
) -> QuotaSnapshot:
    current = _utc(now)
    db.query(User.id).filter(User.id == user_id).with_for_update().one()
    row = db.get(
        AIRecommendationQuota,
        (user_id, current.date()),
        populate_existing=True,
    )
    if row is None:
        row = AIRecommendationQuota(user_id=user_id, quota_date=current.date())
        db.add(row)
        db.flush()
    snapshot = _snapshot(row, current)
    if row.attempt_count >= DAILY_LIMIT:
        db.rollback()
        raise QuotaDenied(
            "ai_daily_quota_exhausted", "Daily AI search limit reached.", snapshot
        )
    if snapshot.cooldown_until and current < snapshot.cooldown_until:
        db.rollback()
        raise QuotaDenied(
            "ai_recommendation_cooldown",
            "Please wait before searching again.",
            snapshot,
        )
    row.attempt_count += 1
    row.last_attempt_at = current
    db.commit()
    return _snapshot(row, current)


def _utc(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("now must be a timezone-aware datetime")
    return value.astimezone(timezone.utc)


def _stored_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _reset_at(current: datetime) -> datetime:
    return datetime.combine(
        current.date() + timedelta(days=1), time.min, tzinfo=timezone.utc
    )


def _snapshot(row: AIRecommendationQuota, current: datetime) -> QuotaSnapshot:
    cooldown_until = None
    if row.last_attempt_at is not None:
        candidate = _stored_utc(row.last_attempt_at) + COOLDOWN
        if current < candidate:
            cooldown_until = candidate
    return QuotaSnapshot(
        limit=DAILY_LIMIT,
        remaining=max(DAILY_LIMIT - row.attempt_count, 0),
        cooldown_until=cooldown_until,
        reset_at=_reset_at(current),
    )
