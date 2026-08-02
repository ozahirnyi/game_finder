# Deals Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep game cards and five genre deal sections useful when RAWG is slow or unavailable.

**Architecture:** Preserve each Steam app ID in the API response and use it as the navigation fallback. Enrich deal genres from RAWG when available, otherwise fetch Steam app metadata and use its categories. Render the selected genre as five full-width cards.

**Tech Stack:** FastAPI, httpx, Pydantic, React, TanStack Router, Vitest, pytest.

## Global Constraints

- No live external calls in tests.
- Render four popular cards, five selectable genres, and at most five selected-genre cards.

---

### Task 1: Make API deal data navigable and genre-resilient

**Files:**
- Modify: `app/genre_deals.py`
- Modify: `app/steam_store.py`
- Test: `tests/test_core_edges.py`

- [ ] Write a failing pytest asserting an unenriched deal retains `steam_appid` and Steam categories fill a genre section when RAWG raises `RAWGError`.
- [ ] Run `pytest tests/test_core_edges.py -q` and confirm the new assertion fails.
- [ ] Add a bounded Steam app-details genre lookup, preserve `steam_appid`, and fall back to those categories only when RAWG produces no genres.
- [ ] Re-run `pytest tests/test_core_edges.py -q` and commit the passing backend change.

### Task 2: Keep recommendation navigation available during catalog failure

**Files:**
- Modify: `web/src/routes/games.$gameId.tsx`
- Test: `web/src/routes/-games.$gameId.test.ts`

- [ ] Write a failing Vitest case asserting a title-bearing game route renders a minimal game page when both catalog lookup and title search fail.
- [ ] Run the focused test and confirm it fails.
- [ ] Return a minimal title-based game model from the route loader after catalog and title-search failures; retain catalog data when either lookup succeeds.
- [ ] Re-run the focused test and commit the passing frontend navigation change.

### Task 3: Render five large genre cards across the page

**Files:**
- Modify: `web/src/routes/deals.tsx`
- Test: `web/src/routes/-deals.genre.test.tsx`

- [ ] Write a failing Vitest assertion for the selected genre card layout classes and Steam fallback detail links.
- [ ] Run the focused test and confirm it fails.
- [ ] Use a one-column layout for the five selected-genre cards and keep the full-card Steam/catalog navigation target.
- [ ] Re-run focused frontend tests, full backend tests, and `npm.cmd run build`; commit the passing UI change.
