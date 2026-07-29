# Lovable UI Backend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt the updated Lovable UI while wiring every visible control to the existing FastAPI API and removing production mock data.

**Architecture:** Preserve TanStack Start routes and the `/api` client boundary. Add typed API methods first, then map endpoint responses into reusable presentational components (`GameCover`, `GameCard`, services, notifications, PSN import) and migrate routes one domain at a time.

**Tech Stack:** React 19, TanStack Start/Router/Query, TypeScript, Vitest, FastAPI, pytest.

## Global Constraints

- All production data comes from FastAPI; `mockData.ts` may not be imported by shipped routes/components.
- Game cards always navigate to `/games/$gameId`; store URLs appear only as an explicit detail-page action.
- Theme controls render only in sidebar/mobile header, never in profile content.
- Preserve same-origin `/api`, JWT storage, current backend routes, and existing deployment layout.
- Use TDD: create each regression test before implementation and verify it fails first.

---

### Task 1: Import updated UI assets and establish reusable data primitives

**Files:**
- Create: `web/src/components/GameCard.tsx`, `web/src/components/SocialAuthButtons.tsx`, `web/src/components/ConnectedServices.tsx`, `web/src/components/NotificationsPanel.tsx`
- Modify: `web/src/components/GameCover.tsx`, `web/src/components/ui-bits.tsx`, `web/src/routes/__root.tsx`
- Test: `web/src/components/GameCover.test.tsx`, `web/src/components/GameCard.test.tsx`

**Interfaces:**
- Produces `GameCardData` with `gameId`, `coverUrl`, price fields, genres and platforms.
- Produces `GameCover({ image?: string })`, which renders an image with generated-cover fallback.

- [ ] Write failing tests asserting `GameCover` renders a supplied image and `GameCard` has `/games/:id` href rather than a store URL.
- [ ] Run `rtk npm test -- src/components/GameCover.test.tsx src/components/GameCard.test.tsx`; expect failure because image and card component are absent.
- [ ] Copy only presentation assets from the updated archive, replace its `mockData` imports with explicit props, and implement `PriceBlock` using `Intl.NumberFormat`.
- [ ] Re-run the two tests; expect all pass. Run `rtk npm run lint`.
- [ ] Commit `feat: add reusable live game card components`.

### Task 2: Extend the typed FastAPI client for restored integrations

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/lib/api.test.ts`

**Interfaces:**
- Produces `getGoogleLoginUrl`, `getGoogleLinkUrl`, `getSteamSignInUrl`, `getSteamLinkUrl`, `getSteamAccount`, `syncSteamLibrary`, `unlinkSteamAccount`, `previewPsnImport`, `confirmPsnImport`, `getNotifications`, `markNotificationRead`, and `markAllNotificationsRead`.
- All requests use `/api`, attach JWT only for authenticated actions, and throw `ApiError` on non-2xx responses.

- [ ] Write failing request assertions for Google/Steam URL methods, PSN `FormData` preview, PSN confirmation payload, and Steam sync.
- [ ] Run `rtk npm test -- src/lib/api.test.ts`; expect failures for missing exports or incorrect paths.
- [ ] Implement the typed responses and request functions using the existing request helper; retain `VITE_API_URL ?? "/api"`.
- [ ] Re-run `rtk npm test -- src/lib/api.test.ts`; expect all pass.
- [ ] Commit `feat: restore frontend integration API client`.

### Task 3: Restore OAuth screens and callback handoff

**Files:**
- Modify: `web/src/routes/sign-in.tsx`, `web/src/routes/sign-up.tsx`, `web/src/routeTree.gen.ts`
- Create: `web/src/routes/auth.callback.tsx`
- Test: `web/src/routes/auth.callback.test.tsx`, `web/src/routes/sign-in.test.tsx`

**Interfaces:**
- Consumes Task 2 URL/exchange helpers and `setToken`.
- Produces social login buttons which redirect only after a successful URL response; callback persists exchanged token and routes to `/account`.

- [ ] Write failing tests for visible Google/Steam controls and callback token persistence.
- [ ] Run the focused tests; expect failures because archive controls are presentational-only and callback route is absent.
- [ ] Wire `SocialAuthButtons` with provider callbacks, provider-specific loading/error state, and a callback route that exchanges provider code then invalidates authenticated queries.
- [ ] Re-run focused tests and `rtk npm run build`; expect success.
- [ ] Commit `feat: wire Google and Steam OAuth UI`.

### Task 4: Migrate discovery, cards, details, prices, and covers

**Files:**
- Modify: `web/src/routes/index.tsx`, `web/src/routes/search.tsx`, `web/src/routes/deals.tsx`, `web/src/routes/games.$gameId.tsx`, `web/src/routes/library.tsx`, `web/src/routes/wishlist.tsx`
- Test: `web/src/routes/discovery-live-data.test.tsx`

**Interfaces:**
- Consumes `GameCardData`, catalogue/deals/price API methods, and real `background_image`/`cover_url` fields.
- Produces internal game navigation and a detail-only external offer button from `price.current.url`.

- [ ] Write failing tests proving home/deals cards render supplied covers, link internally, and price format includes received currency.
- [ ] Run the focused test; expect legacy gradient/external-anchor behavior failure.
- [ ] Replace duplicated route cards with `GameCard`; map API fields to card props; render only actual deal metadata; add skeleton, empty, error and unavailable-price states.
- [ ] Re-run focused tests, `rtk npm test`, `rtk npm run lint`, and `rtk npm run build`; expect pass with no lint errors.
- [ ] Commit `feat: render live catalogue cards and prices`.

### Task 5: Wire profile, service controls, and PlayStation import

**Files:**
- Modify: `web/src/routes/account.tsx`, `web/src/components/ProfileView.tsx`, `web/src/components/AppShell.tsx`, `web/src/routeTree.gen.ts`
- Create: `web/src/routes/psn-import.tsx`
- Test: `web/src/routes/account-integrations.test.tsx`, `web/src/routes/psn-import.test.tsx`

**Interfaces:**
- Consumes Task 2 Steam/Google/PSN methods and profile/library query keys.
- Produces profile service controls, real sync status, and PSN upload-preview-confirm-result flow.

- [ ] Write failing tests asserting profile has no `ThemeSelector`, service actions call the appropriate API operation, and PSN confirmation posts selected preview titles.
- [ ] Run focused tests; expect failures before the API wiring exists.
- [ ] Adapt archive `ConnectedServices` to props and mutations, remove timeout/mock paths, add invalidation after success, and connect the PSN stepper to `previewPsnImport`/`confirmPsnImport`.
- [ ] Re-run focused tests and frontend build; expect all pass.
- [ ] Commit `feat: wire profile services and PSN import`.

### Task 6: Migrate friends and notifications without invented data

**Files:**
- Modify: `web/src/routes/friends.index.tsx`, `web/src/routes/friends.$friendId.tsx`, `web/src/components/NotificationsPanel.tsx`, `web/src/lib/api.ts`
- Test: `web/src/routes/social-live-data.test.tsx`

**Interfaces:**
- Consumes friends, requests, conversations, invitations and notification endpoints.
- Produces API-backed empty/loading/error states and only renders compatibility/activity/common-game fields when returned by FastAPI.

- [ ] Write failing tests asserting no mock import exists and mark-read actions call API endpoints.
- [ ] Run focused tests; expect failure before mutations are wired.
- [ ] Map social and notification responses to archive UI, preserving empty state where API does not supply a value.
- [ ] Re-run focused tests plus `rtk npm test`; expect all pass.
- [ ] Commit `feat: wire social and notification UI`.

### Task 7: Full verification, release, and live browser validation

**Files:**
- Modify: generated `web/src/routeTree.gen.ts` only if router generation requires it.
- Test: existing frontend and backend suites.

- [ ] Run `rtk npm test`, `rtk npm run lint`, and `rtk npm run build` in `web`.
- [ ] Run `rtk python -m pytest -q` at repository root.
- [ ] Inspect `rtk git diff --check` and commit any router-generated file.
- [ ] Push branch, open a PR, merge only after checks succeed, and monitor the Lightsail deploy.
- [ ] Browser-verify: OAuth controls visible, theme absent from profile, an API-backed game cover/card loads and links internally, and `/psn-import` renders its initial state.
