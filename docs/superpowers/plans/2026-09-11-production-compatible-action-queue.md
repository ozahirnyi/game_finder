# Production-Compatible Action Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move user-triggered recommendation work off API request handlers without breaking the production database at revision `bc72e81f4a10`.

**Architecture:** A durable PostgreSQL `background_jobs` table records ownership, idempotency and terminal state. FastAPI enqueues named jobs into Redis/ARQ; a separate worker claims each row atomically and persists a sanitized result. The API returns `202` with a job resource that the frontend polls.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Redis, ARQ, pytest.

## Global Constraints

- The migration must use `bc72e81f4a10` as its `down_revision`.
- Preserve `User.display_name` creation through `app.crud.create_user`.
- Do not merge or deploy PR #226; its history is incompatible with production `main`.
- Run destructive or load-impacting production actions only after local and staging-compatible checks pass.

---

### Task 1: Durable job record and migration

**Files:**
- Modify: `app/database.py`
- Create: `alembic/versions/d4e5f6a7b8c9_add_background_jobs.py`
- Test: `tests/test_background_jobs.py`

**Interfaces:** Produces `BackgroundJob` with `id`, `owner_id`, `operation`, `idempotency_key`, `status`, `payload`, `result`, `error`.

- [ ] Add a failing model-column assertion and run `pytest -q tests/test_background_jobs.py`.
- [ ] Add the SQLAlchemy model and the migration with `down_revision = "bc72e81f4a10"`.
- [ ] Run the focused tests, then `alembic heads` to confirm one reachable head.

### Task 2: Enqueue and worker boundary

**Files:**
- Modify: `app/background_jobs.py`
- Create: `app/worker.py`
- Modify: `requirements.txt`, `docker-compose.lightsail.yml`
- Test: `tests/test_background_jobs.py`

**Interfaces:** `enqueue_or_get_job(db, owner_id, operation, idempotency_key, payload)` returns one active job; `run_background_job(ctx, job_id)` claims and completes it.

- [ ] Add duplicate-request and unsupported-operation tests and watch them fail.
- [ ] Implement an atomic active-job lookup, ARQ dispatch, and recommendation worker handler.
- [ ] Run focused tests and verify the worker service is declared but not started locally by default.

### Task 3: Recommendation job API

**Files:**
- Modify: `app/main.py`, `app/schemas.py`
- Test: `tests/test_background_jobs.py`, `tests/test_api_contracts.py`

**Interfaces:** `POST /recommendations` responds `202` with `BackgroundJobRead`; `GET /background-jobs/{id}` returns only an owner’s job.

- [ ] Add failing tests that prohibit inline OpenAI execution and prevent cross-user reads.
- [ ] Implement queue submission, job read response and quota handling at completion.
- [ ] Run focused API tests.

### Task 4: Client polling and production verification

**Files:**
- Modify: `web/src/lib/api.ts` and recommendation callers
- Test: relevant web unit tests

- [ ] Add a client test for polling a `queued` job until terminal.
- [ ] Implement polling with bounded retry and user-visible failure state.
- [ ] Run backend/web tests, build images, deploy with the worker scaled to one, migrate once, then run a gradual 100-user authenticated load test.
