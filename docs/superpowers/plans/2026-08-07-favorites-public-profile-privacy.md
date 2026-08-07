# Favorites, Public Profile, and Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable favorites and a privacy-safe shareable public profile with working owner controls.

**Architecture:** Persist favorites independently of wishlist; add four visibility policies to `User`; construct one server-side public-profile projection for an optional viewer. React queries consume that projection on `/users/$profileId`, while authenticated owner pages use separate favorite and settings endpoints.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic v2, pytest, React, TanStack Router/Query, Vitest.

## Global Constraints

- The safe `profile_id` is the URL identity; no user UUID appears in a public URL or DTO.
- Visibility is exactly `public`, `friends`, or `private`, enforced before serialization.
- Hidden blocks contain no count, title, cover, Steam ID, internal ID, or private field.
- Favorites remain distinct from wishlist/library. No recommendation behavior, Party Finder, Groups, Discord, onboarding, fake data, or redesign.
- For every production change: write focused failing test, verify RED, apply minimum code, verify GREEN. Preserve unrelated/generated output.

## File map

- Backend persistence/API: `app/database.py`, `app/schemas.py`, `app/favorites.py`, `app/social.py`, `app/main.py`, `alembic/versions/<revision>_add_favorites_profile_privacy.py`.
- Backend test: `tests/test_favorites_profile_privacy.py`.
- Client/API: `web/src/lib/api.ts`, `web/src/lib/api.test.ts`.
- Owner UI: `web/src/features/discovery/GameDetailScreen.tsx`, `web/src/features/integrations/ProfileScreen.tsx` and their tests.
- Public UI: `web/src/features/social/ProfileScreen.tsx`, its test, `web/src/routes/users.$profileId.tsx`, generated `web/src/routeTree.gen.ts`.

### Task 1: Favorite persistence and owner API

**Files:** create `app/favorites.py`, migration, and `tests/test_favorites_profile_privacy.py`; modify `app/database.py`, `app/schemas.py`, `app/main.py`.

**Interfaces:** `FavoriteItemCreate(identity_kind, identity_value, title, cover_url)`, `FavoriteItemRead`; authenticated `GET /favorites`, `POST /favorites`, and owner-scoped `DELETE /favorites/{item_id}`.

- [ ] **Step 1: Write the failing ownership/semantic test.**

```python
created = client_as_alice.post('/favorites', json={'identity_kind': 'rawg', 'identity_value': '30', 'title': 'Hades', 'cover_url': 'https://cover'})
assert created.status_code == 201
assert client_as_alice.get('/favorites').json()[0]['title'] == 'Hades'
assert client_as_bob.delete(f"/favorites/{created.json()['id']}").status_code == 404
```

- [ ] **Step 2: Verify RED.** Run `rtk pytest -q tests/test_favorites_profile_privacy.py -k favorite`; expect missing favorite API/model failure.

- [ ] **Step 3: Implement minimally.** Add `FavoriteItem` with `user_id`, rawg/steam identity, title, optional cover, timestamps, and unique owner+identity constraint. Add matching Pydantic DTOs/service functions; return duplicate as 409 and query delete by item plus owner. Add migration and three routes. Never reuse `WishlistItem`.

- [ ] **Step 4: Verify GREEN.** Run `rtk pytest -q tests/test_favorites_profile_privacy.py -k favorite`; expect PASS. Run `rtk alembic upgrade head`; expect migration success.

- [ ] **Step 5: Commit.** Stage only Task 1 files and commit `feat: add owned favorites`.

### Task 2: Privacy policy and anonymous-safe public projection

**Files:** modify `app/database.py`, `app/schemas.py`, `app/social.py`, `app/main.py`, Task 1 migration; extend `tests/test_favorites_profile_privacy.py` and `tests/test_social.py`.

**Interfaces:** `ProfileSettingsUpdate` and `ProfileSettingsRead` contain all four visibility fields. `PublicProfileRead` has identity, relationship, and `library`, `favorites`, `wishlist`, `steam` blocks of `state: ready | empty | hidden`. Add `GET/PATCH /profile/settings` and anonymous-capable `GET /profiles/{profile_id}`.

- [ ] **Step 1: Write failing authorization/leak tests.**

```python
response = anonymous_client.get(f'/profiles/{owner.profile_id}')
assert response.json()['favorites'] == {'state': 'hidden', 'message': 'This section is private.'}
assert hidden_favorite.title not in response.text
assert 'steam_id' not in response.text
assert client_as_friend.get(f'/profiles/{owner.profile_id}').json()['favorites']['state'] == 'ready'
```

- [ ] **Step 2: Verify RED.** Run `rtk pytest -q tests/test_favorites_profile_privacy.py -k 'profile or visibility or friend_request'`; expect absent DTO/route failure.

- [ ] **Step 3: Implement minimally.** Add non-null default-`public` user columns. Add an optional bearer-token resolver that permits a missing token. Use `relationship == self`, `public`, or `friends and relationship == friends` to authorize each block before its source query/serialization. Emit generic hidden block only; emit `ready` with safe items or `empty` with no item data. Steam never exposes its numeric ID. Keep existing social routes compatible and friend requests’ self/duplicate/friend server checks unchanged.

- [ ] **Step 4: Verify GREEN.** Run `rtk pytest -q tests/test_favorites_profile_privacy.py tests/test_social.py`; expect PASS for owner/friend/anonymous/non-friend plus request eligibility.

- [ ] **Step 5: Commit.** Stage Task 2 files and commit `feat: add public profile privacy`.

### Task 3: Typed client, game-detail favorite action, and owner settings

**Files:** modify `web/src/lib/api.ts`, `web/src/features/discovery/GameDetailScreen.tsx`, `web/src/features/integrations/ProfileScreen.tsx`; extend `web/src/lib/api.test.ts`, `web/src/features/discovery/discovery.test.tsx`, and `web/src/features/integrations/integrations.test.tsx`.

**Interfaces:** export `FavoriteItem`, `ProfileSettings`, `listFavorites`, `createFavorite`, `deleteFavorite`, `getProfileSettings`, `updateProfileSettings`, and `getPublicProfile`.

- [ ] **Step 1: Write failing mutation/settings tests.**

```tsx
await userEvent.click(await screen.findByRole('button', { name: 'Add to favorites' }))
expect(createFavorite).toHaveBeenCalledWith({ identity_kind: 'rawg', identity_value: '30', title: 'Hades', cover_url: null })
await userEvent.click(await screen.findByRole('button', { name: 'Save privacy' }))
expect(updateProfileSettings).toHaveBeenCalledWith(expect.objectContaining({ library_visibility: 'public', favorites_visibility: 'friends', wishlist_visibility: 'private', steam_visibility: 'public' }))
```

- [ ] **Step 2: Verify RED.** Run `rtk npm.cmd --prefix web test -- --run src/lib/api.test.ts src/features/discovery/discovery.test.tsx src/features/integrations/integrations.test.tsx`; expect missing functions/controls.

- [ ] **Step 3: Implement minimally.** Use TanStack Query/mutations on real catalog detail and submit the actual RAWG identifier/title/cover. Show add/remove, pending, error/retry; omit control when signed out. On owner profile show real favorite covers/titles or clear empty state, a shareable `/users/$profileId` link, and four labelled Public/Friends/Only me controls with helper text, loading/error/retry, and complete atomic PATCH.

- [ ] **Step 4: Verify GREEN.** Re-run the exact Step 2 command; expect PASS.

- [ ] **Step 5: Commit.** Stage Task 3 files and commit `feat: add favorite and privacy controls`.

### Task 4: Public profile view and publishing verification

**Files:** modify `web/src/features/social/ProfileScreen.tsx`, its test, `web/src/routes/users.$profileId.tsx`; regenerate `web/src/routeTree.gen.ts` using the normal router-generation command.

**Interfaces:** `ProfileScreen({ profileId })` calls `getPublicProfile(profileId)`, renders each server block state, calls `sendFriendRequest({ profile_id })` only for authenticated `relationship === 'none'`, and gives owners a settings route.

- [ ] **Step 1: Write failing ready/empty/hidden/anonymous tests.**

```tsx
vi.mocked(getPublicProfile).mockResolvedValue(hiddenProfile)
renderPublicRoute('/users/alex-safe-id')
expect(await screen.findByText('This section is private.')).toBeVisible()
expect(screen.queryByText('Secret game')).not.toBeInTheDocument()
renderPublicRoute('/users/alex-safe-id', { authenticated: false })
expect(screen.queryByRole('button', { name: 'Send friend request' })).toBeNull()
```

- [ ] **Step 2: Verify RED.** Run `rtk npm.cmd --prefix web test -- --run src/features/social/ProfileScreen.test.tsx`; expect the minimal authenticated profile screen to fail the new cases.

- [ ] **Step 3: Implement minimally.** Render ready data, explicit empty copy, and generic hidden copy without client-side inference. Provide loading, error/retry, unavailable, request pending/error, anonymous omission, and owner settings navigation. Do not hand-edit generated route output.

- [ ] **Step 4: Verify GREEN and full suite.** Run `rtk npm.cmd --prefix web test -- --run src/features/social/ProfileScreen.test.tsx`, then `rtk pytest -q`, `rtk npm.cmd --prefix web test -- --run`, `rtk npm.cmd --prefix web run lint`, and `rtk npm.cmd --prefix web run build`; all must pass. Set an isolated temporary `DATABASE_URL` and run `rtk alembic upgrade head`; it must reach head.

- [ ] **Step 5: Commit and publish.** Commit `feat: add public profile viewer`; push `codex/favorites-public-profile-privacy`; open a draft PR targeting `codex/social-foundation-notifications-continuation`, include exact verification evidence, and never stage `web/.output`.
