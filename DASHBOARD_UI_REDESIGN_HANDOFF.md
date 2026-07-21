# Dashboard UI redesign — handoff for the next Codex session

Last updated: 2026-07-14 (Europe/Kiev)

## Read this first

- The user explicitly stopped all work and asked for this handoff. All subagents were interrupted.
- Do not delete, reset, clean, or overwrite any worktree listed below. Some useful work is uncommitted.
- Repository instructions import `C:\Users\zagir\.codex\RTK.md`. Every shell command must be prefixed with `rtk`.
- The original working branch is `phase-6`. The website redesign has **not** been merged into it.
- Continue implementation in the isolated worktrees, not in the original `phase-6` checkout.
- Use `apply_patch` for file edits.

## What the user asked for

The original request, in substance:

- Fix the design of the whole website, especially crooked/inconsistent buttons.
- Rework every tab, with special attention to Friends and Profile.
- Make the interface more conventional, coherent, and attractive without merely changing the theme.
- Search was the original main idea, but it must no longer overshadow all newer features.
- The user chose design option **C**: a balanced dashboard where Search, Deals, Library, Steam, and Friends have comparable importance.
- Make the site look correct on phone, tablet, laptop, and large desktop screens.
- Final navigation decision:
  - desktop: a narrow icon rail is visible by default; clicking opens a labelled overlay drawer;
  - tablet: no permanent rail, a compact top bar opens the same overlay drawer;
  - phone: restore the fixed bottom navigation with visible labels;
  - the drawer is not permanently expanded on desktop.
- The user repeatedly approved the direction and said to implement everything.
- The user asked to use separate subagents and later asked for remaining tasks to run in parallel.
- Last request: stop everything and create a file describing what was done, what remains, and the important conversation context so work can continue in a new session.

## Agreed design constraints

- Keep the established monochrome black/white/grey visual identity.
- Use a standard dashboard information hierarchy and consistent shared UI primitives.
- Do not change backend/API contracts as part of the visual redesign.
- Breakpoints:
  - mobile: 320–767 px;
  - tablet: 768–1023 px;
  - desktop: 1024 px and above.
- Desktop rail: 72 px. Overlay drawer: 320 px.
- Tablet top bar: 64 px.
- Mobile bottom navigation must include visible labels and safe-area padding.
- Interactive targets must be at least 44×44 px.
- Preserve keyboard/focus behavior, modal semantics, focus restoration, reduced motion, and responsive tab-order correctness.
- Preserve client-side authentication behavior and isolate protected state across logout, login, token replacement, and cross-tab auth events.
- Every data region must have explicit loading, error, empty, and success states.
- Friends is a separate master/detail-style screen. Profile is a settings/integrations screen.

## Design and implementation documents

- Design specification: `docs/superpowers/specs/2026-07-14-dashboard-ui-redesign-design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-14-dashboard-ui-redesign.md`
- Task briefs and reports: `.worktrees/dashboard-ui-redesign/.superpowers/sdd/`
- Progress ledger: `.worktrees/dashboard-ui-redesign/.superpowers/sdd/progress.md`

The design and plan are committed on `phase-6`:

- `0f936c2 docs: define dashboard UI redesign`
- `292c8e7 docs: plan dashboard UI redesign`

## Worktrees and exact current state

### 1. Main redesign worktree

- Path: `C:\Users\zagir\PycharmProjects\game_finder\.worktrees\dashboard-ui-redesign`
- Branch: `codex/dashboard-ui-redesign`
- Current committed HEAD: `3bc2c3b feat: redesign the game library`
- This worktree is intentionally dirty because Task 5 review fixes were interrupted.

Uncommitted files:

- `web/src/app/favorites/[id]/page.tsx`
- `web/src/features/library/LibraryScreen.client.tsx`
- `web/src/features/library/LibraryScreen.test.tsx`

Current uncommitted diff size: 227 insertions, 40 deletions. These changes were intended to fix the Library review findings below, but they were interrupted before verification or commit. Inspect and continue them; do not discard them.

### 2. Steam/Friends parallel worktree

- Path: `C:\Users\zagir\PycharmProjects\game_finder\.worktrees\steam-friends-parallel`
- Branch: `codex/steam-friends-parallel`
- HEAD: `3bc2c3b`
- Status at stop: clean. The agent had not created implementation files or commits yet.

### 3. Profile parallel worktree

- Path: `C:\Users\zagir\PycharmProjects\game_finder\.worktrees\profile-parallel`
- Branch: `codex/profile-parallel`
- HEAD: `3bc2c3b`
- Status at stop: one untracked partial test file:
  - `web/src/features/profile/ProfileScreen.test.tsx`
- Preserve and inspect this test before continuing Task 7.

### 4. Original checkout

- Path: `C:\Users\zagir\PycharmProjects\game_finder`
- Branch: `phase-6`
- It contains the committed design and plan but none of the implementation commits.
- This handoff file is the only newly created handoff artifact in the original checkout.

## Completed implementation

### Task 1 — test harness and shared UI primitives: complete and reviewed

Commits:

- `1d001f2 feat: add shared UI primitives`
- `07d17ab fix: preserve compact button touch targets`
- `cd7621e fix: enforce compact button minimum width`

Added the frontend test harness and shared Button/ButtonLink/IconButton, Panel, DataRow, loading/error/empty states, and related monochrome styles. Review passed with no remaining findings.

### Task 2 — responsive AppShell and navigation: complete and reviewed

Commits:

- `bfa2ffd feat: add responsive dashboard shell`
- `956d30a fix: isolate navigation drawer background`

Implemented the 72 px desktop icon rail, overlay drawer, tablet top bar, mobile labelled bottom navigation, safe areas, focus trap/restoration, inert background, Escape/scrim/route closing, auth-aware nav, reduced motion, and skip-link focus behavior. Review passed after fixing the 44 px mobile brand and fully inert background.

### Task 3 — Dashboard and dedicated Search route: complete and reviewed

Commits:

- `7225fc4 feat: add dashboard and dedicated search`
- `5e25c3a fix: address dashboard search review`
- `cfd05ba fix: refresh dashboard on auth identity changes`

The root route is now a balanced Dashboard. Search moved to `/search` without changing its APIs. URL-backed search, Retry, empty-submit cleanup, result races, save/auth messaging, independent dashboard regions, and authenticated A→B state isolation were covered and reviewed. Final Task 3 frontend verification was 43/43 tests plus lint, TypeScript, and production build.

### Task 4 — Deals, game detail, and authentication: complete and reviewed

Commits:

- `53d87b6 feat: redesign commerce and auth screens`
- `30f67e7 fix: harden commerce and auth state`
- `848e780 fix: preserve expired-session redirect`

Redesigned Deals, game details, login/register, and OAuth callback. Fixed StrictMode one-time OAuth exchange deduplication, dynamic game-ID state races, exact saved-game payload preservation, current discount display, invalid offer links, valid RAWG-ID selection, reactive token identity in Deals, and the real 401 token-removal/redirect order. Final Task 4 verification was 76/76 tests plus lint, TypeScript, and production build. Final review approved.

### Task 5 — Library workspace: initial implementation committed, review fixes unfinished

Committed implementation:

- `3bc2c3b feat: redesign the game library`

The initial implementation redesigned `/favorites` and `/favorites/[id]`, added Library feature components, filters/search/sort, shared state primitives, token-keyed protected data, accessible responsive rows, and a small `DataRow` type fix. Before review fixes, verification passed 89/89 frontend tests plus lint, TypeScript, and build.

The independent review found three Important issues:

1. Detail and delete state must be keyed by both stable token and `params.id`. A deferred A→B navigation must not render A, redirect because A's delete finishes, or show A's late error on B.
2. Catalogue artwork enrichment must be genuinely best-effort. Saved list/detail data must render immediately even when `searchGames` hangs; artwork should enrich later with token/ID guards.
3. One global `pending` mutation slot is unsafe for overlapping actions on different saved IDs. Track pending state per saved ID or disable all mutations globally, with an overlapping two-row regression test.

The interrupted uncommitted changes in the main redesign worktree were implementing these findings. No final GREEN/full verification or re-review has happened yet.

## Remaining tasks

### Finish Task 5 first

1. Inspect the dirty diff in `dashboard-ui-redesign`.
2. Complete the three Library review fixes above using strict RED/GREEN tests.
3. Run focused and full frontend verification.
4. Commit the fixes on `codex/dashboard-ui-redesign`.
5. Generate a review package and obtain a clean independent re-review before integration.

### Task 6 — Steam tabs and Friends

- Brief: `.worktrees/dashboard-ui-redesign/.superpowers/sdd/task-6-brief.md`
- Continue in `steam-friends-parallel`.
- No implementation was saved at stop; start from clean HEAD `3bc2c3b`.
- Implement with strict TDD, run the full frontend checks, commit, and independently review.
- After Task 5 is clean, integrate the Task 6 commit(s) into `codex/dashboard-ui-redesign` (normally with `git cherry-pick`). Resolve against the final Library HEAD, not by resetting either worktree.

### Task 7 — Profile settings and integrations

- Brief: `.worktrees/dashboard-ui-redesign/.superpowers/sdd/task-7-brief.md`
- Continue in `profile-parallel`.
- Inspect and preserve `web/src/features/profile/ProfileScreen.test.tsx`.
- Complete with strict TDD, run full frontend checks, commit, and independently review.
- Integrate the reviewed Task 7 commit(s) into `codex/dashboard-ui-redesign` after Task 5, resolving any shared-profile/Steam integration overlap carefully.

### Task 8 — CSS cleanup and complete verification

- Brief: `.worktrees/dashboard-ui-redesign/.superpowers/sdd/task-8-brief.md`
- This depends on Tasks 5–7 being integrated. Do it on `codex/dashboard-ui-redesign`, not in a branch based on the old `3bc2c3b` state.
- Remove obsolete CSS/components only after confirming nothing still imports them.
- Perform full automated and visual QA at mobile, tablet, desktop, and large desktop sizes.

## Recommended resume sequence

1. Read this handoff, the design spec, plan, and Task 5 report/review artifacts.
2. Check all worktrees without modifying them:
   - `rtk git worktree list`
   - `rtk git status --short` in each worktree.
3. Finish and re-review the dirty Task 5 fixes.
4. In parallel, resume Task 6 and Task 7 in their existing independent worktrees.
5. Cherry-pick reviewed Task 6 and Task 7 commits into `codex/dashboard-ui-redesign`.
6. Run integration tests and fix conflicts/regressions with tests first.
7. Execute Task 8 cleanup.
8. Use a final whole-branch code review, then run verification from fresh output.
9. Visually inspect the running site in the in-app browser across representative widths before claiming completion.
10. Only after everything passes, decide with the user whether to merge the redesign branch into `phase-6`.

## Verification commands for the final integrated branch

From `...\.worktrees\dashboard-ui-redesign\web`:

```powershell
rtk npm test
rtk npm run lint
rtk npx tsc --noEmit --incremental false
rtk npm run build
```

From `...\.worktrees\dashboard-ui-redesign`:

```powershell
rtk pytest -q
rtk git status --short
```

Do not report completion from old test output. Re-run all commands after the final integration/fix commit.

## Useful baseline and process notes

- Before implementation began, baseline checks passed: frontend lint/build and backend `pytest -q` (36 passed).
- Test-driven development and independent task review were used throughout.
- Review packages were generated with:
  - `C:\Users\zagir\.codex\skills\subagent-driven-development\scripts\review-package`
- The user asked for parallel subagents. Parallel implementation is safe only in independent worktrees; do not let agents edit the same worktree concurrently.
- The earlier request mentioned a weaker model such as “5.6 Luna”, but the available subagent interface did not expose model selection. Separate agents were used without a selectable model.

## Definition of done

The redesign is not done until:

- Tasks 5, 6, 7, and 8 are completed and independently reviewed;
- all parallel commits are integrated into `codex/dashboard-ui-redesign`;
- full frontend and backend checks pass on the integrated HEAD;
- responsive visual QA confirms the desktop icon rail/drawer, tablet overlay navigation, and labelled phone bottom navigation;
- all primary tabs, Friends, Profile, buttons, forms, loading/error/empty states, and keyboard interactions are visually and functionally consistent;
- the user is shown the finished site and chooses how to integrate it into `phase-6`.
