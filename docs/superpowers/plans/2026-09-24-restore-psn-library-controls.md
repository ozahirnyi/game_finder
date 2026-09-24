# Restore PSN Library Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the confirmed PSN-library deletion action on the PlayStation tab and make Library header totals represent the complete user library.

**Architecture:** Keep `libraryQuery` responsible only for filtered, paginated cards. Add an independent `getLibraryOverview` query for the three aggregate totals and a page-local deletion mutation that reuses `deletePsnLibrary`, its confirmation dialog, and query invalidation. No backend contract changes are needed.

**Tech Stack:** React, TypeScript, TanStack Query, TanStack Router, Vitest, React Testing Library.

## Global Constraints

- Work only in `C:\Users\zagir\.codex\worktrees\restore-psn-library-controls\origin-main-guard` on `codex/restore-psn-library-controls`.
- Do not alter the source worktree or its `app/worker.py`, `tests/test_background_jobs.py`, or PSN enrichment plan.
- Delete only authenticated-user PSN entries through the existing `DELETE /psn/library` client function.
- Header totals must not vary with search text, tab, sort, or loaded-page count.

---

### Task 1: Protect aggregate totals with a route test

**Files:**
- Modify: `web/src/routes/-library.test.tsx`
- Modify: `web/src/routes/library.tsx`

**Interfaces:**
- Consumes: `getLibraryOverview(): Promise<LibraryOverview>` and `getLibraryOverviewPage(options): Promise<LibraryOverview>` from `@/lib/api`.
- Produces: Library header counts based on `overview.games`, while card rendering remains based on `libraryQuery` pages.

- [ ] **Step 1: Write the failing test**

Add this test after the loading-state test, with a complete overview that differs from its paginated first page:

```tsx
it("shows aggregate counts rather than the first loaded page", async () => {
  api.getLibraryOverview.mockResolvedValue({
    games: [
      { id: "steam-1", source: "steam", title: "Steam One" },
      { id: "steam-2", source: "steam", title: "Steam Two" },
      { id: "psn-1", source: "psn", title: "PSN One" },
    ],
    steam_available: true, raw_count: 0, quarantined_count: 0, pending_catalog_count: 0,
  });
  api.getLibraryOverviewPage.mockResolvedValue({
    games: [{ id: "steam-1", source: "steam", title: "Steam One" }],
    total: 3, has_more: true, steam_available: true,
    raw_count: 0, quarantined_count: 0, pending_catalog_count: 0,
  });
  renderLibrary();
  expect(await screen.findByText("Games")).toBeInTheDocument();
  expect(screen.getByText("Games").parentElement).toHaveTextContent("3");
  expect(screen.getByText("Steam").parentElement).toHaveTextContent("2");
  expect(screen.getByText("PlayStation").parentElement).toHaveTextContent("1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web; npm.cmd test -- src/routes/-library.test.tsx`

Expected: FAIL because `LibraryPage` currently derives the header values from `owned`, which contains only loaded page cards.

- [ ] **Step 3: Write minimal implementation**

In `LibraryPage`, import `useQuery` and `getLibraryOverview`; add:

```tsx
const overviewQuery = useQuery({ queryKey: ["library"], queryFn: getLibraryOverview });
const totals = overviewQuery.data?.games ?? [];
```

Change the three header count expressions from `owned` filters to `totals` filters. Keep `owned`, `visible`, infinite scroll, and the paginated query unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web; npm.cmd test -- src/routes/-library.test.tsx`

Expected: PASS, including the new aggregate-count test.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/routes/library.tsx web/src/routes/-library.test.tsx
rtk git commit -m "fix: show complete library totals"
```

### Task 2: Restore deletion control to the PlayStation tab

**Files:**
- Modify: `web/src/routes/-library.test.tsx`
- Modify: `web/src/routes/library.tsx`

**Interfaces:**
- Consumes: `deletePsnLibrary(): Promise<{ deleted: number }>` from `@/lib/api` and browser `window.confirm`.
- Produces: a PlayStation-tab-only destructive action that invalidates `["library"]`, `["library-overview-page"]`, and `["psn-library-repair"]` after success.

- [ ] **Step 1: Write the failing test**

Extend the hoisted API mock with `deletePsnLibrary`. Add a test that renders the page, changes to `PlayStation`, confirms deletion, and asserts `deletePsnLibrary` was called; also assert the button is absent before tab selection:

```tsx
it("offers PSN deletion only on the PlayStation tab", async () => {
  api.deletePsnLibrary.mockResolvedValue({ deleted: 2 });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  renderLibrary();
  await screen.findByText("Library");
  expect(screen.queryByRole("button", { name: "Delete all PlayStation games" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "PlayStation" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete all PlayStation games" }));
  await waitFor(() => expect(api.deletePsnLibrary).toHaveBeenCalledOnce());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web; npm.cmd test -- src/routes/-library.test.tsx`

Expected: FAIL because `LibraryPage` does not import, render, or call `deletePsnLibrary`.

- [ ] **Step 3: Write minimal implementation**

Import `deletePsnLibrary`, add a `useMutation` named `removePsnLibrary`, and in its success handler invalidate the three stated keys. In the tab/filter row, conditionally render this button when `tab === "PlayStation"`:

```tsx
<button
  type="button"
  disabled={removePsnLibrary.isPending}
  onClick={() => {
    if (window.confirm("Delete every PlayStation entry from your library? This cannot be undone.")) {
      removePsnLibrary.mutate();
    }
  }}
  className="rounded-full border border-red-500 px-3 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50"
>
  {removePsnLibrary.isPending ? "Deleting PlayStation games…" : "Delete all PlayStation games"}
</button>
```

Add a concise success/error status message adjacent to the button, using `role="status"`, so the user receives feedback without navigating away.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web; npm.cmd test -- src/routes/-library.test.tsx`

Expected: PASS, including the tab-gating and mutation-call test.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/routes/library.tsx web/src/routes/-library.test.tsx
rtk git commit -m "fix: restore PSN library deletion control"
```

### Task 3: Verify the frontend change

**Files:**
- Verify: `web/src/routes/-library.test.tsx`

**Interfaces:**
- Consumes: the completed Library route behavior from Tasks 1 and 2.
- Produces: evidence that the targeted test suite and production build accept the change.

- [ ] **Step 1: Run the focused test suite**

Run: `cd web; npm.cmd test -- src/routes/-library.test.tsx`

Expected: PASS with zero failed tests.

- [ ] **Step 2: Run the frontend build**

Run: `cd web; npm.cmd run build`

Expected: successful Vite build with no TypeScript errors.

- [ ] **Step 3: Inspect the final change set**

Run: `rtk git status --short` and `rtk git diff origin/main --check`

Expected: only the implementation-plan document and intended Library route/test changes; no whitespace errors.
