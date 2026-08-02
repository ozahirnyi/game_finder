# Unified Game Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send every search and price-drop card to the existing internal game-detail page, including Steam-only games.

**Architecture:** `GameCard` receives an optional `source` marker and encodes it in the existing game-route search parameters. Steam fallback search and unmatched Steam deals use their Steam app id as `gameId` and `source="steam"`; the existing route loader then renders the same detail page and provides the external Steam action there. Steam search uses a header asset rather than a tiny capsule.

**Tech Stack:** FastAPI, httpx, React, TanStack Router, Vitest, pytest.

## Global Constraints

- Keep `/games/:gameId` as the only game-detail route.
- Do not alter database schema or account behavior.
- Preserve RAWG-backed game links and external Steam links on the detail page.

---

### Task 1: Return a usable Steam search cover

**Files:**
- Modify: `app/steam_store.py:14-24`
- Test: `tests/test_api_contracts.py`

**Interfaces:**
- Produces `fetch_steam_store_search()` items whose `background_image` is `https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg`.

- [ ] **Step 1: Write the failing test**

```python
async def test_steam_search_uses_header_cover(monkeypatch):
    # mock Steam's search response with id 1145360 and name Hades
    result = await fetch_steam_store_search("hades")
    assert result[0]["background_image"] == (
        "https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/header.jpg"
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk pytest -q tests/test_api_contracts.py -k steam_search_uses_header_cover`

Expected: FAIL because the current implementation returns Steam's `tiny_image`.

- [ ] **Step 3: Write minimal implementation**

```python
"background_image": f"https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk pytest -q tests/test_api_contracts.py -k steam_search_uses_header_cover`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add app/steam_store.py tests/test_api_contracts.py
rtk git commit -m "fix: use Steam header art for search results"
```

### Task 2: Preserve the source on canonical game cards

**Files:**
- Modify: `web/src/components/GameCard.tsx:5-79`
- Test: `web/src/components/GameCard.test.tsx`

**Interfaces:**
- Consumes `GameCardData.source?: "steam"`.
- Produces an internal `Link` to `/games/$gameId` with `search={{ title, source }}` when the game is a Steam item.

- [ ] **Step 1: Write the failing test**

```tsx
it("links a Steam game to the internal detail route", async () => {
  // render with gameId: "1145360", source: "steam"
  expect(await screen.findByRole("link", { name: /hades/i })).toHaveAttribute(
    "href", "/games/1145360?title=Hades&source=steam",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- --run web/src/components/GameCard.test.tsx`

Expected: FAIL because `GameCardData` has no `source` and its link omits the query parameter.

- [ ] **Step 3: Write minimal implementation**

```tsx
source?: "steam";
// ...
search={{ title: game.title, ...(game.source ? { source: game.source } : {}) }}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- --run web/src/components/GameCard.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add web/src/components/GameCard.tsx web/src/components/GameCard.test.tsx
rtk git commit -m "fix: preserve Steam source in game links"
```

### Task 3: Route every search and price-drop card internally

**Files:**
- Modify: `web/src/routes/search.tsx:79-96`
- Modify: `web/src/routes/index.tsx:117-140,226-277`
- Test: `web/src/routes/search.test.tsx` or the existing route test file

**Interfaces:**
- Steam search result: `gameId: String(game.steam_appid)`, `source: "steam"`.
- Unmatched price deal: `gameId: String(deal.steam_appid)`, `source: "steam"`.

- [ ] **Step 1: Write the failing tests**

```tsx
expect(screen.getByRole("link", { name: /hades/i })).toHaveAttribute(
  "href", "/games/1145360?title=Hades&source=steam",
);
expect(screen.queryByRole("link", { name: /steam/i })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npm test -- --run web/src/components/GameCard.test.tsx web/src/routes/search.test.tsx`

Expected: FAIL because search and unmatched deals provide `externalUrl` instead of a Steam-backed internal identity.

- [ ] **Step 3: Write minimal implementation**

```tsx
gameId: game.id == null ? String(game.steam_appid) : String(game.id),
source: game.source === "steam" ? "steam" : undefined,
// and the equivalent fields for deal.steam_appid
```

For the featured deal, replace the external `<a>` branch with the corresponding internal `Link` when `steam_appid` exists.

- [ ] **Step 4: Run tests and production build**

Run: `rtk npm test -- --run web/src/components/GameCard.test.tsx web/src/routes/search.test.tsx`

Expected: PASS.

Run: `rtk npm run build`

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
rtk git add web/src/routes/search.tsx web/src/routes/index.tsx web/src/routes/search.test.tsx
rtk git commit -m "fix: route Steam cards to game details"
```

### Task 4: Verify and publish

**Files:**
- Verify: `tests/test_api_contracts.py`, `web/src/components/GameCard.test.tsx`, `web/src/routes/search.test.tsx`

- [ ] **Step 1: Run backend regression tests**

Run: `rtk pytest -q tests/test_api_contracts.py`

Expected: PASS.

- [ ] **Step 2: Run frontend tests and build**

Run: `rtk npm test -- --run web/src/components/GameCard.test.tsx web/src/routes/search.test.tsx && rtk npm run build`

Expected: exit code 0.

- [ ] **Step 3: Commit and publish the branch**

```bash
rtk git push -u origin codex/unified-game-details-live
rtk gh pr create --draft --base main --head codex/unified-game-details-live --title "fix: route Steam cards to game details"
```
