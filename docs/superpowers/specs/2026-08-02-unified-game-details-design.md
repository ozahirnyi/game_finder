# Unified game detail navigation

## Goal

Every game card in search, price drops, and discovery opens the same internal game-detail route. Steam is an external source available from that detail page, not a card destination.

## Design

- Use the existing `/games/:gameId` route for every card. Steam-only cards pass their Steam app id and `source=steam`; the existing route loader already resolves that mode and shows its store URL on the detail page.
- Replace Steam search capsule images with the app's Steam header image; keep the existing unavailable-cover state if Steam provides none.
- Make each price-drop card use the same internal destination. The card no longer opens the store; the detail page owns the external purchase action.

## Error handling and tests

- If Steam metadata cannot be loaded, the detail screen retains its existing error and retry state.
- Add API and UI tests proving Steam-search cards and Steam price drops link internally, and that Steam search returns a header-sized image URL.

## Scope

No database migration, account changes, or redesign. Existing RAWG-backed game IDs and URLs remain unchanged.
