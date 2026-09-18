# Steam History Source Currency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Show Steam-only history in its actual currency for every selected profile region and make the chart tooltip-based with 6-month, 1-year, and 2-year periods.

**Architecture:** Stop filtering Steam history by current-price currency in the API merge layer. Keep the current regional Steam response untouched, label the chart with the history series currency, and render a floating tooltip from focused or hovered data points. Extend period validation, data retrieval, and cache keys with the 2-year option.

**Tech Stack:** FastAPI, pytest, React, Vitest, Testing Library, SVG.

### Task 1: Keep source-currency Steam history

**Files:**
- Modify: `app/main.py`
- Test: `tests/test_api_contracts.py`

- [ ] Write a failing test where current Steam price is UAH and Steam history points are USD; assert the USD points remain, `history_available` is true, and no regional-currency-unavailable message exists.
- [ ] Run `rtk pytest tests/test_api_contracts.py -q` and verify the test fails because the merge filters USD points.
- [ ] Return all valid Steam points from `_merge_platform_price_history`, leaving ITAD low/deal fields empty.
- [ ] Run the focused test and commit the implementation and test.

### Task 2: Add the two-year server period

**Files:**
- Modify: `app/prices.py`, `app/main.py`
- Test: `tests/test_price_history_normalization.py`, `tests/test_api_contracts.py`

- [ ] Write failing tests for `price_history_since("2y")` and `GET /prices/games/{id}?period=2y` forwarding the period.
- [ ] Run focused tests and verify RED.
- [ ] Add `2y` to validated literals, calculate an exact two-calendar-year cutoff, and include it in the cached response key.
- [ ] Run focused tests and commit.

### Task 3: Show source currency and floating point tooltip

**Files:**
- Modify: `web/src/routes/games.$gameId.tsx`, `web/src/components/PriceHistoryChart.tsx`, `web/src/lib/gamePresentation.ts`
- Test: `web/src/routes/-games.detail.test.tsx`, `web/src/components/PriceHistoryChart.test.tsx`, `web/src/lib/api.test.ts`

- [ ] Write failing UI tests for the USD source label with UAH current price, a `2 years` period request, and a tooltip showing date/sale/regular/discount after point hover and focus.
- [ ] Run the focused Vitest files and verify RED.
- [ ] Use the first valid history-point currency for the section label/chart; change period controls to `6 months`, `1 year`, `2 years`; replace persistent point text with an anchored tooltip.
- [ ] Run focused tests, the frontend suite, and build; commit.

### Task 4: Verify the integrated contract

- [ ] Run `rtk pytest -q`.
- [ ] From `web`, run `rtk npm.cmd test` using the managed-worktree root workaround if required, then `rtk npm.cmd run build`.
- [ ] Inspect `rtk git diff --check` and `rtk git status --short` before reporting.
