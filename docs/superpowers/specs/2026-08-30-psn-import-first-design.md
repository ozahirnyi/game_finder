# PSN Import-First Design

## Status and Scope

This design replaces catalog-gated PSN import with import-first behavior. The
PlayStation export remains the source of ownership evidence. The external game
catalog becomes optional enrichment for canonical title, cover, and detail link;
it never decides whether an otherwise plausible PSN title may be selected or
imported.

The change covers PSN export preview, confirmation, imported library cards, and
the existing PSN repair flow. It does not add a durable background-job system,
change other platform imports, or add title-specific rules for individual games.

## Confirmed Failure Mode

The current preview sends 185 searchable titles through catalog resolution. When
the batch path fails, only the first 20 titles receive single-title fallback and
the remaining 165 are marked `catalog_unavailable`. This makes provider health a
gate on user-owned data and explains the exact production count reported after
the previous release.

The redesign removes that gate. A provider failure may reduce enrichment, but it
must not reduce the number of selectable plausible games.

## Classification Boundary

Classification answers only one question: is there affirmative evidence that a
row is not a normal library game?

An item is a **suggested non-game** only when its normalized source identity or
paired transaction evidence explicitly identifies one of these categories:

- a known media/service application or subscription;
- a PlayStation theme, avatar, wallpaper, or other system customization;
- virtual currency, a soundtrack, a season pass, DLC, or an add-on whose source
  title itself is the non-game product;
- a demo, trial, public test server, test client, beta client, or playtest whose
  source title explicitly identifies that build;
- another exact, verified PlayStation non-game storefront identity.

Rules use exact normalized identities or anchored category markers. Broad
substring rules must not exclude a normal title merely because its name contains
a word such as `theme`, `pack`, or `test`. A base game with associated demo, DLC,
voucher, subscription, or pack transaction rows remains a game candidate; one
related entitlement cannot veto the grouped base title.

Catalog absence, ambiguity, timeout, malformed response, or provider error is
never non-game evidence.

## Preview and Selection

Preview has two primary groups ordered for review:

1. **Games to import** — every item not affirmatively classified as a non-game.
   These items are selected by default and remain individually selectable.
2. **Suggested non-games** — explicit apps, services, themes, add-ons, and test
   builds. These items are unselected by default, display the reason, and can be
   deliberately restored when the classifier is wrong.

Catalog state is secondary metadata inside the first group:

- **Catalog match** — one safe exact identity is available;
- **PSN title** — no safe exact identity was found;
- **Catalog temporarily unavailable** — enrichment did not complete.

All three states remain selectable. Bulk select chooses all game candidates and
never selects suggested non-games unless the user has restored them. The confirm
step reports matched catalog games, unmatched PSN titles, and excluded items, but
does not show a provider failure as a blocking section. Confirmation uses this
single summary and does not add a second warning dialog merely because selected
items will be stored as raw PSN titles.

## Optional Catalog Enrichment

Preview may attempt the existing catalog resolver after classification, but the
attempt is bounded and best-effort. It must return the classified rows even when
all catalog calls fail or time out. A unique safe exact match supplies a catalog
ID and is selected as a linked import. Ambiguous, unmatched, and unavailable
results retain a raw PSN decision selected by default.

The API contract therefore carries selection eligibility independently from
catalog status. The frontend must not infer selectability from `igdb_id`,
suggestions, or resolver outcome.

Provider diagnostics log aggregate operation, status code/error class, batch
size, and elapsed time. Logs must not contain access tokens, exported transaction
contents, or the user's complete title list.

## Confirmation and Persistence

Confirmation accepts an owner-scoped preview token and one of two explicit
actions:

- `catalog`: persist or promote to canonical `psn:<catalog_id>`, linked state,
  canonical title, cover, and working catalog detail link;
- `raw`: persist the normalized PSN source title with its stable manual PSN
  identity and raw link state.

Both actions are valid imports. Reimport remains idempotent and preserves notes,
playtime, and earliest creation time when a raw row is later promoted or merged
with an existing linked row.

Raw PSN cards use a deliberate PlayStation placeholder, show their PSN title,
and have no fabricated catalog URL. They must never render as broken catalog
cards. Linked cards continue to use catalog artwork and detail routes.

## Repair and Reversibility

Existing raw PSN games remain visible in the normal library. The repair flow can
retry catalog enrichment later and promote a raw row when a safe exact match is
found. Catalog downtime leaves the row unchanged.

Suggested non-games are not persisted unless the user restores and selects them.
If an unwanted raw item already exists, repair provides an explicit owner action
to quarantine it; existing library deletion behavior remains unchanged and no new
delete workflow is required. Quarantine remains reversible and cannot be
triggered solely by a missing catalog match.

## Error Handling

- Parser/file errors remain blocking because no trustworthy candidates exist.
- Catalog errors are non-blocking and affect enrichment only.
- A failed confirmation remains visible as an actionable API error and keeps the
  preview selections intact for retry.
- Partial confirmation is not allowed: database mutation remains transactional.
- Repeating confirmation cannot create duplicate PSN identities.

## Test Strategy

Backend tests cover:

- exact non-game identities and anchored category markers;
- normal titles containing marker-like words;
- base purchases mixed with DLC/demo/pack/voucher rows;
- complete catalog outage with more than 20 titles, proving every plausible game
  remains selectable and confirmable as raw;
- exact catalog matches producing linked decisions while no-match, ambiguity,
  and unavailable produce raw decisions;
- owner scoping, idempotent raw import, later promotion, and duplicate merge;
- raw library payloads containing no fake catalog link or artwork.

Frontend tests cover:

- games selected by default regardless of catalog state;
- suggested non-games unselected by default and deliberately restorable;
- bulk selection boundaries and accurate confirmation counts;
- catalog-unavailable badges without a blocking unavailable group;
- linked versus raw library-card navigation and placeholder behavior;
- retry behavior preserving the user's current selections.

The supplied XLSX is used only for local aggregate acceptance and is never
committed. Acceptance requires that a complete catalog failure yields zero
catalog-linked games if necessary, but does not make any plausible game
unselectable or silently import suggested non-games.

## Acceptance Criteria

- A PSN file can be previewed and imported when IGDB is fully unavailable.
- Every item without affirmative non-game evidence is selected by default.
- Explicit non-games are unselected, explained, and restorable.
- Catalog matches enrich cards but never gate selection or confirmation.
- Raw imports render as intentional PSN cards without broken links or missing
  image artifacts.
- Re-running catalog repair can promote raw games without duplicates or user-data
  loss.
- No game-specific allowlist or one-off title exception is introduced.
