# PlayFinder — catalog, recommendations, and genre deals handoff

## Purpose

This document is the starting context for the next PlayFinder task. Catalog Favorites and automatic Steam recommendations are live; the remaining product item is genre-based deal discovery on the dashboard.

## Current production state

- Repository: `https://github.com/ozahirnyi/game_finder`
- Local repository root: `C:\Users\zagir\PycharmProjects\game_finder`
- Production: `https://playfinder.cc`
- Health endpoint: `https://playfinder.cc/api/health`
- Current `origin/main`: `79b3229bc5636706d3e338d5be395a0f1e2104dc`
- Latest `Deploy to Lightsail over SSH` workflow: successful for that SHA.

## Non-negotiable local workflow

Read `AGENTS.md` and `C:\Users\zagir\.codex\RTK.md` before working.

- Prefix every terminal command with `rtk`.
- Use constrained `rtk rg` searches and bounded file reads. If `rtk read` is unavailable, use `rtk proxy powershell -NoProfile -Command` with explicit limits.
- Use `apply_patch` for source and document edits; do not write files through shell redirection.
- Start every implementation task in a separate `codex/<task>` branch and isolated worktree. Do not work directly on `main` or `phase-*` branches.
- Preserve unrelated working-tree changes.
- Use test-first development for behavior changes: add a focused failing test, verify it fails, implement the minimal fix, then verify it passes.
- Before opening a PR, run relevant focused tests, the full relevant suite, production build when frontend changes, and `rtk git diff --check`.

## GitHub and deployment rules

- Push the feature branch and open a **draft PR** against `main`; keep the worktree available for review fixes.
- Do not merge or deploy without the user's explicit instruction (for example, “сливай”).
- When instructed to merge, mark the draft ready, merge only after checks are clean, and wait for the `Deploy to Lightsail over SSH` workflow for the merged SHA.
- Do not claim production changed merely because the PR merged. Confirm the workflow conclusion is `success` and call `https://playfinder.cc/api/health`.
- If the GitHub-hosted deploy cannot connect to Lightsail, investigate the workflow and use the repository's `scripts/deploy/ssh_deploy.sh` only when needed. Normalize CRLF on the copied remote script, then verify the remote repository SHA and public health endpoint.
- Never force-push, reset hard, or delete a branch/worktree unless the user explicitly asks.

## Completed work

### Catalog Favorites

- Added server-authoritative, idempotent catalog Favorites saving.
- Catalog game detail and search cards provide Library, Wishlist, and Favorites actions for authenticated users.
- The Favorites text action was replaced with an accessible heart control:
  - outlined heart adds the game;
  - filled heart removes it;
  - pending requests disable the control and errors remain visible.
- Collection changes invalidate Favorites, dashboard, and profile queries.

### Automatic Steam recommendations

- A linked Steam account receives dashboard recommendations without pressing a separate button.
- Results are cached per user and Steam-library fingerprint.
- A `v2` cache key prevents old recommendation payloads from bypassing the current filtering and RAWG enrichment.
- Recommendations exclude titles already present in the Steam library and remove duplicate suggestions.
- RAWG metadata enriches items with `rawg_id` and `cover_url`; recommendation cards link to catalog details when an id exists.
- Dashboard cards render recommendation cover URLs through `GameCover` and retain a colour fallback if no cover URL is available.

### Dashboard layout

- Recommendation cards use a compact two-column mobile / four-column desktop grid.
- `Price drops` is a compact panel in the right sidebar directly below Steam.

## Remaining work: genre-based dashboard deals

Replace the current single `Price drops` list with genre sections.

### Product requirements

- Use the first five `favorite_genres` from the profile.
- If no genres are set, use exactly: `Action`, `RPG`, `Adventure`, `Strategy`, `Indie`.
- Render up to five sections, each containing up to five active discounted games relevant to that genre.
- Fetch a substantially larger Steam Store candidate pool, enrich unique games with RAWG once, normalize RAWG genre names, then group by the selected genres.
- Do not fill a genre section with irrelevant discounts. Empty or partial sections must state that there are no matching current deals.
- Each item needs artwork, current price/discount history, external store URL, and RAWG id when available for catalog navigation.
- Cache normalized deal groups by country and selected genre set.

### Suggested implementation boundaries

1. Backend response schema and cached service for grouped deal sections; retain existing flat public endpoints if compatibility requires it.
2. Steam candidate collection and bounded RAWG enrichment/classification.
3. Dashboard API types and `web/src/routes/index.tsx` rendering for sections and honest empty states.
4. Focused backend and frontend tests, then full suites, frontend build, PR, deploy verification.

## Useful locations

- Dashboard backend: `app/main.py`
- Steam recommendation service: `app/steam_recommendations.py`
- Steam/RAWG integrations: `app/integrations/`
- Dashboard frontend: `web/src/routes/index.tsx`
- API client/types: `web/src/lib/api.ts`
- Catalog action component: `web/src/components/CatalogGameActions.tsx`
- Frontend route tests: `web/src/test/live-data.routes.test.tsx` and `web/src/test/catalog.routes.test.tsx`

## Acceptance criteria for the remaining deals task

- A user sees deal sections matching their saved genres, or the exact fallback genre set.
- No section has more than five games and no irrelevant items are used to fill it.
- Games show a usable cover, price/discount information, a store link, and catalog navigation when RAWG matching succeeds.
- Cache reuse works for unchanged country/genre inputs.
- Backend tests, frontend tests, and production build pass; merged `main` is deployed and health is green.
