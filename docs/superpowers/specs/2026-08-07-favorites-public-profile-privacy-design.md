# Favorites, Public Profile, and Privacy Design

## Purpose and baseline

This phase makes Favorites a real, owner-controlled taste signal and adds a shareable profile page whose server response contains only data the current viewer may access. It deliberately excludes Party Finder, Groups, Discord, onboarding, fake social data, and unrelated visual work.

The current stacked branch already has `users.profile_id`, friend requests, friendships, catalog game detail, wishlist persistence, and authenticated social-profile lookup. It does **not** have a favorites table, visibility columns, a public/anonymous profile route, or first-class profile/privacy UI. The existing `/social/profiles/{profile_id}` is authenticated and returns only identity plus relationship. `profile_id` is a URL-safe, randomly generated public identity, so it will be retained as the public profile identifier; no internal UUID will be placed in a public URL. The existing UUID fallback in friend-resource lookup is not part of the new public-profile flow.

## Considered approaches

1. Extend wishlist with a type field and use one saved-game API. This minimizes tables but conflates purchase intent with taste and risks changing alert/wishlist behavior.
2. Keep favorites client-side or compose them from the library. This avoids a migration but is not durable, cannot support privacy safely, and fails the distinct semantic requirement.
3. **Recommended: create a separate `favorite_items` resource and a profile-privacy projection.** A dedicated table and explicit DTOs keep favorites distinct, while a server-side projection exposes only authorized profile blocks. This is the smallest approach that supports the required states and prevents leakage.

## Data and API design

Add a `FavoriteItem` SQLAlchemy model and Alembic migration. It has an owner, catalog identity (`identity_kind`, `identity_value`), title, optional cover URL, and timestamps, with a uniqueness constraint on owner plus identity. The catalog game-detail UI creates/deletes this resource; it never mutates wishlist or library.

Add four non-null `User` visibility columns with `public` defaults: `library_visibility`, `favorites_visibility`, `wishlist_visibility`, and `steam_visibility`. Their constrained values are `public`, `friends`, and `private`. Existing users therefore preserve the least surprising current sharing posture while private remains explicit. A settings DTO validates all values and a settings response exposes the owner’s `profile_id` for sharing.

Owner endpoints:

- `GET /favorites`, `POST /favorites`, and `DELETE /favorites/{favorite_id}` use authenticated ownership checks.
- `GET /profile/settings` and `PATCH /profile/settings` return/update all four visibility values atomically.

Public endpoint:

- `GET /profiles/{profile_id}` accepts an anonymous request or optional authenticated viewer. Its response is an explicit `PublicProfileRead` DTO with display identity, relationship when known, and four block DTOs.
- Each block has `state: ready | empty | hidden`. Only `ready` contains its safe, block-specific data. `empty` contains no item data; `hidden` contains only generic privacy copy. No hidden response includes counts, titles, covers, Steam IDs, internal UUIDs, or private user fields.
- Access is decided in the service before DTO construction: owner sees every block; a confirmed friend sees `public` and `friends`; anonymous/non-friends see `public`; private is owner-only. Steam’s ready DTO omits Steam ID even where visible and exposes only the already intended public account presentation data.

The existing `POST /social/friend-requests` remains the single mutation path. Public-profile DTOs describe the relationship; the UI offers the action only to authenticated viewers in `none` state. Server checks continue to reject self, duplicate pending, and existing-friend requests.

## Frontend design

The real catalog game-detail screen receives a Favorite action beside the existing real actions. It loads the owner’s favorites only for authenticated sessions, provides pending/error/retry feedback, and labels the feature as games the player likes rather than purchase planning.

The owner account/profile screen adds a Favorites section with real covers/titles, an explicit empty state, and a route/link to privacy settings. Settings presents four simple select controls (Public, Friends, Only me) with helper text explaining who can see each section and saves the complete PATCH payload.

Add a TanStack route at `/users/$profileId` backed by the anonymous-capable public endpoint. It renders each block distinctly as ready, empty, or hidden, never inferring counts from missing data. Anonymous visitors see public blocks and no request action. The owner sees an obvious Edit privacy/settings action. Eligible authenticated visitors can send a friend request and receive pending/success/error feedback. Existing authenticated social discovery may continue using its narrow route; it does not become the public-profile data source.

## Errors, privacy, and compatibility

All controls either perform the real mutation/navigation or are absent. Queries and mutations have loading, error, retry, unavailable, and empty/hidden states as appropriate. Protected source data is never sent merely to be hidden in the browser. Existing wishlist, library, Steam sync, social requests, and notifications remain unchanged except where their data is read into an authorized public projection.

## Test strategy

Pytest covers favorite ownership/add-remove behavior; profile projections for owner, friend, anonymous/non-friend, ready, empty, and hidden cases; and friend-request authorization from a public-profile identity. It also asserts hidden responses lack titles, covers, counts, Steam IDs, and internal identifiers.

Vitest covers game-detail favorite mutation, API client calls, owner settings’ complete payload, owner favorites ready/empty UI, public route ready/empty/hidden/anonymous states, and the eligible friend-request action. Final verification will include focused tests during TDD and full backend/frontend tests, lint, production build, and an isolated temporary-database Alembic upgrade before publishing.

## Scope boundaries

This is one cohesive phase: durable favorites, privacy policy, server projection, and the screens that exercise them. It does not add recommendation behavior from favorites, new profile discovery, Party Finder, Groups, Discord, onboarding, fake social activity, or a redesign.
