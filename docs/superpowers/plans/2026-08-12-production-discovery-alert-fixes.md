# Production discovery and alert fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the production discovery, alert-cancellation, platform, rating, and AI-operability gaps reported after PR #147.

**Architecture:** Keep existing FastAPI contracts. Add the missing alert deletion client/UI, make discovery filters explicit typed metadata values with verified IGDB query semantics, and isolate UI presentation mapping from normalized catalog data.

**Tech Stack:** FastAPI, IGDB, React, TanStack Query, Vitest, pytest.

## Global constraints

- Branch from `origin/main`; preserve `web/src/routeTree.gen.ts` and `web/.output`.
- Use `rtk` for terminal commands and `apply_patch` for edits.
- Each production change is test-first: focused RED, minimal implementation, focused GREEN.
- No fabricated AI fallback data; `OPENAI_API_KEY` remains a deployment secret.

### Task 1: Cancel price alerts

**Files:** `web/src/lib/api.ts`, `web/src/routes/wishlist.tsx`, `web/src/routes/-wishlist.test.tsx`.

- [ ] Add a frontend test that creates a listed alert, clicks Cancel, and expects `DELETE /price-alerts/{id}` through an exported `deletePriceAlert` function.
- [ ] Run `rtk npm.cmd --prefix web test -- --run src/routes/-wishlist.test.tsx`; observe RED because no client function or control exists.
- [ ] Add the smallest client mutation and accessible Cancel control; invalidate `price-alerts` only after success.
- [ ] Re-run the focused test for GREEN.

### Task 2: Discovery filter semantics and UI

**Files:** `app/integrations/igdb.py`, `app/main.py`, `tests/test_igdb.py`, `tests/integration/backend/test_catalog_prices_api.py`, `web/src/lib/api.ts`, `web/src/routes/search.tsx`, `web/src/routes/-search.test.tsx`.

- [ ] Add integration RED tests for the exact IGDB predicates and backend intersections: Solo, PC, console group, genres, text, and current-deal sale enrichment.
- [ ] Run the narrowed pytest file and observe RED.
- [ ] Add minimal typed values/predicates and UI selections: top-level On sale/Co-op/Solo/PC/Consoles/Multiplayer, disclosed individual consoles and genres.
- [ ] Run focused frontend and backend tests for GREEN.

### Task 3: Platform and rating presentation

**Files:** `web/src/lib/platformPresentation.ts`, its test, `web/src/components/GameCard.tsx`, `web/src/routes/games.$gameId.tsx`, focused route/component tests.

- [ ] Add RED tests proving OS labels map to PC, console labels remain specific, and a positive fractional catalog rating is rendered.
- [ ] Implement only the presentation mapper and finite rating formatter.
- [ ] Run focused frontend tests for GREEN.

### Task 4: Production AI diagnosis

**Files:** deployment documentation only if configuration instructions need correction; no secret values committed.

- [ ] Verify `/recommendations` error behavior with a controlled provider/configuration test and preserve the 503 unavailable response.
- [ ] Inspect deployment workflow and report whether the public environment needs `OPENAI_API_KEY`; do not commit a key or enable fake fallback.

### Task 5: Final verification and delivery

- [ ] Run focused tests after each slice, then `rtk npm.cmd --prefix web test -- --run`, lint, production build, and `rtk pytest -q`.
- [ ] Browser-smoke the exact feature production build with controlled API outcomes.
- [ ] Review diff, exclude routeTree and `.output`, commit, push, and open a draft PR to `main`.

