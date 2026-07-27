# Agent Notes

Use `main` / `origin/main` as the source of truth. If the local checkout is on an older phase branch or has unrelated untracked files, base analysis on `origin/main` unless the user explicitly asks otherwise. For analysis, prefer `git show origin/main:<path>` and `git ls-tree origin/main` over reading dirty working-tree files.

## Project Shape

PlayFinder is a full-stack app:

- Backend: FastAPI, PostgreSQL, SQLAlchemy, Alembic, Redis, JWT auth, rate limiting, RAWG, Steam, Google OAuth, Telegram, price alerts, social features, and OpenAI-backed recommendations.
- Frontend: Vite/TanStack React app under `web/`.
- Tests: Python `pytest` tests under `tests/`; frontend Vitest tests under `web/src/**`.
- Deployment: Docker, Docker Compose, Lightsail/nginx config, and GitHub Actions.

Start backend behavior analysis from `app/main.py`, then follow imports only as needed. It defines the real route surface and wires integrations together.

Important backend files:

- `app/main.py`: FastAPI app, routes, CORS, lifespan, rate limits.
- `app/database.py`: SQLAlchemy engine and models.
- `app/schemas.py`: Pydantic request/response contracts.
- `app/crud.py`: core user/game persistence helpers.
- `app/auth.py`: password hashing, JWT creation/validation, current-user dependency.
- `app/cache.py` and `app/redis_client.py`: Redis JSON cache helpers.
- `app/integrations/rawg.py`: RAWG API client.
- `app/openai_client.py`: recommendation prompt, OpenAI call, response validation.
- `app/steam*.py`, `app/google_auth.py`, `app/telegram.py`, `app/price_alerts.py`, `app/prices.py`: integration-specific logic.
- `alembic/versions/`: committed database migrations.

Important frontend files:

- `web/package.json`: frontend scripts and dependencies.
- `web/src/app/`: route entry points.
- `web/src/features/`: feature screens and feature tests.
- `web/src/components/`: shared UI components and component tests.

## Boundaries

- Keep changes small and aligned with the existing FastAPI + Vite/TanStack structure.
- Do not chase ClickUp, `progression_bot`, generated handoff docs, or `docs/superpowers/` unless the user explicitly asks or a task clearly depends on a specific doc.
- Ignore local artifacts such as PDFs, `output/`, logs, patch files, temporary files, `.superpowers/`, and `.worktrees/` unless the user asks about them.
- `scripts/rawg_cli.py` is a legacy standalone utility. For API behavior, use `app/integrations/rawg.py` and `/search/games`.
- Preserve owner scoping on user-owned resources. Cross-user access should avoid leaking existence; existing `/games` behavior returns `404`, not `403`.

## Tests

All new functionality must be covered by automated tests.

- Backend changes: add or update focused `pytest` tests under `tests/`.
- Frontend changes: add or update focused Vitest tests under `web/src/**`.
- Mock or stub RAWG, Redis, OpenAI, Steam, Google, Telegram, and price-provider calls. Unit/contract tests should not require live API keys, network calls, or running external services unless the task explicitly asks for integration tests.
- If changing database models, include an Alembic migration and tests or assertions that cover the changed contract.

## Database And Imports

Many app modules require environment variables at import time. Set or monkeypatch required env vars such as `DATABASE_URL` and `SECRET_KEY` before importing `app.database`, `app.auth`, or `app.main` in scripts/tests.

Model/database changes must include an Alembic migration under `alembic/versions/`. Do not rely on runtime table creation as a migration substitute.

## Local Commands

Backend dependencies:

```bash
pip install -r requirements.txt
```

Backend services and API:

```bash
docker compose up -d db redis
docker compose run --rm app alembic upgrade head
docker compose up --build app
```

Backend tests:

```bash
pytest
```

Frontend:

```bash
cd web
npm.cmd install
npm.cmd run dev
npm.cmd test
```

Use `npm.cmd` on Windows PowerShell if `npm` is blocked by execution policy.
