# Authenticated Home, Steam, and PSN Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a data-driven authenticated dashboard, reliable Steam library presentation, and PlayStation XLSX import while retaining the archive guest homepage and controls.

**Architecture:** `routes/index.tsx` selects guest or authenticated content from the existing auth store. The backend remains the authority for Steam/library/PSN data; frontend components invalidate TanStack Query keys after mutations and render compact unavailable states instead of mock content.

**Tech Stack:** FastAPI, SQLAlchemy, openpyxl, React, TanStack Router, TanStack Query, Vitest, pytest.

## Global Constraints

- Preserve the archive guest homepage and its buttons.
- Do not use mock game, friend, or activity data in production routes.
- Accept the PlayStation native XLSX export and import only `Transaction Detail` rows with `Content Type = Game`.
- Run typechecking, lint, tests, build, and a production browser check before release.

---

### Task 1: Parse only owned games from PlayStation XLSX

**Files:**
- Modify: `app/psn_export.py`, `tests/test_psn_export.py`, `web/src/routes/psn-import.tsx`

**Interfaces:**
- Produces: `parse_psn_export(content: bytes) -> list[str]` containing deduplicated `Game Name` values from `Transaction Detail` where `Content Type` equals `Game`.

- [ ] Add a failing pytest workbook fixture containing Game, DLC, Subscription, and wallet rows; assert only game titles remain.
- [ ] Run `rtk pytest tests/test_psn_export.py -q`; expect the fixture to fail because current generic title scanning includes non-game product rows.
- [ ] Update the parser to find the `Transaction Detail` header row, locate `Game Name` and `Content Type`, and include normalized titles only when the content type casefolds to `game`.
- [ ] Update the upload control to accept `.xlsx` and explain that it expects the PlayStation Data Access export.
- [ ] Re-run `rtk pytest tests/test_psn_export.py -q`; expect all tests to pass.
- [ ] Commit with `feat: import PlayStation XLSX game purchases`.

### Task 2: Expose Steam-owned games consistently

**Files:**
- Modify: `web/src/lib/api.ts`, `web/src/routes/library.tsx`, `web/src/components/ConnectedServices.tsx`, `web/src/components/ConnectedServices.test.tsx`

**Interfaces:**
- Consumes: `GET /library/overview` returning `LibraryOverviewRead` and `POST /auth/steam/sync` returning `SteamLibrarySyncRead`.
- Produces: `getLibraryOverview()` and cache invalidation for `library`, `library-overview`, and dashboard queries.

- [ ] Write a failing component test asserting that a linked Steam account with no cached records exposes `Sync Steam library` and that a successful mutation invalidates all library query keys.
- [ ] Run the focused Vitest file; expect failure because the current client reads `/games` only and invalidates too few queries.
- [ ] Add a typed overview client and render its Steam game records in library with valid catalog links only when `detail_game_id` exists.
- [ ] Update ConnectedServices to display sync counts/error text and invalidate the overview/dashboard keys after success.
- [ ] Re-run the focused test; expect pass.
- [ ] Commit with `feat: surface synced Steam library games`.

### Task 3: Restore guest versus authenticated homepage

**Files:**
- Modify: `web/src/routes/index.tsx`, `web/src/components/AuthenticatedHome.tsx`, `web/src/components/AuthenticatedHome.test.tsx`

**Interfaces:**
- Consumes: `getAuthSnapshot()`, `getProfile()`, `getLibraryOverview()`, `getFriends()`, `getDeals()`.
- Produces: `AuthenticatedHome` dashboard for signed-in users; the current guest discovery page remains unchanged for guests.

- [ ] Write failing tests for auth selection: guest sees registration CTA; signed-in user sees `Play with friends tonight` and no registration CTA.
- [ ] Run the focused test; expect failure because `Home` unconditionally renders guest content.
- [ ] Extract current archive discovery markup as `GuestHome`; add an authenticated dashboard preserving search, friends, Steam/library, deal, and navigation actions with compact unavailable states.
- [ ] Wire `Home` to the existing auth subscription and query keys without rendering dashboard mock data.
- [ ] Re-run focused tests; expect pass.
- [ ] Commit with `feat: restore authenticated dashboard home`.

### Task 4: Stabilize game detail and friend profile fallbacks

**Files:**
- Modify: `web/src/routes/games.$gameId.tsx`, `web/src/routes/friends.$friendId.tsx`, `web/src/components/ProfileView.tsx`
- Test: `web/src/routes/game-and-friend-fallbacks.test.tsx`

**Interfaces:**
- Consumes: `getCatalogGame`, `getPriceHistory`, `getFriends`.
- Produces: routes that never reference missing mock values and retain controls while compactly showing missing social data.

- [ ] Write failing route tests for a missing catalog result and a friend whose library/activity fields are unavailable.
- [ ] Run the focused test; expect failure from current empty panels or unresolved values.
- [ ] Keep the archive action buttons and detail sections, replace unavailable friend library/activity content with compact empty states, and ensure missing game API responses reach the route not-found UI.
- [ ] Re-run the focused test; expect pass.
- [ ] Commit with `fix: harden game and friend profile routes`.

### Task 5: Release verification

**Files:**
- Test: `tests/test_psn_export.py`, `web/src/**/*.test.tsx`, `web/src/lib/api.test.ts`

- [ ] Run `rtk pytest tests/test_psn_export.py -q`, `rtk npm exec tsc -- --noEmit`, `rtk npm run lint`, `rtk npm test`, and `rtk npm run build` from `web` where applicable.
- [ ] Start or deploy the production build, sign in, and verify the authenticated home, Steam sync/library, XLSX preview, game detail, and friend profile in a browser.
- [ ] Push the branch, create a PR to `main`, and merge only after checks pass.
