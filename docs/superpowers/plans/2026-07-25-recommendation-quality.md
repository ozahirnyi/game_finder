# Recommendation Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exclude owned Steam games from recommendations and render enriched catalog cards in a compact four-column grid.

**Architecture:** The Steam recommendation service post-processes AI titles against owned Steam titles, removes duplicates, and enriches retained items with RAWG metadata before caching. The dashboard consumes optional `rawg_id` and `cover_url` to link and render real covers.

**Tech Stack:** FastAPI, Pydantic, RAWG integration, pytest, React, TypeScript, Vitest.

## Global Constraints

- Owned Steam titles are excluded case-insensitively after AI generation.
- Recommendation items expose optional `rawg_id` and `cover_url`.
- Desktop grid is four columns; mobile remains two columns.

---

### Task 1: Normalize and enrich recommendation results

**Files:**
- Modify: `app/schemas.py`, `app/steam_recommendations.py`
- Test: `tests/test_steam_recommendations.py`

- [ ] **Step 1: Write failing tests**

```python
@pytest.mark.anyio
async def test_normalize_recommendations_removes_owned_duplicates_and_adds_rawg_metadata(monkeypatch):
    async def rawg(title, page=1):
        return {"results": [{"id": 274755, "name": "Hades II", "background_image": "https://cdn.example/hades.jpg"}]}
    monkeypatch.setattr(recommendations, "fetch_rawg_games", rawg)
    items = await recommendations.normalize_recommendations(
        {"recommendations": [
            {"title": "Rainbow Six Siege", "reason": "owned", "tags": []},
            {"title": "Hades II", "reason": "good", "tags": []},
            {"title": "hades ii", "reason": "duplicate", "tags": []},
        ]}, {"rainbow six siege"},
    )
    assert items == [{"title": "Hades II", "reason": "good", "tags": [], "rawg_id": 274755, "cover_url": "https://cdn.example/hades.jpg"}]
```

- [ ] **Step 2: Run red test**

Run: `rtk pytest -q tests/test_steam_recommendations.py -k normalize`

Expected: FAIL because `normalize_recommendations` does not exist.

- [ ] **Step 3: Implement normalization**

Add optional fields to `RecommendationItem`:

```python
rawg_id: int | None = None
cover_url: str | None = None
```

In `app/steam_recommendations.py`, add `normalize_recommendations(result, owned_titles)` that case-folds titles, skips owned and already-seen titles, calls `fetch_rawg_games(title)`, and returns canonical `name`, `id`, and `background_image` when a result exists. Invoke it after `get_recommendation` and before `cache_set`.

- [ ] **Step 4: Run green test**

Run: `rtk pytest -q tests/test_steam_recommendations.py`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add app/schemas.py app/steam_recommendations.py tests/test_steam_recommendations.py
rtk git commit -m "fix: filter owned steam recommendations"
```

### Task 2: Render enriched compact dashboard cards

**Files:**
- Modify: `web/src/lib/api.ts`, `web/src/routes/index.tsx`
- Modify: `web/src/test/live-data.routes.test.tsx`

- [ ] **Step 1: Write failing UI test**

```tsx
it("renders enriched recommendation cover links in four desktop columns", async () => {
  api.getDashboard.mockResolvedValue({ ...dashboard(), recommendations: ready({ recommendations: [{ title: "Hades II", reason: "Action", tags: [], rawg_id: 274755, cover_url: "https://cdn.example/hades.jpg" }] }) });
  renderPage(<Dashboard />);
  expect(await screen.findByRole("link", { name: /hades ii/i })).toHaveAttribute("href", "/games/274755");
  expect(screen.getByAltText("Hades II")).toHaveAttribute("src", "https://cdn.example/hades.jpg");
});
```

- [ ] **Step 2: Run red test**

Run: `rtk npm --prefix web test -- --run src/test/live-data.routes.test.tsx`

Expected: FAIL because recommendation metadata is not typed or rendered.

- [ ] **Step 3: Implement card metadata and grid**

Extend `RecommendationItem` in `web/src/lib/api.ts` with `rawg_id?: number | null` and `cover_url?: string | null`. In the dashboard, use `to="/games/$gameId"` with `params={{ gameId: String(item.rawg_id) }}` for enriched items, retain `/search` fallback otherwise, pass `src={item.cover_url}`, and change the grid to `grid-cols-2 gap-3 lg:grid-cols-4` with compact card image and padding classes.

- [ ] **Step 4: Run green test and full verification**

Run:

```powershell
rtk pytest -q
rtk npm --prefix web test -- --run
rtk npm --prefix web run build
rtk git diff --check
```

Expected: all tests and production build pass.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/lib/api.ts web/src/routes/index.tsx web/src/test/live-data.routes.test.tsx
rtk git commit -m "feat: render enriched recommendation cards"
```
