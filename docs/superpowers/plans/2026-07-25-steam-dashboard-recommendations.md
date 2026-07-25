# Steam Dashboard Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically return cached, library-based Steam recommendations in the dashboard for linked users with owned games.

**Architecture:** A focused `app/steam_recommendations.py` module owns library fingerprinting, user-scoped cache access, prompt construction, and provider invocation. The dashboard consumes that module to populate its existing recommendation `DataBlock`; the React dashboard continues to consume the existing API shape and distinguishes error from empty states.

**Tech Stack:** FastAPI, Pydantic, Redis async cache, OpenAI recommendation client, pytest, React, TanStack Query, Vitest.

## Global Constraints

- Cache lifetime is exactly 21,600 seconds (six hours).
- Cache keys include both user ID and a fingerprint of sorted Steam app IDs, `playtime_forever`, and `playtime_2weeks`.
- Linked users with no owned games retain the empty CTA; provider errors return `DataBlock(status="error")` with a helpful message.
- Steam-owned app IDs are always passed as exclusions to the provider.
- Cache errors degrade to an uncached recommendation request and never break the dashboard by themselves.
- Do not alter the legacy `POST /steam/recommendations` response schema.

---

### Task 1: Add an isolated cached Steam recommendation service

**Files:**
- Create: `app/steam_recommendations.py`
- Create: `tests/test_steam_recommendations.py`

**Interfaces:**
- Consumes: `app.openai_client.get_recommendation`, `app.redis_client.cache_get`, and `app.redis_client.cache_set`.
- Produces: `build_steam_recommendation_prompt(games: list[dict], extra_prompt: str | None = None) -> str`, `build_steam_library_fingerprint(games: list[dict]) -> str`, and `get_cached_steam_recommendations(user_id: UUID, games: list[dict], extra_prompt: str | None = None) -> dict`.

- [ ] **Step 1: Write failing cache and fingerprint tests**

Create `tests/test_steam_recommendations.py`:

```python
import uuid

import pytest

import app.steam_recommendations as recommendations


def games(playtime=120):
    return [
        {"appid": 20, "name": "Team Fortress Classic", "playtime_forever": playtime, "playtime_2weeks": 0},
        {"appid": 10, "name": "Counter-Strike", "playtime_forever": 30, "playtime_2weeks": 5},
    ]


def test_library_fingerprint_is_stable_for_game_order_and_changes_for_playtime():
    assert recommendations.build_steam_library_fingerprint(games()) == recommendations.build_steam_library_fingerprint(list(reversed(games())))
    assert recommendations.build_steam_library_fingerprint(games()) != recommendations.build_steam_library_fingerprint(games(121))


@pytest.mark.asyncio
async def test_cached_recommendations_reuse_a_matching_user_library(monkeypatch):
    calls = {"provider": 0, "keys": []}

    async def cache_get(key):
        calls["keys"].append(key)
        return calls.get("cached")

    async def cache_set(_key, value, ttl):
        assert ttl == 21600
        calls["cached"] = value

    def provider(_prompt, excluded):
        calls["provider"] += 1
        assert excluded == [10, 20]
        return {"recommendations": [{"title": "Hades", "reason": "Fast action", "tags": ["Action"]}]}

    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "get_recommendation", provider)
    monkeypatch.setattr(recommendations, "build_steam_recommendation_prompt", lambda *_args: "prompt")

    user_id = uuid.uuid4()
    assert await recommendations.get_cached_steam_recommendations(user_id, games()) == await recommendations.get_cached_steam_recommendations(user_id, games())
    assert calls["provider"] == 1
    assert str(user_id) in calls["keys"][0]
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `rtk pytest -q tests/test_steam_recommendations.py`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.steam_recommendations'`.

- [ ] **Step 3: Implement the service**

Create `app/steam_recommendations.py`:

```python
import asyncio
import hashlib
import json
import uuid

from fastapi import HTTPException
from app.openai_client import get_recommendation
from app.redis_client import cache_get, cache_set

CACHE_TTL_SECONDS = 6 * 60 * 60


def build_steam_recommendation_prompt(games: list[dict], extra_prompt: str | None = None) -> str:
    top_games = games[:10]
    if not top_games:
        raise HTTPException(status_code=409, detail="Steam library has no playable history yet")
    game_lines = [
        f"{index}. {game.get('name')} - {round(int(game.get('playtime_forever') or 0) / 60, 1)} hours played"
        for index, game in enumerate(top_games, start=1)
    ]
    request = (extra_prompt or "").strip() or "Recommend games I am likely to enjoy next based on my most played Steam games."
    return "\n".join([request, "", "My most played Steam games:", *game_lines, "", "Use the playtime as the strongest preference signal.", "Avoid recommending games that are already in this Steam list."])


def build_steam_library_fingerprint(games: list[dict]) -> str:
    normalized = sorted(
        (
            int(game["appid"]),
            int(game.get("playtime_forever") or 0),
            int(game.get("playtime_2weeks") or 0),
        )
        for game in games
        if game.get("appid") is not None
    )
    return hashlib.sha256(json.dumps(normalized, separators=(",", ":")).encode()).hexdigest()


async def get_cached_steam_recommendations(
    user_id: uuid.UUID,
    games: list[dict],
    extra_prompt: str | None = None,
) -> dict:
    fingerprint = build_steam_library_fingerprint(games)
    key = f"steam_recommendations:{user_id}:{fingerprint}"
    try:
        cached = await cache_get(key)
        if cached is not None:
            return cached
    except Exception:
        pass

    prompt = build_steam_recommendation_prompt(games, extra_prompt)
    excluded = sorted({int(game["appid"]) for game in games if game.get("appid") is not None})
    result = await asyncio.to_thread(get_recommendation, prompt, excluded)
    try:
        await cache_set(key, result, CACHE_TTL_SECONDS)
    except Exception:
        pass
    return result
```

- [ ] **Step 4: Verify the service tests pass**

Run: `rtk pytest -q tests/test_steam_recommendations.py`

Expected: PASS (two tests).

- [ ] **Step 5: Commit the service**

```powershell
rtk git add app/steam_recommendations.py tests/test_steam_recommendations.py
rtk git commit -m "feat: cache steam recommendations by library"
```

### Task 2: Populate dashboard recommendation blocks from Steam

**Files:**
- Modify: `app/main.py:1227-1256,1677-1690`
- Modify: `tests/test_api_contracts.py:860-1116`

**Interfaces:**
- Consumes: `get_cached_steam_recommendations(current_user.id, steam_games)` from Task 1.
- Produces: dashboard `recommendations` blocks with `ready`, `empty`, or `error` status; existing `POST /steam/recommendations` delegates to the cache service.

- [ ] **Step 1: Add failing dashboard contract tests**

Add tests with dependency overrides and monkeypatches patterned after the existing dashboard tests:

```python
def test_dashboard_generates_recommendations_for_linked_steam_games(monkeypatch):
    user = SimpleNamespace(id=uuid.uuid4(), steam_id="7656119", steam_country_code="US", email="player@example.com", created_at=datetime.now(timezone.utc))
    monkeypatch.setattr(main, "fetch_owned_games", lambda _steam_id: [{"appid": 10, "name": "Counter-Strike", "playtime_forever": 50, "playtime_2weeks": 5}])
    async def cached(_user_id, games):
        assert games[0]["appid"] == 10
        return {"recommendations": [{"title": "Hades", "reason": "Action", "tags": ["Action"]}]}
    monkeypatch.setattr(main, "get_cached_steam_recommendations", cached)
    # install current-user and db overrides, request GET /dashboard, then clear overrides
    assert response.json()["recommendations"]["status"] == "ready"
    assert response.json()["recommendations"]["data"]["recommendations"][0]["title"] == "Hades"


def test_dashboard_returns_recommendation_error_when_provider_fails(monkeypatch):
    async def failed(*_args):
        raise HTTPException(status_code=500, detail="OpenAI recommendations failed")
    monkeypatch.setattr(main, "get_cached_steam_recommendations", failed)
    # use the same linked-user/game setup
    assert response.json()["recommendations"] == {
        "status": "error", "data": [],
        "message": "Recommendations are temporarily unavailable. Please try again later.",
    }
```

Also add cases asserting an unlinked user and a linked user with `fetch_owned_games` returning `[]` receive `status == "empty"` and never call `get_cached_steam_recommendations`.

- [ ] **Step 2: Run dashboard recommendation tests and confirm failure**

Run: `rtk pytest -q tests/test_api_contracts.py -k dashboard_recommendation`

Expected: FAIL because the dashboard always returns the generic empty block.

- [ ] **Step 3: Wire the helper into the dashboard and route**

Move the existing `build_steam_recommendation_prompt` implementation from `app/main.py` into Task 1's service, then import `build_steam_recommendation_prompt` and `get_cached_steam_recommendations` from `app.steam_recommendations` in `app/main.py`. Replace the fixed dashboard recommendation value with:

```python
if steam_block.status == "ready" and steam_games:
    try:
        recommendation_block = DataBlock(
            status="ready",
            data=await get_cached_steam_recommendations(current_user.id, steam_games),
        )
    except Exception:
        recommendation_block = DataBlock(
            status="error",
            data=[],
            message="Recommendations are temporarily unavailable. Please try again later.",
        )
else:
    recommendation_block = empty_block("Add games or connect Steam to get recommendations.")
```

Pass `recommendations=recommendation_block` to `DashboardRead`.

In `steam_recommendations`, replace the inline prompt/provider code with:

```python
games = await fetch_owned_games(current_user.steam_id)
return await get_cached_steam_recommendations(current_user.id, games, data.prompt)
```

- [ ] **Step 4: Verify the contract tests pass**

Run: `rtk pytest -q tests/test_api_contracts.py -k "dashboard_recommendation or steam_recommendations"`

Expected: PASS, including linked, empty, error, and existing Steam route tests.

- [ ] **Step 5: Commit dashboard integration**

```powershell
rtk git add app/main.py tests/test_api_contracts.py
rtk git commit -m "feat: populate dashboard steam recommendations"
```

### Task 3: Render the dashboard provider-error state

**Files:**
- Modify: `web/src/routes/index.tsx:89-147`
- Modify: `web/src/test/live-data.routes.test.tsx:100-175`

**Interfaces:**
- Consumes: `DashboardResponse.recommendations` with `status`, `data`, and `message`.
- Produces: visible recommendation cards for ready data, existing empty CTA text, and an error panel message for provider failures.

- [ ] **Step 1: Add a failing error-state UI test**

Add this test to `web/src/test/live-data.routes.test.tsx`:

```tsx
it("shows a recommendation-provider error instead of the Steam CTA", async () => {
  api.getDashboard.mockResolvedValue({
    ...dashboard(),
    steam: ready({ steam: { linked: true }, games: [{ appid: 10, name: "Counter-Strike", playtime_forever: 5, playtime_2weeks: 0, img_icon_url: null }] }),
    recommendations: { status: "error", data: [], message: "Recommendations are temporarily unavailable. Please try again later." },
  });
  renderPage(<Dashboard />);
  expect(await screen.findByText("Recommendations are temporarily unavailable. Please try again later.")).toBeVisible();
  expect(screen.queryByText("Add games or connect Steam to get recommendations.")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused UI test and confirm failure**

Run: `rtk npm --prefix web test -- --run src/test/live-data.routes.test.tsx`

Expected: FAIL because the dashboard renders the error as the generic empty-state paragraph.

- [ ] **Step 3: Render an explicit recommendation error panel**

Replace the no-recommendations branch with an error-first branch:

```tsx
{data?.recommendations.status === "error" ? (
  <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
    {message(data.recommendations, "Recommendations are temporarily unavailable. Please try again later.")}
  </p>
) : recommendations.length ? (
  // keep the existing recommendation-card grid unchanged
) : (
  // keep the existing empty-state paragraph unchanged
)}
```

- [ ] **Step 4: Verify focused UI tests pass**

Run: `rtk npm --prefix web test -- --run src/test/live-data.routes.test.tsx`

Expected: PASS, including ready, disconnected, and provider-error dashboard states.

- [ ] **Step 5: Run full verification and commit**

Run:

```powershell
rtk pytest -q
rtk npm --prefix web test -- --run
rtk npm --prefix web run build
rtk git diff --check
```

Expected: all tests pass, the production build succeeds, and no whitespace errors are reported.

Commit:

```powershell
rtk git add web/src/routes/index.tsx web/src/test/live-data.routes.test.tsx
rtk git commit -m "feat: show dashboard recommendation errors"
```
