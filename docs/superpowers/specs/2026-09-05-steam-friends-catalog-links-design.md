# Steam friend discovery, public game links, and Steam identities

## Goal

Make catalog game URLs usable outside the current browser tab, identify Steam
friends who already use GameFinder, support GameFinder friend requests, and
show a Steam user's persona instead of the technical Steam-only email address.
Consolidate the frontend on its actual runtime, TanStack Start, and remove the
unused Next.js-style application tree.

## Frontend consolidation

The deployed frontend is React, Vite, and TanStack Start/Router. `web/src/app`
is an unmounted Next.js-style tree: Next.js is not a project dependency and the
Vite build starts from `web/src/routes`. The frontend has one source of truth:

- Active route files under `web/src/routes` render the reusable API-backed
  screens under `web/src/features`.
- Tests import the screens or active TanStack routes, never `src/app` pages.
- Remove `web/src/app`, `web/next.config.ts`, `web/next-env.d.ts`, and
  Next-specific README text only after their route behavior and test coverage
  have been moved to the TanStack runtime.

This migration is deliberately limited to the existing pages and tests. It does
not redesign the UI or replace TanStack Start with another framework.

## Scope

### Catalog game links

TanStack route links must resolve every catalog card to `/games/<rawg-id>`.
The active `/games/$gameId` route renders the API-backed `GameDetailScreen`,
rather than looking up a static mock entry. Links opened with
Ctrl/Cmd-click, copied to the clipboard, or loaded in a fresh tab. The existing
TanStack game route remains the canonical direct-entry route.

### Steam persona labels

`/auth/me` returns a display name and optional Steam account details. The
display name is the stored Steam persona for an account with a non-empty
persona; otherwise it is a safe non-email fallback. The frontend profile uses
this display name and must never render the `steam-<id>@steam.invalid`
technical identity as a user-facing name.

### GameFinder friends

GameFinder friendship is independent from Steam friendship. A signed-in user
with Steam linked sees a *Friends from Steam on GameFinder* section. Its entries
are Steam contacts whose `steam_id` belongs to another registered GameFinder
user. The current viewer is excluded.

Selecting **Add friend** creates a pending GameFinder friend request. The
recipient can accept or decline it. Accepted friendships are bidirectional and
appear in *My GameFinder friends*. Sending a duplicate request, adding oneself,
or acting on another person's request returns a clear conflict or authorization
error.

Every confirmed GameFinder friend who has linked Steam exposes two outbound
links derived from their Steam ID:

- Open Steam profile: `https://steamcommunity.com/profiles/<steam-id>`
- Add on Steam: `https://steamcommunity.com/profiles/<steam-id>/friends/add`

They open in a new tab and do not perform an action without the user visiting
Steam. A friend without linked Steam has no Steam links.

## Backend design

Add a canonical `friendships` table for an unordered pair of user UUIDs and a
`friend_requests` table for directional, pending requests. Database constraints
prevent duplicate pairs and duplicate active directional requests. Add API
schemas and authenticated endpoints to:

- list the viewer's confirmed friends, incoming/outgoing requests, and eligible
  Steam-contact suggestions;
- send a request to a target user;
- accept or decline an incoming request.

Steam-contact suggestions are calculated server-side: fetch the viewer's Steam
friend list, match it against `users.steam_id`, then exclude the viewer,
existing friends, and users with an active request in either direction. The
response includes only public label, avatar, relationship action, and Steam
link data necessary for the Friends UI; it exposes neither email nor raw Steam
IDs as visible labels.

## Frontend design

The Friends screen loads the unified social response. It renders, in order:

1. incoming requests with accept/decline actions;
2. confirmed GameFinder friends, including Steam profile/add links when linked;
3. suggested Steam friends on GameFinder with an Add friend action;
4. the existing Steam-library overlap information, preserving its loading and
   unavailable states.

Actions update local screen state after a successful response and show a clear
inline error without hiding existing data when an action fails.

The active TanStack routes for discovery, search, game detail, Friends, profile,
Steam, PSN, library, wishlist, authentication, and callback pages render their
existing API-backed feature screens. The root layout remains the TanStack root
route/AppShell. No active route imports mock game/friend data for the migrated
screens.

## Error handling and privacy

- Steam not linked: GameFinder friend lists still load; Steam suggestions and
  Steam links are simply unavailable.
- A private Steam friend list shows an explanatory state while GameFinder
  friendships remain available.
- Steam API failures do not prevent loading internal friends.
- Profile and Friends UI never display the synthetic `steam.invalid` email.
- Only authenticated users can view or mutate friend data.

## Testing

- Backend contract tests cover Steam persona display labels, direct suggestion
  matching/exclusion, request lifecycle, duplicate/self/unauthorized actions,
  and Steam link fields for confirmed friends.
- Frontend tests cover active TanStack `/games/<id>` hrefs, direct detail-page
  rendering, persona-name profile rendering, request actions, Steam
  suggestions, Steam-link visibility, and the absence of imports from the
  removed `src/app` tree.
- Run the focused backend and frontend tests, then their relevant full suites
  before delivery.
