# Steam Identity Wishlist Design

## Goal

Make a Steam game page use its Steam app ID as the authoritative identity, so users can save it to a wishlist and see correct Steam metadata without accidental title-based matches.

## Identity model

Wishlist items retain `catalog_game_id` for existing RAWG entries and gain `source` plus `external_id`. Catalog items use `source="catalog"` and `external_id="rawg:<id>"`; Steam items use `source="steam"` and the decimal Steam app ID. The uniqueness rule becomes `(user_id, source, external_id)`. Existing rows migrate to the catalog form.

The wishlist response exposes all three identity fields. Wishlist links select `/games/$gameId` with `source=steam` and the saved title for Steam items, so a Steam app ID is never interpreted as a RAWG ID.

## Detail data flow

For `source=steam`, the frontend requests a direct Steam app-details endpoint using the route app ID. It does not search Steam by title. The API returns Steam's release date, Metacritic score when supplied, description, genres, price and canonical store URL. The page can save this identity through a Steam-specific wishlist endpoint.

RAWG data remains optional enrichment only. A future mapping may be introduced only when a RAWG store link verifies the same Steam app ID; title equality alone must never select a RAWG record.

## Price history rendering

The detail page distinguishes no historical points, one point, and multiple points. No points render an explicit unavailable state; one point renders the dated price without a sparkline; two or more points render the sparkline. A current Steam price is not presented as historical data.

## Error handling and tests

The direct Steam endpoint returns provider failures without switching to a title search. The wishlist API is idempotent per source identity. Tests cover direct Steam metadata, Steam wishlist save/link, the absence of title-based RAWG matching, and the three price-history states.
