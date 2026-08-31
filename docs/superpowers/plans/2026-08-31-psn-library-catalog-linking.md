# PSN Library Catalog Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every raw PSN library row in bounded catalog batches and let users choose a catalog match directly from the library.

**Architecture:** Persist only the lookup disposition on raw `Game` rows, process at most eight rows per owner-scoped enrichment request, and auto-link only a unique exact normalized match. The library client repeats bounded requests, while an inline picker uses existing catalog search and repair-apply APIs for ambiguous or unmatched titles.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic, pytest, React 19, TanStack Router/Query, TypeScript, Vitest, Testing Library.

## Global Constraints

- PSN import must succeed without catalog availability.
- Automatic catalog linking requires exactly one normalized exact title match.
- Fuzzy, substring, and popularity-ranked results must never auto-link.
- Existing and future raw PSN rows must be processed without re-uploading an export.
- Catalog work must be bounded to eight PSN rows per backend request.
- Provider failure must leave the attempted batch retryable.
- Steam library behavior and identifiers must not change.
- Existing high-confidence non-game quarantine rules remain the only automatic quarantine rules.
- Every shell command must use the project-required `rtk` prefix.
- Production behavior changes follow RED-GREEN-REFACTOR.

---

### Task 1: Persist PSN catalog lookup disposition

**Files:**
- Create: `alembic/versions/d0e1f2a3b4c5_add_psn_catalog_lookup_state.py`
- Modify: `app/database.py`
- Modify: `app/schemas.py`
- Modify: `app/main.py`
- Test: `tests/integration/backend/test_profile_dashboard_psn_api.py`

**Interfaces:**
- Produces: `Game.catalog_lookup_state: str | None`.
- Produces: `LibraryGameRead.catalog_lookup_state` and `LibraryOverviewRead.pending_catalog_count`.
- Consumes: existing `Game.link_state` and `/library/overview` contract.

- [ ] **Step 1: Write a failing overview contract test**

Add a test that creates one raw PSN row with `catalog_lookup_state=None`, one raw row with `catalog_lookup_state="review"`, and one linked PSN row. Assert that `/library/overview` returns the per-row state and `pending_catalog_count == 1`.

```python
def test_library_overview_exposes_psn_catalog_lookup_progress(
    api_client, db_session, user_factory, auth_as
):
    owner = auth_as(user_factory(email="psn-lookup-overview@example.com"))
    db_session.add_all([
        Game(owner_id=owner.id, source="psn", external_id="psn:manual:pending",
             title="Pending", link_state="raw", catalog_lookup_state=None),
        Game(owner_id=owner.id, source="psn", external_id="psn:manual:review",
             title="Review", link_state="raw", catalog_lookup_state="review"),
        Game(owner_id=owner.id, source="psn", external_id="psn:101",
             title="Linked", link_state="linked", catalog_game_id=101),
    ])
    db_session.commit()

    payload = api_client.get("/library/overview").json()

    assert payload["pending_catalog_count"] == 1
    assert {item["title"]: item["catalog_lookup_state"] for item in payload["games"]} == {
        "Linked": None,
        "Pending": None,
        "Review": "review",
    }
```

- [ ] **Step 2: Run the test and verify RED**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py::test_library_overview_exposes_psn_catalog_lookup_progress -q`

Expected: FAIL because `catalog_lookup_state` is not a `Game` constructor argument and the response schema has no pending count.

- [ ] **Step 3: Add the column, migration, and response fields**

Add this model field after `link_state`:

```python
catalog_lookup_state: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
```

Create a migration with `revision = "d0e1f2a3b4c5"` and `down_revision = "c9d8e7f6a5b4"`:

```python
def upgrade() -> None:
    op.add_column("games", sa.Column("catalog_lookup_state", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("games", "catalog_lookup_state")
```

Extend the schemas:

```python
catalog_lookup_state: Literal["review", "no_match", "skipped"] | None = None
```

on `LibraryGameRead`, and:

```python
pending_catalog_count: int = 0
```

on `LibraryOverviewRead`. Populate both fields in `library_overview_route`; count only owner-scoped PSN rows that are raw, not quarantined, and have `catalog_lookup_state is None`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py::test_library_overview_exposes_psn_catalog_lookup_progress tests/test_api_contracts.py -q`

Expected: PASS.

- [ ] **Step 5: Commit the persistent contract**

```text
git add app/database.py app/schemas.py app/main.py alembic/versions/d0e1f2a3b4c5_add_psn_catalog_lookup_state.py tests/integration/backend/test_profile_dashboard_psn_api.py
git commit -m "feat: track PSN catalog lookup progress"
```

### Task 2: Add bounded, retryable automatic enrichment

**Files:**
- Modify: `app/schemas.py`
- Modify: `app/main.py`
- Test: `tests/integration/backend/test_profile_dashboard_psn_api.py`

**Interfaces:**
- Produces: `POST /psn/library-repair/enrich`.
- Produces: `PsnCatalogEnrichmentResult(attempted, linked, review, quarantined, remaining)`.
- Consumes: `resolve_psn_catalog_titles(titles, max_fallback_titles=8, batch_fetcher=..., single_fetcher=...)` and `_psn_catalog_match_key`.

- [ ] **Step 1: Write failing endpoint tests**

Add tests for these independent behaviors:

```python
def test_psn_enrichment_processes_every_raw_row_in_bounded_batches(...):
    # Create 21 owner-scoped raw PSN rows.
    # Mock batch lookup as empty and single lookup as one exact result per query.
    # POST repeatedly until remaining is zero.
    # Assert every row is linked and each request attempted at most eight rows.


def test_psn_enrichment_persists_review_and_no_match_without_repeating(...):
    # Return two non-exact suggestions for one title and no results for another.
    # Assert states are review/no_match and the second call attempts zero rows.


def test_psn_enrichment_rolls_back_provider_unavailability(...):
    # Make one resolution unavailable.
    # Assert HTTP 502 and all rows still have catalog_lookup_state=None.


def test_psn_enrichment_quarantines_only_existing_high_confidence_non_games(...):
    # Include Spotify and a normal title.
    # Assert Spotify becomes quarantined while the normal exact title links.
```

Use a concrete exact single lookup response:

```python
async def single_lookup(title: str):
    number = int(title.removeprefix("Game "))
    return {"results": [{"id": 1000 + number, "name": title,
                          "background_image": f"https://covers/{number}.jpg"}]}
```

- [ ] **Step 2: Run the endpoint tests and verify RED**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py -k "psn_enrichment" -q`

Expected: FAIL with 404 for the missing endpoint.

- [ ] **Step 3: Extract one catalog-link helper**

Extract the duplicate merge and assignment currently inside `apply_psn_library_repair` into:

```python
def _link_psn_game_to_catalog(db: Session, game: Game, catalog_id: int, detail: dict) -> None:
    title, cover = _psn_linked_game_payload(detail, catalog_id)
    duplicate = db.query(Game).filter(
        Game.owner_id == game.owner_id,
        Game.source == "psn",
        Game.catalog_game_id == catalog_id,
        Game.id != game.id,
    ).first()
    if duplicate:
        duplicate.created_at = min(duplicate.created_at, game.created_at)
        duplicate.notes = duplicate.notes or game.notes
        duplicate.info = duplicate.info or game.info
        duplicate.playtime_forever = max(
            duplicate.playtime_forever or 0, game.playtime_forever or 0
        ) or None
        db.delete(game)
        return
    game.catalog_game_id = catalog_id
    game.link_state = "linked"
    game.catalog_lookup_state = None
    game.title = title
    game.img_icon_url = cover
```

Use the helper from the existing manual repair apply path and keep its current validation and transaction boundary.

- [ ] **Step 4: Implement the bounded endpoint**

Add the response schema:

```python
class PsnCatalogEnrichmentResult(BaseModel):
    attempted: int = 0
    linked: int = 0
    review: int = 0
    quarantined: int = 0
    remaining: int = 0
```

Add an eight-row constant and endpoint. Resolve all searchable titles with `max_fallback_titles=len(searchable)`. Before mutating rows, reject any `CatalogResolution(kind="unavailable")` with HTTP 502. For each safe exact result call `_link_psn_game_to_catalog`; otherwise set `review` when results exist and `no_match` when empty. Commit once, rollback on every exception, and calculate `remaining` with the same owner-scoped pending filter.

- [ ] **Step 5: Run focused backend tests and verify GREEN**

Run: `rtk pytest tests/test_psn_resolution.py tests/integration/backend/test_profile_dashboard_psn_api.py -q`

Expected: PASS.

- [ ] **Step 6: Commit the backend enrichment**

```text
git add app/main.py app/schemas.py tests/integration/backend/test_profile_dashboard_psn_api.py
git commit -m "feat: enrich PSN catalog links in bounded batches"
```

### Task 3: Add the web enrichment client and automatic library backfill

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/routes/library.tsx`
- Modify: `web/src/routes/-library.test.tsx`

**Interfaces:**
- Produces: `enrichPsnLibrary(): Promise<PsnCatalogEnrichmentResult>`.
- Consumes: `LibraryOverview.pending_catalog_count` and `POST /psn/library-repair/enrich`.

- [ ] **Step 1: Write failing automatic-enrichment UI tests**

Extend the hoisted API mock with `enrichPsnLibrary`, `searchGames`, and `applyPsnLibraryRepair`. Add one test where the overview reports pending rows, two enrichment responses return `remaining: 2` then `remaining: 0`, and assert two sequential calls. Add another where enrichment rejects and assert a visible **Retry catalog matching** button and no unbounded retry.

```tsx
api.getLibraryOverview.mockResolvedValue({ games: [], pending_catalog_count: 3 });
api.enrichPsnLibrary
  .mockResolvedValueOnce({ attempted: 1, linked: 1, review: 0, quarantined: 0, remaining: 2 })
  .mockResolvedValueOnce({ attempted: 2, linked: 1, review: 1, quarantined: 0, remaining: 0 });

renderLibrary();

await waitFor(() => expect(api.enrichPsnLibrary).toHaveBeenCalledTimes(2));
```

- [ ] **Step 2: Run the UI tests and verify RED**

Run: `rtk npm test -- src/routes/-library.test.tsx`

Expected: FAIL because the API function and automatic loop do not exist.

- [ ] **Step 3: Add API types and the bounded loop**

Add `catalog_lookup_state` to `LibraryOverviewGame`, `pending_catalog_count` to `LibraryOverview`, and:

```ts
export type PsnCatalogEnrichmentResult = {
  attempted: number;
  linked: number;
  review: number;
  quarantined: number;
  remaining: number;
};

export function enrichPsnLibrary() {
  return apiRequest<PsnCatalogEnrichmentResult>("/psn/library-repair/enrich", {
    auth: true,
    method: "POST",
  });
}
```

In `LibraryPage`, use one mutation whose function loops sequentially while `remaining > 0`. Start it once when the loaded overview has `pending_catalog_count > 0`. Invalidate `['library']` after success. On error, show a retry button that explicitly starts a new mutation; never retry automatically inside the error path.

- [ ] **Step 4: Run the UI tests and verify GREEN**

Run: `rtk npm test -- src/routes/-library.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit automatic backfill**

```text
git add web/src/lib/api.ts web/src/routes/library.tsx web/src/routes/-library.test.tsx
git commit -m "feat: backfill PSN catalog links from the library"
```

### Task 4: Add an inline catalog picker to raw PSN cards

**Files:**
- Modify: `web/src/routes/library.tsx`
- Modify: `web/src/routes/-library.test.tsx`

**Interfaces:**
- Consumes: `searchGames({query})` and `applyPsnLibraryRepair([{game_id, action: "link", catalog_id}])`.
- Produces: editable per-card catalog search and selection.

- [ ] **Step 1: Write a failing inline-picker test**

Render one raw PSN row titled `STAR WARS Battlefront`. Expand **Find in catalog**, replace the query with `Star Wars Battlefront 2015`, submit, and choose the returned catalog result. Assert the exact game ID and catalog ID sent to the repair endpoint.

```tsx
api.searchGames.mockResolvedValue({ results: [{ id: 777, name: "Star Wars Battlefront" }] });
api.applyPsnLibraryRepair.mockResolvedValue({ updated: 1 });

fireEvent.click(await screen.findByRole("button", { name: "Find in catalog" }));
fireEvent.change(screen.getByLabelText("Catalog search for STAR WARS Battlefront"), {
  target: { value: "Star Wars Battlefront 2015" },
});
fireEvent.click(screen.getByRole("button", { name: "Search catalog" }));
fireEvent.click(await screen.findByRole("button", { name: "Use Star Wars Battlefront" }));

expect(api.applyPsnLibraryRepair).toHaveBeenCalledWith([
  { game_id: "raw", action: "link", catalog_id: 777 },
]);
```

- [ ] **Step 2: Run the picker test and verify RED**

Run: `rtk npm test -- src/routes/-library.test.tsx -t "chooses a catalog game inline"`

Expected: FAIL because the raw card has no catalog picker.

- [ ] **Step 3: Implement the picker**

Keep `LibraryCard` navigation unchanged for Steam and linked PSN rows. For raw PSN rows, render an expandable form with an accessible label, editable query, pending and error states, and at most five result buttons. On successful link, close the picker and invalidate `['library']` and `['psn-library-repair']`.

Do not auto-select a manual search result. Every result requires an explicit **Use {title}** click.

- [ ] **Step 4: Run route tests and verify GREEN**

Run: `rtk npm test -- src/routes/-library.test.tsx src/routes/-psn-library-repair.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the inline picker**

```text
git add web/src/routes/library.tsx web/src/routes/-library.test.tsx
git commit -m "feat: choose PSN catalog matches in the library"
```

### Task 5: Verify migration, backend, and production web build

**Files:**
- Modify only files required by failures found in this task.

**Interfaces:**
- Consumes all previous task outputs.
- Produces a deployable branch with no known PSN catalog-linking regressions.

- [ ] **Step 1: Verify the Alembic graph and migration round trip**

Run: `rtk python -m alembic heads`

Expected: exactly one head, `d0e1f2a3b4c5`.

Run: `rtk pytest tests/test_migration_graph.py -q`

Expected: PASS with exactly one Alembic upgrade head.

- [ ] **Step 2: Run backend regression tests**

Run: `rtk pytest tests/test_psn_resolution.py tests/integration/backend/test_profile_dashboard_psn_api.py tests/test_api_contracts.py -q`

Expected: PASS.

- [ ] **Step 3: Run frontend tests and build**

Run: `rtk npm test -- src/routes/-library.test.tsx src/routes/-psn-library-repair.test.tsx`

Expected: PASS.

Run: `rtk npm run build`

Expected: exit code 0 with a completed Vite build.

- [ ] **Step 4: Review the scoped diff**

Run: `rtk diff --stat origin/main...HEAD` followed by file-scoped `rtk diff` for `app/main.py`, `app/database.py`, `app/schemas.py`, `web/src/routes/library.tsx`, and the migration.

Expected: only PSN catalog-linking code, tests, migration, spec, and plan are present.

- [ ] **Step 5: Commit any verification-only corrections**

If verification required corrections, commit only those files with:

```text
git commit -m "fix: complete PSN catalog linking verification"
```

If no corrections were required, do not create an empty commit.

- [ ] **Step 6: Push and open a pull request**

Push `codex/psn-library-catalog-linking` and open a PR against `main` summarizing the bounded enrichment, exact-only auto-linking, inline picker, migration, and verification evidence.
