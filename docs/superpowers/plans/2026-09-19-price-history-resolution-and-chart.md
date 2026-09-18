# Price History Resolution and Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve Steam history through the Steam edition found by title and make the history chart time-accurate, whole-plot interactive, and edge-safe.

**Architecture:** The catalog price-history fallback will use the successful Steam lookup's canonical title and `appid` when asking ITAD for Steam-only history. The chart will derive a compact display series from normalized history, map its X positions to timestamps, and select a stepped interval from the pointer's X coordinate.

**Tech Stack:** FastAPI, Python/pytest, React, TypeScript, Vitest, Testing Library, SVG, Tailwind CSS.

## Global Constraints

- Current price and Steam link remain authoritative from Steam in the selected user region.
- ITAD remains history-only and contributes only Steam shop observations.
- Never convert a history price or relabel its source currency.
- Tooltip interaction is limited to the graph plot, not the rest of the card.
- Use TDD: observe each new test fail before production code changes.

---

### Task 1: Resolve title-fallback history through the selected Steam edition

**Files:**
- Modify: `app/main.py:4017-4056`
- Test: `tests/integration/backend/test_catalog_prices_api.py`

**Interfaces:**
- Consumes: `fetch_steam_store_game_price(title, country)` returning `{appid: int, title: str, ...}`.
- Produces: `_fetch_price_history_for_period(title, country, period, steam_appid)` called with the resolved Steam title and positive `appid`.

- [ ] **Step 1: Write the failing API test**

```python
def test_catalog_title_fallback_uses_resolved_steam_edition_for_history(
    api_client, app_main, monkeypatch
):
    monkeypatch.setattr(
        app_main, "fetch_igdb_game_detail",
        AsyncMock(return_value={"name": "The Witcher 3: Wild Hunt", "steam_appid": None}),
    )
    monkeypatch.setattr(
        app_main, "fetch_steam_store_game_price",
        AsyncMock(return_value={
            "appid": 292030,
            "title": "The Witcher 3: Wild Hunt - Complete Edition",
            "current": {"shop": "Steam", "price": {"amount": 1349, "currency": "UAH"}},
            "is_free": False,
            "url": "https://store.steampowered.com/app/292030/",
        }),
    )
    history = AsyncMock(return_value={"history": [{
        "timestamp": "2026-09-01T00:00:00Z", "shop": "Steam",
        "price": {"amount": 14.99, "currency": "USD"},
    }]})
    monkeypatch.setattr(app_main, "fetch_game_price_history", history)
    monkeypatch.setattr(app_main, "get_json_cached", AsyncMock(side_effect=run_cached))

    response = api_client.get("/prices/games/1942", params={"country": "UA"})

    assert response.status_code == 200
    assert response.json()["current"]["price"] == {"amount": 1349.0, "currency": "UAH"}
    assert response.json()["history"][0]["price"] == {"amount": 14.99, "currency": "USD"}
    history.assert_awaited_once_with(
        "The Witcher 3: Wild Hunt - Complete Edition",
        country="UA", steam_appid=292030,
    )
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk pytest tests/integration/backend/test_catalog_prices_api.py::test_catalog_title_fallback_uses_resolved_steam_edition_for_history -q`

Expected: FAIL because history is requested with the original IGDB title and no Steam app ID.

- [ ] **Step 3: Pass the resolved Steam identity to history**

```python
resolved_steam_appid = steam_price.get("appid")
resolved_steam_title = str(steam_price.get("title") or title).strip()
history = await _fetch_price_history_for_period(
    resolved_steam_title,
    normalized_country,
    period,
    resolved_steam_appid if isinstance(resolved_steam_appid, int) and resolved_steam_appid > 0 else None,
)
```

Place this after the successful `fetch_steam_store_game_price` call in `fetch_title_price`, before `_merge_platform_price_history`.

- [ ] **Step 4: Run the API test to verify it passes**

Run: `rtk pytest tests/integration/backend/test_catalog_prices_api.py::test_catalog_title_fallback_uses_resolved_steam_edition_for_history -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add app/main.py tests/integration/backend/test_catalog_prices_api.py
rtk git commit -m "fix: resolve history through selected Steam edition"
```

### Task 2: Normalize and position chart states by time

**Files:**
- Modify: `web/src/lib/gamePresentation.ts:55-89`
- Test: `web/src/lib/gamePresentation.test.ts`

**Interfaces:**
- Consumes: `PriceHistoryApiPoint[]` and current price data.
- Produces: `presentPriceHistory(...).points`, ordered by ISO timestamp with consecutive equal `{price, regular, cut, currency}` states collapsed.

- [ ] **Step 1: Write the failing normalization test**

```ts
it("collapses consecutive identical price states while keeping a later change", () => {
  expect(presentPriceHistory([
    point("2026-01-01T00:00:00Z", 29.99, 29.99, 0),
    point("2026-01-08T00:00:00Z", 29.99, 29.99, 0),
    point("2026-01-15T00:00:00Z", 14.99, 29.99, 50),
  ]).points).toMatchObject([
    { date: "2026-01-01T00:00:00Z", price: 29.99 },
    { date: "2026-01-15T00:00:00Z", price: 14.99, cut: 50 },
  ]);
});
```

Define `point(timestamp, amount, regular, cut)` in the test file to return one valid `PriceHistoryApiPoint` using USD for both money values.

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk npm.cmd test -- --root "Z:\Dev\PycharmProjects\game_finder.worktrees\origin-main-guard\web" --run src/lib/gamePresentation.test.ts`

Expected: FAIL because both unchanged observations are currently returned.

- [ ] **Step 3: Collapse consecutive equal display states**

```ts
const compactPoints = points.filter((point, index) => {
  const previous = points[index - 1];
  return !previous || point.price !== previous.price || point.regular !== previous.regular ||
    point.cut !== previous.cut || point.currency !== previous.currency;
});
```

Return `compactPoints` from `presentPriceHistory`, and derive labels, low, and `isCurrentOnly` from it.

- [ ] **Step 4: Run the normalization test to verify it passes**

Run: `rtk npm.cmd test -- --root "Z:\Dev\PycharmProjects\game_finder.worktrees\origin-main-guard\web" --run src/lib/gamePresentation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/lib/gamePresentation.ts web/src/lib/gamePresentation.test.ts
rtk git commit -m "fix: collapse unchanged price history states"
```

### Task 3: Select the stepped line from any pointer position and keep the tooltip visible

**Files:**
- Modify: `web/src/components/PriceHistoryChart.tsx`
- Test: `web/src/components/PriceHistoryChart.test.tsx`

**Interfaces:**
- Consumes: compact `PriceHistoryPoint[]` with ISO `date` values.
- Produces: timestamp-proportional coordinates and an active index chosen from an SVG pointer X coordinate or keyboard focus.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it("selects the active stepped price when the pointer moves between observations", () => {
  render(<PriceHistoryChart currency="USD" points={twoDatedPoints} />);
  const chart = screen.getByLabelText("Price history chart");
  vi.spyOn(chart, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 320, 88),
  );

  fireEvent.pointerMove(chart, { clientX: 120, clientY: 40 });

  expect(screen.getByRole("tooltip")).toHaveTextContent(/1 Aug.*Sale price: \$19\.99/i);
});

it("keeps an edge tooltip inside the plot", () => {
  render(<PriceHistoryChart currency="USD" points={twoDatedPoints} />);
  fireEvent.focus(screen.getByRole("button", { name: /1 Aug.*sale/i }));

  expect(screen.getByRole("tooltip")).toHaveStyle({ left: "0%", transform: "translate(0, -115%)" });
});
```

- [ ] **Step 2: Run the component tests to verify they fail**

Run: `rtk npm.cmd test -- --root "Z:\Dev\PycharmProjects\game_finder.worktrees\origin-main-guard\web" --run src/components/PriceHistoryChart.test.tsx`

Expected: FAIL because the SVG does not handle pointer movement and all tooltip positions use `translate(-50%, -115%)`.

- [ ] **Step 3: Add timestamp-based coordinate and pointer helpers**

```ts
const timestamps = points.map((point) => Date.parse(point.date));
const firstTimestamp = timestamps[0];
const span = Math.max(timestamps.at(-1)! - firstTimestamp, 1);
const xFor = (index: number) => points.length === 1
  ? width / 2
  : ((timestamps[index] - firstTimestamp) / span) * width;
const activeIndexForX = (x: number) => coordinates.reduce(
  (active, point, index) => point.x <= x ? index : active,
  0,
);
```

Attach `onPointerMove` and `onPointerLeave` to the SVG. Convert `clientX` through `getBoundingClientRect()` into the viewBox X coordinate and call `setActiveIndex(activeIndexForX(x))`. Keep transparent focusable point targets for keyboard users, but render only the active marker.

- [ ] **Step 4: Clamp tooltip placement at plot edges**

```ts
const tooltipStyle = activeCoordinate.x <= width * 0.15
  ? { left: "0%", transform: "translate(0, -115%)" }
  : activeCoordinate.x >= width * 0.85
    ? { left: "100%", transform: "translate(-100%, -115%)" }
    : { left: `${(activeCoordinate.x / width) * 100}%`, transform: "translate(-50%, -115%)" };
```

Use `tooltipStyle` with the existing vertical percentage. Preserve `pointer-events-none` so movement over the tooltip does not clear the active graph state.

- [ ] **Step 5: Run the component tests to verify they pass**

Run: `rtk npm.cmd test -- --root "Z:\Dev\PycharmProjects\game_finder.worktrees\origin-main-guard\web" --run src/components/PriceHistoryChart.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
rtk git add web/src/components/PriceHistoryChart.tsx web/src/components/PriceHistoryChart.test.tsx
rtk git commit -m "fix: make price chart hover and tooltip reliable"
```

### Task 4: Verify cross-layer behaviour

**Files:**
- Modify: none
- Test: `tests/integration/backend/test_catalog_prices_api.py`, `web/src/lib/gamePresentation.test.ts`, `web/src/components/PriceHistoryChart.test.tsx`, `web/src/routes/-games.detail.test.tsx`

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: evidence that the resolved Steam edition, USD source history, period selection, and graph interaction coexist.

- [ ] **Step 1: Run targeted verification**

Run: `rtk pytest tests/integration/backend/test_catalog_prices_api.py -q`

Expected: PASS.

Run: `rtk npm.cmd test -- --root "Z:\Dev\PycharmProjects\game_finder.worktrees\origin-main-guard\web" --run src/lib/gamePresentation.test.ts src/components/PriceHistoryChart.test.tsx src/routes/-games.detail.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run full verification and production build**

Run: `rtk pytest -q`

Expected: PASS.

Run: `rtk npm.cmd test -- --root "Z:\Dev\PycharmProjects\game_finder.worktrees\origin-main-guard\web"`

Expected: PASS.

Run: `rtk npm.cmd run build`

Expected: `built` output and exit code 0.

- [ ] **Step 3: Inspect the final diff and commit**

Run: `rtk git diff --check`

Expected: no output.

```powershell
rtk git status --short
rtk git add app/main.py tests/integration/backend/test_catalog_prices_api.py web/src/lib/gamePresentation.ts web/src/lib/gamePresentation.test.ts web/src/components/PriceHistoryChart.tsx web/src/components/PriceHistoryChart.test.tsx
rtk git commit -m "fix: stabilize Steam price history display"
```
