# PlayFinder Library, Recommendations, and Mobile Fixes — Handoff

## Start here

Read `AGENTS.md`, then this handoff and `docs/superpowers/specs/2026-07-27-library-recommendations-mobile-design.md`. Execute `docs/superpowers/plans/2026-07-27-library-recommendations-mobile-fixes.md` task by task using TDD. This handoff is planning only; no product code from this scope has been implemented yet.

## User-approved product decisions

- All button/link-button controls need hover and keyboard focus feedback.
- Library opens with **All games** and filters: **All**, **PlayFinder**, **Steam**, **PSN**.
- Steam library games must open the appropriate PlayFinder game detail page, not remain static rows.
- Email/password signup still asks the user to create a social/public nickname. First Google and Steam sign-in automatically create it from Google display name or Steam persona name, without overwriting a later manual nickname.
- Recommendations are Steam-focused: with Steam connected, recommend only Steam-available games using Steam playtime as the strongest signal. Exclude owned games and PSN-only games. Without Steam, use Library plus profile preferences but still recommend only Steam-available games.
- Recommendation output must change when Steam library/playtime, Library, or profile preferences change; no global identical fallback list.
- Mobile bottom navigation has exactly: Home, Library, Deals, Friends, Profile.
- Mobile game detail has no unexplained blank scrollable vertical space.
- Mobile Deals cards are **vertical**: wide cover on top, full-width readable text below, multi-line title, wrapped in-card price/discount/action. Do not preserve the current narrow horizontal mobile card.

## Current repository state

- Repository: `https://github.com/ozahirnyi/game_finder`
- Production: `https://playfinder.cc`
- Health endpoint: `https://playfinder.cc/api/health`
- Planning base: `origin/main` at `90e94ce4312c579ab59ee6fe42eff93519f870ba`.
- Planning/spec branch: `codex/gameplay-fixes-design`; it contains only the design and plan documents.

## Relevant code map

- `web/src/routes/library.tsx`: current Library route; uses three page-like tabs and only its saved-games list in the first tab.
- `web/src/features/library/SteamLibraryPanel.tsx`: Steam rows are non-clickable.
- `web/src/components/AppShell.tsx`: current mobile implementation renders `nav.slice(0, 5)`, which omits Friends.
- `web/src/routes/deals.tsx`: `DealCard` is horizontally compact on mobile and the mobile grids use two columns; this causes the unreadable covers/text/price overflow.
- `web/src/routes/games.$gameId.tsx`: supports saved UUID details plus catalog detail resolution; inspect its wrappers for the mobile blank space before changing anything.
- `app/main.py`: `/dashboard`, Google and Steam callbacks, `/profile/summary`, Steam library endpoints, and social nickname gate.
- `app/crud.py`: `build_display_name` and `create_user`; add the public-nickname helper here.
- `app/steam_recommendations.py`: current cache key only fingerprints Steam games and the fallback can be shared.
- `app/steam_store.py`: existing Steam Store candidates are the availability source.

## Mandatory working and GitHub rules

- Start from a new `codex/<task>` branch and isolated worktree based on current `origin/main`; never work directly on main or phase branches.
- Keep scope small, preserve unrelated modifications, never commit secrets, and use `apply_patch` for edits.
- Diagnose/reproduce first. Add a focused failing regression test before each minimal code fix. Run focused tests, then full applicable suites and build.
- Before a commit/PR inspect `git status` and the scoped diff. Make small thematic commits.
- Push a draft PR with base `main`; its description must list changes and verification. Do not merge/deploy until the user explicitly says to merge.
- After merge, wait for the GitHub deploy workflow to succeed and verify the production health endpoint. Do not claim deployment merely because a PR merged.

## Suggested first message in the new chat

```text
Read docs/handoffs/2026-07-27-library-recommendations-mobile-handoff.md and execute the linked implementation plan. Start by checking origin/main and AGENTS.md, then create a fresh codex/<task> worktree. Follow the approved scope exactly, use TDD, open a draft PR to main, and wait for my explicit merge approval.
```
