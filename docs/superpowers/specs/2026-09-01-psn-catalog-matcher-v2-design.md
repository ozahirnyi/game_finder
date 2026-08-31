# PSN Catalog Matcher V2 Design

## Problem

PSN Excel import now keeps eligible rows and lets the user link a raw row manually, but automatic catalog linking still resolves less than half of a typical library. Manual search works for many of those same games after the user shortens or cleans the query.

The failure is systematic rather than title-specific:

- Automatic lookup sends the raw PSN transaction title to catalog search. PSN titles commonly contain trademark symbols, publisher prefixes, platform suffixes, edition text, brackets, or localized product wording that catalog search does not understand reliably.
- Automatic acceptance compares results with a narrow normalized equality rule. A valid result can therefore be returned by the provider and still be rejected.
- Multiple catalog records with the same title are treated as ambiguous even when one record is the clear PlayStation release.
- Import currently discards useful PSN evidence such as source platform and product-name aliases before later library repair runs.
- Rows already marked `review` or `no_match` are not retried after matcher improvements.

This creates both false negatives (real games remain raw) and a poor recovery path. The non-game quarantine problem is separate and must not be "solved" by weakening catalog identity checks or adding per-title exceptions.

## Goals

- Automatically link ordinary PSN game titles that manual catalog search can already find.
- Use deterministic, explainable matching rather than title-specific rules or broad fuzzy acceptance.
- Prefer the catalog record compatible with the PSN platform when several exact-name releases exist.
- Preserve useful source evidence from future PSN imports.
- Reprocess existing raw PSN rows after matcher changes without requiring another upload.
- Keep uncertain matches visible and manually selectable.
- Keep high-confidence non-games quarantined and never turn catalog search results into proof that an imported row is a game.
- Preserve bounded processing and current provider-failure behavior.

## Non-goals

- PSN OAuth, trophy import, or obtaining stable PSN title identifiers not present in the export.
- Automatically linking translations that have no deterministic title or alias relationship.
- Generic edit-distance, substring, embedding, or popularity-only auto-linking.
- Hardcoded rules for individual examples such as FIFA, Fortnite, Bloodborne, Spotify, or YouTube.
- Requiring users to upload the same export again.

## Design principles

Classification and catalog identity remain separate decisions:

1. The import classifier decides whether a row is an eligible game candidate, a high-confidence non-game, or uncertain.
2. The matcher decides which catalog game, if any, an eligible candidate represents.

A catalog hit cannot rescue a row already identified as an explicit non-game, and a missing catalog hit cannot classify a row as non-game. Normal eligible rows remain in the library even when unresolved.

Automatic linking requires deterministic identity evidence. Query cleanup may be broad enough to retrieve candidates, but candidate acceptance remains strict and score-based.

## Source evidence

For future PSN imports, persist the useful evidence already present in the parsed preview:

- `psn_source_platforms`: a deduplicated list of normalized source platforms when known (`PS3`, `PS4`, `PS5`, `Vita`, and so on).
- `psn_search_aliases`: a deduplicated list of safe title aliases derived from game name and product name.
- `catalog_lookup_version`: the matcher version that last processed the raw row.

Aliases are evidence, not alternate library entries. Before storage, remove empty values and aliases that the existing classifier identifies as obvious subscriptions, themes, demos, add-ons, currencies, services, or other non-game products. Keep the original imported title unchanged for display and auditability.

Existing rows will usually lack platform and aliases. They are still retried using deterministic variants of their stored title. This improves old libraries immediately while future imports gain better disambiguation.

## Query variant generation

Generate an ordered, deduplicated set of search queries from the original title and each safe alias. The generator is shared by automatic enrichment and the initial manual-search query.

Variants are produced by composable normalization rules:

1. Preserve a whitespace-normalized raw value.
2. Normalize Unicode punctuation and remove trademark/copyright symbols.
3. Remove recognized store/platform wrappers and trailing platform labels, including bracketed forms such as `[SCEE PS4]` and suffixes such as `PlayStation 4 Edition`, while retaining the unmodified source as an earlier variant.
4. Remove known presentation-only publisher/brand prefixes when the remaining title is meaningful, for example `EA SPORTS`.
5. Produce a base-title query by removing recognized bundle or edition presentation text only for retrieval. Edition information remains available to scoring and is never silently discarded from identity evidence.
6. Normalize boundaries between letters and digits where PSN formatting differs from catalog formatting.

The generator must not remove arbitrary words, infer translations, or generate loose substrings. Cap the number of variants per row so one batch has a predictable provider cost.

## Candidate retrieval

For each bounded enrichment batch:

1. Generate query variants for each eligible raw row.
2. Search variants in priority order, using the existing batch resolver where possible and rate-limited single-query fallback where required.
3. Merge results by catalog ID so the same game returned by multiple variants is scored once.
4. Retain which query variants produced each candidate as matching evidence.

Provider failure keeps the batch retryable and does not persist partial final states. Empty results from one variant do not prevent later variants from being attempted.

## Candidate scoring and acceptance

Score candidates using only deterministic evidence. Exact weights are implementation constants covered by tests, but ordering is mandatory:

1. Exact normalized full-title or safe-alias equality is strongest.
2. Exact normalized cleaned/base-title equality is next.
3. Compatible PlayStation platform evidence increases the score; an incompatible known platform strongly penalizes or rejects the candidate.
4. A main-game or independently playable release type is preferred. Explicit DLC/add-on, pack, mod, update, demo, beta/test server, theme, app, soundtrack, or similar non-game types are rejected when provider metadata identifies them. Bundles, remasters, ports, and standalone expansions remain valid candidates but score below an equally exact main-game record unless source wording supports that release type.
5. Edition tokens contribute when both sides provide edition evidence. Conflicting edition evidence rejects a candidate, while edition metadata missing from one side must not defeat an otherwise exact base-title match.
6. Search position or popularity may break a tie only after title, platform, and type evidence agree. They can never create a match by themselves.

Auto-link only when:

- the top candidate reaches the safe threshold;
- it has deterministic exact full/alias/base identity evidence;
- it is not rejected by catalog type or known platform incompatibility; and
- it leads the second candidate by the configured safety margin.

When duplicate exact-name catalog records represent different platforms, choose the compatible PlayStation record. If the source platform is unknown, prefer an exact-name main-game record that explicitly supports PlayStation only when it is uniquely best after type and release evidence; otherwise leave the row for manual selection.

Do not use generic fuzzy matching for automatic links. Fuzzy or partial results may still appear in the manual picker.

## Matcher versioning and reprocessing

Introduce a matcher version constant. A raw PSN row is pending enrichment when its `catalog_lookup_version` is lower than the current version, regardless of a previous `review` or `no_match` state.

After a successful decision, store the current version together with `catalog_lookup_state`. Linked and quarantined rows are not automatically reconsidered. A future matcher change increments the version and safely retries only unresolved raw rows.

For rollout, all existing unresolved PSN rows therefore become pending automatically. Users verify the fix by opening the library; no new PSN import is necessary.

## Enrichment and linking flow

Keep the current bounded sequential enrichment architecture. For each row in a batch:

- Apply existing high-confidence quarantine checks first.
- Retrieve and score candidates with Matcher V2.
- Link the unique safe winner through the existing owner-scoped merge/link helper.
- Otherwise preserve the raw row and mark it `review` when plausible candidates exist or `no_match` when none exist.
- Record the current matcher version only after the provider work for the batch succeeds.

The link helper continues to preserve user data, canonical catalog metadata, cover image, navigation, and duplicate-merging behavior. Steam import and Steam catalog identities are unchanged.

## User interface

The library continues to show automatic enrichment progress and the inline **Find in catalog** fallback for unresolved PSN rows.

For unresolved rows:

- Initialize manual search with the best cleaned query rather than the noisy raw title.
- Keep the field editable and show catalog candidates normally.
- Let the user override the automatic decision by selecting any valid catalog result.
- Keep the original imported title visible so cleanup does not hide source data.

The import confirmation screen remains focused on classification and selection. Catalog matching happens after games are added to the library; users do not need to solve catalog ambiguity during import.

## Failure handling

- Provider unavailable or timed out: do not finalize lookup state/version for the affected batch; show retry.
- No deterministic winner: keep the row raw and manually selectable.
- Conflicting platform/type evidence: never auto-link.
- Duplicate imported/catalog identity: use existing deterministic merge behavior.
- Missing source platform/aliases on old data: use stored title variants and leave genuine ambiguity manual.
- A malformed alias or noisy product name: discard it as source evidence; never create a separate game from it.

## Testing

Tests must use representative categories, not production-only title exceptions.

Backend unit tests cover:

- trademark/copyright punctuation cleanup;
- bracketed and trailing PlayStation wrapper cleanup;
- presentation-only publisher prefix cleanup;
- letter/digit boundary normalization;
- safe game/product aliases and rejection of non-game aliases;
- query variant ordering, deduplication, and cap;
- candidate deduplication across variants;
- exact full-title, alias, and base-title scoring;
- PlayStation selection among duplicate exact-name platform releases;
- refusal when two candidates remain genuinely ambiguous;
- rejection of incompatible catalog types and platforms;
- no automatic fuzzy/substring match.

Backend integration tests cover:

- a raw title that fails as-is but links through a cleaned variant;
- source platform and safe aliases persisted by a new import;
- existing `review` and `no_match` rows retried after matcher-version increment;
- old rows without new evidence still enriched from cleaned title variants;
- provider failure leaves the batch retryable;
- linked/quarantined rows are not reconsidered;
- owner scoping, duplicate merge, and bounded batching remain intact.

Frontend tests cover:

- opening a library starts reprocessing of stale unresolved rows;
- progress terminates and refreshes the resulting linked cards;
- provider failure exposes retry without an infinite loop;
- manual search starts with a cleaned query and remains editable;
- unresolved rows remain visible and selectable.

Representative fixtures may include real-world shapes such as `EA SPORTS FIFA 16`, a title with `PlayStation 4 Edition`, a bracketed regional platform suffix, a trademark-bearing title, and duplicate same-name platform releases. Assertions target the general rule, not the literal game.

## Observability and rollout

Add structured matcher diagnostics without logging user authorization or full uploaded files:

- matcher version;
- number of variants attempted;
- number of candidates retrieved;
- winning evidence category and score, or unresolved reason;
- provider failure category.

Deploy the schema migration before application code in the normal deployment flow. After deployment, opening an existing library automatically retries unresolved PSN rows under Matcher V2. Monitor auto-link, review, no-match, and provider-failure counts. Keep manual selection available as the safety valve throughout rollout.

## Acceptance criteria

- The same ordinary titles that become findable after manually shortening the query are automatically retrieved through deterministic variants.
- Exact-name duplicate catalog rows choose the compatible PlayStation release when evidence is sufficient.
- No title-specific allowlist or denylist is introduced for reported examples.
- Explicit themes, apps, subscriptions, demos, add-ons, and test-server products are not auto-linked as normal games when source classification or catalog metadata identifies them.
- Existing unresolved library rows are retried without a new Excel import.
- Uncertain rows remain visible and can be linked manually.
- Steam behavior is unchanged.
