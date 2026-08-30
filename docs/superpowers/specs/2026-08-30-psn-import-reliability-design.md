# PSN Import Reliability Design

## Status and Scope

This document defines the approved reliability redesign for PlayStation export
import and existing-library repair. It is a design-only change: implementation,
tests, migrations, and production-data changes are out of scope for this commit.

The work covers one shared resolution and classification path used by import
preview, import confirmation, and PSN library repair. It preserves owner
scoping and does not introduce title-specific exceptions.

## Evidence From the Supplied Export

The supplied XLSX parsed to 194 unique candidates. The current classifier marks
21 as `suggested_skip`, but that is not evidence that all 21 are non-games.
Inspection found at least 13 false positives: normal game titles were excluded
because their grouped candidate also contained a PS Plus pack, demo, DLC,
bundle, or voucher row.

The root cause is aggregation before classification. Candidates are grouped by
`Game Name`, then `psn_purchase_exclusion_reason` treats any non-`Product
Purchase` transaction type or any matching Product Name descriptor as a veto
for the entire group. A single related entitlement therefore poisons an
otherwise eligible game title. The genuine-non-game count remains unknown until
row-level evidence is classified under this design.

The same investigation found 173 currently searchable candidates and a working
production single-title catalog endpoint. A batch failure must therefore never
be rendered as zero true catalog matches.

## Shared Catalog Resolver

Introduce one catalog-resolver interface for import preview and library repair.
For every source title it returns exactly one of:

- `matched`: one unique exact catalog identity;
- `ambiguous`: multiple eligible exact identities;
- `no_match`: a completed catalog lookup found no exact identity;
- `unavailable`: lookup did not complete for that title.

The resolver uses IGDB multiquery in batches of at most ten as a fast path. It
validates the HTTP result shape, every expected alias, and each alias result.
An `IGDBError`, malformed response, missing alias, or partial batch result
falls back only for the affected titles to ordinary single-title lookup.
Fallback is bounded, rate-limited through the existing IGDB request limiter,
and isolates each title's failure. It must not retry indefinitely or fan out
unbounded concurrent requests.

`unavailable` is a first-class outcome. It is never converted to `no_match`,
`suggested_skip`, RAW import, or quarantine. This makes transient catalog
failures observable and retryable while preserving a truthful distinction from
a completed no-match result.

## Row-Level Classification and Preview Decisions

Classification runs on original transaction rows before grouping, or the parser
retains equivalent row-level evidence per `Game Name`. Grouping may summarize
evidence for presentation but must not turn one related purchase into a global
exclusion.

Decision precedence is:

1. A normalized `Game Name` that is itself proven to be a known app, service,
   system theme, or non-game store category is `suggested_skip`; existing stored
   rows with this affirmative evidence may be quarantined.
2. One or more base `Product Purchase` rows plus a unique catalog game produces
   an automatic catalog selection, even if associated rows describe DLC, a demo,
   PS Plus pack, or a voucher.
3. A catalog-game identity with only DLC, demo, pack, subscription, or voucher
   evidence is `needs_review`: it remains searchable and selectable, but is not
   auto-linked or auto-imported.
4. `ambiguous` and `no_match` are `needs_review`; manual catalog search remains
   available.
5. `unavailable` is shown as catalog unavailable with retry. It is not selected
   for RAW by default and cannot be auto-quarantined.

Absence of a catalog match is never affirmative non-game evidence. Quarantine
requires affirmative app/service/theme/store-category evidence and remains
reversible. No rule is based on a particular game title.

## Confirm, Reimport, and Identity Promotion

A confirmed catalog decision uses the source title from the owner-scoped preview
token to derive `psn_manual_external_id(source_title)`. It locates any existing
RAW row with that identity for the same owner and atomically promotes it to the
canonical `psn:<catalog_id>` identity, canonical catalog title and cover,
`catalog_game_id`, and `link_state=linked`.

If an owner already has a linked row for that catalog ID, confirmation safely
merges the RAW row into it, preserving the earliest creation time and useful
user data, then leaves exactly one row. Repeating the same confirmation is
idempotent: it neither creates another row nor clears linked metadata.

The promotion/merge is owner-scoped, transactional, and uses the same duplicate
policy for import and repair.

## Existing PSN Library Repair

Repair calls the shared resolver and row-level classifier rather than its own
batch interpretation. It displays catalog-unavailable results explicitly,
including retry, instead of silently presenting them as no-match.

Linked cards have canonical catalog identity, cover, and detail link. RAW cards
retain no fabricated catalog link or cover. Quarantined rows are hidden from the
normal library path, reversible through repair, and only originate from
affirmative non-game evidence.

## UI Behavior

The import UI has four distinct groups:

1. Catalog matches;
2. Needs review;
3. Suggested skip;
4. Catalog unavailable.

Each row explains its status and the relevant safe evidence summary. Catalog
unavailable rows expose Retry and are not RAW-selected by default. Bulk select
operates only on matched catalog IDs. Needs-review rows retain manual catalog
search and an explicit user decision; suggested-skip rows may be restored only
through an intentional review action.

## Acceptance Criteria

Using a local, non-committed harness against the supplied export's structure:

- Parsing continues to yield 194 unique candidates.
- Titles previously poisoned by add-on, demo, pack, or voucher evidence are not
  automatically skipped solely because of that associated row.
- Proven app, service, system-theme, and store-category identities remain
  `suggested_skip`.
- A working single-title catalog lookup prevents a total-zero outcome caused
  only by multiquery failure.
- Reimport promotes matching RAW cards to linked cards with cover and detail
  identity, including the duplicate and idempotent cases.
- No title-specific special cases are added.
- The supplied XLSX and its contents are never committed.

The exact count of genuine non-games is intentionally not an acceptance number;
it must be established by the row-level classifier rather than inferred from
the previous 21 skips.

## Test Strategy

- Parser and preview regressions for mixed transaction rows sharing a `Game
  Name`, including base purchase plus voucher/demo/pack rows.
- Resolver tests for batch success, malformed shape, missing alias, partial
  batch response, and per-title `IGDBError` fallback. The multiquery contract
  uses mocked HTTP transport and validates request/response shape; it does not
  mock the resolver's final result.
- Contract tests for all four resolver outcomes and their distinct preview/UI
  statuses.
- Owner-scoped RAW promotion, existing-linked merge, and repeat-idempotency
  tests.
- Repair tests proving it invokes the same resolver/classifier and visibly
  reports catalog unavailability.
- Frontend tests for four groups, retry, evidence display, manual search, and
  matched-catalog-only bulk selection.
- A local anonymized acceptance fixture or harness derived structurally from the
  export. It must not contain or commit the user's XLSX or its contents.

## Deferred Decisions

This spec deliberately does not select a database shape for row-level evidence
or a job-queue mechanism for retries. The implementation plan will choose the
smallest option consistent with the existing FastAPI, SQLAlchemy, and IGDB
limiter architecture while preserving the behavior above.
