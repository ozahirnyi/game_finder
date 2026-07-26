# Library Platform Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Steam and PSN library functionality into `/library` tabs, remove both standalone sidebar destinations, and preserve `/steam` and `/psn` links through redirects.

**Architecture:** `/library` owns a validated `tab` query parameter and renders one of three content panels: the existing saved-games library, Steam, or PSN. Extract the existing Steam and PSN route bodies into reusable panels without `AppShell`; legacy routes redirect into the corresponding Library tab, preserving Steam callback state.

**Tech Stack:** React, TypeScript, TanStack Router, TanStack Query, Lucide React, Vitest, Testing Library, Tailwind CSS.

## Current repository and production state

- Repository: `https://github.com/ozahirnyi/game_finder`
- Workspace root: `C:\Users\zagir\PycharmProjects\game_finder`
- Production: `https://playfinder.cc`
- Current `origin/main` at handoff creation: `f1ed38f36af14e5c2732ef4b52aa43a67e939b97`
- Health endpoint: `https://playfinder.cc/api/health`

## Global constraints

- Read `AGENTS.md` and `C:\Users\zagir\.codex\RTK.md` before working; prefix every terminal command with `rtk`.
- Use constrained `rtk rg`, bounded reads, and `apply_patch` for source or documentation edits.
- Create a fresh `codex/<task>` branch and an isolated worktree. Preserve unrelated changes and never work directly on `main` or a `phase-*` branch.
- Use TDD: add a focused test, run it and observe the expected failure, write the minimal code, then rerun it successfully.
- Do not change backend endpoints or payloads for this task.
- `/library` means the saved-games list; `/library?tab=steam` and `/library?tab=psn` select their platform views. Invalid or missing `tab` values select the saved-games list.
- Remove Steam and PSN from both desktop and mobile `AppShell` navigation. Retain Library.
- Keep `/steam` and `/psn` functional by redirecting to Library tabs. `/steam?linked=1` and `/steam?error=<message>` must preserve that callback state on the Steam Library tab.
- Keep current Steam and PSN authentication, loading, empty, error, retry, import, and sync behavior.

## GitHub and deployment rules

- Before creating a PR, run focused tests, the full affected suite, `rtk npm --prefix web run build`, and `rtk git diff --check`.
- Push the feature branch and create a **draft PR** to `main`; do not merge or deploy until the user explicitly asks.
- When the user asks to merge, mark the PR ready, merge only after checks are clean, then wait for `Deploy to Lightsail over SSH` for the merged SHA.
- Do not claim production changed merely because the PR merged. Verify the workflow has conclusion `success` and call `https://playfinder.cc/api/health`.
- If GitHub Actions cannot deploy to Lightsail, investigate first; only then use `scripts/deploy/ssh_deploy.sh`, normalize CRLF on the copied remote script, and verify both the remote SHA and public health endpoint.
- Never force-push, reset hard, delete branches, or remove worktrees without explicit user instruction.

## Existing code map

- `web/src/routes/library.tsx`: saved-games Library route and current library list.
- `web/src/routes/steam.tsx`: Steam connection/sync/library UI, currently wrapped in `AppShell`.
- `web/src/routes/psn.tsx`: PSN Excel import UI, currently wrapped in `AppShell`.
- `web/src/components/AppShell.tsx`: desktop and mobile navigation source; Steam and PSN entries are in `nav`.
- `web/src/test/live-data.routes.test.tsx`: Library and Steam route data-state tests.
- `web/src/test/steam-friends.integration.test.tsx`: Steam router integration coverage.
- `web/src/features/integrations/lovable-profile-psn-routes.test.tsx` and `web/src/features/integrations/integrations.test.tsx`: PSN route/import coverage.
- `web/src/components/AppShell.test.tsx`: sidebar navigation coverage.

---

### Task 1: Extract reusable Steam and PSN content panels

**Files:**

- Create: `web/src/features/library/SteamLibraryPanel.tsx`
- Create: `web/src/features/library/PsnLibraryPanel.tsx`
- Modify: `web/src/routes/steam.tsx`
- Modify: `web/src/routes/psn.tsx`
- Test: `web/src/test/live-data.routes.test.tsx`
- Test: `web/src/features/integrations/lovable-profile-psn-routes.test.tsx`

**Consumes:** Existing API calls and state logic from `web/src/routes/steam.tsx` and `web/src/routes/psn.tsx`.

**Produces:** `SteamLibraryPanel({ linked, error }: { linked?: "1"; error?: string })` and `PsnLibraryPanel()` render route content without `AppShell` and can be embedded in Library.

- [ ] **Step 1: Write focused failing tests for reusable panels**

In `web/src/test/live-data.routes.test.tsx`, render `SteamLibraryPanel` with a connected dashboard fixture and assert `Steam library` and `Sync now` are visible. Render it with `{ linked: "1" }` plus an unlinked fixture and assert the connected status message is visible. In the PSN route test, import and render `PsnLibraryPanel` and assert `PlayStation library` and `Choose export` are visible.

```tsx
renderPage(<SteamLibraryPanel linked="1" />);
expect(await screen.findByText("Steam account connected. Your library is ready to sync.")).toBeVisible();

renderPage(<PsnLibraryPanel />);
expect(await screen.findByText("PlayStation library")).toBeVisible();
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```text
rtk npm --prefix web test -- --run src/test/live-data.routes.test.tsx src/features/integrations/lovable-profile-psn-routes.test.tsx
```

Expected: imports fail because the reusable panel modules do not exist.

- [ ] **Step 3: Extract the minimal panel components**

Move all query, mutation, callback-state, and rendering code from `SteamPage` into `SteamLibraryPanel`. Keep `AppShell` and `Route.useSearch()` outside the panel. Give the panel props:

```ts
export type SteamLibraryPanelProps = {
  linked?: "1";
  error?: string;
};
export function SteamLibraryPanel({ linked, error }: SteamLibraryPanelProps) { /* existing content */ }
```

Move PSN import state and rendering into `PsnLibraryPanel`, retaining the same `previewPsnImport`, `confirmPsnImport`, `getProfileSummary`, file input, and message behavior:

```ts
export function PsnLibraryPanel() { /* existing PsnPage content without AppShell */ }
```

Leave legacy route components temporarily rendering `<AppShell><SteamLibraryPanel ... /></AppShell>` and `<AppShell><PsnLibraryPanel /></AppShell>` so the moved behavior remains covered before redirects are introduced.

- [ ] **Step 4: Rerun focused tests and verify they pass**

Run the command from Step 2.

Expected: all selected Steam/PSN panel tests pass.

- [ ] **Step 5: Commit the extraction**

```text
rtk git add web/src/features/library/SteamLibraryPanel.tsx web/src/features/library/PsnLibraryPanel.tsx web/src/routes/steam.tsx web/src/routes/psn.tsx web/src/test/live-data.routes.test.tsx web/src/features/integrations/lovable-profile-psn-routes.test.tsx
rtk git commit -m "refactor: extract Steam and PSN library panels"
```

### Task 2: Add URL-backed Library platform tabs

**Files:**

- Modify: `web/src/routes/library.tsx`
- Modify: `web/src/test/library-wishlist.routes.test.tsx`
- Modify: `web/src/test/live-data.routes.test.tsx`

**Consumes:** `SteamLibraryPanel`, `PsnLibraryPanel`, current `LibraryPage`, and TanStack Router `validateSearch`.

**Produces:** `/library`, `/library?tab=steam`, and `/library?tab=psn` render the right panel with an accessible segmented tab control.

- [ ] **Step 1: Write failing tab-selection tests**

Mock `Route.useSearch` or render the route using the existing test router pattern. Assert all three labels exist, `Steam` renders `Steam integration`, `PSN` renders `PlayStation library`, and an unsupported tab renders the existing Library games view.

```tsx
expect(await screen.findByRole("tab", { name: "Steam" })).toHaveAttribute(
  "aria-selected",
  "true",
);
expect(screen.getByText("Steam integration")).toBeVisible();
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```text
rtk npm --prefix web test -- --run src/test/library-wishlist.routes.test.tsx src/test/live-data.routes.test.tsx
```

Expected: tab roles and platform content do not exist on Library.

- [ ] **Step 3: Implement validated tab state and the segmented control**

Add the exact search type and route validation in `web/src/routes/library.tsx`:

```ts
type LibraryTab = "library" | "steam" | "psn";
const libraryTabs: readonly LibraryTab[] = ["library", "steam", "psn"];

export const Route = createFileRoute("/library")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: libraryTabs.includes(search.tab as LibraryTab)
      ? (search.tab as LibraryTab)
      : "library",
    linked: search.linked === "1" ? "1" : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: LibraryPage,
});
```

Render a `role="tablist"` immediately below the Library header. Use router `Link` controls to preserve URL state, with `role="tab"`, `aria-selected`, and `to="/library"` plus `search` values. Render exactly one panel:

```tsx
{tab === "library" ? <SavedGamesLibrary /> : null}
{tab === "steam" ? <SteamLibraryPanel linked={linked} error={error} /> : null}
{tab === "psn" ? <PsnLibraryPanel /> : null}
```

Extract the existing saved-games query/list portion into a local `SavedGamesLibrary` component in the same file so it remains unchanged.

- [ ] **Step 4: Rerun focused tests and verify they pass**

Run the command from Step 2.

Expected: Library, Steam, PSN, and invalid-tab cases all pass.

- [ ] **Step 5: Commit the Library tab UI**

```text
rtk git add web/src/routes/library.tsx web/src/test/library-wishlist.routes.test.tsx web/src/test/live-data.routes.test.tsx
rtk git commit -m "feat: add Steam and PSN library tabs"
```

### Task 3: Redirect old platform URLs and remove sidebar entries

**Files:**

- Modify: `web/src/routes/steam.tsx`
- Modify: `web/src/routes/psn.tsx`
- Modify: `web/src/components/AppShell.tsx`
- Modify: `web/src/components/AppShell.test.tsx`
- Modify: `web/src/test/steam-friends.integration.test.tsx`
- Modify: `web/src/features/integrations/lovable-profile-psn-routes.test.tsx`

**Consumes:** TanStack Router `redirect`, Library query parameters, and the `nav` constant in `AppShell`.

**Produces:** old `/steam` and `/psn` URLs resolve to Library tabs, and no sidebar entry points directly to those routes.

- [ ] **Step 1: Write failing redirect and navigation tests**

Assert that `/steam?linked=1&error=example` redirects to `/library` with `{ tab: "steam", linked: "1", error: "example" }`, and `/psn` redirects with `{ tab: "psn" }`. In `AppShell.test.tsx`, assert Library exists while Steam and PSN links do not.

```tsx
expect(navigate).toHaveBeenCalledWith({
  to: "/library",
  search: { tab: "steam", linked: "1", error: "example" },
  replace: true,
});
expect(screen.queryByRole("link", { name: "Steam" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```text
rtk npm --prefix web test -- --run src/components/AppShell.test.tsx src/test/steam-friends.integration.test.tsx src/features/integrations/lovable-profile-psn-routes.test.tsx
```

Expected: the old route components render their own pages and sidebar links still exist.

- [ ] **Step 3: Implement redirect-only legacy routes and prune nav**

Replace route page components with redirect-only route guards. Import `redirect` and preserve callback query values for Steam:

```ts
export const Route = createFileRoute("/steam")({
  validateSearch: (search: Record<string, unknown>) => ({
    linked: search.linked === "1" ? "1" : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/library",
      search: { tab: "steam", ...search },
      replace: true,
    });
  },
});
```

Use an equivalent `beforeLoad` for `/psn` with `search: { tab: "psn" }`. Remove `Gamepad2`, `Trophy`, and both corresponding nav objects from `web/src/components/AppShell.tsx`; leave the Library object untouched. Update tests/mocks to expect redirects rather than a standalone `SteamPage` or `PsnPage`.

- [ ] **Step 4: Rerun focused tests and verify they pass**

Run the command from Step 2.

Expected: redirects preserve Steam callback state and neither desktop nor mobile navigation exposes Steam/PSN links.

- [ ] **Step 5: Commit redirects and navigation cleanup**

```text
rtk git add web/src/routes/steam.tsx web/src/routes/psn.tsx web/src/components/AppShell.tsx web/src/components/AppShell.test.tsx web/src/test/steam-friends.integration.test.tsx web/src/features/integrations/lovable-profile-psn-routes.test.tsx
rtk git commit -m "fix: consolidate platform libraries under Library"
```

### Task 4: Full verification and release preparation

**Files:**

- Verify: all modified files from Tasks 1–3.

- [ ] **Step 1: Run the complete frontend suite**

```text
rtk npm --prefix web test -- --run
```

Expected: all Vitest files pass with no failures.

- [ ] **Step 2: Build the production frontend**

```text
rtk npm --prefix web run build
```

Expected: Vite and Nitro builds complete with exit code 0.

- [ ] **Step 3: Inspect the final patch**

```text
rtk git diff --check origin/main...HEAD
rtk git diff --stat origin/main...HEAD
rtk git status --short
```

Expected: no whitespace errors and only intentional source/test changes.

- [ ] **Step 4: Push and open a draft PR**

```text
rtk git push -u origin codex/library-platform-tabs
```

Create a draft PR targeting `main`. Include the full test/build results in its body. Preserve the worktree for review feedback.

## Acceptance checklist

- `/library`, `/library?tab=steam`, and `/library?tab=psn` select the correct content.
- Steam and PSN are absent from sidebar and mobile navigation; Library remains.
- `/steam` and `/psn` bookmarks work through redirects, including Steam `linked` and `error` callback values.
- Existing Steam sign-in, connection, sync, and library states remain usable from Library.
- Existing PSN import, preview, confirmation, and error states remain usable from Library.
- Focused tests, complete frontend tests, build, patch check, PR checks, deploy workflow, and production health verification all pass.
