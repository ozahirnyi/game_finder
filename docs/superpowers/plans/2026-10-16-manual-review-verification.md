# Local manual review fixes: verification

Branch: `codex/phase-one-manual-review-fixes-20261016`. Fresh task baseline was fetched from `origin/main` with a clean working tree; the already approved local Phase 1 commits were fast-forwarded into this branch. All work was inline, without subagents. Local app, web and worker were rebuilt and left running at http://localhost:3000.

## Corrections and live evidence

- Deals now formats display labels independently from lowercased filter/cache keys. The live page shows **Action** and **RPG**, including the active heading. Naming follows existing profile choices and [Steam's genre presentation](https://store.steampowered.com/genre/Action).
- Explicit catalog preview now uses IGDB fuzzy search in multiqueries instead of almost-exact title predicates. Exact automatic PSN import queries remain unchanged. Decorative outer quotes are cleaned for retrieval; source titles are preserved. Year proximity and PlayStation availability help rank same-name records; uncertainty is preserved.
- Titles missing from IGDB's localized/alternative names can be resolved through a bounded Wikimedia full-text lookup and verified video-game entity labels. English and multilingual `mul` labels are supported. Non-game entities are excluded; retrieved names must still resolve to IGDB candidates and always remain uncertain proposals. Public lookups have a cache, a maximum of two concurrent searches, three entity candidates per title and batched entity hydration. If no usable public name is found, bounded AI translation remains available (ten titles per request, two concurrent requests).
- The real local preview changed from no suggestions for the four remaining raw PSN rows to:

| Source title | First verified catalog candidate | ID | State |
| --- | --- | --- | --- |
| «Ведьмак 3: Дикая Охота» | The Witcher 3: Wild Hunt | 1942 | Title matched |
| Южный Парк™: Палка Истины™ | South Park: The Stick of Truth | 1262 | Uncertain, confirmation required |
| Virtua Fighter 5 Ultimate Showdown | Virtua Fighter 5: Ultimate Showdown | 148696 | Title matched |
| STAR WARS JEDI FALLEN ORDER | Star Wars Jedi: Fallen Order | 74701 | Title matched |

- Matching, repair messaging, background progress polling and per-row PSN pickers now appear inside the PlayStation library tab. All/Steam retain game records without those tools. PlayStation preview requests carry `source=psn` on every page; backend source filtering preserves owner isolation and totals.
- Matching rows now compare imported titles with catalog covers, years and platforms. Alternatives distinguish same-name games, show the active choice and retain explicit confirmation before applying uncertain selections. The toolbar stays available while scrolling. Desktop and 390px browser scenarios cover selection, cancel/confirm, correction/unlink, source-tab visibility and absence of horizontal overflow.

Live catalog calls and browser inspection were read-only. No matches were applied, no games were deleted, and no user preference, wishlist or existing link was changed during this fix. No database model/migration change, deployment, push or merge to main was made.

## Automated results

| Verification | Result |
| --- | --- |
| `rtk proxy python scripts/check_backend_coverage.py` | **856 passed**, **94.13%** coverage, required minimum 94% |
| `rtk npm test -- --reporter=dot` in `web/` | **407 passed**, 55 files |
| `rtk npm run test:ui` in `web/` | **48 passed**, including desktop and narrow-screen matching |
| `rtk proxy .\node_modules\.bin\tsc.cmd --noEmit` in `web/` | Passed |
| ESLint for changed frontend source, unit tests and Phase 1 browser scenarios, `--max-warnings 0` | Passed |
| Docker rebuild of app/web/worker, including Vite production client/SSR build | Passed; backend healthy, worker running |
| Patch whitespace check | Passed |

RED/GREEN evidence: seven focused backend failures reproduced absent fuzzy queries, quotation cleanup, release ordering and translation behavior; source filtering separately failed with total 2 instead of 1; three frontend failures reproduced lowercase labels, unscoped preview pages and PlayStation tools on All games. The alternative metadata test failed before showing distinct year/platform choices. Public lookup tests reproduced AI-credit independence and missing multilingual labels before their fixes. External calls are stubbed in automated tests; the external-HTTP guard remains enabled.

The new provider query follows the [IGDB query documentation](https://api-docs.igdb.com/). Public title discovery follows [MediaWiki full-text search](https://www.mediawiki.org/wiki/API:Search) and the [Wikibase API](https://www.mediawiki.org/wiki/Wikibase/API). Those services supply search names, never ownership evidence.

## Limits

The configured AI service returned HTTP 429 `credit_balance_exhausted` during live diagnosis. Its balance was not changed. The verified South Park lookup succeeds through public data without using AI credit; other titles may still require a manual English query when both public metadata and AI are unavailable. This is not a guarantee that every localized title will resolve.

Existing dependency deprecations/SQLite resource warnings, jsdom scroll/navigation warnings, two home trending-mock warnings and Vite route-export/tsconfig-path warnings remain. Screenshots and live provider diagnostics are stored under ignored `.superpowers/`. The normal and narrow matching screenshots were inspected; automated screenshots can capture dialog enter-animation frames, while live browser inspection confirmed the settled interface.
