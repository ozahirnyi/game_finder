# Selected Friend Preview and Message Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the selected-friend panel render truthful friend data and make the direct-message composer auto-size without manual resizing.

**Architecture:** Retain the real public user fields already returned by `friendsQueryOptions()` while building the Friends-page view model, and continue consuming the existing owner-scoped social-summary endpoint for counts. Keep composer sizing local to `ProfileView` by using the message textarea element’s measured scroll height; no API or backend change is needed.

**Tech Stack:** React, TypeScript, TanStack Query, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Use `origin/main` as the product source of truth and preserve user-generated `web/src/routeTree.gen.ts` and `web/.output`.
- Do not add backend routes, schemas, migrations, privacy behavior, a standalone chat page, or a full profile duplicate in Friends.
- Use the current `/friends` and `/friends/{id}/social-summary` contracts only.
- Do not fabricate user data: gradient avatar is fallback-only; failed summary values render `Unavailable`.
- Only the direct-message composer (`aria-label="Message text"`) gets automatic sizing; profile settings’ bio textarea remains unchanged.

---

## File Structure

- Modify `web/src/routes/friends.index.tsx`: retain each friend’s public avatar/bio/secondary identity and render the selected-friend panel from those fields plus its existing social summary.
- Modify `web/src/routes/-friends.index.test.tsx`: cover true selected-friend identity, summary loading/error presentation, and absence of fake handle duplication.
- Modify `web/src/components/ProfileView.tsx`: measure and cap the direct-message textarea’s height, remove manual resizing, and reset it through the existing close/send lifecycle.
- Modify `web/src/components/ProfileView.test.tsx`: verify sizing attributes/behavior without changing unrelated bio settings.

### Task 1: Render truthful selected-friend data

**Files:**
- Modify: `web/src/routes/friends.index.tsx:96-131, 515-577`
- Test: `web/src/routes/-friends.index.test.tsx`

**Consumes:** `Friend["user"]` fields from `friendsQueryOptions()` and `getFriendSocialSummary(friendId): Promise<FriendSocialSummary>`.

**Produces:** A selected-friend presentation object that keeps `avatar`, `bio`, and optional `steam_persona_name`; a compact panel showing public identity and exact summary states.

- [ ] **Step 1: Write failing route tests**

Make the existing friends mock return a second user with a real avatar, bio, and distinct Steam persona. Mock a summary success response and click that friend. Assert the selected panel’s image `src`, bio, secondary identity, compatibility, shared-game count, and wishlist count. Add a summary-error rendering case that expects `Unavailable` and does not find a zero substituted for the value.

```tsx
await user.click(screen.getByRole("button", { name: "Select Sam" }));
expect(screen.getByRole("img", { name: "Sam" })).toHaveAttribute("src", "https://cdn.example/sam.png");
expect(screen.getByText("Collects co-op games")).toBeInTheDocument();
expect(screen.getByText("SamOnSteam")).toBeInTheDocument();
expect(screen.getByText("3")).toBeInTheDocument();
```

- [ ] **Step 2: Run the route suite to verify failure**

Run: `rtk npm.cmd --prefix web test -- --run src/routes/-friends.index.test.tsx`

Expected: FAIL because `friends` currently maps avatar to a fixed gradient, discards bio and Steam persona, and repeats display name as the handle.

- [ ] **Step 3: Implement the smallest truthful view model and panel**

Preserve each supplied public field when deriving `friends`. Use `image={selectedFriend.avatar ?? undefined}` for the selected avatar. Render bio conditionally. Render `steam_persona_name` only when it exists and differs from the displayed name; otherwise omit the secondary identity. Render `Unavailable` only once `selectedSummaryQuery.isError`; retain `…` while pending and use exact numeric values, including zero, after success.

```tsx
const friends = (friendsQuery.data ?? []).map(({ user }) => ({
  id: user.id,
  name: friendDisplayName(user),
  steamPersonaName: user.steam_persona_name ?? null,
  bio: user.bio ?? null,
  avatarUrl: user.avatar ?? null,
  avatarFrom: "#7c3aed",
  avatarTo: "#111827",
}));

const summaryValue = (value: number | null | undefined) =>
  selectedSummaryQuery.isError ? "Unavailable" : selectedSummaryQuery.data ? (value ?? "Private") : "…";
```

- [ ] **Step 4: Run the focused route suite to verify pass**

Run: `rtk npm.cmd --prefix web test -- --run src/routes/-friends.index.test.tsx`

Expected: PASS with the existing route assertions plus the truthful selected-friend and unavailable-summary cases.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/routes/friends.index.tsx web/src/routes/-friends.index.test.tsx
rtk git commit -m "fix: show real selected friend data"
```

### Task 2: Auto-size the direct-message composer

**Files:**
- Modify: `web/src/components/ProfileView.tsx:78-85, 331-338`
- Test: `web/src/components/ProfileView.test.tsx`

**Consumes:** Existing controlled `messageBody`, message-dialog lifecycle, and `sendMessage` success reset.

**Produces:** A non-resizable `Message text` textarea that grows to a maximum of 240 px then scrolls internally.

- [ ] **Step 1: Write failing component tests**

Render a friend profile, open the message dialog, and assert the composer has `resize-none`, `overflow-y-auto`, and the auto-sizing input handler. Stub `scrollHeight` to a value above the 240 px cap, type text, and assert the inline height is `240px`. Close and reopen the composer, then assert it is reconstructed without the capped inline height.

```tsx
Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", { configurable: true, value: 480 });
await user.type(screen.getByLabelText("Message text"), "A longer message");
expect(screen.getByLabelText("Message text")).toHaveStyle({ height: "240px" });
```

- [ ] **Step 2: Run the component suite to verify failure**

Run: `rtk npm.cmd --prefix web test -- --run src/components/ProfileView.test.tsx`

Expected: FAIL because the textarea currently has browser-default resize behavior and does not set a content-driven height.

- [ ] **Step 3: Implement local composer resizing**

Add a `useRef<HTMLTextAreaElement>(null)` for the direct-message textarea and a helper that resets `style.height` to `auto`, then sets it to `Math.min(element.scrollHeight, 240) + "px"`. Invoke it after `setMessageBody` via the message input handler. Add `resize-none overflow-y-auto` to the direct-message textarea’s classes, set `ref`, and reset its inline height in the existing successful-send and close-dialog paths. Do not attach the helper to profile settings’ bio textarea.

```tsx
const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
const resizeMessageTextarea = () => {
  const textarea = messageTextareaRef.current;
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
};
```

- [ ] **Step 4: Run focused component suites to verify pass**

Run: `rtk npm.cmd --prefix web test -- --run src/components/ProfileView.test.tsx src/routes/-friends.index.test.tsx`

Expected: PASS; no ProfileView behavior outside the message composer regresses.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/components/ProfileView.tsx web/src/components/ProfileView.test.tsx
rtk git commit -m "fix: auto-size message composer"
```

### Task 3: Verify the integrated slice

**Files:**
- Modify only source or test files required by a failing verification; never stage generated route trees or build output.

**Consumes:** Tasks 1 and 2.

**Produces:** Release evidence for the focused frontend behavior.

- [ ] **Step 1: Run all affected frontend tests**

Run: `rtk npm.cmd --prefix web test -- --run src/routes/-friends.index.test.tsx src/components/ProfileView.test.tsx src/components/FriendConversationHistory.test.tsx`

Expected: PASS with no failed test in the three changed-feature suites.

- [ ] **Step 2: Run static and production checks**

Run: `rtk npm.cmd --prefix web run lint`

Expected: exit 0; report existing warnings separately.

Run: `rtk npm.cmd --prefix web run build`

Expected: exit 0; do not stage generated output.

- [ ] **Step 3: Manually smoke the two corrected interactions**

1. Open Friends and select a friend with an avatar/bio; verify the side panel shows the same truthful identity and shared-game count as the API-backed profile summary.
2. Open Message, type enough text to grow the field, confirm there is no drag-resize control, and verify it scrolls only after its maximum height.
3. Close the composer and reopen it; verify the empty textarea returns to its initial height.

- [ ] **Step 4: Commit verification-only adjustment if required**

If and only if a failed check requires a source or test correction, stage only the affected source/test files and commit with a focused `fix:` message. Leave `web/src/routeTree.gen.ts` and `web/.output` unstaged.
