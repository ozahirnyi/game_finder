# Steam Recommendation Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep dashboard recommendations available when Steam cannot be read and return popular candidates when no personal signals exist.

**Architecture:** The dashboard already collects saved games, Steam games, and profile signals. It will always delegate recommendation selection to `get_personalized_recommendations`, passing an empty Steam list when Steam failed. That function already produces rotated deal candidates without personal signals, so no API contract or UI change is needed.

**Tech Stack:** FastAPI, SQLAlchemy, pytest, unittest.mock.AsyncMock.

## Global Constraints

- Preserve the existing Steam `error` status and message.
- Do not change dashboard response schemas or frontend code.
- Add regression coverage before production code.

---

### Task 1: Make dashboard recommendation selection resilient to Steam failures

**Files:**
- Modify: `tests/integration/backend/test_profile_dashboard_psn_api.py`
- Modify: `app/main.py:1928-1936`

**Interfaces:**
- Consumes: `get_personalized_recommendations(user, saved_games, steam_games) -> dict`.
- Produces: `DashboardRead.recommendations` with `status="ready"` whenever recommendation generation succeeds.

- [ ] **Step 1: Write the failing regression tests**

Add two tests in `tests/integration/backend/test_profile_dashboard_psn_api.py`:

```python
def test_dashboard_uses_saved_library_when_linked_steam_fetch_fails(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    user = auth_as(user_factory(email="dashboard-steam-fallback@example.com", steam_id="76561192"))
    db_session.add(Game(owner_id=user.id, title="Hades", source="manual"))
    db_session.commit()
    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(return_value=[]))
    monkeypatch.setattr(app_main, "fetch_owned_games", AsyncMock(side_effect=RuntimeError("steam")))
    recommendations = AsyncMock(return_value={"recommendations": [{"title": "Celeste"}]})
    monkeypatch.setattr(app_main, "get_personalized_recommendations", recommendations)

    response = api_client.get("/dashboard")

    assert response.status_code == 200
    assert response.json()["steam"]["status"] == "error"
    assert response.json()["recommendations"]["status"] == "ready"
    recommendations.assert_awaited_once()
    arguments = recommendations.await_args.args
    assert arguments[0] is user
    assert [game.title for game in arguments[1]] == ["Hades"]
    assert arguments[2] == []


def test_dashboard_returns_popular_recommendations_without_personal_signals(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    user = auth_as(user_factory(email="dashboard-popular@example.com"))
    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(return_value=[]))
    recommendations = AsyncMock(return_value={"recommendations": [{"title": "Popular Game"}]})
    monkeypatch.setattr(app_main, "get_personalized_recommendations", recommendations)

    response = api_client.get("/dashboard")

    assert response.status_code == 200
    assert response.json()["recommendations"]["status"] == "ready"
    recommendations.assert_awaited_once_with(user, [], [])
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pytest tests/integration/backend/test_profile_dashboard_psn_api.py -k "steam_fetch_fails or popular_recommendations" -v`

Expected: FAIL because the current dashboard returns the empty recommendations block and does not invoke `get_personalized_recommendations`.

- [ ] **Step 3: Implement the minimal dashboard change**

Replace the conditional recommendation branch in `app/main.py` with:

```python
    try:
        recommendation_block = DataBlock(
            status="ready",
            data=await get_personalized_recommendations(
                current_user,
                saved_games,
                steam_games if steam_block.status == "ready" else [],
            ),
        )
    except Exception:
        recommendation_block = DataBlock(
            status="error",
            data=[],
            message="Recommendations are temporarily unavailable. Please try again later.",
        )
```

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `pytest tests/integration/backend/test_profile_dashboard_psn_api.py -k "dashboard" -v`

Expected: PASS, including existing dashboard status coverage and both new regression cases.

- [ ] **Step 5: Run the relevant backend recommendation suite**

Run: `pytest tests/integration/backend/test_profile_dashboard_psn_api.py tests/test_steam_recommendations.py tests/test_recommendation_edges.py -v`

Expected: PASS with no failures.

- [ ] **Step 6: Commit the implementation**

```bash
git add app/main.py tests/integration/backend/test_profile_dashboard_psn_api.py
git commit -m "fix: fall back from unavailable Steam recommendations"
```
