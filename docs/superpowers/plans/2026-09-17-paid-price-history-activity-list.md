# Paid price history and active-player list Implementation Plan

> **For the implementing agent:** Execute this plan inline, task by task. The user explicitly forbids subagents and delegation for this work.

**Goal:** Restore paid-game price history, hide it for free games, present whole profile hours, and move recent Steam activity into a ranked avatar list in the game sidebar.

**Architecture:** Keep ITAD resolution in `app/prices.py`, preferring the documented Steam-app lookup and recording safe diagnostics before FastAPI falls back to Steam current price. Keep display policy in frontend presentation helpers and render activity through a small dedicated component consumed by the game route.

**Tech Stack:** FastAPI, httpx, pytest; React, TypeScript, TanStack Query, Vitest, Testing Library, Tailwind.

## Global Constraints

- Create and work only on `codex/paid-price-history-activity-list`; do not edit the dirty shared root.
- Use `rtk` for every shell command; use `apply_patch` for source edits.
- Do not expose ITAD keys or raw provider error bodies in API/UI output or commits.
- No subagents or delegated work.
- Preserve the Steam App ID price and activity request paths.

---

### Task 1: Restore stable ITAD Steam-ID resolution and diagnostic logging

**Files:**
- Modify: `app/prices.py:155-247`
- Modify: `tests/test_provider_clients.py`
- Modify: `tests/test_provider_edge_contracts.py`

**Interfaces:**
- Consumes: `httpx.AsyncClient`, `ITAD_BASE_URL`, `steam_appid: int | None`.
- Produces: `_resolve_itad_game(...) -> tuple[str, str, str | None]`; paid Steam lookups first call `GET /games/lookup/v1` with `{"appid": steam_appid}`.

- [ ] **Step 1: Write failing resolver tests**

```python
async def test_itad_resolves_steam_app_with_documented_lookup():
    client = RecordingClient([
        {"found": True, "game": {"id": "itad-id", "title": "Portal 2", "urls": {"game": "url"}}}
    ])
    assert await prices.resolve_itad_game_id(client, "Portal 2", 620) == ("itad-id", "Portal 2")
    assert client.calls == [
        ("GET", f"{prices.ITAD_BASE_URL}/games/lookup/v1", {"appid": 620})
    ]
```

Add a second test where the documented lookup returns `{ "found": False }`, then the shop-ID and title lookups are attempted before exact search. Add a `caplog` assertion that a rejected provider response logs the HTTP status and operation name but not the API key.

- [ ] **Step 2: Run the resolver tests and confirm failure**

Run: `rtk pytest -q tests/test_provider_clients.py tests/test_provider_edge_contracts.py -k "itad"`

Expected: the new documented-lookup assertion fails because the resolver currently starts with `POST /lookup/id/shop/61/v1`.

- [ ] **Step 3: Implement the minimal resolver sequence**

```python
async def documented_steam_lookup() -> tuple[str, str, str | None] | None:
    response = await client.get(
        f"{ITAD_BASE_URL}/games/lookup/v1", params={"appid": steam_appid}
    )
    response.raise_for_status()
    data = response.json()
    game = data.get("game") if isinstance(data, dict) and data.get("found") else None
    identity = _itad_game_identity(game, title)
    return (*identity, _itad_game_url(game)) if identity else None
```

Call this first only when `steam_appid is not None`. Retain the current shop lookup, title lookup, and exact-title search as fallbacks. In the `HTTPStatusError` and `HTTPError` handlers in `fetch_game_price_history`, add `logger.warning` with a fixed operation label and status/error class; never interpolate `headers`, API keys, or raw response content.

- [ ] **Step 4: Run affected backend tests**

Run: `rtk pytest -q tests/test_provider_clients.py tests/test_provider_edge_contracts.py tests/test_provider_error_edges.py tests/test_provider_tiny_remaining.py`

Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```text
rtk git add app/prices.py tests/test_provider_clients.py tests/test_provider_edge_contracts.py tests/test_provider_error_edges.py tests/test_provider_tiny_remaining.py
rtk git commit -m "fix ITAD Steam price history lookup"
```

### Task 2: Define frontend price-history visibility and whole-hour profile formatting

**Files:**
- Modify: `web/src/lib/gamePresentation.ts`
- Modify: `web/src/lib/gamePresentation.test.ts`
- Modify: `web/src/lib/profileLibrary.ts`
- Modify: `web/src/lib/profileLibrary.test.ts`
- Modify: `web/src/routes/games.$gameId.tsx:400-640`
- Modify: `web/src/routes/-users.$publicId.test.tsx`

**Interfaces:**
- Produces: `shouldRenderPriceHistory(isFree: boolean) -> boolean`.
- Produces: `formatWholeHours(minutes: number) -> string` for full-library aggregates.

- [ ] **Step 1: Write failing presentation tests**

```ts
expect(shouldRenderPriceHistory(true)).toBe(false);
expect(shouldRenderPriceHistory(false)).toBe(true);
expect(formatWholeHours(715000)).toBe("11916h");
```

Update the public-profile route test so a complete library summary of `715000` minutes renders `Hours: 11916h`, not minutes or `11916h 40m`.

- [ ] **Step 2: Run these tests and confirm failure**

Run: `rtk npm test -- --run src/lib/gamePresentation.test.ts src/lib/profileLibrary.test.ts 'src/routes/-users.$publicId.test.tsx'`

Expected: paid empty history is currently hidden and aggregate profile hours include minutes.

- [ ] **Step 3: Implement display policy**

```ts
export function shouldRenderPriceHistory(isFree: boolean) {
  return !isFree;
}

export function formatWholeHours(minutes: number) {
  return `${Math.floor(Math.max(0, minutes) / 60)}h`;
}
```

Use the policy in the route. For a paid settled response with no usable chart points, render `Price history is temporarily unavailable.` plus the existing Retry button. Do not render a duplicate `PriceBlock` in the history panel; current price remains in the sidebar. Use `formatWholeHours` only for the full-library summary, retaining existing minute-aware formatting for per-game playtime.

- [ ] **Step 4: Run focused tests**

Run: `rtk npm test -- --run src/lib/gamePresentation.test.ts src/lib/profileLibrary.test.ts 'src/routes/-users.$publicId.test.tsx'`

Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```text
rtk git add web/src/lib/gamePresentation.ts web/src/lib/gamePresentation.test.ts web/src/lib/profileLibrary.ts web/src/lib/profileLibrary.test.ts 'web/src/routes/games.$gameId.tsx' 'web/src/routes/-users.$publicId.test.tsx'
rtk git commit -m "fix paid price history and profile hours"
```

### Task 3: Add a responsive ranked recent-player sidebar component

**Files:**
- Create: `web/src/components/GameRecentPlayers.tsx`
- Create: `web/src/components/GameRecentPlayers.test.tsx`
- Modify: `web/src/routes/games.$gameId.tsx:20-40,279-290,530-575,675-800`

**Interfaces:**
- Consumes: `RecentGamePlayer[]`, pending/error state, and `onRetry(): void`.
- Produces: `GameRecentPlayers`, a ranked list sorted by descending `playtime_2weeks`.

- [ ] **Step 1: Write failing component tests**

```tsx
render(<GameRecentPlayers players={[
  { id: "2", public_id: "lena", display_name: "Lena", avatar: null, playtime_2weeks: 120 },
  { id: "1", public_id: "maksym", display_name: "Maksym", avatar: "https://avatar.test/m.png", playtime_2weeks: 600 },
]} isPending={false} isError={false} onRetry={vi.fn()} />);
expect(screen.getAllByTestId("recent-player-row").map((row) => row.textContent)).toEqual([
  expect.stringContaining("Maksym"), expect.stringContaining("Lena"),
]);
expect(screen.getByAltText("Maksym")).toHaveAttribute("src", "https://avatar.test/m.png");
```

Also test loading, error plus retry click, and empty states.

- [ ] **Step 2: Run the component test and confirm failure**

Run: `rtk npm test -- --run src/components/GameRecentPlayers.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component**

```tsx
export function GameRecentPlayers({ players, isPending, isError, onRetry }: Props) {
  const ranked = [...players].sort((a, b) => b.playtime_2weeks - a.playtime_2weeks);
  // render Avatar image/fallback, UserProfileLink, and `${(minutes / 60).toFixed(1)} h`
}
```

Use `Avatar` from `GameCover` with each user's image/fallback initials. Keep rows at least the existing touch-friendly vertical padding. Put `data-testid="recent-player-row"` on rows for focused testing.

- [ ] **Step 4: Integrate in the game route**

Remove the main-column `Recently active players` section. Import `GameRecentPlayers` and render it after the sidebar action card. Keep the existing query and Steam-versus-catalog selection unchanged. Place it in a sibling sidebar panel so the parent `lg:col-span-4` becomes naturally full width below the action card on tablet/mobile.

- [ ] **Step 5: Run focused frontend checks**

Run: `rtk npm test -- --run src/components/GameRecentPlayers.test.tsx 'src/routes/-games.$gameId.test.ts'`

Expected: all selected tests pass.

- [ ] **Step 6: Commit**

```text
rtk git add web/src/components/GameRecentPlayers.tsx web/src/components/GameRecentPlayers.test.tsx 'web/src/routes/games.$gameId.tsx'
rtk git commit -m "feat: rank recent game players in sidebar"
```

### Task 4: Verify, review, and publish

**Files:**
- Review: all files changed by Tasks 1-3.

- [ ] **Step 1: Format and lint changed frontend files**

Run: `rtk npm exec prettier -- --write src/components/GameRecentPlayers.tsx src/components/GameRecentPlayers.test.tsx src/lib/gamePresentation.ts src/lib/gamePresentation.test.ts src/lib/profileLibrary.ts src/lib/profileLibrary.test.ts 'src/routes/games.$gameId.tsx' 'src/routes/-users.$publicId.test.tsx'`

Run: `rtk npm exec eslint -- src/components/GameRecentPlayers.tsx src/components/GameRecentPlayers.test.tsx src/lib/gamePresentation.ts src/lib/gamePresentation.test.ts src/lib/profileLibrary.ts src/lib/profileLibrary.test.ts 'src/routes/games.$gameId.tsx' 'src/routes/-users.$publicId.test.tsx'`

Expected: no lint errors in changed files.

- [ ] **Step 2: Run full tests and production build**

Run: `rtk pytest -q tests/test_provider_clients.py tests/test_provider_edge_contracts.py tests/test_provider_error_edges.py tests/test_provider_tiny_remaining.py`

Run: `rtk npm test -- --run`

Run: `rtk npm run build`

Expected: backend tests, all frontend tests, and build pass.

- [ ] **Step 3: Inspect patch and commit verification changes if needed**

Run: `rtk git diff --check`

Run: `rtk git status --short`

Expected: only intentional source/test changes; no generated `.output` or credentials.

- [ ] **Step 4: Push and open a PR; do not merge or deploy without a new explicit user request**

```text
rtk git push -u origin codex/paid-price-history-activity-list
rtk gh pr create --base main --head codex/paid-price-history-activity-list --title "Fix price history and recent players" --body "Restores documented ITAD Steam lookup, fixes paid/free history visibility, simplifies profile hours, and moves ranked active players into the sidebar."
```
