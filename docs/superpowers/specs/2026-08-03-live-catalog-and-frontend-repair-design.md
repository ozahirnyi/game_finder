# Live catalog and frontend repair design

## Goal

Make the visible Game Finder catalog and wishlist use the live backend, show complete game and price data, and restore a consistent TanStack/Vite frontend test setup.

## Problem summary

The active TanStack routes still render prototype `mockData`, while the API-backed screens are not the visible product flow. The test suite mixes Next.js imports and assumptions with TanStack Router components. The detail API already returns RAWG metadata and current ITAD deals, but the UI does not render rating or the returned deals, and the backend does not request ITAD's historical price log.

## Chosen approach

Use TanStack Router and Vite as the only frontend runtime. Replace prototype route implementations with API-backed feature screens instead of restoring Next.js compatibility or disabling tests.

### Catalog and wishlist

- Search results link to an API-backed catalog detail route.
- The catalog detail screen renders release date, rating, description, current price, historical low values, current store deals, and a chronological price history.
- The detail screen exposes an authenticated add/remove wishlist action.
- A wishlist item stores the RAWG catalog ID in the existing `external_id` field with a `rawg:` prefix. This makes all new wishlist links deterministic.
- Existing wishlist records without a catalog ID remain usable: their card opens a title search, where the user can choose the correct catalog result. No unsafe guessed catalog ID is persisted.
- The existing `wishlist` note marker remains the compatibility marker for existing saved games. New entries receive the marker automatically.

### Price history

- The backend continues to use ITAD lookup and current-price endpoints.
- It additionally calls ITAD `games/history/v2` for the resolved ITAD game ID and country, then returns normalized timestamp, shop, sale price, and regular price values.
- A history request failure is surfaced as the same price-data error as the existing request; no fabricated timeline is shown.

### Frontend consistency

- Active routes use the existing API client/components rather than `mockData`.
- Components use TanStack links and router hooks only; no production import from `next/link` or `next/navigation` remains.
- Tests render router-dependent components inside a minimal real TanStack router context.
- Game-cover tests reflect the current gradient-cover API rather than an obsolete `<img src>` API.
- The route integration test verifies active routes no longer import prototype data.

## Error handling

- Wishlist actions are disabled while in flight and show the API error in the game detail view.
- Unauthenticated users are shown the existing sign-in state rather than issuing protected requests.
- A legacy wishlist title search remains a normal link and therefore preserves browser navigation and retry behavior.
- Missing optional metadata is shown as an explicit unavailable label; a successful response never silently drops an available rating, date, deal, or history entry.

## Testing

- Backend tests cover price-history normalization and failures from ITAD history.
- Frontend tests cover metadata and history rendering, add/remove wishlist requests, direct links for ID-backed wishlist entries, title-search fallback for legacy entries, and router-aware rendering.
- Full backend and frontend suites are run after the targeted regression tests.

## Scope boundaries

This work does not introduce a dedicated wishlist database table, account-level ITAD OAuth synchronization, notifications, or price-alert scheduling. It makes the existing saved-game model and visible product routes reliable.
