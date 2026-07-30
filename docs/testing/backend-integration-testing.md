# Backend Integration Testing Architecture

## Goal

Backend business behavior should be tested through the real FastAPI boundary and verified in the database after the request:

1. Arrange persisted SQLAlchemy rows.
2. Call the endpoint through `TestClient`.
3. Assert status code and response contract.
4. Assert database mutations with the test `Session`.
5. Mock every external service boundary.

## Current Baseline

- Backend routes are wired in `app/main.py`.
- SQLAlchemy models and session setup are in `app/database.py`.
- API schemas are in `app/schemas.py`.
- Existing tests already mix pure unit tests, route contract tests, and some API+DB integration tests.
- New backend integration tests belong under `tests/integration/backend/`.

## Test Layers

Use API integration tests as the default for backend business behavior that writes or reads user-owned state.

Use unit tests only for pure helpers such as parsers, formatters, normalization, and prompt/response validation.

Use contract tests for response-shape normalization when persistence is not the behavior under test.

## Shared Fixtures

The integration harness in `tests/integration/backend/conftest.py` provides:

- `db_session`: isolated SQLAlchemy session.
- `api_client`: FastAPI `TestClient` with `get_db` overridden.
- `user_factory`: persisted `User` rows with caller-provided fields.
- `auth_as`: current-user and optional-current-user overrides.
- `no_live_external_http`: guard against direct `httpx` calls.

Tests should arrange through models/factories, send HTTP requests, and assert DB state afterward.

## External Service Mock Boundaries

Route tests should patch the names imported by `app.main`, not provider SDKs:

- RAWG: `fetch_rawg_games`, `fetch_rawg_game_detail`, `fetch_rawg_upcoming_games`, `fetch_rawg_trending_games`.
- Steam: `fetch_owned_games`, `fetch_steam_friends`, `fetch_steam_player_summary`, `resolve_steam_openid`.
- Prices: `fetch_game_price_history`, `fetch_steam_store_game_price`, `fetch_steam_store_deals`, `fetch_steam_store_deal_candidates`.
- OpenAI: `get_personalized_recommendations`, `get_cached_steam_recommendations`.
- Cache/Redis: `get_json_cached` for route tests.
- Google: OAuth exchange/userinfo helpers imported in `app.main`.
- Telegram: link-token helpers, `send_telegram_message`, and `telegram_configured`.

Provider-module tests may patch lower-level `httpx` clients, but they must not perform live network calls. The root `tests/conftest.py` file installs an autouse network guard for the backend pytest suite so unmocked `httpx` calls fail fast.

## Coverage

Backend coverage is measured on every pytest run with:

```ini
--cov=app
--cov-report=term-missing:skip-covered
--cov-report=xml
```

`pytest-cov==6.2.1` is pinned in `requirements.txt`. Focused test runs should stay fast and should not fail only because a single slice does not cover the whole backend.

The full-suite coverage gate is enforced with:

```bash
python scripts/check_backend_coverage.py
```

The current enforced baseline is `94`, based on the full backend suite result above 94%. Do not lower this threshold. If a later PR raises backend coverage enough to support the next stable integer gate, raise the threshold in the same PR or in a follow-up coverage-maintenance PR.

## Rules For Subagents

Each subagent gets one backend slice and a disjoint test file. It should:

1. Read the relevant route in `app/main.py`.
2. Read touched models in `app/database.py`.
3. Add tests under `tests/integration/backend/`.
4. Use shared fixtures.
5. Mock external boundaries.
6. Run the focused test file. The main session runs `python scripts/check_backend_coverage.py` before publishing the PR.
7. Report files changed, endpoint behavior covered, DB assertions, mocks, and command result.

Subagents should not refactor product code unless a test exposes a real bug and the main agent approves the fix.

## Initial Coverage Backlog

1. Games CRUD and owner scoping.
2. Auth registration/login/current user.
3. Catalog library/favorites/wishlist persistence with RAWG mocked.
4. Price alerts CRUD and owner scoping.
5. Social friend requests, friendships, messages, and notifications.
6. PSN import confirmation.
7. Steam and Telegram account routes with providers mocked.
8. Dashboard/profile summary with Steam, deals, OpenAI, and cache mocked.
