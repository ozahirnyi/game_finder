# Restore canonical public-profile layout

## Goal

Keep `/users/<publicId>` as the sole profile destination, but make it feel like
the previously available full PlayFinder friend profile instead of the current
minimal technical view.

## Scope

- Replace the bare public-profile composition with the established PlayFinder
  profile presentation: an identity header, compact collection sections, game
  cards where data is ready, and clearly styled actions.
- Render ready, empty, and hidden states inside the same visual system. Empty
  and private collections must remain compact and must not reveal hidden names,
  counts, covers, Steam IDs, or other private fields.
- Preserve the existing canonical URL and API contracts.
- Preserve viewer roles: anonymous visitors have no authenticated actions;
  eligible strangers can send a request; friends see only friend-authorized
  sections; the owner sees a clear route to account settings.
- Preserve Friends message and invite routes as actions, not profile pages.

## Out of scope

- No change to privacy semantics, friend-request eligibility, social API
  contracts, catalog data, Steam integration, or unrelated Friends screens.
- No new profile URL and no redesign of the owner account page.

## Acceptance criteria

1. A public profile at `/users/<publicId>` is visually coherent with the
   existing PlayFinder profile/friend experience on desktop and mobile.
2. Empty Library, Favorites, and Wishlist states are concise cards rather than
   large blank panels.
3. Ready collections present the authorized games using existing game
   presentation components and link only to valid internal game-detail routes.
4. Hidden states remain private and contain no collection metadata or Steam
   identity data.
5. The existing anonymous, stranger, friend, and owner action rules continue
   to work unchanged.

## Testing

- Add a failing Vitest layout contract that covers the header, compact empty
  state, ready game presentation, and role-specific actions.
- Keep the existing public-profile privacy/role tests green.
- Run the focused and full web suites, backend tests, lint, and production
  build before publishing a draft PR.
