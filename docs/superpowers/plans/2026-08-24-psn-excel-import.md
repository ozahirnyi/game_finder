# PSN Excel Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the decorative PSN route with an XLSX import flow that persists game purchases and activity supplied by PlayStation.

**Architecture:** `app.psn_export` recognises game-bearing sheets and returns a de-duplicated list of titles. The existing FastAPI preview/confirm API contracts remain unchanged. A focused React import panel is rendered by the TanStack `/psn` route and uses those helpers for preview and confirmation.

**Tech Stack:** FastAPI, openpyxl, pytest, React 19, TanStack Router, Vitest, Testing Library.

## Global Constraints

- Accept only `.xlsx` files, with the existing 10 MB limit and 500-title cap.
- Import only actual game entries: `Transaction Detail` rows where `Content Type` equals `Game`; activity/VR rows with a recognised title field.
- Do not claim PSN library synchronisation, trophies, friends, PS Plus, or disc ownership.
- A valid workbook without game rows must return a 422 explanation that it contains no game activity or purchases.

---

### Task 1: Parse game-bearing PSN worksheets

**Files:**
- Modify: `tests/test_psn_export.py`
- Modify: `app/psn_export.py`

**Interfaces:**
- Consumes: `parse_psn_export(content: bytes) -> list[str]`.
- Produces: the same interface with transaction filtering and activity/VR sheet recognition.

- [ ] **Step 1: Write failing parser tests**

```python
def test_parse_psn_export_imports_only_game_transactions():
    content = make_export(
        [
            ("Transaction Date", "Game Name", "Content Type"),
            ("2026-01-01", "Returnal", "Game"),
            ("2026-01-01", "Returnal: Ascension", "DLC"),
        ],
        sheet_name="Transaction Detail",
    )
    assert parse_psn_export(content) == ["Returnal"]


def test_parse_psn_export_reads_online_and_vr_activity_titles():
    content = make_export(
        [("Game Title",), ("Astro Bot",)], sheet_name="Gameplay Online"
    )
    assert parse_psn_export(content) == ["Astro Bot"]


def test_parse_psn_export_explains_valid_export_without_game_records():
    content = make_export(
        [("If data is found the below table shows Gameplay Online Details.",)],
        sheet_name="Gameplay Online",
    )
    with pytest.raises(HTTPException, match="contains no game activity or game purchases"):
        parse_psn_export(content)
```

- [ ] **Step 2: Run the parser tests and verify RED**

Run: `rtk pytest -q tests\\test_psn_export.py`

Expected: the transaction and empty-export assertions fail because the current parser treats DLC as a game and uses a generic error message.

- [ ] **Step 3: Implement minimal worksheet classification**

```python
def _transaction_detail_columns(rows, sheet_name):
    if sheet_name.casefold().strip('"') != "transaction detail":
        return None
    for row_index, row in enumerate(rows):
        headers = [_normalized_header(value) for value in row]
        if "game name" in headers and "content type" in headers:
            return row_index, headers.index("game name"), headers.index("content type")
    return None


def _no_game_data_error() -> HTTPException:
    return HTTPException(
        status_code=422,
        detail="This PSN export was read successfully, but it contains no game activity or game purchases to import.",
    )
```

Use the transaction-column result before generic candidates and only add the `game name` value where normalised content type equals `game`. Strip surrounding quote characters from sheet names before matching. Expand game-context markers to include `online` and `vr`, while retaining the existing title-header allowlist and de-duplication.

- [ ] **Step 4: Run the parser tests and verify GREEN**

Run: `rtk pytest -q tests\\test_psn_export.py`

Expected: all parser tests pass.

- [ ] **Step 5: Commit parser work**

```text
git add app/psn_export.py tests/test_psn_export.py
git commit -m "fix: parse PSN game activity exports"
```

### Task 2: Render a truthful, functional PSN import route

**Files:**
- Create: `web/src/features/integrations/PsnImportPanel.tsx`
- Create: `web/src/features/integrations/PsnImportPanel.test.tsx`
- Modify: `web/src/routes/psn.tsx`

**Interfaces:**
- Consumes: `previewPsnImport(file: File): Promise<PsnImportPreview>` and `confirmPsnImport(games: string[]): Promise<PsnImportResult>` from `web/src/lib/api.ts`.
- Produces: `PsnImportPanel`, rendered by the `/psn` route.

- [ ] **Step 1: Write failing UI tests**

```tsx
it("previews an XLSX upload and confirms selected games", async () => {
  api.previewPsnImport.mockResolvedValue({ games: ["Bloodborne", "Returnal"], total: 2, message: null });
  api.confirmPsnImport.mockResolvedValue({ created: 1, updated: 0, skipped: 1, total: 2 });
  render(<PsnImportPanel />);
  fireEvent.change(screen.getByLabelText("Choose PSN Excel export"), { target: { files: [new File(["sheet"], "psn.xlsx")] } });
  expect(await screen.findByText("Bloodborne")).toBeVisible();
  fireEvent.click(screen.getByLabelText("Returnal"));
  fireEvent.click(screen.getByRole("button", { name: "Import 1 game" }));
  await waitFor(() => expect(api.confirmPsnImport).toHaveBeenCalledWith(["Bloodborne"]));
  expect(screen.getByText("1 added, 0 updated, 1 already in your library.")).toBeVisible();
});

it("shows the no-game-data response without calling confirm", async () => {
  api.previewPsnImport.mockRejectedValue(new Error("This PSN export was read successfully, but it contains no game activity or game purchases to import."));
  render(<PsnImportPanel />);
  fireEvent.change(screen.getByLabelText("Choose PSN Excel export"), { target: { files: [new File(["sheet"], "psn.xlsx")] } });
  expect(await screen.findByText(/contains no game activity or game purchases/i)).toBeVisible();
  expect(api.confirmPsnImport).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `rtk npm --prefix web test -- --run src/features/integrations/PsnImportPanel.test.tsx`

Expected: FAIL because `PsnImportPanel` does not exist.

- [ ] **Step 3: Implement the panel and mount it at `/psn`**

```tsx
export function PsnImportPanel() {
  const [preview, setPreview] = useState<PsnImportPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function previewFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const next = await previewPsnImport(file);
      setPreview(next);
      setSelected(next.games);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read the PSN export.");
    } finally {
      setBusy(false);
    }
  }

  async function importSelected() {
    if (!selected.length) return;
    setBusy(true);
    try {
      await confirmPsnImport(selected);
    } finally {
      setBusy(false);
    }
  }
}
```

Render a prominent limitation notice before the file input. Replace all fabricated account data, sync controls, trophy/friend/PS Plus claims, and activity cards in `web/src/routes/psn.tsx` with an `AppShell`, an import-focused heading, and `PsnImportPanel`.

- [ ] **Step 4: Run UI tests and build verification**

Run: `rtk npm --prefix web test -- --run src/features/integrations/PsnImportPanel.test.tsx`

Expected: PASS.

Run: `rtk npm --prefix web run build`

Expected: exit code 0.

- [ ] **Step 5: Commit UI work**

```text
git add web/src/features/integrations/PsnImportPanel.tsx web/src/features/integrations/PsnImportPanel.test.tsx web/src/routes/psn.tsx
git commit -m "fix: restore PSN Excel import route"
```

### Task 3: Run regression checks

**Files:**
- Verify only: `tests/test_psn_export.py`, `web/src/features/integrations/PsnImportPanel.test.tsx`

- [ ] **Step 1: Run backend regression checks**

Run: `rtk pytest -q tests\\test_psn_export.py`

Expected: all tests pass.

- [ ] **Step 2: Run frontend regression checks**

Run: `rtk npm --prefix web test -- --run src/features/integrations/PsnImportPanel.test.tsx src/features/integrations/integrations.test.tsx`

Expected: all selected test files pass.

- [ ] **Step 3: Inspect the scoped diff**

Run: `rtk diff -- app/psn_export.py tests/test_psn_export.py web/src/routes/psn.tsx web/src/features/integrations/PsnImportPanel.tsx web/src/features/integrations/PsnImportPanel.test.tsx`

Expected: only the parser, route, panel, and tests changed.
