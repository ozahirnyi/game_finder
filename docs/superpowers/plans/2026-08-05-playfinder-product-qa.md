# PlayFinder Product QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use inline execution. The user explicitly prohibited delegation.

**Goal:** Validate the PlayFinder user journeys end-to-end at the application-contract level and fix every reproducible defect found in this audit.

**Architecture:** The audit begins by making the test runner portable so existing frontend tests execute in a clean checkout. It then maps every frontend mutation and query to FastAPI routes and schemas, supplements missing regression tests, and makes minimal source changes for observed contract, state, accessibility, and stale-integration failures. Production checks are read-only.

**Tech Stack:** FastAPI, SQLAlchemy, pytest; React, TanStack Router/Query, TypeScript, Vitest, Testing Library; Docker/Lightsail.

## Global Constraints

- Work only on `codex/playfinder-product-qa`, based on remote `origin/main` SHA `61ea1ab`.
- Preserve unrelated changes in the original checkout; this clean checkout is the only mutation target.
- Write a failing regression test before each product/configuration fix; do not perform mutation tests against production.
- No active `rawg` or `railway` integration references may remain.
- Verify focused tests, full backend/frontend suites, lint, and production build before publishing.

---

### Task 1: Restore portable frontend test execution

**Files:**
- Modify: `web/vitest.config.ts`, `web/src/routeTree.gen.ts`
- Test: `web/src/routeTree.gen.test.ts`

- [ ] Add a test that rejects absolute local-file imports in the generated route tree.
- [ ] Run it and record the expected failure caused by the committed `Z:/Dev/...` imports.
- [ ] Resolve Vitest setup with an absolute URL-derived path and replace the two generated absolute type imports with portable local imports.
- [ ] Run the focused test and full Vitest suite.

### Task 2: Audit guest and account journeys

**Files:**
- Inspect: `web/src/routes`, `web/src/lib/api.ts`, `app/main.py`, `tests`
- Test: existing route/API tests plus new focused regressions for each observed defect

- [ ] Exercise home, search, catalog/detail, deals, API failure, register/login/logout/OAuth flows through tests and browser-safe local checks.
- [ ] Compare request method, path, auth, payload, and response use with FastAPI routes and Pydantic models.
- [ ] For each reproducible defect, write a focused failing test, implement the smallest change, and rerun the test.

### Task 3: Audit collections, integrations, profile, and social journeys

**Files:**
- Inspect: library/wishlist/profile/friends/notification/PSN/Steam routes and matching FastAPI handlers
- Test: existing component/route/API tests plus new focused regressions for each observed defect

- [ ] Verify library, favorites, wishlist, price alerts, notifications, Steam connect/sync/unlink, PSN import, profile/settings/theme, friends/messages/invites/Steam friends.
- [ ] Verify loading, error, empty, disabled, keyboard-submit, and accessible-name states on mobile/desktop components.
- [ ] Remove or implement any reproducible empty clickable/mock placeholder surfaces, with regression coverage.

### Task 4: Final integration, publication, and deployment observation

**Files:**
- Modify only files required by confirmed fixes and tests

- [ ] Re-scan active source and deployment configuration for `rawg|railway`.
- [ ] Run targeted tests, full `pytest`, full Vitest, lint, and build.
- [ ] Commit, push the branch, open a PR, monitor CI, and fix any CI-reproducible defects.
- [ ] Merge only after CI passes; observe the Lightsail deployment and perform read-only production checks. Stop and report the exact access blocker if deployment visibility/credentials are unavailable.
