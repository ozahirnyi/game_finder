# All Users and Game Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 10-per-page public player directory, recent active players to game details, fix Friends search duplication, and add the supplied Playfinder favicon.

**Architecture:** FastAPI reads already imported Steam `Game` records and returns privacy-filtered directory/activity DTOs. TanStack routes consume typed API functions; existing `UserProfileLink`, friend request mutations, and dashboard styling are reused.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React 19, TanStack Router/Query, Vitest, pytest.

## Global Constraints

- Directory pagination is exactly 10 users per page; never use Load more.
- Active-player ranking is site-wide, Steam-only, and restricted to `playtime_2weeks > 0`.
- Preserve existing block and public-profile rules.
- Run frontend tests from `Z:\Dev\PycharmProjects\game_finder\.worktrees\all-users-game-activity\web` on this host.

---

### Task 1: Public directory API

**Files:** `app/main.py`, `app/schemas.py`, `tests/integration/backend/test_social_api.py`

- [ ] Write failing tests for `/social/users?page=1` asserting `page_size == 10`, deterministic total/pages, self exclusion, and blocked-user exclusion.
- [ ] Run the focused pytest test; confirm it fails because the endpoint/schema do not exist.
- [ ] Add `PublicUserDirectoryRead` and an authenticated endpoint returning `items`, `page`, `page_size`, and `total`; query eligible users in stable order and use existing social policy helpers.
- [ ] Re-run the focused test and then the social API suite.
- [ ] Commit `feat: add paginated public user directory`.

### Task 2: Active players API

**Files:** `app/main.py`, `app/schemas.py`, `tests/integration/backend/test_social_api.py`

- [ ] Write failing tests for `/catalog/games/{catalog_game_id}/active-players` covering catalog match, one row per user, positive two-week playtime only, descending ordering, and profile-safe payloads.
- [ ] Run the focused pytest test and verify expected failure.
- [ ] Add `RecentGamePlayerRead` plus the endpoint using `Game.source == "steam"`, matching `catalog_game_id`, and `Game.playtime_2weeks > 0`; join users, apply policy, group by owner, and limit to 10.
- [ ] Re-run the focused and backend social tests.
- [ ] Commit `feat: expose recent game players`.

### Task 3: Typed client and All users route

**Files:** `web/src/lib/api.ts`, `web/src/routes/users.index.tsx`, `web/src/routes/-users.index.test.tsx`, `web/src/routeTree.gen.ts`

- [ ] Write route tests that expect ten cards, numbered pagination, profile links, and request-action states from mocked directory data.
- [ ] Run the test and verify it fails because the route/client function are absent.
- [ ] Add DTOs and `getPublicUsers(page)`; implement `/users` with page query validation, query state, cards, `UserProfileLink`, existing request mutation, and loading/empty/error/retry states.
- [ ] Regenerate/verify route tree and run the focused test.
- [ ] Commit `feat: add all users directory`.

### Task 4: Friends entry point and search regression

**Files:** `web/src/routes/friends.index.tsx`, `web/src/routes/-friends.index.test.tsx`

- [ ] Write a failing route test asserting exactly one player-name search input when Add friend is open and a visible link to `/users`.
- [ ] Run it and verify the duplicate-search expectation fails on the current Friends implementation.
- [ ] Keep the add dialog's existing nickname lookup as the only search; remove the duplicate control and add `Browse all players` next to Add friend.
- [ ] Run the focused Friends test.
- [ ] Commit `fix: simplify friends player discovery`.

### Task 5: Game-detail active-player panel

**Files:** `web/src/lib/api.ts`, `web/src/routes/games.$gameId.tsx`, `web/src/routes/-games.$gameId.test.ts`

- [ ] Write failing tests for an active-player row with two-week hours/profile link, an omitted panel for empty results, and a non-blocking unavailable state.
- [ ] Run the focused test and verify it fails because the client query/panel are absent.
- [ ] Add `getRecentGamePlayers`, query it only for a catalog game, and render the panel using the existing dashboard components and `UserProfileLink`.
- [ ] Run focused game tests.
- [ ] Commit `feat: show recently active players on games`.

### Task 6: Favicon and release verification

**Files:** `web/public/favicon-16.png`, `web/public/favicon-32.png`, `web/public/apple-touch-icon.png`, `web/src/routes/__root.tsx`, relevant head test

- [ ] Add a failing head test that expects the favicon declarations.
- [ ] Create the three square PNG derivatives from the supplied artwork and add the root-head icon links.
- [ ] Run the head test, full frontend suite, backend suite, lint, and production build.
- [ ] Inspect the built site favicon and the two new screens at desktop and mobile widths.
- [ ] Commit `feat: add Playfinder favicon`.
