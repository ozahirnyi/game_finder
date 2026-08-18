# Restore Canonical Public-Profile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/users/<publicId>` use the established PlayFinder profile presentation while preserving the existing public-profile data and visibility rules.

**Architecture:** Keep the route and backend contract unchanged. Refactor only `PublicProfileView` so it composes existing `Avatar`, `Panel`, `SectionHeader`, `EmptyState`, and `GameCover` primitives into a compact profile layout. The component continues to consume `PublicProfile` blocks; it must branch on `status` before rendering any block data.

**Tech Stack:** React, TypeScript, TanStack Query, TanStack Router, Vitest, Testing Library, Tailwind utility classes.

## Global Constraints

- Keep `/users/<publicId>` as the canonical profile URL; do not add a route.
- Do not change FastAPI endpoints, schemas, or visibility semantics.
- A hidden block may render only generic privacy copy; it must not render `data`, counts, cover URLs, Steam persona names, Steam avatars, or Steam links.
- Use only existing real data and existing shared UI components; do not add mock data.
- Preserve role actions: anonymous has none; `relationship === "none"` gets Add friend only when authenticated; `relationship === "self"` gets the account-settings link.
- Each code change begins with a focused Vitest RED run, followed by the smallest implementation and a GREEN run.

---

### Task 1: Specify the restored public-profile visual contract

**Files:**
- Modify: `web/src/components/PublicProfileView.test.tsx`

**Interfaces:**
- Consumes: `PublicProfileView({ profile: PublicProfile; isAuthenticated: boolean })`.
- Produces: executable regression coverage for identity header, compact states, collection presentation, and role actions.

- [ ] **Step 1: Add failing tests for the restored layout**

Add a reusable `profile()` factory and these tests to `web/src/components/PublicProfileView.test.tsx`:

```tsx
it("shows the player's identity and a compact empty collection card", () => {
  renderPublicProfile({
    nickname: "Kinder",
    library: { status: "empty", data: [], message: "No library games have been saved yet." },
  });

  expect(screen.getByRole("heading", { name: "Kinder" })).toBeInTheDocument();
  expect(screen.getByTestId("public-profile-library")).toHaveClass("p-6");
  expect(screen.getByText("No library games have been saved yet.")).toBeInTheDocument();
});

it("renders an authorized collection game as an internal game link", () => {
  renderPublicProfile({
    favorites: {
      status: "ready",
      data: [{ catalog_game_id: 42, title: "Hades II" }],
      message: null,
    },
  });

  expect(screen.getByRole("link", { name: /hades ii/i })).toHaveAttribute(
    "href",
    "/games/42?title=Hades+II",
  );
});

it("does not render private block data", () => {
  renderPublicProfile({
    steam: { status: "hidden", data: { linked: true, persona_name: "Private Steam" }, message: null },
  });

  expect(screen.getByText("This section is private.")).toBeInTheDocument();
  expect(screen.queryByText("Private Steam")).not.toBeInTheDocument();
});
```

Also retain the existing friend-request test and add tests asserting that an anonymous viewer has no Add friend button and a self profile exposes the `Profile settings` link.

- [ ] **Step 2: Run the focused test file and verify RED**

Run: `rtk npm --prefix web test -- PublicProfileView.test.tsx`

Expected: FAIL because the current component lacks `data-testid="public-profile-library"` and does not turn collection entries into internal game links.

- [ ] **Step 3: Commit the RED test contract**

```powershell
rtk git add web/src/components/PublicProfileView.test.tsx
rtk git commit -m "test: specify canonical public profile layout"
```

### Task 2: Restore the profile composition without changing privacy behavior

**Files:**
- Modify: `web/src/components/PublicProfileView.tsx`
- Test: `web/src/components/PublicProfileView.test.tsx`

**Interfaces:**
- Consumes: `PublicProfile`, `PublicDataBlock<T>`, `createSocialFriendRequest(publicId: string)`.
- Produces: `PublicProfileView` with semantic identity header, compact state cards, authorized internal game links, and unchanged role actions.

- [ ] **Step 1: Keep the Task 1 suite red before production edits**

Run: `rtk npm --prefix web test -- PublicProfileView.test.tsx`

Expected: the Task 1 layout assertions still fail against the current bare markup.

- [ ] **Step 2: Implement the smallest shared collection section**

In `PublicProfileView.tsx`, replace the current `Section` helper with a component that always renders an existing `Panel` and has this branch order:

```tsx
function PublicCollectionSection<T>({ title, block, children }: {
  title: string;
  block: PublicDataBlock<T>;
  children: (data: T) => ReactNode;
}) {
  return (
    <Panel className="p-6" data-testid={`public-profile-${title.toLowerCase()}`}>
      <SectionHeader title={title} />
      {block.status === "hidden" ? (
        <EmptyState title={title} description="This section is private." />
      ) : block.status === "empty" ? (
        <EmptyState title={title} description={block.message ?? "Nothing to show yet."} />
      ) : children(block.data)}
    </Panel>
  );
}
```

Use `Avatar` and a `Panel` header for `profile.nickname`. For ready favorites and wishlist entries, use TanStack `Link` to `/games/$gameId` with `params={{ gameId: String(game.catalog_game_id) }}` and `search={{ title: game.title }}`. For ready library entries, link only when `detail_game_id` is present; otherwise render the title as non-link text. Steam may use a styled `Panel`, but only read `steam.data` in the `ready` branch. Keep the mutation, disabled state, error alert, and the two relationship conditions unchanged; render buttons using the project’s existing rounded primary-button classes.

- [ ] **Step 3: Run the focused suite and verify GREEN**

Run: `rtk npm --prefix web test -- PublicProfileView.test.tsx`

Expected: PASS, including existing eligibility and no-leak tests plus the new layout assertions.

- [ ] **Step 4: Commit the implementation**

```powershell
rtk git add web/src/components/PublicProfileView.tsx web/src/components/PublicProfileView.test.tsx
rtk git commit -m "fix: restore canonical public profile layout"
```

### Task 3: Verify canonical routing and complete the release checks

**Files:**
- Test: `web/src/routes/-users.$publicId.test.tsx` (existing route contract; no edit expected)
- Verify: repository test and build commands; do not commit generated `web/.output` or `web/src/routeTree.gen.ts` unless route generation itself changes it.

**Interfaces:**
- Consumes: existing `/users/$publicId` route and `getPublicProfile(publicId)` API function.
- Produces: evidence that the canonical route remains unchanged and all checks pass.

- [ ] **Step 1: Confirm the existing route test still proves the canonical contract**

`web/src/routes/-users.$publicId.test.tsx` already asserts both:

```tsx
expect(await screen.findByRole("heading", { name: "Owner" })).toBeInTheDocument();
expect(api.getPublicProfile).toHaveBeenCalledWith("owner");
```

Do not add a duplicate route assertion unless the implementation changes the route contract.

- [ ] **Step 2: Run the focused route and component tests**

Run: `rtk npm --prefix web test -- PublicProfileView.test.tsx "-users.$publicId.test.tsx"`

Expected: PASS. If no route test exists, do not create a second route implementation; add the assertion to the existing public-profile route test file discovered in the repository.

- [ ] **Step 3: Run release verification**

Run these commands separately:

```powershell
rtk pytest -q
rtk npm --prefix web test
rtk npm --prefix web run lint
rtk npm --prefix web run build
rtk git diff --check origin/main...HEAD
rtk git status --short
```

Expected: backend and web suites pass; lint has no errors; production build exits successfully; whitespace check is empty; generated output remains untracked/ignored and unstaged.

- [ ] **Step 4: Inspect the release diff before opening a draft PR**

Run: `rtk git diff --stat origin/main...HEAD`

Expected: only `PublicProfileView.tsx`, its focused test, and this branch's
approved design/plan documents appear. Do not stage generated output.
