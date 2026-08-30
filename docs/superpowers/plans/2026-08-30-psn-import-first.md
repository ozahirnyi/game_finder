# PSN Import-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import every plausible PlayStation title even when IGDB is unavailable, while leaving only affirmatively identified non-games unselected by default.

**Architecture:** Keep parsing/classification authoritative for import eligibility and treat catalog resolution as optional enrichment. Add an explicit backend recommendation (`catalog`, `raw`, or `skip`) so the React wizard never derives selectability from IGDB status; persist unmatched/unavailable selections through the existing raw PSN identity path and retain the existing repair/promotion flow.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, pytest, React, TypeScript, TanStack Query/Router, Vitest.

## Global Constraints

- Work from `origin/main` plus commit `2e4634b`; create `codex/psn-import-first-implementation` before modifying implementation files.
- Follow `AGENTS.md` and `C:\Users\zagir\.codex\RTK.md`; prefix every shell command with `rtk`, keep searches scoped, and use `apply_patch` for edits.
- Use TDD for every behavior change: write one focused failing test, run it and verify the expected failure, then write minimal production code.
- Catalog absence, ambiguity, timeout, malformed response, or provider error is never non-game evidence.
- No game-specific production allowlist or one-off exception.
- Suggested non-games are unselected but reversible; all other rows are selected by default.
- Catalog lookup is enrichment only and cannot block raw selection or confirmation.
- Preserve owner scoping, transactional confirmation, idempotency, raw-to-linked promotion, and duplicate merging.
- Never commit the supplied XLSX, its contents, credentials, generated build output, or unrelated changes.
- Keep provider logs aggregate-only: no token, transaction content, or complete title list.

---

### Task 1: Tighten affirmative non-game classification

**Files:**
- Modify: `app/psn_classification.py:128-150`
- Modify: `tests/test_psn_resolution.py:33-71`

**Interfaces:**
- Consumes: `normalize_psn_product_identity(value: str | None) -> str` and `PsnExportCandidate.transactions`.
- Produces: `is_explicit_non_game_self_title(title: str) -> bool` and unchanged `classify_psn_candidate(candidate) -> PsnClassification` outcomes: `eligible`, `needs_review`, or `suggested_skip`.

- [ ] **Step 1: Add failing classifier boundary tests**

Add parameterized cases showing that explicit standalone categories are skipped while marker-like normal names and mixed base-game evidence remain eligible:

```python
@pytest.mark.parametrize(
    "title",
    [
        "Example Game Demo",
        "Example Game Trial",
        "Example Game Season Pass",
        "Example Game Public Test Server",
        "Example Game Beta Client",
        "Example Game Soundtrack",
        "Example Game Virtual Currency",
        "Example Game PS4 Theme",
    ],
)
def test_classifier_skips_only_explicit_self_title_non_games(title):
    from app.psn_resolution import classify_psn_candidate

    assert classify_psn_candidate(PsnExportCandidate(title)).kind == "suggested_skip"


@pytest.mark.parametrize(
    "title",
    ["Adventure Theme Park", "Pack Your Bags", "Test Drive Adventure", "Avatar Frontier"],
)
def test_classifier_does_not_use_broad_non_game_substrings(title):
    from app.psn_resolution import classify_psn_candidate

    assert classify_psn_candidate(PsnExportCandidate(title)).kind == "eligible"
```

Keep the existing paired-transaction test proving that a base purchase plus demo/pack/voucher rows remains eligible.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
rtk pytest tests/test_psn_resolution.py -q
```

Expected: the newly added standalone demo/trial/season-pass/soundtrack/currency cases fail because the current suffix set does not classify them all.

- [ ] **Step 3: Implement anchored self-title markers**

Replace the narrow suffix set with explicit normalized suffixes only; do not add generic `pack`, `bundle`, or substring matching:

```python
SELF_TITLE_NON_GAME_CATEGORY_SUFFIXES = frozenset({
    "demo",
    "trial",
    "dlc",
    "downloadable content",
    "add on",
    "season pass",
    "public test server",
    "test client",
    "beta client",
    "playtest",
    "soundtrack",
    "subscription",
    "virtual currency",
    "wallet top up",
    "theme",
})


def is_explicit_non_game_self_title(title: str) -> bool:
    identity = normalize_psn_product_identity(title)
    return any(identity == suffix or identity.endswith(f" {suffix}") for suffix in SELF_TITLE_NON_GAME_CATEGORY_SUFFIXES)
```

Retain exact known app/service/storefront identity sets. Do not make associated product rows veto an eligible base title.

- [ ] **Step 4: Run the classifier suite and verify GREEN**

Run `rtk pytest tests/test_psn_resolution.py -q`.

Expected: all classifier and resolver tests pass.

- [ ] **Step 5: Commit the classifier boundary**

```powershell
rtk git add app/psn_classification.py tests/test_psn_resolution.py
rtk git commit -m "fix: classify only explicit PSN non-games"
```

---

### Task 2: Make backend import recommendations independent of catalog health

**Files:**
- Modify: `app/schemas.py:381-397`
- Modify: `app/main.py:680-718,827-845`
- Modify: `app/psn_resolution.py:58-89`
- Modify: `tests/integration/backend/test_profile_dashboard_psn_api.py`
- Modify: `tests/test_psn_resolution.py`

**Interfaces:**
- Produces: `PsnImportPreviewItem.recommended_action: Literal["catalog", "raw", "skip"]`.
- Contract: safe unique match → `catalog`; suggested non-game → `skip`; `needs_mapping`, `catalog_unavailable`, ambiguous, and no-match → `raw`.
- Keeps: `PsnImportSelection` and `/psn/import/confirm` wire format unchanged.

- [ ] **Step 1: Add a failing API contract test for total catalog outage**

Create 25 plausible CSV titles, mock `resolve_psn_catalog_titles` to return `CatalogResolution("unavailable", [])` for every title, and add this complete route regression:

```python
def test_psn_import_catalog_outage_keeps_every_plausible_title_importable_as_raw(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    from app.psn_resolution import CatalogResolution

    owner = auth_as(user_factory(email="psn-import-first-outage@example.com"))
    titles = [f"Owned game {index}" for index in range(25)]
    monkeypatch.setattr(
        app_main,
        "resolve_psn_catalog_titles",
        AsyncMock(return_value={title: CatalogResolution("unavailable", []) for title in titles}),
    )
    content = ("Game Name\n" + "\n".join(titles) + "\n").encode()

    response = api_client.post(
        "/psn/import/preview",
        files={"file": ("export.csv", content, "text/csv")},
    )

    items = response.json()["items"]
    assert len(items) == 25
    assert {item["status"] for item in items} == {"catalog_unavailable"}
    assert {item["recommended_action"] for item in items} == {"raw"}
    assert response.json()["confirmed_total"] == 25

    confirmed = api_client.post(
        "/psn/import/confirm",
        json={"selections": [
            {"candidate_token": item["candidate_token"], "action": "raw"}
            for item in items
        ]},
    )

    assert confirmed.status_code == 200
    assert confirmed.json()["total"] == 25
    stored = db_session.query(Game).filter_by(owner_id=owner.id, source="psn", link_state="raw").all()
    assert len(stored) == 25
```

This proves the old first-20 fallback budget no longer limits import eligibility.

Add/adjust the reversible-preview test to assert recommendations in order:

```python
assert [item["recommended_action"] for item in items] == ["catalog", "raw", "skip"]
```

- [ ] **Step 2: Run focused backend tests and verify RED**

Run:

```powershell
rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py -q -k "psn and (outage or reversible)"
```

Expected: response items do not contain `recommended_action`, and `confirmed_total` still counts only matches.

- [ ] **Step 3: Add the explicit recommendation field and populate every branch**

Add the required schema field:

```python
class PsnImportPreviewItem(BaseModel):
    source_title: str
    status: Literal["matched", "needs_mapping", "suggested_skip", "catalog_unavailable"]
    recommended_action: Literal["catalog", "raw", "skip"]
    igdb_id: int | None = None
    title: str | None = None
    reason: str | None = None
    suggestions: list[dict] = Field(default_factory=list)
    candidate_token: str
```

In `_psn_preview_items`, set `recommended_action="skip"` only for `suggested_skip`, `"catalog"` only when the final safe selection has exactly one catalog game, and `"raw"` for every other branch including unavailable and entitlement review.

Update preview summary semantics:

```python
confirmed_total=sum(item.recommended_action != "skip" for item in items),
message="Plausible PlayStation games are selected automatically; catalog matches add artwork and details when available.",
```

Do not call catalog detail during preview and do not change confirmation validation.

- [ ] **Step 4: Add aggregate resolver diagnostics with a failing `caplog` test first**

Add this logging regression (use `caplog` at `WARNING`):

```python
def test_resolver_logs_aggregate_provider_failures_without_titles(caplog):
    from app.integrations.igdb import IGDBError
    from app import psn_resolution

    batch = AsyncMock(side_effect=IGDBError("rate limited", 502))
    single = AsyncMock(side_effect=IGDBError("still unavailable", 502))

    with caplog.at_level("WARNING", logger="app.psn_resolution"):
        result = asyncio.run(psn_resolution.resolve_psn_catalog_titles(
            ["Private title one", "Private title two"],
            batch_fetcher=batch,
            single_fetcher=single,
        ))

    assert {item.kind for item in result.values()} == {"unavailable"}
    text = caplog.text
    assert "batch_size=2" in text
    assert "error_type=IGDBError" in text
    assert "status_code=502" in text
    assert "fallback_failures=2" in text
    assert "Private title" not in text
```

Then add `logger = logging.getLogger(__name__)`, retain the current resolution behavior, and record aggregate failures:

```python
except (IGDBError, TypeError, ValueError) as exc:
    logger.warning(
        "PSN catalog batch failed batch_size=%s error_type=%s status_code=%s",
        len(batch_titles),
        type(exc).__name__,
        getattr(exc, "status_code", None),
    )
    batch = {}
```

Count failed single fallbacks and emit one summary after the loop:

```python
if fallback_failures:
    logger.warning(
        "PSN catalog single fallback failed fallback_attempts=%s fallback_failures=%s",
        fallback_attempts,
        fallback_failures,
    )
```

Never interpolate `title`, access tokens, or transaction rows.

- [ ] **Step 5: Run backend tests and verify GREEN**

Run:

```powershell
rtk pytest tests/test_psn_resolution.py tests/integration/backend/test_profile_dashboard_psn_api.py -q
```

Expected: all focused backend tests pass, including the 25-title raw confirmation.

- [ ] **Step 6: Commit the backend contract**

```powershell
rtk git add app/schemas.py app/main.py app/psn_resolution.py tests/test_psn_resolution.py tests/integration/backend/test_profile_dashboard_psn_api.py
rtk git commit -m "feat: decouple PSN import from catalog availability"
```

---

### Task 3: Rebuild the import wizard around games versus suggested non-games

**Files:**
- Modify: `web/src/lib/api.ts:321-338`
- Modify: `web/src/routes/psn-import.tsx`
- Modify: `web/src/routes/-psn-import.test.tsx`

**Interfaces:**
- Consumes: `PsnImportPreviewItem.recommended_action` from Task 2.
- Produces: `Row.decision` initialized from the backend recommendation and two primary UI groups: `Games to import` and `Suggested non-games`.
- Preserves: the existing signed `PsnImportSelection[]` confirm payload.

- [ ] **Step 1: Replace old expectations with failing import-first UI tests**

Add one preview fixture containing:

```typescript
[
  { source_title: "Hades", status: "matched", recommended_action: "catalog", igdb_id: 1, title: "Hades", candidate_token: "a", suggestions: [] },
  { source_title: "Unknown", status: "needs_mapping", recommended_action: "raw", candidate_token: "b", suggestions: [] },
  { source_title: "Celeste", status: "catalog_unavailable", recommended_action: "raw", candidate_token: "c", suggestions: [], reason: "Catalog temporarily unavailable." },
  { source_title: "Spotify", status: "suggested_skip", recommended_action: "skip", candidate_token: "d", suggestions: [], reason: "Known PlayStation app." },
]
```

Assert `Games to import (3)`, `Suggested non-games (1)`, and `3 selected · 1 skipped`. Assert all three game checkboxes are checked, Spotify is not selected, and catalog unavailability appears only as row metadata rather than a `Catalog unavailable` section.

Add tests that:

- `Select all games` selects catalog and raw rows but not an unrestored suggested non-game;
- restoring Spotify makes it a selected raw decision;
- confirmation sends one catalog and all selected raw decisions without calling `window.confirm`;
- a retry response preserves an explicitly unchecked title and an explicitly restored non-game while upgrading an available selected title to a catalog decision;
- the import button is disabled/pending and reads `Importing…` while confirmation is in flight.

- [ ] **Step 2: Run the route test and verify RED**

Run:

```powershell
rtk npm.cmd --prefix web test -- --run src/routes/-psn-import.test.tsx
```

Expected: old sections/default selections and the raw warning dialog violate the new assertions.

- [ ] **Step 3: Update the API type and centralize default row creation**

Add:

```typescript
recommended_action: "catalog" | "raw" | "skip";
```

to `PsnImportPreviewItem`. In `psn-import.tsx`, introduce a small pure initializer:

```typescript
function recommendedDecision(item: PsnImportPreviewItem): Row["decision"] {
  if (item.recommended_action === "catalog") return item.igdb_id ? "catalog" : "raw";
  return item.recommended_action;
}
```

Initialize every non-skip row as selected. Use one merge function for initial preview and retry so explicit unchecked/restored state survives while a still-selected row may gain a catalog match:

```typescript
function mergePreviewRows(items: PsnImportPreviewItem[], previous: Row[] = []): Row[] {
  const previousByTitle = new Map(previous.map((row) => [row.source_title, row]));
  return items.map((item) => {
    const prior = previousByTitle.get(item.source_title);
    const restored = item.status === "suggested_skip" && Boolean(prior?.restored);
    if (!prior) {
      return {
        ...item,
        decision: recommendedDecision(item),
        catalogId: item.igdb_id ?? null,
        restored: false,
      };
    }
    if (item.status === "suggested_skip" && !restored) {
      return { ...item, decision: "skip", catalogId: null, restored: false };
    }
    if (prior.decision === "skip" && !restored) {
      return { ...item, decision: "skip", catalogId: item.igdb_id ?? null, restored };
    }
    const keepManualCatalog = prior.decision === "catalog" && prior.catalogId != null;
    return {
      ...item,
      decision: keepManualCatalog ? "catalog" : recommendedDecision(item) === "skip" ? "raw" : recommendedDecision(item),
      catalogId: keepManualCatalog ? prior.catalogId : item.igdb_id ?? null,
      restored,
    };
  });
}
```

Call `setRows((current) => mergePreviewRows(data.items, current))` on preview success.

- [ ] **Step 4: Implement two primary groups and non-blocking catalog badges**

Derive:

```typescript
const gameRows = rows.filter(row => row.status !== "suggested_skip" || row.restored);
const suggestedNonGames = rows.filter(row => row.status === "suggested_skip" && !row.restored);
```

Render one selectable `Games to import` section. Keep manual suggestion buttons inside relevant rows, show `Catalog match`, `PSN title`, or `Catalog temporarily unavailable` chips, and render suggested non-games collapsed with reasons and a `Restore and select` action.

Change bulk selection to choose `catalog` when a row has a recommended catalog ID and `raw` otherwise. Remove the second `window.confirm` for raw rows. Submit directly from the visible confirmation summary, disable while pending, and keep errors/selections on failure.

- [ ] **Step 5: Run the import route test and verify GREEN**

Run `rtk npm.cmd --prefix web test -- --run src/routes/-psn-import.test.tsx`.

Expected: all import-first wizard tests pass.

- [ ] **Step 6: Commit the import wizard**

```powershell
rtk git add web/src/lib/api.ts web/src/routes/psn-import.tsx web/src/routes/-psn-import.test.tsx
rtk git commit -m "feat: default PSN game candidates to import"
```

---

### Task 4: Make raw PSN library entries intentional and repairable

**Files:**
- Modify: `web/src/routes/library.tsx:70,153-206`
- Modify: `web/src/routes/-library.test.tsx`

**Interfaces:**
- Consumes: `LibraryOverviewGame.link_state`, `cover_url`, and `detail_game_id`.
- Contract: raw PSN rows have `detail_game_id=null`, may have `cover_url=null`, render a local title fallback, and are not clickable catalog links; linked rows retain their catalog link and cover.

- [ ] **Step 1: Add failing frontend library-card tests**

Mock one raw and one linked PSN item:

```typescript
api.getLibraryOverview.mockResolvedValue({
  games: [
    { id: "raw", source: "psn", title: "Unknown Game", link_state: "raw", detail_game_id: null, cover_url: null },
    { id: "linked", source: "psn", title: "Hades", link_state: "linked", detail_game_id: "101", cover_url: "https://cover" },
  ],
  raw_count: 1,
  quarantined_count: 0,
});
```

Change the existing `GameCover` mock to render its `title` prop in a `data-testid="game-cover"` element. Assert `Unknown Game` is not inside a link, displays `PlayStation title — catalog details can be added later`, and its cover fallback contains `Unknown Game`. Assert Hades links to `/games/101`.

- [ ] **Step 2: Run the library test and verify RED**

Run:

```powershell
rtk npm.cmd --prefix web test -- --run src/routes/-library.test.tsx
```

Expected: the raw-card copy/fallback assertion fails against the current generic mock/copy.

- [ ] **Step 3: Implement intentional raw-card presentation**

Keep `gameId` null for raw PSN rows. Pass the PSN source title to `GameCover`, retain its local gradient fallback, and use the exact raw copy from the test. Rename the banner from `Repair PSN library` to `Improve PlayStation details` with copy explaining that repair can add catalog art/details or hide unwanted entries; do not hide raw games from the normal library and do not add a catalog URL or remote placeholder.

- [ ] **Step 4: Run library and repair tests and verify GREEN**

Run:

```powershell
rtk npm.cmd --prefix web test -- --run src/routes/-library.test.tsx src/routes/-psn-library-repair.test.tsx
rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py -q -k "library_overview or repair"
```

Expected: raw cards remain visible/non-clickable, linked cards navigate, and repair/quarantine behavior remains green.

- [ ] **Step 5: Commit the library presentation**

Stage only files actually changed, then commit:

```powershell
rtk git add web/src/routes/library.tsx web/src/routes/-library.test.tsx
rtk git commit -m "fix: present raw PSN games without broken links"
```

---

### Task 5: Acceptance, regression verification, and pull request

**Files:**
- No required production files.
- Use locally only: `C:\Users\zagir\Downloads\c263610e-0057-4369-980c-c33a99a135d4.xlsx` when present.

**Interfaces:**
- Verifies the complete parser → classification → optional catalog → recommendation → confirm → library flow.

- [ ] **Step 1: Run focused PSN suites**

```powershell
rtk pytest tests/test_psn_export.py tests/test_psn_resolution.py tests/test_provider_clients.py tests/integration/backend/test_profile_dashboard_psn_api.py -q
rtk npm.cmd --prefix web test -- --run src/routes/-psn-import.test.tsx src/routes/-psn-library-repair.test.tsx src/routes/-library.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 2: Run complete verification**

Run separately:

```powershell
rtk pytest -q
rtk npm.cmd --prefix web test -- --run
rtk npm.cmd --prefix web run build
rtk git diff --check
```

Expected baseline or better: backend at least 449 tests pass, frontend at least 150 tests pass, production build exits `0`, and diff check is clean.

- [ ] **Step 3: Run local aggregate acceptance against the supplied export**

Run this non-mutating aggregate check; it prints counts only and models complete catalog unavailability as `raw` for every non-skip classification:

```powershell
rtk python -c "from collections import Counter; from pathlib import Path; from app.psn_export import parse_psn_export_candidates; from app.psn_resolution import classify_psn_candidate; path=Path(r'C:\Users\zagir\Downloads\c263610e-0057-4369-980c-c33a99a135d4.xlsx'); candidates=parse_psn_export_candidates(path.read_bytes(), path.name); kinds=Counter(classify_psn_candidate(item).kind for item in candidates); recommendations=Counter('skip' if classify_psn_candidate(item).kind == 'suggested_skip' else 'raw' for item in candidates); assert len(candidates) == 194; assert recommendations['skip'] == kinds['suggested_skip']; assert recommendations['raw'] == len(candidates) - kinds['suggested_skip']; print({'total': len(candidates), 'classification': dict(kinds), 'catalog_outage_recommendations': dict(recommendations)})"
```

Verify from the aggregate output and the focused route tests that:

- parsing still yields 194 unique candidates for the supplied file version;
- every item not classified `suggested_skip` has recommendation `raw` and is selected by default in the equivalent frontend mapping;
- every `suggested_skip` item remains unselected;
- no candidate becomes unselectable because catalog resolution failed;
- no file contents, title list, or generated fixture appears in `git status`;
- matched route fixtures become `catalog` while every other plausible fixture remains `raw`.

- [ ] **Step 4: Review scope and security**

Run:

```powershell
rtk git status --short
rtk diff origin/main...HEAD --stat
rtk rg -n --max-count 20 "c263610e|Bearer |IGDB_CLIENT_SECRET|access_token" app web tests docs -g "*.py" -g "*.ts" -g "*.tsx" -g "*.md"
```

Expected: only approved PSN source/tests/spec/plan are changed; no XLSX, secrets, title dump, generated route tree, or build artifact is tracked.

- [ ] **Step 5: Request code review before integration**

Invoke `superpowers:requesting-code-review`, address only verified in-scope findings using TDD, and rerun the affected focused suites plus full verification.

- [ ] **Step 6: Push and create the pull request**

```powershell
rtk git push -u origin codex/psn-import-first-implementation
rtk gh pr create --base main --head codex/psn-import-first-implementation --title "Make PSN import independent of catalog availability" --body "Import plausible PSN titles even when IGDB is unavailable; keep explicit non-games unselected; preserve linked enrichment and raw repair. Includes backend/frontend regressions and aggregate acceptance against the supplied export."
```

The PR body must summarize the import-first behavior, explicit non-game boundary, raw-card behavior, real-XLSX aggregate acceptance, and exact verification counts. Do not merge or manually deploy unless the user explicitly requests it.
