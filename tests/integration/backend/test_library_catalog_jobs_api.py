import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import text

from app.database import BackgroundJob, Game

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def production_active_job_index(db_session):
    # SQLite ignores the model's postgresql_where; mirror the production index.
    db_session.execute(text("DROP INDEX uq_background_jobs_active_idempotency"))
    db_session.execute(text("CREATE UNIQUE INDEX uq_background_jobs_active_idempotency ON background_jobs "
                            "(owner_id, operation, idempotency_key) WHERE status IN ('queued', 'running')"))
    db_session.commit()


def add_game(db, owner, **kwargs):
    game = Game(owner_id=owner.id, title="Hades", source="psn", **kwargs)
    db.add(game)
    db.commit()
    return game


def test_jobs_require_authentication(api_client):
    assert api_client.post("/library/catalog-matches/jobs").status_code == 401
    assert api_client.get("/library/catalog-matches/jobs/current").status_code == 401
    assert api_client.delete(f"/library/catalog-matches/jobs/{uuid.uuid4()}").status_code == 401


def test_start_snapshots_owner_source_and_reuses_active_job(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    own = add_game(db_session, owner, link_state="raw")
    add_game(db_session, owner, link_state="linked", catalog_game_id=1)
    add_game(db_session, owner, link_state="quarantined")
    db_session.add(Game(owner_id=owner.id, title="Manual", source="manual"))
    db_session.commit()
    add_game(db_session, user_factory(email="foreign-job@example.com"))
    lookup = AsyncMock(side_effect=AssertionError("Lookup must run in worker"))
    monkeypatch.setattr(app_main, "preview_library_catalog_matches", lookup)
    first = api_client.post("/library/catalog-matches/jobs?source=psn")
    assert first.status_code == 202
    job = db_session.get(BackgroundJob, uuid.UUID(first.json()["id"]))
    assert job.payload["game_ids"] == [str(own.id)]
    assert job.result["total"] == 1 and job.result["processed"] == 0
    assert api_client.post("/library/catalog-matches/jobs?source=psn&include_linked=true").json()["id"] == str(job.id)
    assert api_client.get("/library/catalog-matches/jobs/current?source=psn").json()["id"] == str(job.id)
    assert api_client.delete(f"/library/catalog-matches/jobs/{job.id}").status_code == 409
    lookup.assert_not_awaited()
    auth_as(user_factory(email="private-job@example.com"))
    assert api_client.get("/library/catalog-matches/jobs/current?source=psn").status_code == 404
    assert api_client.get(f"/background-jobs/{job.id}").status_code == 404
    assert api_client.delete(f"/library/catalog-matches/jobs/{job.id}").status_code == 404


def test_corrections_and_broker_failure_keep_a_durable_snapshot(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    owner = auth_as(user_factory())
    linked = add_game(db_session, owner, link_state="linked", catalog_game_id=1)
    monkeypatch.setattr(app_main, "dispatch_job", AsyncMock(side_effect=OSError("Broker down")))
    response = api_client.post("/library/catalog-matches/jobs?source=psn&include_linked=true")
    assert response.status_code == 202
    job = db_session.get(BackgroundJob, uuid.UUID(response.json()["id"]))
    assert job.status == "queued" and job.payload["game_ids"] == [str(linked.id)]
    assert job.result["include_linked"] is True
    job.status = "succeeded"
    db_session.commit()
    assert api_client.delete(f"/library/catalog-matches/jobs/{job.id}").status_code == 200
    assert api_client.get("/library/catalog-matches/jobs/current?source=psn").status_code == 404
    assert api_client.post("/library/catalog-matches/jobs?source=psn").json()["id"] != str(job.id)


def test_worker_checkpoints_requeues_and_restores_results_without_linking(
    api_client, db_session, user_factory, auth_as, monkeypatch
):
    from app import worker, library_catalog_jobs

    owner = auth_as(user_factory())
    games = [add_game(db_session, owner, link_state="raw") for _ in range(3)]
    response = api_client.post("/library/catalog-matches/jobs?source=psn")
    job_id = response.json()["id"]
    monkeypatch.setattr(library_catalog_jobs, "MATCH_JOB_BATCH_SIZE", 2)
    monkeypatch.setattr(worker, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)
    dispatched = AsyncMock(side_effect=OSError("Redis reconnecting"))
    monkeypatch.setattr(worker, "dispatch_job_id", dispatched)

    async def preview(rows, **_kwargs):
        return [{"game_id": row.id, "title": row.title, "source": row.source,
                 "link_state": "raw", "catalog_game_id": None, "status": "matched",
                 "suggestions": [{"id": 1, "title": "Hades", "platforms": [], "confidence": "exact"}]}
                for row in rows]

    monkeypatch.setattr(library_catalog_jobs, "preview_library_catalog_matches", preview)
    asyncio.run(worker.run_background_job({}, job_id))
    first = api_client.get("/library/catalog-matches/jobs/current?source=psn").json()
    assert first["status"] == "queued"
    assert first["result"]["processed"] == 2 and first["result"]["remaining"] == 1
    assert first["result"]["matched"] == 2 and len(first["result"]["items"]) == 2
    dispatched.assert_awaited_once_with(job_id)
    asyncio.run(worker.run_background_job({}, job_id))
    final = api_client.get("/library/catalog-matches/jobs/current?source=psn").json()
    assert final["status"] == "succeeded"
    assert final["result"]["processed"] == 3 and final["result"]["remaining"] == 0
    assert {item["game_id"] for item in final["result"]["items"]} == {str(game.id) for game in games}
    for game in games:
        db_session.refresh(game)
        assert game.catalog_game_id is None and game.link_state == "raw"
    asyncio.run(worker.run_background_job({}, job_id))
    assert api_client.get("/library/catalog-matches/jobs/current?source=psn").json() == final


def test_deleted_rows_do_not_prevent_job_completion(
    api_client, db_session, user_factory, auth_as, monkeypatch
):
    from app import library_catalog_jobs
    owner = auth_as(user_factory())
    game = add_game(db_session, owner)
    response = api_client.post("/library/catalog-matches/jobs?source=psn")
    job = db_session.get(BackgroundJob, uuid.UUID(response.json()["id"]))
    db_session.delete(game)
    db_session.commit()
    lookup = AsyncMock(side_effect=AssertionError("No remaining rows"))
    monkeypatch.setattr(library_catalog_jobs, "preview_library_catalog_matches", lookup)
    result = asyncio.run(library_catalog_jobs.process_matching_job(db_session, job))
    assert result["processed"] == result["total"] == 1
    assert result["remaining"] == 0 and result["items"] == []
    lookup.assert_not_awaited()


def test_worker_failure_is_saved_and_can_be_retried(
    api_client, db_session, user_factory, auth_as, monkeypatch
):
    from app import worker
    owner = auth_as(user_factory())
    add_game(db_session, owner)
    response = api_client.post("/library/catalog-matches/jobs?source=psn")
    job_id = response.json()["id"]
    monkeypatch.setattr(worker, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)
    monkeypatch.setattr(worker, "process_matching_job", AsyncMock(side_effect=RuntimeError("private provider failure")))
    with pytest.raises(RuntimeError):
        asyncio.run(worker.run_background_job({}, job_id))
    saved = api_client.get("/library/catalog-matches/jobs/current?source=psn").json()
    assert saved["status"] == "failed"
    assert "private" not in saved["error"] and saved["result"]["processed"] == 0
    assert api_client.post("/library/catalog-matches/jobs?source=psn").json()["id"] != job_id


def test_empty_snapshot_completes_and_scope_is_validated(
    api_client, db_session, user_factory, auth_as
):
    from app.library_catalog_jobs import process_matching_job
    owner = auth_as(user_factory())
    assert api_client.post("/library/catalog-matches/jobs?source=steam").status_code == 422
    assert api_client.get("/library/catalog-matches/jobs/current?source=steam").status_code == 422
    response = api_client.post("/library/catalog-matches/jobs?source=manual")
    job = db_session.get(BackgroundJob, uuid.UUID(response.json()["id"]))
    assert job.owner_id == owner.id and job.result["total"] == 0
    result = asyncio.run(process_matching_job(db_session, job))
    assert result["processed"] == result["remaining"] == result["matched"] == 0
