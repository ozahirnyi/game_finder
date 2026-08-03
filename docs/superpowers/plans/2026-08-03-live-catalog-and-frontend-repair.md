# Live Catalog and Frontend Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace prototype catalog routes with API-backed wishlist and detail flows, return and render ITAD price timelines, and restore the TanStack/Vite frontend tests.

**Architecture:** The API keeps the existing saved-game table and uses `external_id="rawg:<id>"` for deterministic new wishlist links. The backend normalizes ITAD's history endpoint into the current price response. TanStack route components render the existing API-backed screens; tests use real router context and assert only current component contracts.

**Tech Stack:** FastAPI, SQLAlchemy, httpx, React 19, TanStack Router, Vite, Vitest, Testing Library.

## Global Constraints

- Do not add Next.js or return active routes to `mockData`.
- Keep legacy wishlist rows (the `wishlist` notes marker) readable.
- Use `rawg:`-prefixed IDs for new manual wishlist entries.
- Use TDD: run each new regression test red before production changes.

---

### Task 1: Return normalized ITAD price timeline

**Files:**
- Modify: `app/prices.py`
- Modify: `app/schemas.py`
- Modify: `tests/test_api_contracts.py`

**Interfaces:**
- Produces `GamePriceHistory.history: list[PriceHistoryPoint]`, where every point has `timestamp`, `shop`, `price`, and `regular`.

- [ ] **Step 1: Write a failing API contract test**

Add a fake ITAD result with one `history` item and assert the `/prices/games/{id}` JSON includes it:

```python
assert payload["history"] == [{
    "timestamp": "2026-07-01T12:00:00+00:00",
    "shop": "Steam",
    "price": {"amount": 19.99, "currency": "USD"},
    "regular": {"amount": 39.99, "currency": "USD"},
}]
```

- [ ] **Step 2: Run the focused test red**

Run: `rtk pytest -q tests/test_api_contracts.py -k price_history`

Expected: failure because `history` is absent.

- [ ] **Step 3: Add the minimal schema and ITAD request**

```python
class PriceHistoryPoint(BaseModel):
    timestamp: str | None = None
    shop: str | None = None
    price: PriceMoney | None = None
    regular: PriceMoney | None = None

class GamePriceHistory(BaseModel):
    # existing fields
    history: list[PriceHistoryPoint] = Field(default_factory=list)
```

In `fetch_game_price_history`, request `GET /games/history/v2` with `id=game_id` and `country`; normalize each item from `item["deal"]` with `_deal`, and include it as `history`.

- [ ] **Step 4: Run the focused test green**

Run: `rtk pytest -q tests/test_api_contracts.py -k price_history`

Expected: pass.

### Task 2: Make live details and wishlist complete

**Files:**
- Modify: `app/schemas.py`
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/features/discovery/GameDetailScreen.tsx`
- Modify: `web/src/features/library/WishlistScreen.tsx`
- Modify: `web/src/features/discovery/discovery.test.tsx`
- Modify: `web/src/features/library/library.test.tsx`

**Interfaces:**
- `GameCreate.external_id: str | None` accepts a 64-character catalog reference.
- `createSavedGame(title, info, notes, externalId)` sends `external_id`.
- `GameDetailScreen` creates `notes="wishlist"`, `external_id="rawg:<gameId>"`.
- Wishlist cards link to `/games/<rawg id>` or `/search?q=<title>` for legacy rows.

- [ ] **Step 1: Write failing UI tests**

Add assertions for the rating, release date, history timestamp/price, `Add to wishlist` request, and both wishlist link forms:

```tsx
expect(await screen.findByText("Rating: 4.5 / 5")).toBeInTheDocument();
expect(screen.getByText("2025-01-10")).toBeInTheDocument();
expect(screen.getByText("Steam · 19.99 USD")).toBeInTheDocument();
expect(screen.getByRole("link", { name: "Open Hades II" })).toHaveAttribute("href", "/games/1");
expect(screen.getByRole("link", { name: "Find Legacy game" })).toHaveAttribute("href", "/search?q=Legacy%20game");
```

- [ ] **Step 2: Run the focused tests red**

Run: `rtk npm test -- src/features/discovery/discovery.test.tsx src/features/library/library.test.tsx`

Expected: failures for the missing controls and history.

- [ ] **Step 3: Implement the smallest live UI changes**

```tsx
<p>{game.data.released ?? "Release date unknown"}</p>
<p>{game.data.rating == null ? "Rating unavailable" : `Rating: ${game.data.rating} / 5`}</p>
<button onClick={addToWishlist}>Add to wishlist</button>
{price.data.history.map((point) => <li key={`${point.timestamp}-${point.shop}`}>{`${point.timestamp} · ${point.shop} · ${point.price?.amount} ${point.price?.currency}`}</li>)}
```

Add `external_id: Optional[str] = Field(default=None, max_length=64)` to `GameCreate`. Parse `rawg:` in `external_id`; use a TanStack `Link` to the numeric route if present, otherwise link to `/search` with the title search parameter. Extend `SavedGame` and `createSavedGame` to carry `external_id`.

- [ ] **Step 4: Run the focused tests green**

Run: `rtk npm test -- src/features/discovery/discovery.test.tsx src/features/library/library.test.tsx`

Expected: pass.

### Task 3: Replace active mock routes and repair test infrastructure

**Files:**
- Modify: `web/src/routes/wishlist.tsx`
- Modify: `web/src/routes/games.$gameId.tsx`
- Modify: `web/src/routes/index.tsx`
- Modify: `web/src/test/setup.ts`
- Modify: `web/src/components/AppShell.test.tsx`
- Modify: `web/src/components/ui.test.tsx`
- Modify: `web/src/features/auth/auth.test.tsx`
- Modify: `web/src/features/library/SavedGameDetailScreen.tsx`
- Modify: `web/src/app/destination-placeholders.test.tsx`
- Modify: `web/src/test/routes.integration.test.ts`

**Interfaces:**
- Active detail and wishlist routes mount `GameDetailScreen` and `WishlistScreen` inside `AppShell`.
- Router-aware tests use a memory router and `RouterProvider`.

- [ ] **Step 1: Update failing route and component tests**

Replace obsolete Next mocks with a helper that renders a real memory router. Replace the obsolete image assertion with the current cover contract:

```tsx
render(<GameCover title="Hades II" from="#111111" to="#222222" />);
expect(screen.getByText("Hades II")).toBeInTheDocument();
```

Update active-route assertions to reject `mockData` after the routes are changed.

- [ ] **Step 2: Run frontend tests red**

Run: `rtk npm test`

Expected: remaining failures identify each active mock route or invalid Next import.

- [ ] **Step 3: Replace the route implementations and stale imports**

```tsx
export const Route = createFileRoute("/wishlist")({ component: WishlistRoute });
function WishlistRoute() { return <AppShell><WishlistScreen /></AppShell>; }
```

Use the same pattern for `/games/$gameId`, passing `Route.useParams().gameId`. Remove `next/link` imports in API-backed screens in favor of `@tanstack/react-router` links. Replace the prototype home route with the existing live discovery screen or a live route composition, so no active route imports `mockData`.

- [ ] **Step 4: Run frontend tests green and build**

Run: `rtk npm test`

Run: `rtk npm run build`

Expected: both exit 0.

### Task 4: Final verification and delivery

**Files:**
- Modify: only files changed by Tasks 1–3.

- [ ] **Step 1: Run full verification**

Run: `rtk pytest -q`

Run: `rtk npm test`

Run: `rtk npm run build`

- [ ] **Step 2: Inspect the focused diff**

Run: `rtk diff -- app/prices.py app/schemas.py tests/test_api_contracts.py web/src/lib/api.ts web/src/features/discovery/GameDetailScreen.tsx web/src/features/library/WishlistScreen.tsx web/src/routes/wishlist.tsx web/src/routes/games.$gameId.tsx`

- [ ] **Step 3: Commit and publish**

Run: `rtk git add app/prices.py app/schemas.py tests/test_api_contracts.py web/src/lib/api.ts web/src/features/discovery/GameDetailScreen.tsx web/src/features/library/WishlistScreen.tsx web/src/routes/wishlist.tsx web/src/routes/games.$gameId.tsx web/src/routes/index.tsx web/src/test/setup.ts web/src/components/AppShell.test.tsx web/src/components/ui.test.tsx web/src/features/auth/auth.test.tsx web/src/features/library/SavedGameDetailScreen.tsx web/src/app/destination-placeholders.test.tsx web/src/test/routes.integration.test.ts`

Run: `rtk git commit -m "fix: restore live catalog and wishlist flows"`

Run: `rtk git push -u origin codex/wishlist-game-details`

Create a pull request for review.
