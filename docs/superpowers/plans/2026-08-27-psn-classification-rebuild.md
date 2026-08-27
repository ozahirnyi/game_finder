# PSN Classification Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PSN transaction and product evidence the authority for exclusion, while preserving legitimate purchases when IGDB metadata is incomplete.

**Architecture:** Extract normalized, exact PSN app/service/theme identities and explicit product signals into a focused classifier module. The preview endpoint first excludes only explicit PSN non-games; it then uses exact IGDB title results solely to confirm a unique catalog game or identify an all-non-game catalog result. All remaining rows are eligible manual-review entries and preview authorization is derived only from those eligible statuses.

**Tech Stack:** FastAPI/Pydantic, Python `pytest`, Vite/React, Vitest.

## Global Constraints

- Preserve deterministic `psn:manual:` IDs and owner-scoped preview authorization.
- Do not add title-specific game exceptions or commit/export personal data.
- Treat absent, unknown, and incompatible IGDB type/platform metadata as uncertainty, never PSN exclusion.
- Keep the active `/psn-import` groups and ensure only eligible items affect selection and submission.

---

### Task 1: Encode explicit PSN exclusion evidence

**Files:**
- Create: `app/psn_classification.py`
- Modify: `app/main.py`
- Test: `tests/integration/backend/test_profile_dashboard_psn_api.py`

- [ ] Write failing tests for non-product transactions, subscription/currency/demo/DLC/pass/bundle product descriptions, and normalized exact apps/themes; include a game title containing a formerly broad marker.
- [ ] Run the focused backend test and verify the new expectations fail under broad substring classification.
- [ ] Implement normalized exact app/theme identities with update instructions and explicit product evidence checks; remove broad `theme`, `pack`, `season`, and comparable title-risky matching.
- [ ] Run the focused test and verify explicit clutter is excluded while the marker-containing game remains eligible.

### Task 2: Rebuild catalog resolution and authorization

**Files:**
- Modify: `app/main.py`
- Test: `tests/integration/backend/test_profile_dashboard_psn_api.py`

- [ ] Write failing tests for unique exact candidates with missing/unknown/incompatible platform/type, duplicate exact candidates, no match, catalog failure, and all-exact-candidates explicitly non-game.
- [ ] Run the focused backend test and verify old catalog filtering rejects or downgrades eligible purchases incorrectly.
- [ ] Implement exact-title resolution: use platform/type only to choose one duplicate; confirm one plausible result; exclude only when every exact candidate is explicitly non-game; otherwise return a manual-review status.
- [ ] Verify preview authorization admits only confirmed catalog IDs and review source titles, rejects excluded crafted selections, and preserves manual IDs.

### Task 3: Validate the active import UI

**Files:**
- Modify: `web/src/routes/psn-import.tsx` only if required by the API contract
- Test: `web/src/routes/-psn-import.test.tsx`

- [ ] Write or update a failing route test asserting Catalog matches are checked, Need review is selectable, Excluded purchases are disabled, counts exclude the excluded row, and confirmation sends catalog IDs only for confirmed rows.
- [ ] Run the focused Vitest test and verify the intended interaction fails if behavior changes.
- [ ] Make the smallest active-route change needed to satisfy the contract; retain all three visible groups.
- [ ] Re-run the route test and verify it passes.

### Task 4: Evidence and release checks

**Files:**
- Test: `tests/integration/backend/test_profile_dashboard_psn_api.py`, `web/src/routes/-psn-import.test.tsx`

- [ ] Run the local non-committed anonymized diagnostic against the user export and record aggregate before/after classification counts only.
- [ ] Run focused backend and frontend tests, then `pytest -q` and `npm.cmd test` from `web`.
- [ ] Inspect the diff for user-export data and unrelated changes, request code review, commit, push `codex/psn-classification-rebuild`, and open a PR without merging.
