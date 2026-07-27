# Home Search and Global Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry homepage search text into catalog search and add a reduced-motion-safe transition to every primary app route.

**Architecture:** The search route owns a validated `q` query parameter and synchronizes it to its catalog input. Both guest and authenticated home forms navigate to the same route contract. `AppShell` owns one keyed reveal wrapper so individual pages do not need to duplicate transition plumbing.

**Tech Stack:** React 19, TanStack Router, React Query, Tailwind CSS v4, Vitest, Testing Library.

## Global Constraints

- Keep regional game differences and existing deal data behavior unchanged.
- Do not add currency conversion: the public API returns UAH for `UA`.
- Apply motion only to primary route content and preserve the global reduced-motion override.
- Do not touch the existing untracked production-release plan.

---

### Task 1: Prefill catalog search from the route query

**Files:**
- Modify: `web/src/routes/search.tsx`
- Test: `web/src/test/search-ai.routes.test.tsx`

**Interfaces:**
- Consumes: `/search?q?: string`.
- Produces: `SearchPage` whose catalog input and query use the trimmed `q` value whenever the route query changes.

- [ ] **Step 1: Write the failing test**

Render the search route with `q: "Hades"` and assert:

```tsx
expect(screen.getByPlaceholderText("Search by title…")).toHaveValue("Hades");
expect(searchGames).toHaveBeenCalledWith("Hades");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm --prefix web test -- --run src/test/search-ai.routes.test.tsx`

Expected: FAIL because the route has no validated search state and initializes its input to an empty string.

- [ ] **Step 3: Write minimal implementation**

Configure `Route` with:

```tsx
validateSearch: (search: Record<string, unknown>) => ({
  q: typeof search.q === "string" ? search.q.trim() : "",
}),
```

Read `const { q } = Route.useSearch()` in `SearchPage`, initialize catalog query from `q`, and synchronize state in an effect when `q` changes.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm --prefix web test -- --run src/test/search-ai.routes.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add web/src/routes/search.tsx web/src/test/search-ai.routes.test.tsx
git commit -m "fix: prefill catalog search from route"
```

### Task 2: Add authenticated homepage search handoff

**Files:**
- Modify: `web/src/routes/index.tsx`
- Test: `web/src/features/home/home.test.tsx`

**Interfaces:**
- Consumes: a nonempty dashboard search form value.
- Produces: `navigate({ to: "/search", search: { q: trimmedValue } })`.

- [ ] **Step 1: Write the failing test**

Mock an authenticated linked dashboard, enter `Hades` in its home searchbox, submit, and assert:

```tsx
expect(mockNavigate).toHaveBeenCalledWith({
  to: "/search",
  search: { q: "Hades" },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm --prefix web test -- --run src/features/home/home.test.tsx`

Expected: FAIL because the dashboard exposes only a static `/search` link.

- [ ] **Step 3: Write minimal implementation**

Use `useNavigate` and local string state in `Dashboard`; replace the static catalog link with an accessible search form. Its submit handler trims input and navigates only when the value is nonempty.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm --prefix web test -- --run src/features/home/home.test.tsx`

Expected: PASS, including the existing guest handoff test.

- [ ] **Step 5: Commit**

```text
git add web/src/routes/index.tsx web/src/features/home/home.test.tsx
git commit -m "feat: hand off dashboard searches"
```

### Task 3: Animate primary route content globally

**Files:**
- Modify: `web/src/components/AppShell.tsx`
- Test: `web/src/components/AppShell.test.tsx`

**Interfaces:**
- Consumes: current router pathname from `useRouterState`.
- Produces: a `key={pathname}` route-content wrapper with `animate-reveal`.

- [ ] **Step 1: Write the failing test**

Render `AppShell` and assert:

```tsx
expect(screen.getByTestId("route-content")).toHaveClass("animate-reveal");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm --prefix web test -- --run src/components/AppShell.test.tsx`

Expected: FAIL because no shared route-content wrapper exists.

- [ ] **Step 3: Write minimal implementation**

Wrap `{children}` in:

```tsx
<div key={pathname} data-testid="route-content" className="animate-reveal">
  {children}
</div>
```

Keep the existing `prefers-reduced-motion` CSS rule unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm --prefix web test -- --run src/components/AppShell.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add web/src/components/AppShell.tsx web/src/components/AppShell.test.tsx
git commit -m "feat: animate route transitions"
```

### Task 4: Verify and publish

**Files:**
- Modify: none expected

- [ ] **Step 1: Run focused verification**

Run: `rtk npm --prefix web test -- --run src/test/search-ai.routes.test.tsx src/features/home/home.test.tsx src/components/AppShell.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run full web verification**

Run: `rtk npm --prefix web test; rtk npm --prefix web run lint; rtk npm --prefix web run build`

Expected: all tests and build PASS; lint has no errors.

- [ ] **Step 3: Review and publish**

Run: `rtk git diff --check; rtk git status --short`

Then push `codex/home-search-and-global-motion` and create a draft PR targeting `main`.
