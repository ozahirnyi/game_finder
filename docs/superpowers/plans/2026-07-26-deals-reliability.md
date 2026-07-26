# Deals Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the four popular Steam deal slots and refresh dashboard recommendations after their cache expires.

**Architecture:** The Steam adapter will deduplicate top-seller and special-sale items while preserving their priority. Recommendation responses will expose an optional cache-expiry timestamp; the dashboard UI will use it to schedule a single React Query refetch.

**Tech Stack:** FastAPI, Redis, pytest, React, TanStack Query, Vitest.

## Global Constraints

- Preserve the existing six-hour Redis TTL for AI recommendations.
- Do not schedule polling or additional AI calls while the Redis entry remains valid.
- Keep Steam top sellers ahead of fallback special-sale items.

---

### Task 1: Fill popular Steam slots

**Files:**
- Modify: `app/steam_store.py`
- Test: `tests/test_steam_store.py`

- [ ] Write a failing test where one discounted top seller and three discounted specials return four unique popular deals.
- [ ] Run the focused test and confirm it fails because only top sellers are considered.
- [ ] Add the ordered, deduplicated fallback to `fetch_steam_store_deal_candidates`.
- [ ] Run the focused test and confirm it passes.

### Task 2: Expose recommendation cache expiry

**Files:**
- Modify: `app/steam_recommendations.py`, `app/schemas.py`, `app/main.py`
- Test: `tests/test_steam_recommendations.py`, `tests/test_api_contracts.py`

- [ ] Write failing tests for an `expires_at` field on cached and newly generated Steam recommendations.
- [ ] Run focused backend tests and confirm the field is absent.
- [ ] Return the ISO-8601 expiry timestamp and forward it through the dashboard response.
- [ ] Run focused backend tests and confirm they pass.

### Task 3: Refresh the homepage at expiry

**Files:**
- Modify: `web/src/lib/api.ts`, `web/src/routes/index.tsx`
- Test: `web/src/test/live-data.routes.test.tsx`

- [ ] Write a fake-timer test asserting dashboard refetch occurs when the returned recommendation expiry is reached.
- [ ] Run the focused test and confirm it fails because no timer is registered.
- [ ] Add one expiry-driven refetch timer and clean it up when data changes or the route unmounts.
- [ ] Run focused frontend tests and confirm they pass.

### Task 4: Verify and deliver

- [ ] Run `rtk pytest -q`.
- [ ] Run `rtk proxy npm --prefix web test` and `rtk proxy npm --prefix web run build`.
- [ ] Commit, push, and open a draft pull request.
