# Unified game detail navigation

## Goal

Every game card in search, price drops, and discovery opens the same internal game-detail route. Steam is an external source available from that detail page, not a card destination.

## Design

- Use `/games/:gameId` for catalog games and `/games/steam-:appId` for Steam-only results. Both routes render `GameDetailScreen`.
- Let the detail API resolve a `steam-:appId` identifier through Steam Store data and return the existing catalog-game shape. The page shows its Steam purchase link there.
- Replace Steam fallback capsule images with a larger Steam header image when available; keep the existing unavailable-cover state if Steam provides none.
- Make each price-drop card use the same internal destination. Remove its card-level store link; the detail page owns the external purchase action.

## Error handling and tests

- If Steam metadata cannot be loaded, the detail screen retains its existing error and retry state.
- Add API and UI tests proving Steam-search cards and Steam price drops link internally, and that the detail API returns the larger image and Steam URL.

## Scope

No database migration, account changes, or redesign. Existing RAWG-backed game IDs and URLs remain unchanged.
