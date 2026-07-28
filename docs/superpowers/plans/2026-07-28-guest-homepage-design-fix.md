# Guest Homepage Design Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the public homepage with the existing dashboard visual system while preserving all live-deal behavior.

**Architecture:** Keep `GuestHome` as the route-level guest composition and `PublicDeals` as the stateful data component. Replace only their obsolete structural class names with current Tailwind utility classes; no API, state, or routing contract changes are required.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest, Testing Library.

## Global Constraints

- Preserve real public deal data, region selection, USD fallback, and accessible labels.
- Reuse existing `surface`, `border`, `primary`, and `muted-foreground` Tailwind tokens.
- Retain global reduced-motion handling; do not add animation-specific overrides.
- Do not modify unrelated routes, API calls, or the existing untracked production-release plan.

---

### Task 1: Style the guest hero and search control

**Files:**
- Modify: `web/src/features/home/GuestHome.tsx`
- Test: `web/src/features/home/home.test.tsx`

**Interfaces:**
- Consumes: `useNavigate(): NavigateFn`, `initialCountry(): string`, and `PublicDeals` unchanged.
- Produces: `GuestHome()` with a bounded responsive hero and clearly styled search form.

- [ ] **Step 1: Write the failing test**

Add this assertion to the existing guest-home motion test:

```tsx
expect(screen.getByTestId("guest-home").className).toContain("max-w-6xl");
expect(screen.getByRole("searchbox").className).toContain("bg-surface");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm --prefix web test -- --run src/features/home/home.test.tsx`

Expected: FAIL because the guest-home wrapper lacks `max-w-6xl` and the search input has no `bg-surface` class.

- [ ] **Step 3: Write minimal implementation**

Replace obsolete structural classes in `GuestHome` with the established dashboard tokens. The outer wrapper must include:

```tsx
className="page-enter mx-auto max-w-6xl space-y-10"
```

The search input must include `border border-border bg-surface px-4 py-3 text-sm`, and the submit button must include `bg-primary px-4 py-3 font-bold text-primary-foreground`.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm --prefix web test -- --run src/features/home/home.test.tsx`

Expected: PASS, including existing guest search navigation and animation assertions.

- [ ] **Step 5: Commit**

```text
git add web/src/features/home/GuestHome.tsx web/src/features/home/home.test.tsx
git commit -m "fix: style guest homepage hero"
```

### Task 2: Style public deal cards and states

**Files:**
- Modify: `web/src/features/home/PublicDeals.tsx`
- Test: `web/src/features/home/PublicDeals.test.tsx`

**Interfaces:**
- Consumes: `getHomepageDeals(country: string, limit: number): Promise<{ results: HomeDeal[] }>` unchanged.
- Produces: `PublicDeals({ initialCountry, limit })` with responsive card grid and readable loading, fallback, empty, and error states.

- [ ] **Step 1: Write the failing test**

Add assertions after rendering deals:

```tsx
expect(screen.getByTestId("public-deals").className).toContain("max-w-6xl");
expect(screen.getByRole("heading", { name: "Price drops" }).parentElement?.parentElement?.className).toContain("grid");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm --prefix web test -- --run src/features/home/PublicDeals.test.tsx`

Expected: FAIL because the section has obsolete `stack` classes and the cards use the undefined `game-grid` class.

- [ ] **Step 3: Write minimal implementation**

Use `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` for cards, `overflow-hidden rounded-2xl border border-border bg-surface` for each card, and `aspect-video w-full object-cover` for deal images. Give all state panels `rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground`; keep their current text, roles, and retry buttons unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm --prefix web test -- --run src/features/home/PublicDeals.test.tsx`

Expected: PASS, including region switching, USD fallback, retry, and image-fallback coverage.

- [ ] **Step 5: Commit**

```text
git add web/src/features/home/PublicDeals.tsx web/src/features/home/PublicDeals.test.tsx
git commit -m "fix: style public deal cards"
```

### Task 3: Verify production presentation

**Files:**
- Modify: none expected

**Interfaces:**
- Consumes: completed guest-home components.
- Produces: a verified build with no visual-regression test failures.

- [ ] **Step 1: Run focused feature verification**

Run: `rtk npm --prefix web test -- --run src/features/home/home.test.tsx src/features/home/PublicDeals.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run full web verification**

Run: `rtk npm --prefix web test; rtk npm --prefix web run lint; rtk npm --prefix web run build`

Expected: all tests and build PASS; lint has no errors.

- [ ] **Step 3: Inspect the final diff**

Run: `rtk git diff --check; rtk git status --short`

Expected: no whitespace errors and only guest-home design files plus their tests and plan/spec commits.

- [ ] **Step 4: Push and open a draft PR**

```text
git push -u origin codex/fix-guest-homepage-design
gh pr create --draft --base main --title "fix: restore guest homepage design"
```

Expected: a draft PR scoped to the visual repair.
