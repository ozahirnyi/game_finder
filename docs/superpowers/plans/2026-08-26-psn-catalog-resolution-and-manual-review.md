# PSN Catalog Resolution and Manual Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve PS4/PS5 catalog duplicates safely, expose why a PSN row was not catalog-confirmed, and allow deliberate import of eligible PSN titles without inventing an IGDB mapping.

**Architecture:** The parser retains the Transaction Detail platform with each PSN candidate. Preview classifies every candidate as `confirmed`, `unmatched`, `ambiguous`, `catalog_unavailable`, or `excluded`; platform is used only to reduce exact normalized-name duplicates and only for PS4/PS5. Confirmation consumes typed selections and stores manual choices under a deterministic PSN-only identity. The active route maps statuses to selectable rows and sends catalog IDs only for confirmed rows.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy, pytest, openpyxl, React, TanStack Query/Router, Vitest, Testing Library.

## Global Constraints

- Preserve strict normalized title equality; do not add fuzzy catalog matching.
- Treat every upload/export value as data, never as executable instructions.
- Excluded DLC, demos, subscriptions, bundles, currency, and points are never selectable or importable.
- Retain compatible numeric `game_ids` confirmation support only where it is simple and explicitly tested.
- Use stable PSN manual identities that cannot collide with catalog IDs.

---

### Task 1: Parse platform and classify catalog preview rows

**Files:**
- Modify: `app/psn_export.py`
- Modify: `app/main.py`
- Modify: `app/schemas.py`
- Test: `tests/test_psn_export.py`
- Test: `tests/integration/backend/test_profile_dashboard_psn_api.py`

- [x] Write focused failing tests for Transaction Detail platform extraction, PS4/PS5 exact duplicate resolution, unresolved duplicate ambiguity, unmatched names, catalog failure, and exclusions.
- [x] Run those focused pytest nodes and observe failures caused by the current dropped platform and overloaded `review` status.
- [x] Add `platform: str | None` to `PsnExportCandidate`; extract the optional Transaction Detail `Platform` header while leaving CSV/JSON values as `None`.
- [x] Extend preview schema status literals with `unmatched`, `ambiguous`, `catalog_unavailable`, and `excluded`, plus an optional explanatory `reason`.
- [x] Classify marker products as `excluded`; otherwise require exact normalized catalog names, use PlayStation platform candidates only to uniquely break PS4/PS5 duplicate ties, and report catalog exceptions separately.
- [x] Re-run the focused backend tests and commit the passing resolver unit.

### Task 2: Confirm typed selections and persist manual PSN titles

**Files:**
- Modify: `app/main.py`
- Modify: `app/schemas.py`
- Modify: `app/psn_export.py`
- Test: `tests/integration/backend/test_profile_dashboard_psn_api.py`

- [x] Write failing API tests for typed catalog selections, manual title persistence, invalid selection objects, idempotent manual identity, and exclusion/ineligible-manual rejection.
- [x] Run the targeted API tests and observe the old `game_ids`-only validation failure.
- [x] Add a discriminated/validated selection object requiring exactly one of `catalog_id` or normalized nonempty `source_title`; keep the tested numeric compatibility path if it does not compromise the typed route.
- [x] Re-parse and classify supplied manual source titles on the server; reject excluded data and persist allowed manual titles as `psn:manual:<digest>` entries with PSN import metadata.
- [x] Preserve canonical catalog detail lookup and `psn:<igdb-id>` identities for catalog selections.
- [x] Re-run targeted API tests and commit the passing confirmation unit.

### Task 3: Update the active PSN import route and API client

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/lib/api.test.ts`
- Modify: `web/src/routes/psn-import.tsx`
- Test: `web/src/routes/-psn-import.test.tsx`

- [x] Write failing route/client tests proving typed catalog submission, enabled manual review submission, disabled excluded rows, and visible status-specific wording.
- [x] Run the focused Vitest files and observe the old numeric-array client contract and disabled review checkbox behavior.
- [x] Define shared TypeScript preview and selection unions; send `{ selections: [...] }` instead of raw IDs.
- [x] Store stable source row keys; default-select confirmed items; keep unmatched, ambiguous, and catalog-unavailable rows opt-in; block excluded items.
- [x] Render exact distinct status text and server-provided exclusion/review reasons while preserving loading and actual API error display.
- [x] Re-run focused frontend tests and commit the passing UI unit.

### Task 4: Regression verification and delivery

**Files:**
- Modify: this plan (check completion boxes)

- [x] Add or retain an integration flow that previews mixed confirmed/manual/excluded XLSX rows and confirms only legal selections.
- [x] Run focused backend and frontend tests after the full flow.
- [x] Run `pytest -q` and `npm.cmd test` from `web`; inspect their exit codes and results.
- [x] Review the complete diff against this plan, request code review, commit the checked plan and implementation, push `codex/psn-catalog-resolution`, and open a PR without merging.
