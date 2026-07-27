# Recommendation Covers and Favorite Heart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render recommendation cover art and replace the catalog Favorites text button with a toggleable heart.

**Architecture:** The dashboard already receives `cover_url`; route it to `GameCover`'s existing URL-aware `from` prop. Extend the existing catalog action component with a removal mutation and use one icon-only button whose accessible label represents its current action.

**Tech Stack:** React, TypeScript, TanStack Query, Vitest, Testing Library, Lucide React.

## Global Constraints

- Preserve the existing fallback card gradient when `cover_url` is absent.
- Keep Library and Wishlist actions unchanged.
- The heart must expose an accessible label and retain visible error handling.

---

### Task 1: Render recommendation cover URLs

**Files:**
- Modify: `web/src/routes/index.tsx:90-105`
- Modify: `web/src/test/live-data.routes.test.tsx:120-160`

**Consumes:** `RecommendationItem.cover_url?: string | null` and `GameCover` props `{ from: string; to: string; title: string }`.

**Produces:** Recommendation cards pass a URL through `from` and display an `<img>` when the URL is present.

- [ ] **Step 1: Write the failing test**

Add `cover_url: "https://cdn.example/balatro.jpg"` to the dashboard fixture and assert:

```tsx
expect(await screen.findByRole("img", { name: "Balatro" })).toHaveAttribute(
  "src",
  "https://cdn.example/balatro.jpg",
);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `rtk npm --prefix web test -- --run src/test/live-data.routes.test.tsx`

Expected: the image assertion fails because `src` is not a `GameCover` prop.

- [ ] **Step 3: Write the minimal implementation**

Replace the invalid card props with:

```tsx
<GameCover
  from={item.cover_url ?? "#334155"}
  to="#0f172a"
  title={item.title}
  className="aspect-[4/5] w-full"
/>
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `rtk npm --prefix web test -- --run src/test/live-data.routes.test.tsx`

Expected: all tests in the file pass.

- [ ] **Step 5: Commit**

Run:

```text
rtk git add web/src/routes/index.tsx web/src/test/live-data.routes.test.tsx
rtk git commit -m "fix: render recommendation cover images"
```

### Task 2: Toggle catalog favorites with a heart

**Files:**
- Modify: `web/src/components/CatalogGameActions.tsx:1-105`
- Modify: `web/src/test/catalog.routes.test.tsx:250-340`

**Consumes:** `saveCatalogGameToFavorites(rawgId)` and `removeFavorite(catalogGameId)` from `web/src/lib/api.ts`.

**Produces:** An icon-only Favorites control labelled `Add Hades II to favorites` or `Remove Hades II from favorites`, calling the matching mutation.

- [ ] **Step 1: Write failing tests**

Mock `removeFavorite` and add assertions for both states:

```tsx
fireEvent.click(await screen.findByRole("button", { name: /add hades ii to favorites/i }));
await waitFor(() => expect(api.saveCatalogGameToFavorites).toHaveBeenCalledWith(274755));

fireEvent.click(await screen.findByRole("button", { name: /remove hades ii from favorites/i }));
await waitFor(() => expect(api.removeFavorite).toHaveBeenCalledWith(274755));
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `rtk npm --prefix web test -- --run src/test/catalog.routes.test.tsx`

Expected: tests fail because the text button does not provide the heart labels and no removal mutation exists.

- [ ] **Step 3: Write the minimal implementation**

Import `Heart` and `removeFavorite`. Create a `removeFavoriteMutation` with the same `onSuccess: invalidateCollections` callback. Replace only the Favorites `<button>` with a square button that:

```tsx
onClick={() => (inFavorites ? removeFavoriteMutation.mutate() : favoriteMutation.mutate())}
aria-label={inFavorites ? `Remove ${game.name} from favorites` : `Add ${game.name} to favorites`}
disabled={favoriteMutation.isPending || removeFavoriteMutation.isPending}
```

Render `<Heart fill="currentColor" />` when favorited and `<Heart />` otherwise; add `removeFavoriteMutation.error` to the existing alert expression.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `rtk npm --prefix web test -- --run src/test/catalog.routes.test.tsx`

Expected: all catalog route tests pass, including add and remove behavior.

- [ ] **Step 5: Commit**

Run:

```text
rtk git add web/src/components/CatalogGameActions.tsx web/src/test/catalog.routes.test.tsx
rtk git commit -m "feat: toggle catalog favorites with heart"
```

### Task 3: Verify the integrated change

**Files:**
- Verify: `web/src/routes/index.tsx`
- Verify: `web/src/components/CatalogGameActions.tsx`

- [ ] **Step 1: Run frontend tests**

Run: `rtk npm --prefix web test -- --run`

Expected: all Vitest files pass.

- [ ] **Step 2: Build production frontend**

Run: `rtk npm --prefix web run build`

Expected: Vite and Nitro builds complete successfully.

- [ ] **Step 3: Check the patch**

Run: `rtk git diff --check origin/main...HEAD`

Expected: no whitespace errors.
