# Authenticated Home, Steam, and PSN Recovery Design

## Goal

Restore a useful authenticated dashboard without removing the full archive guest homepage, make Steam library synchronization visible and actionable, and accept PlayStation's native XLSX account export.

## Homepage routing

`/` selects its content from the current auth snapshot.

- Guests retain the current archive discovery homepage, including search, deals, friends teaser, and registration CTA.
- Authenticated users receive a dashboard based on the recent `Play with friends tonight` layout: library-aware hero, friends summary, quick search, shared-library area, recommendations/deals, and existing route actions.
- API gaps never use fictional people or games. Each unavailable social or library panel uses a compact honest empty state with its existing action button.

## Steam library

Connecting Steam triggers the existing library sync endpoint after OAuth returns. The account and library pages query the canonical library endpoint and invalidate its cache after sync.

- A non-empty Steam connection with an empty library shows a visible `Sync Steam library` action.
- A completed sync shows its created/updated count and refreshes all library-backed panels.
- Empty results remain an explicit empty library state; no mock games or synthetic catalog IDs are introduced.

## Game and friend routes

The detail page fetches the catalog game and price history from real APIs. A missing/failed catalog ID renders the existing not-found state instead of crashing. Wishlist mutation is retained.

Friend pages render only basic data supplied by `getFriends`. Connected stores, activity, and library sections remain visible but compactly state that richer data is unavailable. The layout must not leave large blank regions.

## PlayStation XLSX import

The import endpoint accepts `.xlsx` in addition to CSV and JSON. It reads PlayStation's `Transaction Detail` sheet, keeps unique non-empty `Game Name` rows whose `Content Type` equals `Game` (case-insensitive), and ignores DLC, wallet items, subscriptions, and other transactions.

The existing preview/confirm flow remains unchanged: matched titles are previewed before any library mutation. The upload UI advertises XLSX support.

## Error handling and tests

Every auth-aware route must be safe for unauthenticated state and for failed API queries. Tests cover guest/auth homepage selection, Steam sync cache invalidation, XLSX title extraction, and compact friend/profile fallbacks. TypeScript typechecking is included in release verification, alongside lint, tests, build, and production browser checks.
