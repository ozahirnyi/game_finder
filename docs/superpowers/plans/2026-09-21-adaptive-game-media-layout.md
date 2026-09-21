# Adaptive Game Media Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve genuine hero banners, render portrait-only games as compact cover cards, remove gradient fallbacks, and shrink Shared Games cards.

**Architecture:** `GameCover` owns image-error progression and uses a neutral fallback surface. `GameCard` chooses a hero treatment only when it receives `heroUrl`; otherwise it uses a compact portrait-card treatment. Routes continue to pass their independent hero and cover URLs, while the profile only adjusts its existing shared-game grid dimensions.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, TanStack Router, Vitest and Testing Library.

## Global Constraints

- A portrait cover must never be placed in a synthetic wide banner.
- The final missing/broken-media fallback must contain no gradient.
- Preserve links, price metadata, keyboard focus and Invite payloads.
- Do not make live image or provider requests in tests.

---

### Task 1: Make the final media fallback neutral

**Files:**
- Modify: `web/src/components/GameCover.tsx:3-110`
- Modify: `web/src/components/GameCover.test.tsx:1-100`

**Interfaces:**
- Consumes: existing `image`, `fallbackImage`, `portraitImage`, `variant` and title props.
- Produces: a final no-image state with `bg-surface-2`, a border ring and title/initials, but no `linear-gradient` or `radial-gradient` inline background.

- [ ] **Step 1: Write the failing final-fallback test**

```tsx
it("uses a neutral surface after every image source fails", () => {
  const { container } = render(
    <GameCover from="#111" to="#222" title="Missing" image="https://images.test/primary.jpg"
      fallbackImage="https://images.test/fallback.jpg" />,
  );

  fireEvent.error(screen.getByRole("img", { name: "Missing" }));
  fireEvent.error(screen.getByRole("img", { name: "Missing" }));

  expect(container.firstElementChild).toHaveClass("bg-surface-2");
  expect(container.firstElementChild?.getAttribute("style")).toBeNull();
  expect(screen.getByText("Missing")).toBeVisible();
});
```

- [ ] **Step 2: Verify the test fails**

Run: `rtk npm.cmd --prefix web test -- src/components/GameCover.test.tsx`

Expected: FAIL because the component retains an inline radial/linear gradient after both URLs fail.

- [ ] **Step 3: Implement the neutral state**

```tsx
const hasRenderableMedia = showImage || showPortrait;

<div
  className={`grain relative overflow-hidden ${hasRenderableMedia ? "" : "bg-surface-2"} ${className}`}
  style={hasRenderableMedia ? { background: mediaBackground } : undefined}
>
```

Keep the existing error order: primary image, alternate image, portrait composition if applicable, then neutral title fallback. Remove the radial overlay when `hasRenderableMedia` is false.

- [ ] **Step 4: Verify the test passes**

Run: `rtk npm.cmd --prefix web test -- src/components/GameCover.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/components/GameCover.tsx web/src/components/GameCover.test.tsx
rtk git commit -m "fix: use neutral fallback for missing game media"
```

### Task 2: Select compact covers when no hero exists

**Files:**
- Modify: `web/src/components/GameCard.tsx:6-62`
- Modify: `web/src/components/GameCard.test.tsx:1-95`
- Modify: `web/src/routes/index.tsx:274-282,346-357,398-490`
- Modify: `web/src/routes/search.tsx:323-332,370-380`
- Modify: `web/src/routes/deals.tsx:45-62`
- Modify: `web/src/routes/games.$gameId.tsx:425-436`

**Interfaces:**
- Consumes: existing `GameCardData.heroUrl`, `heroFallbackUrl` and `coverUrl`.
- Produces: `heroUrl` items use `variant="hero"` and wide aspect; cover-only items use `variant="card"`, `image={coverUrl}`, and `aspect-[2/3]` with no portrait-in-hero composition.

- [ ] **Step 1: Write failing card tests**

```tsx
it("uses a compact portrait card when a game has no hero artwork", () => {
  const { container } = render(<GameCard game={{ title: "Cover Only", coverUrl: "https://images.test/cover.jpg", coverFrom: "#111", coverTo: "#222" }} />);

  expect(container.querySelector('[data-visual-role="card"]')).toBeInTheDocument();
  expect(container.querySelector(".aspect-\\[2\\/3\\]")) .toBeInTheDocument();
});

it("keeps the wide hero treatment when artwork is available", () => {
  const { container } = render(<GameCard game={{ title: "Hero", heroUrl: "https://images.test/hero.jpg", coverUrl: "https://images.test/cover.jpg", coverFrom: "#111", coverTo: "#222" }} />);

  expect(container.querySelector('[data-visual-role="hero"]')).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `rtk npm.cmd --prefix web test -- src/components/GameCard.test.tsx`

Expected: FAIL because every `GameCard` currently forces `variant="hero"`.

- [ ] **Step 3: Add a media-driven card treatment**

```tsx
const hasHero = Boolean(game.heroUrl);
const image = hasHero ? game.heroUrl : game.coverUrl;

<GameCover
  variant={hasHero ? "hero" : "card"}
  image={image}
  fallbackImage={hasHero ? game.heroFallbackUrl : undefined}
  className={`${hasHero ? aspect : "aspect-[2/3]"} w-full ...`}
/>
```

Update wide direct `GameCover` consumers in the listed routes with the same rule: a `hero_image` keeps their wide surface; a cover-only item uses a normal compact cover card rather than `portraitImage` inside a hero. On the game detail page, use the hero only when present; otherwise place the cover in a compact fixed-width panel beside the detail metadata.

- [ ] **Step 4: Verify the focused routes pass**

Run: `rtk proxy powershell -NoProfile -Command "Set-Location 'web'; npm.cmd test -- src/components/GameCard.test.tsx src/routes/-index.recommendations.test.tsx src/routes/-search.test.tsx 'src/routes/-games.`$gameId.test.ts'"`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/components/GameCard.tsx web/src/components/GameCard.test.tsx web/src/routes/index.tsx web/src/routes/search.tsx web/src/routes/deals.tsx web/src/routes/games.`$gameId.tsx web/src/routes/-games.`$gameId.test.ts
rtk git commit -m "fix: adapt game cards to available artwork"
```

### Task 3: Make Shared Games denser

**Files:**
- Modify: `web/src/components/ProfileView.tsx:585-638`
- Modify: `web/src/components/ProfileView.test.tsx:400-475`

**Interfaces:**
- Consumes: existing `SharedGame` records and `Invite <title>` handler.
- Produces: the same cover, title, source and Invite action in a denser grid with `grid-cols-3 sm:grid-cols-4 lg:grid-cols-6` and smaller 2:3 cover cards.

- [ ] **Step 1: Write the failing layout test**

```tsx
it("uses a compact six-column shared-games grid on large screens", () => {
  renderProfileWithSharedLibrary({ status: "ready", data: [sharedPortal] });

  expect(screen.getByTestId("shared-games-grid")).toHaveClass("lg:grid-cols-6");
});
```

- [ ] **Step 2: Verify the test fails**

Run: `rtk npm.cmd --prefix web test -- src/components/ProfileView.test.tsx`

Expected: FAIL because the grid is currently limited to four large columns and has no shared-games test id.

- [ ] **Step 3: Reduce the grid and card density**

```tsx
<div data-testid="shared-games-grid" className="stagger grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
  <GameCover className="aspect-[2/3] w-full" /* existing props */ />
  <div className="p-2.5">{/* title, source, existing Invite button */}</div>
</div>
```

Keep the title truncation, source label and exact `Invite ${game.title}` accessible name unchanged.

- [ ] **Step 4: Verify tests pass**

Run: `rtk npm.cmd --prefix web test -- src/components/ProfileView.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/components/ProfileView.tsx web/src/components/ProfileView.test.tsx
rtk git commit -m "style: compact shared game cards"
```

### Task 4: Verify the release candidate

**Files:**
- Verify only.

- [ ] **Step 1: Run affected frontend tests**

Run: `rtk proxy powershell -NoProfile -Command "Set-Location 'web'; npm.cmd test -- src/components/GameCover.test.tsx src/components/GameCard.test.tsx src/components/ProfileView.test.tsx src/routes/-index.recommendations.test.tsx src/routes/-search.test.tsx 'src/routes/-games.`$gameId.test.ts'"`

Expected: PASS.

- [ ] **Step 2: Run full frontend suite and build**

Run: `rtk npm.cmd --prefix web test`

Expected: PASS.

Run: `rtk npm.cmd --prefix web run build`

Expected: exit code 0.

- [ ] **Step 3: Inspect final change set**

Run: `rtk git diff --check origin/main...HEAD`

Expected: no output and exit code 0.
