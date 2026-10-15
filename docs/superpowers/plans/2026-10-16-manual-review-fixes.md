# Manual review fixes

User authorized corrections to the local Phase 1 preview; execute inline without subagents. Mandatory fetch, clean status and new branch from origin/main completed; approved local Phase 1 commits were fast-forwarded onto `codex/phase-one-manual-review-fixes-20261016` because the defects concern that unmerged implementation.

## Evidence and intended result

Live strict multiqueries returned no Star Wars/Virtua Fighter results, while fuzzy search returned catalog IDs 74701 and 148696. A cleaned Witcher title returned 1942; the guillemet-wrapped source did not. South Park's Russian name exists in neither alternative names nor localizations. Match ranking also ignored release year and favored an older Hades record by numeric ID. Deals display cache-normalized genre keys directly. PlayStation matching tools and raw-row pickers are currently visible on All games.

Keep existing theme tokens, font and rounded controls. Inside the PlayStation tab, put a compact matching header below navigation, source-to-catalog comparison rows, visible year/platform information for every candidate, selected state and a sticky apply toolbar. Preserve explicit uncertainty confirmation. Hide PlayStation tools on All/Steam, including raw-row pickers; scope PlayStation preview to PSN entries. No change to existing exact import auto-linking, owner isolation or source record preservation.

- [x] Add RED tests for fuzzy matching batch queries, decorative quotation cleanup, localized-title translation verified by catalog results, year/platform ordering, source-scoped paging and provider errors. Add a bounded AI title-translation helper (ten titles per request, at most two concurrent requests) used only by explicit unmatched non-Latin lookups; translated proposals always remain uncertain.
- [x] Implement provider retrieval separately from strict import matching. Preserve query/ranking evidence; prefer matching release years and compatible platforms before ID tie-breaks. Include existing verified cover URLs in proposals.
- [x] Add RED tests for lowercase cached Deals genres and normalize display labels independently of filter keys. Preserve RPG acronym and existing canonical genre names.
- [x] Add RED tests for PlayStation-only tools and PSN preview scope, then move tools below tabs and enable source-scoped preview. Keep the actual library cards available in All games.
- [x] Redesign comparison rows, candidate selection and bulk toolbar in existing theme, with keyboard focus and narrow-screen layout. Candidate buttons must distinguish same-name editions by year/platform. Keep existing confirmation, correction and partial-failure contracts.
- [x] Run focused backend/Vitest RED-GREEN, full regression and coverage gate, build/type/scoped lint, browser tests and live local checks. Rebuild local app/web/worker and leave the updated site running for manual review. Never apply matches or alter the user's current local test library during validation.

## Final review

Live testing exposed exhausted AI credit and Wikidata multilingual labels. A cached public title lookup now precedes AI translation and accepts only video-game entities, supporting en and mul labels. All four remaining PSN examples resolve to appropriate catalog proposals, with South Park kept uncertain. No user links were applied. Final results: 856 backend tests, 94.13% coverage; 407 frontend tests; 48 browser scenarios; production build, TypeScript and scoped lint pass. See [verification](2026-10-16-manual-review-verification.md).
