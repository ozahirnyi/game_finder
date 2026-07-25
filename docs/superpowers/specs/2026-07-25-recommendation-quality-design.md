# Recommendation Quality Design

## Goal

Ensure `Recommended for you` excludes owned Steam games, presents catalog artwork,
and uses a compact four-column desktop layout.

## Backend

Extend each recommendation item with optional `rawg_id` and `cover_url`. After the
AI provider returns titles, normalize every title through RAWG search/detail data.
Compare normalized recommendation titles against a case-folded set of owned Steam
game titles; remove owned games and duplicate recommendations before the response is
cached. RAWG-enriched items retain the AI reason and tags.

If a RAWG match is unavailable, keep a non-owned AI item with null metadata; the UI
uses its existing visual fallback. If all items are filtered, return an empty
recommendation list rather than showing an owned game.

## Frontend

Recommendation cards link to `/games/{rawg_id}` when available, render `cover_url`
through `GameCover`, and fall back to the current gradient otherwise. The grid uses
two columns on small screens and four compact columns from the large breakpoint,
allowing up to eight results to appear as two rows of four.

## Tests

Backend tests cover case-insensitive owned-title exclusion, duplicate removal, RAWG
id/cover enrichment, no-match fallback, and cache payload reuse. Dashboard UI tests
cover artwork, catalog link, fallback card, and the four-column grid class.

## Acceptance Criteria

- An owned Steam title such as Rainbow Six Siege is never returned in recommendations.
- Enriched recommendations show their real cover and navigate to catalog details.
- Eight recommendations display as two rows of four on desktop.
