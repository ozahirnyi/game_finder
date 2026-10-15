# Phase 1 Local Implementation Plan

> Execute task-by-task with recorded verification. As requested on 16 October, all remaining implementation, review and verification is performed inline without subagents.

**Goal:** Complete the agreed Phase 1 locally with automated and browser verification.

**Architecture:** Extend current provider-aware identity and collection flows. Isolate matching suggestions from confirmed ownership, expand recommendation candidate retrieval using real preferences, and compose personal deal state outside public offer caches.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, pytest, React, TanStack Router/Query, Vitest, Playwright.

## Global Constraints

- Work only on codex/phase-one-local-implementation, created from origin/main after fetch and a clean status.
- No production deployment or production account/library mutations.
- Preserve owner scoping; cross-owner resource IDs return 404.
- Similar titles are suggestions; only explicit confirmation applies new uncertain links.
- Preserve current exact PSN import matching, current recommendation explanation copy, existing genres/features and owned/wishlist/alert rules.
- Keep PC / PlayStation / Xbox / Switch as family filters; AI uses submitted request only.
- Unit/contract tests stub external providers. Model changes require Alembic migration.
- No party, groups or Discord; production alert delivery is outside this change.
- Every task follows RED -> GREEN -> focused regression -> review. Use rtk-prefixed shell commands and python -m pytest on this host.

## Task 1: Library matching backend

**Files:** Create app/library_catalog_matching.py; modify app/psn_catalog_matcher.py, app/psn_catalog_service.py only as necessary, app/schemas.py and matching endpoint region in app/main.py; add tests/test_library_catalog_matching.py and tests/integration/backend/test_library_catalog_matches_api.py.

**Interfaces:** POST /library/catalog-matches/preview accepts `include_linked`, `offset`, `limit` (default 100, maximum 500) and returns `{total, next_offset, items: [{game_id, title, source, link_state, catalog_game_id, status, reason, suggestions: [{id, title, released, platforms, confidence}]}]}`. Status is matched/review/no_match/unavailable; confidence exact/likely. The UI follows every page, including libraries above 500 rows. Preview includes old review/no-match/skipped rows on explicit request and never mutates them. POST /library/catalog-matches/apply consumes `{decisions: [{game_id, action, catalog_id?, expected_catalog_game_id}]}` with link/keep_raw/unlink; returns `{updated: number}`. Maximum 500 decisions per request, all owner IDs validated before writes. The UI sends batches of 100; each batch is atomic, and a later failure reports the applied count and forces a fresh preview. `include_linked=true` supports correction/unlink. Preserve same-target retries and reject stale conflicts rather than overwriting unrelated new links. Removing a link or correcting to a game without artwork clears the old catalog cover.

- [x] Add fixtures for localized names, trademarks, platform wrappers, punctuation, edition/year ambiguity, previously reviewed rows, and a manual non-PlayStation record.
- [x] Write failing narrow tests asserting preview suggestions without persistence and API owner isolation/atomic application. Example assertion:
  ```python
  before = game.catalog_game_id
  response = client.post('/library/catalog-matches/preview', headers=headers)
  assert response.status_code == 200
  assert game.catalog_game_id == before
  assert response.json()['items'][0]['suggestions'][0]['confidence'] in {'exact', 'likely'}
  ```
- [x] Run `rtk proxy python -m pytest tests/test_library_catalog_matching.py tests/integration/backend/test_library_catalog_matches_api.py -q --no-cov`; record expected failures before implementation.
- [x] Implement bounded catalog retrieval, localized names and cleaned query variants; rank fuzzy candidates as likely while preserving full edition/platform evidence. Keep PSN exact auto-link thresholds unchanged. Reuse duplicate reconciliation and pause_owned_alerts after confirmed apply. Do not quarantine arbitrary manual records.
- [x] Re-run narrow tests plus existing PSN/ownership tests, self-review, commit owned files and record results in .superpowers/sdd/task-1-report.md.

## Task 2: Recommendation quality

**Files:** app/steam_recommendations.py; tests/test_personalized_catalog_recommendations.py; optional focused provider helper/test in separate new files.

**Interfaces:** Preserve get_personalized_recommendations(user, saved_games, steam_games, favorites=None, wishlist=None) and current response/reason copy. Provider retrieval functions are async and stubbed in tests.

- [x] Reproduce shared candidate-pool limitation with contrasting libraries and candidates outside trending; verify preference data reaches ranking and owner cache isolation.
- [x] Run `rtk proxy python -m pytest tests/test_personalized_catalog_recommendations.py -q --no-cov` and record the new failures.
- [x] Retrieve bounded preference-derived catalog candidates in addition to popularity, based on verified linked library/favorite/wishlist and played Steam games. Deduplicate; exclude real owned identities and preserve deterministic scoring. Version the cache. Popular fallback when there are no usable signals remains honest.
- [x] Cover catalog outages, meaningful preference changes, Steam/catalog ID namespace collisions, and absence of redundant candidates. Re-run recommendation regression; self-review and commit owned files. Write .superpowers/sdd/task-2-report.md.

**Review refinement:** Similar candidates for the four strongest seeds now use one batched link query and one batched hydration query, followed by at most three genre queries. The five-query bound applies to expansion, excluding existing trending and collection/Steam identity resolution. Wire-level tests cover the actual provider query calls.

## Task 3: Search and home AI entry

**Files:** web/src/routes/index.tsx, web/src/routes/search.tsx, web/src/lib/api.ts (CatalogPlatform union only), web/src/components/ConnectedServices.tsx, app/integrations/igdb.py (family mapping only); focused index/search/ConnectedServices tests and tests/test_igdb.py. Parent integrates family validation/matching into main.py.

**Interfaces:** New platform keys playstation and xbox; preserve legacy keys. Within platform choices use OR, other facets remain existing semantics. All selected query/feature/genre/platform/sale/mode state restores from URL and updates on history navigation. AI entry goes to /search?mode=ai; no library prompt enrichment.

- [x] Add failing home entry and search tests for PS/Xbox/Switch families, query-string restoration, detail return, and browser Back/Forward changes. Add provider mapping assertions.
- [x] Run `rtk npm test -- --reporter=dot` with the focused test file arguments and `rtk proxy python -m pytest tests/test_igdb.py -q --no-cov`; record expected failures.
- [x] Add a prominent AI entry with example request links. Implement platform family UI and persistent URL state using current router patterns. Make PlayStation service status clearly imported rather than Connected.
- [x] Run focused tests, self-review, commit owned files, report .superpowers/sdd/task-3-report.md. Parent applies the small app/main.py family key and sale matching changes.

## Task 4: Matching UI and collection integration

**Files:** new web/src/components/LibraryCatalogMatches.tsx and test; web/src/routes/psn-library-repair.tsx, web/src/routes/library.tsx, web/src/lib/api.ts (new matching types/functions); existing repair/library tests.

- [x] Add failing tests for explicit lookup, select all including uncertain rows, count-bearing confirm/cancel, manual catalog search replacement, keep_raw, unlink/correction, transient error and no-match states.
- [x] Implement the Task 1 API contract and one shared review component reachable from Library for both manual and PSN entries. Keep existing quarantine/delete functions separate and avoid deleting user entries.
- [x] Apply selected decisions only after confirmation, invalidate membership/library/dashboard/wishlist/alerts queries. Preserve selection while editing choices and prevent duplicate in-flight applies.
- [x] Run focused Vitest and backend matching tests. Verify same-target retries and Skyrim preservation. Commit with test evidence.

## Task 5: Verified deal identity and personal actions

**Files:** app/genre_deals.py, app/deal_cache.py where required, app/main.py homepage-deal enrichment only; web/src/components/DealCollectionActions.tsx and test, web/src/routes/deals.tsx; focused backend deal and frontend tests.

- [x] Write failing tests proving first/same-title results with conflicting or absent Steam identity never become catalog navigation. Verify a matching Steam appid can resolve catalog navigation.
- [x] Remove unsafe fallback; version affected caches and retain Steam-only routes when unverified.
- [x] Add failing UI tests for owner/wishlist/new/error/guest cases, source labels, provider-specific save and duplicate handling. Use shared personal queries rather than retrieving the full Steam library per offer.
- [x] Implement source-aware owned and wishlist labels and a direct wishlist button for eligible games. Store links and owned deals stay visible; personal state stays outside shared caches.
- [x] Run focused pytest/Vitest regressions and commit with evidence.

## Task 6: Acceptance, review and local delivery

**Files:** web/e2e/phase-one-discovery.spec.ts plus fixtures only if necessary; plan/spec status and verification report.

- [x] Add local stubbed browser scenarios: AI entry, platform family persistence/return, matching select-all cancel/confirm/correction, deals save and existing owned state.
- [x] Run `rtk proxy python -m pytest -q`, `rtk proxy python scripts/check_backend_coverage.py`, `rtk npm test`, `rtk npm run build`, TypeScript checks and `rtk npm run test:ui` from their appropriate directories. Run focused red/green before the full regression; document environment-related constraints exactly.
- [x] Review the complete branch diff for identity, owner isolation, stale UI state and query invalidation. Resolve important findings, rerun affected tests, then do the final regression needed for changed code.
- [x] Update this checklist and verification results. Leave local branch/commits reviewable; do not publish or deploy. Report exact tests, limitations and file paths.

## Local delivery — 16 October 2026

All six tasks are implemented and verified. Final integration commit: 3e1fbf0. Full backend: 842 passed with 94.15% coverage; frontend: 403 passed; browser: 47 passed. Production build, TypeScript, scoped lint and patch checks pass. See [the final verification report](2026-10-16-phase-1-verification.md) for review fixes, exact checks and live acceptance limits. The branch and worktree are retained locally; no push, merge or deployment.
