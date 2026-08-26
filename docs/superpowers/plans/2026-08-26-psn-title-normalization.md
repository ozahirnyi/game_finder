# PSN Title Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirm more real PSN purchases against IGDB while preserving automatic-import safety.

**Architecture:** Keep the existing product exclusions and exact catalog search. Add a single title-key helper that removes trademark/punctuation noise and recognized edition/platform suffixes; confirm a candidate only when one returned game has the same key.

**Tech Stack:** FastAPI, pytest, existing IGDB integration.

## Global Constraints

- Do not use substring or fuzzy matching.
- Do not auto-import a zero-match or multi-match candidate.
- Preserve existing product-name exclusions and confirmation payload contract.

---

### Task 1: Add safe base-title catalog matching

**Files:**
- Modify: `app/main.py`
- Modify: `tests/integration/backend/test_profile_dashboard_psn_api.py`

**Interfaces:**
- Produces: `_psn_catalog_match_key(value: str) -> str`.
- Consumes: IGDB search result dictionaries with `id` and `name`.
- Produces: `PsnImportPreviewItem(status="confirmed")` only for one matching result.

- [ ] **Step 1: Write the failing API tests**

```python
def test_psn_preview_matches_edition_and_platform_suffixes(...):
    monkeypatch.setattr(
        app_main,
        "fetch_igdb_games",
        AsyncMock(return_value={"results": [{"id": 101, "name": "Horizon Zero Dawn"}]}),
    )
    response = api_client.post("/psn/import/preview", files={"file": _xlsx_with_game("Horizon Zero Dawn™ Complete Edition PS4 & PS5")})

    assert response.json()["items"][0] == {
        "source_title": "Horizon Zero Dawn™ Complete Edition PS4 & PS5",
        "status": "confirmed",
        "igdb_id": 101,
        "title": "Horizon Zero Dawn",
    }
```

Add a separate test with two returned base-title matches and assert the preview item remains `review`.

- [ ] **Step 2: Run RED**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py -q`

Expected: FAIL because suffixes remain part of the current title key.

- [ ] **Step 3: Implement minimal normalization**

```python
PSN_TITLE_SUFFIX_RE = re.compile(
    r"\s*(?:[-–—:]\s*)?(?:complete|deluxe|ultimate|game of the year) edition|\s*(?:ps4\s*(?:&|and)\s*ps5|ps[45])$",
    re.IGNORECASE,
)

def _psn_catalog_match_key(value: str) -> str:
    cleaned = unicodedata.normalize("NFKC", value).replace("™", "").replace("®", "").replace("©", "")
    cleaned = PSN_TITLE_SUFFIX_RE.sub("", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip().casefold()
```

Use this helper on both the PSN candidate and every catalog result; retain the existing `len(matches) == 1` requirement.

- [ ] **Step 4: Run GREEN**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add app/main.py tests/integration/backend/test_profile_dashboard_psn_api.py
git commit -m "fix: normalize PSN catalog titles"
```

### Task 2: Verify regressions

**Files:**
- Verify only.

- [ ] **Step 1: Run backend suite**

Run: `rtk pytest -q`

Expected: PASS.

- [ ] **Step 2: Run frontend suite**

Run: `rtk npm --prefix web test`

Expected: PASS.

- [ ] **Step 3: Inspect scope**

Run: `rtk git diff --stat origin/main...HEAD`

Expected: only matcher tests, implementation, and this design/plan documentation.

