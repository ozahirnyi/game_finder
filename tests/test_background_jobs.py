def test_background_job_terminal_statuses_are_explicit():
    from app.background_jobs import is_terminal_status

    assert not is_terminal_status("queued")
    assert not is_terminal_status("running")
    assert is_terminal_status("succeeded")
    assert is_terminal_status("failed")


def test_background_job_model_records_owner_operation_and_state():
    from app.database import BackgroundJob

    columns = {column.name for column in BackgroundJob.__table__.columns}

    assert {
        "id", "owner_id", "operation", "idempotency_key", "status", "payload", "result", "error"
    } <= columns


def test_enqueue_returns_an_existing_active_job(monkeypatch):
    import uuid
    from types import SimpleNamespace
    from app import background_jobs

    owner_id = uuid.uuid4()
    existing = SimpleNamespace(id=uuid.uuid4(), status="queued")
    monkeypatch.setattr(background_jobs, "find_active_job", lambda *_args: existing)

    job = background_jobs.enqueue_or_get_job(
        object(), owner_id, "recommendations", "same-request", {"prompt": "cozy"}
    )

    assert job is existing


def test_worker_executes_recommendation_without_request_handler(monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from app import worker

    monkeypatch.setattr(
        worker,
        "get_recommendation",
        lambda prompt, liked_game_ids: {"recommendations": [{"title": f"{prompt}:{liked_game_ids[0]}"}]},
    )

    async def enrich(items, _fetch):
        return [{**item, "game": {"id": 570}} for item in items]

    monkeypatch.setattr(worker, "enrich_recommendations", enrich, raising=False)

    result = asyncio.run(
        worker.execute_background_operation(
            object(),
            SimpleNamespace(operation="recommendations", payload={"prompt": "cozy", "liked_game_ids": [570]}),
        )
    )

    assert result == {"recommendations": [{"title": "cozy:570", "game": {"id": 570}}]}


def test_dispatch_enqueues_only_the_durable_job_id(monkeypatch):
    import asyncio
    import sys
    import types
    import uuid
    from app import background_jobs

    calls = []

    class FakePool:
        async def enqueue_job(self, name, job_id):
            calls.append((name, job_id))

        async def aclose(self):
            calls.append(("close", None))

    async def create_pool(_settings):
        return FakePool()

    monkeypatch.setitem(sys.modules, "arq", types.SimpleNamespace(create_pool=create_pool))
    monkeypatch.setattr(background_jobs, "redis_settings", lambda: "redis-settings", raising=False)
    job = types.SimpleNamespace(id=uuid.uuid4())

    asyncio.run(background_jobs.dispatch_job(job))

    assert calls == [("run_background_job", str(job.id)), ("close", None)]


def test_background_job_read_exposes_only_safe_polling_fields():
    import uuid
    from app.schemas import BackgroundJobRead

    job = BackgroundJobRead(id=uuid.uuid4(), status="queued")

    assert job.status == "queued"
    assert job.result is None
    assert job.error is None


def test_database_pool_reserves_capacity_for_concurrent_api_requests():
    from app.database import engine

    assert engine.pool.size() == 15
    assert engine.pool._max_overflow == 5


def test_recommendation_submission_enqueues_without_inline_openai(monkeypatch):
    import asyncio
    import uuid
    from types import SimpleNamespace
    from app import main
    from app.schemas import RecommendationRequest

    job = SimpleNamespace(id=uuid.uuid4(), status="queued", result=None, error=None)
    dispatched = []
    monkeypatch.setattr(main, "check_quota_available", lambda *_args: SimpleNamespace())
    monkeypatch.setattr(main, "enqueue_or_get_job", lambda *_args: job, raising=False)
    monkeypatch.setattr(main, "get_recommendation", lambda *_args: (_ for _ in ()).throw(AssertionError("inline OpenAI call")))

    async def dispatch(created_job):
        dispatched.append(created_job.id)

    monkeypatch.setattr(main, "dispatch_job", dispatch, raising=False)
    result = asyncio.run(
        main.recommendations.__wrapped__(
            SimpleNamespace(),
            RecommendationRequest(prompt="cozy", liked_game_ids=[570]),
            object(),
            SimpleNamespace(id=uuid.uuid4()),
        )
    )

    assert result.model_dump() == {"id": job.id, "status": "queued", "result": None, "error": None}
    assert dispatched == [job.id]
