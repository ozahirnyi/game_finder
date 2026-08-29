# PSN Library Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair historical PSN library imports and prevent future bulk RAW imports.

**Architecture:** Persist a PSN link state and catalog identity on `Game`; reconcile owner-scoped RAW rows through IGDB; have overview/import/UI consume this explicit state rather than infer catalog identity from `external_id`.

**Tech Stack:** FastAPI, SQLAlchemy/Alembic, Pydantic, pytest, React, TanStack Query, Vitest.

## Global Constraints

- Preserve PSN external IDs and do not persist uploaded exports.
- All catalog calls are mocked in tests; migration has no network calls.
- Quarantine is reversible and omitted from normal/public views.

---

### Task 1: Persistent PSN identity

**Files:** `app/database.py`, `app/schemas.py`, `alembic/versions/*`, backend tests.

- [ ] Write failing migration/model contract tests for PSN linked/raw backfill and non-PSN preservation.
- [ ] Run the focused test and confirm the missing columns/state cause failure.
- [ ] Add indexed `catalog_game_id`, `link_state`, migration backfill, and response fields.
- [ ] Re-run focused tests and commit the database slice.

### Task 2: Reconciliation and library contracts

**Files:** `app/main.py`, `app/psn_classification.py`, `app/schemas.py`, backend tests.

- [ ] Write failing API tests for preview suggestions, owner scoping, duplicate merge, rollback, quarantine visibility, and catalog detail IDs.
- [ ] Run them to confirm the endpoints/contracts are absent or incorrect.
- [ ] Add transactional preview/apply helpers and correct overview/public response mapping.
- [ ] Re-run focused tests and commit the API slice.

### Task 3: Import persistence guardrails

**Files:** `app/main.py`, backend tests.

- [ ] Write failing tests for catalog metadata persistence and explicit RAW state.
- [ ] Run focused tests to verify prior behavior fails.
- [ ] Persist IGDB ID/title/cover/state; retain RAW only for explicit actions.
- [ ] Re-run focused tests and commit the import API slice.

### Task 4: Import and repair UI

**Files:** `web/src/lib/api.ts`, `web/src/routes/psn-import.tsx`, `web/src/routes/library.tsx`, repair route, route tree, Vitest tests.

- [ ] Write failing Vitest cases for matched-only bulk selection, RAW acknowledgment, and repair decisions.
- [ ] Run them to confirm regression coverage is red.
- [ ] Implement typed API clients, repair screen/banner, RAW labelling, and per-row selection/search controls.
- [ ] Re-run focused Vitest tests and commit the UI slice.

### Task 5: Verification and delivery

**Files:** all changed files.

- [ ] Run focused backend/frontend tests, then `pytest -q` and `npm.cmd test` from `web`.
- [ ] Review bounded diff and confirm the spec requirements are covered.
- [ ] Push the branch and open a PR with root cause, migration behavior, test payloads/counts, and manual checklist.
