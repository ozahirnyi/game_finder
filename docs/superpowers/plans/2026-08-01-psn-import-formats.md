# PSN Import Formats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support real PSN XLSX, CSV, and JSON exports in preview while removing production demo controls.

**Architecture:** A filename-aware parser dispatches into format readers and applies one shared title normalization/deduplication pipeline. The preview route forwards the upload name; confirm remains unchanged. The UI shows only a user-selected upload and the API-provided error.

**Tech Stack:** FastAPI, Python stdlib CSV/JSON, openpyxl, pytest, React, Vitest.

## Global Constraints

- Limit uploads to 10 MB and results to 500 games.
- Do not log upload content or reintroduce synthetic production data.
- Preserve the existing `/psn/import/confirm` contract.

---

### Task 1: Specify parser behavior with failing tests

**Files:**
- Modify: `tests/test_psn_export.py`
- Modify: `tests/integration/backend/test_profile_dashboard_psn_api.py`

**Interfaces:**
- Consumes: `parse_psn_export(content: bytes, filename: str)`.
- Produces: coverage for format dispatch and preview API behavior.

- [x] **Step 1: Add parser tests**

```python
assert parse_psn_export(b"Game Title\nHades\n hades \nCeleste\n", "library.csv") == ["Hades", "Celeste"]
assert parse_psn_export(b'[{"title":"Returnal"},{"game name":"Hades"}]', "library.json") == ["Returnal", "Hades"]
with pytest.raises(HTTPException, match="valid JSON"):
    parse_psn_export(b"{", "library.json")
with pytest.raises(HTTPException, match="supported PSN export"):
    parse_psn_export(b"game", "library.txt")
```

- [x] **Step 2: Run the new parser tests (RED)**

Run: `rtk pytest -q tests/test_psn_export.py`

Expected: failure because `parse_psn_export` has no filename argument and no CSV/JSON reader.

- [x] **Step 3: Add preview API tests for CSV and JSON**

```python
response = api_client.post("/psn/import/preview", files={"file": ("export.csv", b"Game Name\nHades\n", "text/csv")})
assert response.status_code == 200
assert response.json()["games"] == ["Hades"]
```

- [x] **Step 4: Run the targeted API tests (RED)**

Run: `rtk pytest -q tests/integration/backend/test_profile_dashboard_psn_api.py -k psn_import_preview`

Expected: CSV/JSON requests fail with the current XLSX-only validation.

### Task 2: Implement shared CSV/JSON/XLSX parsing and preview dispatch

**Files:**
- Modify: `app/psn_export.py`
- Modify: `app/main.py:580-594`
- Test: `tests/test_psn_export.py`
- Test: `tests/integration/backend/test_profile_dashboard_psn_api.py`

**Interfaces:**
- Consumes: `parse_psn_export(content: bytes, filename: str)`.
- Produces: `list[str]` or an HTTP 400/413/422 exception.

- [x] **Step 1: Implement the smallest parser dispatch**

```python
def parse_psn_export(content: bytes, filename: str) -> list[str]:
    _validate_content(content)
    suffix = Path(filename).suffix.casefold()
    rows = _parse_xlsx(content) if suffix == ".xlsx" else _parse_csv(content) if suffix == ".csv" else _parse_json(content) if suffix == ".json" else _unsupported_export()
    return _collect_titles(rows)
```

Use stdlib `csv` with `utf-8-sig`, `json.loads(content.decode("utf-8"))`, and the existing title/header rules. Keep `Transaction Detail` XLSX filtering intact. `_collect_titles` applies `normalize_title`, first-seen case-folded deduplication, and the 500-title cap.

- [x] **Step 2: Forward the filename from preview**

```python
filename = file.filename or ""
if Path(filename).suffix.casefold() not in {".xlsx", ".csv", ".json"}:
    raise HTTPException(status_code=400, detail="Upload a supported PSN export (.xlsx, .csv, or .json)")
games = parse_psn_export(await file.read(), filename)
```

- [x] **Step 3: Run parser and API tests (GREEN)**

Run: `rtk pytest -q tests/test_psn_export.py tests/integration/backend/test_profile_dashboard_psn_api.py -k "psn or external_id"`

Expected: all selected tests pass.

### Task 3: Remove PSN demo controls and prove the production path

**Files:**
- Modify: `web/src/routes/psn-import.tsx`
- Create: `web/src/routes/-psn-import.test.tsx`
- Test: `web/src/routes/-psn-import.test.tsx`

**Interfaces:**
- Consumes: `previewPsnImport(file: File)` and API errors.
- Produces: an upload-only route without sample/empty/error simulation controls.

- [x] **Step 1: Add a failing route test**

```tsx
expect(screen.getByText(/choose an export file/i)).toBeInTheDocument();
expect(screen.queryByText(/use sample export/i)).not.toBeInTheDocument();
expect(screen.queryByText(/preview empty state/i)).not.toBeInTheDocument();
expect(screen.queryByText(/preview error state/i)).not.toBeInTheDocument();
```

- [x] **Step 2: Run the route test (RED)**

Run: `rtk npm --prefix web test -- src/routes/-psn-import.test.tsx`

Expected: failure because the three demo controls are rendered.

- [x] **Step 3: Delete simulation state and controls**

Remove `emptyPreview`, `visibleRows`, the sample-file creation buttons, and the local error-state trigger. In `onError`, retain the server error message in `fileError`; render it with `InlineError` and allow retrying upload.

- [x] **Step 4: Run frontend test (GREEN)**

Run: `rtk npm --prefix web test -- src/routes/-psn-import.test.tsx`

Expected: pass.

### Task 4: Verify and commit the PSN package

**Files:**
- Modify: only files from Tasks 1–3.

- [x] **Step 1: Run focused backend and frontend suites**

Run: `rtk pytest -q tests/test_psn_export.py tests/integration/backend/test_profile_dashboard_psn_api.py` and `rtk npm --prefix web test -- src/components/PsnImportFlow.test.tsx src/routes/-psn-import.test.tsx`.

Expected: all tests pass.

- [x] **Step 2: Run type/build verification**

Run: `rtk npm --prefix web run build`.

Expected: successful production build.

- [x] **Step 3: Inspect task-only diff and commit**

Run: `rtk diff -- app/psn_export.py app/main.py tests/test_psn_export.py tests/integration/backend/test_profile_dashboard_psn_api.py web/src/routes/psn-import.tsx web/src/routes/-psn-import.test.tsx`.

Commit: `feat: support CSV and JSON PSN imports`.
