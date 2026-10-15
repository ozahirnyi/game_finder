# Phase 1 Local Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

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

**Interfaces:** POST /library/catalog-matches/preview returns `{items: [{game_id, title, source, link_state, catalog_game_id, status, reason, suggestions: [{id, title, released, platforms, confidence}]}]}`. Status is matched/review/no_match/unavailable; confidence exact/likely. Preview covers all remaining PSN/manual rows, including old review/no-match/skipped rows on explicit user request, and must not mutate them. POST /library/catalog-matches/apply consumes `{decisions: [{game_id, action, catalog_id?}]}` with link/keep_raw/unlink; returns `{updated: number}`. Maximum 500 decisions; validate complete owner scope before writes. The UI may list linked rows for explicit correction/unlink if a parameter requests them. Preserve same-target retries and reject stale conflicts rather than overwriting unrelated new links.

- [ ] Add fixtures for localized names, trademarks, platform wrappers, punctuation, edition/year ambiguity, previously reviewed rows, and a manual non-PlayStation record.
- [ ] Write failing narrow tests asserting preview suggestions without persistence and API owner isolation/atomic application. Example assertion:
  ```python
  before = game.catalog_game_id
  response = client.post('/library/catalog-matches/preview', headers=headers)
  assert response.status_code == 200
  assert game.catalog_game_id == before
  assert response.json()['items'][0]['suggestions'][0]['confidence'] in {'exact', 'likely'}
  ```
- [ ] Run `rtk proxy python -m pytest tests/test_library_catalog_matching.py tests/integration/backend/test_library_catalog_matches_api.py -q --no-cov`; record expected failures before implementation.
- [ ] Implement bounded catalog retrieval, localized names and cleaned query variants; rank fuzzy candidates as likely while preserving full edition/platform evidence. Keep PSN exact auto-link thresholds unchanged. Reuse duplicate reconciliation and pause_owned_alerts after confirmed apply. Do not quarantine arbitrary manual records.
- [ ] Re-run narrow tests plus existing PSN/ownership tests, self-review, commit owned files and record results in .superpowers/sdd/task-1-report.md.

## Task 2: Recommendation quality

**Files:** app/steam_recommendations.py; tests/test_personalized_catalog_recommendations.py; optional focused provider helper/test in separate new files.

**Interfaces:** Preserve get_personalized_recommendations(user, saved_games, steam_games, favorites=None, wishlist=None) and current response/reason copy. Provider retrieval functions are async and stubbed in tests.

- [ ] Reproduce shared candidate-pool limitation with contrasting libraries and candidates outside trending; verify preference data reaches ranking and owner cache isolation.
- [ ] Run `rtk proxy python -m pytest tests/test_personalized_catalog_recommendations.py -q --no-cov` and record the new failures.
- [ ] Retrieve bounded preference-derived catalog candidates in addition to popularity, based on verified linked library/favorite/wishlist and played Steam games. Deduplicate; exclude real owned identities and preserve deterministic scoring. Version the cache. Popular fallback when there are no usable signals remains honest.
- [ ] Cover catalog outages, meaningful preference changes, Steam/catalog ID namespace collisions, and absence of redundant candidates. Re-run recommendation regression; self-review and commit owned files. Write .superpowers/sdd/task-2-report.md.

## Task 3: Search and home AI entry

**Files:** web/src/routes/index.tsx, web/src/routes/search.tsx, web/src/lib/api.ts (CatalogPlatform union only), web/src/components/ConnectedServices.tsx, app/integrations/igdb.py (family mapping only); focused index/search/ConnectedServices tests and tests/test_igdb.py. Parent integrates family validation/matching into main.py.

**Interfaces:** New platform keys playstation and xbox; preserve legacy keys. Within platform choices use OR, other facets remain existing semantics. All selected query/feature/genre/platform/sale/mode state restores from URL and updates on history navigation. AI entry goes to /search?mode=ai; no library prompt enrichment.

- [ ] Add failing home entry and search tests for PS/Xbox/Switch families, query-string restoration, detail return, and browser Back/Forward changes. Add provider mapping assertions.
- [ ] Run `rtk npm test -- --reporter=dot` with the focused test file arguments and `rtk proxy python -m pytest tests/test_igdb.py -q --no-cov`; record expected failures.
- [ ] Add a prominent AI entry with example request links. Implement platform family UI and persistent URL state using current router patterns. Make PlayStation service status clearly imported rather than Connected.
- [ ] Run focused tests, self-review, commit owned files, report .superpowers/sdd/task-3-report.md. Parent applies the small app/main.py family key and sale matching changes.

## Task 4: Matching UI and collection integration

**Files:** new web/src/components/LibraryCatalogMatches.tsx and test; web/src/routes/psn-library-repair.tsx, web/src/routes/library.tsx, web/src/lib/api.ts (new matching types/functions); existing repair/library tests.

- [ ] Add failing tests for explicit lookup, select all including uncertain rows, count-bearing confirm/cancel, manual catalog search replacement, keep_raw, unlink/correction, transient error and no-match states.
- [ ] Implement the Task 1 API contract and one shared review component reachable from Library for both manual and PSN entries. Keep existing quarantine/delete functions separate and avoid deleting user entries.
- [ ] Apply selected decisions only after confirmation, invalidate membership/library/dashboard/wishlist/alerts queries. Preserve selection while editing choices and prevent duplicate in-flight applies.
- [ ] Run focused Vitest and backend matching tests. Verify same-target retries and Skyrim preservation. Commit with test evidence.

## Task 5: Verified deal identity and personal actions

**Files:** app/genre_deals.py, app/deal_cache.py where required, app/main.py homepage-deal enrichment only; web/src/components/DealCollectionActions.tsx and test, web/src/routes/deals.tsx; focused backend deal and frontend tests.

- [ ] Write failing tests proving first/same-title results with conflicting or absent Steam identity never become catalog navigation. Verify a matching Steam appid can resolve catalog navigation.
- [ ] Remove unsafe fallback; version affected caches and retain Steam-only routes when unverified.
- [ ] Add failing UI tests for owner/wishlist/new/error/guest cases, source labels, provider-specific save and duplicate handling. Use shared personal queries rather than retrieving the full Steam library per offer.
- [ ] Implement source-aware owned and wishlist labels and a direct wishlist button for eligible games. Store links and owned deals stay visible; personal state stays outside shared caches.
- [ ] Run focused pytest/Vitest regressions and commit with evidence.

## Task 6: Acceptance, review and local delivery

**Files:** web/e2e/phase-one-discovery.spec.ts plus fixtures only if necessary; plan/spec status and verification report.

- [ ] Add local stubbed browser scenarios: AI entry, platform family persistence/return, matching select-all cancel/confirm/correction, deals save and existing owned state.
- [ ] Run `rtk proxy python -m pytest -q`, `rtk proxy python scripts/check_backend_coverage.py`, `rtk npm test`, `rtk npm run build`, TypeScript checks and `rtk npm run test:ui` from their appropriate directories. Run focused red/green before the full regression; document environment-related constraints exactly.
- [ ] Review the complete branch diff for identity, owner isolation, stale UI state and query invalidation. Resolve important findings, rerun affected tests, then do the final regression needed for changed code.
- [ ] Update this checklist and verification results. Leave local branch/commits reviewable; do not publish or deploy. Report exact tests, limitations and file paths.
