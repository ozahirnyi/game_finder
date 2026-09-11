# Concurrent Action Capacity Design

## Goal

Support 100 simultaneous user-initiated actions without indefinite waits or a
site-wide outage. A normal database mutation must return a completed result or
a clear, bounded overload response. Slow work that depends on Steam, RAWG,
OpenAI, or Telegram must not occupy an HTTP worker while other users use the
site.

## Observed Production Constraint

The production FastAPI container uses SQLAlchemy's default `QueuePool`:
`pool_size=5` and `max_overflow=10`. The PostgreSQL server allows 100
connections and was using 11 at rest. The effective application limit was
therefore 15 concurrent requests requiring a database connection, which caused
the 100-request authenticated load test to time out.

## Architecture

### Request serving

Run two Uvicorn workers. Each worker uses an explicit SQLAlchemy pool with 15
persistent connections and 5 temporary overflow connections. The application
therefore has at most 40 database connections, leaving at least 60 PostgreSQL
connections for the database, administration, migrations, and future workers.

The database module reads the following validated environment values:

- `DB_POOL_SIZE`, default `15`;
- `DB_MAX_OVERFLOW`, default `5`;
- `DB_POOL_TIMEOUT_SECONDS`, default `5`.

Malformed or non-positive values fall back to the documented defaults. A pool
timeout becomes a FastAPI `503` response with a short retryable message, never
an unbounded wait.

### Slow work

Do not put external-provider calls onto an HTTP worker or database connection
while the browser waits. Add an ARQ worker service backed by the existing
Redis service. The API persists one `background_jobs` row before enqueuing
work, then returns HTTP `202 Accepted` and the job identifier. The row stores
the owner, operation name, queued/running/succeeded/failed state, result or
safe error message, timestamps, and a request idempotency key.

The browser polls an authenticated job-status endpoint. It only receives its
own jobs and shows a pending state while the worker runs. Successful jobs
return their result through the status response; failures are retryable and
never leave a spinner indefinitely.

Each owner and operation has at most one queued or running job for the same
idempotency key. A repeated click returns the existing job rather than
duplicating Steam, OpenAI, or Telegram work. Workers use bounded provider
timeouts, at most three retry attempts with backoff for transient failures,
and a concurrency limit of 10 jobs per worker process.

The first migrated operations are Steam library synchronization, Steam and AI
recommendations, PSN import confirmation, and Telegram delivery. Catalog,
price, and deal requests stay request/response APIs because their Redis cache
already coalesces normal repeated reads and the frontend needs their result
immediately.

### Deployment

The Docker startup command receives `UVICORN_WORKERS`, default `2`, and starts
Uvicorn with that worker count. `docker-compose.lightsail.yml` passes the
database pool and worker settings explicitly and starts a separate ARQ worker
container from the same image. The worker uses `REDIS_URL` and
`BACKGROUND_JOB_CONCURRENCY`, default `10`, so service capacity is auditable
in one deployment configuration.

## Error Handling

When SQLAlchemy cannot obtain a connection within the configured timeout, the
API returns HTTP `503` with `{ "detail": "Database is busy. Please retry in a few seconds." }`.
The request does not hold a worker beyond the timeout. Other request errors
retain their existing behavior.

For background work, the API returns `{ "id": "<uuid>", "status": "queued" }`
with HTTP `202`. A status response reports `queued`, `running`, `succeeded`,
or `failed`; it includes a result only for `succeeded` and a safe retryable
message only for `failed`. A worker crash leaves a job recoverable by ARQ's
retry policy rather than consuming an HTTP request.

## Tests and Acceptance Criteria

Tests construct the engine configuration from environment values and verify:

1. defaults are 15, 5, and 5 seconds;
2. valid environment values override defaults;
3. invalid values use defaults;
4. a pool timeout is mapped to the retryable 503 response.
5. a duplicate heavy-action request returns the original job;
6. a user cannot read another user's job;
7. a completed or failed worker job updates the durable status row;
8. each migrated frontend action renders queued, success, and retryable
   failure states.

After deployment, run a bounded production load test with 100 simultaneous
authenticated `GET /auth/me` and `GET /games` requests. Success means no
timeout, no site-wide health-check failure, and every response is either a
normal success or the explicit retryable 503. The preferred target is 100%
success for these lightweight reads.

## Non-goals

- Raising PostgreSQL `max_connections` above 100.
- Changing existing authentication or game-library response contracts.
