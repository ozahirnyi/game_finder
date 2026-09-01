from datetime import datetime, timedelta, timezone
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Query, Session
from sqlalchemy.pool import StaticPool

from app.database import AIRecommendationQuota, Base, User
from app.recommendation_quota import QuotaDenied, get_quota_status, reserve_quota


@pytest.fixture
def session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    Base.metadata.drop_all(engine)


@pytest.fixture
def user(session):
    value = User(email=f"quota-{uuid.uuid4()}@example.test", password_hash="hash")
    session.add(value)
    session.commit()
    return value


def test_three_attempts_are_available_and_fourth_is_denied(session, user):
    start = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)
    first = reserve_quota(session, user.id, start)
    second = reserve_quota(session, user.id, start + timedelta(seconds=60))
    third = reserve_quota(session, user.id, start + timedelta(seconds=120))

    assert [first.remaining, second.remaining, third.remaining] == [2, 1, 0]
    with pytest.raises(QuotaDenied) as exc:
        reserve_quota(session, user.id, start + timedelta(seconds=180))
    assert exc.value.code == "ai_daily_quota_exhausted"
    assert exc.value.snapshot.reset_at == datetime(2026, 9, 2, tzinfo=timezone.utc)


def test_cooldown_denies_without_consuming_an_attempt(session, user):
    start = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)
    reserve_quota(session, user.id, start)

    with pytest.raises(QuotaDenied) as exc:
        reserve_quota(session, user.id, start + timedelta(seconds=59))

    assert exc.value.code == "ai_recommendation_cooldown"
    assert get_quota_status(session, user.id, start + timedelta(seconds=59)).remaining == 2


def test_utc_day_creates_a_fresh_quota(session, user):
    reserve_quota(session, user.id, datetime(2026, 9, 1, 23, 59, tzinfo=timezone.utc))
    snapshot = reserve_quota(session, user.id, datetime(2026, 9, 2, 0, 0, tzinfo=timezone.utc))
    assert snapshot.remaining == 2
    assert snapshot.reset_at == datetime(2026, 9, 3, tzinfo=timezone.utc)


def test_status_preserves_cooldown_across_utc_midnight(session, user):
    previous = datetime(2026, 9, 1, 23, 59, 50, tzinfo=timezone.utc)
    midnight = datetime(2026, 9, 2, 0, 0, tzinfo=timezone.utc)
    reserve_quota(session, user.id, previous)

    snapshot = get_quota_status(session, user.id, midnight)

    assert snapshot.remaining == 3
    assert snapshot.cooldown_until == datetime(2026, 9, 2, 0, 0, 50, tzinfo=timezone.utc)
    assert snapshot.reset_at == datetime(2026, 9, 3, tzinfo=timezone.utc)


def test_cross_midnight_cooldown_denies_until_sixty_seconds(session, user):
    previous = datetime(2026, 9, 1, 23, 59, 50, tzinfo=timezone.utc)
    midnight = datetime(2026, 9, 2, 0, 0, tzinfo=timezone.utc)
    reserve_quota(session, user.id, previous)

    with pytest.raises(QuotaDenied) as exc:
        reserve_quota(session, user.id, midnight)

    assert exc.value.code == "ai_recommendation_cooldown"
    assert exc.value.snapshot.remaining == 3
    assert exc.value.snapshot.cooldown_until == datetime(
        2026, 9, 2, 0, 0, 50, tzinfo=timezone.utc
    )

    snapshot = reserve_quota(session, user.id, previous + timedelta(seconds=60))
    assert snapshot.remaining == 2
    assert snapshot.cooldown_until == datetime(
        2026, 9, 2, 0, 1, 50, tzinfo=timezone.utc
    )


def test_initial_status_does_not_persist_a_quota_row(session, user):
    now = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)

    snapshot = get_quota_status(session, user.id, now)

    assert snapshot.limit == 3
    assert snapshot.remaining == 3
    assert snapshot.cooldown_until is None
    assert snapshot.reset_at == datetime(2026, 9, 2, tzinfo=timezone.utc)
    assert session.get(AIRecommendationQuota, (user.id, now.date())) is None


def test_status_clamps_remaining_and_omits_expired_cooldown(session, user):
    now = datetime(2026, 9, 1, 8, 2, tzinfo=timezone.utc)
    session.add(
        AIRecommendationQuota(
            user_id=user.id,
            quota_date=now.date(),
            attempt_count=4,
            last_attempt_at=now - timedelta(seconds=60),
        )
    )
    session.commit()

    snapshot = get_quota_status(session, user.id, now)

    assert snapshot.remaining == 0
    assert snapshot.cooldown_until is None


def test_naive_datetime_is_rejected(session, user):
    with pytest.raises(ValueError, match="timezone-aware"):
        reserve_quota(session, user.id, datetime(2026, 9, 1, 8, 0))


def test_reservation_locks_the_user_row_for_postgresql(session, user, monkeypatch):
    compiled_lock_queries = []
    original_with_for_update = Query.with_for_update

    def capture_for_update(query, *args, **kwargs):
        locked_query = original_with_for_update(query, *args, **kwargs)
        compiled_lock_queries.append(
            str(
                locked_query.statement.compile(
                    dialect=postgresql.dialect(),
                    compile_kwargs={"literal_binds": True},
                )
            )
        )
        return locked_query

    monkeypatch.setattr(Query, "with_for_update", capture_for_update)

    reserve_quota(
        session,
        user.id,
        datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc),
    )

    assert len(compiled_lock_queries) == 1
    assert "FROM users" in compiled_lock_queries[0]
    assert compiled_lock_queries[0].endswith("FOR UPDATE")


def test_reservation_refreshes_a_cached_quota_after_locking(session, user):
    start = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)
    reserve_quota(session, user.id, start)
    cached = session.get(AIRecommendationQuota, (user.id, start.date()))
    assert cached.attempt_count == 1

    with Session(session.get_bind()) as concurrent:
        latest = concurrent.get(AIRecommendationQuota, (user.id, start.date()))
        latest.attempt_count = 2
        latest.last_attempt_at = start + timedelta(seconds=60)
        concurrent.commit()

    snapshot = reserve_quota(session, user.id, start + timedelta(seconds=120))

    assert snapshot.remaining == 0
    session.expire_all()
    assert session.get(AIRecommendationQuota, (user.id, start.date())).attempt_count == 3


def test_status_refreshes_a_cached_quota(session, user):
    start = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)
    reserve_quota(session, user.id, start)
    cached = session.get(AIRecommendationQuota, (user.id, start.date()))
    assert cached.attempt_count == 1

    with Session(session.get_bind()) as concurrent:
        latest = concurrent.get(AIRecommendationQuota, (user.id, start.date()))
        latest.attempt_count = 2
        latest.last_attempt_at = start + timedelta(seconds=60)
        concurrent.commit()

    snapshot = get_quota_status(session, user.id, start + timedelta(seconds=61))

    assert snapshot.remaining == 1
    assert snapshot.cooldown_until == start + timedelta(seconds=120)
