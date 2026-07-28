# Verification Debt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing web tests and lint command executable in the Vite/TanStack workspace.

**Architecture:** Resolve legacy Next imports only in Vitest through local aliases, preserve normal route behavior with native links where a RouterProvider is absent, reconcile the reusable cover interface with its test, then apply the repository’s existing Prettier formatter.

**Tech Stack:** Vitest, Vite, React, ESLint, Prettier.

## Global Constraints

- No runtime dependencies.
- Keep legacy Next shims test-only.
- Use TDD for runtime behavior; run full web tests and lint after all tasks.

### Task 1: Add test-only Next shims

**Files:** `web/vitest.config.ts`, `web/src/test/next-link.tsx`, `web/src/test/next-navigation.ts`.

- [ ] Add aliases for `next/link` and `next/navigation` to local test modules.
- [ ] Implement a native anchor default export and inert `usePathname`, `useRouter`, and `useSearchParams` hooks.
- [ ] Run the auth, library, discovery, destination, and lovable AppShell tests; confirm imports resolve.

### Task 2: Reconcile the image-cover contract

**Files:** `web/src/components/GameCover.tsx`, `web/src/components/ui.test.tsx`.

- [ ] Use the existing failing cover test as RED evidence.
- [ ] Support optional `src` artwork with an accessible image and nullable-source fallback while retaining gradient `from`/`to` callers.
- [ ] Re-run `ui.test.tsx` and confirm it passes.

### Task 3: Remove the unprovided router dependency from the Friends empty state

**Files:** `web/src/features/friends/FriendsScreen.tsx`, `web/src/features/friends/friends.test.tsx`.

- [ ] Use the existing 409 test as RED evidence.
- [ ] Render its Steam connection destination as an ordinary `/steam` anchor.
- [ ] Re-run `friends.test.tsx` and confirm the 409 branch passes without RouterProvider warnings.

### Task 4: Restore lint and run complete verification

**Files:** Prettier-managed files in `web/` only.

- [ ] Run the configured formatter over the web project; this is a mechanical line-ending and layout change.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, and `pytest -q`.
- [ ] Commit the verification-debt changes separately from the homepage commits.
