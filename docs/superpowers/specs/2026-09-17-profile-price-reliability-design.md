# Profile, price, and player-discovery reliability

## Goal

Make friend profiles responsive and truthful, restore usable price history, and make player discovery reflect the actual social and Steam data stored by Playfinder.

## Friend profile and library

The profile shell must load once and remain visible while the library changes. Library items will move to a privacy-aware paginated endpoint shared by public and friend profiles. It returns twelve games per page, a title search result, and a stable summary for the complete visible library: total games, total playtime, and platform counts.

The server will build and briefly cache the accessible library snapshot per profile, avoiding repeated Steam calls for every search character or page. The browser will debounce title search, reset to page one when that search changes, retain the current grid while a new page is fetched, and show a local loading treatment only in the library panel. The profile header and store metrics use the complete-library summary rather than the current page.

The grid is four columns on desktop, three on tablets, and two on phones. Pagination remains keyboard-accessible. The redundant `Open chat` panel is removed; existing message actions remain the only chat entry points.

## Prices

The ITAD client will use the current documented provider request contract and preserve a structured result for current price, historical points, and provider availability. It will not silently present a Steam fallback as a successful price history lookup.

Steam games with `is_free` become an explicit free current-price state. If a free game has historical points, its chart remains visible; if it has no historical points, the Price History section is omitted. Paid games show current pricing even when history is unavailable, alongside a clear provider-unavailable state rather than an empty or misleading chart.

The valid production ITAD key is kept only in `/home/ec2-user/.game-finder.env`; no key is committed or added to GitHub logs.

## Recently active players

The game route will preserve the canonical Steam app ID even when it resolves to a catalog page. The active-player API accepts that ID directly and uses it to query the current Steam libraries of visible users who have recorded play in the preceding fourteen days, subject to the existing social-block and library-visibility rules. The stored games table remains a fallback, not the sole source of activity.

The game page always communicates loading, unavailable, or empty activity states, and renders player profile links when data is present.

## All users directory

Directory responses include each listed user's relationship to the viewer. The directory shows one user per row with an avatar; clicking the row opens that user's profile, while its separate control displays the appropriate non-destructive state: `Friends`, request pending, or `Add friend`. Friend controls never offer a duplicate request for an existing relationship.

## Verification

Backend tests cover visibility, activity identity, ITAD free and unavailable states, full-library aggregates, paging, search, and relationship statuses. Frontend tests cover retained profile rendering, responsive grid classes, the omitted redundant chat panel, free pricing, history visibility, and disabled directory actions. Run targeted suites, full backend coverage, full frontend tests, build, scoped lint, PR checks, and post-deploy health verification.
