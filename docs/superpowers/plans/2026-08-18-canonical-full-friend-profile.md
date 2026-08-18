# Canonical Full Friend Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the prior full `ProfileView` experience to `/users/<publicId>` for every viewer role and remove `/friends/<id>` as a profile route.

**Architecture:** Keep public-profile visibility at `GET /users/{public_id}`. Add one friend-authorized lookup by public ID that reuses the existing friend-profile data and never exposes an action UUID to public/stranger viewers. The canonical route adapts its role-specific data into the existing `ProfileView`; it owns the `compose` search state. The old UUID route is removed.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React, TanStack Router, TanStack Query, Vitest, pytest.

## Global Constraints

- `/users/<publicId>` is the only profile URL; do not create another profile route.
- Reuse `ProfileView`; remove `PublicProfileView` rather than maintaining two profile layouts.
- Public data never contains a friend UUID or private section data.
- Friend-only lookup must return `404` for anonymous, self, stranger, and unknown users.
- Message and Invite are enabled only for friends and use `?compose=message` or `?compose=invite` on the canonical URL.
- All implementation steps use focused RED → minimal implementation → GREEN testing.

---

### Task 1: Add a friend-authorized lookup by public ID

**Files:**
- Modify: `app/main.py:1516-1551`
- Modify: `tests/integration/backend/test_legacy_social_api.py`

**Interfaces:**
- Produces: `GET /users/{public_id}/friend-profile`, response `FriendProfileRead`.
- Consumes: `are_friends(db, current_user.id, owner.id)`, `public_user_response(owner)`, and the existing friend library block logic.

- [ ] **Step 1: Write failing endpoint tests**

Add a friend setup with stable `public_id` values, then assert:

```python
friend_response = api_client.get(f"/users/{friend.public_id}/friend-profile")
assert friend_response.status_code == 200
assert friend_response.json()["user"]["public_id"] == friend.public_id

stranger_response = api_client.get(f"/users/{stranger.public_id}/friend-profile")
assert stranger_response.status_code == 404
```

Add the same `404` assertion for an unauthenticated request and for the owner requesting their own ID.

- [ ] **Step 2: Run RED**

Run: `rtk pytest -q tests/integration/backend/test_legacy_social_api.py`

Expected: FAIL with `404` for the authorized friend because the public-ID route does not exist.

- [ ] **Step 3: Extract the existing friend-profile construction and expose the canonical endpoint**

Create a private helper in `app/main.py`:

```python
def friend_profile_response(db: Session, current_user: User, friend: User) -> FriendProfileRead:
    # move the existing library visibility and FriendProfileRead construction here
```

Make both endpoints use it. The new endpoint must look up `User.public_id`, reject `current_user.id == friend.id` and non-friends with `HTTPException(404, "Friend not found")`, then return the helper result.

- [ ] **Step 4: Run GREEN and commit**

Run: `rtk pytest -q tests/integration/backend/test_legacy_social_api.py`

Expected: PASS.

```powershell
rtk git add app/main.py tests/integration/backend/test_legacy_social_api.py
rtk git commit -m "feat: load friend profiles by public id"
```

### Task 2: Make `ProfileView` role-aware without adding a new profile UI

**Files:**
- Modify: `web/src/components/ProfileView.tsx`
- Modify: `web/src/components/ProfileView.test.tsx`

**Interfaces:**
- Produces: optional `viewer` configuration:

```ts
viewer?: {
  canMessage: boolean;
  canInvite: boolean;
  canAddFriend: boolean;
  onAddFriend?: () => void;
};
```

- [ ] **Step 1: Write failing role tests**

Render the existing component with `isSelf={false}`, no `friendId`, and:

```tsx
viewer={{ canMessage: false, canInvite: false, canAddFriend: true, onAddFriend }}
```

Assert Add friend is present, Message and Invite are absent, and clicking Add friend calls `onAddFriend`. Add a second test with `canMessage: true`, `canInvite: true`, and a `friendId`, asserting the existing buttons are present.

- [ ] **Step 2: Run RED**

Run: `rtk npm --prefix web test -- ProfileView.test.tsx`

Expected: FAIL because `ProfileView` has no `viewer` prop and currently treats every non-owner as a friend.

- [ ] **Step 3: Implement the smallest role gates**

Add the optional `viewer` prop. Replace `!isSelf` action rendering with `viewer?.canMessage`, `viewer?.canInvite`, and `viewer?.canAddFriend`. The existing message and invite mutations remain unchanged and only render when a `friendId` is present. Render Add friend with the existing primary button classes and the supplied callback. Preserve the existing self settings branch unchanged.

- [ ] **Step 4: Run GREEN and commit**

Run: `rtk npm --prefix web test -- ProfileView.test.tsx`

Expected: PASS.

```powershell
rtk git add web/src/components/ProfileView.tsx web/src/components/ProfileView.test.tsx
rtk git commit -m "feat: support canonical profile viewer roles"
```

### Task 3: Adapt every canonical role to the old profile screen

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/routes/users.$publicId.tsx`
- Modify: `web/src/routes/-users.$publicId.test.tsx`
- Delete: `web/src/components/PublicProfileView.tsx`
- Delete: `web/src/components/PublicProfileView.test.tsx`

**Interfaces:**
- Adds `getFriendProfileByPublicId(publicId: string): Promise<FriendProfile>` calling `/users/${encodeURIComponent(publicId)}/friend-profile` with auth.
- The route validates `compose` as `"message" | "invite" | undefined` and passes it to `ProfileView` as `initialComposer`.

- [ ] **Step 1: Write failing canonical-route tests**

Mock `getPublicProfile`, `getFriendProfileByPublicId`, and `getSharedGames`. Add tests for:

```tsx
// a friend loads the old ProfileView data and /users/owner?compose=message opens Message
expect(api.getFriendProfileByPublicId).toHaveBeenCalledWith("owner");
expect(await screen.findByRole("button", { name: "Message" })).toBeInTheDocument();

// an anonymous stranger sees ProfileView but neither Message nor Invite
expect(screen.queryByRole("button", { name: "Message" })).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "Add friend" })).toBeInTheDocument();
```

Add a self fixture asserting the settings affordance remains available. Assert no test imports `PublicProfileView`.

- [ ] **Step 2: Run RED**

Run: `rtk npm --prefix web test -- users.`

Expected: FAIL because the route renders `PublicProfileView`, has no compose search schema, and does not call the friend lookup.

- [ ] **Step 3: Implement the adapter and remove the second UI**

In `users.$publicId.tsx`:

1. Add `validateSearch` that accepts only `compose: "message" | "invite"`.
2. Query the public profile first. When `relationship === "friends"`, query `getFriendProfileByPublicId(publicId)` and `getSharedGames(friendProfile.user.id)`.
3. Map public collections, friend library/shared games, identity, and owner settings data into `ProfileData` using the same gradients and display conventions currently used by `friends.$friendId.tsx` and `account.tsx`.
4. Pass `viewer` based strictly on relationship and authentication, and pass `initialComposer={search.compose}`.
5. Remove `PublicProfileView` and its test after the route suite passes.

- [ ] **Step 4: Run GREEN and commit**

Run: `rtk npm --prefix web test -- users. ProfileView.test.tsx`

Expected: PASS; all role fixtures mount `ProfileView`, and friend actions use the canonical URL.

```powershell
rtk git add web/src/lib/api.ts web/src/routes/users.$publicId.tsx web/src/routes/-users.$publicId.test.tsx web/src/components/PublicProfileView.tsx web/src/components/PublicProfileView.test.tsx
rtk git commit -m "feat: render canonical profiles with ProfileView"
```

### Task 4: Remove the UUID profile route and verify social navigation

**Files:**
- Delete: `web/src/routes/friends.$friendId.tsx`
- Delete: `web/src/routes/-friends.$friendId.test.tsx` (or replace only assertions that cover non-profile Friends behavior)
- Modify: `web/src/routes/friends.index.tsx`
- Modify: `web/src/routes/-friends.index.test.tsx`
- Modify: `web/src/routeTree.gen.ts` (generated route removal only)

**Interfaces:**
- Produces no `/friends/$friendId` route; Message and Invite targets use:

```ts
{ to: "/users/$publicId", params: { publicId }, search: { compose: "message" } }
{ to: "/users/$publicId", params: { publicId }, search: { compose: "invite" } }
```

- [ ] **Step 1: Write failing Friends navigation tests**

Update the existing Message and Invite button tests to expect `/users/alex-public?compose=message` and `/users/alex-public?compose=invite`. Add an assertion that no rendered Friends link has an `href` beginning `/friends/`.

- [ ] **Step 2: Run RED**

Run: `rtk npm --prefix web test -- friends.index`

Expected: FAIL because Message and Invite still navigate to the UUID route.

- [ ] **Step 3: Implement canonical action navigation and remove the route**

Use each friend’s existing `public_id` for Message and Invite targets. Delete the UUID route and its dedicated profile tests. Run the project’s TanStack route generator only if the build does not regenerate `routeTree.gen.ts`; stage that generated file only for the deleted route.

- [ ] **Step 4: Run GREEN and commit**

Run: `rtk npm --prefix web test -- friends.index`

Expected: PASS with no UUID profile navigation.

```powershell
rtk git add web/src/routes/friends.index.tsx web/src/routes/-friends.index.test.tsx web/src/routes/friends.$friendId.tsx web/src/routes/-friends.$friendId.test.tsx web/src/routeTree.gen.ts
rtk git commit -m "feat: use canonical profile actions"
```

### Task 5: Release verification

**Files:**
- Verify only; do not stage `web/.output` or unrelated files.

- [ ] **Step 1: Run full checks separately**

```powershell
rtk pytest -q
rtk npm --prefix web test
rtk npm --prefix web run lint
rtk npm --prefix web run build
rtk git diff --check origin/main...HEAD
rtk git status --short
```

Expected: all tests and build pass; lint has no errors; only generated `routeTree.gen.ts` changed for the removed route; no build output is staged.

- [ ] **Step 2: Browser smoke**

Using two authenticated users and one anonymous session, open the same `/users/<publicId>` URL. Confirm public/stranger/friend/owner roles, then open Message and Invite via the two `compose` URLs. Confirm Friends contains no `/friends/<id>` profile navigation.

- [ ] **Step 3: Inspect PR scope**

Run: `rtk git diff --stat origin/main...HEAD`

Expected: backend contract, canonical route adapter, reusable `ProfileView`, route removal, focused tests, and this approved design/plan only.
