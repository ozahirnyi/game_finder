# PlayFinder Phase 1: Search and Personalization

Status: product design approved in chat on 15 October 2026; local implementation authorized.
Baseline: origin/main cb0cbac. Phase 0 is closed; no production deployment is requested.

## Product decisions

1. Home keeps title search and adds an explicit AI game search entry with example prompts. AI search uses only the submitted request, not the library.
2. Search offers PC, PlayStation, Xbox and Switch families. Cards retain concrete catalog platform labels. Existing genre and solo/co-op/multiplayer filters remain; expanding genres/tags is deferred. Filter state survives refresh and return navigation.
3. Keep recommendation explanation copy. Investigate why different libraries return mostly the same six games; replace the shared-only trending candidate pool with candidates derived from actual user tastes when evidence warrants it. Retain verified catalog targets and exclude owned games. Do not manufacture differences between similar users.
4. Reuse current PSN matching and exact automatic import linking. Add an explicit pass over remaining PSN and manual records, including previously attempted records. Search normalization and localized/alternative names produce suggestions, never automatic fuzzy ownership.
5. The matching list preserves source titles, identifies uncertain proposals, supports choosing another catalog game and leaving entries unlinked, and offers selecting all proposals including uncertain ones. Applying uncertain choices requires a count-bearing warning and explicit confirmation. No selection mutates ownership until Apply. Correcting/removing a catalog link keeps the underlying entry.
6. Confirmed matches use existing ownership/wishlist/alert policies. Duplicate reconciliation must preserve notes/info/playtime and avoid merging different providers. Removing ownership never re-enables paused alerts automatically.
7. PlayStation copy says import from export file; it must not imply a direct account connection.
8. Deals keep owned games visible. Show library state with source and wishlist state; allow direct wishlist saving. Identity must be verified by provider IDs. A first or merely same-title search result is not reliable identity. Unresolved Steam offers retain Steam-only navigation/actions.

## Evidence and acceptance corpus

A read-only authenticated browser audit loaded all 177 PlayStation rows: 144 had catalog links and 33 were unlinked. Background job counts (151 linked, 34 review) describe a previous run, not the current library inventory.

Representative source titles: «Ведьмак 3: Дикая Охота»; «Ведьмак 3: Дикая Охота — Полное издание»; Южный Парк™: Палка Истины™; Virtua Fighter 5 Ultimate Showdown; STAR WARS JEDI FALLEN ORDER; Grand Theft Auto V (PS4™); GOD OF WAR® III REMASTERED; Ghost of Tsushima DIRECTOR'S CUT; LEGO® Хоббит™; LEGO® Marvel: Супегерои; LEGO Batman 3: Покидая Готэм; Back 4 Blood: Стандартное издание; DETROIT BECOME HUMAN.

Skyrim exists both as an unlinked `The Elder Scrolls V: Skyrim Special Edition` and a linked `The Elder Scrolls V: Skyrim - Special Edition`; this is a duplicate-reconciliation fixture. Demo Just Dance 2017, prototype Indivisible and beta GWENT must retain their variant evidence. Year normalization must distinguish meaningful sequel/release years from decorative metadata. Test catalog responses are fixtures, not claims that production IGDB returned these matches.

## Architecture and boundaries

Keep FastAPI, existing SQLAlchemy Game/link fields, TanStack Query and existing UI conventions. Add a focused library matching service and schemas/endpoints, rather than embedding matching algorithms in main.py. Both preview and apply are authenticated and owner-scoped; cross-owner IDs return 404. Preview failures remain distinct from no candidates. A preview is read-only. Existing data model fields suffice unless implementation proves otherwise; model changes require Alembic migration.

Separate shared offer data from per-user library/wishlist state; never put personal state in public caches. Batch reads or bounded per-card reads must avoid re-fetching the entire Steam library for every deal. Recommendation caches include owner and preference fingerprint and invalidate when the algorithm version changes.

No party, Party Finder, groups or Discord. Do not mutate real production library data during validation. Production price-alert delivery remains a separate verification item.

## Verification

Backend: normalization/localization retrieval, fuzzy suggestions without auto-linking, owner isolation, correct fetched IDs, duplicate preservation, atomic apply/retry, alert pausing/idempotence, reattempted unresolved rows, contrasting recommendation tastes, exclusion and cache isolation, and verified deal identity.

Frontend: selection of all results, uncertain warning count/cancel, manual target replacement, keep/unlink, error/retry, updated collection queries, AI entry, family filters and URL restoration, per-user deal states and provider-correct wishlist saving.

Browser: local stubbed scenarios for home -> AI, persistent filters -> detail -> return, matching -> choose all -> cancel/confirm -> owned, correction/unlink, and deals -> wishlist. Full backend/frontend regression plus frontend build/type checks and existing browser suite. Record exact results and limitations before claiming completion.
