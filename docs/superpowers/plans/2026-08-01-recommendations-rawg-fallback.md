# Trending Recommendation Data Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return top games when Steam deal candidates cannot populate recommendations.

**Architecture:** `get_personalized_recommendations` keeps Steam candidates as its primary source. If filtering leaves no candidates, it maps RAWG trending results into the existing recommendation shape and applies the same owned-title exclusion before caching.

**Tech Stack:** Python, RAWG integration, pytest.

## Global Constraints

- Keep the recommendation response schema and cache key unchanged.
- Do not recommend owned Steam or saved Library titles.
- Add a failing regression test before implementation.

---

### Task 1: Use RAWG trends after an empty Steam candidate response

**Files:**
- Modify: `tests/test_steam_recommendations.py`
- Modify: `app/steam_recommendations.py`

**Interfaces:**
- Consumes: `fetch_rawg_trending_games(page: int, page_size: int) -> dict` with `results`.
- Produces: `get_personalized_recommendations(...) -> {"recommendations": list[dict], "cache_expires_at": str}`.

- [ ] **Step 1: Write the failing regression test**

```python
@pytest.mark.anyio
async def test_personal_recommendations_fall_back_to_non_owned_rawg_trends(monkeypatch):
    async def cache_get(_key): return None
    async def cache_set(*_args): return None
    async def candidates(): return {"candidates": []}
    async def trending(page, page_size):
        assert (page, page_size) == (1, 12)
        return {"results": [
            {"id": 1, "name": "Saved", "background_image": "saved-cover"},
            {"id": 2, "name": "Top Game", "background_image": "top-cover"},
        ]}

    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_steam_store_deal_candidates", candidates)
    monkeypatch.setattr(recommendations, "fetch_rawg_trending_games", trending)

    result = await recommendations.get_personalized_recommendations(User(uuid.uuid4()), [Saved("Saved")], [])

    assert result["recommendations"] == [{
        "title": "Top Game", "reason": "Popular game selected because personalized catalog is unavailable.",
        "tags": [], "rawg_id": 2, "cover_url": "top-cover",
    }]
```

- [ ] **Step 2: Verify the test fails**

Run: `pytest tests/test_steam_recommendations.py -k "rawg_trends" -v`

Expected: FAIL because the current function returns an empty list without calling RAWG trends.

- [ ] **Step 3: Implement the minimal fallback**

Import `fetch_rawg_trending_games`. After filtering Steam candidates, when `available` is empty, fetch `fetch_rawg_trending_games(page=1, page_size=12)`, filter results against `excluded`, and map each result to title, cover URL, RAWG id, and the popular-game reason. Use those mapped results for the existing six-item selection.

- [ ] **Step 4: Verify the focused suite passes**

Run: `pytest tests/test_steam_recommendations.py -v`

Expected: PASS.

- [ ] **Step 5: Run relevant dashboard coverage**

Run: `pytest tests/test_steam_recommendations.py tests/integration/backend/test_profile_dashboard_psn_api.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/steam_recommendations.py tests/test_steam_recommendations.py
git commit -m "fix: fall back to trending recommendations"
```
