# Friends Conversation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Friends and friend profiles provide a coherent, owner-scoped conversation and game-invite workflow.

**Architecture:** Keep the active FastAPI contracts unchanged. Add one reusable frontend history component that derives a friend-specific timeline from the existing conversations, messages, and game-invites endpoints; mount it in Friends and friend profiles. Make selection in Friends explicit and keep navigation to the profile explicit.

**Tech Stack:** React, TypeScript, Vite, TanStack Router, TanStack Query, Vitest, Testing Library.

## Global Constraints

- Use `origin/main` as the source of truth and preserve user-generated `web/src/routeTree.gen.ts` and `web/.output`.
- Do not add backend routes, models, migrations, global notification UI, or a standalone chat route.
- Use existing `getConversations`, `getConversationMessages`, `getGameInvites`, `createMessage`, and `respondToGameInvite` APIs only.
- Preserve API owner scoping; unavailable records render controlled empty/unavailable UI and never optimistic data.
- Every behaviour change has focused Vitest coverage.

---

## File Structure

- Create `web/src/components/FriendConversationHistory.tsx`: query and render one friend’s merged message/invite history.
- Create `web/src/components/FriendConversationHistory.test.tsx`: focused history, empty-state, and status coverage.
- Modify `web/src/routes/friends.index.tsx`: selectable friend cards, explicit profile link, shared history, and specific invite-response feedback.
- Modify `web/src/routes/-friends.index.test.tsx`: selection, profile-link, and invite-response assertions.
- Modify `web/src/components/ProfileView.tsx`: mount shared history for a non-self friend and refresh its queries after sends.
- Modify `web/src/components/ProfileView.test.tsx`: prove profile history and post-send refresh behavior.

## Interfaces

```ts
type FriendConversationHistoryProps = {
  friendId: string;
  title?: string;
};

getConversations(): Promise<Conversation[]>;
getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;
getGameInvites("all"): Promise<GameInvite[]>;
```

The component filters a conversation by `conversation.participant.id === friendId` and invitations by sender/recipient id. It renders every resulting event ordered by `created_at`, with an explicit invitation status label.

### Task 1: Add reusable friend history

**Files:**
- Create: `web/src/components/FriendConversationHistory.tsx`
- Test: `web/src/components/FriendConversationHistory.test.tsx`

**Consumes:** existing API functions above and `EmptyState`, `SectionHeader` from `ui-bits`.

**Produces:** `FriendConversationHistory({ friendId, title? })`, usable from both Friends and `ProfileView` without receiving records from either parent.

- [ ] **Step 1: Write the failing component tests**

Mock `@/lib/api` to return one conversation with `participant.id: "friend-1"`, one message, and two invitations (one matching, one for another friend). Assert the matching message, game name, and `Accepted`/`Declined` status are shown; assert the unrelated invitation is absent. Add a no-record case that expects `No messages yet`.

```tsx
render(<FriendConversationHistory friendId="friend-1" />);
expect(await screen.findByText("Ready tonight?")).toBeInTheDocument();
expect(screen.getByText("Game invitation: Portal 2 · Accepted")).toBeInTheDocument();
expect(screen.queryByText("Unrelated game")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify failure**

Run: `rtk npm.cmd --prefix web test -- --run src/components/FriendConversationHistory.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the minimal history component**

Use a `useQuery` for `getConversations`, a dependent messages query enabled only when the matching conversation exists, and a `useQuery` for `getGameInvites("all")`. Build typed event records and sort them newest/oldest consistently before rendering.

```tsx
const conversation = conversationsQuery.data?.find((item) => item.participant.id === friendId);
const invites = (invitesQuery.data ?? []).filter(
  (invite) => invite.sender.id === friendId || invite.recipient.id === friendId,
);
const events = [
  ...(messagesQuery.data ?? []).map((message) => ({ kind: "message" as const, message })),
  ...invites.map((invite) => ({ kind: "invite" as const, invite })),
].sort((left, right) => eventCreatedAt(right) - eventCreatedAt(left));
```

For an invitation use `invite.status` verbatim in the accessible text after capitalizing it; render the empty state only after all enabled queries settle.

- [ ] **Step 4: Run focused tests to verify pass**

Run: `rtk npm.cmd --prefix web test -- --run src/components/FriendConversationHistory.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/components/FriendConversationHistory.tsx web/src/components/FriendConversationHistory.test.tsx
rtk git commit -m "feat: add friend conversation history"
```

### Task 2: Make Friends selection explicit and invitation outcomes clear

**Files:**
- Modify: `web/src/routes/friends.index.tsx:122-141, 454-507, 583-617`
- Modify: `web/src/routes/-friends.index.test.tsx`

**Consumes:** `FriendConversationHistory`, existing `selectedFriendId`, `respondToGameInvite`, and TanStack navigation.

**Produces:** click-to-select friend cards, a `View profile` link, and accurate accept/decline feedback.

- [ ] **Step 1: Write failing route tests**

Add tests that click a friend card and expect that friend’s history to replace the initially selected friend, then assert `View profile` links to `/friends/<friendId>`. Add an invitation test that clicks `Accept Portal 2` and expects `You accepted the invitation to Portal 2.` after mocked success.

```tsx
await user.click(screen.getByRole("button", { name: /Sam/i }));
expect(await screen.findByText("Sam's message")).toBeInTheDocument();
expect(screen.getByRole("link", { name: "View Sam's profile" })).toHaveAttribute("href", "/friends/player-1");
```

- [ ] **Step 2: Run tests to verify failure**

Run: `rtk npm.cmd --prefix web test -- --run src/routes/-friends.index.test.tsx`

Expected: FAIL because the friend card remains a profile link and feedback is generic.

- [ ] **Step 3: Implement selection and response feedback**

Replace only the outer PlayFinder friend-card `Link` with a semantic `button` that calls `setSelectedFriendId(f.id)`. Place a separate profile `Link` beside the existing actions; do not nest a link inside a button. Replace the inline selected-invite/message rendering with the shared component.

```tsx
<button type="button" onClick={() => setSelectedFriendId(f.id)} aria-pressed={selectedId === f.id}>
  {/* existing avatar/name presentation */}
</button>
<Link to="/friends/$friendId" params={{ friendId: f.id }} aria-label={`View ${f.name}'s profile`}>
  View profile
</Link>
```

Capture mutation variables in `onSuccess` and set exact copy:

```tsx
onSuccess: (invite, variables) => {
  queryClient.invalidateQueries({ queryKey: ["game-invites"] });
  queryClient.invalidateQueries({ queryKey: ["notifications"] });
  setStatus(
    variables.status === "accepted"
      ? `You accepted the invitation to ${invite.game_name}.`
      : `You declined the invitation to ${invite.game_name}.`,
  );
}
```

- [ ] **Step 4: Run focused tests to verify pass**

Run: `rtk npm.cmd --prefix web test -- --run src/routes/-friends.index.test.tsx src/components/FriendConversationHistory.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/routes/friends.index.tsx web/src/routes/-friends.index.test.tsx
rtk git commit -m "fix: make friends conversations selectable"
```

### Task 3: Surface conversation history and refresh it on friend profiles

**Files:**
- Modify: `web/src/components/ProfileView.tsx:3-16, 107-135, 445-524`
- Modify: `web/src/components/ProfileView.test.tsx`

**Consumes:** `FriendConversationHistory`, `profile.friendId`, existing send mutations and TanStack Query client.

**Produces:** a profile history section and query invalidation after successful message/invite sends.

- [ ] **Step 1: Write failing profile tests**

Mock the three history API calls and render a non-self profile. Assert history is visible below profile actions. Submit a message and assert the conversation-messages mock is requested again (or the newly returned message is visible after invalidation). Submit an invite and assert its pending status is visible after the invite query refreshes.

```tsx
expect(await screen.findByText("Earlier message")).toBeInTheDocument();
await user.type(screen.getByLabelText("Message text"), "New message");
await user.click(screen.getByRole("button", { name: "Send" }));
await waitFor(() => expect(getConversationMessages).toHaveBeenCalledTimes(2));
```

- [ ] **Step 2: Run tests to verify failure**

Run: `rtk npm.cmd --prefix web test -- --run src/components/ProfileView.test.tsx`

Expected: FAIL because a friend profile has no history section and successful mutations do not invalidate its history keys.

- [ ] **Step 3: Mount history and invalidate exact query keys**

Import and render the shared component only when `!isSelf && profile.friendId`. On successful send operations retain current dialog-reset behavior and add the same query keys used by the component.

```tsx
onSuccess: () => {
  setMessageBody("");
  setMessageOpen(false);
  queryClient.invalidateQueries({ queryKey: ["conversations"] });
  queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
}

{!isSelf && profile.friendId ? <FriendConversationHistory friendId={profile.friendId} title="Messages" /> : null}
```

For `sendInvite`, also invalidate `["game-invites"]`. Preserve failed-mutation copy and do not add an optimistic event.

- [ ] **Step 4: Run focused tests to verify pass**

Run: `rtk npm.cmd --prefix web test -- --run src/components/ProfileView.test.tsx src/components/FriendConversationHistory.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/components/ProfileView.tsx web/src/components/ProfileView.test.tsx
rtk git commit -m "fix: show conversation history on friend profiles"
```

### Task 4: Verify the integrated user path

**Files:**
- Modify only if a verification failure requires a source or test correction; never stage `web/src/routeTree.gen.ts` or generated build output.

**Consumes:** Tasks 1–3.

**Produces:** evidence that the release preserves the active frontend and owner-scoped backend behavior.

- [ ] **Step 1: Run focused frontend suites**

Run: `rtk npm.cmd --prefix web test -- --run src/components/FriendConversationHistory.test.tsx src/components/ProfileView.test.tsx src/routes/-friends.index.test.tsx`

Expected: PASS with no failed tests.

- [ ] **Step 2: Run static and build checks**

Run: `rtk npm.cmd --prefix web run lint`

Expected: exit 0; record existing warnings separately if any.

Run: `rtk npm.cmd --prefix web run build`

Expected: exit 0; leave generated output unstaged.

- [ ] **Step 3: Browser smoke with two accounts**

1. As account A, open Friends, select account B, and verify B’s history.
2. Use **View profile** and verify the same history appears on B’s profile.
3. Send A→B a message; verify it appears after refresh for both accounts.
4. Send A→B a game invite, accept it as B, and verify both histories show the accepted invite and B receives a specific acceptance confirmation.
5. Remove the friendship or use a missing target and verify a controlled empty or unavailable state without other-account data.

- [ ] **Step 4: Commit final verification-only adjustments, if any**

Only commit source or test corrections needed by failed verification. Do not commit generated route trees or build artifacts.
