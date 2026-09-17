# Paid price history and active-player list

## Goal

Restore useful price-history feedback for paid Steam games without showing an empty history section for free games. Make recently active players easier to scan from the game-page action card.

## Price history

- A game marked `is_free` does not render the price-history section.
- A paid game always renders the price-history section once its price request has settled.
- If the provider returns history points, render the existing chart.
- If the provider reports history unavailable or returns no usable points, render an unavailable message and a Retry action in that section.
- Current price and provider status remain in the sidebar price card. A free title continues to show `Free` there.

## Recently active players

- Move the section from the main content column into the game-page sidebar, after the price, wishlist, favorite, external-store, and utility actions.
- Render players as a compact ranked list, sorted by `playtime_2weeks` descending.
- Each row contains a profile avatar, display name linking to the public profile, and rounded/displayed hours for the last two weeks.
- The list keeps loading, retry, and empty states. The empty state says that no public players logged time in the last two weeks.
- On desktop the list lives in the sidebar card. At the existing responsive sidebar breakpoint it flows below the action card as a full-width block, preserving the same list rows and touch targets.

## Profile playtime

- Full-library aggregate playtime is rendered as whole hours only; omit minutes even when the source total includes them.

## Data and error behavior

- Use the existing Steam App ID path for price history and recent-player requests.
- Do not fabricate historical prices or player activity. Empty and unavailable responses remain explicit UI states.

## Verification

- Add frontend regression coverage for free versus paid empty-history rendering, ranked avatar rows, and whole-hour profile totals.
- Run focused and full frontend tests, backend/provider tests affected by price retrieval, lint for changed frontend files, and a production build.
