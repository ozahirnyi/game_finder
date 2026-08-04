# Social Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PlayFinder social pages use authoritative API data for friendship, shared libraries, invites, notifications, and conversations.

**Architecture:** FastAPI owns viewer-scoped social read models and mutations. Shared games are derived from persisted game rows by exact source/external-ID identity; UI query hooks consume these DTOs and render explicit unavailable states.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, pytest, React, TanStack Query, Vitest.

## Global Constraints

- Match games only on non-empty `(source, external_id)`; never title or fuzzy matching.
- Do not expose data outside the authenticated owner or a confirmed friendship.
- Report Steam private, disconnected, and provider-error outcomes as explicit states, not zeroes or placeholder statistics.
- No social screen may import runtime mock data.
- Run no mutation tests against production.

---

### Task 1: Canonical social API contracts and shared library

**Files:**
- Modify: `app/schemas.py`, `app/main.py`
- Test: `tests/test_social_api.py`, `tests/test_social_contracts.py`

**Interfaces:**
- Produces `SharedLibraryRead { status, data, message }` and `FriendProfileRead.shared_games`.
- Produces `GET /friends/{user_id}/shared-games` for a confirmed friend.

- [ ] **Step 1: Write failing pytest cases**

```python
def test_shared_games_match_only_exact_source_and_external_id(social_db):
    # Same title with different IDs is absent; matching steam external ID is returned.
    assert payload["data"] == [{"source": "steam", "external_id": "620"}]

def test_shared_games_are_scoped_to_confirmed_friends(social_db):
    assert client.get(f"/friends/{stranger.id}/shared-games").status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk pytest -q tests/test_social_api.py -k shared_games`
Expected: FAIL because the route/field does not exist.

- [ ] **Step 3: Write minimal implementation**

```python
@app.get("/friends/{user_id}/shared-games", response_model=SharedLibraryRead)
def shared_games(user_id: uuid.UUID, current_user=Depends(get_current_user), db=Depends(get_db)):
    friend = confirmed_friend(db, current_user.id, user_id)
    return shared_library_for(db, current_user, friend)
```

`shared_library_for` joins owned `Game` rows on equal `source` and non-null `external_id`, returns `ready` plus records, or the relevant documented state.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk pytest -q tests/test_social_api.py -k shared_games`
Expected: PASS.

### Task 2: Invitations, notifications, and conversation access

**Files:**
- Modify: `app/schemas.py`, `app/main.py`
- Test: `tests/test_social_api.py`, `tests/test_social_contracts.py`

**Interfaces:**
- Consumes confirmed-friend helper and canonical game identity.
- Produces `GET /game-invites?direction=incoming`, `POST /game-invites/{id}/response`, and notification records.

- [ ] **Step 1: Write failing pytest cases**

```python
def test_invite_recipient_can_accept_and_receives_notification(social_db):
    invite = api.post("/game-invites", json={"recipient_id": str(bob.id), "source": "steam", "external_id": "620"})
    assert use_social_api(bob, social_db).post(f"/game-invites/{invite.json()['id']}/response", json={"status": "accepted"}).status_code == 200
    assert any(item["type"] == "game_invite_response" for item in use_social_api(alice, social_db).get("/notifications").json())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk pytest -q tests/test_social_api.py -k "invite or conversation"`
Expected: FAIL because canonical identity and recipient lifecycle are incomplete.

- [ ] **Step 3: Write minimal implementation**

```python
class GameInviteCreate(BaseModel):
    recipient_id: uuid.UUID
    source: str
    external_id: str
    note: str | None = Field(default=None, max_length=280)
```

Require `confirmed_friendship`, persist and emit notifications for creation/response; reuse a single direct conversation for a confirmed pair and reject non-friend message access.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk pytest -q tests/test_social_api.py -k "invite or conversation"`
Expected: PASS.

### Task 3: API client and query contracts

**Files:**
- Modify: `web/src/lib/api.ts`, `web/src/lib/navigationQueries.ts`
- Test: `web/src/lib/navigationQueries.test.ts`

**Interfaces:**
- Consumes `SharedLibraryRead`, `GameInviteRead`, `ConversationRead`, and notification DTOs.
- Produces typed `getSharedGames`, `getGameInvites`, `respondToGameInvite`, `getConversationMessages` functions.

- [ ] **Step 1: Write failing Vitest cases**

```ts
it("requests shared games for the selected friend", async () => {
  await getSharedGames("friend-id");
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/friends/friend-id/shared-games"), expect.anything());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm --prefix web test -- --run src/lib/navigationQueries.test.ts`
Expected: FAIL because the client function is absent.

- [ ] **Step 3: Write minimal implementation**

```ts
export const getSharedGames = (friendId: string) =>
  apiRequest<SharedLibrary>(`/friends/${friendId}/shared-games`, { auth: true });
```

Add the matching query options and mutation invalidations.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm --prefix web test -- --run src/lib/navigationQueries.test.ts`
Expected: PASS.

### Task 4: Friends, profile, game, invite, and messaging UI states

**Files:**
- Modify: `web/src/routes/friends.index.tsx`, `web/src/routes/friends.$friendId.tsx`, `web/src/routes/games.$gameId.tsx`, `web/src/components/NotificationsPanel.tsx`
- Test: `web/src/routes/-friends.index.test.tsx`, new focused route/component Vitest tests

**Interfaces:**
- Consumes Task 3 query/mutation functions.
- Produces truthful loading, empty, ready, private, disconnected, error, invite, and direct-message UI states.

- [ ] **Step 1: Write failing Vitest cases**

```tsx
it("explains unavailable shared games instead of showing a dash", () => {
  render(<FriendsPage />, { sharedGames: { status: "private", data: [], message: "Friend library is private." } });
  expect(screen.getByText("Friend library is private.")).toBeInTheDocument();
  expect(screen.queryByText("Shared: —")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm --prefix web test -- --run src/routes/-friends.index.test.tsx`
Expected: FAIL because placeholder social UI remains.

- [ ] **Step 3: Write minimal implementation**

Remove runtime mock/placeholder fields. Render API state messages, invite actions from all three entrypoints, incoming accept/decline actions, notifications refresh, and the conversation composer for confirmed friends. Provide a request-friend explanation for ineligible messaging.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm --prefix web test -- --run src/routes/-friends.index.test.tsx`
Expected: PASS.

### Task 5: Final verification and delivery

**Files:** all Task 1–4 files

- [ ] **Step 1: Run backend social verification**

Run: `rtk pytest -q tests/test_social_api.py tests/test_social_contracts.py`
Expected: PASS.

- [ ] **Step 2: Run frontend verification**

Run: `rtk npm --prefix web test`, `rtk npm --prefix web run lint`, `rtk npm --prefix web run build`
Expected: all commands exit 0.

- [ ] **Step 3: Commit and publish**

Run: `rtk git add <changed-files>` then `rtk git commit -m "feat: complete social workflows"`; push, create PR, merge after green CI, deploy only with available credentials, and run a non-mutating production check.
