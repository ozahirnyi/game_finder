# Steam Friends and TanStack Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make game URLs directly loadable, show Steam personas, support GameFinder friend requests and Steam-contact suggestions, and remove the unused Next-style frontend tree.

**Architecture:** FastAPI owns the social graph and produces a privacy-safe social snapshot. The active React/Vite/TanStack Start routes render API-backed feature screens; reusable feature components remain separate from route files. Only after routes and tests no longer reference `src/app` will the inactive Next-style files be removed.

**Tech Stack:** Python 3, FastAPI, SQLAlchemy, Alembic, Pydantic, pytest; React 19, TypeScript, TanStack Start/Router, Vite, Vitest, Testing Library.

## Global Constraints

- Use TanStack Start/Router as the only frontend runtime; do not add Next.js.
- Never expose `steam-<id>@steam.invalid` in a user-facing response or UI label.
- GameFinder friendships require an explicit request and acceptance; Steam links are outbound links only.
- Preserve unrelated dirty working-tree changes and do not stage them.
- Delete `web/src/app` and Next artifacts only after their active TanStack equivalents and tests pass.

---

### Task 1: Persist and expose GameFinder friendship state

**Files:**
- Modify: `app/database.py`
- Modify: `app/schemas.py`
- Modify: `app/main.py`
- Create: `alembic/versions/a1c4d6e8f0b2_add_gamefinder_friendships.py`
- Test: `tests/test_api_contracts.py`

**Interfaces:**
- Produces `FriendRequest`, `Friendship`, `SocialSnapshotRead`, `SocialUserRead`, and `FriendRequestRead`.
- Produces authenticated endpoints `GET /social/me`, `POST /social/friend-requests`, `POST /social/friend-requests/{request_id}/accept`, and `POST /social/friend-requests/{request_id}/decline`.
- Consumes `User`, `get_current_user`, and the existing Steam profile fields.

- [ ] **Step 1: Add failing backend contract tests for social lifecycle and display labels**

  Add fixtures with three UUID users and assert that `GET /social/me` uses `steam_persona_name`, never the synthetic email, starts with no relationships, accepts a request, and rejects self, duplicate, and non-recipient actions.

  ```python
  def test_social_request_lifecycle_and_persona_label(client, override_user):
      override_user(owner)
      assert client.get("/social/me").json()["friends"] == []
      sent = client.post("/social/friend-requests", json={"recipient_id": str(friend.id)})
      assert sent.status_code == 201
      override_user(friend)
      accepted = client.post(f"/social/friend-requests/{sent.json()['id']}/accept")
      assert accepted.status_code == 200
      assert accepted.json()["friends"][0]["display_name"] == "Friend persona"
  ```

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run: `rtk pytest tests/test_api_contracts.py -q`

  Expected: failure because `/social/me` and friend-request endpoints do not exist.

- [ ] **Step 3: Add canonical models and migration**

  In `app/database.py`, define an unordered `Friendship` pair and directional `FriendRequest` with `pending`, `accepted`, and `declined` status. Enforce the unordered pair with an ordered UUID check/index and enforce one directional request pair. The migration creates both tables, foreign keys to `users.id`, timestamps, and relevant unique indexes.

  ```python
  class Friendship(Base):
      __tablename__ = "friendships"
      user_low_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
      user_high_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
      created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
  ```

- [ ] **Step 4: Add Pydantic schemas and endpoint helpers**

  Add a `social_user_response(user)` helper in `app/main.py` that returns `id`, `display_name`, `avatar`, `steam_profile_url`, and `steam_add_url`; populate URLs only when `user.steam_id` exists. Implement request validation and authorization in small helpers, then return a `SocialSnapshotRead` from every mutation so the UI can replace its current state atomically.

  ```python
  def social_user_response(user: User) -> SocialUserRead:
      name = (user.steam_persona_name or "").strip() or "GameFinder player"
      base = f"https://steamcommunity.com/profiles/{user.steam_id}" if user.steam_id else None
      return SocialUserRead(id=user.id, display_name=name, avatar=user.steam_avatar,
          steam_profile_url=base, steam_add_url=f"{base}/friends/add" if base else None)
  ```

- [ ] **Step 5: Run the focused tests to verify they pass**

  Run: `rtk pytest tests/test_api_contracts.py -q`

  Expected: PASS for the new social tests and existing API contracts.

- [ ] **Step 6: Commit only social backend files**

  ```powershell
  rtk git add app/database.py app/schemas.py app/main.py alembic/versions/a1c4d6e8f0b2_add_gamefinder_friendships.py tests/test_api_contracts.py
  rtk git commit -m "feat: add GameFinder friend requests"
  ```

### Task 2: Match Steam contacts to registered GameFinder users

**Files:**
- Modify: `app/main.py`
- Test: `tests/test_api_contracts.py`

**Interfaces:**
- Consumes `fetch_steam_friends`, `Friendship`, `FriendRequest`, and `social_user_response` from Task 1.
- Extends `GET /social/me` with `steam_suggestions: list[SocialUserRead]`.

- [ ] **Step 1: Add failing suggestion/exclusion tests**

  Mock `fetch_steam_friends` to return Steam IDs for a registered contact and an unregistered contact. Assert only the registered contact appears, then assert it disappears after a pending request and after an accepted friendship.

  ```python
  monkeypatch.setattr(main, "fetch_steam_friends", fake_steam_friends)
  response = client.get("/social/me")
  assert [item["id"] for item in response.json()["steam_suggestions"]] == [str(registered.id)]
  ```

- [ ] **Step 2: Run the new tests to verify failure**

  Run: `rtk pytest tests/test_api_contracts.py -q`

  Expected: FAIL because the social snapshot contains no Steam suggestions.

- [ ] **Step 3: Implement server-side matching with graceful Steam failure handling**

  When the viewer has a Steam ID, call `fetch_steam_friends`, query `User.steam_id.in_(returned_ids)`, and remove self, friends, incoming requests, and outgoing requests. If Steam reports a private/unavailable list, return the internal snapshot with an empty suggestion list and a `steam_suggestions_error` message; do not fail confirmed friendships.

- [ ] **Step 4: Run the focused tests to verify pass**

  Run: `rtk pytest tests/test_api_contracts.py -q`

  Expected: PASS.

- [ ] **Step 5: Commit the matching behavior**

  ```powershell
  rtk git add app/main.py tests/test_api_contracts.py
  rtk git commit -m "feat: suggest registered Steam friends"
  ```

### Task 3: Define frontend social contracts and persona profile API

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/lib/api.test.ts`
- Test: `web/src/lib/api.test.ts`

**Interfaces:**
- Consumes backend `UserRead` with `display_name` and `SocialSnapshotRead` from Tasks 1–2.
- Produces `getSocialSnapshot()`, `sendFriendRequest(recipientId)`, `acceptFriendRequest(requestId)`, and `declineFriendRequest(requestId)`.

- [ ] **Step 1: Add failing API-client tests**

  Assert the authenticated request paths and bodies for snapshot and each mutation, including URL-encoding of IDs.

  ```ts
  await sendFriendRequest("user-2");
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/social/friend-requests"), expect.objectContaining({ method: "POST" }));
  ```

- [ ] **Step 2: Run the focused test to verify failure**

  Run: `rtk npm --prefix web test -- --run src/lib/api.test.ts`

  Expected: FAIL because social client functions/types do not exist.

- [ ] **Step 3: Add typed client models and calls**

  Extend `UserRead` with `display_name: string`. Add `SocialUser`, `SocialFriendRequest`, and `SocialSnapshot` types. Each mutation must use `auth: true` and return the updated snapshot.

- [ ] **Step 4: Run the focused test to verify pass**

  Run: `rtk npm --prefix web test -- --run src/lib/api.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit the client contract**

  ```powershell
  rtk git add web/src/lib/api.ts web/src/lib/api.test.ts
  rtk git commit -m "feat: add social API client"
  ```

### Task 4: Render GameFinder friends, Steam proposals, and persona labels

**Files:**
- Modify: `web/src/features/friends/FriendsScreen.tsx`
- Modify: `web/src/features/friends/friends.test.tsx`
- Modify: `web/src/features/integrations/ProfileScreen.tsx`
- Modify: `web/src/features/integrations/integrations.test.tsx`

**Interfaces:**
- Consumes social functions from Task 3 and existing `getSteamSocial()`.
- Produces a Friends screen that keeps internal friendship data available even when Steam social data fails.

- [ ] **Step 1: Add failing UI tests**

  Mock `getSocialSnapshot` and assert sections for incoming requests, confirmed friends, and Steam suggestions. Assert Add, Accept, and Decline call the corresponding client function and replace displayed data. Assert confirmed Steam-linked friends expose profile/add links with `target="_blank"`. Assert ProfileScreen uses `user.display_name` instead of synthetic email.

  ```tsx
  expect(await screen.findByRole("heading", { name: "Friends from Steam on GameFinder" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Add on Steam" })).toHaveAttribute("href", "https://steamcommunity.com/profiles/765/friends/add");
  ```

- [ ] **Step 2: Run the focused frontend tests to verify failure**

  Run: `rtk npm --prefix web test -- --run src/features/friends/friends.test.tsx src/features/integrations/integrations.test.tsx`

  Expected: FAIL because the unified social screen has not been implemented.

- [ ] **Step 3: Implement independent social and Steam loading states**

  Load the social snapshot separately from existing Steam library-overlap data. Render internal friend data regardless of Steam status; use inline errors for failed mutations and retain the last successful snapshot. Change the Profile title to `user.display_name` and do not render `user.email` as the primary label.

- [ ] **Step 4: Run focused UI tests to verify pass**

  Run: `rtk npm --prefix web test -- --run src/features/friends/friends.test.tsx src/features/integrations/integrations.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit UI social behavior**

  ```powershell
  rtk git add web/src/features/friends/FriendsScreen.tsx web/src/features/friends/friends.test.tsx web/src/features/integrations/ProfileScreen.tsx web/src/features/integrations/integrations.test.tsx
  rtk git commit -m "feat: show GameFinder Steam friend proposals"
  ```

### Task 5: Migrate active TanStack routes to API-backed feature screens

**Files:**
- Modify: `web/src/routes/index.tsx`
- Modify: `web/src/routes/search.tsx`
- Modify: `web/src/routes/games.$gameId.tsx`
- Modify: `web/src/routes/friends.tsx`
- Modify: `web/src/routes/profile.tsx`
- Modify: `web/src/routes/steam.tsx`
- Modify: `web/src/routes/psn.tsx`
- Modify: `web/src/routes/library.tsx`
- Modify: `web/src/routes/wishlist.tsx`
- Modify: `web/src/routes/deals.tsx`
- Modify: `web/src/routes/login.tsx`
- Modify: `web/src/routes/register.tsx`
- Modify: `web/src/routes/auth.callback.tsx`
- Test: `web/src/test/routes.integration.test.ts`
- Test: `web/src/features/discovery/discovery.test.tsx`

**Interfaces:**
- Consumes existing feature components and Task 3 API functions.
- Produces active file-based routes that do not use `mockData` for catalog/friends pages.

- [ ] **Step 1: Add failing active-route tests for catalog navigation and direct route rendering**

  In the TanStack router test harness, render a catalog card and assert the anchor is `/games/3498` (not `/games/$gameId`). Start the router at `/games/3498` and assert `GameDetailScreen` loads the catalog API result.

  ```tsx
  expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute("href", "/games/3498");
  ```

- [ ] **Step 2: Run the focused tests to verify failure**

  Run: `rtk npm --prefix web test -- --run src/test/routes.integration.test.ts src/features/discovery/discovery.test.tsx`

  Expected: FAIL because the active game route resolves static mock data instead of the API-backed detail screen.

- [ ] **Step 3: Replace each active route body with its feature screen**

  Keep `createFileRoute` declarations, metadata, and route paths. Replace mock page implementations with the corresponding API-backed feature component. For `/games/$gameId`, use `Route.useParams().gameId` and render `GameDetailScreen`; do not retain its mock loader. In catalog/listing feature components, keep TanStack `Link` but provide the actual `to="/games/$gameId"` and `params={{ gameId: String(game.id) }}` so the generated href is `/games/<id>`.

- [ ] **Step 4: Run route and discovery tests to verify pass**

  Run: `rtk npm --prefix web test -- --run src/test/routes.integration.test.ts src/features/discovery/discovery.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit the active-route migration**

  ```powershell
  rtk git add web/src/routes web/src/test/routes.integration.test.ts web/src/features/discovery/discovery.test.tsx
  rtk git commit -m "refactor: use API screens from TanStack routes"
  ```

### Task 6: Remove inactive Next-style artifacts and repair test imports

**Files:**
- Delete: `web/src/app/`
- Delete: `web/next.config.ts`
- Delete: `web/next-env.d.ts`
- Modify: `web/README.md`
- Modify: `web/src/features/discovery/discovery.test.tsx`
- Modify: `web/src/features/integrations/integrations.test.tsx`
- Test: `web/src/test/routes.integration.test.ts`

**Interfaces:**
- Consumes active routes from Task 5.
- Produces a Vite/TanStack-only source tree with no `@/app` imports.

- [ ] **Step 1: Add a failing source-boundary assertion**

  Add a route-level test or repository check that asserts no source file imports `@/app/`; update the two existing tests to import a feature component or render an active route instead of a deleted page module.

- [ ] **Step 2: Run affected tests to verify failure before removal**

  Run: `rtk npm --prefix web test -- --run src/features/discovery/discovery.test.tsx src/features/integrations/integrations.test.tsx src/test/routes.integration.test.ts`

  Expected: tests identify the old `@/app` imports before they are changed.

- [ ] **Step 3: Remove the inactive tree after updating imports**

  Replace the stale Next README with TanStack Start/Vite commands. Remove the files listed above only after every replacement import points at a feature or active route. Use targeted deletion of the explicit `web/src/app` directory after confirming its resolved path is inside the workspace.

- [ ] **Step 4: Verify the source boundary and build**

  Run: `rtk rg -n --max-count 1 "@/app|next/|from ['\"]next" web/src web/package.json`

  Expected: no matches.

  Run: `rtk npm --prefix web run build`

  Expected: exit code 0.

- [ ] **Step 5: Commit cleanup**

  ```powershell
  rtk git add -A web/src/app web/next.config.ts web/next-env.d.ts web/README.md web/src/features/discovery/discovery.test.tsx web/src/features/integrations/integrations.test.tsx web/src/test/routes.integration.test.ts
  rtk git commit -m "refactor: remove inactive Next frontend tree"
  ```

### Task 7: Run full verification and prepare review

**Files:**
- Modify: only files required by failures found in verification

**Interfaces:**
- Consumes all completed tasks.
- Produces verified backend contracts, frontend tests, lint, and production build.

- [ ] **Step 1: Run backend suite**

  Run: `rtk pytest -q`

  Expected: PASS.

- [ ] **Step 2: Run frontend test suite and lint**

  Run: `rtk npm --prefix web test`

  Expected: PASS.

  Run: `rtk npm --prefix web run lint`

  Expected: exit code 0.

- [ ] **Step 3: Run production build**

  Run: `rtk npm --prefix web run build`

  Expected: exit code 0.

- [ ] **Step 4: Inspect only this task's diff and commit fixes if needed**

  Run: `rtk diff --stat` and `rtk git status --short`

  Expected: the diff contains only this task's backend, frontend, migration, tests, and documentation; pre-existing user changes remain unstaged.

- [ ] **Step 5: Push branch and open a pull request**

  ```powershell
  rtk git push -u origin codex/steam-friends-catalog-links
  ```

  Create a pull request describing the API social graph, Steam-match behavior, active TanStack route migration, and removal of Next remnants.
