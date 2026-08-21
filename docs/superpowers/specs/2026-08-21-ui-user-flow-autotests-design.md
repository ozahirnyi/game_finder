# UI User Flow Autotests - Design

**Date:** 2026-08-21  
**Status:** proposed; awaiting implementation approval  
**Audited baseline:** `origin/main` at `7c112af`  
**Scope:** automated UI coverage for the main PlayFinder user flows. No product behavior changes in this spec.

## Problem

PlayFinder already has focused Vitest coverage for many route and component
states, plus backend pytest coverage for API contracts. The current gap is a
stable browser-level safety net that proves the main user journeys still work
as journeys, not only as isolated components.

The risk is highest around flows that cross route boundaries: Home to Search to
Game Detail, auth into onboarding, wishlist into price alerts, public profile
navigation, friends actions, and notification deep links. These are the flows a
user experiences as one pipeline, but today regressions can pass if individual
components still render.

## Desired outcome

Add a small, deterministic UI autotest suite that covers the primary user
pipelines end to end through the active `web/` frontend, using real routing and
browser interaction while mocking external APIs and unstable backend responses.

The suite must be reliable enough for CI, fast enough for pull requests, and
clear enough that a failed test points to a broken user flow rather than a
flaky provider dependency.

## Analysis and repository evidence

- Active frontend is `web/`, with Vite/TanStack React routes under
  `web/src/routes/`.
- Current test runner is Vitest with jsdom in `web/vitest.config.ts`.
- Existing UI unit/route tests include:
  - `web/src/routes/-index.recommendations.test.tsx`
  - `web/src/routes/-index.startup.test.tsx`
  - `web/src/routes/-search.test.tsx`
  - `web/src/routes/-games.$gameId.test.ts`
  - `web/src/routes/-wishlist.test.tsx`
  - `web/src/routes/-friends.index.test.tsx`
  - `web/src/routes/-users.$publicId.test.tsx`
  - `web/src/components/NotificationsPanel.test.tsx`
  - `web/src/components/PriceAlertForm.test.tsx`
  - `web/src/components/OnboardingGuidance.test.tsx`
- `web/package.json` has `test`, `build`, `lint`, and `dev` scripts, but no
  browser E2E script.
- No Playwright/Cypress files are present on `origin/main`.
- GitHub Actions currently has `backend-tests.yml`; no frontend or E2E workflow
  is present in the audited baseline.
- External dependencies that must remain mocked in UI tests: Steam, Telegram,
  OpenAI recommendations, catalog/deals providers, Google OAuth, and live auth
  services.

## Confirmed decisions

- Party and Discord are out of scope because these product surfaces do not
  exist in the current main implementation.
- The active frontend target is `web/`, not the old local `frontend/` artifact.
- Existing Vitest coverage remains valuable and should not be replaced.

## Open questions

- Should browser UI tests run against a mocked frontend-only API layer or a
  local FastAPI test server with seeded DB?
  - Recommendation: start with mocked network responses in Playwright. It gives
    deterministic user-flow coverage without requiring PostgreSQL, Redis, or
    provider credentials in every PR. Add true full-stack E2E later for one or
    two critical smoke paths if needed.
- Should these tests gate every pull request immediately?
  - Recommendation: gate PRs after the suite is stable for at least one local
    and one CI run. During the first implementation PR, run them but keep the
    workflow easy to retry and inspect.

## Scope

### In scope

- Add Playwright as the browser UI autotest runner for journey-level tests.
- Add reusable route/network mocks for the frontend API boundary.
- Add stable test helpers for auth state, common API fixtures, and navigation.
- Cover the main user pipelines listed in this spec.
- Keep existing Vitest route/component tests and extend them only where a
  journey exposes a missing component-level assertion.
- Add npm scripts and CI workflow for frontend unit tests, build, and UI
  user-flow tests.

### Out of scope

- No Party Finder, Groups, Discord, or presence tests.
- No live Steam, Telegram, Google, OpenAI, RAWG/IGDB, or payment/provider calls.
- No visual snapshot testing as the primary assertion layer.
- No production synthetic monitoring in this phase.
- No backend schema, API behavior, or product UI changes unless a test exposes
  a confirmed existing bug and the implementation scope is separately approved.

## Proposed implementation

1. Add Playwright test infrastructure under `web/e2e/`.
   - Files:
     - `web/playwright.config.ts`
     - `web/e2e/fixtures/api-fixtures.ts`
     - `web/e2e/fixtures/auth.ts`
     - `web/e2e/fixtures/routes.ts`
     - `web/e2e/*.spec.ts`
   - Add package scripts:
     - `test:ui`: run Playwright headless.
     - `test:ui:headed`: run the same suite in headed mode for debugging.
     - `test:all`: run Vitest, Playwright, and build if CI wants one command.

2. Use frontend network interception instead of live providers.
   - Intercept `/api/*` requests at the browser boundary.
   - Return typed fixture payloads matching `web/src/lib/api.ts` contracts.
   - Provide fixture states for success, loading-like delayed response, empty,
     error, unauthorized, and permission-hidden resources.
   - Keep one fixture file per product domain where practical:
     `auth`, `catalog`, `dashboard`, `profile`, `collections`, `friends`,
     `notifications`.

3. Preserve the existing fast test pyramid.
   - Vitest remains the place for component branches, helpers, and route-level
     edge cases.
   - Playwright covers only cross-route user journeys and critical browser
     interactions.
   - Backend pytest remains the source of truth for owner scoping, validation,
     and API contract behavior.

4. Add CI coverage.
   - Create a frontend workflow that installs `web` dependencies, installs
     Playwright browsers, runs Vitest, runs the Playwright user-flow suite, and
     runs `npm.cmd run build` equivalent on GitHub Linux as `npm run build`.
   - Upload Playwright traces/screenshots only on failure.

5. Document local commands and debugging.
   - Add a short section to the spec or a future `web/e2e/README.md` with:
     - install command;
     - headless/headed run commands;
     - how to update fixtures;
     - how to inspect a trace.

## User pipelines to cover

### Flow 1: Guest discovery to game detail

The guest lands on Home, sees truthful discovery/deal states, searches for a
game, opens Search results, applies catalog filters, and navigates to a real
game detail page.

Critical assertions:
- Home guest state does not show account-only data.
- Search input navigates to `/search?q=<query>`.
- Catalog result cards link to `/games/$gameId` with the correct `title` and
  optional `source`.
- Empty and failed discovery states show truthful copy and retry actions.

### Flow 2: Auth entry and onboarding

The user signs in, lands in the authenticated product, sees onboarding guidance
based on account state, and can navigate to the next useful action.

Critical assertions:
- Sign-in sends credentials to the auth endpoint, stores auth state, and routes
  to `/account`.
- Authenticated Home requests profile, library, friends, dashboard, and
  onboarding summary.
- Onboarding cards appear only for incomplete setup steps.
- Retry state is visible when onboarding summary fails.

### Flow 3: Search, wishlist, favorites, and price alert

The signed-in user searches for a game, opens detail, saves it to wishlist,
adds/removes favorite, and creates a price alert.

Critical assertions:
- Wishlist and favorite actions call the owner-scoped endpoints with the game
  identity from the detail page.
- A Steam-origin game uses Steam wishlist behavior; a catalog game uses catalog
  wishlist/favorites behavior.
- Price alert form supports `Any discount`, `Target price`, and
  `Target discount`.
- Telegram delivery is disabled with explanatory copy unless Telegram is linked
  and configured.
- Successful alert creation invalidates visible wishlist/alert state and shows
  the expected saved alert summary.

### Flow 4: Friends and social actions

The user searches players, opens a canonical public profile, sends a friend
request, sees friend-only actions when relationship is `friends`, and starts a
message or invite from the profile/friends flow.

Critical assertions:
- Search result links use `/users/$publicId`.
- Public profile shows only visible sections when relationship is `none`.
- Friend relationship unlocks friend profile data, shared library, message,
  and invite actions.
- Friend request, message, and invite actions call the correct endpoints and
  show pending/success/error states.
- Private/hidden sections do not leak titles or counts through the UI.

### Flow 5: Notification deep links

The user opens notifications and clicks each actionable notification type:
friend request, accepted friend, message, game invite, invite response, and
price alert.

Critical assertions:
- Each supported payload navigates to the intended existing route.
- An unread notification is marked read after a valid navigation intent.
- Malformed or unsupported payloads show an unavailable action message and are
  not marked read.
- Deleted or unauthorized targets resolve to the same neutral unavailable UI.

### Flow 6: Public profile and privacy controls

The user updates profile visibility settings and then views the profile as self,
friend, and public viewer.

Critical assertions:
- Self view can see and edit own profile settings.
- Public viewer sees public sections only.
- Friend viewer sees `friends` sections and relevant social actions.
- Private sections do not render item titles, store identities, or hidden
  counts.

### Flow 7: Error, empty, and loading resilience

The main flows keep truthful state when dependent resources are pending,
empty, failed, or unauthorized.

Critical assertions:
- Pending data is never presented as real zero data.
- API failures show scoped recovery controls where retry is meaningful.
- Unauthorized auth state clears token or routes to sign-in according to the
  existing auth contract.
- Page-level errors do not crash the app shell.

## Acceptance criteria

- AC-1: A browser-level UI test suite exists and runs against the active
  `web/` app with real routing and browser interactions.
- AC-2: The suite covers Guest discovery to Game Detail, Auth + Onboarding,
  Search/Wishlist/Favorites/Price Alert, Friends/Social, Notifications,
  Public Profile/Privacy, and Error/Empty/Loading resilience.
- AC-3: Tests do not call live Steam, Telegram, Google, OpenAI, catalog/deals,
  or auth provider services.
- AC-4: UI tests use stable user-visible assertions and route/API-contract
  assertions, not implementation details such as component state variables.
- AC-5: The suite is runnable locally with documented commands and produces
  actionable failure artifacts for debugging.
- AC-6: CI runs frontend unit tests, browser UI user-flow tests, and production
  build for pull requests that touch frontend code.
- AC-7: Existing Vitest tests continue to pass; Playwright does not replace
  route/component coverage.
- AC-8: Tests include positive, empty, error, unauthorized/hidden, and retry
  states for critical flows where those states exist in the product.

## Verification criteria

- VC-1 -> AC-1
  - Environment: local Windows worktree and GitHub Actions Linux runner.
  - Command: `cd web && npm run test:ui`.
  - Expected result: Playwright launches the app and all browser user-flow
    specs pass headlessly.

- VC-2 -> AC-2
  - Environment: local and CI.
  - Command: inspect Playwright report and spec names.
  - Expected result: each flow has at least one dedicated spec file or clearly
    named `test.describe` block with assertions for the critical path.

- VC-3 -> AC-3
  - Environment: local and CI.
  - Command: run `npm run test:ui` with network mocks enabled and provider
    credentials absent.
  - Expected result: tests pass without live provider credentials or external
    provider network calls.

- VC-4 -> AC-4
  - Environment: code review.
  - Command: review selectors and assertions.
  - Expected result: assertions prefer roles, labels, visible text, URLs, and
    intercepted API payloads over private React state or CSS-only selectors.

- VC-5 -> AC-5
  - Environment: local.
  - Command: intentionally fail one UI test and inspect generated trace/report.
  - Expected result: trace, screenshot, or report artifact identifies the
    failed step and visible page state.

- VC-6 -> AC-6
  - Environment: GitHub Actions pull request.
  - Command: frontend workflow.
  - Expected result: workflow installs dependencies, runs Vitest, runs
    Playwright, runs build, and uploads Playwright artifacts on failure.

- VC-7 -> AC-7
  - Environment: local and CI.
  - Command: `cd web && npm run test`.
  - Expected result: existing Vitest suite passes after Playwright is added.

- VC-8 -> AC-8
  - Environment: local and CI.
  - Command: inspect fixtures and Playwright report.
  - Expected result: critical flows include success plus at least one relevant
    empty/error/unauthorized/retry state where the product exposes that state.

## Test plan

### Unit and route tests

- Keep existing Vitest files as the fast regression layer.
- Add or update Vitest tests only for low-level behavior that Playwright would
  make slow or brittle:
  - notification payload mapping;
  - game route target helpers;
  - price alert form mode payloads;
  - visibility transformation helpers;
  - auth token handling.

### Browser UI tests

Recommended Playwright spec layout:

- `web/e2e/guest-discovery.spec.ts`
- `web/e2e/auth-onboarding.spec.ts`
- `web/e2e/search-collections-alerts.spec.ts`
- `web/e2e/friends-social.spec.ts`
- `web/e2e/notifications.spec.ts`
- `web/e2e/public-profile-privacy.spec.ts`
- `web/e2e/resilience-states.spec.ts`

### Backend/API tests

- No new backend tests are required for browser test infrastructure itself.
- If implementation uncovers a backend contract bug, add focused pytest in the
  existing backend test suite as a separate approved scope item.

### Regression/build/type/lint

- Run:
  - `cd web && npm run test`
  - `cd web && npm run test:ui`
  - `cd web && npm run build`
  - `cd web && npm run lint` if current lint baseline is expected to be clean.

## Local deployment and presentation

- Services:
  - Browser UI tests should start the frontend dev server through Playwright
    `webServer`.
  - Backend, PostgreSQL, Redis, and provider credentials are not required for
    mocked UI flow tests.
- Local URL:
  - Playwright can use the Vite/TanStack dev server URL assigned in
    `playwright.config.ts`.
- Test data/account:
  - Use deterministic fixture users:
    - guest viewer;
    - signed-in owner;
    - public non-friend viewer;
    - confirmed friend;
    - user with Telegram linked;
    - user without Telegram linked.
- Demonstration scenarios:
  - Run the suite once headless.
  - Run one representative flow headed or show a Playwright trace.
  - Show the CI workflow output once available.

## Production deployment

- Target environment:
  - CI only for this phase; no production runtime change is expected from tests.
- Deployment process:
  - Merge the test infrastructure and workflow through the normal PR process.
- Preconditions:
  - Playwright browsers install successfully in CI.
  - Tests pass without provider credentials.
  - Frontend build remains green.
- Migration/configuration impact:
  - None expected.
- Post-deploy checks:
  - Confirm the new frontend/UI workflow runs on the next PR touching `web/`.
- Monitoring:
  - Watch initial PR runs for flakes and runtime duration.
- Rollback:
  - Disable the frontend UI workflow or revert the Playwright infrastructure PR
    if tests are unstable and block unrelated work.

## Risks and dependencies

- Risk: Playwright tests become slow or flaky.
  - Mitigation: keep the suite small, mock providers, avoid arbitrary waits,
    assert on visible readiness states, and upload traces only on failure.
- Risk: Fixtures drift from backend API contracts.
  - Mitigation: type fixtures from `web/src/lib/api.ts` where possible and keep
    backend pytest/API contract tests as the source of truth.
- Risk: Tests overfit visual copy.
  - Mitigation: prefer roles, labels, stable headings, route URLs, and payload
    assertions; use exact copy only when copy is the behavior being verified.
- Risk: CI browser installation increases PR time.
  - Mitigation: cache npm dependencies and Playwright browsers where feasible;
    run full browser suite only for frontend changes if workflow complexity is
    justified.

## Approval log

- Implementation approval: pending.
- Production approval after presentation: not requested; no production runtime
  deployment expected.

## Verification evidence

- Pending. This document is the proposed spec; implementation and verification
  evidence will be recorded after approval and execution.
