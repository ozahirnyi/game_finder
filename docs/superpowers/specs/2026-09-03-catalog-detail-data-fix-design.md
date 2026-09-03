# Catalog Game Detail Data Fix

## Goal

Show one complete game-detail experience regardless of whether a visitor opens a game from recommendations, search, deals, wishlist, or their Steam library.

## Confirmed failures

- IGDB `t_cover_big` cover art is a low-resolution portrait asset and is incorrectly stretched into the wide hero area.
- Steam-library routing deliberately selects a Steam-only detail model, which prevents the page from using known catalog metadata and disables the similar-games request.
- Catalog price lookup often has no Steam app ID and falls back to title lookup; the current history request omits the six-month `since` range. Empty upstream history is represented as a broken-looking empty chart.
- IGDB can provide no `similar_games` entries for an otherwise valid catalog game, so the related section becomes empty.

## Chosen design

### Canonical detail model

The detail loader resolves the catalog record first whenever a Steam game has a `catalog_game_id`. The canonical catalog record provides release date, rating, description, related games and price identity. Steam data remains the fallback only when catalog matching fails, and supplies store-specific pricing and a Steam hero image.

### Artwork contract

IGDB requests include `artworks.url`. Normalization returns both `background_image` for compact cards and `hero_image` for detail pages. `hero_image` prefers a wide artwork transformed to `t_1080p`; when none exists, the cover uses a larger transform rather than `t_cover_big`. Detail UI uses `hero_image` before any Steam hero fallback.

### Related games

The existing verified IGDB similar list stays first choice. If it is empty, the API returns deterministic catalog search candidates ranked by genre/platform overlap, excluding the source game. Steam games with a resolved catalog ID use the same endpoint. Steam-only games render a clear unavailable state.

### Price history

Price history requests include `since` set to six months before the current UTC time. For catalog records with a Steam App ID, ITAD lookup uses the ID; otherwise it falls back to the catalog title. A current price is exposed independently of historical points. The UI renders a one-point current-price state with an explicit "No price changes in the last 6 months" message instead of representing it as an unavailable chart; it never fabricates historical data.

## Acceptance criteria

1. A catalog game opened from home or search shows a non-pixelated wide hero when IGDB artwork exists and no longer stretches `t_cover_big` into the hero.
2. A Steam-library game with `catalog_game_id` shows catalog release date, rating and similar games; Steam-only games retain a safe fallback.
3. The related-games API returns fallback candidates when IGDB has no direct similar games.
4. Price API requests six months of source data and returns current price even if no price changes occurred; UI distinguishes this state from loading or an API error.
5. Backend and frontend regression tests cover both catalog and Steam-library paths.
