# Profile, Price, and Player Discovery Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make profile libraries fast and complete, restore reliable Steam/ITAD pricing, and accurately expose recent players and friendship state.

**Architecture:** Keep profile identity and static sections independent from a separately queried, privacy-aware library page.  The backend owns a short-lived normalized library snapshot and returns full-library aggregates with each page.  Game pages retain the resolved Steam app ID through the loader; pricing has explicit `is_free` and provider-availability states instead of inferring either from a missing monetary value.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, httpx, React, TanStack Router/Query, Vitest, pytest.

## Global Constraints

- Work only in `codex/profile-price-reliability`, based on `origin/main` commit `ddae6518a44c1d930857e378289d1910da7cc3e5`.
- Use `rtk` before every shell command; use `apply_patch` for file edits.
- Never commit or print `ITAD_API_KEY`; production holds it only in `/home/ec2-user/.game-finder.env`.
- Library pages contain exactly 12 games, are 4/3/2 columns at desktop/tablet/phone breakpoints, and preserve the rendered profile while fetching.
- “Recently active” means `playtime_2weeks > 0` and respects existing social-block and library-visibility rules.
- A free game shows `Free`; show Price History only if at least one history point exists.
- Execute inline only: do not spawn or delegate to subagents.

---

## File map

- `app/schemas.py` — extend public-library, price, and public-user response contracts.
- `app/main.py` — build cached visible library snapshots, page them, preserve Steam activity identity, and return relationship-aware directory records and truthful price availability.
- `app/steam_store.py` — normalize Steam’s `is_free` response into explicit price metadata.
- `app/prices.py` — call the current ITAD overview/history contract and normalize its documented response.
- `web/src/lib/api.ts` — mirror API fields and split profile metadata from paged-library calls.
- `web/src/routes/users.$publicId.tsx` — keep profile shell mounted while debounced library queries change.
- `web/src/components/ProfileView.tsx` — local library loading state, 12-game responsive grid, complete-library metrics, and no redundant chat card.
- `web/src/routes/games.$gameId.tsx` — retain Steam app ID, render Free, and conditionally render history/activity states.
- `web/src/routes/users.index.tsx` — relationship-aware directory controls and whole-row profile navigation.
- `tests/test_social_api.py`, `tests/test_api_contracts.py`, `tests/test_provider_clients.py`, `tests/integration/backend/test_catalog_prices_api.py` — backend contracts and provider normalization.
- `web/src/routes/users.$publicId.test.tsx`, `web/src/components/ProfileView.test.tsx`, `web/src/routes/games.$gameId.test.ts`, `web/src/routes/users.index.test.tsx` — UI behavior contracts.

### Task 1: Establish library-page and directory response contracts

**Files:**
- Modify: `app/schemas.py`
- Modify: `app/main.py`
- Test: `tests/test_social_api.py`
- Test: `tests/integration/backend/test_legacy_social_api.py`

**Interfaces:**
- Produces `PublicLibrarySummaryRead(total_games: int, total_playtime: int, platform_counts: dict[str, int])`.
- Produces `PublicLibraryPageRead(..., page_size=12, summary: PublicLibrarySummaryRead | None)`.
- Produces `PublicUserRead(..., relationship: Literal["none", "friends", "outgoing_pending", "incoming_pending"])` for directory rows only.
- Produces `build_visible_library_snapshot(db, viewer, owner) -> PublicLibrarySnapshot` and `page_visible_library(snapshot, page, q) -> PublicLibraryPageRead`.

- [x] **Step 1: Write failing backend contracts for a 13-game friend library, a filtered page, and complete summary**

```python
response = client.get(f"/users/{friend.public_id}/friend-profile", params={"page": 1})
body = response.json()["library"]
assert body["page_size"] == 12
assert len(body["data"]) == 12
assert body["total"] == 13
assert body["summary"]["total_games"] == 13
assert body["summary"]["total_playtime"] == 780

filtered = client.get(f"/users/{friend.public_id}/friend-profile", params={"page": 1, "q": "dota"})
assert [item["title"] for item in filtered.json()["library"]["data"]] == ["Dota 2"]
assert filtered.json()["library"]["summary"]["total_games"] == 13
```

- [x] **Step 2: Run the focused contract test and confirm it fails because the page size/summary are absent**

Run: `rtk pytest -q tests/test_social_api.py -k library`

Expected: FAIL on `page_size == 12` or missing `summary`.

- [x] **Step 3: Add Pydantic response types and snapshot helpers**

```python
class PublicLibrarySummaryRead(BaseModel):
    total_games: int = 0
    total_playtime: int = 0
    platform_counts: dict[str, int] = Field(default_factory=dict)

class PublicLibraryPageRead(PublicDataBlock):
    page: int = 1
    page_size: int = 12
    total: int = 0
    summary: PublicLibrarySummaryRead | None = None
```

Build the snapshot once per `(viewer.id, owner.id)` cache key with the same `can_view_section` checks already used by `friend_profile_response`.  It must contain normalized non-Steam and Steam game rows plus aggregates calculated before search/slicing.  `page_visible_library` casefolds `q`, slices with `PAGE_SIZE = 12`, and returns a hidden block unchanged when the library is not visible.

- [x] **Step 4: Route both friend-profile endpoints through the shared paged library builder**

Replace the in-function list construction in `friend_profile_response` with `page_visible_library`.  Cache only successful Steam data for a short bounded TTL; retain the existing partial/error message if Steam fails.  Do not call `fetch_owned_games` again for each page or query within that TTL.

- [x] **Step 5: Add directory relationship tests, then implement the relationship field**

```python
directory = client.get("/users?page=1").json()["items"]
assert by_id[friend_id]["relationship"] == "friends"
assert by_id[outgoing_id]["relationship"] == "outgoing_pending"
assert by_id[incoming_id]["relationship"] == "incoming_pending"
assert by_id[stranger_id]["relationship"] == "none"
```

Use the existing friendship/request queries or social-policy helpers, in a bounded batch lookup for the page of users, rather than one relationship query per row.  Do not change the `PublicUserRead` representation used in old endpoints unless all responses can safely populate the new default; alternatively introduce `PublicUserDirectoryItemRead` and use it only for `/users`.

- [x] **Step 6: Run focused backend tests**

Run: `rtk pytest -q tests/test_social_api.py tests/integration/backend/test_legacy_social_api.py`

Expected: PASS.

- [x] **Step 7: Commit the independently testable contract change**

```text
git add app/schemas.py app/main.py tests/test_social_api.py tests/integration/backend/test_legacy_social_api.py
git commit -m "feat: paginate visible profile libraries"
```

### Task 2: Keep friend profiles mounted while library pages/search change

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/routes/users.$publicId.tsx`
- Modify: `web/src/components/ProfileView.tsx`
- Test: `web/src/routes/users.$publicId.test.tsx`
- Test: `web/src/components/ProfileView.test.tsx`

**Interfaces:**
- Consumes `FriendProfile.library.summary`, `page_size`, and `total` from Task 1.
- Produces `getFriendProfileByPublicId(publicId, page, query)` returning the expanded library contract.
- Produces `libraryPagination.isFetching?: boolean` and `summary?: PublicLibrarySummary` for `ProfileView`.

- [ ] **Step 1: Add a failing route test for retained profile content during a second library request**

```tsx
api.getFriendProfileByPublicId.mockResolvedValueOnce(firstPage);
renderRoute();
expect(await screen.findByRole("heading", { name: "Owner" })).toBeVisible();

api.getFriendProfileByPublicId.mockImplementationOnce(() => new Promise(() => {}));
fireEvent.change(screen.getByRole("searchbox", { name: "Search library" }), { target: { value: "dota" } });
expect(screen.getByRole("heading", { name: "Owner" })).toBeVisible();
expect(screen.getByText("Game from first page")).toBeVisible();
```

- [ ] **Step 2: Run the route test and confirm it fails due to the full-page skeleton condition**

Run: `rtk npm test -- --run web/src/routes/users.$publicId.test.tsx`

Expected: FAIL because the route replaces `AppShell` with a skeleton while `friendQuery.isLoading`.

- [ ] **Step 3: Implement stable query behavior and debounced search**

Keep the profile metadata query independent from the paginated friend-library query.  Use `placeholderData: keepPreviousData` (or the installed TanStack Query equivalent), debounce the typed query before changing its query key, and reset `libraryPage` to `1` only after the debounce value changes.  Remove the full-page loading branch after initial profile identity has resolved; query failures must leave the shell visible and render retry/error inside the library section.

- [ ] **Step 4: Render complete totals and responsive pagination in ProfileView**

Use `library.summary.total_games` and `library.summary.total_playtime` for header/store metrics, not `profile.games.length` or the current page’s games.  Keep `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`, pass page size 12, mark only the library region busy with `aria-busy`, and keep Previous/Next buttons keyboard-operable.  Delete the `Open chat` panel guarded by `!isSelf && profile.friendId`.

- [ ] **Step 5: Add UI regression tests and run them**

```tsx
expect(screen.queryByRole("link", { name: "Open chat" })).not.toBeInTheDocument();
expect(screen.getByText("13 games")).toBeVisible();
expect(screen.getByTestId("profile-library-grid")).toHaveClass("lg:grid-cols-4");
```

Run: `rtk npm test -- --run web/src/routes/users.$publicId.test.tsx web/src/components/ProfileView.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the profile UX change**

```text
git add web/src/lib/api.ts web/src/routes/users.$publicId.tsx web/src/components/ProfileView.tsx web/src/routes/users.$publicId.test.tsx web/src/components/ProfileView.test.tsx
git commit -m "fix: retain friend profile during library paging"
```

### Task 3: Normalize Steam free games and repair ITAD price history

**Files:**
- Modify: `app/schemas.py`
- Modify: `app/steam_store.py`
- Modify: `app/prices.py`
- Modify: `app/main.py`
- Test: `tests/test_provider_clients.py`
- Test: `tests/test_api_contracts.py`
- Test: `tests/integration/backend/test_catalog_prices_api.py`

**Interfaces:**
- Produces `GamePriceHistory(..., is_free: bool, history_available: bool, provider_message: str | None)`.
- `fetch_steam_store_game_detail(appid, country)` returns `is_free` from Steam’s `data["is_free"]` even when no `price_overview` exists.
- `fetch_game_price_history(title, country, steam_appid)` returns an ITAD-normalized result or raises a provider-specific HTTP error; it never labels a Steam fallback as history data.

- [ ] **Step 1: Write provider tests using current ITAD overview and history fixture shapes**

```python
result = await prices.fetch_game_price_history("Cyberpunk 2077", steam_appid=1091500)
assert result["history_available"] is True
assert result["current"]["price"]["amount"] == 59.99
assert result["history"]

free = await steam_store.fetch_steam_store_game_detail(570)
assert free["is_free"] is True
assert free["current"] is None
```

Fixtures must represent the documented `games/overview/v2`/`games/history/v2` response fields actually consumed by the adapter.  Assert request method, URL, JSON body, headers, country, and game ID so a legacy `prices/v3` payload cannot pass by accident.

- [ ] **Step 2: Run focused tests and confirm the legacy ITAD request fails the new contract**

Run: `rtk pytest -q tests/test_provider_clients.py tests/test_api_contracts.py -k "itad or steam_game"`

Expected: FAIL on the old `/games/prices/v3` request or missing `is_free`.

- [ ] **Step 3: Implement the current ITAD adapter and explicit failure result**

Resolve the ITAD game ID as today, request the documented overview endpoint, request `history/v2`, then pass their deal/history arrays through `normalize_price_history`.  Preserve 401/403 as a safe 502 message without including the key.  In the API endpoints, keep Steam current-price data if ITAD is unavailable but return `history_available=False`, `provider_message="Price history is temporarily unavailable."`, and `history=[]`; do not claim a successful history lookup.

- [ ] **Step 4: Implement Steam `is_free` end-to-end and cache-safe response shaping**

Set `is_free=bool(data.get("is_free"))` in both Steam detail and title-price paths.  Add it to Pydantic/API response types.  Ensure cache keys distinguish response versions if existing cached price payloads omit the new field.

- [ ] **Step 5: Replace fallback-success tests and run backend price suites**

```python
response = api_client.get("/prices/steam-games/570")
assert response.json()["is_free"] is True
assert response.json()["history_available"] is False

unavailable = api_client.get("/prices/steam-games/1091500")
assert unavailable.json()["history"] == []
assert unavailable.json()["provider_message"] == "Price history is temporarily unavailable."
```

Run: `rtk pytest -q tests/test_provider_clients.py tests/test_api_contracts.py tests/integration/backend/test_catalog_prices_api.py tests/test_price_history_normalization.py`

Expected: PASS.

- [ ] **Step 6: Commit the pricing backend change**

```text
git add app/schemas.py app/steam_store.py app/prices.py app/main.py tests/test_provider_clients.py tests/test_api_contracts.py tests/integration/backend/test_catalog_prices_api.py
git commit -m "fix: return reliable price history and free games"
```

### Task 4: Render free/history state and resolve active players by Steam ID

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/routes/games.$gameId.tsx`
- Modify: `app/main.py`
- Test: `web/src/routes/games.$gameId.test.ts`
- Test: `tests/test_social_api.py`

**Interfaces:**
- Consumes Task 3 `GamePriceHistory.is_free`, `history_available`, `provider_message`, and `history`.
- Route loader produces `steamAppId: number | null` even when the visible game is a catalog record.
- `GET /catalog/games/{catalog_game_id}/active-players` obtains a canonical Steam app ID from the resolved catalog snapshot; the Steam endpoint remains the direct path where one is known.

- [ ] **Step 1: Write failing UI tests for Free, hidden empty history, preserved Steam activity ID, and visible historical chart**

```tsx
expect(screen.getByText("Free")).toBeVisible();
expect(screen.queryByRole("heading", { name: "Price History" })).not.toBeInTheDocument();
expect(api.getRecentSteamGamePlayers).toHaveBeenCalledWith(570);

renderWithPrice({ is_free: true, history: [point], history_available: true });
expect(screen.getByRole("heading", { name: "Price History" })).toBeVisible();
```

- [ ] **Step 2: Run the UI test and confirm it fails**

Run: `rtk npm test -- --run web/src/routes/games.$gameId.test.ts`

Expected: FAIL because `game.price == null` renders “Price unavailable” and the catalog path calls `/catalog/...` without its Steam ID.

- [ ] **Step 3: Implement price presentation rules**

Derive displayed price in this priority: `is_free` -> `Free`; valid `current.price` -> formatted money; otherwise `Price unavailable`.  Render Price History only when `history.length > 0`.  When a paid game has no history and `provider_message` exists, display that message in the price panel rather than an empty chart.  Do not hide a now-free game that has history points.

- [ ] **Step 4: Implement canonical Steam activity identity**

Keep the Steam app ID returned by Steam lookup when a loader substitutes catalog metadata.  Query `getRecentSteamGamePlayers(steamAppId)` whenever it is non-null, irrespective of whether the rendered page is catalog-backed.  On the backend, when catalog cache lacks an app ID, use local `Game.catalog_game_id` activity as fallback; when an ID is known, merge persisted activity with each visible user’s current `fetch_owned_games` result and filter to `playtime_2weeks > 0`.

- [ ] **Step 5: Add backend activity regression coverage and run focused tests**

```python
monkeypatch.setattr(main, "fetch_owned_games", AsyncMock(return_value=[{"appid": 570, "playtime_2weeks": 120}]))
response = client.get("/steam/games/570/active-players")
assert response.json()[0]["playtime_2weeks"] == 120
```

Run: `rtk pytest -q tests/test_social_api.py -k active; rtk npm test -- --run web/src/routes/games.$gameId.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit game-page behavior**

```text
git add app/main.py web/src/lib/api.ts web/src/routes/games.$gameId.tsx tests/test_social_api.py web/src/routes/games.$gameId.test.ts
git commit -m "fix: show free prices and recent Steam players"
```

### Task 5: Finish All Users relationship controls and search regression coverage

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/routes/users.index.tsx`
- Test: `web/src/routes/users.index.test.tsx`
- Test: `web/src/routes/friends.index.test.tsx`

**Interfaces:**
- Consumes directory `relationship` from Task 1.
- Produces a row link for profile navigation plus a separate non-navigating relationship control.

- [ ] **Step 1: Write failing directory tests for relationship labels and row navigation**

```tsx
expect(screen.getByRole("button", { name: "Friends" })).toBeDisabled();
expect(screen.getByRole("button", { name: "Request sent" })).toBeDisabled();
expect(screen.getByRole("button", { name: "Respond to request" })).toBeDisabled();
expect(screen.getByRole("link", { name: "Open Ada profile" })).toHaveAttribute("href", "/users/ada");
```

- [ ] **Step 2: Run the directory test and confirm it fails because all records offer Add friend**

Run: `rtk npm test -- --run web/src/routes/users.index.test.tsx`

Expected: FAIL on the relationship-specific accessible names.

- [ ] **Step 3: Implement the one-row directory control matrix**

Define a pure `directoryAction(relationship, locallyRequested)` mapping: `none` => enabled `Add friend`; `outgoing_pending` or locally requested => disabled `Request sent`; `incoming_pending` => disabled `Respond to request`; `friends` => disabled `Friends`.  Keep the avatar/name region as the profile link and style the article’s hover/focus state so the full non-button row reads as a profile card.  Never invoke the request mutation unless the mapped action is `Add friend`.

- [ ] **Step 4: Add the duplicate friend-search regression test**

Render the Friends page search affordance, type once, and assert exactly one searchbox and one request for the normalized query.  If the test exposes duplicate controls, retain the route-level search field and remove the second rendering path; do not create a second query state inside a child component.

- [ ] **Step 5: Run all social UI tests and commit**

Run: `rtk npm test -- --run web/src/routes/users.index.test.tsx web/src/routes/friends.index.test.tsx`

Expected: PASS.

```text
git add web/src/lib/api.ts web/src/routes/users.index.tsx web/src/routes/users.index.test.tsx web/src/routes/friends.index.test.tsx
git commit -m "fix: reflect friendship state in user directory"
```

### Task 6: Verify, review, and deploy through the existing production workflow

**Files:**
- Verify: all files changed above

- [ ] **Step 1: Run backend and frontend quality gates**

Run: `rtk pytest -q`

Expected: PASS.

Run: `rtk npm test -- --run`

Expected: PASS.

Run: `rtk npm run build`

Expected: successful production build.

- [ ] **Step 2: Inspect only task-owned changes and request code review**

Run: `rtk diff --stat origin/main...HEAD`

Expected: only profile, price, activity, directory, and their tests/docs.

Review edge cases: hidden libraries never leak totals; free-with-history renders history; an existing friend cannot send a request; profile paging does not remount the shell; all API errors are user-safe.

- [ ] **Step 3: Push branch and create PR**

```text
git push -u origin codex/profile-price-reliability
gh pr create --base main --head codex/profile-price-reliability --title "Fix profile, price, and player discovery reliability"
```

- [ ] **Step 4: Merge only after checks/review pass, then observe deployment**

Use the repository’s existing GitHub Actions Lightsail deployment.  After a successful deployment, verify `https://playfinder.cc/api/health` returns `{"status":"ok"}` and manually verify one paid Steam game, one free Steam game, a friend profile with more than 12 games, Dota recent activity, and an existing friend in All Users.

## Plan self-review

- Spec coverage: Tasks 1–2 cover all-library totals, 12-item pagination, responsive profile UI, and duplicate search; Tasks 3–4 cover ITAD, Free/history presentation, and two-week Steam activity; Task 5 covers All Users relationship state and card navigation; Task 6 covers deployment verification.
- Placeholder scan: no unresolved markers or implicit test steps remain; every task identifies concrete files, interfaces, test commands, expected results, and commit boundaries.
- Type consistency: `PublicLibrarySummaryRead`, `is_free`, `provider_message`, and directory `relationship` are introduced before their respective client consumers.
