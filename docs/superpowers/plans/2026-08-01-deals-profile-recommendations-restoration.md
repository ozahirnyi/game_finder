# Deals, Profile, and Recommendation Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore detail navigation for recommendations, genre-grouped deals, and editable profile discovery preferences.

**Architecture:** Reuse the existing backend contracts: enrich recommendation candidates with RAWG ids, consume the existing grouped deals endpoint, and expose already-supported profile fields in the Settings modal. No database or API schema changes are required.

**Tech Stack:** FastAPI, RAWG integration, React, TanStack Query/Router, Vitest, pytest.

## Global Constraints

- Keep Steam deal popularity capped at four and every genre section capped at five.
- Use favourite profile genres first; complete to five with Action, RPG, Adventure, Strategy, Indie.
- Preserve linked external store URLs and in-app game links.
- Execute inline without subagents and use targeted tests before broader verification.

---

### Task 1: Give every recommendation a detail-page identity

**Files:**
- Modify: `app/steam_recommendations.py`
- Modify: `tests/test_steam_recommendations.py`
- Test: `web/src/routes/-index.recommendations.test.tsx`

**Interfaces:**
- Consumes: `fetch_rawg_games(title, page=1)` and Steam deal candidate `name` values.
- Produces: recommendations with `rawg_id` and `cover_url` when RAWG has an exact title match.

- [ ] Write a failing pytest case with a Steam candidate named `Eligible`, mock RAWG to return exact id `77`, and assert `rawg_id == 77`.
- [ ] Run `pytest tests/test_steam_recommendations.py -k rawg_id -v`; confirm the candidate currently has no id.
- [ ] Add an async candidate-enrichment helper which chooses only a case-insensitive exact RAWG title match; retain the Steam cover if RAWG has no cover or no match.
- [ ] Run `pytest tests/test_steam_recommendations.py -v`.
- [ ] Update the Home recommendation test to assert the card links to `/games/77?title=Eligible` when the dashboard receives that enriched item.
- [ ] Run the focused Vitest test and `npm run build` in `web`.
- [ ] Commit: `fix: link recommendations to game details`.

### Task 2: Restore grouped Deals presentation

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/routes/deals.tsx`
- Create: `web/src/routes/-deals.genre.test.tsx`

**Interfaces:**
- Consumes: `GET /prices/genre-deals`, response `{ popular: HomeDeal[], sections: { genre: string; results: HomeDeal[] }[] }`.
- Produces: a Deals page with a four-card `Popular on Steam` section and five named genre sections.

- [ ] Write a failing UI test that mocks four `popular` deals and five genre sections, then asserts all four popular titles and each section title are displayed and a card links to its catalog game.
- [ ] Run the focused Vitest file; confirm the current route calls the flat `getDeals("US")` endpoint instead.
- [ ] Add `GenreDealResponse` and `getGenreDeals()` to `web/src/lib/api.ts`; request `/prices/genre-deals`.
- [ ] Replace the single hero/flat grid in `web/src/routes/deals.tsx` with a `Popular on Steam` grid and a section per `sections` entry. Reuse `GameCover`, `Chip`, pricing, in-app links, and store links; retain loading, retry, and empty states.
- [ ] Run the focused Deals test and `npm run build`.
- [ ] Commit: `feat: restore genre grouped deals`.

### Task 3: Restore profile genres and platforms

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/routes/account.tsx`
- Modify: `web/src/components/ProfileView.tsx`
- Modify: `web/src/components/ProfileView.test.tsx`

**Interfaces:**
- Consumes: existing profile fields `platforms: string[]` and `favorite_genres: string[]`.
- Produces: `updateProfile({ display_name, bio, library_visibility, platforms, favorite_genres })` and cache invalidation for `profile`, `dashboard`, and `genre-deals`.

- [ ] Write a failing component test that opens Settings, selects `RPG` and `PC`, saves, and asserts `updateProfile` receives both arrays.
- [ ] Run the focused ProfileView test; confirm current settings payload has neither field.
- [ ] Extend `ProfileUpdate` to include `platforms` and `favorite_genres`; pass these values from `account.tsx` into `ProfileView.settings`.
- [ ] Add controlled multi-select chip groups in Settings using canonical options: genres `Action, Adventure, RPG, Strategy, Indie, Shooter, Puzzle, Simulation, Sports, Racing, Horror`; platforms `PC, PlayStation, Xbox, Nintendo Switch, Mobile`. Preserve unknown saved values, toggle selections, and send selected arrays on save.
- [ ] On successful save, invalidate `profile`, `dashboard`, and `genre-deals` before closing the dialog.
- [ ] Run ProfileView tests and `npm run build`.
- [ ] Commit: `feat: restore profile discovery preferences`.

### Task 4: End-to-end verification and release

**Files:**
- Verify only.

- [ ] Run `pytest tests/test_steam_recommendations.py tests/test_provider_edges.py -v`.
- [ ] Run `npm test -- --run src/routes/-index.recommendations.test.tsx src/routes/-deals.genre.test.tsx src/components/ProfileView.test.tsx` and `npm run build` in `web`.
- [ ] Run `pytest -q -k "not auth_import_requires_secret_key"`; document the known Windows subprocess-test exclusion if it still reproduces independently.
- [ ] Push the dedicated branch, open a draft PR, wait for required checks, then merge to `main` and confirm the deploy workflow succeeds.
