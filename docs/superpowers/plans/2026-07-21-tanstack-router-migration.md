# TanStack Router Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every `next/*` runtime import without adding Next.js.

**Architecture:** The existing TanStack Router becomes the only navigation source. Migrate shared links and navigation first, then URL-state components, then prove there are no remaining imports with tests, lint, and a Vite build.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Router/Start, Vitest, ESLint.

## Global Constraints

- Do not add `next`.
- Preserve URLs, parameters, copy, and backend OAuth behavior.
- Do not touch `web/.output`.

---

### Task 1: Shared links and imperative navigation

**Files:** `web/src/components/Nav.tsx`, `web/src/components/lovable/AppShell.tsx`, `web/src/features/auth/AuthPanel.tsx`, `web/src/features/library/SavedGameDetailScreen.tsx`, and `web/src/features/auth/auth.test.tsx`.

- [ ] Write a failing auth-navigation test that expects `navigate` to receive `{ to: "/" }` after sign-in.
- [ ] Run `rtk proxy npm.cmd --prefix web test -- --run src/features/auth/auth.test.tsx`; confirm it fails before migration.
- [ ] Replace `next/link` with TanStack `Link`, `useRouter().push` with `useNavigate()`, and pathname reads with `useRouterState({ select: state => state.location.pathname })`.
- [ ] Re-run the focused test and commit the listed files as `refactor: migrate shared navigation to TanStack Router`.

### Task 2: URL state and OAuth callback

**Files:** `web/src/app/auth/callback/page.tsx`, `web/src/app/login/page.tsx`, `web/src/app/search/page.tsx`, `web/src/app/favorites/[id]/page.tsx`, and their tests.

- [ ] Write a failing callback test asserting a `provider=google&error=access_denied` URL does not call `exchangeGoogleCode` and shows a retry link.
- [ ] Run `rtk proxy npm.cmd --prefix web test -- --run src/app/auth/callback/page.test.tsx`; confirm it fails before migration.
- [ ] Read query state using `new URLSearchParams(useRouterState({ select: state => state.location.searchStr }))`, call `useNavigate()` for redirects, and use the generated route's `useParams()` or a route-wrapper prop for path IDs.
- [ ] Re-run focused page tests and commit as `refactor: use TanStack Router location state`.

### Task 3: Removal proof and production checks

**Files:** `web/src/test/no-next-imports.test.ts` and every remaining file reported by the scan.

- [ ] Add a failing boundary test that asserts project source text does not match `next/(link|navigation)`.
- [ ] Run `rtk rg -n "next/navigation|next/link" web/src -g "*.ts" -g "*.tsx" --max-count 80` and replace every remaining runtime import and test mock with a TanStack equivalent.
- [ ] Run `rtk proxy npm.cmd --prefix web test`, `rtk proxy npm.cmd --prefix web run lint`, and `rtk proxy npm.cmd --prefix web run build`; each must exit successfully.
- [ ] Commit the final source files as `refactor: remove Next router dependencies`.

### Task 4: Register migrated destinations as TanStack routes

**Files:** `web/src/routes/login.tsx`, `web/src/routes/register.tsx`, `web/src/routes/auth.callback.tsx`, `web/src/routes/favorites.$id.tsx`, `web/src/components/Nav.tsx`, `web/src/features/library/SavedGameDetailScreen.tsx`, `web/src/routeTree.gen.ts`, and route-focused tests.

- [ ] Add a failing route registration test that requires `/login`, `/register`, `/auth/callback`, and `/favorites/$id` in the generated route tree.
- [ ] Add a failing OAuth callback test for `provider=google&error=access_denied` that proves no code exchange occurs and the retry link is rendered.
- [ ] Create TanStack file routes for the four paths; use `Route.useParams()` in the saved-game detail route and retain `/favorites/$id` as the public detail URL.
- [ ] Point library navigation and the saved-game return action to the existing `/library` route.
- [ ] Regenerate `web/src/routeTree.gen.ts`, then run the route and callback tests.
- [ ] Run TypeScript with `rtk proxy npm.cmd --prefix web exec tsc -- --noEmit -p C:/Users/zagir/PycharmProjects/game_finder/.worktrees/tanstack-router-migration/web/tsconfig.json`; resolve all TanStack route destination errors.

### Task 5: Restore the GameCover API contract

**Files:** `web/src/components/GameCover.tsx`, `web/src/components/ui.test.tsx`, `web/src/features/discovery/discovery.test.tsx`.

- [ ] Add a failing GameCover test for rendering an accessible image when a non-empty `src` is supplied, while retaining the gradient title fallback for absent artwork.
- [ ] Extend `GameCover` to accept optional `src`, render the image when supplied, and require no image for the existing colour-gradient fallback.
- [ ] Run the focused UI and discovery tests, then run the TypeScript command from Task 4 to confirm API-backed screens type-check.
