# Catalog Favorites Design

## Goal

Let authenticated users add a RAWG catalog game to Favorites from search results
and game details, while preserving canonical game metadata and preventing duplicates.

## Scope

This change implements only the Favorites portion of the PlayFinder catalog,
recommendations, and deals handoff. Steam recommendations and genre-based deals are
separate follow-up projects.

## Backend

Add `POST /favorites/catalog-games/{rawg_id}` beside the existing legacy
`POST /favorites` route. The route requires the current user and accepts no request
body.

1. Reject `rawg_id < 1` with HTTP 400 and `rawg_id must be >= 1`.
2. Look up a `Favorite` by both the current user's ID and `catalog_game_id`.
   If found, return its existing collection response with HTTP 200.
3. Otherwise call `fetch_rawg_game_detail(rawg_id)`. Map `RAWGError` into the
   existing HTTP error response.
4. Create `Favorite` with the current user's ID, RAWG ID, canonical `name`, and
   `background_image` as `cover_url`; commit and return its collection response with
   HTTP 201.

The old body-based Favorites endpoints remain unchanged so existing consumers,
including the Favorites page and its removal action, keep working. Records remain
strictly user-scoped, and no catalog removal control is added.

## Frontend

Add `saveCatalogGameToFavorites(rawgId: number)` in `web/src/lib/api.ts`. It sends
an authenticated POST to `/favorites/catalog-games/{rawgId}` and returns a
`CatalogCollectionItem`.

Add `lovableQueryKeys.favorites` and extend `CatalogGameActions` with an authenticated
Favorites query and a save mutation. The component continues to return `null` for
guests. For signed-in users it renders a third button after Library and Wishlist:

`Add to favorites` -> `Adding…` -> `In favorites`.

Saved state is true when the Favorites query includes a matching `catalog_game_id` or
the mutation succeeds. On a successful mutation invalidate saved games, Wishlist,
Favorites, dashboard, and profile-summary queries. Display the Favorites mutation
error through the existing alert so a user can retry by clicking the still-enabled
button.

`CatalogGameActions` is already reused by both search cards and game details, so no
route-specific action component is needed.

## Error Handling

- Guests never see catalog actions, so no unauthenticated mutation is possible from
  the catalog UI.
- Invalid RAWG IDs get the same 400 response pattern as Wishlist.
- RAWG lookup failures surface their existing status and detail.
- Repeated clicks and concurrent requests are harmless from the client perspective:
  the server returns the owned existing Favorite with 200, and the UI marks it saved.
- A failed save leaves the button actionable and shows the error in an alert.

## Tests

Backend contract tests cover authentication, invalid ID validation, canonical RAWG
metadata, 201/200 idempotency, and isolation between two users.

Frontend API tests cover the new request URL, method, authentication, and response.
Catalog route tests mock the Favorites query and mutation, verify guest invisibility,
verify the label transition after an action from search, and verify the control on the
authenticated game-detail route. Existing library and wishlist assertions stay in
place.

## Acceptance Criteria

- A signed-in user can add a catalog game to Favorites in search and details views.
- The browser sends only the RAWG ID; the backend persists canonical RAWG title and
  cover.
- A duplicate request produces no duplicate row and returns HTTP 200 after the first
  HTTP 201 response.
- Favorites are not visible or accessible across users.
- Guests see no catalog action controls, and Favorites has no catalog removal button.
