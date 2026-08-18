# Universal User Profile Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every existing Friends-surface representation of a user open the same canonical `/users/<public_id>` profile while preserving viewer-specific privacy and actions.

**Architecture:** Add the stable `public_id` to the legacy user DTO used by Friends, conversations, requests, and invitations. Mirror that contract in the API client, then use one small `UserProfileLink` wrapper wherever the UI renders a real social user identity. The public-profile endpoint remains the single authority for anonymous, stranger, friend, and owner behavior.

**Tech Stack:** FastAPI/Pydantic/SQLAlchemy, React, TanStack Router and Query, Vitest, pytest.

## Global Constraints

- Use `/users/<public_id>` as the only profile URL; never construct a URL from a nickname or internal UUID.
- Never add an `id`-to-`public_id` lookup request.
- Preserve privacy enforcement in `GET /users/{public_id}` and do not expose Steam IDs or hidden collection data.
- Limit UI changes to existing Friends search, friends, requests, conversations, and game invites.
- Mock external providers in tests; make no live API calls.

---

### Task 1: Preserve public identity in existing social contracts

**Files:**
- Modify: `app/schemas.py:471-477`
- Modify: `app/main.py:191-198`
- Test: `tests/integration/backend/test_main_remaining_edges_api.py`

**Interfaces:**
- Produces `PublicUserRead(public_id: str, id: UUID, display_name: str, ...)`.
- Produces `public_user_response(user)` with `public_id=user.public_id` for friends, requests, conversations, search results, and game invites that already call this helper.

- [ ] **Step 1: Write the failing backend contract test**

```python
def test_social_user_payloads_expose_only_stable_public_profile_identity(api_client, auth_as, user_factory):
    owner = user_factory(email="owner@example.com", public_id="owner-public")
    viewer = user_factory(email="viewer@example.com", public_id="viewer-public")
    # Create the existing friendship/request/invite fixture through the app helpers.
    auth_as(viewer)

    response = api_client.get("/friends")

    assert response.status_code == 200
    assert response.json()[0]["user"]["public_id"] == "owner-public"
    assert "steam_id" not in response.json()[0]["user"]
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `rtk pytest -q tests/integration/backend/test_main_remaining_edges_api.py -k public_profile_identity`

Expected: FAIL because `user.public_id` is absent from a `PublicUserRead` response.

- [ ] **Step 3: Add the stable identity to the shared DTO and response helper**

```python
class PublicUserRead(BaseModel):
    id: uuid.UUID
    public_id: str
    display_name: str
    steam_persona_name: str | None = None
    bio: str | None = None
    avatar: str | None = None

def public_user_response(user: User) -> PublicUserRead:
    return PublicUserRead(
        id=user.id,
        public_id=user.public_id,
        display_name=getattr(user, "display_name", None) or user.email.split("@", 1)[0],
        steam_persona_name=getattr(user, "steam_persona_name", None),
        bio=getattr(user, "bio", None),
        avatar=getattr(user, "steam_avatar", None),
    )
```

- [ ] **Step 4: Run focused backend contracts**

Run: `rtk pytest -q tests/integration/backend/test_main_remaining_edges_api.py tests/integration/backend/test_legacy_social_api.py`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add app/schemas.py app/main.py tests/integration/backend/test_main_remaining_edges_api.py
rtk git commit -m "feat: expose public ids in social users"
```

### Task 2: Add one reusable canonical profile link

**Files:**
- Create: `web/src/components/UserProfileLink.tsx`
- Create: `web/src/components/UserProfileLink.test.tsx`
- Modify: `web/src/lib/api.ts:186-202`

**Interfaces:**
- Produces `UserProfileLink({ publicId, children, className? })` that renders `Link` with `to="/users/$publicId"` and `params={{ publicId }}`.
- Extends `Friend["user"]` with `public_id: string`; `FriendRequest`, `Conversation`, `GameInvite`, and search results inherit it.

- [ ] **Step 1: Write the failing component and API-type test**

```tsx
it("links a represented user to the canonical profile route", () => {
  render(<UserProfileLink publicId="owner-public">Owner</UserProfileLink>);

  expect(screen.getByRole("link", { name: "Owner" })).toHaveAttribute(
    "href",
    "/users/owner-public",
  );
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `rtk npm --prefix web test -- --run src/components/UserProfileLink.test.tsx`

Expected: FAIL because `UserProfileLink` does not exist.

- [ ] **Step 3: Implement the smallest reusable link and client field**

```tsx
export function UserProfileLink({
  publicId,
  children,
  className,
}: {
  publicId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link to="/users/$publicId" params={{ publicId }} className={className}>
      {children}
    </Link>
  );
}
```

```ts
export type Friend = {
  user: {
    id: string;
    public_id: string;
    display_name: string;
    // Existing optional presentation fields remain unchanged.
  };
};
```

- [ ] **Step 4: Run focused component and API tests**

Run: `rtk npm --prefix web test -- --run src/components/UserProfileLink.test.tsx src/lib/api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/components/UserProfileLink.tsx web/src/components/UserProfileLink.test.tsx web/src/lib/api.ts
rtk git commit -m "feat: add canonical user profile link"
```

### Task 3: Use the canonical link in every existing Friends identity surface

**Files:**
- Modify: `web/src/routes/friends.index.tsx:107-350`
- Modify: `web/src/components/FriendConversationHistory.tsx:24-90`
- Modify: `web/src/routes/-friends.index.test.tsx`
- Modify: `web/src/components/FriendConversationHistory.test.tsx`

**Interfaces:**
- Consumes `Friend["user"].public_id` and `UserProfileLink` from Task 2.
- Produces one same-route link for a search result, friend list item, incoming request sender, game invite sender/recipient, selected friend/conversation identity, and history identity where displayed.

- [ ] **Step 1: Write failing Friends-page link coverage**

```tsx
it("uses one canonical profile URL for search, requests, and invites", async () => {
  api.searchUsers.mockResolvedValue([{ id: "friend-id", public_id: "sam-public", display_name: "Sam" }]);
  api.getIncomingFriendRequests.mockResolvedValue([
    { id: "request-1", sender: { id: "friend-id", public_id: "sam-public", display_name: "Sam" } },
  ]);

  renderFriends();

  expect(await screen.findByRole("link", { name: "Sam" })).toHaveAttribute(
    "href",
    "/users/sam-public",
  );
});
```

- [ ] **Step 2: Run focused UI tests to verify they fail**

Run: `rtk npm --prefix web test -- --run src/routes/-friends.index.test.tsx src/components/FriendConversationHistory.test.tsx`

Expected: FAIL because displayed social identities are plain text or use the old friend-only route.

- [ ] **Step 3: Wrap only visible user identities with `UserProfileLink`**

```tsx
<UserProfileLink publicId={request.sender.public_id} className="text-sm font-semibold">
  {friendDisplayName(request.sender)}
</UserProfileLink>
```

Apply this pattern to existing search results, friend rows, incoming requests, invitation actor text, selected conversation/friend headers, and visible history actors. Preserve buttons, selected-friend behavior, deep-link focus markers, and invitation actions.

- [ ] **Step 4: Run focused UI regression tests**

Run: `rtk npm --prefix web test -- --run src/routes/-friends.index.test.tsx src/components/FriendConversationHistory.test.tsx src/components/UserProfileLink.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/routes/friends.index.tsx web/src/components/FriendConversationHistory.tsx web/src/routes/-friends.index.test.tsx web/src/components/FriendConversationHistory.test.tsx
rtk git commit -m "feat: link friends to canonical profiles"
```

### Task 4: Add regression coverage for canonical profile viewer roles

**Files:**
- Modify: `web/src/routes/-users.$publicId.test.tsx`
- Modify: `web/src/components/PublicProfileView.test.tsx`

**Interfaces:**
- Consumes the existing `PublicProfile.relationship` values `none`, `self`, and `friends`.
- Verifies the one canonical route remains safe for anonymous, stranger, friend, and owner viewers.

- [ ] **Step 1: Write failing role-specific assertions**

```tsx
it("does not render authenticated actions for an anonymous visitor", async () => {
  api.getAuthSnapshot.mockReturnValue(false);
  renderPublicProfile();

  expect(await screen.findByRole("heading", { name: "Owner" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add friend" })).not.toBeInTheDocument();
});

it("shows the settings path for the owner but not a self-friend action", () => {
  renderPublicProfileView({ relationship: "self" });

  expect(screen.getByRole("link", { name: /profile settings/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add friend" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused profile tests**

Run: `rtk npm --prefix web test -- --run 'src/routes/-users.$publicId.test.tsx' src/components/PublicProfileView.test.tsx`

Expected: PASS. The existing public-profile implementation already enforces these role boundaries; this task records the navigation contract against regressions.

- [ ] **Step 3: Commit**

```powershell
rtk git add 'web/src/routes/-users.$publicId.test.tsx' web/src/components/PublicProfileView.test.tsx web/src/routes/users.$publicId.tsx web/src/components/PublicProfileView.tsx
rtk git commit -m "test: cover canonical profile viewer roles"
```

### Task 5: Full verification and draft pull request

**Files:**
- Modify only files changed by Tasks 1-4.

- [ ] **Step 1: Run all verification commands**

```powershell
rtk pytest -q
rtk npm --prefix web test
rtk npm --prefix web run lint
rtk npm --prefix web run build
rtk git diff --check
```

Expected: pytest and Vitest pass, lint has zero errors, production build passes, and `git diff --check` has no whitespace errors.

- [ ] **Step 2: Browser smoke without mutations**

Open an anonymous `/users/<public_id>` link and an authenticated Friends surface in the local app. Confirm that displayed user names/avatars navigate to the same `/users/<public_id>` route. Do not click friend-request, accept, or invitation mutations during the smoke test.

- [ ] **Step 3: Open a draft PR**

```powershell
rtk git push -u origin codex/universal-user-profile-navigation
rtk gh pr create --draft --base main --head codex/universal-user-profile-navigation --title "Link social users to canonical profiles"
```

Include the backend contract expansion, the shared link, all linked surfaces, and validation results in the PR body.
