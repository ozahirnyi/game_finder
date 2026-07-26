# Genre Deals Page Design

## Goal

Replace the `/deals` page's one flat deal list with a compact top-three block
of current discounted Steam bestsellers and up to five honest, genre-specific
Steam deal sections tailored to the signed-in user's profile.

## Scope and compatibility

The existing public `GET /prices/deals` endpoint remains unchanged. A new
authenticated grouped-deals endpoint becomes the source for `/deals`, so
there is no breaking change for current consumers. The dashboard and its
`Price drops` block are explicitly out of scope.

## Genre selection

The grouped-deals endpoint reads the first five values in
`User.favorite_genres` in their saved order. Blank values are discarded and
genre comparisons are case-insensitive after normalization. If the resulting
list is empty, it uses this exact ordered fallback: `Action`, `RPG`,
`Adventure`, `Strategy`, `Indie`.

The response preserves the selected display names and always contains one
section for every selected genre, including a section with an empty `results`
array when no relevant active discount exists.

## Backend design

Introduce response schemas for a grouped deals payload: a section contains a
`genre` string and up to five existing `HomeDealItem` records; the top-level
response contains `popular` (up to three current discounted Steam bestsellers)
and `sections`.

The new endpoint calls a focused service rather than invoking
`fetch_steam_store_deals` directly. The service requests a larger bounded
candidate pool from Steam, retaining its first three discounted `top_sellers`
as the popular-deals block. It deduplicates on Steam app id, then enriches
each unique candidate with one RAWG search. It normalizes RAWG genre names by
trimming and case-folding them. A candidate is placed only into sections whose
normalized selected genre appears in the RAWG match's genres. No unrelated
game may fill a partially populated section. Each section stops after five
items.

The enriched item retains Steam artwork and URL, price and discount data, and
uses RAWG values for `id`, release date and a cover fallback. A failed or
missing RAWG match yields no genre classifications and therefore cannot appear
in a selected section; it does not fail the entire response.

The complete normalized grouped result is cached using the normalized country
and ordered normalized genre set. Invalid countries are rejected. The
authenticated caller's Steam country is used when available, otherwise `US`.

## `/deals` page design

Extend the deals API types so the `/deals` query receives `popular` and grouped
`sections`. Replace its existing hero and flat card list with the top three
popular discounted Steam games followed by a compact section per genre. A deal
card displays artwork, title, current price and discount, and an external Steam
link. When its RAWG id exists, its title/artwork additionally exposes a
catalog navigation target without nesting anchors. Empty and partial sections
show the exact meaning: no matching current deals, rather than substituting
other genres.

The layout keeps the `/deals` page's responsive card language so five sections
remain usable on narrow screens.

## Errors and loading

If Steam itself fails, the grouped-deals endpoint returns an appropriate error
and the `/deals` page retains its retry state. Individual RAWG failures are
isolated to the affected game. Empty sections are a ready response, not an
error.

## Tests and verification

Backend tests cover top-three bestseller selection, fallback genres, first-five
selection, normalized classification, maximum five matches, empty sections,
deduplication, and cache reuse for unchanged country and genre inputs.
Frontend tests cover rendering the popular block and genre headings, the
no-matching-deals state, price/discount rendering, Steam links and catalog
navigation where a RAWG id exists. Verification includes focused tests, the
full relevant suites, the production frontend build and `git diff --check`
before a draft PR.
