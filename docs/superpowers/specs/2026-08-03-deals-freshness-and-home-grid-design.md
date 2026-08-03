# Deals freshness and home grid design

## Goal

Make the sidebar deals summary truthful and complete the Home `Price drops` layout as three rows of four real deal cards.

## Data contract

`GET /prices/deals` will include the creation time of its shared server-cache entry. The timestamp is shared by requests using the same country and page size, which matches how the deals cache is keyed. A cache miss records the timestamp when the Steam result is stored; a cache hit preserves it.

## Sidebar

The `Live deals` sidebar retains its current count and loading state. Once data resolves, it renders the cache timestamp as a relative label such as `refreshed 4m ago`; it no longer uses a hard-coded value. If the timestamp is unavailable, the sidebar omits the refresh phrase rather than inventing a time.

## Home Price drops

The existing real Steam deals remain the sole content source. The Home grid will render up to twelve real deals: one featured card plus eleven standard cards, so a full response lays out as 4 + 4 + 4. Empty and error fallback behaviour remains unchanged.

## Tests

Backend contract tests verify cache timestamps are exposed and stable on hits. Frontend tests verify the sidebar renders a supplied timestamp and the Home displays the twelfth real deal. No live provider calls are used.
