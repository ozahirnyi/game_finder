# PSN Transaction Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import only catalog-confirmed games from PSN transaction exports and let the user review uncertain titles before import.

**Architecture:** The parser extracts transaction candidates. The preview endpoint resolves each candidate against IGDB through a normalized exact-title match and returns confirmed or review items. Confirmation accepts only IGDB ids and persists canonical titles fetched server-side.

**Tech Stack:** FastAPI, Pydantic, openpyxl, existing IGDB integration, React, TanStack Query, Vitest, pytest.

## Global Constraints

- Treat `Content Type` as a descriptor, not a game classifier.
- Never auto-import subscriptions, DLC, demos, bundles, or unmatched titles.
- Auto-confirm only when exactly one IGDB result matches a normalized PSN name.
- Preserve the 500-game cap and owner-scoped idempotency.

---

### Task 1: Parse transaction candidates

**Files:**
- Modify: `app/psn_export.py`
- Modify: `tests/test_psn_export.py`

**Interfaces:**
- Produces: `PsnExportCandidate(title: str, product_name: str | None)`.
- Produces: `parse_psn_export_candidates(content: bytes, filename: str | None) -> list[PsnExportCandidate]`.

- [ ] **Step 1: Write the failing test**

```python
def test_reads_product_purchase_when_content_type_is_violence():
    content = make_export(
        [
            ("Store Transactions",), (), ("Transaction Detail",),
            ("Transaction Date", "Game Name", "Product Name", "Content Type", "Transaction Type"),
            ("2021-06-09", "GOD OF WAR", "God of War", "Violence", "Product Purchase"),
        ],
        sheet_name='"Transaction Detail"',
    )

    assert parse_psn_export_candidates(content) == [PsnExportCandidate("GOD OF WAR", "God of War")]
```

- [ ] **Step 2: Run RED**

Run: `rtk pytest tests/test_psn_export.py -q`

Expected: FAIL because the candidate parser does not exist.

- [ ] **Step 3: Implement candidate extraction**

```python
@dataclass(frozen=True)
class PsnExportCandidate:
    title: str
    product_name: str | None

def parse_psn_export_candidates(content: bytes, filename: str | None = None) -> list[PsnExportCandidate]:
    # For Transaction Detail, read Game Name only from Product Purchase rows.
    # Ignore Content Type and deduplicate normalized titles.
```

Keep `parse_psn_export` as the compatibility wrapper returning candidate titles for existing CSV and JSON callers.

- [ ] **Step 4: Run GREEN**

Run: `rtk pytest tests/test_psn_export.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add app/psn_export.py tests/test_psn_export.py
git commit -m "fix: read PSN transaction purchases"
```

### Task 2: Resolve preview candidates safely

**Files:**
- Modify: `app/main.py`
- Modify: `app/schemas.py`
- Modify: `tests/integration/backend/test_profile_dashboard_psn_api.py`

**Interfaces:**
- Consumes: candidates from Task 1 and `fetch_igdb_games(query, page=1)`.
- Produces: `PsnImportPreview.items: list[PsnImportPreviewItem]`.
- Consumes: `PsnImportConfirmRequest.game_ids: list[int]`.

- [ ] **Step 1: Write the failing API test**

```python
def test_preview_confirms_exact_catalog_game_and_keeps_subscription_in_review(...):
    monkeypatch.setattr(app_main, "fetch_igdb_games", fake_catalog)
    response = api_client.post("/psn/import/preview", files={"file": real_transaction_export})

    assert response.json()["items"] == [
        {"source_title": "GOD OF WAR", "status": "confirmed", "igdb_id": 101, "title": "God of War"},
        {"source_title": "EA Play", "status": "review", "igdb_id": None, "title": None},
    ]
```

Add a separate test that an unknown submitted IGDB id returns 422 and creates no game row.

- [ ] **Step 2: Run RED**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py -q`

Expected: FAIL because the API returns title strings and accepts title strings at confirmation.

- [ ] **Step 3: Implement typed preview and server-side confirmation**

```python
class PsnImportPreviewItem(BaseModel):
    source_title: str
    status: Literal["confirmed", "review"]
    igdb_id: int | None = None
    title: str | None = None

class PsnImportConfirmRequest(BaseModel):
    game_ids: list[int] = Field(min_length=1, max_length=500)
```

Reject automatic confirmation when `product_name` contains `demo`, `season pass`, `subscription`, `plus`, `ea play`, `currency`, `points`, or `bundle`. Otherwise search IGDB and confirm only one exact normalized result. During confirmation fetch each selected id with `fetch_igdb_game_detail`; reject absent ids, store the canonical title, and use `psn:{igdb_id}` as external id.

- [ ] **Step 4: Run GREEN**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add app/main.py app/schemas.py tests/integration/backend/test_profile_dashboard_psn_api.py
git commit -m "feat: review PSN transaction matches"
```

### Task 3: Show confirmed and review items in the web flow

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/components/PsnImportFlow.tsx`
- Modify: `web/src/components/PsnImportFlow.test.tsx`

**Interfaces:**
- Consumes: `items` from Task 2.
- Produces: a confirm payload `{ game_ids: number[] }` containing selected confirmed items only.

- [ ] **Step 1: Write the failing UI test**

```tsx
it("selects confirmed games and leaves review items out of the import", async () => {
  mockPreviewPsnImport.mockResolvedValue({
    items: [
      { source_title: "God of War", status: "confirmed", igdb_id: 101, title: "God of War" },
      { source_title: "EA Play", status: "review", igdb_id: null, title: null },
    ],
  })

  // Upload .xlsx, assert the confirmed item is checked, the review item is
  // labelled as not imported, and confirm submits { game_ids: [101] }.
})
```

- [ ] **Step 2: Run RED**

Run: `rtk npm --prefix web test -- PsnImportFlow.test.tsx`

Expected: FAIL because the flow uses `games: string[]`, does not accept `.xlsx`, and submits titles.

- [ ] **Step 3: Implement the review UI**

```tsx
const [items, setItems] = useState<PsnImportPreviewItem[] | null>(null)
const selectedIds = items?.flatMap((item) =>
  item.status === "confirmed" && item.igdb_id ? [item.igdb_id] : [],
) ?? []

<input type="file" accept=".xlsx,.csv,.json" />
```

Render confirmed entries as selected checkboxes. Render review items in a muted `Needs review — not imported` list. Submit `{ game_ids: selectedIds }` and display backend error detail.

- [ ] **Step 4: Run GREEN**

Run: `rtk npm --prefix web test -- PsnImportFlow.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add web/src/lib/api.ts web/src/components/PsnImportFlow.tsx web/src/components/PsnImportFlow.test.tsx
git commit -m "feat: preview safe PSN import matches"
```

### Task 4: Verify the complete change

**Files:**
- Verify only.

- [ ] **Step 1: Run backend regressions**

Run: `rtk pytest -q`

Expected: PASS.

- [ ] **Step 2: Run frontend regressions**

Run: `rtk npm --prefix web test`

Expected: PASS.

- [ ] **Step 3: Review scope**

Run: `rtk diff --stat origin/main...HEAD`

Expected: only PSN parser/API/schema/UI/tests and this design/plan change.

