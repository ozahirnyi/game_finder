# Post-Auth Onboarding and Next-Step Guidance - Design

**Status:** Approved design; awaiting review of this written specification

## Purpose

Guide a signed-in PlayFinder user toward the existing actions that make the
product useful without blocking normal navigation. The guidance is a compact,
server-derived checklist, not a wizard, modal, local progress flag, or a new
feature surface.

## User experience

The same unresolved setup is available in two places:

- **Home:** a compact full checklist immediately below the signed-in hero.
- **Account:** a shorter companion block above the owner profile.

Each surface shows only steps that are still relevant. A user can ignore the
block and continue using the site. When all activation conditions are complete,
the component is absent from both surfaces. It reappears only if later server
data makes a condition incomplete again.

## Real-data contract

Add one authenticated, owner-scoped, explicitly typed endpoint:

`GET /onboarding/summary`

Its response contains no game, friend, notification, or other user payloads.
It contains only the facts needed for the same frontend decision on Home and
Account:

- `steam_linked`: whether the owner has a linked Steam account;
- `psn_library_games`: count of the owner's persisted PSN library games;
- `wishlist_games`: count of the owner's wishlist items;
- `price_alerts`: count of the owner's price alerts with an owned wishlist
  item;
- `friends`: count of the owner's confirmed friendships.

The endpoint derives every field from the authenticated owner and database.
It does not use browser storage, client-only completion state, external social
data, or cross-user resources. It returns 401 when signed out through the
existing auth dependency.

`steam_linked || psn_library_games > 0` is the library-setup completion rule.
This prevents a user who has connected Steam or imported a PlayStation library
from receiving an irrelevant empty-library prompt. PlayStation has no separate
connection record; a persisted PSN game is its real completed-import signal.

## Display logic and actions

The frontend adds `getOnboardingSummary` in the existing API client and one
TanStack Query hook shared by Home and Account. The hook is enabled only for a
signed-in owner on Home; Account already requires its authenticated profile
request.

The component derives the following cards, in order:

1. **Connect a library** when neither Steam is linked nor a PSN library game
   exists. It exposes two real choices: `Connect Steam` to `/account`, where
   Connected services supplies the Steam link action, and `Import PlayStation`
   to `/psn-import`.
2. **Add a wishlist game** when `wishlist_games` is zero. Its action goes to
   `/search`, the existing catalog and game-detail entry point for adding a
   wishlist item.
3. **Create your first price alert** only when `wishlist_games` is positive
   and `price_alerts` is zero. Its action goes to `/wishlist`, where the
   existing Price alerts control opens the real alert form for a saved game.
4. **Find friends** when `friends` is zero. Its action goes to `/friends`,
   where the existing Add friend flow searches players and sends a request.

The complete state is reached when the library condition, wishlist, alert, and
friend conditions are all complete. The component then renders nothing. There
is no dismissal button: completion is always recomputed from the API.

## States and errors

- While the summary is loading, signed-in Home and Account render a small,
  non-blocking preparation state without inventing steps.
- On an endpoint failure, they render `Setup guidance is unavailable` with a
  retry action scoped to the onboarding query. They do not infer completion
  from stale or absent client data.
- Signed-out Home renders no onboarding component and makes no authenticated
  onboarding request.
- A successful completed response renders no empty-card placeholder.

## Scope boundaries

This phase does not change favorites, privacy, Party Finder, Groups, Discord,
presence, notifications, recommendation generation, existing account service
controls, or the price-alert form. It creates no fake button and no new route.
All actions use existing active routes and flows.

## Test contract

Backend pytest covers the authenticated summary response, owner scoping, the
PSN/Steam library rule, wishlist/alert counts, and unauthorized access.

Focused Vitest coverage proves:

1. a new user sees the library, wishlist, and friend steps;
2. Steam-linked and PSN-imported users do not receive library-empty guidance;
3. a user with wishlist but no alert sees the alert card;
4. a user with no friends sees friend discovery;
5. errors are explicit and retryable, signed-out Home makes no query, and
   full completion renders the compact-complete state as absent;
6. every visible action has its real route target.

## Alternatives considered

1. **Several independent frontend queries:** uses existing data but repeats
   completion logic across Home and Account and can temporarily disagree.
2. **Extend `/profile/summary`:** it is broader profile data, omits confirmed
   friend and alert facts needed here, and would couple onboarding to unrelated
   consumers.
3. **Dedicated minimal summary endpoint:** gives both UI surfaces one typed,
   owner-scoped source of truth without leaking or duplicating data. Chosen.
