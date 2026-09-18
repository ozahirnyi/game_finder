# Price History resolution and chart interaction

## Goal

Show Steam history for catalog games whose IGDB record has no Steam app ID but whose
current Steam price is resolved by title. Make the history chart readable and usable
over its entire width.

## History resolution

When catalog pricing falls back to `fetch_steam_store_game_price`, the returned Steam
record is authoritative for the selected edition. Use its `appid` and canonical Steam
title when requesting ITAD history. Current price, Steam link, and the selected
regional currency remain unchanged. If history still has no Steam points, return the
normal empty-history response rather than substituting another storefront.

## Chart behaviour

Normalize consecutive observations with the same price state before rendering. A state
contains the sale price, regular price, discount, and currency. Position remaining
observations by their timestamps, not their array index. The pointer may move anywhere
inside the plot; it selects the active stepped-price interval and opens a tooltip with
the interval date, sale price, regular price, and discount. Keyboard focus retains the
same tooltip content.

The tooltip remains within the chart: at the left and right edges it opens inward.
Visible data dots are removed except for the active location, so unchanged provider
observations do not clutter the line.

## Verification

Automated tests cover title-fallback history using the resolved Steam app ID, collapsed
identical chart states, timestamp-based coordinates, whole-plot pointer selection, and
edge-safe tooltip placement. Existing API, component, and frontend tests remain green.
