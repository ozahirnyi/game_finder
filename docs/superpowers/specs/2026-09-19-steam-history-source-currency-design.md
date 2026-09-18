# Steam history source-currency design

## Decision

For every selected price region, Steam remains the source of the current regional price and purchase link. ITAD Steam-only history remains visible in the currency supplied by the history source, even if that currency differs from the current regional Steam price. The application does not convert or compare these currencies.

## Presentation

The section explicitly labels the history currency, for example `Steam price history · USD`, and explains that it is the source history currency. The historical low is calculated and shown only within that same chart/currency. It is not presented as a low for the current regional Steam price.

The chart exposes a compact cursor-anchored tooltip for pointer hover and a point-anchored tooltip for keyboard focus. The tooltip contains date, sale/current price, regular price, and discount. The persistent text below the chart is removed.

## Periods

Supported server-side periods are `6m`, `1y`, and `2y`. The selected period is included in the API request and cache key. Existing requests without a period retain the 6-month default.

## Testing

Tests cover foreign-currency history retention, source-currency chart labels, the two-year request and server period calculation, and tooltip interaction by pointer and keyboard.
