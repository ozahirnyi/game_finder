# PSN Library Catalog Linking Design

## Problem

PSN import now succeeds independently of IGDB, but most imported rows are stored with `link_state="raw"` and no `catalog_game_id`. The library therefore cannot show an IGDB cover or open a catalog detail page for those rows. Steam games usually work because Steam supplies a stable app ID; the PSN export supplies titles but no identifier that maps directly to IGDB.

The current repair lookup is also unsuitable for a large library. It attempts a multiquery and then limits individual fallbacks to the first 20 unresolved titles. A failed multiquery consequently leaves the rest of a large PSN library as `catalog_unavailable`, and resolving every title in one HTTP request would risk another timeout.

## Goals

- Keep PSN import independent of catalog availability.
- Resolve every existing and future raw PSN row in bounded batches.
- Automatically link only one unambiguous exact normalized title match.
- Let the user choose another catalog game directly from the library.
- Keep ambiguous and unmatched PSN rows visible and editable.
- Continue hiding rows that the existing high-confidence non-game quarantine rules identify.
- Never affect Steam behavior or link a fuzzy result automatically.

## Non-goals

- Adding PSN OAuth or trophy imports.
- Inventing a PSN-to-IGDB stable identifier that is absent from the export.
- Automatically accepting fuzzy, substring, or popularity-based matches.
- Reclassifying the entire PSN export during catalog repair.

## Data model

Add nullable `Game.catalog_lookup_state` (`VARCHAR(16)`) with these raw-row values:

- `NULL`: not processed yet and eligible for automatic enrichment.
- `review`: catalog results exist, but there is not exactly one safe exact match.
- `no_match`: the catalog returned no results.
- `skipped`: the user explicitly chose to keep the row raw.

Linked and quarantined rows continue to use `link_state` as their source of truth. Existing raw rows receive `NULL` through the migration and are therefore backfilled automatically. No candidate list is stored; manual search uses the current catalog API so stale suggestions are not persisted.

## Backend enrichment flow

Add `POST /psn/library-repair/enrich`.

Each request:

1. Loads at most eight owner-scoped PSN rows whose `link_state` is neither `linked` nor `quarantined` and whose `catalog_lookup_state` is `NULL`.
2. Applies the existing high-confidence quarantine rule before catalog search.
3. Resolves the remaining titles with the existing resolver, explicitly allowing a single-title fallback for every title in this bounded batch.
4. Aborts the batch with a catalog-unavailable response if any required provider lookup is unavailable. It does not persist partial lookup states in that case, so retry remains safe.
5. Links a row only when exactly one result has the same normalized title key.
6. Marks other searched rows `review` or `no_match` and keeps them visible.
7. Commits once and returns counts plus the number of still-pending rows.

The frontend repeats this bounded endpoint until `remaining` is zero. With a working multiquery most batches need one provider request; if multiquery fails, a batch performs at most eight rate-limited single lookups rather than holding one request open for the whole library.

Automatic linking reuses one owner-scoped helper for duplicate merging and metadata updates. The helper preserves the oldest creation date and existing notes/info/playtime, sets `catalog_game_id`, `link_state="linked"`, the canonical catalog title, and cover URL, and removes a duplicate raw row when necessary.

## Library API and UI

`GET /library/overview` adds:

- Per game: `catalog_lookup_state`.
- Aggregate: `pending_catalog_count`.

On library load, the web client starts enrichment only when `pending_catalog_count > 0`. It runs batches sequentially, then refreshes the library once. During processing, the page shows progress text. A provider failure leaves games untouched and exposes a retry action instead of looping.

Every raw PSN card has a **Find in catalog** action. Expanding it shows:

- An editable search query initialized from the imported title.
- A search action using the existing `/search/games` API.
- Up to five catalog results.
- A **Use this game** action that calls the existing owner-scoped repair apply endpoint with `action="link"`.

After selection, the library refreshes and the row becomes a normal linked card with cover and catalog navigation. This also lets the user correct titles for which the export name is unsuitable for automatic matching.

The separate repair page remains available for quarantine restoration and destructive cleanup, but catalog selection no longer requires leaving the library.

## Failure handling

- IGDB unavailable: enrichment request fails without changing the batch; UI shows retry.
- Ambiguous title: keep raw, mark `review`, never auto-link.
- No result: keep raw, mark `no_match`; editable manual search remains available.
- Invalid or foreign game ID during manual link: existing owner-scoped validation returns 404/422.
- Duplicate PSN catalog identity: merge deterministically instead of creating two visible entries.

## Testing

Backend tests cover:

- More than 20 existing raw rows eventually resolve over repeated bounded calls.
- Exact unique matches auto-link and receive catalog metadata.
- Ambiguous and empty results remain raw with persistent lookup states.
- Provider failure rolls back the batch and remains retryable.
- Quarantine remains owner-scoped and hidden from the overview.
- Overview exposes lookup state and pending counts.

Frontend tests cover:

- Pending raw rows start sequential enrichment.
- Provider failure shows retry without an infinite loop.
- A raw PSN card can search with an edited title and link a selected result.
- Linked PSN and Steam cards retain their existing catalog navigation.

## Rollout

The migration is backward compatible: the new column is nullable, and existing code can read rows before enrichment. After deployment, opening the library starts the bounded backfill for that user. No PSN export needs to be uploaded again.
