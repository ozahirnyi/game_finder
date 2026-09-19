# Stable Debounced Catalog Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send catalog searches only after a 700 ms pause in text input and keep existing results visible during background refreshes.

**Architecture:** `SearchPage` will retain the immediate input state for rendering and URL updates, while a small local debounce hook supplies the value used by the catalog React Query key. The loading empty state will use React Query's initial-pending condition so a remount refetch never replaces cached result cards.

**Tech Stack:** React 19, TypeScript, TanStack React Query 5, Vitest, Testing Library.

## Global Constraints

- Use a 700 ms debounce interval for catalog text input.
- Keep URL updates immediate; only network search input is delayed.
- Preserve immediate filtering semantics.
- Show the full "Searching games" empty state only when no catalog data is available.
- Do not call external services in tests.

---

### Task 1: Add debounce regression coverage

**Files:**
- Modify: `web/src/routes/-search.test.tsx`

**Interfaces:**
- Consumes: the Search route component exported as `Route`.
- Produces: tests that define the expected catalog request timing and remount display behaviour.

- [ ] **Step 1: Write failing tests**

Add fake-timer coverage that enters `Counter-Strike`, verifies no request is issued at 699 ms, advances one more millisecond, and asserts that one request contains `query=Counter-Strike`. Add a remount test with cached `Hades` data and a never-resolving refresh that asserts the Hades card remains visible and the full searching empty state is absent.

```tsx
vi.useFakeTimers();
fireEvent.change(screen.getByPlaceholderText(/search by title/i), {
  target: { value: "Counter-Strike" },
});
await vi.advanceTimersByTimeAsync(699);
expect(fetchMock).not.toHaveBeenCalled();
await vi.advanceTimersByTimeAsync(1);
expect(fetchMock).toHaveBeenCalledWith(
  expect.stringContaining("query=Counter-Strike"),
  expect.anything(),
);
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm.cmd test -- src/routes/-search.test.tsx`

Expected: the debounce test fails because the existing component fetches immediately; the cached-result test fails because it renders `Searching games` over the card.

- [ ] **Step 3: Commit the failing tests**

```bash
git add web/src/routes/-search.test.tsx
git commit -m "test: cover stable debounced catalog search"
```

### Task 2: Separate immediate input from catalog request state

**Files:**
- Modify: `web/src/routes/search.tsx`
- Test: `web/src/routes/-search.test.tsx`

**Interfaces:**
- Consumes: immediate `query` state, catalog filters, and `searchGames`.
- Produces: `debouncedQuery`, updated no sooner than 700 ms after a text change, used in the catalog React Query key and request.

- [ ] **Step 1: Add the minimal debounce hook**

Add a `useDebouncedValue(value: string, delayMs: number): string` function in `web/src/routes/search.tsx`. It stores `value` in local state and schedules its update in a `useEffect`; its cleanup clears the pending timeout.

```tsx
function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}
```

- [ ] **Step 2: Use the debounced value only for catalog query identity and request input**

After `query` state, define `const debouncedQuery = useDebouncedValue(query, 700)`. Replace `query` with `debouncedQuery` in the catalog `queryKey` and pass `debouncedQuery.trim()` to `searchGames`. Keep `updateQuery`, `syncUrl`, the input value, and AI recommendation input on immediate `query`.

- [ ] **Step 3: Run the focused tests and verify they pass**

Run: `npm.cmd test -- src/routes/-search.test.tsx`

Expected: PASS, including the request-after-700-ms assertion.

- [ ] **Step 4: Commit the debounce implementation**

```bash
git add web/src/routes/search.tsx web/src/routes/-search.test.tsx
git commit -m "fix: debounce catalog search input"
```

### Task 3: Do not cover existing cards with a background-fetch empty state

**Files:**
- Modify: `web/src/routes/search.tsx`
- Test: `web/src/routes/-search.test.tsx`

**Interfaces:**
- Consumes: `searchQuery.data`, `searchQuery.isPending`, and `results`.
- Produces: a searching empty state exclusively for the initial catalog request without resolved data.

- [ ] **Step 1: Use the initial pending state in the empty-state branch**

Replace the catalog loading condition with `searchQuery.isPending`, leaving the no-results branch guarded by `!searchQuery.isPending`. Do not alter the result-card branch: cached results will render even while React Query performs a background refetch.

```tsx
{searchQuery.isPending && <EmptyState /* existing copy and icon */ />}
{!searchQuery.isPending && results.length === 0 && <EmptyState /* no-match copy */ />}
```

- [ ] **Step 2: Run the focused tests and verify they pass**

Run: `npm.cmd test -- src/routes/-search.test.tsx`

Expected: PASS, with the remount test confirming that cached `Hades` stays visible while the refresh is unresolved.

- [ ] **Step 3: Run the frontend quality checks**

Run: `npm.cmd test -- src/routes/-search.test.tsx && npm.cmd run lint && npm.cmd run build`

Expected: all commands exit with code 0.

- [ ] **Step 4: Commit the stable loading-state fix**

```bash
git add web/src/routes/search.tsx web/src/routes/-search.test.tsx
git commit -m "fix: keep catalog results during refresh"
```
