# Steam Regional Pricing Design

## Goal

Make Steam the sole source of every current price, purchase link, and price alert for every profile-selected region. Keep IsThereAnyDeal (ITAD) only for Steam storefront price-history points.

## Regional pricing contract

- The saved `User.price_country_code` is the canonical region for authenticated price pages and price alerts.
- The backend requests Steam with that region as the `cc` parameter.
- The currency returned by Steam is displayed unchanged. The application does not infer or convert a currency from the country code.
- A current price, discount, store label, and purchase link must originate from Steam. ITAD must never become the current-price fallback or purchase destination.
- When Steam cannot resolve a catalog title, the API returns no current price and no storefront link rather than selecting a different store from ITAD.

## Price-history contract

- ITAD continues to resolve the matching game and fetch its history.
- Only history events whose normalized shop name is `Steam` are retained.
- Each retained point displays ITAD's original currency. A page labels the chart as Steam price history and makes clear that its currency can differ from the selected region's current Steam price.
- ITAD overview current deals and all-store historical-low values are not used for the current-price UI or alerts.

## Price alerts

- Both persisted wishlist alerts and Telegram/manual-game alerts obtain their current deal from Steam.
- Alerts use `User.price_country_code`, not `User.steam_country_code`.
- An alert is skipped if Steam cannot resolve a priced title or if the returned deal does not meet its configured threshold. No ITAD/Humble fallback is permitted.

## Error handling

- An ITAD outage affects only the history section. Current Steam pricing remains usable.
- A Steam outage or an unresolved Steam title produces no current deal; it does not expose a reseller's price or URL.

## Tests

- Backend contract tests cover a non-UA profile region, ensuring Steam receives the selected country and its returned currency/link remain authoritative.
- Backend tests prove non-Steam ITAD history points are removed while Steam points retain their original currency.
- Alert tests prove profile-region Steam prices drive notifications and that ITAD is not called for the current deal.
- Frontend tests verify the history label communicates Steam-only history and its independent currency.
