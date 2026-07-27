# Library, Recommendations, and Mobile Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a unified filtered Library, clickable Steam titles, automatic social-login nicknames, personal Steam-eligible recommendations, and the agreed mobile UI repairs.

**Architecture:** The backend supplies one owner-scoped, source-labelled Library view and a resolved catalog target for every Steam title. Recommendations become a user-input-fingerprinted service: Steam playtime is preferred, Library/profile data is supplemental, and every candidate is verified as Steam-available before display. The frontend consumes those contracts in Library and Dashboard, while mobile styles keep navigation and cards readable at narrow widths.

**Tech Stack:** FastAPI, SQLAlchemy, Redis, Steam Web/Store APIs, RAWG catalog lookup, React, TypeScript, TanStack Router/Query, Tailwind CSS, Vitest, pytest.

## Global Constraints

- Base all work on `origin/main`; create a fresh `codex/<task>` branch and isolated worktree.
- Read `AGENTS.md`; use constrained `rtk` commands and `apply_patch` for all edits.
- Use TDD for every task: focused failing test, minimal implementation, focused passing test, then a thematic commit.
- Preserve owner scoping and current email/password nickname behavior. Do not commit secrets or unrelated changes.
- PR base is `main`; create a draft PR and wait for explicit user approval before merging. After merge, wait for the production workflow and call `https://playfinder.cc/api/health`.

---

### Task 1: Establish shared interactive states

**Files:**
- Modify: `web/src/components/ui-bits.tsx`, `web/src/components/AppShell.tsx`, `web/src/routes/deals.tsx`, `web/src/routes/games.$gameId.tsx`
- Modify: `web/src/index.css` or the existing shared Tailwind utility location after inspection
- Test: `web/src/components/AppShell.test.tsx`, `web/src/test/catalog.routes.test.tsx`

**Interfaces:** Produce reusable button/link class constants with `hover`, `active`, and `focus-visible:ring-*` states. Disabled controls must not animate or appear actionable.

- [ ] Write tests that render a primary action and a navigation action, then assert the shared interactive class contains both `hover:` and `focus-visible:` utilities. Add a focused Deals action assertion so local one-off classes cannot omit the state.
- [ ] Run `rtk npm --prefix web test -- --run src/components/AppShell.test.tsx src/test/catalog.routes.test.tsx`; observe the new assertions fail.
- [ ] Add shared class strings equivalent to:

```ts
const primaryAction = "rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
const secondaryAction = "rounded-lg border border-border bg-surface px-4 py-2 font-bold transition-colors hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
```

Apply them to shared UI primitives first, then replace the route-local button/link-button classes that remain without equivalent states. Do not apply hover styling to plain text, disabled controls, or non-interactive cards.
- [ ] Rerun the focused tests; commit `feat: add consistent interactive states`.

### Task 2: Provide an aggregated, source-aware Library API and filter UI

**Files:**
- Modify: `app/main.py`, `app/schemas.py`, `app/steam.py` only if a Steam library adapter type is needed
- Modify: `web/src/lib/api.ts`, `web/src/routes/library.tsx`
- Test: `tests/test_library_api.py` (create if absent), `web/src/test/live-data.routes.test.tsx`

**Interfaces:** Add an authenticated Library response whose records have `source: "manual" | "psn" | "steam"`, a stable detail target, title, cover/icon data, and playtime where applicable. `GET /library/overview` is owner-scoped and returns manual/PSN records from `Game` plus current Steam owned games when linked.

- [ ] Write backend tests for: no Steam account returns manual/PSN only; linked Steam returns each Steam title once with source `steam`; another user's records never appear; a Steam provider failure retains manual/PSN records and reports Steam availability separately.
- [ ] Run `rtk pytest tests/test_library_api.py -q`; observe the endpoint is missing.
- [ ] Add `LibraryGameRead` and `LibraryOverviewRead` schemas. Implement `/library/overview` by loading `list_games(db, current_user.id)` and conditionally calling `fetch_owned_games(current_user.steam_id)`. Deduplicate by `(source, external_id)` and sort deterministically by normalized title. Keep Steam games live; do not reintroduce the removed legacy Steam `Game` imports.
- [ ] Add `getLibraryOverview()` and its TypeScript types in `web/src/lib/api.ts`. In `web/src/routes/library.tsx`, replace the current platform-as-page tabs with an accessible filter group:

```ts
type LibraryFilter = "all" | "playfinder" | "steam" | "psn";
const visibleGames = overview.games.filter((game) =>
  filter === "all" ? true : filter === "playfinder" ? game.source === "manual" : game.source === filter,
);
```

Make `all` the default. Preserve the Steam and PSN management panels below/behind a clear secondary action, rather than making them the default Library content.
- [ ] Add frontend tests asserting `All` is selected initially and contains mixed sources; each filter hides other sources; each empty filtered result has a source-specific empty state.
- [ ] Run the backend focused test plus `rtk npm --prefix web test -- --run src/test/live-data.routes.test.tsx`; commit `feat: show all library games with source filters`.

### Task 3: Resolve clickable Steam Library entries to game details

**Files:**
- Modify: `app/main.py`, `app/schemas.py`, `app/integrations/rawg.py` only if its exact-title helper needs export
- Modify: `web/src/lib/api.ts`, `web/src/routes/library.tsx`, `web/src/features/library/SteamLibraryPanel.tsx`, `web/src/routes/games.$gameId.tsx`
- Test: `tests/test_library_api.py`, `web/src/test/live-data.routes.test.tsx`, `web/src/test/catalog.routes.test.tsx`

**Interfaces:** `LibraryGameRead.detail_game_id` is either a catalog ID or `null`. Add an authenticated resolver `POST /library/steam-games/{appid}/resolve` that uses the Steam title and exact catalog lookup, creates/reuses the catalog mapping only when the match is exact, and returns `{ game_id }`.

- [ ] Write failing backend tests for exact Steam title resolution, idempotent repeated resolution, and no fuzzy match being attached to a different catalog title. Write a frontend test that clicks a Steam game and expects navigation to `/games/<catalog-id>`.
- [ ] Run the focused tests; observe that raw Steam rows are non-interactive and no resolver exists.
- [ ] Implement an owner-scoped resolver keyed by Steam app id. Reuse an existing catalog mapping when present; otherwise require a normalized exact title match before persisting the mapping. Return a 422 message for no exact match instead of silently navigating to an unrelated game.
- [ ] Replace the non-clickable `<div>` in `SteamLibraryPanel` with a button/link flow: use `detail_game_id` immediately, otherwise call the resolver, invalidate the Library overview query, and navigate on success. Render an inline error on 422/remote failure and leave the original row visible.
- [ ] Rerun focused tests; commit `feat: open Steam library games from Library`.

### Task 4: Initialize public nicknames for Google and Steam sign-in

**Files:**
- Modify: `app/crud.py`, `app/main.py`, `app/google_auth.py` if the display-name claim needs an explicit accessor
- Test: `tests/test_google_auth.py`, `tests/test_steam_auth.py`, `tests/test_social_api.py`

**Interfaces:** Add `build_public_nickname(db, preferred_name: str) -> str`. It normalizes to the existing `SocialProfileUpdate.nickname` contract (`[A-Za-z0-9_]`, 3–32 characters), uses `player` when empty, and appends `_<n>` until case-insensitively unique.

- [ ] Write tests proving: email/password signup still has `public_nickname is None`; first Google signup derives a valid unique nickname from the verified Google name claim; first Steam signup derives it from `persona_name`; existing linked accounts retain their manually selected nickname; duplicate names receive a suffix.
- [ ] Run `rtk pytest tests/test_google_auth.py tests/test_steam_auth.py tests/test_social_api.py -q`; observe the new social assertions fail.
- [ ] Implement `build_public_nickname` in `app/crud.py`. In the Google callback, pass the verified display-name claim only when creating a new user. In the Steam sign-in callback, pass the fetched `profile["persona_name"]` only for a newly created user. Store it in `public_nickname`; do not overwrite existing values during sign-in or linking.
- [ ] Rerun the focused tests; commit `fix: initialize social sign-in nicknames`.

### Task 5: Replace shared/stale recommendations with a Steam-eligible personal pipeline

**Files:**
- Modify: `app/steam_recommendations.py`, `app/steam_store.py`, `app/main.py`, `app/openai_client.py`
- Modify: `web/src/routes/index.tsx`, `web/src/lib/api.ts` only if the response adds availability metadata
- Test: `tests/test_steam_recommendations.py`, `tests/test_dashboard_api.py` (create/update), `web/src/test/live-data.routes.test.tsx`

**Interfaces:** `get_personalized_recommendations(user, saved_games, steam_games)` returns the current response shape plus `cache_expires_at`. Its cache fingerprint includes Steam app ids/playtime, normalized saved-library titles, `favorite_genres`, `platforms`, and `bio`.

- [ ] Write backend tests with mocked OpenAI, RAWG, Steam Store, and Redis for: different user inputs create different cache keys/prompts; changed Steam playtime, saved Library, or profile preferences misses the old cache; owned/saved titles are removed; PSN-only candidates are removed; provider failure returns a deterministic user-input-derived fallback rather than the global fallback list.
- [ ] Run `rtk pytest tests/test_steam_recommendations.py tests/test_dashboard_api.py -q`; observe failures against the current `steam_recommendations:v2:<user>:<steam-fingerprint>` key and global fallback.
- [ ] Add Steam availability validation: query the existing Steam Store candidate adapter and retain only candidates with a Steam app id/store URL. Extend candidate normalization to carry a Steam app id and exact catalog/RAWG enrichment only after validation. Exclude owned app ids, owned titles, and saved-library titles.
- [ ] Build the prompt from the exact user signals. When Steam exists, include ranked most-played titles first; when it does not, include saved titles and profile preferences. Change the fallback selector to rank Steam Store candidates by overlapping normalized genres/tags and a stable hash of the user fingerprint, so different inputs do not converge on the same fixed list.
- [ ] In `/dashboard`, always collect saved games and profile preferences; collect Steam games when linked; call the new service for both cases. Update `web/src/routes/index.tsx` to show a useful no-input CTA only when both Steam and Library/profile signals are absent, and retain a visible retry/error state.
- [ ] Add frontend regression coverage for ready, empty, and error recommendation blocks. Run focused suites; commit `fix: personalize Steam-eligible recommendations`.

### Task 6: Repair the mobile shell, game-detail spacing, and Deals cards

**Files:**
- Modify: `web/src/components/AppShell.tsx`, `web/src/routes/games.$gameId.tsx`, `web/src/routes/deals.tsx`
- Modify: relevant shared CSS/Tailwind configuration only if inspection shows a global overflow rule
- Test: `web/src/components/AppShell.test.tsx`, `web/src/test/catalog.routes.test.tsx`, `web/src/test/live-data.routes.test.tsx`

**Interfaces:** Mobile navigation is an explicit five-item list: `/`, `/library`, `/deals`, `/friends`, `/profile`. Deal cards use a vertical mobile layout and only switch to the compact grid treatment at `sm` or wider.

- [ ] Write failing shell tests asserting Friends is present in the mobile nav and excluded obsolete destinations are absent. Add Deals tests that assert the card uses a one-column mobile grid and a non-truncating title class. Add a game-detail render assertion that the primary detail container has no spacer/min-height class that exceeds content height.
- [ ] Run `rtk npm --prefix web test -- --run src/components/AppShell.test.tsx src/test/catalog.routes.test.tsx src/test/live-data.routes.test.tsx`; observe failures.
- [ ] Split `nav` into `desktopNav` and `mobileNav`. Keep existing desktop choices as product-approved, but render exactly `mobileNav` on phones:

```ts
const mobileNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/library", label: "Library", icon: Library },
  { to: "/deals", label: "Deals", icon: Tag },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
] as const;
```

- [ ] In `DealCard`, make the default card `flex flex-col` and its cover `h-auto w-full aspect-video`; move the current compact horizontal treatment behind `sm:flex-row` only where it remains useful. Use `line-clamp-2` rather than `truncate` for the title, and keep prices/actions in a `flex flex-wrap` content block with `min-w-0`. Change mobile grids from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`.
- [ ] Inspect the game-detail route and its shared wrappers at a 320px and 390px viewport. Remove only the class or empty conditional section creating the excess vertical space; retain intentional `pb-28` reserved for the fixed bottom navigation.
- [ ] Rerun focused tests and perform browser visual checks at 320px, 390px, and desktop width for `/deals`, `/games/<id>`, and each mobile navigation destination. Commit `fix: repair mobile navigation and deal cards`.

### Task 7: Integrate, verify, and release

**Files:**
- Modify only files required by failures discovered in this task
- Test: all backend and frontend suites

- [ ] Run backend tests:

```text
rtk pytest -q
```

- [ ] Run frontend tests and build:

```text
rtk npm --prefix web test -- --run
rtk npm --prefix web run build
rtk git diff --check
```

- [ ] Review `rtk git status --short` and the scoped diff. Stage only task files, create thematic commits if any task remains uncommitted, push `codex/<task>`, and open a draft PR to `main` listing all verification commands.
- [ ] After explicit user merge approval, mark the PR ready and merge. Wait for the `Deploy to Lightsail over SSH` workflow for the merged SHA, then run:

```text
rtk proxy curl.exe --fail --silent --show-error --max-time 15 https://playfinder.cc/api/health
```

Expected: `{"status":"ok"}`.
