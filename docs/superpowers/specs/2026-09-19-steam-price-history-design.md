# Steam price history and chart design

## Scope

Fix Steam price history for catalog and Steam-library game detail pages. Do not
change the current Steam price, Steam title resolution, search, store links,
regional price selection, alerts, or any other page content.

## Data flow

The backend will request IsThereAnyDeal history with the documented Steam shop
filter (`shops=61`) before history normalization. Weekly compaction will then
choose a point only among Steam observations. The existing defensive filter in
the route layer will remain so a malformed provider response cannot expose a
non-Steam record.

This fixes the failure mode where a cheaper non-Steam observation replaced a
Steam observation during weekly compaction, then was removed by the later
Steam-only filter, leaving no points for games such as The Witcher 3.

## Chart

Only `PriceHistoryChart` changes visually. It will retain the existing public
props and keyboard access, while becoming a SteamDB-inspired price chart:

- stepped sale-price line and optional dashed regular-price line;
- restrained horizontal value grid with labelled price range;
- a vertical hover guide and visible active point;
- an edge-safe tooltip showing date, sale price, regular price, and discount;
- date labels, source currency, and historical-low summary.

The chart is an original implementation; it does not copy SteamDB code or use
SteamDB as a data source.

## Errors and compatibility

Provider unavailability continues to show the existing retry state. A paid game
with an empty successful Steam response continues to state that no changes were
recorded in the selected period. Currency remains the currency supplied by the
historical Steam record and is never converted to match the current price.

## Tests

Backend coverage will prove that Steam filtering is sent to ITAD and that a
same-week cheaper non-Steam point cannot remove a Steam point. Frontend tests
will cover the chart's value labels, hover guide/tooltip, stepped paths, and
keyboard interaction. Existing focused backend and frontend suites will be run.
