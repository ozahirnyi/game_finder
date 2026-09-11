# Concurrent Action Capacity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept 100 simultaneous user actions without pool-induced outages and run slow, external-provider work through durable Redis jobs.

**Architecture:** FastAPI runs two Uvicorn workers, each with an explicit bounded SQLAlchemy pool. A PostgreSQL `background_jobs` row owns each ARQ job and is the authorization/status source of truth. Heavy-action endpoints enqueue jobs and return `202`; the frontend polls one authenticated status endpoint until it can render a result or retryable failure.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy, Alembic, ARQ/Redis, PostgreSQL, React 19, TypeScript, TanStack Start, Vitest, pytest.

## Global Constraints

- Preserve existing synchronous contracts for normal `/games`, social, catalog, price, and deal routes.
- Use at most 40 application PostgreSQL connections across two web workers: `2 * (15 + 5)`.
- Job ownership is mandatory on every status read; never expose another user's result.
- A database pool wait is bounded to five seconds and returns retryable HTTP 503.
- Heavy actions return HTTP 202 and no browser wait may depend on Steam, RAWG, OpenAI, or Telegram.
- Deploy only after the local suites and a bounded production 100-user test pass.

---

### Task 1: Make database capacity explicit and bounded

**Files:**
- Modify: `app/database.py:1-20`
- Modify: `app/main.py:1-110`
- Modify: `tests/test_config.py`

**Interfaces:**
- Produces: `database_engine_options_from_env() -> dict[str, int | float]`.
- Produces: a FastAPI handler mapping `sqlalchemy.exc.TimeoutError` to HTTP 503.

- [ ] **Step 1: Write failing configuration tests**

Add tests that clear `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, and `DB_POOL_TIMEOUT_SECONDS`, assert `{pool_size: 15, max_overflow: 5, pool_timeout: 5}`, then set valid values and assert the overrides. Add one parameterized invalid-value test for `0`, `-1`, and non-numeric input.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `rtk pytest -q tests/test_config.py -k db_pool`

Expected: FAIL because `database_engine_options_from_env` does not exist.

- [ ] **Step 3: Implement environment parsing and engine options**

In `app/database.py`, add an integer/float environment parser that rejects values below one. Construct the engine with `pool_size`, `max_overflow`, and `pool_timeout` from `database_engine_options_from_env()`. Keep the SQLite test URL compatible by omitting PostgreSQL pool arguments for SQLite.

- [ ] **Step 4: Map an exhausted pool to a retryable response**

In `app/main.py`, register an exception handler for SQLAlchemy `TimeoutError` that returns `JSONResponse(status_code=503, content={"detail": "Database is busy. Please retry in a few seconds."})`.

- [ ] **Step 5: Verify GREEN and commit**

Run: `rtk pytest -q tests/test_config.py`

Expected: PASS.

Commit: `git commit -am "fix: bound database connection waits"`

### Task 2: Persist and authorize background jobs

**Files:**
- Modify: `app/database.py`
- Create: `alembic/versions/d4e5f6a7b8c9_add_background_jobs.py`
- Modify: `app/schemas.py`
- Create: `app/background_jobs.py`
- Modify: `tests/test_api_contracts.py`

**Interfaces:**
- Produces: `BackgroundJob` model with `id`, `owner_id`, `operation`, `idempotency_key`, `status`, `result`, `error`, `created_at`, `updated_at`.
- Produces: `enqueue_or_get_job(db, owner_id, operation, idempotency_key, payload) -> BackgroundJob`.
- Produces: `GET /jobs/{job_id}` returning `BackgroundJobRead` only for its owner.

- [ ] **Step 1: Write failing API-contract tests**

Add tests that create a job, assert a duplicate owner/operation/idempotency key returns the same id, assert a second user receives 404 for the first user's job, and assert valid status payloads serialize `queued`, `running`, `succeeded`, and `failed`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `rtk pytest -q tests/test_api_contracts.py -k background_job`

Expected: FAIL because the model and endpoint do not exist.

- [ ] **Step 3: Add the model and migration**

Add the `background_jobs` table with UUID primary key, foreign key to `users`, JSON result/payload fields, nullable safe error, timestamps, and a unique partial index on `(owner_id, operation, idempotency_key)` while `status IN ('queued', 'running')`. Add the matching Alembic upgrade/downgrade migration from head `f4b7b884c2d1`.

- [ ] **Step 4: Add job schemas, repository functions, and status endpoint**

Use Pydantic models `BackgroundJobAccepted` and `BackgroundJobRead`. The endpoint loads by both job id and current-user id, returning 404 for another owner. Return a result only for `succeeded` and a safe error only for `failed`.

- [ ] **Step 5: Verify GREEN and commit**

Run: `rtk pytest -q tests/test_api_contracts.py -k background_job`

Expected: PASS.

Commit: `git commit -am "feat: add durable background job status"`

### Task 3: Run heavy actions in ARQ workers

**Files:**
- Modify: `requirements.txt`
- Create: `app/worker.py`
- Modify: `app/background_jobs.py`
- Modify: `app/main.py:384-435,737-755,841-990,1140-1155`
- Modify: `docker-compose.lightsail.yml`
- Modify: `Dockerfile`
- Test: `tests/test_background_jobs.py`

**Interfaces:**
- Produces: ARQ `WorkerSettings` with Redis connection and `max_jobs` from `BACKGROUND_JOB_CONCURRENCY`, default 10.
- Consumes: `BackgroundJob.id` and serialized operation payload.
- Produces: `POST /psn/import/confirm`, `POST /steam/library/sync`, `POST /steam/recommendations`, `POST /recommendations`, and `POST /telegram/test-alert` responses of `BackgroundJobAccepted` with HTTP 202.

- [ ] **Step 1: Write failing worker tests**

Use a fake queue and provider functions to assert that each endpoint returns 202 without invoking Steam, OpenAI, or Telegram inline; assert the worker marks the owned job `succeeded` with its original response payload, and marks provider failure `failed` with a safe message.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `rtk pytest -q tests/test_background_jobs.py`

Expected: FAIL because ARQ dispatch and worker functions do not exist.

- [ ] **Step 3: Add ARQ worker and dispatch boundary**

Add `arq` to requirements. Build an `app/worker.py` function registry that opens a short-lived SQLAlchemy session per job, transitions `queued` to `running`, executes the named operation, then writes `succeeded`/result or `failed`/safe error. Configure retry count three and bounded backoff. Never pass JWTs or credentials into Redis payloads; pass job ids and minimal validated operation arguments only.

- [ ] **Step 4: Convert heavy endpoints to enqueue only**

Move the existing operation bodies into worker-callable functions. Each route validates/authenticates exactly as before, derives a deterministic idempotency key from owner, operation, and normalized request, then calls `enqueue_or_get_job`. Return `202` and the existing job if the action is already queued/running.

- [ ] **Step 5: Add worker service deployment configuration**

Set Docker's web command to `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${UVICORN_WORKERS:-2}`. Add an `app-worker` compose service from the same build that runs `arq app.worker.WorkerSettings`, shares `.env`, depends on healthy Postgres and Redis, and receives `BACKGROUND_JOB_CONCURRENCY=10`.

- [ ] **Step 6: Verify GREEN and commit**

Run: `rtk pytest -q tests/test_background_jobs.py tests/test_api_contracts.py`

Expected: PASS.

Commit: `git commit -am "feat: queue heavy user actions"`

### Task 4: Poll jobs and render durable action states in the browser

**Files:**
- Modify: `web/src/lib/api.ts`
- Create: `web/src/lib/background-jobs.ts`
- Modify: `web/src/features/integrations/SteamScreen.tsx`
- Modify: `web/src/features/integrations/PsnScreen.tsx`
- Modify: `web/src/features/integrations/ProfileScreen.tsx`
- Test: `web/src/lib/api.test.ts`
- Test: `web/src/features/integrations/integrations.test.tsx`

**Interfaces:**
- Produces: `BackgroundJobAccepted`, `BackgroundJobRead`, `getBackgroundJob(id)`, and `waitForBackgroundJob(id, signal)`.
- Consumes: 202 responses from each migrated heavy-action endpoint.
- Produces: queued, completed, and retryable-error UI states without an indefinite loading control.

- [ ] **Step 1: Write failing frontend tests**

Mock a queued job followed by `succeeded` and assert that the Steam recommendation button shows an in-progress message then renders recommendations. Mock `failed` and assert an error state with Retry. Add equivalent PSN and Telegram assertions that controls remain disabled only while the corresponding job is queued/running. The generic AI API is queued in Task 3 but has no active frontend caller in this revision, so it receives API-contract coverage only.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `rtk proxy npm --prefix web test -- --run src/features/integrations/integrations.test.tsx`

Expected: FAIL because job polling APIs and queued UI states do not exist.

- [ ] **Step 3: Add typed API and cancellable polling helper**

Add job types and authenticated `GET /jobs/{id}` to `api.ts`. `waitForBackgroundJob` polls every second, stops on `succeeded` or `failed`, accepts an `AbortSignal`, and fails after a documented two-minute browser timeout with a retryable message.

- [ ] **Step 4: Adapt each heavy-action screen**

On action submission, store the accepted job, show `Queued - processing...`, poll, and map the successful result into the exact existing component state. On unmount, abort polling. A failed job displays its safe message and restores the action button for Retry.

- [ ] **Step 5: Verify GREEN and commit**

Run: `rtk proxy npm --prefix web test -- --run src/features/integrations/integrations.test.tsx src/lib/api.test.ts`

Expected: PASS.

Commit: `git commit -am "feat: show queued heavy actions"`

### Task 5: Verify capacity and release safely

**Files:**
- Modify: `README.md:deployment section`
- Modify: `.env.example`
- Modify: `web/.env.production.example` only if its API contract documentation changes

- [ ] **Step 1: Document exact production settings**

Document `UVICORN_WORKERS=2`, `DB_POOL_SIZE=15`, `DB_MAX_OVERFLOW=5`, `DB_POOL_TIMEOUT_SECONDS=5`, and `BACKGROUND_JOB_CONCURRENCY=10`, plus the migration and worker startup order.

- [ ] **Step 2: Run all backend tests**

Run: `rtk pytest -q`

Expected: PASS.

- [ ] **Step 3: Run frontend quality checks**

Run: `rtk proxy npm --prefix web run lint`

Run: `rtk proxy npm --prefix web test -- --run`

Run: `rtk proxy npm --prefix web run build`

Expected: all commands exit 0.

- [ ] **Step 4: Build the deployment locally**

Run: `rtk proxy docker compose -f docker-compose.lightsail.yml config`

Expected: the rendered compose file has `app`, `app-worker`, `db`, `redis`, and `web` services with no missing variables.

- [ ] **Step 5: Production verification after approved deployment**

Apply the Alembic migration, deploy the compose changes, then perform exactly 100 simultaneous authenticated `GET /auth/me` and `GET /games` requests. Verify all succeed or return an explicit 503 within five seconds, `/api/health` stays responsive, one submitted heavy action returns 202, and its job eventually reaches `succeeded` or a safe `failed` state.

- [ ] **Step 6: Commit and open PR**

Commit: `git commit -am "docs: document concurrent action operations"`

Push `codex/concurrent-actions-capacity` and open a pull request against the project default branch.
