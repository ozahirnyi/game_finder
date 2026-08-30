# PSN Import Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Make PSN import and repair resilient to catalog failures, classify evidence per transaction row, and promote RAW rows on reimport.

**Architecture:** Add a small resolver outside `app/main.py` that validates multiquery results and falls back to bounded single requests. Preserve transaction-row evidence in PSN candidates, classify it independently from catalog outcomes, and reuse the resolver in preview and repair.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, httpx, pytest, React, Vitest.

## Global Constraints

- Keep IGDB fallback bounded and serialized through the existing limiter.
- `unavailable` is distinct from `no_match`; neither auto-imports RAW or quarantines.
- Quarantine needs affirmative self-title non-game evidence, never a missing match.
- All mutation remains owner-scoped and transactional; no title-specific exceptions.
- Never commit the supplied XLSX or derived contents.

---

### Task 1: Transaction evidence model and classifier

**Files:** Create `app/psn_resolution.py`; modify `app/psn_export.py`, `app/psn_classification.py`; test `tests/test_psn_resolution.py`.

- [ ] Write failing tests for a base Product Purchase plus demo/voucher row sharing a title, self-title app exclusion, and entitlement-only game evidence.
- [ ] Run `rtk pytest tests/test_psn_resolution.py -q`; expect missing module/API failure.
- [ ] Add row evidence to `PsnExportCandidate`, preserving each transaction's type, product and content values; implement classifier outcomes `matched_eligible`, `needs_review`, and `suggested_skip` without aggregate veto.
- [ ] Run the focused tests; expect pass.
- [ ] Commit classifier boundary and tests.

### Task 2: Validated catalog resolver with bounded fallback

**Files:** Modify `app/integrations/igdb.py`; create/modify `app/psn_resolution.py`; test `tests/test_psn_resolution.py`, `tests/test_provider_clients.py`.

- [ ] Write failing transport/_query-boundary tests asserting generated multiquery aliases/payload and raw `{name,result}` handling for one and ten titles; add malformed, missing-alias, partial, and per-title error fallback cases.
- [ ] Run focused pytest; expect failures from missing resolver behavior.
- [ ] Implement `resolve_psn_catalog_titles(titles, max_fallback_titles=...)`, use batch first, validate every alias, then call normal single fetch only for unresolved titles up to the fixed budget. Return per-title `matched`, `ambiguous`, `no_match`, or `unavailable`.
- [ ] Run focused pytest; expect pass.
- [ ] Commit resolver and tests.

### Task 3: Import preview contracts and grouping

**Files:** Modify `app/schemas.py`, `app/main.py`; test `tests/integration/backend/test_profile_dashboard_psn_api.py`.

- [ ] Write failing route tests that invoke the real resolver boundary and distinguish matched, ambiguous/no-match review, suggested skip, and unavailable.
- [ ] Run focused pytest; expect response-contract failure.
- [ ] Wire preview to row classifier plus resolver; expose safe evidence/reason and preserve unavailable as its own status.
- [ ] Run focused pytest; expect pass.
- [ ] Commit API preview change and tests.

### Task 4: Owner-scoped RAW promotion and repair reuse

**Files:** Modify `app/main.py`; test `tests/integration/backend/test_profile_dashboard_psn_api.py`.

- [ ] Write failing tests for RAW-to-linked promotion, merge with existing linked duplicate, idempotency, typed catalog ID validation, and repair unavailable visibility.
- [ ] Run focused pytest; expect failure.
- [ ] Implement transactional promotion by `psn_manual_external_id(source_title)`, safe merge semantics, and repair calls to the shared resolver/classifier.
- [ ] Run focused pytest; expect pass.
- [ ] Commit import/repair persistence change and tests.

### Task 5: Import and repair UI states

**Files:** Modify `web/src/lib/api.ts`, `web/src/routes/psn-import.tsx`, `web/src/routes/psn-library-repair.tsx`; test their route tests.

- [ ] Write failing Vitest cases for four groups, retry of unavailable rows, evidence text, manual mapping, and bulk selection limited to matched catalog IDs.
- [ ] Run `rtk npm.cmd --prefix web test -- --run src/routes/-psn-import.test.tsx src/routes/-psn-library-repair.test.tsx`; expect failure.
- [ ] Implement typed client contract and groups; ensure unavailable is never default RAW and retry reissues preview safely.
- [ ] Run the focused Vitest command; expect pass.
- [ ] Commit frontend change and tests.

### Task 6: Acceptance harness and complete verification

**Files:** Create a local-only anonymized fixture/harness if needed; do not add the user export.

- [ ] Run the complete focused backend and frontend suites, then `rtk pytest -q`, `rtk npm.cmd --prefix web test`, and `rtk npm.cmd --prefix web run build`.
- [ ] Run a read-only local acceptance script against the supplied XLSX, report only aggregate outcome counts; use production public single search only for non-mutating spot checks when IGDB credentials are unavailable.
- [ ] Run `rtk git diff --check` and scoped diff/status review; confirm no XLSX, secrets, or unrelated changes.
- [ ] Commit any test-only acceptance harness separately, if one was necessary.
