# Auth Home Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return signed-out users to the public home page and let authentication-form visitors return there directly.

**Architecture:** Change the existing local profile logout navigation target from `/login` to `/`. Add ordinary TanStack `Link` elements at the top of both auth forms.

**Tech Stack:** React, TanStack Router, React Query, Vitest, Testing Library.

## Global Constraints

- Logout continues to clear the token and React Query cache.
- Both profile states navigate to `/` after logout.
- Auth-form link text is exactly `← Back to PlayFinder` and its destination is `/`.

---

### Task 1: Add failing navigation tests

**Files:**
- Modify: `web/src/test/live-data.routes.test.tsx`
- Modify: `web/src/test/auth-recovery.routes.test.tsx`

- [ ] Assert both existing profile sign-out tests expect `navigate({ to: "/" })`.
- [ ] Add tests that render `LoginPage` and `RegisterPage`, then assert their `← Back to PlayFinder` links have `href="/"`.
- [ ] Run `rtk npm --prefix web test -- auth-recovery.routes.test.tsx live-data.routes.test.tsx` and confirm failure because the current logout target is `/login` and home links do not exist.

### Task 2: Implement home navigation and verify

**Files:**
- Modify: `web/src/routes/profile.tsx`
- Modify: `web/src/routes/login.tsx`
- Modify: `web/src/routes/register.tsx`

- [ ] Change `navigate({ to: "/login" })` in the shared sign-out handler to `navigate({ to: "/" })`.
- [ ] Add a top-level `Link to="/"` with text `← Back to PlayFinder` to both auth cards.
- [ ] Run the focused tests, then `rtk npm --prefix web test` and `rtk npm --prefix web run build`; expect all tests and the production build to pass.
- [ ] Commit all implementation and test files with `feat: return signed-out users home`.
