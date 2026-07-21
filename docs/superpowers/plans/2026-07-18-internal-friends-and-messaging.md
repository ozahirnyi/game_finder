# Internal Friends and Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Game Finder users share a private-safe profile link, become confirmed friends, and exchange HTTP-based direct messages.

**Architecture:** Add normalized social models and an Alembic migration to the FastAPI/SQLAlchemy backend. Expose a small protected `/social` API consumed by focused React screens; preserve Steam social data as a separate Friends-screen section. Authorization is enforced at every API boundary and the UI only renders state returned by the API.

**Tech Stack:** Python, FastAPI, SQLAlchemy, Alembic, Pydantic, pytest; React, TypeScript, TanStack Router, Vitest, Testing Library.

## Global Constraints

- `users.public_id` is opaque, immutable, URL-safe, and not derived from email.
- Public profiles never expose email or private library data.
- Only confirmed friends can read or send direct messages.
- Message text is trimmed, required, and limited to 2,000 characters; page size defaults to 50.
- Do not modify generated `web/src/routeTree.gen.ts` by hand; regenerate it with the project router workflow.
- Do not stage existing unrelated changes in `app/main.py`, `web/.output`, or generated files.

---

### Task 1: Persist social identities, requests, friendships, and messages

**Files:**
- Modify: `app/database.py`
- Create: `alembic/versions/d4e5f6a7b8c9_add_social_features.py`
- Modify: `tests/test_api_contracts.py`

**Interfaces:**
- Produces `User.public_id`, `FriendRequest`, `Friendship`, and `DirectMessage` ORM models.
- Produces database-level uniqueness for public ids and canonical friendship pairs.

- [ ] **Step 1: Write failing model-contract tests**

```python
def test_social_models_have_public_id_and_canonical_friendship_constraints():
    assert "public_id" in User.__table__.c
    assert FriendRequest.__tablename__ == "friend_requests"
    assert Friendship.__tablename__ == "friendships"
    assert DirectMessage.__tablename__ == "direct_messages"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk pytest -q tests/test_api_contracts.py -k social_models`
Expected: FAIL because the social models and `public_id` do not exist.

- [ ] **Step 3: Add the minimal ORM models and migration**

```python
class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (UniqueConstraint("user_low_id", "user_high_id"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_low_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user_high_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
```

Generate `public_id` with `secrets.token_urlsafe(12)` at user creation, add unique indexes, and write Alembic revision `d4e5f6a7b8c9` with `down_revision = "c3d4e5f6a7b8"`. The migration backfills existing users before making `public_id` non-null, then creates `friend_requests`, `friendships`, and `direct_messages` with foreign keys and timestamps.

- [ ] **Step 4: Run migration and test**

Run: `rtk pytest -q tests/test_api_contracts.py -k social_models`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `rtk git add app/database.py alembic/versions/d4e5f6a7b8c9_add_social_features.py tests/test_api_contracts.py; rtk git commit -m "feat: persist social relationships"`

### Task 2: Define protected social API contracts and request lifecycle

**Files:**
- Modify: `app/schemas.py`
- Modify: `app/main.py`
- Modify: `tests/test_api_contracts.py`

**Interfaces:**
- Consumes the models from Task 1 and `get_current_user`.
- Produces `GET /social/me`, `GET /social/profiles/{public_id}`, `POST /social/friend-requests`, and request accept/decline endpoints.

- [ ] **Step 1: Write failing endpoint tests**

```python
def test_friend_request_lifecycle_and_authorization(authenticated_clients):
    sender, recipient = authenticated_clients
    profile = recipient.get("/social/me").json()["profile"]
    request = sender.post("/social/friend-requests", json={"public_id": profile["public_id"]})
    assert request.status_code == 201
    assert sender.post(f"/social/friend-requests/{request.json()['id']}/accept").status_code == 403
    assert recipient.post(f"/social/friend-requests/{request.json()['id']}/accept").status_code == 200
    assert sender.post("/social/friend-requests", json={"public_id": profile["public_id"]}).status_code == 409
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk pytest -q tests/test_api_contracts.py -k friend_request_lifecycle`
Expected: FAIL with 404 because `/social` routes do not exist.

- [ ] **Step 3: Add schemas and minimal endpoints**

```python
class FriendRequestCreate(BaseModel):
    public_id: str = Field(min_length=8, max_length=64)

@app.post("/social/friend-requests", status_code=201, response_model=FriendRequestRead)
def create_friend_request(payload: FriendRequestCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    recipient = db.query(User).filter(User.public_id == payload.public_id).first()
    # Reject missing recipient, self request, existing friendship, and active duplicate.
```

Return a `SocialMeRead` containing the caller's safe public profile, friends, incoming requests, and outgoing requests. Return viewer-specific relationship state from the public-profile endpoint. Use a UUID request id; only the recipient can accept or decline, and acceptance stores ids sorted by UUID string.

- [ ] **Step 4: Run social API tests**

Run: `rtk pytest -q tests/test_api_contracts.py -k 'friend_request or social_profile'`
Expected: PASS, including self, duplicate, unknown-profile, and unauthorized cases.

- [ ] **Step 5: Commit**

Run: `rtk git add app/schemas.py app/main.py tests/test_api_contracts.py; rtk git commit -m "feat: add social friend requests API"`

### Task 3: Add authorized direct-message API

**Files:**
- Modify: `app/schemas.py`
- Modify: `app/main.py`
- Modify: `tests/test_api_contracts.py`

**Interfaces:**
- Consumes canonical `Friendship` from Task 1.
- Produces `GET` and `POST /social/friends/{friend_id}/messages` and `MessageRead`.

- [ ] **Step 1: Write failing tests**

```python
def test_only_friends_can_send_and_read_messages(friend_clients):
    author, friend, stranger, friend_id = friend_clients
    sent = author.post(f"/social/friends/{friend_id}/messages", json={"text": "  Ready tonight?  "})
    assert sent.status_code == 201
    assert sent.json()["text"] == "Ready tonight?"
    assert friend.get(f"/social/friends/{author_user_id}/messages").status_code == 200
    assert stranger.get(f"/social/friends/{author_user_id}/messages").status_code == 403
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk pytest -q tests/test_api_contracts.py -k friends_can_send`
Expected: FAIL with 404.

- [ ] **Step 3: Implement message lookup and send**

```python
class MessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)

def require_friendship(db: Session, user_id: uuid.UUID, friend_id: uuid.UUID) -> Friendship:
    low, high = sorted((user_id, friend_id), key=str)
    friendship = db.query(Friendship).filter_by(user_low_id=low, user_high_id=high).first()
    if not friendship: raise HTTPException(status_code=403, detail="Only friends can message each other")
    return friendship
```

Strip text before validation, return messages oldest-first, accept an optional cursor and `limit` 1–50, and reject empty-after-trim content with 422.

- [ ] **Step 4: Run tests**

Run: `rtk pytest -q tests/test_api_contracts.py -k 'friends_can_send or message'`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `rtk git add app/schemas.py app/main.py tests/test_api_contracts.py; rtk git commit -m "feat: add friend messaging API"`

### Task 4: Replace the Friends UI and add public profile/message routes

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/features/friends/FriendsScreen.tsx`
- Modify: `web/src/features/friends/friends.test.tsx`
- Create: `web/src/features/friends/PublicProfileScreen.tsx`
- Create: `web/src/features/friends/ConversationScreen.tsx`
- Create: `web/src/routes/users.$publicId.tsx`
- Create: `web/src/routes/friends.$friendId.messages.tsx`
- Regenerate: `web/src/routeTree.gen.ts`

**Interfaces:**
- Consumes the Task 2 `SocialMeRead`/friend-request endpoints and Task 3 message endpoints.
- Produces profile-link sharing, request management, and an HTTP-refreshed direct-message UI.

- [ ] **Step 1: Write failing UI tests**

```tsx
it("copies the public profile URL and accepts an incoming request", async () => {
  vi.mocked(getSocialMe).mockResolvedValue(socialMeWithIncomingRequest);
  render(<FriendsScreen />);
  expect(await screen.findByText("Incoming requests")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Accept" }));
  await waitFor(() => expect(acceptFriendRequest).toHaveBeenCalledWith("request-1"));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk proxy npm --prefix web test -- --run src/features/friends/friends.test.tsx`
Expected: FAIL because the social client functions and controls do not exist.

- [ ] **Step 3: Implement API client and screens**

```ts
export function getSocialMe() { return request<SocialMe>("/social/me", { auth: true }); }
export function sendFriendRequest(public_id: string) {
  return request<FriendRequest>("/social/friend-requests", { method: "POST", auth: true, body: { public_id } });
}
```

`FriendsScreen` loads social data independently of `getSteamSocial`, shows a copy button using `navigator.clipboard.writeText`, handles pending actions with disabled buttons, and keeps Steam results under a labelled section. `PublicProfileScreen` maps the relationship state to one action and never renders email. `ConversationScreen` loads messages on mount, sends trimmed text, then reloads history after a successful post; it displays actionable empty and API-error states.

- [ ] **Step 4: Run focused UI tests and build**

Run: `rtk proxy npm --prefix web test -- --run src/features/friends; rtk proxy npm --prefix web run build`
Expected: PASS and a successful Vite build.

- [ ] **Step 5: Commit**

Run: `rtk git add web/src/lib/api.ts web/src/features/friends web/src/routes/users.\$publicId.tsx web/src/routes/friends.\$friendId.messages.tsx web/src/routeTree.gen.ts; rtk git commit -m "feat: build friends and messages UI"`

### Task 5: Verify the integrated social flow

**Files:**
- Modify: `tests/test_api_contracts.py`
- Modify: `web/src/features/friends/friends.test.tsx`

**Interfaces:**
- Consumes all APIs and UI screens from Tasks 1–4.
- Produces regression coverage for link-to-message flow and no regressions to Steam social display.

- [ ] **Step 1: Write the final failing regression tests**

```python
def test_shared_link_to_request_to_message_flow(authenticated_clients):
    sender, recipient = authenticated_clients
    public_id = recipient.get("/social/me").json()["profile"]["public_id"]
    request_id = sender.post("/social/friend-requests", json={"public_id": public_id}).json()["id"]
    recipient.post(f"/social/friend-requests/{request_id}/accept")
    assert sender.post(f"/social/friends/{recipient_user_id}/messages", json={"text": "Hi"}).status_code == 201
```

- [ ] **Step 2: Run to verify the regression is meaningful**

Run: `rtk pytest -q tests/test_api_contracts.py -k shared_link_to_request; rtk proxy npm --prefix web test -- --run src/features/friends/friends.test.tsx`
Expected: PASS only after the complete implementation; if it already passes before adding the assertion, tighten the assertion.

- [ ] **Step 3: Run the complete verification suite**

Run: `rtk pytest -q; rtk proxy npm --prefix web run lint; rtk proxy npm --prefix web run build`
Expected: all backend tests, frontend lint, and production build pass.

- [ ] **Step 4: Review only owned changes and commit**

Run: `rtk git diff --check; rtk git diff -- app/database.py app/schemas.py app/main.py tests/test_api_contracts.py web/src/lib/api.ts web/src/features/friends web/src/routes alembic/versions; rtk git add tests/test_api_contracts.py web/src/features/friends/friends.test.tsx; rtk git commit -m "test: cover social user flow"`
Expected: no whitespace errors and no unrelated generated output staged.
