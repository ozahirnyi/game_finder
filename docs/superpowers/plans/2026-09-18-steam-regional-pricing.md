# Steam Regional Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Steam the authoritative current-price and alert provider for every selected profile region, while exposing only Steam-store ITAD events as price history.

**Architecture:** Keep the existing Steam detail/title-lookup responses as the outer price payload. Filter ITAD data at the `app.main` merge boundary so its current deal, URLs, all-store lows, and non-Steam events cannot leak into a game page. Refactor alert lookups to Steam and use the stored profile price region.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, httpx, pytest, React, TanStack Query, Vitest.

## Global Constraints

- Use `User.price_country_code` as the canonical alert and current-price region.
- Do not convert currencies or infer them from the selected country; render Steam and ITAD values in their supplied currency.
- ITAD may provide only history points whose `shop` case-insensitively equals `Steam`.
- ITAD must never supply a current price, purchase link, or alert.
- Mock all external provider calls in tests.

---

### Task 1: Make game-detail pricing Steam-authoritative and history Steam-only

**Files:**
- Modify: `app/main.py:3945-4050`
- Modify: `tests/integration/backend/test_catalog_prices_api.py`

**Interfaces:**
- Consumes: `fetch_steam_store_game_detail(appid, country)`, `fetch_steam_store_game_price(title, country, exact_title_only=True)`, and `fetch_game_price_history(title, country, steam_appid=None)`.
- Produces: `GamePriceHistory` whose `current`, `url`, `is_free`, and deal fields derive only from Steam; `history` contains only ITAD points with `shop == "Steam"`.

- [ ] **Step 1: Write failing API contract tests**

```python
def test_catalog_price_history_uses_a_non_ua_steam_price_and_filters_non_steam_itad_points(...):
    # Mock the user preference as PL and Steam as PLN.
    # Mock ITAD history with Steam/USD, Humble/USD, and Steam/EUR points.
    response = api_client.get("/prices/games/42", headers=auth_header)
    assert response.json()["current"]["price"] == {"amount": 79.99, "currency": "PLN"}
    assert response.json()["url"] == "https://store.steampowered.com/app/42/"
    assert response.json()["history"] == [steam_usd_point, steam_eur_point]
    assert response.json()["history_low_all"] is None

def test_catalog_price_does_not_use_itad_current_when_exact_steam_lookup_fails(...):
    # ITAD still supplies a Humble current deal and Steam history.
    response = api_client.get("/prices/games/42", params={"country": "DE"})
    assert response.json()["current"] is None
    assert response.json()["url"] is None
    assert response.json()["history"] == [steam_history_point]
```

- [ ] **Step 2: Run the focused backend tests and verify they fail for the intended contract gap**

Run: `rtk pytest tests/integration/backend/test_catalog_prices_api.py -q`

Expected: FAIL because the unfiltered ITAD history or its reseller current deal remains in the response.

- [ ] **Step 3: Implement the narrow merge boundary**

```python
def _merge_platform_price_history(platform_price: dict, history: dict) -> dict:
    steam_history = [
        point for point in history.get("history") or []
        if str(point.get("shop") or "").strip().casefold() == "steam"
    ]
    return {
        **platform_price,
        "history_low_all": None,
        "history_low_1y": None,
        "history_low_3m": None,
        "deals": [],
        "history": steam_history,
    }
```

For the no-`steam_appid` path, continue fetching ITAD only to obtain filtered history, but construct a no-current/no-URL response when exact Steam lookup raises `HTTPException`; do not return `_strip_itad_reseller_urls(history)` as the primary payload.

- [ ] **Step 4: Run the focused backend tests and verify they pass**

Run: `rtk pytest tests/integration/backend/test_catalog_prices_api.py -q`

Expected: PASS, including existing Steam regional-current-price coverage.

- [ ] **Step 5: Commit the backend contract change**

```bash
rtk git add app/main.py tests/integration/backend/test_catalog_prices_api.py
rtk git commit -m "fix: keep regional prices on Steam"
```

### Task 2: Source every price alert from Steam and the selected profile region

**Files:**
- Modify: `app/price_alerts.py`
- Modify: `tests/test_price_alert_runner.py`
- Modify: `tests/integration/backend/test_collections_price_alerts_api.py`

**Interfaces:**
- Consumes: `fetch_steam_store_game_price(title, country, exact_title_only=True)`, `fetch_steam_store_game_detail(appid, country)`, `User.price_country_code`, and Steam wishlist `external_id` values.
- Produces: alert deal dictionaries in the same `current` shape returned by `app.steam_store`; no alert code imports or calls `fetch_game_price_history`.

- [ ] **Step 1: Write failing alert tests**

```python
def test_telegram_alert_uses_profile_price_region_and_steam_price(monkeypatch):
    user = SimpleNamespace(price_country_code="PL", steam_country_code="US", ...)
    steam_price = AsyncMock(return_value={"current": deal(shop="Steam", price={"amount": 79.99, "currency": "PLN"})})
    monkeypatch.setattr(runner, "fetch_steam_store_game_price", steam_price)
    asyncio.run(runner.check_price_alerts(db))
    steam_price.assert_awaited_once_with("Hades", country="PL", exact_title_only=True)
    assert "79.99 PLN at Steam" in sent_message

def test_persisted_steam_wishlist_alert_uses_saved_app_id(monkeypatch):
    item = SimpleNamespace(source="steam", external_id="1145350", ...)
    monkeypatch.setattr(runner, "fetch_steam_store_game_detail", detail)
    await runner.check_persisted_price_alerts(db, result)
    detail.assert_awaited_once_with(1145350, country="UA")
```

- [ ] **Step 2: Run the focused alert tests and verify they fail**

Run: `rtk pytest tests/test_price_alert_runner.py tests/integration/backend/test_collections_price_alerts_api.py -q`

Expected: FAIL because alert code calls ITAD and prefers `steam_country_code`.

- [ ] **Step 3: Implement a small Steam-alert resolver**

```python
async def fetch_steam_alert_price(title: str, country: str, steam_appid: int | None = None) -> dict[str, Any]:
    if steam_appid is not None:
        return await fetch_steam_store_game_detail(steam_appid, country=country)
    return await fetch_steam_store_game_price(title, country=country, exact_title_only=True)
```

Normalize `user.price_country_code` through `normalize_price_country`. Use the resolver for manual/Telegram and persisted alerts; parse a positive numeric Steam wishlist `external_id` as `steam_appid`. Remove ITAD current/history-low wording from alert messages.

- [ ] **Step 4: Run focused alert tests and verify they pass**

Run: `rtk pytest tests/test_price_alert_runner.py tests/integration/backend/test_collections_price_alerts_api.py -q`

Expected: PASS with calls only to Steam mocks and profile-region currency assertions.

- [ ] **Step 5: Commit the alert change**

```bash
rtk git add app/price_alerts.py tests/test_price_alert_runner.py tests/integration/backend/test_collections_price_alerts_api.py
rtk git commit -m "fix: source price alerts from Steam"
```

### Task 3: Label the remaining history as Steam storefront history

**Files:**
- Modify: `web/src/routes/games.$gameId.tsx:542-570`
- Modify: `web/src/routes/-games.detail.test.tsx`

**Interfaces:**
- Consumes: API history points already filtered by the backend, each carrying its own optional currency.
- Produces: a price-history section title and hint that identify Steam as the only history storefront and state that the source currency is retained.

- [ ] **Step 1: Write a failing route test**

```tsx
it("labels source-currency history as Steam-only", async () => {
  api.getPriceHistory.mockResolvedValue({
    current: { price: { amount: 399, currency: "UAH" } },
    history: [{ timestamp: "2026-09-01T00:00:00Z", shop: "Steam", price: { amount: 9.99, currency: "USD" } }],
  });
  renderDetail();
  expect(await screen.findByRole("heading", { name: "Steam price history" })).toBeInTheDocument();
  expect(screen.getByText(/currency is shown as supplied by Steam history/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused frontend test and verify it fails**

Run: `cd web; rtk npm.cmd test -- src/routes/-games.detail.test.tsx`

Expected: FAIL because the section remains titled `Price history` with the old multi-store hint.

- [ ] **Step 3: Make the minimal presentation update**

```tsx
<SectionHeader
  title="Steam price history"
  hint="Steam historical prices; currency is shown as supplied by Steam history."
/>
```

- [ ] **Step 4: Run the focused frontend test and verify it passes**

Run: `cd web; rtk npm.cmd test -- src/routes/-games.detail.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the frontend copy change**

```bash
rtk git add web/src/routes/games.$gameId.tsx web/src/routes/-games.detail.test.tsx
rtk git commit -m "fix: clarify Steam price history source"
```

### Task 4: Verify the complete contract

**Files:**
- Verify: `app/main.py`, `app/price_alerts.py`, `web/src/routes/games.$gameId.tsx`

**Interfaces:**
- Consumes: the test contracts introduced in Tasks 1–3.
- Produces: evidence that no current price, link, or alert falls back to ITAD and existing pricing behavior remains intact.

- [ ] **Step 1: Run the targeted backend suite**

Run: `rtk pytest tests/integration/backend/test_catalog_prices_api.py tests/test_price_alert_runner.py tests/integration/backend/test_collections_price_alerts_api.py tests/test_price_history_normalization.py tests/test_steam_store.py -q`

Expected: PASS.

- [ ] **Step 2: Run the targeted frontend suite**

Run: `cd web; rtk npm.cmd test -- src/routes/-games.detail.test.tsx src/components/PriceHistoryChart.test.tsx`

Expected: PASS.

- [ ] **Step 3: Run project safety checks**

Run: `rtk git diff --check; rtk git status --short`

Expected: no whitespace errors; only the planned source, test, and documentation files are changed or committed.

- [ ] **Step 4: Commit the implementation plan if it has not already been committed**

```bash
rtk git add docs/superpowers/plans/2026-09-18-steam-regional-pricing.md
rtk git commit -m "docs: plan Steam regional pricing"
```
