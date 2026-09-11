import uuid
import asyncio
from types import SimpleNamespace

import pytest
from sqlalchemy.exc import IntegrityError


def test_job_status_is_terminal_only_for_completed_or_failed_work():
    from app.background_jobs import is_terminal_status

    assert not is_terminal_status("queued")
    assert not is_terminal_status("running")
    assert is_terminal_status("succeeded")
    assert is_terminal_status("failed")


def test_background_job_model_persists_owner_operation_and_status():
    from app.database import BackgroundJob

    columns = {column.name for column in BackgroundJob.__table__.columns}

    assert {"id", "owner_id", "operation", "idempotency_key", "status", "payload", "result", "error"} <= columns


def test_worker_executes_recommendation_operation_without_http_request(monkeypatch):
    from app import worker

    monkeypatch.setattr(
        worker,
        "get_recommendation",
        lambda prompt, liked_game_ids: {"recommendations": [{"title": f"{prompt}:{liked_game_ids[0]}"}]},
    )
    job = SimpleNamespace(
        operation="recommendations",
        payload={"prompt": "cozy", "liked_game_ids": [570]},
    )

    result = asyncio.run(worker.execute_background_operation(object(), job))

    assert result == {"recommendations": [{"title": "cozy:570"}]}


def test_worker_rejects_unsupported_operation_with_safe_failure_boundary():
    from app import worker

    job = SimpleNamespace(operation="unknown", payload={})

    with pytest.raises(worker.BackgroundJobOperationError, match="Unsupported background operation"):
        asyncio.run(worker.execute_background_operation(object(), job))


def test_duplicate_insert_race_returns_the_active_job(monkeypatch):
    from app import background_jobs

    owner_id = uuid.uuid4()
    existing = SimpleNamespace(id=uuid.uuid4(), status="queued")
    lookups = iter([None, existing])
    monkeypatch.setattr(background_jobs, "find_active_job", lambda *_args: next(lookups))

    class Db:
        def add(self, _job):
            pass

        def commit(self):
            raise IntegrityError("insert", {}, Exception("duplicate"))

        def rollback(self):
            pass

        def refresh(self, _job):
            raise AssertionError("a conflicted job must not be refreshed")

    job = background_jobs.enqueue_or_get_job(Db(), owner_id, "recommendations", "same", {"prompt": "cozy"})

    assert job is existing


def test_recommendation_route_enqueues_without_calling_openai(monkeypatch):
    from fastapi.testclient import TestClient
    from app import main

    owner = SimpleNamespace(id=uuid.uuid4())
    job = SimpleNamespace(id=uuid.uuid4(), status="queued")
    dispatched = []
    monkeypatch.setattr(main, "enqueue_or_get_job", lambda *_args: job)
    monkeypatch.setattr(main, "get_recommendation", lambda *_args: (_ for _ in ()).throw(AssertionError("inline OpenAI call")))

    async def fake_dispatch(dispatched_job):
        dispatched.append(dispatched_job.id)

    monkeypatch.setattr(main, "dispatch_job", fake_dispatch)
    main.app.dependency_overrides[main.get_current_user] = lambda: owner
    main.app.dependency_overrides[main.get_db] = lambda: object()
    try:
        response = TestClient(main.app).post("/recommendations", json={"prompt": "cozy", "liked_game_ids": [570]})
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 202
    assert response.json() == {"id": str(job.id), "status": "queued"}
    assert dispatched == [job.id]
