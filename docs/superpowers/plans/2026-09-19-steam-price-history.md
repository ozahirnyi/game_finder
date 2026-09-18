# Steam Price History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve Steam historical price points for every Steam game and render them in a readable SteamDB-inspired chart.

**Architecture:** IsThereAnyDeal will filter its history response to Steam (shop ID 61) before the existing weekly normalization runs. The detail page continues consuming the same contract. `PriceHistoryChart` remains a self-contained SVG component and gains display-only grid, labels, and a hover guide without a new chart dependency.

**Tech Stack:** FastAPI, httpx, pytest, React, TypeScript, SVG, Vitest, Testing Library.

## Global Constraints

- Change only price-history retrieval and `PriceHistoryChart`; do not alter current Steam price, title resolution, search, links, alerts, or other page content.
- Keep ITAD as the data source; request documented Steam shop ID `61`, not SteamDB data.
- Preserve existing public API and component props, fallback states, source currency, and keyboard access.
- Add focused automated tests before each production-code change.

---

### Task 1: Filter Steam history before weekly normalization

**Files:**
- Modify: `app/prices.py:226-300`
- Test: `tests/test_provider_clients.py`

**Interfaces:**
- Consumes: `fetch_game_price_history(title, country="US", steam_appid=None, period="6m")`.
- Produces: the same `dict[str, Any]` response, with `history` containing only Steam observations before `normalize_price_history` compacts it.

- [ ] **Step 1: Write the failing test**

Add a recording fake client test that supplies one same-week Steam point and one cheaper GOG point, then asserts both the provider request and the returned history:

```python
@pytest.mark.anyio
async def test_itad_history_requests_steam_points_before_weekly_compaction(monkeypatch):
    monkeypatch.setenv("ITAD_API_KEY", "key")
    client = RecordingClient([
        FakeResponse({"Game": "g1"}),
        FakeResponse([{"historyLow": {}, "deals": []}]),
        FakeResponse([
            {"timestamp": "2026-09-01T00:00:00Z", "shop": {"name": "Steam"}, "deal": {"price": {"amount": 19.99, "currency": "USD"}}},
            {"timestamp": "2026-09-02T00:00:00Z", "shop": {"name": "GOG"}, "deal": {"price": {"amount": 4.99, "currency": "USD"}}},
        ]),
    ])
    monkeypatch.setattr(prices.httpx, "AsyncClient", lambda *args, **kwargs: client)

    result = await prices.fetch_game_price_history("Game")

    history_call = next(call for call in client.calls if call[1].endswith("/games/history/v2"))
    assert history_call[2]["params"]["shops"] == 61
    assert [point["shop"] for point in result["history"]] == ["Steam"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk pytest tests/test_provider_clients.py::test_itad_history_requests_steam_points_before_weekly_compaction -v`

Expected: FAIL because the history request params do not yet include `shops` and the normalizer can retain GOG.

- [ ] **Step 3: Write the minimal implementation**

Change only the history request in `fetch_game_price_history`:

```python
history = await client.get(
    f"{ITAD_BASE_URL}/games/history/v2",
    params={"id": game_id, "country": country, "since": since, "shops": 61},
)
```

Keep `_steam_only_price_history` in `app/main.py` unchanged as a route-level safety check.

- [ ] **Step 4: Run the focused backend tests**

Run: `rtk pytest tests/test_provider_clients.py::test_itad_history_requests_steam_points_before_weekly_compaction tests/test_price_history_normalization.py tests/integration/backend/test_catalog_prices_api.py -q`

Expected: PASS.

- [ ] **Step 5: Commit the backend fix**

```powershell
rtk git add app/prices.py tests/test_provider_clients.py
rtk git commit -m "fix: retain Steam price history points"
```

### Task 2: Render a readable interactive Steam price chart

**Files:**
- Modify: `web/src/components/PriceHistoryChart.tsx`
- Test: `web/src/components/PriceHistoryChart.test.tsx`

**Interfaces:**
- Consumes: unchanged `PriceHistoryChart` props and `PriceHistoryPoint` values.
- Produces: the existing sale/regular paths plus SVG grid labels and an active vertical guide; mouse, touch, and keyboard show the existing tooltip.

- [ ] **Step 1: Write the failing tests**

Add two tests after the existing pointer test:

```tsx
it("shows labelled price grid lines", () => {
  render(<PriceHistoryChart currency="USD" points={[
    { date: "2026-08-01T00:00:00Z", price: 9.99 },
    { date: "2026-09-01T00:00:00Z", price: 19.99 },
  ]} />);

  expect(screen.getByLabelText("Price scale")).toHaveTextContent("$9.99");
  expect(screen.getByLabelText("Price scale")).toHaveTextContent("$19.99");
});

it("draws a vertical guide for the active observation", () => {
  render(<PriceHistoryChart currency="USD" points={[
    { date: "2026-08-01T00:00:00Z", price: 9.99 },
    { date: "2026-09-01T00:00:00Z", price: 19.99 },
  ]} />);

  fireEvent.focus(screen.getByRole("button", { name: /1 Aug.*sale/i }));

  expect(screen.getByLabelText("Selected price date")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web; rtk npm.cmd test -- PriceHistoryChart.test.tsx`

Expected: FAIL because the price scale and selected-date guide are absent.

- [ ] **Step 3: Write the minimal chart implementation**

In `PriceHistoryChart.tsx`, reserve left space for labels and create three evenly-spaced horizontal guide values (`min`, midpoint, `max`). Render them as a group with `aria-label="Price scale"` and formatted prices. When `activeCoordinate` exists, render a non-interactive vertical SVG `<line aria-label="Selected price date" ... />` from the plot top to bottom before the active marker. Keep the current stepped paths, tooltip positioning, pointer calculation, and accessible point buttons.

- [ ] **Step 4: Run the focused frontend tests**

Run: `cd web; rtk npm.cmd test -- PriceHistoryChart.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the chart improvement**

```powershell
rtk git add web/src/components/PriceHistoryChart.tsx web/src/components/PriceHistoryChart.test.tsx
rtk git commit -m "feat: improve Steam price history chart"
```

### Task 3: Verify the narrow change end-to-end

**Files:**
- Verify only: `app/prices.py`, `web/src/components/PriceHistoryChart.tsx`, and their tests.

**Interfaces:**
- Consumes: completed Tasks 1-2.
- Produces: verification evidence that no price-history regression is introduced.

- [ ] **Step 1: Run backend price-history suites**

Run: `rtk pytest tests/test_price_history_normalization.py tests/test_provider_clients.py tests/integration/backend/test_catalog_prices_api.py -q`

Expected: PASS.

- [ ] **Step 2: Run frontend price-history suites**

Run: `cd web; rtk npm.cmd test -- PriceHistoryChart.test.tsx ../src/routes/-games.detail.test.tsx`

Expected: PASS.

- [ ] **Step 3: Inspect the final diff and working tree**

Run: `rtk git diff origin/main...HEAD --check; rtk git status --short`

Expected: no whitespace errors and a clean working tree after commits.

- [ ] **Step 4: Commit any verification-only correction**

If verification required a correction, commit only the changed price-history files:

```powershell
rtk git add app/prices.py tests/test_provider_clients.py web/src/components/PriceHistoryChart.tsx web/src/components/PriceHistoryChart.test.tsx
rtk git commit -m "test: verify Steam price history flow"
```
