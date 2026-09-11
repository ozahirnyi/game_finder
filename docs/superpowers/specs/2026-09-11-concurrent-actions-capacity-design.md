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

Do not put external-provider calls onto the database connection pool. The
first implementation phase retains the existing synchronous HTTP contracts but
moves nonessential Telegram notification delivery off the database mutation
path. Steam synchronization, Steam recommendations, AI recommendations, and
price/catalog refreshes remain explicitly bounded by their existing provider
timeouts; a durable Redis job API is a separate follow-up because it changes
the client contract to `202 Accepted` plus job-status polling.

This keeps the immediate fix focused on the demonstrated production outage and
avoids exposing a partial job system without persistence, status reporting, or
frontend support.

### Deployment

The Docker startup command receives `UVICORN_WORKERS`, default `2`, and starts
Uvicorn with that worker count. `docker-compose.lightsail.yml` passes the
database pool and worker settings explicitly so the production deployment has
one auditable configuration surface.

## Error Handling

When SQLAlchemy cannot obtain a connection within the configured timeout, the
API returns HTTP `503` with `{ "detail": "Database is busy. Please retry in a few seconds." }`.
The request does not hold a worker beyond the timeout. Other request errors
retain their existing behavior.

## Tests and Acceptance Criteria

Tests construct the engine configuration from environment values and verify:

1. defaults are 15, 5, and 5 seconds;
2. valid environment values override defaults;
3. invalid values use defaults;
4. a pool timeout is mapped to the retryable 503 response.

After deployment, run a bounded production load test with 100 simultaneous
authenticated `GET /auth/me` and `GET /games` requests. Success means no
timeout, no site-wide health-check failure, and every response is either a
normal success or the explicit retryable 503. The preferred target is 100%
success for these lightweight reads.

## Non-goals

- Raising PostgreSQL `max_connections` above 100.
- Adding a Redis-backed durable job model, job-status API, or frontend polling
  in this change.
- Changing existing authentication or game-library response contracts.
