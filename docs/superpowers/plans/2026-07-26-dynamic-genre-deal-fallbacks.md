# Dynamic Genre Deal Fallbacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill one-to-four user-selected deal genres with currently popular Steam-sale genres, improve the candidate pool, and compact the `/deals` cards.

**Architecture:** Keep the selected profile genres first. Enrich a larger unique Steam sale candidate pool once, derive fallback genres from counts of the enriched candidates' RAWG genres, then group each game into relevant sections. The route keeps its response contract and only changes card density.

**Tech Stack:** FastAPI, RAWG, Steam Store, React, Tailwind, pytest, Vitest.

## Global Constraints

- Preserve selected genres and their order.
- When fewer than five selected genres exist, fill to five with unique current-sale genre popularity; use the static fallback order only for equal counts.
- Never insert irrelevant games to reach five; cap each section at five unique Steam app ids.
- Reuse the same request/enrichment pass for dynamic fallback classification.

---

### Task 1: Make grouping use dynamic fallback genres and a broader sale pool

**Files:**
- Modify: `app/steam_store.py`
- Modify: `app/genre_deals.py`
- Test: `tests/test_api_contracts.py`

- [ ] Write failing tests for selected genres first, dynamically ranked fallback genres, deduplication, and a five-item cap.
- [ ] Run `rtk pytest tests/test_api_contracts.py -q -k genre_deals` and verify the new expectations fail.
- [ ] Add a bounded Steam sale-search candidate source alongside featured categories and deduplicate all candidate app ids before RAWG enrichment.
- [ ] Derive fallback genre counts after one enrichment pass, append the highest-count unselected genres, then use static genre order for ties and last-resort fill.
- [ ] Run the focused contract tests, then `rtk pytest tests/test_api_contracts.py -q`.
- [ ] Commit the backend change.

### Task 2: Compact deal cards without changing their navigation

**Files:**
- Modify: `web/src/routes/deals.tsx`
- Test: `web/src/test/catalog.routes.test.tsx`

- [ ] Write a failing route test for compact cards retaining Steam and catalog links.
- [ ] Run the focused Vitest route test and confirm failure.
- [ ] Reduce cover, typography, price and action spacing while retaining artwork, price, discount, store URL and catalog link.
- [ ] Run focused and full frontend tests plus `rtk proxy npm --prefix web run build`.
- [ ] Commit the frontend change.

### Task 3: Verify and publish

- [ ] Run `rtk pytest -q`, `rtk proxy npm --prefix web test`, `rtk proxy npm --prefix web run build`, and `rtk git diff origin/main...HEAD --check`.
- [ ] Push `codex/dynamic-genre-deals` and open a draft PR against `main`; do not merge or deploy.
