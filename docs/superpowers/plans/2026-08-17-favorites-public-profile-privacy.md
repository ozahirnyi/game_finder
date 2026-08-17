# Phase 3: Favorites, Public Profiles, and Privacy Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add truthful catalog favorites, a shareable server-authorized public profile, and complete owner visibility settings without changing unrelated PlayFinder flows.

**Architecture:** Keep FastAPI's existing owner scoping and `GET /users/{public_id}` authorization contract as the only privacy authority. Add narrow frontend API types/functions, then compose existing TanStack Query primitives into the game detail, account/settings, and a new public-profile route. The new public route renders each returned block independently and never fetches a second source for a hidden section.

**Tech Stack:** FastAPI, SQLAlchemy, pytest, Vite, React 19, TanStack Router, TanStack Query, Vitest, Testing Library, TypeScript.

## Global Constraints

- Use `origin/main` as source of truth; start implementation only after this plan is approved on a new `codex/*` branch in an isolated worktree.
- Do not modify or stage `web/src/routeTree.gen.ts`, `web/.output`, build output, or unrelated generated files.
- Keep all unit/contract provider calls mocked; no live IGDB, Steam, OpenAI, OAuth, Telegram, or production mutations.
- Preserve the current Search, deals, alerts, Friends messaging, notifications, Home, onboarding, Party Finder, Groups, Discord, and fake-presence behavior.
- Reuse only active Vite/TanStack routes and real FastAPI contracts; do not revive old static/mock code or PRs #142–145.
- Every production behavior change begins with a focused failing test, then the smallest implementation, then a focused passing test.

---

## File structure

| File | Responsibility |
| --- | --- |
| `web/src/lib/api.ts` | Exact TypeScript representations and requests for the existing favorite, public-profile, and public friend-request contracts. |
| `web/src/lib/api.test.ts` | Request-shape tests for each added API-client operation. |
| `web/src/routes/games.$gameId.tsx` | Catalog-only favorite toggle and truthful mutation state beside existing detail actions. |
| `web/src/routes/-games.actions.test.tsx` | Detail favorite add/remove, loading, and failure regression coverage. |
| `web/src/routes/account.tsx` | Owner favorites query and mapping into the existing account presentation. |
| `web/src/components/ProfileView.tsx` | Full visibility controls and an owner favorites ready/empty section. |
| `web/src/routes/-account.test.tsx` | Account favorites ready/empty mapping tests. |
| `web/src/components/ProfileView.test.tsx` | All-four-field profile PATCH, pending, and error tests. |
| `web/src/components/PublicProfileView.tsx` | Presentation-only public-profile blocks and relationship-specific actions. |
| `web/src/components/PublicProfileView.test.tsx` | Block visibility, no-leak rendering, and friend-request action tests. |
| `web/src/routes/users.$publicId.tsx` | Canonical `/users/$publicId` route and public-profile query/error shell. |
| `web/src/routes/-users.$publicId.test.tsx` | Route-level anonymous/authenticated ready, empty, hidden, and unavailable coverage. |
| `tests/integration/backend/test_profile_dashboard_psn_api.py` | Existing profile PATCH contract regression coverage. |
| `tests/integration/backend/test_main_remaining_edges_api.py` | Public-profile visibility/no-leak and public friend-request eligibility contract coverage. |
| `tests/integration/backend/test_collections_price_alerts_api.py` | Favorite owner-scoping/idempotency contract coverage. |

## Task 1: Add exact Phase 3 API client contracts

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/lib/api.test.ts`

**Interfaces:**
- Consumes: existing `apiRequest<T>(path, options)` and `CollectionGame` in `web/src/lib/api.ts`.
- Produces: `Visibility`, expanded `Profile`/`ProfileUpdate`, `PublicDataBlock<T>`, `PublicProfile`, `getFavorites()`, `saveCatalogGameToFavorites(igdbId)`, `removeFavorite(catalogGameId)`, `getPublicProfile(publicId)`, and `createSocialFriendRequest(publicId)`.

- [ ] **Step 1: Write failing client-contract tests**

  Add imports and tests that install `setToken("token")`, stub `fetch`, call the new functions, and assert the exact active backend requests:

  ```ts
  await getFavorites();
  await saveCatalogGameToFavorites(274755);
  await removeFavorite(274755);
  await getPublicProfile("player-1");
  await createSocialFriendRequest("player-1");

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/api/favorites",
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token" }) }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/favorites/catalog-games/274755", expect.objectContaining({ method: "POST" }));
  expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/favorites/274755", expect.objectContaining({ method: "DELETE" }));
  expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/users/player-1", expect.any(Object));
  expect(fetchMock).toHaveBeenNthCalledWith(
    5,
    "/api/social/friend-requests",
    expect.objectContaining({ method: "POST", body: JSON.stringify({ public_id: "player-1" }) }),
  );
  ```

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `rtk npm --prefix web test -- --run src/lib/api.test.ts`  
  Expected: FAIL because the named Phase 3 exports do not exist.

- [ ] **Step 3: Add the smallest exact types and requests**

  In `api.ts`, define public blocks without private profile fields and extend the owner profile type:

  ```ts
  export type Visibility = "public" | "friends" | "private";
  export type PublicDataBlock<T> = {
    status: "ready" | "empty" | "hidden";
    data: T;
    message?: string | null;
  };
  export type PublicLibraryGame = Pick<LibraryGame, "id" | "title" | "source" | "cover_url" | "playtime_forever"> & {
    detail_game_id?: string | null;
  };
  export type PublicProfile = {
    public_id: string;
    nickname: string;
    avatar?: string | null;
    relationship: "none" | "self" | "friends" | "outgoing_pending" | "incoming_pending";
    library: PublicDataBlock<PublicLibraryGame[]>;
    favorites: PublicDataBlock<CollectionGame[]>;
    wishlist: PublicDataBlock<CollectionGame[]>;
    steam: PublicDataBlock<{ linked: boolean; persona_name?: string | null; avatar?: string | null; profile_url?: string | null } | null>;
  };
  ```

  Add `favorites_visibility`, `wishlist_visibility`, and `steam_visibility` as required `Visibility` members alongside `library_visibility` in `Profile`; include all four in `ProfileUpdate`. Implement requests with the real methods and auth settings:

  ```ts
  export const getFavorites = () => apiRequest<CollectionGame[]>("/favorites", { auth: true });
  export const saveCatalogGameToFavorites = (igdbId: number) =>
    apiRequest<CollectionGame>(`/favorites/catalog-games/${igdbId}`, { auth: true, method: "POST" });
  export const removeFavorite = (catalogGameId: number) =>
    apiRequest<void>(`/favorites/${catalogGameId}`, { auth: true, method: "DELETE" });
  export const getPublicProfile = (publicId: string) => apiRequest<PublicProfile>(`/users/${encodeURIComponent(publicId)}`);
  export const createSocialFriendRequest = (publicId: string) =>
    apiRequest("/social/friend-requests", { auth: true, method: "POST", body: { public_id: publicId } });
  ```

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `rtk npm --prefix web test -- --run src/lib/api.test.ts`  
  Expected: PASS with the new request-shape tests and existing API tests.

- [ ] **Step 5: Commit the API boundary**

  Run:

  ```text
  rtk git add web/src/lib/api.ts web/src/lib/api.test.ts
  rtk git commit -m "feat: add favorites and public profile api client"
  ```

## Task 2: Lock down existing backend ownership and visibility contracts

**Files:**
- Modify: `tests/integration/backend/test_collections_price_alerts_api.py`
- Modify: `tests/integration/backend/test_profile_dashboard_psn_api.py`
- Modify: `tests/integration/backend/test_main_remaining_edges_api.py`

**Interfaces:**
- Consumes: existing `POST /favorites/catalog-games/{igdb_id}`, `GET/PATCH /profile`, `GET /users/{public_id}`, and `POST /social/friend-requests` routes.
- Produces: regression evidence that the existing backend can safely support the new UI without a new endpoint or schema change.

- [ ] **Step 1: Add focused contract tests before frontend integration**

  Add an owner/other-user favorite test using the existing `auth_as` fixture: create a favorite for owner, switch identity, and assert the other owner receives `[]` and cannot delete the first owner's favorite. Retain the existing idempotency assertion for catalog save.

  Add one parameterized public-profile test for `library`, `favorites`, `wishlist`, and `steam`, with owner, confirmed friend, stranger, and anonymous viewers. Seed distinct sensitive values (`"Secret Favorite"`, `"https://cover/private"`, a numeric Steam ID) and assert a hidden response is exactly status `hidden`, empty `data`, generic message, and excludes every sensitive token from `response.text`.

  Add an eligible public friend-request test that uses `POST /social/friend-requests` with the recipient `public_id`, then asserts `201` and `outgoing_pending` on the requester's subsequent public-profile response. Add separate `401/409/400` assertions for anonymous, nickname-less, existing-friend, pending, and self callers, matching the current route behavior.

  Extend the existing profile PATCH test so the returned JSON asserts all four persisted visibility fields, not only their database values.

- [ ] **Step 2: Run the focused backend tests**

  Run:

  ```text
  rtk pytest tests/integration/backend/test_collections_price_alerts_api.py tests/integration/backend/test_profile_dashboard_psn_api.py tests/integration/backend/test_main_remaining_edges_api.py -q
  ```

  Expected: PASS. These tests exercise already-implemented server behavior with the in-memory database and mocked provider boundaries; if one fails, invoke `systematic-debugging` before proposing any server change.

- [ ] **Step 3: Commit contract coverage only**

  Run:

  ```text
  rtk git add tests/integration/backend/test_collections_price_alerts_api.py tests/integration/backend/test_profile_dashboard_psn_api.py tests/integration/backend/test_main_remaining_edges_api.py
  rtk git commit -m "test: cover favorites and public profile privacy contracts"
  ```

## Task 3: Add a catalog favorite toggle to Game Detail

**Files:**
- Modify: `web/src/routes/games.$gameId.tsx`
- Modify: `web/src/routes/-games.actions.test.tsx`

**Interfaces:**
- Consumes: `getFavorites`, `saveCatalogGameToFavorites`, `removeFavorite`, `CollectionGame`, and existing `Route.useLoaderData()` game shape.
- Produces: an accessible catalog-only button named `Add to favorites` or `Remove from favorites`, plus a status/error message.

- [ ] **Step 1: Write failing Game Detail tests**

  Expand the API mock with `getFavorites`, `saveCatalogGameToFavorites`, and `removeFavorite`. Add tests for a catalog game:

  ```tsx
  api.getFavorites.mockResolvedValue([]);
  renderGame();
  fireEvent.click(await screen.findByRole("button", { name: "Add to favorites" }));
  await waitFor(() => expect(api.saveCatalogGameToFavorites).toHaveBeenCalledWith(274755));
  expect(await screen.findByRole("button", { name: "Remove from favorites" })).toBeEnabled();

  api.getFavorites.mockResolvedValue([{ catalog_game_id: 274755, title: "Hades II" }]);
  renderGame();
  fireEvent.click(await screen.findByRole("button", { name: "Remove from favorites" }));
  await waitFor(() => expect(api.removeFavorite).toHaveBeenCalledWith(274755));
  ```

  Add failure coverage that rejects the add mutation and asserts an alert/status explaining that favorites could not be updated. Add a Steam-only fixture (`isSteamLibrary: true`) and assert neither favorite button is rendered.

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run: `rtk npm --prefix web test -- --run src/routes/-games.actions.test.tsx`  
  Expected: FAIL because Game Detail has no favorite query or action.

- [ ] **Step 3: Implement the smallest toggle**

  Add one `useQuery` keyed `['favorites']`, guarded by `enabled: !catalogGame.isSteamLibrary`; derive membership strictly from `catalog_game_id === Number(catalogGame.id)`. Add two mutations whose `onSuccess` invalidates `['favorites']` and changes the local button state only after success. Render a single favorite button in the existing sidebar action area only for catalog games:

  ```tsx
  {!catalogGame.isSteamLibrary && (
    <button
      type="button"
      disabled={favoriteMutation.isPending || removeFavoriteMutation.isPending}
      onClick={() => (isFavorite ? removeFavoriteMutation.mutate() : favoriteMutation.mutate())}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className="size-4" /> {isFavorite ? "In favorites" : "Favorite"}
    </button>
  )}
  ```

  Use the existing local action-message convention for success and a visible `role="alert"` for mutation errors. Do not change wishlist, alert, sharing, or invite behavior.

- [ ] **Step 4: Run the focused tests to verify they pass**

  Run: `rtk npm --prefix web test -- --run src/routes/-games.actions.test.tsx`  
  Expected: PASS, including the add/remove/error/catalog-only cases.

- [ ] **Step 5: Commit the independently testable favorite action**

  Run:

  ```text
  rtk git add "web/src/routes/games.$gameId.tsx" "web/src/routes/-games.actions.test.tsx"
  rtk git commit -m "feat: add catalog game favorite toggle"
  ```

## Task 4: Surface owner favorites and complete privacy settings

**Files:**
- Modify: `web/src/routes/account.tsx`
- Modify: `web/src/routes/-account.test.tsx`
- Modify: `web/src/components/ProfileView.tsx`
- Modify: `web/src/components/ProfileView.test.tsx`

**Interfaces:**
- Consumes: expanded `Profile`, `getFavorites()`, `updateProfile(ProfileUpdate)`, and `CollectionGame` from Task 1.
- Produces: account favorites ready/empty display and a settings PATCH containing all four visibility values.

- [ ] **Step 1: Write failing owner-account and settings tests**

  In `-account.test.tsx`, mock `getFavorites` and assert `AccountPage` passes favorites into `ProfileView` once as a real favorite card and once as an explicit empty collection. In `ProfileView.test.tsx`, open settings, select different values for all four fields, click Save, and assert:

  ```ts
  expect(api.updateProfile).toHaveBeenCalledWith(expect.objectContaining({
    library_visibility: "friends",
    favorites_visibility: "private",
    wishlist_visibility: "friends",
    steam_visibility: "private",
  }));
  ```

  Add a rejected `updateProfile` case that retains the dialog and shows an inline alert. Add a deferred mutation case that asserts Save is disabled and labelled `Saving…` while pending. Assert the visible helper text explains public-profile visibility.

- [ ] **Step 2: Run focused tests to verify they fail**

  Run: `rtk npm --prefix web test -- --run src/routes/-account.test.tsx src/components/ProfileView.test.tsx`  
  Expected: FAIL because account does not query favorites and the settings form has only library visibility.

- [ ] **Step 3: Implement the owner-only UI additions**

  In `account.tsx`, add a favorites query keyed `['favorites']`, pass its result to a new optional `favorites` member of `ProfileData`, and pass all four current values in `settings`.

  In `ProfileView.tsx`, add state for the three missing visibility fields. Replace the single library selector with a small data-driven list whose labels, helper copy, and bound state are exact:

  ```ts
  const privacyControls = [
    ["Library", libraryVisibility, setLibraryVisibility],
    ["Favorites", favoritesVisibility, setFavoritesVisibility],
    ["Wishlist", wishlistVisibility, setWishlistVisibility],
    ["Steam profile", steamVisibility, setSteamVisibility],
  ] as const;
  ```

  Each selector uses option labels `Public`, `Friends only`, and `Only me`, while its value remains `public`, `friends`, or `private`. The submit payload includes all four `*_visibility` keys. Render the owner **Favorites** section outside the library section: real cards link only to a real catalog detail route, while an empty list uses `EmptyState` with copy that favorites reflect taste rather than purchase intent. Do not fabricate cover URLs or counts.

- [ ] **Step 4: Run focused tests to verify they pass**

  Run: `rtk npm --prefix web test -- --run src/routes/-account.test.tsx src/components/ProfileView.test.tsx`  
  Expected: PASS for favorites ready/empty, full PATCH payload, pending, and error states.

- [ ] **Step 5: Commit owner profile changes**

  Run:

  ```text
  rtk git add web/src/routes/account.tsx web/src/routes/-account.test.tsx web/src/components/ProfileView.tsx web/src/components/ProfileView.test.tsx
  rtk git commit -m "feat: show favorites and full privacy settings"
  ```

## Task 5: Add the public-profile route and presentation

**Files:**
- Create: `web/src/components/PublicProfileView.tsx`
- Create: `web/src/components/PublicProfileView.test.tsx`
- Create: `web/src/routes/users.$publicId.tsx`
- Create: `web/src/routes/-users.$publicId.test.tsx`

**Interfaces:**
- Consumes: `PublicProfile`, `PublicDataBlock<T>`, `getPublicProfile`, `createSocialFriendRequest`, `ApiError`, `AppShell`, `GameCover`, `Panel`, `EmptyState`, and `ErrorState`.
- Produces: a canonical route that safely presents `ready`/`empty`/`hidden` sections and only the permitted friend-request action.

- [ ] **Step 1: Write failing presentation and route tests**

  In `PublicProfileView.test.tsx`, render a profile fixture with different status for each section. Assert `ready` shows returned title/cover, `empty` shows its neutral message, and `hidden` shows only `This section is private.`. Seed hidden `data` with `Secret Favorite`, `https://cover/private`, `17`, and `76561198000000000`; assert none appear in the DOM.

  Add relationship cases: anonymous has no add button; `none` exposes `Add friend` and calls `createSocialFriendRequest(public_id)`; `outgoing_pending`, `incoming_pending`, `friends`, and `self` do not submit a request; a rejected request shows an inline alert and re-enables the button.

  In `-users.$publicId.test.tsx`, build a memory router around `Route.options.component`, mock `getPublicProfile`, and assert query loading, loaded view, and neutral unavailable output for a rejected `ApiError(404, ...)`. Verify the public route has no auth-dependent friend action when no token/auth snapshot is present.

- [ ] **Step 2: Run focused tests to verify they fail**

  Run: `rtk npm --prefix web test -- --run src/components/PublicProfileView.test.tsx "src/routes/-users.$publicId.test.tsx"`  
  Expected: FAIL because neither component nor route exists.

- [ ] **Step 3: Implement presentation without client-side privacy inference**

  Create `PublicProfileView` with a small generic section renderer:

  ```tsx
  function PublicSection<T>({ title, block, renderReady }: {
    title: string;
    block: PublicDataBlock<T>;
    renderReady: (data: T) => ReactNode;
  }) {
    if (block.status === "hidden") return <EmptyState title={title} description="This section is private." />;
    if (block.status === "empty") return <EmptyState title={title} description={block.message ?? "Nothing to show yet."} />;
    return <section><SectionHeader title={title} />{renderReady(block.data)}</section>;
  }
  ```

  For `hidden`, do not inspect `block.data`, derive a length, or pass it to a child. Use returned ready data only: library and collection cards use their actual title/cover and link only when a real catalog ID exists; the Steam block uses the public Steam type and never accepts/constructs a Steam ID. The owner action is a `Link` to `/account`. Friend-request mutation exists only for signed-in, `relationship === "none"` visitors; callers lacking a nickname receive a clear setup explanation from the actual `409` error rather than a retry loop.

  Create `users.$publicId.tsx` using `createFileRoute('/users/$publicId')`, a TanStack Query keyed `['public-profile', publicId]`, and `AppShell`. Render a loading skeleton while pending; render the same neutral unavailable state for `404` and access errors; pass an authentication snapshot to the presentation component solely to decide whether authenticated actions may render. Do not add a loader that duplicates the query or fetches hidden sections.

- [ ] **Step 4: Run focused tests to verify they pass**

  Run: `rtk npm --prefix web test -- --run src/components/PublicProfileView.test.tsx "src/routes/-users.$publicId.test.tsx"`  
  Expected: PASS for ready/empty/hidden, no-leak, anonymous/authenticated relationship, friend-request, and unavailable cases.

- [ ] **Step 5: Generate only the router artifact locally and commit source files**

  Run the existing Vite route generation path through a focused test or `rtk npm --prefix web run build` as needed to verify route discovery. Inspect `web/src/routeTree.gen.ts`, but do not stage it.

  Then run:

  ```text
  rtk git add web/src/components/PublicProfileView.tsx web/src/components/PublicProfileView.test.tsx "web/src/routes/users.$publicId.tsx" "web/src/routes/-users.$publicId.test.tsx"
  rtk git commit -m "feat: add public profile route"
  ```

## Task 6: Run the required regression and release checks

**Files:**
- Modify only if a failure exposes a Phase 3 defect: the exact Phase 3 source/test file responsible for it.
- Do not modify: `web/src/routeTree.gen.ts`, `web/.output`, build output, or unrelated files.

**Interfaces:**
- Consumes: all completed Phase 3 behavior and tests.
- Produces: verification evidence suitable for a Phase 3 draft PR.

- [ ] **Step 1: Run the focused Phase 3 suites**

  Run:

  ```text
  rtk pytest tests/integration/backend/test_collections_price_alerts_api.py tests/integration/backend/test_profile_dashboard_psn_api.py tests/integration/backend/test_main_remaining_edges_api.py -q
  rtk npm --prefix web test -- --run src/lib/api.test.ts src/routes/-games.actions.test.tsx src/routes/-account.test.tsx src/components/ProfileView.test.tsx src/components/PublicProfileView.test.tsx "src/routes/-users.$publicId.test.tsx"
  ```

  Expected: PASS. If a result fails, invoke `systematic-debugging`, create a focused regression test first if missing, make the smallest fix, and rerun the failing command before continuing.

- [ ] **Step 2: Run complete automated checks**

  Run:

  ```text
  rtk pytest -q
  rtk npm --prefix web test
  rtk npm --prefix web run lint
  rtk npm --prefix web run build
  ```

  Expected: each command exits `0`. Preserve generated route/build changes as unstaged artifacts.

- [ ] **Step 3: Browser smoke the real local app**

  Start only local services with the documented environment and mocked/non-production test accounts. In the browser verify:

  1. A signed-in owner can add and remove an IGDB catalog favorite and sees the change on `/account`.
  2. The owner saves all four privacy controls and follows `/users/$publicId` to the obvious settings path.
  3. An anonymous visitor sees only public blocks and no authenticated action.
  4. An eligible signed-in viewer sends one friend request; a pending viewer cannot send another.
  5. A hidden favorite, wishlist, library, or Steam block exposes no title, cover, count, Steam ID, or private field.

- [ ] **Step 4: Inspect staging scope and commit any final Phase 3 correction**

  Run:

  ```text
  rtk git status --short
  rtk git diff --check
  rtk git diff --name-only
  ```

  Stage only intentional Phase 3 source/tests. If a release-check correction was necessary, commit it with a focused message such as `fix: preserve hidden public profile privacy`; otherwise do not create an empty commit.

- [ ] **Step 5: Prepare the draft PR only after verification evidence**

  Use the repository's GitHub workflow to open one Phase 3 draft PR. Its description must state the real favorite/profile/privacy contracts, link the test commands and results, and explicitly list the non-goals. Never include generated artifacts.
