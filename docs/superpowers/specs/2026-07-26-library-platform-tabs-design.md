# Library platform tabs design

## Goal

Consolidate the main Library, Steam library, and PSN library into one `/library` page. Remove Steam and PSN as standalone sidebar destinations while preserving old URLs through redirects.

## Navigation and URL state

- `/library` opens the main Library tab.
- `/library?tab=steam` opens the Steam tab.
- `/library?tab=psn` opens the PSN tab.
- The current sidebar retains Library but removes Steam and PSN entries.
- `/steam` redirects to `/library?tab=steam`; `/psn` redirects to `/library?tab=psn`.
- Unknown or missing `tab` values normalize to the main Library tab.

## Tab content

- **Library** keeps the existing game list, filters, and library actions unchanged.
- **Steam** reuses the existing Steam connection, sync, linked-account state, and game library content. It keeps the guest sign-in state and connected/unconnected states.
- **PSN** reuses the existing PSN import flow, preview/confirmation states, and recent PSN activity.
- Tabs use the project’s existing segmented-control visual language, matching the Deals genre selector rather than creating a second navigation style.

## Compatibility and errors

- Direct links and browser bookmarks to `/steam` and `/psn` must remain usable via client-side redirects.
- The Steam and PSN content keeps its existing loading, unauthenticated, empty, error, and retry behavior.
- No backend endpoint or payload change is required.

## Tests

- Verify each Library tab renders its intended content and updates from the query string.
- Verify `/steam` and `/psn` redirect to their corresponding Library tab.
- Verify sidebar navigation contains Library but no Steam or PSN destinations.
- Run targeted frontend tests, the complete frontend suite, production build, and `rtk git diff --check`.

## Project and GitHub constraints

- Read `AGENTS.md` and `C:\Users\zagir\.codex\RTK.md`; prefix terminal commands with `rtk`.
- Use constrained searches, bounded reads, and `apply_patch` for edits.
- Implement in a fresh `codex/<task>` branch and isolated worktree; preserve unrelated changes.
- Use TDD: focused failing test, minimal change, focused passing test.
- Before PR creation, run relevant tests, full affected suites, frontend build, and `rtk git diff --check`.
- Push a draft PR to `main`; do not merge or deploy until the user explicitly asks.
- After merging, wait for `Deploy to Lightsail over SSH` for the merged SHA and verify `https://playfinder.cc/api/health`. Do not consider production updated solely because a PR merged.
