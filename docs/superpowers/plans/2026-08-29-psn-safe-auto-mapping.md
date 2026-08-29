# PSN Safe Auto-Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically link more PSN titles when the catalog result is uniquely exact after safe normalization.

**Architecture:** Keep IGDB batch search and the existing platform disambiguation. Extend `_psn_catalog_match_key` with provider-only suffix cleanup; do not introduce fuzzy scoring or bulk RAW imports.

**Tech Stack:** FastAPI, IGDB client mocks, pytest.

## Global Constraints

- A row is `matched` only when exactly one normalized catalog match remains.
- Ambiguous and missing results stay `needs_mapping`.
- External provider calls remain mocked in tests.

---

### Task 1: Safe title normalization

**Files:**
- Modify: `app/main.py:624-707`
- Test: `tests/integration/backend/test_profile_dashboard_psn_api.py`

- [ ] **Step 1: Write a failing preview test**

```python
def test_psn_preview_matches_provider_formatting_only(...):
    # PSN punctuation and platform/edition formatting map to one IGDB name.
    assert item["status"] == "matched"
```

- [ ] **Step 2: Run it to verify failure**

Run: `pytest -q tests/integration/backend/test_profile_dashboard_psn_api.py -k provider_formatting`
Expected: `needs_mapping` because the current key does not remove PSN-specific formatting.

- [ ] **Step 3: Implement the smallest normalization extension**

```python
PSN_TITLE_SUFFIX_RE = re.compile(...)
def _psn_catalog_match_key(value: str) -> str:
    # Remove only formatting/edition/platform suffixes then casefold whitespace.
```

- [ ] **Step 4: Run the focused regression**

Run: `pytest -q tests/integration/backend/test_profile_dashboard_psn_api.py -k provider_formatting`
Expected: `1 passed`.

- [ ] **Step 5: Commit**

Run: `git add app/main.py tests/integration/backend/test_profile_dashboard_psn_api.py && git commit -m "fix: improve PSN catalog normalization"`

### Task 2: Verify safety boundaries

**Files:**
- Test: `tests/integration/backend/test_profile_dashboard_psn_api.py`

- [ ] **Step 1: Add ambiguity assertion**

```python
assert ambiguous_item["status"] == "needs_mapping"
```

- [ ] **Step 2: Run focused PSN preview tests**

Run: `pytest -q tests/integration/backend/test_profile_dashboard_psn_api.py -k psn_import_preview`
Expected: all selected tests pass.

- [ ] **Step 3: Run production-relevant verification**

Run: `npm.cmd --prefix web test && pytest -q`
Expected: frontend and backend suites pass.
