# Catalog Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow signed-in users to add RAWG catalog games to Favorites from search and details views with canonical server data and idempotent saves.

**Architecture:** A new authenticated FastAPI endpoint mirrors the established catalog Wishlist save endpoint: it looks up an owned Favorite, fetches RAWG only for new records, and returns 200 or 201 accordingly. The React catalog action component uses a dedicated Favorites query and mutation, with cache invalidation shared across collection actions.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, pytest, React, TypeScript, TanStack Query, Vitest, Testing Library.

## Global Constraints

- Branch from `origin/main` in an isolated `codex/catalog-favorites` worktree; never alter `phase-*` branches.
- Use `POST /favorites/catalog-games/{rawg_id}` with no request body.
- Reject RAWG IDs lower than 1 with HTTP 400 and `rawg_id must be >= 1`.
- Return 201 for a new Favorite and 200 for an existing Favorite owned by the current user.
- Fetch canonical `name` and `background_image` from RAWG only for a new Favorite.
- Hide all catalog actions from guests; expose no catalog removal control.
- Use the exact button text sequence `Add to favorites`, `Adding…`, `In favorites`.
- Keep the legacy `POST /favorites` and `DELETE /favorites/{catalog_game_id}` APIs unchanged.

---

### Task 1: Add the idempotent server-authoritative Favorites endpoint

**Files:**
- Modify: `app/main.py:919-958`
- Modify: `tests/test_api_contracts.py:1-171`

**Interfaces:**
- Consumes: `fetch_rawg_game_detail(rawg_id: int) -> dict`, `Favorite`, `collection_response(item: Favorite) -> CatalogCollectionRead`, `get_current_user`, and `get_db`.
- Produces: `POST /favorites/catalog-games/{rawg_id}` returning `CatalogCollectionRead`; HTTP 201 for creation, HTTP 200 for an existing owned row, HTTP 400 for an invalid ID, HTTP 401 without a user.

- [ ] **Step 1: Add focused failing API contract tests**

Add after the existing catalog Wishlist tests in `tests/test_api_contracts.py`:

```python
def test_catalog_favorite_save_is_idempotent_and_server_authoritative(monkeypatch):
    owner_id = uuid.uuid4()
    db = CatalogGameDb()

    async def fake_fetch(rawg_id: int):
        assert rawg_id == 274755
        return {
            "id": rawg_id,
            "name": "Hades II",
            "background_image": "https://example.com/hades-ii.jpg",
        }

    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=owner_id)
    main.app.dependency_overrides[main.get_db] = lambda: db
    monkeypatch.setattr(main, "fetch_rawg_game_detail", fake_fetch)
    try:
        first = client.post("/favorites/catalog-games/274755")
        again = client.post("/favorites/catalog-games/274755")
    finally:
        main.app.dependency_overrides.clear()

    assert first.status_code == 201
    assert first.json()["catalog_game_id"] == 274755
    assert first.json()["title"] == "Hades II"
    assert first.json()["cover_url"] == "https://example.com/hades-ii.jpg"
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]
    assert len(db.games) == 1


def test_catalog_favorite_save_is_isolated_by_owner(monkeypatch):
    first_owner_id, second_owner_id = uuid.uuid4(), uuid.uuid4()
    db = CatalogGameDb()

    async def fake_fetch(rawg_id: int):
        return {"id": rawg_id, "name": "Hades II", "background_image": None}

    main.app.dependency_overrides[main.get_db] = lambda: db
    monkeypatch.setattr(main, "fetch_rawg_game_detail", fake_fetch)
    try:
        main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=first_owner_id)
        first = client.post("/favorites/catalog-games/274755")
        main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=second_owner_id)
        second = client.post("/favorites/catalog-games/274755")
    finally:
        main.app.dependency_overrides.clear()

    assert first.status_code == 201
    assert second.status_code == 201
    assert len(db.games) == 2
    assert {game.user_id for game in db.games} == {first_owner_id, second_owner_id}


def test_catalog_favorite_save_rejects_invalid_id_and_requires_authentication():
    assert client.post("/favorites/catalog-games/0").status_code == 401
    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=uuid.uuid4())
    main.app.dependency_overrides[main.get_db] = lambda: CatalogGameDb()
    try:
        invalid = client.post("/favorites/catalog-games/0")
    finally:
        main.app.dependency_overrides.clear()
    assert invalid.status_code == 400
    assert invalid.json()["detail"] == "rawg_id must be >= 1"
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `rtk pytest -q tests/test_api_contracts.py -k catalog_favorite`

Expected: FAIL because `/favorites/catalog-games/{rawg_id}` does not exist.

- [ ] **Step 3: Add the endpoint**

Insert this route after `add_favorite` and before `remove_favorite` in `app/main.py`:

```python
@app.post("/favorites/catalog-games/{rawg_id}", response_model=CatalogCollectionRead)
async def save_catalog_favorite_game(
    rawg_id: int,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if rawg_id < 1:
        raise HTTPException(status_code=400, detail="rawg_id must be >= 1")

    existing = (
        db.query(Favorite)
        .filter(
            Favorite.user_id == current_user.id,
            Favorite.catalog_game_id == rawg_id,
        )
        .first()
    )
    if existing:
        response.status_code = 200
        return collection_response(existing)

    try:
        detail = await fetch_rawg_game_detail(rawg_id)
    except RAWGError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc))

    item = Favorite(
        user_id=current_user.id,
        catalog_game_id=rawg_id,
        title=detail["name"],
        cover_url=detail.get("background_image"),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    response.status_code = 201
    return collection_response(item)
```

- [ ] **Step 4: Run the focused tests to verify success**

Run: `rtk pytest -q tests/test_api_contracts.py -k catalog_favorite`

Expected: PASS (three Favorites endpoint tests).

- [ ] **Step 5: Commit the backend change**

```powershell
rtk git add app/main.py tests/test_api_contracts.py
rtk git commit -m "feat: add catalog favorites endpoint"
```

### Task 2: Add the Favorites client request and cache key

**Files:**
- Modify: `web/src/lib/api.ts:228-245,809-826`
- Modify: `web/src/lib/api.test.ts:1-64`
- Modify: `web/src/lib/lovable-data.ts:20-46`

**Interfaces:**
- Consumes: `request<T>(path, { method, auth })` and `CatalogCollectionItem`.
- Produces: `saveCatalogGameToFavorites(rawgId: number): Promise<CatalogCollectionItem>` and `lovableQueryKeys.favorites: readonly ["favorites"]`.

- [ ] **Step 1: Add a failing API request test**

Extend the import from `./api` and add this test in the existing `API requests` suite:

```ts
it("posts a RAWG id to the server-authoritative favorites endpoint", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({
      id: "favorite-1", catalog_game_id: 274755, title: "Hades II",
      cover_url: null, created_at: "2026-07-25T00:00:00Z", updated_at: null,
    }), { headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  setToken(validToken());

  await saveCatalogGameToFavorites(274755);

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/favorites/catalog-games/274755",
    expect.objectContaining({ method: "POST" }),
  );
  const [, options] = fetchMock.mock.calls[0];
  expect(new Headers(options.headers).get("Authorization")).toBe(
    `Bearer ${window.localStorage.getItem(TOKEN_KEY)}`,
  );
  expect(options.body).toBeUndefined();
});
```

- [ ] **Step 2: Run the focused test to verify failure**

Run: `rtk npm --prefix web test -- --run web/src/lib/api.test.ts`

Expected: FAIL because `saveCatalogGameToFavorites` is not exported.

- [ ] **Step 3: Implement the API wrapper and query key**

Add this beside `saveCatalogGameToWishlist` in `web/src/lib/api.ts`:

```ts
export function saveCatalogGameToFavorites(rawgId: number) {
  return request<CatalogCollectionItem>(
    `/favorites/catalog-games/${encodeURIComponent(rawgId)}`,
    { method: "POST", auth: true },
  );
}
```

Add this entry after `wishlist` in `lovableQueryKeys`:

```ts
favorites: ["favorites"] as const,
```

Import `saveCatalogGameToFavorites` in `web/src/lib/api.test.ts`.

- [ ] **Step 4: Run the focused test to verify success**

Run: `rtk npm --prefix web test -- --run web/src/lib/api.test.ts`

Expected: PASS (four API request tests).

- [ ] **Step 5: Commit the client API change**

```powershell
rtk git add web/src/lib/api.ts web/src/lib/api.test.ts web/src/lib/lovable-data.ts
rtk git commit -m "feat: add catalog favorites client API"
```

### Task 3: Render and test the Favorites catalog action

**Files:**
- Modify: `web/src/components/CatalogGameActions.tsx:1-76`
- Modify: `web/src/test/catalog.routes.test.tsx:8-25,160-291`

**Interfaces:**
- Consumes: `listFavorites(): Promise<CatalogCollectionItem[]>`, `saveCatalogGameToFavorites(rawgId)`, and `lovableQueryKeys.favorites`.
- Produces: a third authenticated catalog button that uses exact labels, detects persisted `catalog_game_id`, invalidates relevant queries, and renders mutation failures as the existing alert.

- [ ] **Step 1: Add failing UI tests and mocks**

Add `listFavorites` and `saveCatalogGameToFavorites` to the hoisted `api` mock. In `beforeEach`, configure `api.listFavorites.mockResolvedValue([])`. Add these tests:

```tsx
it("hides the Favorites action for guests", () => {
  api.isAuthenticated.mockReturnValue(false);
  renderPage(<CatalogGameActions game={{ id: 274755, name: "Hades II", released: null, background_image: null, description_raw: null, rating: null, genres: [], platforms: [] }} />);
  expect(screen.queryByRole("button", { name: /add to favorites/i })).not.toBeInTheDocument();
});

it("saves a catalog game to Favorites and updates the label", async () => {
  api.isAuthenticated.mockReturnValue(true);
  api.listSavedGames.mockResolvedValue([]);
  api.listWishlist.mockResolvedValue([]);
  api.listFavorites.mockResolvedValue([]);
  api.saveCatalogGameToFavorites.mockResolvedValue({
    id: "favorite-1", catalog_game_id: 274755, title: "Hades II", cover_url: null,
    created_at: "2026-07-25T00:00:00Z", updated_at: null,
  });
  renderPage(<CatalogGameActions game={{ id: 274755, name: "Hades II", released: null, background_image: null, description_raw: null, rating: null, genres: [], platforms: [] }} />);

  fireEvent.click(await screen.findByRole("button", { name: /add to favorites/i }));
  await waitFor(() => expect(api.saveCatalogGameToFavorites).toHaveBeenCalledWith(274755));
  expect(await screen.findByRole("button", { name: /in favorites/i })).toBeVisible();
});

it("shows the Favorites action in authenticated game details", async () => {
  api.isAuthenticated.mockReturnValue(true);
  api.listSavedGames.mockResolvedValue([]);
  api.listWishlist.mockResolvedValue([]);
  api.listFavorites.mockResolvedValue([]);
  renderPage(<GameDetailPage gameId="274755" />);
  expect(await screen.findByRole("button", { name: /add to favorites/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the focused UI tests to verify failure**

Run: `rtk npm --prefix web test -- --run web/src/test/catalog.routes.test.tsx`

Expected: FAIL because the Favorites functions and button do not yet exist in `CatalogGameActions`.

- [ ] **Step 3: Extend `CatalogGameActions`**

Update the API import and add this query after `wishlist`:

```tsx
const favorites = useQuery({
  queryKey: lovableQueryKeys.favorites,
  queryFn: listFavorites,
  enabled: authenticated,
});
```

Add the key to `invalidateCollections`, then add this mutation:

```tsx
const favoriteMutation = useMutation({
  mutationFn: () => saveCatalogGameToFavorites(game.id),
  onSuccess: invalidateCollections,
});
```

Derive saved state and render the button after Wishlist:

```tsx
const inFavorites = favorites.data?.some(
  (item) => item.catalog_game_id === game.id,
) || favoriteMutation.isSuccess;

<button
  type="button"
  onClick={() => favoriteMutation.mutate()}
  disabled={inFavorites || favoriteMutation.isPending}
  className="rounded-lg border border-border px-3 py-2 text-sm font-bold hover:bg-secondary disabled:cursor-default disabled:opacity-70"
>
  {inFavorites ? "In favorites" : favoriteMutation.isPending ? "Adding…" : "Add to favorites"}
</button>
```

Extend the existing alert condition and argument so a Favorites mutation error is reported:

```tsx
{(libraryMutation.error || wishlistMutation.error || favoriteMutation.error) && (
  <p className="w-full text-xs text-destructive" role="alert">
    {mutationMessage(libraryMutation.error || wishlistMutation.error || favoriteMutation.error)}
  </p>
)}
```

- [ ] **Step 4: Run focused UI tests to verify success**

Run: `rtk npm --prefix web test -- --run web/src/test/catalog.routes.test.tsx`

Expected: PASS, including guest, search action transition, and game-detail action coverage.

- [ ] **Step 5: Run integration verification and commit**

Run:

```powershell
rtk pytest -q
rtk npm --prefix web test -- --run
rtk npm --prefix web run build
rtk git diff --check
```

Expected: all backend and frontend tests pass, production build succeeds, and `git diff --check` emits no whitespace errors.

Commit:

```powershell
rtk git add web/src/components/CatalogGameActions.tsx web/src/test/catalog.routes.test.tsx
rtk git commit -m "feat: add catalog favorites action"
```
