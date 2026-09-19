# Library and Wishlist Search with Infinite Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add title search and server-backed 20-item infinite scrolling to Library and Wishlist.

**Architecture:** Extend the two authenticated collection endpoints with an offset page envelope. Keep Library's Steam merge and PSN repair metadata, but filter/sort/page its merged result before serializing it. React Query `useInfiniteQuery` caches pages by active filters, while a reusable observer hook requests a single next page when its sentinel is visible.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React 19, TanStack Query v5, TypeScript, Vitest, pytest.

## Global Constraints

- Pages contain exactly at most 20 items; API validation caps `limit` at 20.
- Title search is case-insensitive and source/platform is not searchable.
- Library source tabs and playtime sort apply on the server.
- Preserve authentication, owner scoping, existing card actions, PSN repair metadata, price alerts, and no-network test isolation.

---

## File Structure

- `app/schemas.py`: reusable page envelope models and extended Library overview page contract.
- `app/main.py`: additive page endpoints and collection filtering/sorting helpers.
- `tests/integration/backend/test_collections_price_alerts_api.py`: Wishlist page/search contract coverage.
- `tests/integration/backend/test_profile_dashboard_psn_api.py`: Library page/search/filter/sort contract coverage.
- `web/src/lib/api.ts`: page types and query-string API clients.
- `web/src/lib/navigationQueries.ts`: remove the obsolete full Library prefetch query.
- `web/src/hooks/useInfiniteScroll.ts`: observer lifecycle and duplicate-request guard.
- `web/src/routes/library.tsx`, `web/src/routes/wishlist.tsx`: debounced inputs, infinite queries, sentinel UI, error/retry, and distinct no-results states.
- `web/src/routes/-library.test.tsx`, `web/src/routes/-wishlist.test.tsx`, `web/src/hooks/useInfiniteScroll.test.tsx`: focused UI behavior tests.

### Task 1: Define collection page API contracts

**Files:**
- Modify: `app/schemas.py`
- Modify: `app/main.py`
- Test: `tests/integration/backend/test_collections_price_alerts_api.py`

**Interfaces:**
- Produces `CollectionPageRead(items: list[CatalogCollectionRead], total: int, has_more: bool)`.
- Adds `GET /wishlist/page?q=&limit=20&offset=0`, returning `CollectionPageRead`.

- [ ] **Step 1: Write failing Wishlist API tests**

```python
def test_wishlist_page_searches_titles_and_reports_next_page(api_client, db_session, user_factory, auth_as):
    owner = auth_as(user_factory(email="page-owner@example.com"))
    db_session.add_all([WishlistItem(user_id=owner.id, catalog_game_id=index, title=f"Hades {index}") for index in range(21)])
    db_session.add(WishlistItem(user_id=owner.id, catalog_game_id=99, title="Celeste"))
    db_session.commit()

    first = api_client.get("/wishlist/page?limit=20&offset=0").json()
    searched = api_client.get("/wishlist/page?q=CELESTE&limit=20&offset=0").json()

    assert len(first["items"]) == 20
    assert first["total"] == 22 and first["has_more"] is True
    assert [item["title"] for item in searched["items"]] == ["Celeste"]
    assert searched["total"] == 1 and searched["has_more"] is False
```

- [ ] **Step 2: Run the failing test**

Run: `rtk pytest tests/integration/backend/test_collections_price_alerts_api.py -k wishlist_page_searches_titles -v`

Expected: FAIL because the response is a list rather than an object with `items`.

- [ ] **Step 3: Implement the envelope and filtered query**

```python
class CollectionPageRead(BaseModel):
    items: list[CatalogCollectionRead] = Field(default_factory=list)
    total: int = 0
    has_more: bool = False

@app.get("/wishlist/page", response_model=CollectionPageRead)
def list_wishlist(q: str = Query(default="", max_length=255), limit: int = Query(default=20, ge=1, le=20), offset: int = Query(default=0, ge=0), ...):
    query = db.query(WishlistItem).filter(WishlistItem.user_id == current_user.id)
    if q.strip(): query = query.filter(func.lower(WishlistItem.title).contains(q.strip().casefold()))
    total = query.count()
    items = query.order_by(WishlistItem.created_at.desc()).offset(offset).limit(limit).all()
    return CollectionPageRead(items=[collection_response(item) for item in items], total=total, has_more=offset + len(items) < total)
```

- [ ] **Step 4: Run focused backend tests**

Run: `rtk pytest tests/integration/backend/test_collections_price_alerts_api.py -k wishlist -v`

Expected: PASS, including adjusted pre-existing Wishlist response assertions.

- [ ] **Step 5: Commit**

```powershell
rtk git add app/schemas.py app/main.py tests/integration/backend/test_collections_price_alerts_api.py
rtk git commit -m "feat: page and search wishlist"
```

### Task 2: Page the merged Library overview

**Files:**
- Modify: `app/schemas.py`
- Modify: `app/main.py`
- Test: `tests/integration/backend/test_profile_dashboard_psn_api.py`

**Interfaces:**
- `GET /library/overview/page?q=&source=&sort=&limit=20&offset=0` returns the existing repair/Steam fields plus `games`, `total`, and `has_more`.
- `source` is `all`, `steam`, or `psn`; `sort` is `playtime-desc` or `playtime-asc`.

- [ ] **Step 1: Write failing Library API tests**

```python
def test_library_overview_pages_filtered_sorted_title_results(api_client, db_session, user_factory, auth_as, monkeypatch):
    owner = auth_as(user_factory(email="library-page@example.com"))
    db_session.add_all([Game(owner_id=owner.id, source="psn", title=f"Hades {index}", playtime_forever=index) for index in range(21)])
    db_session.add(Game(owner_id=owner.id, source="psn", title="Celeste", playtime_forever=100))
    db_session.commit()

    response = api_client.get("/library/overview/page?q=hades&source=psn&sort=playtime-asc&limit=20&offset=20")

    assert response.status_code == 200
    assert response.json()["total"] == 21
    assert response.json()["has_more"] is False
    assert [game["playtime_forever"] for game in response.json()["games"]] == [20]
```

- [ ] **Step 2: Run the failing test**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py -k library_overview_pages_filtered -v`

Expected: FAIL because `source`, `sort`, and page metadata do not exist.

- [ ] **Step 3: Implement final-result filtering, ordering, and slicing**

```python
query = q.strip().casefold()
filtered = [game for game in games if not query or query in game.title.casefold()]
if source != "all": filtered = [game for game in filtered if game.source == source]
filtered.sort(key=lambda game: (game.playtime_forever or 0, game.title.casefold()), reverse=sort == "playtime-desc")
page = filtered[offset : offset + limit]
return LibraryOverviewRead(games=page, total=len(filtered), has_more=offset + len(page) < len(filtered), ...)
```

- [ ] **Step 4: Run focused backend tests**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py -k "library_overview or psn_library_repair" -v`

Expected: PASS after adapting assertions that previously expected all Library games in one response.

- [ ] **Step 5: Commit**

```powershell
rtk git add app/schemas.py app/main.py tests/integration/backend/test_profile_dashboard_psn_api.py
rtk git commit -m "feat: page and search library overview"
```

### Task 3: Add typed page clients and a guarded intersection observer

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/lib/navigationQueries.ts`
- Create: `web/src/hooks/useInfiniteScroll.ts`
- Test: `web/src/lib/api.test.ts`
- Test: `web/src/hooks/useInfiniteScroll.test.tsx`

**Interfaces:**
- `getLibraryOverviewPage(options: CollectionPageOptions): Promise<LibraryOverview>` and `getWishlistPage(options: CollectionPageOptions): Promise<CollectionPage<CollectionGame>>`.
- `useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage }): RefObject<HTMLDivElement | null>`.

- [ ] **Step 1: Write failing API URL and observer tests**

```tsx
it("requests a 20-item Wishlist page with its title query", async () => {
  await getWishlist({ q: "Hades", offset: 20 });
  expect(fetchMock).toHaveBeenCalledWith("/api/wishlist?q=Hades&limit=20&offset=20", expect.anything());
});

it("loads the next page once when the sentinel intersects", () => {
  render(<Harness hasNextPage />);
  intersectionObserverCallback([{ isIntersecting: true }]);
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the failing tests**

Run: `rtk npm.cmd --prefix web test -- src/lib/api.test.ts src/hooks/useInfiniteScroll.test.tsx`

Expected: FAIL because the options and hook do not exist.

- [ ] **Step 3: Implement clients and hook**

```ts
export type CollectionPageOptions = { q?: string; offset?: number; limit?: 20; source?: "all" | "steam" | "psn"; sort?: "playtime-desc" | "playtime-asc" };
export function getWishlist(options: CollectionPageOptions = {}) {
  const params = new URLSearchParams({ limit: "20", offset: String(options.offset ?? 0) });
  if (options.q?.trim()) params.set("q", options.q.trim());
  return apiRequest<CollectionPage<CollectionGame>>(`/wishlist/page?${params}`, { auth: true });
}
```

The hook must disconnect on cleanup and omit observer creation whenever there is no next page or a next page is loading. Remove `libraryOverviewQueryOptions`; Library navigation can prefetch its initial infinite-query page through the same options used by the route.

- [ ] **Step 4: Run the focused frontend tests**

Run: `rtk npm.cmd --prefix web test -- src/lib/api.test.ts src/hooks/useInfiniteScroll.test.tsx src/lib/navigationQueries.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/lib/api.ts web/src/lib/api.test.ts web/src/lib/navigationQueries.ts web/src/lib/navigationQueries.test.ts web/src/hooks
rtk git commit -m "feat: add paginated collection clients"
```

### Task 4: Implement Library search and incremental rendering

**Files:**
- Modify: `web/src/routes/library.tsx`
- Modify: `web/src/routes/-library.test.tsx`

**Interfaces:**
- Route uses `useInfiniteQuery` with key `['library-overview', debouncedQuery, source, sort]` and next offset equal to the number of loaded games.

- [ ] **Step 1: Write failing route tests**

```tsx
it("restarts Library from the first page when its title search changes", async () => {
  renderLibrary();
  fireEvent.change(await screen.findByLabelText("Search games"), { target: { value: "Hades" } });
  await waitFor(() => expect(api.getLibraryOverview).toHaveBeenLastCalledWith(expect.objectContaining({ q: "Hades", offset: 0, limit: 20 })));
});

it("loads the next Library page when its sentinel enters view", async () => {
  renderLibrary();
  await screen.findByText("First page game");
  triggerIntersection("library-load-more");
  await waitFor(() => expect(api.getLibraryOverview).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20 })));
});
```

- [ ] **Step 2: Run the failing route tests**

Run: `rtk npm.cmd --prefix web test -- src/routes/-library.test.tsx`

Expected: FAIL because there is no search input/sentinel and the route uses one query.

- [ ] **Step 3: Implement search, pages, and states**

Replace `useQuery(libraryOverviewQueryOptions())` with `useInfiniteQuery`. Derive stats from the first page's metadata and loaded cards; render `Search games` before tabs. Use the debounced value in the key and request. Render `data-testid="library-load-more"` sentinel, later-page loading text, retry button, and a no-results EmptyState only when `total === 0` and the debounced query is non-empty. Preserve the PSN enrichment effect against the first page metadata.

- [ ] **Step 4: Run Library tests**

Run: `rtk npm.cmd --prefix web test -- src/routes/-library.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/routes/library.tsx web/src/routes/-library.test.tsx
rtk git commit -m "feat: search and scroll library"
```

### Task 5: Implement Wishlist search and incremental rendering

**Files:**
- Modify: `web/src/routes/wishlist.tsx`
- Modify: `web/src/routes/-wishlist.test.tsx`

**Interfaces:**
- Route uses `useInfiniteQuery` with key `['wishlist', debouncedQuery]` and maintains price queries only for flattened loaded items.

- [ ] **Step 1: Write failing Wishlist route tests**

```tsx
it("searches Wishlist titles and shows a no-results state", async () => {
  renderWishlist();
  fireEvent.change(await screen.findByLabelText("Search games"), { target: { value: "Missing" } });
  await waitFor(() => expect(api.getWishlist).toHaveBeenLastCalledWith({ q: "Missing", offset: 0, limit: 20 }));
  expect(await screen.findByText("No wishlist games match your search")).toBeInTheDocument();
});

it("loads another Wishlist page only once for an intersecting sentinel", async () => {
  renderWishlist();
  triggerIntersection("wishlist-load-more");
  await waitFor(() => expect(api.getWishlist).toHaveBeenCalledTimes(2));
});
```

- [ ] **Step 2: Run the failing route tests**

Run: `rtk npm.cmd --prefix web test -- src/routes/-wishlist.test.tsx`

Expected: FAIL because Wishlist consumes one array response and has no search/sentinel.

- [ ] **Step 3: Implement search, page flattening, invalidation, and states**

Replace the Wishlist `useQuery` with `useInfiniteQuery`; flatten `data.pages.flatMap(page => page.items)` before price queries and alert UI. Keep `['wishlist']` as the invalidation prefix after removal. Add the debounced accessible input, `wishlist-load-more` sentinel, late-page retry/loading UI, and no-results state. Disable price alerts only if no loaded items are available; do not show the onboarding empty state while a search is active.

- [ ] **Step 4: Run Wishlist tests**

Run: `rtk npm.cmd --prefix web test -- src/routes/-wishlist.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add web/src/routes/wishlist.tsx web/src/routes/-wishlist.test.tsx
rtk git commit -m "feat: search and scroll wishlist"
```

### Task 6: Verify the integrated feature

**Files:**
- Modify only if tests reveal a defect.

- [ ] **Step 1: Run affected backend suites**

Run: `rtk pytest tests/integration/backend/test_collections_price_alerts_api.py tests/integration/backend/test_profile_dashboard_psn_api.py -v`

Expected: PASS.

- [ ] **Step 2: Run affected frontend tests and build**

Run: `rtk npm.cmd --prefix web test -- src/routes/-library.test.tsx src/routes/-wishlist.test.tsx src/lib/api.test.ts src/hooks/useInfiniteScroll.test.tsx`

Expected: PASS.

Run: `rtk npm.cmd --prefix web run build`

Expected: exit code 0.

- [ ] **Step 3: Inspect final changes and commit**

Run: `rtk git diff --check` and `rtk git status --short`

Expected: no whitespace errors; only intended feature files staged before the final commit.

```powershell
rtk git add app web tests docs/superpowers/plans/2026-09-19-library-wishlist-search-infinite-scroll.md
rtk git commit -m "feat: add collection search and infinite scroll"
```
