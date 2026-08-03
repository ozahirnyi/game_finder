# Steam Identity Wishlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve Steam app identity through detail pages and wishlist saves, and render trustworthy Steam metadata and price-history states.

**Architecture:** Add provider identity fields to wishlist records and migrate legacy catalog rows. Fetch Steam detail directly by app ID, save Steam wishlists through a source-specific endpoint, and make the frontend route/link/render from that identity rather than from a title-derived RAWG ID.

**Tech Stack:** FastAPI, SQLAlchemy/Alembic, httpx, Pydantic, React, TanStack Router/Query, Vitest, pytest.

## Global Constraints

- Steam app IDs are authoritative for Steam routes; title search must not select a catalog game.
- Existing catalog wishlist rows remain readable and unique after migration.
- Current Steam price is not a synthetic history point.
- Use `apply_patch` for edits, `rtk` for commands, and commit only task-scoped files.

---

### Task 1: Persist provider identities for wishlist items

**Files:**
- Modify: `app/database.py`, `app/schemas.py`, `app/main.py`
- Create: `alembic/versions/<revision>_wishlist_provider_identity.py`
- Test: `tests/integration/backend/test_collections_price_alerts_api.py`

**Interfaces:**
- Produces `WishlistItem.source: str` and `WishlistItem.external_id: str`.
- Produces `POST /wishlist/steam-games/{appid}` returning `CatalogCollectionRead` with `source="steam"` and `external_id="<appid>"`.

- [ ] **Step 1: Write the failing API test**

```python
created = api_client.post("/wishlist/steam-games/1091500")
assert created.status_code == 201
assert created.json()["source"] == "steam"
assert created.json()["external_id"] == "1091500"
assert api_client.post("/wishlist/steam-games/1091500").status_code == 200
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk pytest -q tests/integration/backend/test_collections_price_alerts_api.py -k steam`

Expected: FAIL because the endpoint does not exist.

- [ ] **Step 3: Implement the migration, model, response fields, and endpoint**

```python
item = WishlistItem(
    user_id=current_user.id,
    catalog_game_id=appid,
    source="steam",
    external_id=str(appid),
    title=detail["name"],
    cover_url=detail.get("background_image"),
)
```

The migration backfills legacy rows as `source="catalog"`, `external_id="rawg:" + catalog_game_id`, then replaces the unique key with `(user_id, source, external_id)`.

- [ ] **Step 4: Run the focused backend tests**

Run: `rtk pytest -q tests/integration/backend/test_collections_price_alerts_api.py tests/test_api_contracts.py -k "wishlist or collection"`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
feat: preserve wishlist provider identities
```

### Task 2: Fetch Steam details directly by app ID

**Files:**
- Modify: `app/steam_store.py`, `app/schemas.py`, `app/main.py`
- Test: `tests/test_provider_clients.py`, `tests/test_api_contracts.py`

**Interfaces:**
- Produces `GET /steam/games/{appid}` with direct Steam app-details data including `released` and `rating`.

- [ ] **Step 1: Write the failing tests**

```python
detail = await fetch_steam_store_game_detail(1091500)
assert detail["appid"] == 1091500
assert detail["released"] == "2020-12-10"
assert detail["rating"] == 86
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk pytest -q tests/test_provider_clients.py -k steam_store_game_detail`

Expected: FAIL because the direct function is absent.

- [ ] **Step 3: Implement the direct request**

```python
response = await client.get(
    f"{STEAM_STORE_BASE_URL}/api/appdetails",
    params={"appids": appid, "cc": country, "l": "english"},
)
```

Map `release_date.date` and `metacritic.score` into the response. Do not call `fetch_steam_store_search`.

- [ ] **Step 4: Run the provider and API tests**

Run: `rtk pytest -q tests/test_provider_clients.py tests/test_api_contracts.py -k steam`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
feat: load Steam detail by app id
```

### Task 3: Render Steam detail and price-history states correctly

**Files:**
- Modify: `web/src/lib/api.ts`, `web/src/routes/games.$gameId.tsx`
- Test: `web/src/routes/-games.$gameId.test.ts`, `web/src/routes/-games.$gameId.actions.test.tsx`

**Interfaces:**
- Consumes `getSteamGame(appid)` and `addSteamWishlist(appid)`.
- Produces a Steam route with wishlist action and direct metadata.

- [ ] **Step 1: Write the failing frontend tests**

```tsx
expect(await screen.findByRole("button", { name: "Add to wishlist" })).toBeInTheDocument();
expect(screen.getByText("No price history is available yet.")).toBeInTheDocument();
```

Also assert that a single history point renders its date and no SVG sparkline.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `rtk npm test -- --run src/routes/-games.$gameId.test.ts src/routes/-games.$gameId.actions.test.tsx`

Expected: FAIL because Steam routes suppress wishlist and the graph is always rendered.

- [ ] **Step 3: Implement minimal route changes**

```tsx
const hasHistory = priceHistory.length > 0;
const canChartHistory = priceHistory.length > 1;
```

Steam routes call the direct app-ID API and use the Steam wishlist mutation. Wishlist links retain `source=steam` and `title` for Steam rows.

- [ ] **Step 4: Run frontend tests and build**

Run: `rtk npm test` then `rtk npm run build`

Expected: PASS and successful production build.

- [ ] **Step 5: Commit**

```text
fix: support Steam wishlist details
```

### Task 4: Verify and release

**Files:**
- Modify only task files from Tasks 1–3.

- [ ] **Step 1: Run backend regression checks**

Run: `rtk pytest -q tests/test_provider_clients.py tests/test_api_contracts.py tests/integration/backend/test_collections_price_alerts_api.py`

Expected: PASS.

- [ ] **Step 2: Run frontend regression checks**

Run: `rtk npm test` and `rtk npm run build`

Expected: PASS.

- [ ] **Step 3: Commit and publish**

```text
git push -u origin codex/steam-identity-wishlist
gh pr create --base main --head codex/steam-identity-wishlist
```
