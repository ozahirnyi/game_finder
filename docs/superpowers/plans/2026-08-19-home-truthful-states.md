# Truthful Home States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every asynchronous Home result truthful and actionable while preserving the existing FastAPI contracts and working navigation.

**Architecture:** Keep `web/src/routes/index.tsx` as the sole UI integration point and retain its current TanStack Query keys/functions. Add explicit rendering branches from each query's `isPending`/`isError`/data state and call that query's `refetch` for retry. Recommendation navigation is guarded locally: only a positive integer IGDB id produces a detail link; all other recommendations expose the existing search route.

**Tech Stack:** React, TypeScript, TanStack Router, TanStack Query, Vitest, React Testing Library.

## Global Constraints

- Use only the existing frontend API functions and query keys; add no backend endpoint, schema, migration, or aggregate request.
- Preserve the form action `/search`, game detail navigation `/games/$gameId`, `/library`, and `/friends`.
- Keep `getDeals(region, 13)` unchanged, including when retrying a selected region.
- Never represent pending or failed profile/library/friends data as a known zero.
- Do not stage `web/src/routeTree.gen.ts` or generated/build output.
- Each production change follows TDD: focused failing test, RED command, minimal implementation, GREEN command.

---

## File Structure

- Modify: `web/src/routes/index.tsx` — render state-specific Home UI and safe recommendation navigation without changing data contracts.
- Modify: `web/src/routes/-index.recommendations.test.tsx` — exercise guest discovery, deals, dashboard failure, and recommendation route behavior using mocked API functions.
- Modify: `web/src/routes/-index.startup.test.tsx` — establish truthful authenticated loading copy and prevent false zero counts during startup.

### Task 1: Price drops states and retry

**Files:**
- Modify: `web/src/routes/-index.recommendations.test.tsx`
- Modify: `web/src/routes/index.tsx`

**Interfaces:**
- Consumes: existing `dealsQuery = useQuery({ queryKey: ["deals", region], queryFn: () => getDeals(region, 13) })`.
- Produces: distinct Price drops copy for pending, empty, and error states; an accessible retry button that calls `dealsQuery.refetch()`.

- [ ] **Step 1: Write failing focused tests**

Add a `describe("Home price drops", ...)` block that keeps the guest mocks and covers the three result states plus retry:

```tsx
it("shows a loading state while selected-region deals are pending", () => {
  api.getDeals.mockImplementation(() => new Promise(() => {}));
  renderHome();
  expect(screen.getByText("Live deals · loading")).toBeInTheDocument();
});

it("shows an empty state when the selected region has no deals", async () => {
  api.getDeals.mockResolvedValue({ results: [] });
  renderHome();
  expect(await screen.findByText(/No price drops are available for US/i)).toBeInTheDocument();
});

it("retries only the selected region after a deals failure", async () => {
  api.getDeals.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ results: [] });
  renderHome();
  fireEvent.click(await screen.findByRole("button", { name: /retry price drops/i }));
  await waitFor(() => expect(api.getDeals).toHaveBeenLastCalledWith("US", 13));
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `rtk npm.cmd test --prefix web -- --run src/routes/-index.recommendations.test.tsx`

Expected: FAIL because the Price drops branch does not yet expose distinct pending/empty/error copy or a retry control.

- [ ] **Step 3: Implement the smallest state branch**

Replace the unconditional `{best && (...)}` deals grid with an ordered state branch before rendering deal cards:

```tsx
{dealsQuery.isPending ? (
  <Panel className="p-6 text-sm text-muted-foreground">Live deals · loading</Panel>
) : dealsQuery.isError ? (
  <Panel className="p-6 text-sm text-muted-foreground">
    Price drops are unavailable for {region}. <button type="button" onClick={() => dealsQuery.refetch()}>Retry price drops</button>
  </Panel>
) : deals.length === 0 ? (
  <Panel className="p-6 text-sm text-muted-foreground">No price drops are available for {region}.</Panel>
) : (
  <div className="stagger grid ...">...</div>
)}
```

Keep the existing complete grid, guest CTA, and call to `getDeals(region, 13)` inside the populated branch.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `rtk npm.cmd test --prefix web -- --run src/routes/-index.recommendations.test.tsx`

Expected: PASS, including the existing thirteenth-deal contract test.

- [ ] **Step 5: Commit the independently testable change**

Run:

```text
rtk git add web/src/routes/index.tsx web/src/routes/-index.recommendations.test.tsx
rtk git commit -m "feat: clarify home price drop states"
```

### Task 2: Guest trending states and retry

**Files:**
- Modify: `web/src/routes/-index.recommendations.test.tsx`
- Modify: `web/src/routes/index.tsx`

**Interfaces:**
- Consumes: existing `trendingQuery` with key `["trending-games"]` and `getTrendingGames`.
- Produces: loading, empty, and error/retry presentation for guest `Popular games` without affecting signed-in recommendations.

- [ ] **Step 1: Write failing focused tests**

Add guest tests whose mocks are independent from deals:

```tsx
it("distinguishes trending loading and an empty catalog", async () => {
  api.getAuthSnapshot.mockReturnValue(false);
  api.getTrendingGames.mockImplementationOnce(() => new Promise(() => {}));
  renderHome();
  expect(screen.getByText("Popular games · loading")).toBeInTheDocument();
});

it("shows a retry for a failed trending request", async () => {
  api.getAuthSnapshot.mockReturnValue(false);
  api.getTrendingGames.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ results: [] });
  renderHome();
  fireEvent.click(await screen.findByRole("button", { name: /retry popular games/i }));
  await waitFor(() => expect(api.getTrendingGames).toHaveBeenCalledTimes(2));
});
```

Also assert the fulfilled `{ results: [] }` state has a message distinct from both loading and failure.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `rtk npm.cmd test --prefix web -- --run src/routes/-index.recommendations.test.tsx`

Expected: FAIL because an in-flight or empty request currently reaches the same unavailable fallback.

- [ ] **Step 3: Implement explicit guest branches**

Within the guest arm of the `Popular games` section, render query states in this order:

```tsx
trendingQuery.isPending ? <Panel>Popular games · loading</Panel>
  : trendingQuery.isError ? <Panel>Popular games are unavailable. <button onClick={() => trendingQuery.refetch()}>Retry popular games</button></Panel>
  : trendingGames.length === 0 ? <Panel>No popular games are available right now.</Panel>
  : <div>{/* existing GameCard grid */}</div>
```

Use `type="button"` on retry controls and preserve the existing mapped `GameCard` properties.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `rtk npm.cmd test --prefix web -- --run src/routes/-index.recommendations.test.tsx`

Expected: PASS with the original real-catalog-game assertion still passing.

- [ ] **Step 5: Commit the independently testable change**

Run:

```text
rtk git add web/src/routes/index.tsx web/src/routes/-index.recommendations.test.tsx
rtk git commit -m "feat: clarify guest trending states"
```

### Task 3: Signed-in summaries and dashboard network failure

**Files:**
- Modify: `web/src/routes/-index.startup.test.tsx`
- Modify: `web/src/routes/-index.recommendations.test.tsx`
- Modify: `web/src/routes/index.tsx`

**Interfaces:**
- Consumes: existing `profileQuery`, `libraryQuery`, `friendsQuery`, and `dashboardQuery`; `dashboardQuery.refetch()`.
- Produces: neutral authenticated summary/panel copy while source queries are pending or failed, plus retryable dashboard-network failure distinct from API recommendation block statuses.

- [ ] **Step 1: Write failing focused tests**

Update the startup test's authenticated deferred mocks and assert no known zero is announced:

```tsx
expect(screen.getByText(/Your dashboard · library and friends are loading/i)).toBeInTheDocument();
expect(screen.queryByText(/0 games in your library/i)).not.toBeInTheDocument();
expect(screen.queryByText(/0 friends connected/i)).not.toBeInTheDocument();
```

Add a dashboard rejection test:

```tsx
api.getDashboard.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ recommendations: { status: "empty", data: [] } });
renderHome();
fireEvent.click(await screen.findByRole("button", { name: /retry recommendations/i }));
await waitFor(() => expect(api.getDashboard).toHaveBeenCalledTimes(2));
```

Assert the initial network-failure copy is `Recommendations are unavailable` and differs from the server-block empty state.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `rtk npm.cmd test --prefix web -- --run src/routes/-index.startup.test.tsx src/routes/-index.recommendations.test.tsx`

Expected: FAIL because `?? 0` currently manufactures counts and dashboard rejection is rendered as the generic empty state.

- [ ] **Step 3: Implement neutral signed-in presentation and dashboard retry**

Derive settled-state booleans before JSX and use them in the heading, library panel, and both friends summaries:

```tsx
const accountSummaryPending = profileQuery.isPending || libraryQuery.isPending || friendsQuery.isPending;
const accountSummaryUnavailable = profileQuery.isError || libraryQuery.isError || friendsQuery.isError;
```

Render neutral copy for these states before ever reading `.length`; only show a numeric count when the relevant query has a successful data value. In the signed-in recommendations branch, place this condition after pending and before `recommendationBlock` status handling:

```tsx
dashboardQuery.isError ? (
  <Panel className="p-6 text-sm text-muted-foreground">
    Recommendations are unavailable. <button type="button" onClick={() => dashboardQuery.refetch()}>Retry recommendations</button>
  </Panel>
) : /* existing ready/empty/server-error behavior */
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `rtk npm.cmd test --prefix web -- --run src/routes/-index.startup.test.tsx src/routes/-index.recommendations.test.tsx`

Expected: PASS; the heading still renders before deferred deals settle and neither Home location claims zero while signed-in resources are pending.

- [ ] **Step 5: Commit the independently testable change**

Run:

```text
rtk git add web/src/routes/index.tsx web/src/routes/-index.startup.test.tsx web/src/routes/-index.recommendations.test.tsx
rtk git commit -m "feat: make signed-in home state truthful"
```

### Task 4: Safe unmatched recommendation navigation

**Files:**
- Modify: `web/src/routes/-index.recommendations.test.tsx`
- Modify: `web/src/routes/index.tsx`

**Interfaces:**
- Consumes: `DashboardRecommendation` fields `title`, `reason`, `tags`, `cover_url`, and optional `igdb_id`.
- Produces: `RecommendationCard` detail link only when `Number.isInteger(igdb_id) && igdb_id > 0`; otherwise a non-clickable card with a `/search` title link.

- [ ] **Step 1: Write failing focused tests**

Replace the obsolete `/games/0` expectation with:

```tsx
const cardTitle = await screen.findByRole("heading", { name: "Unknown title" });
expect(cardTitle.closest("a")).toBeNull();
expect(screen.queryByRole("link", { name: /Unknown title/i })).toBeNull();
expect(screen.getByRole("link", { name: /search this title/i })).toHaveAttribute("href", "/search?q=Unknown+title");
```

Keep the matched test and add a zero/non-integer `igdb_id` fixture to prove both cannot create a detail link.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `rtk npm.cmd test --prefix web -- --run src/routes/-index.recommendations.test.tsx`

Expected: FAIL because `RecommendationCard` currently wraps every card in a `/games/${igdb_id ?? 0}` link.

- [ ] **Step 3: Implement guarded navigation**

Make the identity decision explicit and preserve the existing panel content:

```tsx
const hasVerifiedCatalogId = Number.isInteger(recommendation.igdb_id) && recommendation.igdb_id > 0;
if (hasVerifiedCatalogId) {
  return <Link to="/games/$gameId" params={{ gameId: String(recommendation.igdb_id) }} search={{ title: recommendation.title }} className="block h-full">{content}</Link>;
}
return <div className="h-full">{content}<p>Catalog page unavailable.</p><Link to="/search" search={{ q: recommendation.title }}>Search this title</Link></div>;
```

Keep title, reason, tags, and cover intact for the unmatched card; do not use a manually concatenated URL.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `rtk npm.cmd test --prefix web -- --run src/routes/-index.recommendations.test.tsx`

Expected: PASS; enriched cards retain `/games/123?title=Eligible` and unmatched cards have no detail link or `/games/0` target.

- [ ] **Step 5: Commit the independently testable change**

Run:

```text
rtk git add web/src/routes/index.tsx web/src/routes/-index.recommendations.test.tsx
rtk git commit -m "fix: keep unmatched home recommendations searchable"
```

### Task 5: Full regression verification and draft PR

**Files:**
- Modify: none unless a prior verification failure has a directly related, tested correction.

**Interfaces:**
- Consumes: completed Home UI changes and frontend test suite.
- Produces: recorded evidence that backend, frontend tests, lint, and production build pass; a draft PR containing only Phase 4 files.

- [ ] **Step 1: Inspect the final diff and staging scope**

Run:

```text
rtk git status --short
rtk git diff origin/main -- web/src/routes/index.tsx web/src/routes/-index.recommendations.test.tsx web/src/routes/-index.startup.test.tsx docs/superpowers
```

Expected: only Phase 4 Home route/tests and the already-approved Phase 4 design/plan documents are present; `web/src/routeTree.gen.ts` and generated output are absent.

- [ ] **Step 2: Run required complete verification**

Run:

```text
rtk pytest
rtk npm.cmd test --prefix web
rtk npm.cmd run lint --prefix web
rtk npm.cmd run build --prefix web
```

Expected: each command exits with status 0. If a command fails unexpectedly, stop implementation, invoke `systematic-debugging`, and use a new focused RED/GREEN cycle for the direct cause.

- [ ] **Step 3: Commit the plan document if it remains uncommitted and push**

Run:

```text
rtk git add docs/superpowers/plans/2026-08-19-home-truthful-states.md
rtk git commit -m "docs: plan truthful home states"
rtk git push -u origin codex/home-truthful-states-implementation
```

Expected: the branch is on origin with no unrelated staged files.

- [ ] **Step 4: Open a draft PR targeting `main`**

Create a draft pull request from `codex/home-truthful-states-implementation` to `main`. Its body must enumerate the existing API-only scope and include exact successful command output/exit evidence from Step 2.
