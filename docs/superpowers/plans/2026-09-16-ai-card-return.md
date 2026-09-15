# AI Card Return Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every AI recommendation explanation inside its card and return from its game page to the exact cached AI search.

**Architecture:** Add optional presentation and navigation fields to the reusable game card. The AI search route supplies the reason and a URL-encoded return target; the detail route reads that target only when it is a safe internal search URL, otherwise preserving `/search`.

**Tech Stack:** React, TypeScript, TanStack Router, Vitest, Testing Library, Tailwind CSS.

## Global Constraints

- AI recommendations must be restored from the existing React Query cache and never trigger a second recommendation request on return.
- Catalog and direct game navigation must retain their `/search` fallback.
- The recommendation reason is clamped to three lines inside its own card.

---

### Task 1: Extend the reusable game card

**Files:**
- Modify: `web/src/components/GameCard.tsx`
- Test: `web/src/components/GameCard.test.tsx`

**Interfaces:**
- Produces: optional `description?: string` and `search?: Record<string, string>` card fields for callers.

- [ ] **Step 1: Write the failing tests**

```tsx
render(<GameCard game={{ gameId: "1", title: "Hades", coverFrom: "#000", coverTo: "#111", description: "Matches your roguelike request" }} />);
expect(screen.getByText("Matches your roguelike request")).toHaveClass("line-clamp-3");
```

- [ ] **Step 2: Run the component test and verify it fails**

Run: `npm test -- GameCard.test.tsx`
Expected: the description is absent.

- [ ] **Step 3: Add minimal optional card fields and rendering**

```tsx
description?: string;
search?: Record<string, string>;
// render <p className="mt-2 line-clamp-3 ...">{game.description}</p> when present
// pass game.search to the internal Link search prop
```

- [ ] **Step 4: Run the component test and verify it passes**

Run: `npm test -- GameCard.test.tsx`
Expected: PASS.

### Task 2: Carry AI return context through the detail link

**Files:**
- Modify: `web/src/routes/search.tsx`
- Modify: `web/src/routes/-search.test.tsx`

**Interfaces:**
- Consumes: `GameCardData.description` and `GameCardData.search` from Task 1.
- Produces: `returnTo=/search?mode=ai&q=<prompt>` on every AI recommendation link.

- [ ] **Step 1: Write the failing route assertion**

```tsx
expect(screen.getByRole("link", { name: /Hades/i })).toHaveAttribute(
  "href",
  expect.stringContaining("returnTo=%2Fsearch%3Fmode%3Dai%26q%3Droguelike"),
);
```

- [ ] **Step 2: Run the search test and verify it fails**

Run: `npm test -- -search.test.tsx`
Expected: the recommendation link has no return target.

- [ ] **Step 3: Pass the recommendation reason and encoded search URL to `GameCard`**

```tsx
description: item.reason,
search: { title: game.name, returnTo: `/search?mode=ai&q=${encodeURIComponent(query.trim())}` },
```

- [ ] **Step 4: Remove the sibling reason paragraph and run the test**

Run: `npm test -- -search.test.tsx`
Expected: PASS without an extra reason paragraph below the card.

### Task 3: Use the return context on game detail pages

**Files:**
- Modify: `web/src/routes/games.$gameId.tsx`
- Test: `web/src/routes/games.$gameId.test.tsx`

**Interfaces:**
- Consumes: optional `returnTo` string from the game detail route search parameters.
- Produces: a safe search destination for both `Back to search` links.

- [ ] **Step 1: Write failing tests for AI and default back links**

```tsx
expect(screen.getByRole("link", { name: /Back to search/i })).toHaveAttribute(
  "href",
  "/search?mode=ai&q=roguelike",
);
```

- [ ] **Step 2: Run the detail test and verify it fails**

Run: `npm test -- 'games.$gameId.test.tsx'`
Expected: the link always points to `/search`.

- [ ] **Step 3: Parse and validate the return target**

```tsx
const returnTo = search.returnTo?.startsWith("/search?") ? search.returnTo : "/search";
<Link to={returnTo}>...</Link>
```

- [ ] **Step 4: Run targeted frontend tests and lint**

Run: `npm test -- GameCard.test.tsx -search.test.tsx 'games.$gameId.test.tsx'`
Expected: PASS.

Run: `npx eslint src/components/GameCard.tsx src/routes/search.tsx 'src/routes/games.$gameId.tsx'`
Expected: no issues.

- [ ] **Step 5: Commit implementation**

```bash
git add web/src/components/GameCard.tsx web/src/components/GameCard.test.tsx web/src/routes/search.tsx web/src/routes/-search.test.tsx 'web/src/routes/games.$gameId.tsx' 'web/src/routes/games.$gameId.test.tsx'
git commit -m "fix: keep AI card context on return"
```
