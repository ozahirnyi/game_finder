# Catalog Detail Data Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make game details complete and visually correct from catalog and Steam-library entry points.

**Architecture:** IGDB normalization gains a distinct wide hero asset and the detail route promotes linked Steam games to their catalog record. Price history passes a six-month range to the provider and exposes a truthful current-only state. Related games use direct IGDB relations first and a scored catalog fallback second.

**Tech Stack:** FastAPI, SQLAlchemy cache helpers, IGDB/ITAD integrations, React, TanStack Router/Query, Vitest, pytest.

## Global Constraints

- Preserve Steam-only detail behavior when no catalog record exists.
- Never invent historical prices; represent a current-only price truthfully.
- Keep card imagery compact and use wide artwork only for detail heroes.
- Run targeted tests before full backend/frontend verification.

---

### Task 1: Normalize wide catalog artwork

**Files:**
- Modify: `app/integrations/igdb.py`
- Modify: `app/schemas.py`
- Test: `tests/test_igdb.py`

**Interfaces:**
- Produces normalized `hero_image: str | None` alongside `background_image`.
- Consumed by catalog detail and related-game response serialization.

- [ ] Write a failing normalization test with `cover.url` and `artworks[0].url`; assert `background_image` retains card cover and `hero_image` uses the artwork URL with `t_1080p`.
- [ ] Run `rtk pytest -q tests/test_igdb.py` and confirm the new assertion fails because `hero_image` is absent.
- [ ] Add `artworks.url` to `_FIELDS`, a URL transform helper, and `hero_image` normalization that prefers artwork then a high-resolution cover.
- [ ] Add the optional schema field to every catalog response model using the normalized payload.
- [ ] Re-run `rtk pytest -q tests/test_igdb.py`; commit `feat: add catalog hero artwork`.

### Task 2: Return resilient related games and six-month price data

**Files:**
- Modify: `app/integrations/igdb.py`
- Modify: `app/main.py`
- Modify: `app/prices.py`
- Test: `tests/test_catalog_similar_api.py`
- Test: `tests/test_price_history_normalization.py`

**Interfaces:**
- `fetch_igdb_similar_games(igdb_id, limit)` remains direct-relation lookup.
- `catalog_similar_games` returns up to four direct or scored fallback records.
- `fetch_game_price_history(..., since: datetime)` requests the supplied ISO timestamp.

- [ ] Write a failing API test with an empty direct-similar list and mocked catalog search candidates; assert scored, source-excluding fallback results are returned.
- [ ] Write a failing price-provider test asserting the history request receives a six-month `since` value.
- [ ] Run the two targeted pytest files; confirm both new assertions fail.
- [ ] Add a bounded IGDB fallback candidate query using source genres/platforms, score candidates with the existing overlap rules, and use it only when direct similar records are empty.
- [ ] Add a UTC six-month helper in `app/prices.py`, pass `since` to ITAD history, and retain `current` when the log has no entries.
- [ ] Re-run the targeted pytest files; commit `fix: enrich related games and price history`.

### Task 3: Use a canonical catalog detail route for linked Steam games

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/routes/games.$gameId.tsx`
- Test: `web/src/routes/-games.detail.test.tsx`

**Interfaces:**
- `getSteamGame` exposes its optional `catalog_game_id`.
- Detail loader resolves the catalog record for linked Steam games and sets `catalogGameId` while retaining Steam fallback data.

- [ ] Write a failing loader test: mocked Steam response has `catalog_game_id`, mocked catalog record has rating/release/hero; assert loader uses catalog metadata and enables related games.
- [ ] Write a second failing test: Steam response without `catalog_game_id` preserves Steam-only fallback.
- [ ] Run `rtk npm test -- --run src/routes/-games.detail.test.tsx` and confirm both new tests fail.
- [ ] Extend the API type, create a shared mapper for canonical catalog data plus optional Steam store data, and change query enablement/IDs to use the catalog ID when present.
- [ ] Re-run the route test; commit `fix: unify linked Steam detail data`.

### Task 4: Render truthful hero and price states

**Files:**
- Modify: `web/src/routes/games.$gameId.tsx`
- Modify: `web/src/components/PriceHistoryChart.tsx`
- Modify: `web/src/lib/gamePresentation.ts`
- Test: `web/src/routes/-games.detail.test.tsx`
- Test: `web/src/lib/gamePresentation.test.ts`

**Interfaces:**
- Hero chooses `hero_image`, then existing cover/fallback.
- `presentPriceHistory` exposes `hasHistory` and `isCurrentOnly`.

- [ ] Write failing presentation tests for no history plus a current price and for a multi-point six-month history.
- [ ] Write a failing route test asserting the current-only label and the `hero_image` URL are rendered.
- [ ] Run the two frontend tests and confirm their new expectations fail.
- [ ] Add hero selection and current-only presentation logic; show a single current-price marker/label rather than an unavailable message when price data exists but has no changes.
- [ ] Re-run targeted frontend tests; commit `fix: clarify game detail hero and price states`.

### Task 5: Full verification and release

**Files:**
- No production file changes expected.

- [ ] Run `rtk pytest -q` and require zero failures.
- [ ] In `web`, run `rtk npm test`, `rtk proxy npx tsc --noEmit`, `rtk npm run lint`, and `rtk npm run build`; require no errors.
- [ ] Inspect `rtk proxy git diff --check` and `rtk proxy git status --short` for only scoped changes.
- [ ] Push `codex/catalog-detail-data-fix`, create a PR against `main`, wait for CI, and merge only after green checks.
