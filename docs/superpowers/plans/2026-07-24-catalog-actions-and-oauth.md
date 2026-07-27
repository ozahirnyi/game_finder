# PlayFinder Catalog Actions and OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated PlayFinder users save real RAWG catalog games to their library and wishlist, connect Google and Steam accounts, and release the result to `https://example.com`.

**Architecture:** Library persistence uses the existing `Game` source/external-ID contract and a server-authoritative RAWG lookup. Wishlist persistence reuses the existing `WishlistItem` model and its unique user/catalog-game constraint, adding a server-authoritative idempotent catalog endpoint rather than accepting catalog metadata from browsers. React Query provides one shared catalog-actions component to real search and detail routes; OAuth completion is handled by a TanStack Router callback route.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic/PostgreSQL, pytest, React 19, TanStack Router, TanStack Query, Vitest, Docker Compose, Lightsail, GitHub Actions.

## Global Constraints

- Work only on `codex/catalog-actions-and-oauth`, created from `origin/main`; PR base is `main` and `phase-6` remains untouched.
- Do not commit `.env`, `/home/ec2-user/.game-finder.env`, OAuth credentials, Steam keys, access tokens, or secrets.
- New user-visible copy says PlayFinder, never GameFinder.
- Browser OAuth redirects contain only `provider`, one-time `exchange_code`, or a safe error code; access tokens never enter URLs.
- Catalog create endpoints accept only the path RAWG ID and obtain title, description, and image from the server-side catalog source.
- All terminal commands in this repository are prefixed with `rtk`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `app/main.py` | Server-authoritative catalog library/wishlist routes, existing OAuth and Steam contracts. |
| `app/crud.py` | Small owner-scoped catalog game lookup/create helper. |
| `app/schemas.py` | Catalog-save response schema if the existing `GameRead`/`CatalogCollectionRead` types are insufficient. |
| `tests/test_api_contracts.py` | Endpoint-level authenticated, idempotency, and ownership tests. |
| `web/src/lib/api.ts` | Typed catalog-save/list, Steam-link, and OAuth API functions. |
| `web/src/components/CatalogGameActions.tsx` | Shared authenticated library/wishlist controls and statuses. |
| `web/src/routes/search.tsx` | Real catalog search results with non-navigating actions. |
| `web/src/routes/games.$gameId.tsx` | Detail-page catalog actions. |
| `web/src/routes/auth.callback.tsx` | TanStack OAuth exchange callback. |
| `web/src/routes/steam.tsx` | Protected Steam link button and callback feedback. |
| `web/src/routes/profile.tsx` | Google account-link action and status. |
| `web/src/app/auth/callback/page.tsx` | Remove obsolete Next callback UI. |
| `web/src/test/catalog.routes.test.tsx` | Catalog action route behavior tests. |
| `web/src/test/auth-recovery.routes.test.tsx` | OAuth callback and provider-entry tests. |
| `web/src/test/steam-friends.integration.test.tsx` | Steam link and callback-state tests. |

### Task 1: Establish a clean, reproducible baseline

**Files:**
- Modify: none
- Test: `tests/`, `web/src/test/`

**Interfaces:**
- Consumes: checked-out `origin/main` worktree and installed Python/Node dependencies.
- Produces: recorded baseline test status before product changes.

- [ ] **Step 1: Inspect branch isolation and working tree**

Run: `rtk git status --short --branch`

Expected: `## codex/catalog-actions-and-oauth...origin/main` with no tracked or untracked product changes.

- [ ] **Step 2: Run the backend baseline**

Run: `rtk pytest -q`

Expected: all existing backend tests pass. Stop and report any existing failure before changing production code.

- [ ] **Step 3: Run the frontend baseline**

Run: `rtk npm --prefix web test -- --runInBand`

Expected: Vitest completes with existing tests passing; if Vitest rejects `--runInBand`, rerun the repository script as `rtk npm --prefix web test` and record that command.

### Task 2: Add idempotent server-authoritative catalog library saving

**Files:**
- Modify: `app/main.py`, `app/crud.py`
- Test: `tests/test_api_contracts.py`

**Interfaces:**
- Consumes: `fetch_rawg_game_detail(rawg_id) -> dict`, `Game(owner_id, source, external_id)`, and `GameRead`.
- Produces: `POST /library/catalog-games/{rawg_id}` returning `GameRead`, status `201` when created and `200` when already saved.

- [ ] **Step 1: Write the failing library endpoint tests**

Add tests that authenticate two users, monkeypatch `app.main.fetch_rawg_game_detail`, and assert server-owned values:

```python
def test_catalog_library_save_is_idempotent(client, auth_headers, monkeypatch):
    monkeypatch.setattr("app.main.fetch_rawg_game_detail", AsyncMock(return_value={
        "id": 274755, "name": "Hades II", "description_raw": "Fight beyond the Underworld.",
    }))
    first = client.post("/library/catalog-games/274755", headers=auth_headers)
    again = client.post("/library/catalog-games/274755", headers=auth_headers)
    assert first.status_code == 201
    assert first.json()["source"] == "catalog"
    assert first.json()["external_id"] == "rawg:274755"
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]

def test_catalog_library_save_is_owner_scoped(client, first_headers, second_headers, monkeypatch):
    monkeypatch.setattr("app.main.fetch_rawg_game_detail", AsyncMock(return_value={"id": 274755, "name": "Hades II"}))
    assert client.post("/library/catalog-games/274755", headers=first_headers).status_code == 201
    assert client.post("/library/catalog-games/274755", headers=second_headers).status_code == 201

def test_catalog_library_save_requires_auth(client):
    assert client.post("/library/catalog-games/274755").status_code == 401
```

- [ ] **Step 2: Run the new tests and verify RED**

Run: `rtk pytest -q tests/test_api_contracts.py -k catalog_library`

Expected: failures because `/library/catalog-games/{rawg_id}` does not exist.

- [ ] **Step 3: Implement minimal owner-scoped persistence**

Add a CRUD helper and route with this behavior:

```python
async def catalog_game_payload(rawg_id: int) -> dict:
    detail = await fetch_rawg_game_detail(rawg_id)
    return {
        "title": detail["name"],
        "info": detail.get("description_raw"),
        "source": "catalog",
        "external_id": f"rawg:{rawg_id}",
    }

@app.post("/library/catalog-games/{rawg_id}", response_model=GameRead)
async def save_catalog_library_game(rawg_id: int, response: Response, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Game).filter(Game.owner_id == current_user.id, Game.source == "catalog", Game.external_id == f"rawg:{rawg_id}").first()
    if existing:
        response.status_code = 200
        return existing
    game = Game(owner_id=current_user.id, **await catalog_game_payload(rawg_id))
    db.add(game)
    db.commit()
    db.refresh(game)
    response.status_code = 201
    return game
```

Use the existing RAWG error conversion pattern from `catalog_game_detail`; do not accept a request body and do not add `source` or `external_id` to `GameCreate`.

- [ ] **Step 4: Run focused backend tests and verify GREEN**

Run: `rtk pytest -q tests/test_api_contracts.py -k catalog_library`

Expected: all three tests pass.

- [ ] **Step 5: Commit the independently verified library API**

Run: `rtk git add app/main.py app/crud.py tests/test_api_contracts.py`

Run: `rtk git commit -m "feat: add catalog games to library"`

### Task 3: Reuse the existing wishlist model through a catalog endpoint

**Files:**
- Modify: `app/main.py`
- Test: `tests/test_api_contracts.py`

**Interfaces:**
- Consumes: `WishlistItem(user_id, catalog_game_id, title, cover_url)` and `CatalogCollectionRead`.
- Produces: `POST /wishlist/catalog-games/{rawg_id}` returning `CatalogCollectionRead` with `201`/`200`, while `GET /wishlist` continues to return the full user list.

- [ ] **Step 1: Write failing wishlist endpoint tests**

```python
def test_catalog_wishlist_save_is_idempotent(client, auth_headers, monkeypatch):
    monkeypatch.setattr("app.main.fetch_rawg_game_detail", AsyncMock(return_value={
        "id": 274755, "name": "Hades II", "background_image": "https://cdn.example/hades.jpg",
    }))
    first = client.post("/wishlist/catalog-games/274755", headers=auth_headers)
    again = client.post("/wishlist/catalog-games/274755", headers=auth_headers)
    assert first.status_code == 201
    assert first.json()["catalog_game_id"] == 274755
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]

def test_catalog_wishlist_save_requires_auth(client):
    assert client.post("/wishlist/catalog-games/274755").status_code == 401
```

- [ ] **Step 2: Run the wishlist tests and verify RED**

Run: `rtk pytest -q tests/test_api_contracts.py -k catalog_wishlist`

Expected: failures because the specialized endpoint is absent.

- [ ] **Step 3: Implement the idempotent specialized endpoint**

```python
@app.post("/wishlist/catalog-games/{rawg_id}", response_model=CatalogCollectionRead)
async def save_catalog_wishlist_game(rawg_id: int, response: Response, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(WishlistItem).filter(WishlistItem.user_id == current_user.id, WishlistItem.catalog_game_id == rawg_id).first()
    if item:
        response.status_code = 200
        return collection_response(item)
    detail = await fetch_rawg_game_detail(rawg_id)
    item = WishlistItem(user_id=current_user.id, catalog_game_id=rawg_id, title=detail["name"], cover_url=detail.get("background_image"))
    db.add(item)
    db.commit()
    db.refresh(item)
    response.status_code = 201
    return collection_response(item)
```

Reuse the same RAWG validation/error conversion as Task 2. Keep the existing generic `/wishlist` CRUD contract for other callers, but route the catalog UI only through this endpoint.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `rtk pytest -q tests/test_api_contracts.py -k catalog_wishlist`

Expected: all wishlist endpoint tests pass.

- [ ] **Step 5: Commit wishlist API work**

Run: `rtk git add app/main.py tests/test_api_contracts.py`

Run: `rtk git commit -m "feat: save catalog games to wishlist"`

### Task 4: Add typed client contracts and shared catalog actions

**Files:**
- Create: `web/src/components/CatalogGameActions.tsx`
- Modify: `web/src/lib/api.ts`
- Test: `web/src/test/catalog.routes.test.tsx`

**Interfaces:**
- Consumes: `listSavedGames(): Promise<SavedGame[]>`, `listWishlist(): Promise<CatalogCollectionRead[]>`, current authentication helper, and a catalog `{ id, name, description_raw?, background_image? }`.
- Produces: `saveCatalogGameToLibrary(rawgId)`, `saveCatalogGameToWishlist(rawgId)`, and `<CatalogGameActions game={game} />`.

- [ ] **Step 1: Write failing component tests for guest, saved, and click behavior**

```tsx
it("hides save controls for guests", async () => {
  api.isAuthenticated.mockReturnValue(false);
  renderPage(<CatalogGameActions game={hades} />);
  expect(screen.queryByRole("button", { name: /add to library/i })).not.toBeInTheDocument();
});

it("saves once and changes the library label", async () => {
  api.isAuthenticated.mockReturnValue(true);
  api.listSavedGames.mockResolvedValue([]);
  api.listWishlist.mockResolvedValue([]);
  api.saveCatalogGameToLibrary.mockResolvedValue(savedCatalogGame);
  renderPage(<CatalogGameActions game={hades} />);
  fireEvent.click(await screen.findByRole("button", { name: /add to library/i }));
  expect(await screen.findByRole("button", { name: /in library/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run: `rtk npm --prefix web test -- catalog.routes.test.tsx`

Expected: test fails because the exports and component do not exist.

- [ ] **Step 3: Add typed API functions and query keys**

```ts
export function saveCatalogGameToLibrary(rawgId: number) {
  return request<SavedGame>(`/library/catalog-games/${encodeURIComponent(rawgId)}`, { method: "POST", auth: true });
}
export function listWishlist() {
  return request<CatalogCollectionRead[]>("/wishlist", { auth: true });
}
export function saveCatalogGameToWishlist(rawgId: number) {
  return request<CatalogCollectionRead>(`/wishlist/catalog-games/${encodeURIComponent(rawgId)}`, { method: "POST", auth: true });
}
```

Extend `SavedGame["source"]` to include `"catalog"`. In `CatalogGameActions`, query library and wishlist only when authenticated, derive `libraryIds` from `source === "catalog" && external_id === "rawg:${game.id}"`, use two mutations, and invalidate `games`, `wishlist`, dashboard, and profile keys on success. Render `Adding…`, `In library`, `In wishlist`, and a retryable `role="alert"` error.

- [ ] **Step 4: Run focused frontend tests and verify GREEN**

Run: `rtk npm --prefix web test -- catalog.routes.test.tsx`

Expected: action tests pass with no console warnings.

- [ ] **Step 5: Commit client contracts and component**

Run: `rtk git add web/src/lib/api.ts web/src/components/CatalogGameActions.tsx web/src/test/catalog.routes.test.tsx`

Run: `rtk git commit -m "feat: add shared catalog game actions"`

### Task 5: Wire catalog actions into real search and game details

**Files:**
- Modify: `web/src/routes/search.tsx`, `web/src/routes/games.$gameId.tsx`, `web/src/routeTree.gen.ts`
- Test: `web/src/test/catalog.routes.test.tsx`

**Interfaces:**
- Consumes: `searchGames(query)`, `getCatalogGame(rawgId)`, and `<CatalogGameActions>` from Task 4.
- Produces: search cards and details that operate on numeric RAWG IDs and preserve explicit detail navigation.

- [ ] **Step 1: Write failing route tests**

```tsx
it("does not navigate to details when adding from search", async () => {
  renderPage(<SearchPage />);
  fireEvent.click(await screen.findByRole("button", { name: /add to library/i }));
  expect(api.saveCatalogGameToLibrary).toHaveBeenCalledWith(274755);
  expect(screen.queryByRole("link", { name: /game details/i })).toBeInTheDocument();
});

it("shows both catalog actions on the detail page", async () => {
  renderPage(<GameDetailPage gameId="274755" />);
  expect(await screen.findByRole("button", { name: /add to library/i })).toBeVisible();
  expect(screen.getByRole("button", { name: /add to wishlist/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the route tests and verify RED**

Run: `rtk npm --prefix web test -- catalog.routes.test.tsx`

Expected: tests fail because search still maps `mockData.games` and detail lacks the component.

- [ ] **Step 3: Replace mock search cards with catalog query state**

Use `useQuery({ queryKey: ["catalog-search", query], queryFn: () => searchGames(query), enabled: query.trim().length > 0 })`. Render each `SearchGame` in an `article` with a detail `Link` and a sibling actions wrapper:

```tsx
<div onClick={(event) => event.stopPropagation()}>
  <CatalogGameActions game={{ id: game.id!, name: game.name!, background_image: game.background_image, description_raw: null }} />
</div>
```

Only render entries with non-null `id` and `name`; preserve empty/loading/error feedback. Update route metadata and strings to PlayFinder.

- [ ] **Step 4: Add actions to the detail hero/aside**

Pass the fetched `CatalogGame` to `<CatalogGameActions>`, placing library first and wishlist second. Preserve existing price, description, and share controls.

- [ ] **Step 5: Regenerate route tree if the TanStack plugin requires it**

Run: `rtk npm --prefix web run build`

Expected: Vite regenerates `web/src/routeTree.gen.ts` when routes change and succeeds.

- [ ] **Step 6: Run focused route tests and commit**

Run: `rtk npm --prefix web test -- catalog.routes.test.tsx`

Run: `rtk git add web/src/routes/search.tsx web/src/routes/games.$gameId.tsx web/src/routeTree.gen.ts web/src/test/catalog.routes.test.tsx`

Run: `rtk git commit -m "feat: show catalog actions in search and details"`

### Task 6: Make Steam connection actionable for authenticated users

**Files:**
- Modify: `web/src/lib/api.ts`, `web/src/routes/steam.tsx`
- Test: `web/src/test/steam-friends.integration.test.tsx`

**Interfaces:**
- Consumes: protected `GET /steam/login-url`, query parameters `linked` and `error`.
- Produces: `getSteamLinkUrl(): Promise<SteamLoginUrl>` and a Steam page that redirects to Steam only after successfully obtaining its URL.

- [ ] **Step 1: Write failing Steam page tests**

```tsx
it("opens the protected Steam link URL", async () => {
  api.getSteamLinkUrl.mockResolvedValue({ url: "https://steamcommunity.com/openid/login" });
  renderPage(<SteamPage />);
  fireEvent.click(await screen.findByRole("button", { name: /connect steam/i }));
  await waitFor(() => expect(api.getSteamLinkUrl).toHaveBeenCalledOnce());
  expect(assign).toHaveBeenCalledWith("https://steamcommunity.com/openid/login");
});

it("shows a link error without reporting Steam as connected", () => {
  renderRouteWithSearch("?error=Could%20not%20link%20Steam%20account");
  expect(screen.getByRole("alert")).toHaveTextContent("Could not link Steam account");
});
```

- [ ] **Step 2: Run Steam tests and verify RED**

Run: `rtk npm --prefix web test -- steam-friends.integration.test.tsx`

Expected: tests fail because `Connect Steam` is a self-link.

- [ ] **Step 3: Implement protected navigation and feedback**

```ts
export function getSteamLinkUrl() {
  return request<SteamLoginUrl>("/steam/login-url", { auth: true });
}
```

Replace the self-link with a button that awaits `getSteamLinkUrl()`, disables itself with `Opening Steam…`, and invokes `window.location.assign(url)`. Parse `linked`/`error` from TanStack search validation; on `linked === "1"`, invalidate dashboard and Steam keys and show a success status. Keep dashboard navigation to `/steam` unchanged.

- [ ] **Step 4: Run focused Steam tests and commit**

Run: `rtk npm --prefix web test -- steam-friends.integration.test.tsx`

Run: `rtk git add web/src/lib/api.ts web/src/routes/steam.tsx web/src/test/steam-friends.integration.test.tsx`

Run: `rtk git commit -m "fix: wire Steam connection flow"`

### Task 7: Add the active TanStack OAuth callback and account linking UI

**Files:**
- Create: `web/src/routes/auth.callback.tsx`
- Modify: `web/src/lib/api.ts`, `web/src/routes/profile.tsx`, `web/src/routeTree.gen.ts`, `web/src/test/auth-recovery.routes.test.tsx`
- Delete: `web/src/app/auth/callback/page.tsx`

**Interfaces:**
- Consumes: `exchangeGoogleCode(exchangeCode)`, `exchangeSteamCode(exchangeCode)`, `setToken(token)`, `getGoogleLinkUrl()`, and `getCurrentUser()`.
- Produces: route `/auth/callback`, Google account link control, and regenerated route declarations.

- [ ] **Step 1: Write failing callback tests**

```tsx
it("exchanges Google code, saves its token, and redirects to profile", async () => {
  api.exchangeGoogleCode.mockResolvedValue({ access_token: "token", token_type: "bearer" });
  renderCallback("?provider=google&exchange_code=one-time-code");
  await waitFor(() => expect(api.exchangeGoogleCode).toHaveBeenCalledWith("one-time-code"));
  expect(api.setToken).toHaveBeenCalledWith("token");
  expect(navigate).toHaveBeenCalledWith({ to: "/profile" });
});

it("does not store a token for an expired callback", async () => {
  api.exchangeSteamCode.mockRejectedValue(new ApiError("Invalid or expired Steam sign-in result", 401));
  renderCallback("?provider=steam&exchange_code=expired-code");
  expect(await screen.findByText("Sign-in expired. Please try again.")).toBeVisible();
  expect(api.setToken).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run OAuth tests and verify RED**

Run: `rtk npm --prefix web test -- auth-recovery.routes.test.tsx`

Expected: imports fail because the TanStack callback route does not exist.

- [ ] **Step 3: Implement callback route and Google link**

Declare validated search parameters `provider`, `exchange_code`, and `error`. Select only `exchangeGoogleCode` for `google` and `exchangeSteamCode` for `steam`; unsupported providers and `error` render a login link. On success call `setToken`, invalidate auth/profile/dashboard query keys, then navigate to `/profile`. On rejection, do not call `setToken` and render exactly `Sign-in expired. Please try again.` plus a login button.

In profile, fetch current identity status and add a `Link Google` button that awaits `getGoogleLinkUrl()` then calls `window.location.assign(result.url)`. Disable while loading and show the endpoint's error text. Retain the existing social sign-in buttons in `AuthPanel`, adding busy state if tests show it is missing.

- [ ] **Step 4: Remove the obsolete Next callback and regenerate routes**

Run: `rtk npm --prefix web run build`

Expected: build succeeds and `web/src/routeTree.gen.ts` declares `/auth/callback`; no active `web/src/app/auth/callback/page.tsx` remains.

- [ ] **Step 5: Run OAuth tests and commit**

Run: `rtk npm --prefix web test -- auth-recovery.routes.test.tsx`

Run: `rtk git add web/src/routes/auth.callback.tsx web/src/routes/profile.tsx web/src/lib/api.ts web/src/routeTree.gen.ts web/src/test/auth-recovery.routes.test.tsx web/src/app/auth/callback/page.tsx`

Run: `rtk git commit -m "fix: complete social OAuth in TanStack frontend"`

### Task 8: Verify production-safe public URL configuration and release documentation

**Files:**
- Modify: `README.md` only if its documented public URL values differ from the required values.
- Test: `tests/test_config.py`, `tests/test_deployment_docs.py`

**Interfaces:**
- Consumes: `get_frontend_url()` and `get_backend_public_url()` environment precedence, `/home/ec2-user/.game-finder.env`, and `scripts/deploy/ssh_deploy.sh`.
- Produces: a documented, no-secret release procedure using the exact `example.com` callback paths.

- [ ] **Step 1: Write/adjust failing configuration assertions if needed**

Add only public-value assertions, for example:

```python
def test_production_google_callback_is_same_origin_api() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")
    assert "GOOGLE_REDIRECT_URI=https://example.com/api/auth/google/callback" in readme
    assert "BACKEND_PUBLIC_URL=https://example.com/api" in readme
```

- [ ] **Step 2: Run documentation/config tests and verify RED if documentation is stale**

Run: `rtk pytest -q tests/test_config.py tests/test_deployment_docs.py`

Expected: fail only if the checked-in documentation omits or contradicts the public values; otherwise record the already-green result and do not edit documentation unnecessarily.

- [ ] **Step 3: Update only safe documentation values when a test proves the need**

Document this exact non-secret server fragment:

```dotenv
FRONTEND_ORIGIN=https://example.com
FRONTEND_ORIGINS=https://example.com
FRONTEND_PUBLIC_URL=https://example.com
BACKEND_PUBLIC_URL=https://example.com/api
GOOGLE_REDIRECT_URI=https://example.com/api/auth/google/callback
```

Do not add client IDs, secrets, keys, or any checked-in server environment file.

- [ ] **Step 4: Run tests and commit only if source changed**

Run: `rtk pytest -q tests/test_config.py tests/test_deployment_docs.py`

Expected: all selected tests pass.

Run if changed: `rtk git add README.md tests/test_config.py tests/test_deployment_docs.py`

Run if changed: `rtk git commit -m "docs: document PlayFinder OAuth URLs"`

### Task 9: Full verification, pull request, production deployment, and merge

**Files:**
- Modify on server only: `/home/ec2-user/.game-finder.env`
- Verify: `https://example.com/api/health`, `https://example.com/api/auth/google/status`

**Interfaces:**
- Consumes: verified branch commits, GitHub deployment workflow on `main`, Lightsail host access, and Google Cloud Console access.
- Produces: merged `main` deployment with working public OAuth redirect URLs.

- [ ] **Step 1: Run full local verification**

Run: `rtk pytest -q`

Run: `rtk npm --prefix web test`

Run: `rtk npm --prefix web run lint`

Run: `rtk npm --prefix web run build`

Expected: every command exits zero. Resolve failures with a new failing regression test before changing production code.

- [ ] **Step 2: Inspect the exact task diff and branch state**

Run: `rtk git status --short`

Run: `rtk git diff origin/main...HEAD --stat`

Run: `rtk git log --oneline origin/main..HEAD`

Expected: only catalog actions, Steam/OAuth UI, tests, and necessary documentation commits appear.

- [ ] **Step 3: Push and open the required PR**

Run: `rtk git push -u origin codex/catalog-actions-and-oauth`

Create a PR with head `codex/catalog-actions-and-oauth`, base `main`, and a description listing catalog actions, Steam connect, Google/Steam OAuth, public URL configuration, and the exact test commands run.

- [ ] **Step 4: Review CI and merge only when green**

Confirm all required PR checks are green. Merge into `main` using the repository's normal merge method. Do not merge if test, build, or review checks are failing.

- [ ] **Step 5: Apply only public environment values on Lightsail**

Back up the server file with owner-only permissions, then edit `/home/ec2-user/.game-finder.env` without printing it. Preserve all existing secret lines and set only the five variables from Task 8. Confirm the Google Cloud Console authorized redirect URI is exactly `https://example.com/api/auth/google/callback`; if console access is unavailable, stop and request that single user action before claiming OAuth is live.

- [ ] **Step 6: Deploy merged main and verify public endpoints**

Trigger the documented Lightsail deployment workflow for `main` or execute the reviewed `scripts/deploy/ssh_deploy.sh` through the authorized deploy path. Verify without outputting secrets:

Run: `rtk proxy curl -fsS https://example.com/api/health`

Run: `rtk proxy curl -fsS https://example.com/api/auth/google/status`

Expected: `{"status":"ok"}` and a JSON response where `configured` is `true`.

- [ ] **Step 7: Manually test the real production browser flows**

Verify on `https://example.com`: guest catalog details; authenticated library/wishlist idempotency; Google sign-in; Steam sign-in; Google linking from profile; Steam linking from `/steam`; and callback errors. Confirm no redirect includes `access_token` and no localhost callback is used.
