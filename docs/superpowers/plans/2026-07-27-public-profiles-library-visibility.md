# Public Profiles and Library Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make profile collections and Steam identity visible according to per-section privacy settings, with reliable covers and navigable PlayFinder profiles.

**Architecture:** Extend `User` with four visibility fields and expose a single owner-safe public profile projection from FastAPI. The projection evaluates owner/friend/stranger access per block before serializing it. React renders the same normalized collection cards in `/profile` and `/users/$publicId`, while friend cards link by PlayFinder `public_id` and Steam-only people retain external Steam links.

**Tech Stack:** FastAPI, SQLAlchemy/Alembic, Pydantic, React, TanStack Router, TanStack Query, Tailwind CSS, pytest, Vitest.

## Global Constraints

- Start in a new `codex/<task>` branch and isolated worktree based on current `origin/main`; never work directly on `main` or phase branches.
- Read `AGENTS.md`; prefix every terminal command with `rtk`, use constrained searches, and use `apply_patch` for edits.
- Use TDD: add a focused failing test, run it, write minimal production code, rerun focused tests, then make a thematic commit.
- Visibility values are exactly `private`, `friends`, and `public`; database defaults and migration backfill are `public`.
- Owners always see their own data; `friends` requires a confirmed `Friendship`; strangers and anonymous viewers are never friends.
- Hidden blocks must not leak count, title, cover URL, app ID, or Steam ID. Return block status `hidden` and an empty data payload.
- Public profile lookup uses `public_id`, never email or database UUID.
- Preserve unrelated changes, do not commit secrets, push a draft PR to `main`, and wait for explicit merge approval. After merge, wait for `Deploy to Lightsail over SSH` and verify `https://playfinder.cc/api/health`.

---

### Task 1: Persist and edit visibility settings

**Files:**
- Modify: `app/database.py`, Alembic migration directory, `app/schemas.py`, `app/main.py`
- Modify: `web/src/lib/api.ts`, `web/src/routes/profile.tsx`
- Test: `tests/test_social_api.py`, `web/src/test/profile.routes.test.tsx` (create if absent)

**Interfaces:** Add `library_visibility`, `favorites_visibility`, `wishlist_visibility`, and `steam_visibility` to `User`. Extend `UserProfileRead` and `UserProfileUpdate` with those four `Literal["private", "friends", "public"]` fields.

- [ ] Write backend tests that create an existing user through the migration path and assert all four values are `public`; assert invalid values receive FastAPI 422; assert PATCH persists four independent values.
- [ ] Run `rtk proxy python -m pytest tests/test_social_api.py -q`; observe missing fields or validation failures.
- [ ] Add non-null `String(16)` columns with server default `public` to `User`, and write an Alembic migration that adds each column with `server_default="public"` before removing the default only if project migration conventions require it.
- [ ] Add the fields to Pydantic read/update models:

```python
Visibility = Literal["private", "friends", "public"]

class UserProfileUpdate(BaseModel):
    library_visibility: Visibility | None = None
    favorites_visibility: Visibility | None = None
    wishlist_visibility: Visibility | None = None
    steam_visibility: Visibility | None = None
```

- [ ] Update the profile PATCH route to assign only non-`None` visibility fields; include all four values in the profile response.
- [ ] Write frontend tests that choose `Only friends` for Library and verify `updateProfile` receives `library_visibility: "friends"` without changing the other selectors.
- [ ] Add four accessible `<select>` controls to `/profile`, with labels `Library visibility`, `Favorites visibility`, `Wishlist visibility`, and `Steam visibility`; use `public`, `friends`, and `private` option values.
- [ ] Run focused backend and frontend tests; commit `feat: add profile visibility settings`.

### Task 2: Build the privacy-safe public profile API

**Files:**
- Modify: `app/main.py`, `app/schemas.py`, `app/crud.py` if a compact public-library mapper is needed
- Test: `tests/test_social_api.py`, `tests/test_api_contracts.py`

**Interfaces:** Add `GET /users/{public_id}` returning `PublicProfileRead` with identity, relationship, and four `DataBlock`s: `library`, `favorites`, `wishlist`, `steam`. Every block has status `ready`, `empty`, or `hidden`.

- [ ] Write failing parameterized tests for owner, confirmed friend, stranger, and anonymous viewer across each visibility value. Assert a hidden library response is exactly `{status: "hidden", data: [], message: "This section is private."}` and contains no collection details.
- [ ] Write a test that a public profile returns manual, PSN, Steam, and catalog saved games owned by that profile, sorted by normalized title.
- [ ] Implement:

```python
def can_view_section(owner: User, viewer: User | None, setting: str, db: Session) -> bool:
    return viewer is not None and viewer.id == owner.id or setting == "public" or (
        setting == "friends" and viewer is not None and are_friends(db, owner.id, viewer.id)
    )
```

Use parentheses to preserve the intended precedence and return a hidden `DataBlock` before querying a blocked collection.
- [ ] Map library records to `PublicLibraryGameRead` with `id`, `title`, `source`, `cover_url`, `playtime_forever`, and `detail_game_id`; set cover in this order: stored catalog/collection URL, Steam CDN icon URL when `source == "steam"` and both external ID and icon hash exist, then `None`.
- [ ] Reuse `collection_response` for favorites and wishlist so stored `cover_url` travels to the public projection. Include `{linked, persona_name, avatar, profile_url}` for Steam only when visible; build `profile_url` as `https://steamcommunity.com/profiles/{steam_id}` only for a non-empty numeric Steam ID.
- [ ] Keep the current `/social/profiles/{public_id}` relation endpoint for friend-management UI, but make it return/consume the same identity contract or document its narrower purpose; do not expose profile collections from it.
- [ ] Run `rtk proxy python -m pytest tests/test_social_api.py tests/test_api_contracts.py -q`; commit `feat: expose privacy-safe public profiles`.

### Task 3: Repair owner profile data and game covers

**Files:**
- Modify: `app/main.py`, `web/src/routes/profile.tsx`, `web/src/components/GameCover.tsx` only if fallback handling is missing
- Test: `tests/test_api_contracts.py`, `web/src/test/profile.routes.test.tsx`

**Interfaces:** The owner profile summary uses the same `library_block`, `favorites_block`, and `wishlist_block` data as public profiles. `GameCover` accepts `src: string | null` and preserves its existing gradient fallback when `src` is absent or errors.

- [ ] Write failing API tests that create manual games, favorites, and wishlist rows and assert `/profile/summary` returns every item with its saved `cover_url` where present.
- [ ] Write frontend tests that render manual library game, favorite game, and active wishlist from the summary response and assert each has its title plus either the expected image URL or fallback presentation.
- [ ] Diagnose source filtering in `library_block` and profile rendering; remove any filter that excludes `source == "manual"` or treats it as an unsupported platform.
- [ ] Normalize owner cards through a single helper that uses `item.cover_url` first, then the Steam CDN URL for valid Steam records, then `null`; pass that value to `GameCover` rather than a demo image.
- [ ] Render the owner nickname from the current social/profile payload in the profile header. Do not substitute email as public nickname when the account has `public_nickname`.
- [ ] Run focused tests; commit `fix: show live profile collections and covers`.

### Task 4: Render the public profile route and privacy states

**Files:**
- Modify: `web/src/lib/api.ts`, `web/src/features/friends/PublicProfileScreen.tsx`, `web/src/routes/users.$publicId.tsx`
- Test: `web/src/test/friends-social-source.routes.test.tsx`, `web/src/features/friends/friends.test.tsx`

**Interfaces:** Add `getPublicProfile(publicId)` returning identity plus section blocks. `PublicProfileScreen` renders public identity, Steam link, and collection sections without owner edit controls.

- [ ] Write failing tests for: public Library card appears with a cover; hidden Favorites renders `This section is private.`; empty Wishlist renders its empty message; Steam link has the expected `https://steamcommunity.com/profiles/<id>` href; no Steam button is rendered when `profile_url` is null.
- [ ] Run `rtk npm --prefix web test -- --run src/test/friends-social-source.routes.test.tsx src/features/friends/friends.test.tsx`; observe that only the current social relationship payload is available.
- [ ] Add TypeScript types:

```ts
type PublicSection<T> = { status: "ready" | "empty" | "hidden"; data: T; message?: string | null };
type PublicProfile = { public_id: string; nickname: string; avatar: string | null; relationship: string; library: PublicSection<PublicLibraryGame[]>; favorites: PublicSection<CatalogCollectionItem[]>; wishlist: PublicSection<CatalogCollectionItem[]>; steam: PublicSection<PublicSteamAccount | null> };
```

- [ ] Replace the relationship-only request in `PublicProfileScreen` with `getPublicProfile`; retain existing add/cancel/accept friend actions using the returned `relationship` and public ID.
- [ ] Use `GameCover` for Library, Favorite games, and Active wishlist; use a visible fallback when `cover_url` is null. Render `hidden` as a locked section message, `empty` as the server message, and `ready` as cards.
- [ ] Make the Steam profile action a normal external `<a target="_blank" rel="noreferrer">View Steam profile</a>` only if the public steam block is ready and has a non-null `profile_url`.
- [ ] Run focused tests; commit `feat: render public profile collections`.

### Task 5: Link friends and Steam friends to real profiles

**Files:**
- Modify: `app/main.py`, `app/schemas.py`, `web/src/lib/api.ts`, `web/src/features/friends/FriendsScreen.tsx`
- Test: `tests/test_social_api.py`, `web/src/test/friends-social-workspace.test.tsx`

**Interfaces:** Add optional `public_id: str | None` to Steam-friend read records. Internal friend records already use PlayFinder identity and must retain a non-null `public_id`.

- [ ] Write a failing backend test where a Steam friend’s `steam_id` matches a `User.steam_id` and assert the response includes that user’s `public_id`; assert an unmatched Steam friend has `public_id is None`.
- [ ] In the Steam social aggregation route, load matching PlayFinder users by the paged Steam friend IDs and attach only their `public_id`; never attach email, database user ID, or visibility settings.
- [ ] Write frontend tests that a friend card links to `/users/<public_id>`, an eligible Steam friend card links to the same route, and an unmatched Steam friend has only the external Steam URL/status.
- [ ] Replace card-wide message-only interaction with explicit `View profile` links. Preserve `Message` actions for confirmed internal friends and do not invent a message route for unmatched Steam friends.
- [ ] Run focused suites; commit `feat: link friends to public profiles`.

### Task 6: Integration, visual QA, and release

**Files:**
- Modify only files required by failures found in this task
- Test: all backend and frontend suites

- [ ] Run `rtk proxy python -m pytest -q`.
- [ ] Run `rtk npm --prefix web test -- --run`, `rtk npm --prefix web run build`, and `rtk git diff --check`.
- [ ] Start the local frontend/backend using the repository’s documented development commands. At 320px, 390px, and desktop widths visually inspect `/profile`, `/users/<publicId>`, and `/friends`: covers are contained, hidden states do not leak data, Steam button remains inside the card, and friend profile links work.
- [ ] Review `rtk git status --short` and the scoped diff; stage only task files, commit any integration fix, push `codex/<task>`, and open a draft PR to `main` listing each verification command.
- [ ] After explicit merge approval only: mark ready, merge, wait for `Deploy to Lightsail over SSH` for the merged SHA, then run `rtk proxy curl.exe --fail --silent --show-error --max-time 15 https://playfinder.cc/api/health` and require `{"status":"ok"}`.
