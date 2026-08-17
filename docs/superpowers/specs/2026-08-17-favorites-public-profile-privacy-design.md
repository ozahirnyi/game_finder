# Phase 3: Favorites, Public Profiles, and Privacy Controls Design

**Status:** approved for planning  
**Date:** 2026-08-17  
**Product source:** `C:\Users\zagir\Downloads\AyuGram Desktop\2026-08-06-user-flow-fixes.md`, Specs 6 and 7  
**Audited implementation baseline:** `origin/main` at `a0b92f3`  
**Canonical public-profile route:** `/users/$publicId`

## Goal

Let a signed-in owner curate catalog favorites as a distinct taste signal, choose visibility for library, favorites, wishlist, and Steam data, and share a public profile that reveals only server-authorized information. Visitors can send an existing real friend request only when authenticated and eligible.

## Audited current contracts

### Backend

- `GET /favorites` returns the authenticated owner's collection. `POST /favorites` creates a manual catalog collection record, and `DELETE /favorites/{catalog_game_id}` removes only the authenticated owner's record.
- `POST /favorites/catalog-games/{igdb_id}` resolves a real IGDB catalog game, creates the authenticated owner's favorite, and is idempotent: an existing favorite returns `200`; a new favorite returns `201`.
- `GET /profile` returns all owner profile fields. `PATCH /profile` accepts `library_visibility`, `favorites_visibility`, `wishlist_visibility`, and `steam_visibility`, each constrained to `public`, `friends`, or `private`.
- `GET /users/{public_id}` is the public-profile aggregation contract. It accepts an anonymous or authenticated viewer and returns `library`, `favorites`, `wishlist`, and `steam` blocks independently as `ready`, `empty`, or `hidden`.
- Visibility is server-authoritative: owners can always view themselves; `public` admits everyone; `friends` admits confirmed friends only; `private` admits no other viewer. A hidden block is exactly an empty data array with the generic private message.
- The public response includes a relationship state: `none`, `self`, `friends`, `outgoing_pending`, or `incoming_pending`.
- `POST /social/friend-requests` with `{ public_id }` is the real public-identity friend-request action. It requires a signed-in viewer with a public nickname and rejects self, friend, and pending relationships.
- Existing backend tests cover favorite owner scoping, profile persistence, and library no-leak behavior. They do not yet cover the full public-profile no-leak matrix across every section.

### Active frontend

- The active frontend is Vite/TanStack under `web/src/routes`; its game route is `/games/$gameId` and owner account route is `/account`.
- Game detail has real wishlist, alert, and invite behavior but no favorite client call or action.
- The API client has no favorites functions, public-profile response types, public-profile query, or social public-request mutation.
- The account route uses `ProfileView`. It currently presents only `library_visibility`, and its owner profile types omit the other three existing server fields.
- No active `/users/$publicId` route exists. No Phase 3 frontend tests exist.

## Approved design

### Favorites

Add a favorite toggle only to existing catalog (IGDB) game detail. The control uses `GET /favorites` to determine current state, `POST /favorites/catalog-games/{igdb_id}` to add, and `DELETE /favorites/{catalog_game_id}` to remove. It has clear pending and inline error states, invalidates the favorites query after a successful mutation, and does not add a pretend favorite action to Steam-only pages.

On `/account`, show a distinct **Favorites** section populated from the owner-scoped favorite collection. It describes favorites as games that represent the owner's taste, not games the owner plans to buy. Its ready and empty states are explicit. Wishlist and library retain their current separate semantics and presentation.

### Profile settings

Extend the existing profile-settings dialog rather than adding a parallel settings screen. It will expose these four independent fields:

| Setting | Plain-language choices |
| --- | --- |
| Library | Public; Friends only; Only me |
| Favorites | Public; Friends only; Only me |
| Wishlist | Public; Friends only; Only me |
| Steam profile | Public; Friends only; Only me |

The dialog includes concise helper text explaining that these choices control what visitors can see through the public-profile link. Saving submits one truthful `PATCH /profile` payload containing the current visibility fields, together with any edited existing profile fields. The UI does not claim that local selection changes access until the mutation succeeds.

### Public profile

Add the canonical TanStack route `/users/$publicId`, backed exclusively by `GET /users/{public_id}`. It renders the server-returned public identity and each independent section without recreating visibility policy on the client.

| Server status | UI behavior |
| --- | --- |
| `ready` | Render the returned authorized items or Steam data. |
| `empty` | Render the server's neutral empty message. |
| `hidden` | Render a generic privacy message only. Do not render counts, titles, covers, Steam IDs, or any inferred placeholder. |

The owner sees a clear **Profile settings** path to `/account`. The owner never sees a friend-request action. Anonymous visitors see only returned public content and no authenticated actions. An authenticated visitor sees **Add friend** only when the relationship is `none`; the action invokes the existing `/social/friend-requests` contract. Friend, pending, self, and nickname-ineligible states render their real state or a clear account/setup path instead of a duplicate mutation. Sending is disabled while pending and errors are shown inline.

### Error and privacy boundaries

- The frontend treats the public-profile response as the only authority for section visibility; it makes no secondary requests that could reveal a hidden section.
- Hidden-state rendering consumes no `data` values, including lengths, even if a malformed response contains them.
- A missing/unavailable public profile has a neutral route-level unavailable state. It does not distinguish a removed profile from inaccessible data or show guessed identity information.
- Favorite and friend-request mutations use their actual authenticated contracts. Authenticated actions are absent for anonymous visitors, not merely disabled.
- This phase does not alter Search, deals, alerts, Friends messaging, notifications, Home, onboarding, Party Finder, Groups, Discord, fake presence, or mock/static route code.

## Verification requirements

### Backend pytest

- Favorite list/add/remove owner scoping, including idempotent catalog save behavior.
- Public profile visibility for owner, confirmed friend, stranger, and anonymous viewer across library, favorites, wishlist, and Steam.
- Hidden blocks contain no titles, covers, counts, Steam IDs, or other private fields.
- Public profile ready and empty blocks remain truthful.
- Friend-request eligibility continues to reject anonymous, self, nickname-ineligible, friend, and pending cases without mutating state.

### Frontend Vitest

- Favorite add/remove behavior from catalog game detail, including pending/error rendering and query invalidation.
- Owner account favorite ready and empty states, distinct from wishlist and library.
- Public profile ready, empty, hidden, and unavailable states.
- Anonymous versus authenticated visitor actions; eligible, pending, friend, self, and nickname-ineligible friend-request states.
- Profile-settings PATCH payload includes all four visibility values; saving/error/pending states are explicit.
- Hidden rendering does not show protected titles, covers, counts, Steam identifiers, or private fields.

### Release verification

Before a draft PR: run the full pytest suite, full web test suite, web lint, production web build, and a browser smoke of the authenticated favorite flow, owner settings path, anonymous public profile, eligible friend request, and hidden sections. All provider calls in unit and contract tests remain mocked; no test performs a live external API call or production mutation.

## Non-goals

- A top-level favorites navigation item or a separate favorites route.
- New backend visibility rules, identity models, database migrations, or a new public-profile aggregation endpoint.
- Steam-only favorite behavior without a verified catalog identity.
- Redesigning or reviving removed static/mock frontend routes or PRs #142–145.
