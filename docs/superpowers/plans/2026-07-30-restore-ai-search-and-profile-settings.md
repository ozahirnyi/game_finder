# Restore AI Search and Profile Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the AI search mode and make the profile Settings button edit profile data through the existing API.

**Architecture:** The search route owns a `catalog`/`ai` mode and calls the existing `POST /recommendations` endpoint only after explicit AI submission. A focused settings dialog owns editable profile fields and saves them with `PATCH /profile`; `ProfileView` only opens the dialog.

**Tech Stack:** React 19, TanStack Query/Router, Vitest, FastAPI.

## Global Constraints

- Keep normal catalog search behaviour unchanged.
- Do not use title matching to navigate AI recommendation results to a catalog game.
- Surface success and error feedback for user-triggered requests.

---

### Task 1: AI search client and route

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/routes/search.tsx`
- Create: `web/src/routes/search.test.tsx`

**Interfaces:**
- Consumes: `POST /recommendations` with `{ prompt, liked_game_ids: [] }`.
- Produces: `getRecommendations(prompt): Promise<{ recommendations: RecommendationItem[] }>`.

- [ ] **Step 1: Write the failing test**

```tsx
it("submits an AI prompt and displays returned recommendations", async () => {
  // mock getRecommendations, select AI search, submit prompt
  expect(await screen.findByText("Recommended title")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vitest run src/routes/search.test.tsx`
Expected: FAIL because no AI search control or API function exists.

- [ ] **Step 3: Write minimal implementation**

```ts
export function getRecommendations(prompt: string) {
  return apiRequest<RecommendationResponse>("/recommendations", {
    method: "POST", body: { prompt, liked_game_ids: [] },
  });
}
```

Add the AI mode selector, explicit submit button, loading/error state, and text recommendation cards to `search.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `vitest run src/routes/search.test.tsx`
Expected: PASS.

### Task 2: Profile settings dialog

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/components/ProfileView.tsx`
- Create: `web/src/components/ProfileView.test.tsx` additions

**Interfaces:**
- Consumes: `PATCH /profile` with `display_name`, `bio`, and visibility fields.
- Produces: Settings button opens a dialog, and Save persists values then invalidates `profile`.

- [ ] **Step 1: Write the failing test**

```tsx
it("opens profile settings from the Settings button", async () => {
  render(<ProfileView profile={profile} isSelf />);
  await userEvent.click(screen.getByRole("button", { name: /settings/i }));
  expect(screen.getByRole("dialog", { name: /profile settings/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vitest run src/components/ProfileView.test.tsx`
Expected: FAIL because the button has no click handler.

- [ ] **Step 3: Write minimal implementation**

```ts
export function updateProfile(data: ProfileUpdate) {
  return apiRequest<Profile>("/profile", { auth: true, method: "PATCH", body: data });
}
```

Add a controlled dialog in `ProfileView` with display name, bio, library visibility and explicit Save/Cancel feedback.

- [ ] **Step 4: Run test to verify it passes**

Run: `vitest run src/components/ProfileView.test.tsx`
Expected: PASS.

### Task 3: Verification and handoff

- [ ] **Step 1: Run focused frontend tests**

Run: `vitest run src/routes/search.test.tsx src/components/ProfileView.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run typecheck and production build**

Run: `tsc --noEmit && npm run build`
Expected: exit code 0.

- [ ] **Step 3: Commit**

Run: `git add web/src/lib/api.ts web/src/routes/search.tsx web/src/routes/search.test.tsx web/src/components/ProfileView.tsx web/src/components/ProfileView.test.tsx docs/superpowers/plans/2026-07-30-restore-ai-search-and-profile-settings.md && git commit -m "fix: restore AI search and profile settings"`
