# Startup and Navigation Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Work inline: do not spawn subagents. Keep tool calls and output token-efficient.

**Goal:** Make the initial authenticated view render promptly and make Library/Friends feel instant after startup.

**Architecture:** Use TanStack Router intent preloading for route modules and React Query prefetching with a shared 90-second freshness policy. Initial home content stays critical; sidebar deals and destination data are deferred to idle time and revalidated in the background.

**Tech Stack:** TanStack Start/Router, TanStack React Query, React, Vitest, Testing Library.

## Global Constraints

- Do not change API response schemas or Steam synchronization behavior.
- Do not persist cache to localStorage; cache lifetime is one browser session.
- Use `staleTime: 90_000` for the specified user-navigation queries.
- Create a new `codex/` branch for implementation; preserve unrelated changes.

---

### Task 1: Centralize navigation query options

**Files:**
- Create: `web/src/lib/navigationQueries.ts`
- Create: `web/src/lib/navigationQueries.test.ts`
- Modify: `web/src/routes/library.tsx`
- Modify: `web/src/routes/friends.index.tsx`
- Modify: `web/src/components/AppShell.tsx`

**Interfaces:**
- Produces `libraryOverviewQueryOptions()`, `friendsQueryOptions()`, `incomingFriendRequestsQueryOptions()`, and `steamSocialFirstPageQueryOptions()`.
- Each option has its existing query key/function plus `staleTime: 90_000`.

- [ ] **Step 1: Write failing query-option tests**

```ts
it("keeps Library navigation data fresh for 90 seconds", () => {
  expect(libraryOverviewQueryOptions().staleTime).toBe(90_000);
  expect(libraryOverviewQueryOptions().queryKey).toEqual(["library-overview"]);
});
```

- [ ] **Step 2: Run the test**

Run: `rtk npm test -- --run src/lib/navigationQueries.test.ts`

Expected: FAIL because `navigationQueries` does not exist.

- [ ] **Step 3: Implement shared options and consume them**

```ts
export const NAVIGATION_STALE_TIME = 90_000;
export const libraryOverviewQueryOptions = () => ({
  queryKey: ["library-overview"] as const,
  queryFn: getLibraryOverview,
  staleTime: NAVIGATION_STALE_TIME,
});
```

Replace duplicate route `useQuery` configurations with these option factories. Preserve Friends infinite-query pagination arguments; its first-page prefetch must call `getSteamSocial(12, 0)`.

- [ ] **Step 4: Verify and commit**

Run: `rtk npm test -- --run src/lib/navigationQueries.test.ts src/routes/-friends.index.test.tsx`

Expected: PASS.

Commit: `git commit -am "perf: share navigation query cache policy"`

### Task 2: Prefetch destinations on intent and idle time

**Files:**
- Modify: `web/src/components/AppShell.tsx`
- Create: `web/src/components/-AppShell.prefetch.test.tsx`

**Interfaces:**
- Consumes query options from Task 1.
- Produces intent preloading for `/library` and `/friends` and an authenticated idle prefetch routine.

- [ ] **Step 1: Write failing tests**

```tsx
it("prefetches Library data when its navigation link receives focus", async () => {
  renderShell();
  fireEvent.focus(screen.getByRole("link", { name: "Library" }));
  await waitFor(() => expect(queryClient.prefetchQuery).toHaveBeenCalledWith(libraryOverviewQueryOptions()));
});
```

- [ ] **Step 2: Run the test**

Run: `rtk npm test -- --run src/components/-AppShell.prefetch.test.tsx`

Expected: FAIL because menu intent does not prefetch data.

- [ ] **Step 3: Implement intent and idle prefetching**

Add `preload="intent"` to every `Link`. For Library and Friends, attach `onFocus` and `onPointerEnter` handlers that call `queryClient.prefetchQuery` with their Task 1 options. After `signedIn` becomes true, schedule the complete destination prefetch set with `requestIdleCallback`, falling back to `setTimeout`; cancel the callback in `useEffect` cleanup.

- [ ] **Step 4: Verify and commit**

Run: `rtk npm test -- --run src/components/-AppShell.prefetch.test.tsx`

Expected: PASS.

Commit: `git commit -am "perf: prefetch Library and Friends navigation"`

### Task 3: Prioritize the first authenticated screen

**Files:**
- Modify: `web/src/components/AppShell.tsx`
- Modify: `web/src/routes/index.tsx`
- Create: `web/src/routes/-index.startup.test.tsx`

- [ ] **Step 1: Write a failing startup test**

```tsx
it("renders the authenticated home heading before deferred sidebar deals resolve", async () => {
  mockDealsPending();
  renderHome();
  expect(await screen.findByRole("heading", { name: "Play with friends tonight" })).toBeInTheDocument();
  expect(screen.getByText(/Live deals/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test**

Run: `rtk npm test -- --run src/routes/-index.startup.test.tsx`

Expected: FAIL until deferred sidebar behavior is explicitly covered.

- [ ] **Step 3: Implement non-blocking sidebar data**

Keep shell markup visible immediately. Move the sidebar deals fetch behind the same idle scheduler used in Task 2; show a compact deterministic placeholder (`Live deals · loading`) until its query starts/resolves. Do not delay home profile, dashboard, library, or friends queries.

- [ ] **Step 4: Verify and commit**

Run: `rtk npm test -- --run src/routes/-index.startup.test.tsx src/components/-AppShell.prefetch.test.tsx`

Expected: PASS.

Commit: `git commit -am "perf: defer noncritical startup data"`

### Task 4: Cold-state UI and end-to-end verification

**Files:**
- Modify: `web/src/routes/library.tsx`
- Modify: `web/src/routes/friends.index.tsx`
- Modify: `web/src/routes/-library.test.tsx`
- Modify: `web/src/routes/-friends.index.test.tsx`

- [ ] **Step 1: Write failing cold-state tests**

```tsx
it("shows a Library skeleton while its first request is pending", () => {
  mockLibraryPending();
  renderLibrary();
  expect(screen.getByTestId("library-loading")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests**

Run: `rtk npm test -- --run src/routes/-library.test.tsx src/routes/-friends.index.test.tsx`

Expected: FAIL because stable skeleton test IDs do not exist.

- [ ] **Step 3: Implement route skeletons**

Render `data-testid="library-loading"` and `data-testid="friends-loading"` only when the relevant query is pending and no cached data exists. Continue to show cached lists during background fetching. Preserve current error/empty-state messages.

- [ ] **Step 4: Run full verification and deploy**

Run: `rtk npm test -- --run src/components src/routes` and `rtk npm run build` from `web/`.

Then measure cold and warmed Library/Friends navigation in the browser, push the branch, open a PR, deploy the approved commit to Lightsail, and repeat the production measurement.
