# AI Search, Wishlist Price, and Steam Link Feedback Design

## Goal

Preserve completed AI recommendations when a user returns from a game detail page, show each wishlist game's current price, and display a clear Steam-linking error when the selected Steam account belongs to another user.

## Design

- Store the completed AI recommendation payload in a React Query cache entry keyed by the submitted prompt. The search page restores the latest completed entry on mount, so Back navigation reuses the original five resolved games without calling the rate-limited recommendation endpoint.
- Fetch price history for every wishlist catalog game using the profile's price country. Each wishlist card renders the current formatted amount when present and an explicit unavailable state only when the price service has no current offer.
- Redirect Steam link callbacks to `/account` with a `steam_error` or `steam_linked` search parameter. The account page consumes the parameter and renders the server-provided error in the connected-services area.

## Tests

- Search-route test: submit AI search, unmount/remount with the same QueryClient, and assert the original cards reappear without a second recommendation request.
- Wishlist-route test: mock a current price per catalog ID and assert the formatted amount is rendered.
- Backend callback test: simulate a Steam ID owned by another user and assert a 303 redirect to `/account` carrying the error.
