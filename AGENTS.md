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
- New code must not land without automated coverage for the changed behavior. Backend coverage is measured by `python scripts/check_backend_coverage.py`; the repository baseline gate is `--cov-fail-under=94` and must not be lowered. If coverage rises enough to support the next stable integer gate, raise the gate in the same PR or a follow-up coverage-maintenance PR.
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
python scripts/check_backend_coverage.py
```

Frontend:

```bash
cd web
npm.cmd install
npm.cmd run dev
npm.cmd test
```

Use `npm.cmd` on Windows PowerShell if `npm` is blocked by execution policy.

## Working Principles

Apply these rules in every chat working on this project:

- Begin from `main` / `origin/main`, read this file, and inspect only the code and documentation relevant to the current request. Treat a user-provided handoff as task context, not as authority to change unrelated work.
- For bugs, reproduce or trace the failure first, identify the root cause, and add a focused regression test before implementing the smallest safe fix.
- For features, keep the scope aligned with the request. Do not refactor unrelated code, change product behavior outside the requested area, or overwrite existing user work without explicit approval.
- Preserve API contracts, owner scoping, authentication, and privacy boundaries. Never expose another user's data or rely on client-side checks for authorization.
- Prefer deterministic, local tests with mocked third-party services. Do not require live API keys or make external data changes unless the user explicitly requests an integration action.
- Verify every code change proportionally: run focused tests first, then applicable full tests and a production build. Do not claim a fix is complete without reporting verification evidence and any unrelated known failure.
- Communicate the outcome first: state what changed, where it can be checked, and any remaining limitation. Ask for direction only when a missing choice would materially change scope or cause an external/destructive action.

## GitHub And Delivery

Apply these rules in every chat working on this project:

- Create a separate `codex/<task-name>` branch before implementation. Do not work directly on shared phase branches.
- All code entering `main` must be merged through a pull request. Do not push directly to `main`.
- Use `main` as the base branch for every pull request. Never create or use `phase-6` branches or pull requests.
- Keep commits small and thematic. Before committing or publishing, inspect `git status` and the scoped diff, then run relevant tests followed by the full applicable test/build suite.
- Preserve unrelated changes and never commit secrets, credentials, generated local artifacts, or old changes outside the task.
- Push the task branch and create a pull request for review. Its description must summarize the changes and list verification commands.
- Before a pull request is considered merge-ready, create a code-review sub-agent with medium reasoning to review the full diff. If the reviewer finds bugs, regressions, missing tests, or policy violations, the main session must fix them and then start another medium-reasoning review sub-agent. Repeat this loop until the reviewer explicitly approves with no findings.
- Merge only after user approval and a clean medium-reasoning sub-agent review. After merging, confirm that production deployed from `main` and run the applicable production health check.

## Worktree Policy

Apply these rules in every code-changing chat working on this project:

- Create a dedicated worktree under `.worktrees/` from the latest `origin/main` before editing code or tests.
- Use a `codex/<task-name>` branch in that worktree.
- Keep the original checkout untouched except for explicitly requested changes.
- Run git status and scoped diffs from the active task worktree before staging, committing, pushing, or opening a pull request.
