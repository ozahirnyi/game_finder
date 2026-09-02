# AI CI Regression Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore green backend and frontend CI after AI recommendation hardening.

**Architecture:** Preserve authenticated recommendations, adapt obsolete integration fixtures to supply valid authentication, and join the quota migration to the current Alembic chain. Keep coverage enforcement unchanged and validate the exact CI commands.

**Tech Stack:** FastAPI, pytest, Alembic, npm, Vitest, ESLint, Vite.

## Global Constraints

- `/recommendations` remains authenticated.
- Alembic must have exactly one upgrade head.
- Backend coverage threshold remains 94%.
- No dependency manifest changes unless a fresh `npm ci` demonstrates they are required.

---

### Task 1: Repair backend CI contracts and migration graph

**Files:**
- Modify: `tests/integration/backend/test_main_remaining_edges_api.py`
- Modify: `alembic/versions/8d31c9f412ab_add_ai_recommendation_quotas.py`
- Test: `tests/test_migration_graph.py`

**Interfaces:**
- Consumes: the authenticated `/recommendations` FastAPI contract and the current Alembic head revision.
- Produces: authenticated recommendation test requests and a single linear migration head.

- [ ] **Step 1: Run the focused failing tests**

Run: `pytest -q tests/integration/backend/test_main_remaining_edges_api.py tests/test_migration_graph.py`

Expected: FAIL with recommendation 401 assertions and multiple Alembic heads.

- [ ] **Step 2: Update test fixtures and migration parent**

Change the successful recommendation requests to pass the existing authenticated-client fixture or its bearer token. Change the quota revision `down_revision` to the current head `e4f6a8c0b2d1`.

- [ ] **Step 3: Verify focused tests pass**

Run: `pytest -q tests/integration/backend/test_main_remaining_edges_api.py tests/test_migration_graph.py`

Expected: PASS.

### Task 2: Validate and publish the repair

**Files:**
- Modify: files from Task 1 only.

**Interfaces:**
- Consumes: repaired API tests and migration graph.
- Produces: a mergeable CI repair PR.

- [ ] **Step 1: Run full validation**

Run: `pytest -q && npm --prefix web ci && npm --prefix web test -- --run && npm --prefix web run lint && npm --prefix web run build`

Expected: backend coverage is at least 94%; frontend checks have no errors.

- [ ] **Step 2: Commit and publish**

Run: `git add alembic/versions/8d31c9f412ab_add_ai_recommendation_quotas.py tests/integration/backend/test_main_remaining_edges_api.py && git commit -m "fix: restore AI recommendation CI" && git push -u origin codex/fix-ai-ci-regressions`

Expected: one focused CI repair commit ready for a pull request.
