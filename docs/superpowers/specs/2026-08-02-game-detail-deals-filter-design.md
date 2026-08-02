# Game-detail navigation, daily recommendations, and Deals genre filter

## Goal

Make every game card open a usable detail page, refresh personalized recommendations at most once per day, and present Deals as four popular cards plus a selectable five-genre catalog.

## Design

- Every internal game link carries the visible title as well as its identifier. The game-detail loader first requests the identifier, then uses an exact title search only when that lookup fails or resolves to a different title. Steam links retain their explicit Steam source and direct-store fallback.
- The loader keeps genuine missing titles as a 404, but does not let an identifier mismatch discard a valid, exact title match. Route tests exercise real navigation from recommendations, Deals, and search to the detail screen.
- Personalized recommendation Redis entries expire after 24 hours. The profile/library fingerprint remains in the key, so meaningful preference changes still immediately produce a new set.
- Deals retains exactly four `Popular on Steam` cards. The existing API-provided five genre sections are loaded once; five local chips select one section at a time. The selected section renders at most five large `GameCard` cards.

## Error handling and tests

- Exact-title fallback must reject non-exact matches rather than silently opening another game.
- Test title-bearing links for every catalog game surface and test the loader fallback when the direct catalog lookup is unavailable.
- Test the 24-hour cache TTL and the five-chip Deals filtering behavior, including the four/ five card limits.
