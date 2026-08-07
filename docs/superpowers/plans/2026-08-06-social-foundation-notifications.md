# Social Foundation and Social Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build private friend discovery, confirmed friendships, direct messages, game invites, and actionable social notifications.

**Architecture:** A social service owns relationship lookup, state transitions, and notification creation while FastAPI routes remain authentication and DTO boundaries. One Alembic revision adds social records and extends notifications. The Vite app uses typed API clients and TanStack Query route screens; notification target resolution starts navigation before its owner-scoped mark-read mutation.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic, pytest; React, TypeScript, TanStack Router, TanStack Query, Vitest.

## Global Constraints

- Branch from and target `codex/retention-notifications-alerts`; preserve its dependency PRs and do not stage `web/.output`.
- Nicknames are 1--64-character non-unique display strings. Search selects a profile id or an exact friend code; a nickname is never an authorization key.
- Every social endpoint is authenticated and owner/friendship-scoped. Never expose email, private libraries, another user's request lists, messages, or notification target data.
- No online status, compatibility, activity, Party Finder, Groups, Discord, favorites, privacy settings, or onboarding.
- A visible control must mutate real state, navigate to a real route, or be absent.
- Mutations are retry-safe: accepted/rejected/cancelled requests and invites return their current valid result; duplicate active requests or invites return a clear 409.
- Missing, deleted, stale, foreign, or unauthorized notification targets display unavailable and remain unread.
- Use RED → minimum implementation → GREEN for every production slice. Run systematic debugging before fixing an unexpected failure.

## File Structure

- `app/database.py` — social ORM models and social notification foreign keys.
- `alembic/versions/<revision>_add_social_foundation.py` — identity backfill and social tables.
- `app/schemas.py` — social DTOs, validated request bodies, and notification union fields.
- `app/social.py` — canonical friendship, lifecycle, conversation, invite, notification, and target-validation services.
- `app/main.py` — thin authenticated social and generic-notification endpoints.
- `tests/test_social.py` — model, migration, lifecycle, ownership, and notification tests.
- `web/src/lib/api.ts` — matching social DTOs and API functions.
- `web/src/features/social/FriendsScreen.tsx` — discovery, code entry, requests, and confirmed friends.
- `web/src/features/social/ConversationScreen.tsx` — authorized conversation UI.
- `web/src/features/social/InvitesScreen.tsx` — incoming/outgoing invite UI.
- `web/src/features/social/ProfileScreen.tsx` — minimal request-only profile UI.
- `web/src/features/social/*.test.tsx` — route and mutation state coverage.
- `web/src/features/retention/NotificationsMenu.tsx` — typed deep-link map and read ordering.
- `web/src/routes/friends.tsx`, `web/src/routes/friends.$friendId.messages.tsx`, `web/src/routes/friends.invites.tsx`, `web/src/routes/users.$profileId.tsx` — active route composition.

---

### Task 1: Persist safe identities and social records

**Files:**
- Modify: `app/database.py`, `app/crud.py`, `app/schemas.py`
- Create: `alembic/versions/<revision>_add_social_foundation.py`, `tests/test_social.py`

**Interfaces:**
- Produces `User.display_name`, `User.profile_id`, `User.friend_code`, `FriendRequest`, `Friendship`, `DirectMessage`, `GameInvite`.
- Produces `create_user(db, email, password_hash, display_name)` and `UserCreate(email, password, display_name)`.

- [ ] **Step 1: Write failing model and registration tests**

```python
def test_social_identity_allows_duplicate_display_names_and_generates_safe_ids(db):
    first = create_user(db, "first@example.com", "hash", "Alex")
    second = create_user(db, "second@example.com", "hash", "Alex")
    assert first.display_name == second.display_name == "Alex"
    assert first.profile_id != second.profile_id
    assert first.friend_code != second.friend_code

def test_registration_requires_a_display_name(client):
    response = client.post("/auth/register", json={"email": "a@example.com", "password": "password"})
    assert response.status_code == 422
```

- [ ] **Step 2: Run RED**

Run: `rtk pytest -q tests/test_social.py -k "social_identity or registration_requires"`

Expected: FAIL because social columns and registration field do not exist.

- [ ] **Step 3: Add models, DTO, creation defaults, and migration**

```python
class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (UniqueConstraint("user_low_id", "user_high_id", name="uq_friendship_pair"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_low_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user_high_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: str
    password: str
    display_name: str = Field(min_length=1, max_length=64)
```

Generate profile ids and friend codes with `secrets.token_urlsafe(12)` in a collision-checked helper; backfill existing users with trimmed Steam persona or `Player-<short-code>`. Add unique indexes for ids/codes, a case-insensitive search index for display name, canonical request and friendship constraints, and foreign keys from messages/invites/notifications. Make downgrade drop indexes/tables/columns in dependency order.

- [ ] **Step 4: Run GREEN and isolated migration check**

Run: `rtk pytest -q tests/test_social.py -k "social_identity or registration_requires"`

Expected: PASS.

Run: `rtk alembic upgrade head`

Expected: migration applies with existing retention revision as its parent.

- [ ] **Step 5: Commit**

Run: `rtk git add app/database.py app/crud.py app/schemas.py alembic/versions tests/test_social.py`

Run: `rtk git commit -m "feat: persist social foundation"`

### Task 2: Add friend discovery and request lifecycle

**Files:**
- Create: `app/social.py`
- Modify: `app/schemas.py`, `app/main.py`, `tests/test_social.py`

**Interfaces:**
- Produces `search_profiles`, `get_social_me`, `create_friend_request`, `transition_friend_request`.
- Produces `GET /social/me`, `GET /social/profiles`, `GET /social/profiles/{profile_id}`, and request create/accept/reject/cancel endpoints.

- [ ] **Step 1: Write lifecycle and disclosure tests**

```python
def test_nickname_search_returns_minimal_duplicate_matches(alice_client, alex_one, alex_two):
    result = alice_client.get("/social/profiles?query=Al").json()
    assert {item["profile_id"] for item in result} == {str(alex_one.profile_id), str(alex_two.profile_id)}
    assert all(set(item) <= {"profile_id", "display_name", "relationship"} for item in result)

def test_request_accept_creates_canonical_friendship_and_notification(clients, users):
    sender, recipient = clients[:2]
    request = sender.post("/social/friend-requests", json={"profile_id": str(users[1].profile_id)})
    accepted = recipient.post(f"/social/friend-requests/{request.json()['id']}/accept")
    assert accepted.status_code == 200
    assert sender.get("/notifications").json()[0]["event_type"] == "friend_request"
```

- [ ] **Step 2: Run RED**

Run: `rtk pytest -q tests/test_social.py -k "nickname_search or request_accept"`

Expected: FAIL with missing `/social` routes.

- [ ] **Step 3: Implement scoped service and routes**

```python
def canonical_pair(first: uuid.UUID, second: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    return tuple(sorted((first, second), key=str))

def search_profiles(db: Session, viewer_id: uuid.UUID, query: str) -> list[ProfileSearchRead]:
    if len(query.strip()) < 2:
        return []
    return [profile_read(row, viewer_id) for row in db.query(User)
        .filter(User.display_name.ilike(f"{escape_like(query.strip())}%"))
        .order_by(User.display_name, User.profile_id).limit(20)]
```

Accept exactly one of `profile_id` or `friend_code`. Reject self, an existing friendship, and any directional active request with 409. Only recipient accepts/rejects; only sender cancels. On send create one recipient `friend_request` notification; acceptance creates one canonical friendship in the same transaction. Profile reads must include only display name and viewer-specific relationship action.

- [ ] **Step 4: Run focused authorization suite**

Run: `rtk pytest -q tests/test_social.py -k "nickname_search or friend_request or profile"`

Expected: PASS, including self, short query, duplicate, foreign action, and no-email assertions.

- [ ] **Step 5: Commit**

Run: `rtk git add app/social.py app/schemas.py app/main.py tests/test_social.py`

Run: `rtk git commit -m "feat: add friend discovery and requests"`

### Task 3: Add confirmed-friend conversations and invites

**Files:**
- Modify: `app/social.py`, `app/schemas.py`, `app/main.py`, `tests/test_social.py`

**Interfaces:**
- Produces `require_friendship`, `list_messages`, `send_message`, `create_invite`, `transition_invite`.
- Produces `GET/POST /social/friends/{friend_id}/messages`, `GET /social/invites`, `POST /social/friends/{friend_id}/invites`, and invite response/cancel routes.

- [ ] **Step 1: Write failing authorization and event tests**

```python
def test_only_confirmed_friends_can_read_or_send_messages(friend_clients, stranger_client):
    author, friend = friend_clients
    assert author.post(f"/social/friends/{friend.user_id}/messages", json={"text": "  Hi  "}).json()["text"] == "Hi"
    assert stranger_client.get(f"/social/friends/{friend.user_id}/messages").status_code == 403

def test_invite_response_notifies_only_the_sender(friend_clients):
    sender, recipient = friend_clients
    invite = sender.post(f"/social/friends/{recipient.user_id}/invites", json={"game_id": 30, "game_title": "Hades"}).json()
    assert recipient.post(f"/social/invites/{invite['id']}/accept").status_code == 200
    assert sender.get("/notifications").json()[0]["event_type"] == "game_invite_response"
```

- [ ] **Step 2: Run RED**

Run: `rtk pytest -q tests/test_social.py -k "confirmed_friends or invite_response"`

Expected: FAIL because messages and invite endpoints do not exist.

- [ ] **Step 3: Implement permission checks and event creation**

```python
def require_friendship(db: Session, user_id: uuid.UUID, friend_id: uuid.UUID) -> Friendship:
    low, high = canonical_pair(user_id, friend_id)
    friendship = db.query(Friendship).filter_by(user_low_id=low, user_high_id=high).first()
    if friendship is None:
        raise HTTPException(status_code=403, detail="Only confirmed friends can use this feature")
    return friendship
```

Trim message text before validating length; list oldest-first with `before` cursor and `limit` 1--50. Validate rawg game id/title before invite insert. A message creates one recipient `message` notification; an invite creates one recipient `game_invite` notification; an accepted/declined invite creates one sender `game_invite_response` notification. Restrict response to recipient and cancellation to sender, returning 404 for foreign ids and idempotent current state for valid retries.

- [ ] **Step 4: Run GREEN**

Run: `rtk pytest -q tests/test_social.py -k "message or invite"`

Expected: PASS for paging, trim/empty rejection, friendship checks, ownership, duplicate pending invite, and event payloads.

- [ ] **Step 5: Commit**

Run: `rtk git add app/social.py app/schemas.py app/main.py tests/test_social.py`

Run: `rtk git commit -m "feat: add friend messages and game invites"`

### Task 4: Generalize notification payloads and deep-link safety

**Files:**
- Modify: `app/social.py`, `app/retention.py`, `app/schemas.py`, `app/main.py`, `tests/test_social.py`, `web/src/lib/api.ts`, `web/src/features/retention/NotificationsMenu.tsx`
- Test: `web/src/features/retention/NotificationsMenu.test.tsx`

**Interfaces:**
- Produces typed `NotificationRead` event target fields and `notification_target_for_owner` validation.
- Produces `notificationTarget(notification): string | null` and navigation-before-`markNotificationRead` behavior.

- [ ] **Step 1: Write failing backend and UI target tests**

```tsx
it("starts message navigation before marking the notification read", async () => {
  render(<NotificationsMenu navigate={navigate} markRead={markRead} />);
  await user.click(await screen.findByRole("button", { name: /new message/i }));
  expect(navigate).toHaveBeenCalledWith("/friends/friend-1/messages");
  expect(markRead).toHaveBeenCalledWith("notification-1");
});

it("keeps an unavailable invite unread", async () => {
  render(<NotificationsMenu markRead={markRead} />);
  await user.click(await screen.findByRole("button", { name: /game invite/i }));
  expect(screen.getByRole("alert")).toHaveTextContent(/no longer available/i);
  expect(markRead).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run RED**

Run: `rtk pytest -q tests/test_social.py -k notification`

Run: `rtk npm.cmd --prefix web test -- --run src/features/retention/NotificationsMenu.test.tsx`

Expected: FAIL because social event fields and routes are unmapped.

- [ ] **Step 3: Validate targets and map all event types**

```ts
function notificationTarget(notification: Notification) {
  switch (notification.event_type) {
    case "friend_request": return notification.friend_request_id ? `/friends?request=${notification.friend_request_id}` : null;
    case "message": return notification.friend_id ? `/friends/${notification.friend_id}/messages` : null;
    case "game_invite":
    case "game_invite_response": return notification.game_invite_id ? `/friends/invites?invite=${notification.game_invite_id}` : null;
    case "price_alert": return priceTarget(notification);
  }
}
```

Use a typed event literal union, stable social foreign-key identifiers, and one target validator used at persistence and list/read boundaries. Do not mark an unread notification read unless the client obtained a non-null target and initiated navigation. A read action remains owner-scoped/idempotent; foreign ids are 404. Preserve price notification DTO behavior and tests.

- [ ] **Step 4: Run GREEN**

Run: `rtk pytest -q tests/test_social.py tests/test_retention.py -k notification`

Run: `rtk npm.cmd --prefix web test -- --run src/features/retention/NotificationsMenu.test.tsx`

Expected: PASS for every event mapping, target validation, read order, and unavailable unread state.

- [ ] **Step 5: Commit**

Run: `rtk git add app/social.py app/retention.py app/schemas.py app/main.py tests/test_social.py web/src/lib/api.ts web/src/features/retention/NotificationsMenu.tsx web/src/features/retention/NotificationsMenu.test.tsx`

Run: `rtk git commit -m "feat: add actionable social notifications"`

### Task 5: Replace mock Friends UI with real social routes

**Files:**
- Create: `web/src/features/social/FriendsScreen.tsx`, `web/src/features/social/FriendsScreen.test.tsx`, `web/src/features/social/ProfileScreen.tsx`, `web/src/features/social/ProfileScreen.test.tsx`
- Modify: `web/src/lib/api.ts`, `web/src/routes/friends.tsx`
- Create: `web/src/routes/users.$profileId.tsx`

**Interfaces:**
- Produces typed `getSocialMe`, `searchProfiles`, `getSocialProfile`, `sendFriendRequest`, and request transition clients.
- Produces authenticated `/friends` and `/users/$profileId` routes.

- [ ] **Step 1: Write failing real-state tests**

```tsx
it("searches duplicate nicknames and sends to the selected profile", async () => {
  vi.mocked(searchProfiles).mockResolvedValue([alexOne, alexTwo]);
  render(<FriendsScreen />);
  await user.type(screen.getByLabelText(/find by nickname/i), "Alex");
  await user.click(await screen.findByRole("button", { name: /alex.*one/i }));
  await user.click(screen.getByRole("button", { name: /send friend request/i }));
  expect(sendFriendRequest).toHaveBeenCalledWith({ profile_id: alexOne.profile_id });
});
```

- [ ] **Step 2: Run RED**

Run: `rtk npm.cmd --prefix web test -- --run src/features/social/FriendsScreen.test.tsx src/features/social/ProfileScreen.test.tsx`

Expected: FAIL because social feature components do not exist.

- [ ] **Step 3: Implement query-backed discovery and profile actions**

```tsx
const social = useQuery({ queryKey: ["social", "me"], queryFn: getSocialMe });
const send = useMutation({
  mutationFn: sendFriendRequest,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social"] }),
});
```

Debounce nickname query by 250 ms and do not call it before two characters. Show loading, signed-out, no-match, empty, error/retry, and disabled pending states. Show only server-provided relationship actions. Copy friend code/profile link through `navigator.clipboard`; surface clipboard failure. Remove all `mockData`, Steam, presence, compatibility, activity, shared-game, and inert-action references from `/friends`.

- [ ] **Step 4: Run GREEN and route generation**

Run: `rtk npm.cmd --prefix web test -- --run src/features/social/FriendsScreen.test.tsx src/features/social/ProfileScreen.test.tsx`

Expected: PASS.

Run: `rtk npm.cmd --prefix web run build`

Expected: PASS and generated route tree includes `/users/$profileId`.

- [ ] **Step 5: Commit**

Run: `rtk git add web/src/lib/api.ts web/src/features/social/FriendsScreen.tsx web/src/features/social/FriendsScreen.test.tsx web/src/features/social/ProfileScreen.tsx web/src/features/social/ProfileScreen.test.tsx web/src/routes/friends.tsx web/src/routes/users.$profileId.tsx web/src/routeTree.gen.ts`

Run: `rtk git commit -m "feat: build real friend discovery UI"`

### Task 6: Add conversation and invite screens, then verify the full flow

**Files:**
- Create: `web/src/features/social/ConversationScreen.tsx`, `web/src/features/social/ConversationScreen.test.tsx`, `web/src/features/social/InvitesScreen.tsx`, `web/src/features/social/InvitesScreen.test.tsx`, `web/src/routes/friends.$friendId.messages.tsx`, `web/src/routes/friends.invites.tsx`
- Modify: `web/src/lib/api.ts`, `tests/test_social.py`

**Interfaces:**
- Produces message/invite API clients and routed conversation/invite contexts.

- [ ] **Step 1: Write failing route tests**

```tsx
it("sends a trimmed conversation message and reloads history", async () => {
  render(<ConversationScreen friendId="friend-1" />);
  await user.type(await screen.findByLabelText(/message/i), "  Ready?  ");
  await user.click(screen.getByRole("button", { name: /send/i }));
  expect(sendMessage).toHaveBeenCalledWith("friend-1", { text: "Ready?" });
  expect(listMessages).toHaveBeenCalledTimes(2);
});

it("accepts an incoming invite and invalidates the list", async () => {
  render(<InvitesScreen />);
  await user.click(await screen.findByRole("button", { name: /accept invite/i }));
  expect(respondToInvite).toHaveBeenCalledWith("invite-1", "accept");
});
```

- [ ] **Step 2: Run RED**

Run: `rtk npm.cmd --prefix web test -- --run src/features/social/ConversationScreen.test.tsx src/features/social/InvitesScreen.test.tsx`

Expected: FAIL because screens and clients do not exist.

- [ ] **Step 3: Implement authorized route surfaces**

```tsx
const messages = useQuery({ queryKey: ["social", "messages", friendId], queryFn: () => listMessages(friendId) });
const send = useMutation({ mutationFn: (text: string) => sendMessage(friendId, { text }), onSuccess: () => messages.refetch() });
```

Conversation and invites must show loading, empty, 403/private, 404/unavailable, error/retry, and mutation-pending states. Render only confirmed-friend message and invite controls. Invite creation selects a real catalog game identity; accepted/declined/cancelled states are server-driven. Focus route search parameters after data load and show unavailable when the requested request/invite no longer belongs to the owner.

- [ ] **Step 4: Run GREEN and full social regression**

Run: `rtk npm.cmd --prefix web test -- --run src/features/social`

Run: `rtk pytest -q tests/test_social.py`

Expected: PASS.

- [ ] **Step 5: Final verification**

Run: `rtk pytest -q`

Run: `rtk npm.cmd --prefix web test`

Run: `rtk npm.cmd --prefix web run lint`

Run: `rtk npm.cmd --prefix web run build`

Run: `rtk alembic upgrade head`

Expected: all commands pass; run the Alembic command with a temporary isolated `DATABASE_URL`, not the shared database.

- [ ] **Step 6: Review and commit**

Run: `rtk git diff --check`

Run: `rtk git status --short`

Confirm no generated `web/.output` files are staged. Then run:

`rtk git add web/src/lib/api.ts web/src/features/social web/src/routes/friends.$friendId.messages.tsx web/src/routes/friends.invites.tsx web/src/routeTree.gen.ts tests/test_social.py`

`rtk git commit -m "feat: add social conversations and invites UI"`
