# Full Archive UI Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the complete updated Lovable UI and wire it to the existing FastAPI client without deleting visual controls.

**Architecture:** Extract the archive into a temporary staging directory, copy its UI source as the visual baseline, then restore the production API module and replace mock imports route-by-route. Existing FastAPI endpoints remain the only data source for implemented actions.

**Tech Stack:** React, TanStack Router/Query, Tailwind, Vite, FastAPI.

## Global Constraints

- The archive is the visual source of truth.
- Do not remove visual UI elements from the archive.
- Do not ship `mockData` or artificial `setTimeout` data loading.
- Use the existing `/api` client and backend endpoints.

---

### Task 1: Port the archive visual baseline

**Files:**
- Modify: `web/src/**`
- Preserve: `web/src/lib/api.ts`, deployment proxy configuration

- [ ] Extract the archive to a temporary directory and compare its route/component tree to `web/src`.
- [ ] Copy archive routes, components, UI primitives, styles, and assets into `web/src`.
- [ ] Restore the production API client and verify `npm run build` reaches route compilation.
- [ ] Commit: `feat: port complete updated archive UI`.

### Task 2: Replace homepage and discovery mocks

**Files:**
- Modify: `web/src/routes/index.tsx`, `web/src/routes/search.tsx`, `web/src/routes/deals.tsx`, `web/src/routes/games.$gameId.tsx`

- [ ] Replace `mockData` imports with `getTrendingGames`, `searchGames`, `getDeals`, `getCatalogGame`, and `getPriceHistory`.
- [ ] Keep the archive layout, live search, cards, region control, and calls to action.
- [ ] Add/adjust tests for real client rendering and run them.
- [ ] Commit: `feat: wire archive discovery UI to catalogue APIs`.

### Task 3: Replace account and service mocks

**Files:**
- Modify: `web/src/routes/account.tsx`, `web/src/routes/library.tsx`, `web/src/routes/wishlist.tsx`, `web/src/routes/psn-import.tsx`, `web/src/components/ConnectedServices.tsx`, `web/src/components/NotificationsPanel.tsx`

- [ ] Connect profile, Steam, PSN, library, wishlist, and notification components to existing API functions.
- [ ] Keep archive controls with no API visibly present and non-destructive.
- [ ] Run focused component tests.
- [ ] Commit: `feat: wire archive account UI to backend services`.

### Task 4: Restore authentication and social route visuals

**Files:**
- Modify: `web/src/routes/sign-in.tsx`, `web/src/routes/sign-up.tsx`, `web/src/routes/auth.callback.tsx`, `web/src/routes/friends.*.tsx`

- [ ] Preserve archive social button designs and wire OAuth callbacks and live friend data.
- [ ] Run authentication/client tests.
- [ ] Commit: `feat: restore archive auth and social UI`.

### Task 5: Verify and release

**Files:**
- Test: `web/src/**/*.test.tsx`, `web/src/lib/api.test.ts`

- [ ] Run lint, tests, and production build.
- [ ] Visually inspect homepage and account routes with the local production build.
- [ ] Push branch, create PR, then merge after checks pass.
