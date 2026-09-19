# Library and Wishlist Search with Infinite Scroll

## Goal

Let signed-in users search their library and wishlist by game title, while loading
each collection incrementally instead of fetching every game up front.

## API contract

- `GET /library/overview` accepts `q`, `limit`, and `offset`. It also accepts
  the existing source and playtime sort selections needed by the Library UI.
- `GET /wishlist` accepts `q`, `limit`, and `offset`.
- Both endpoints return a page envelope with `items`, `total`, and `has_more`.
  `limit` defaults to and is capped at 20 for this UI flow. `offset` defaults
  to zero.
- Search is a case-insensitive title match. It does not search source/platform;
  the Library's All games, Steam, and PlayStation tabs remain the source filter.
- Resource ownership and existing authentication behavior remain unchanged.

## Frontend behavior

- Library and Wishlist each render an accessible `Search games` input.
- A short debounce prevents a request for every keystroke. Changing the query,
  Library tab, or Library sort order starts a new list from offset zero.
- Each request asks for 20 games. React Query stores pages separately by the
  active query/filter/sort state and combines them for rendering.
- An `IntersectionObserver` sentinel below the list requests the next page only
  when `has_more` is true and no page is already loading.
- Existing cards, game links, Library PSN catalog repair controls, Wishlist
  pricing, alerts, and removal actions remain functional. Mutations invalidate
  the relevant paginated collection query.
- A normal empty library/wishlist keeps the existing onboarding empty state. A
  non-empty collection with no title matches shows a distinct no-results state.

## Error and loading states

- The first page continues to show the existing collection loading state.
- While later pages load, the already-rendered cards remain visible and a small
  loading indicator appears at the sentinel.
- A failed later page exposes a retry action without discarding earlier pages.

## Tests

- Backend pytest tests cover pagination boundaries, case-insensitive title
  search, total/has-more metadata, filters, sorting, and owner scoping.
- Frontend Vitest tests cover reset-on-search/filter behavior, no-results UI,
  sentinel-triggered loading, and prevention of duplicate next-page requests.
- Existing Library raw PSN and Wishlist price/alert/removal tests are adjusted
  to use the new page envelope and remain covered.
