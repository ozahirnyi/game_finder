# Full archive UI handoff — 2026-07-29

## User goal

Use `C:\Users\zagir\Downloads\lovable-project-cf1fe460.zip` as the exact visual source of truth for the whole frontend. Preserve every visual component, route, section, and button from the archive. Replace mock data and artificial delays with the existing FastAPI APIs; do not remove design elements because an API is not available yet.

The user explicitly requested inline work only (no subagents) and asked to continue until completion.

## Workspace and branch

- Worktree: `C:\Users\zagir\PycharmProjects\game_finder\.worktrees\archive-full-ui`
- Branch: `codex/archive-full-ui`
- Base: `origin/main` at `1549643` (PR #63 merge)
- Do not work in the root checkout: it is a stale/dirty branch (`codex/fastapi-archive-integration`).
- Do not alter the stale `main-production` worktree; production deploys from GitHub `main`.

## Important deployment finding

- GitHub Actions run `30416161313` deployed commit `1549643` successfully to Lightsail.
- It checked out `15496430a085f59318feafad6143547bd2a83d52`, rebuilt `game_finder-web`, and recreated the web container.
- `https://playfinder.cc` was inspected with `Invoke-WebRequest`: it was serving the earlier shortened home implementation, not the full UI of the supplied archive.
- The true cause was not deployment cache: the prior attempted archive copy used PowerShell `Copy-Item -LiteralPath` with a `*` wildcard, which copied nothing. The corrected copy used `Copy-Item -Path` and created the actual broad UI diff on the branch below.

## Commits on this branch

1. `cba9a81 docs: define complete archive UI port`
2. `a400639 docs: plan complete archive UI port`
3. `a232216 feat: port complete updated archive UI`
4. `5c62183 feat: wire archive homepage to live catalogue`
5. `7ed321c feat: wire archive shell to live data`
6. `42c2455 feat: wire archive service controls to backend`
7. `f054c71 feat: wire archive PSN import flow`
8. Search integration has been edited after the last listed commit but may still be uncommitted; check `git status --short` immediately.

## Completed work

### Complete visual port

`a232216` correctly copied the archive UI into `web/src`:

- routes, components, UI primitives, styles, theme, assets, and route tree;
- full archive homepage (the public `Find your next game` design, not the old `Play with friends tonight` dashboard);
- archive `GameCard`, profile, notifications, connected services, social auth, and PSN multi-step UI.

The production build passed directly after this port.

### Preserved backend client

`web/src/lib/api.ts` was preserved from the prior backend integration. It contains real functions for:

- catalogue: `searchGames`, `getTrendingGames`, `getCatalogGame`;
- prices: `getDeals`, `getPriceHistory`;
- authentication: email, Google OAuth, Steam OAuth, exchange callbacks;
- Steam connection/sync/unlink;
- PSN preview/confirm import;
- profile/library/wishlist/friends;
- notifications mark-read endpoints.

### Homepage

`web/src/routes/index.tsx` has been changed from archive mock data to:

- `searchGames(query)` for typeahead;
- `getDeals(region)` for price drops;
- `getTrendingGames()` query is currently created but its data is not yet rendered in the archive page;
- live deal `GameCard` props and internal game-detail links;
- visual friends panel intentionally retained, but currently uses a sign-in empty state rather than mock people.

The `FeaturedDeal` type is verbose but builds. The archive design is retained.

### App shell

`web/src/components/AppShell.tsx`:

- no longer imports `mockData`;
- gets deal count via `getDeals("US")`;
- observes auth via `useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot)`;
- gets signed-in profile via `getProfile`.

Known cleanup: the archive text `@{account.handle}` was not fully replaced, so signed-in sidebar secondary text may be blank/old-looking. Replace it with `Manage profile` or `@{profile.display_name}`.

### OAuth and connected services

`web/src/components/SocialAuthButtons.tsx`:

- removed `setTimeout` fake error;
- Google calls `getGoogleLoginUrl`, Steam calls `getSteamSignInUrl`, then assigns `window.location`.

`web/src/components/ConnectedServices.tsx`:

- was fully rewritten while keeping the archive visual row design;
- Google link calls `getGoogleLinkUrl`;
- Steam state calls `getSteamAccount`; connect calls `getSteamLinkUrl`; sync calls `syncSteamLibrary`; disconnect calls `unlinkSteamAccount`;
- PlayStation keeps archive button and links to `/psn-import`.

Google connected state is not exposed by the current `Profile` type/client, so it displays `Not connected` even if linked. Keep UI; add/consume the real backend field if available.

### PSN import

`web/src/routes/psn-import.tsx` retains the archive four-step UI.

- Upload uses `previewPsnImport(file)`.
- Preview maps returned game-title strings into archive rows `{ id, title, matched: true }`.
- Confirm uses `confirmPsnImport(selected)` and invalidates `library`.
- It no longer uses mock preview games or setTimeout for upload/confirm.

Known cleanup: `emptyPreview` still exists and `visibleRows` was introduced but rows are still read directly in the render. Remove the leftover test-only state/variable or consistently use `visibleRows`.

### Search

`web/src/routes/search.tsx` has been edited after `f054c71` (check status):

- uses `useQuery` and `searchGames(query)`;
- maps `CatalogGame` to archive `GameCard` props;
- keeps all archive filter/sort controls visually intact.

Known limitation: filter chips are presentation-only because the backend search endpoint has only a query parameter. Do not remove them; leave them as UI until the backend filtering contract exists.

## Remaining required integration work

Run this first to find all remaining mock use:

```powershell
rtk rg -n 'mockData|setTimeout' src -g '*.tsx' --max-count 100
```

At the time of this handoff, remaining imports were:

- `web/src/routes/account.tsx`
- `web/src/routes/deals.tsx`
- `web/src/routes/friends.$friendId.tsx`
- `web/src/routes/friends.index.tsx`
- `web/src/routes/games.$gameId.tsx`
- `web/src/components/NotificationsPanel.tsx`
- `web/src/components/ProfileView.tsx` (type import)
- `web/src/routes/library.tsx`
- `web/src/routes/wishlist.tsx`

### Recommended implementation order

1. **Library** — `getLibrary()`; map `LibraryGame` fields:
   - `id`, `title`, `source`, `notes`, `playtime_forever`, `cover_url`.
   - Tabs map `Steam -> steam`, `PlayStation -> psn`.
   - Do not invent catalogue game IDs for a library item; if backend does not expose one, preserve card UI but do not link to an invalid detail route.

2. **Wishlist** — `getWishlist()` and `removeWishlist(id)`:
   - `CollectionGame` fields: `id`, `catalog_game_id`, `title`, `cover_url`.
   - Link to `/games/$gameId` using `catalog_game_id`.
   - The archive price display has no price in `CollectionGame`; retain the price card visually as `Price unavailable` unless per-card price query is added.

3. **Deals and detail**:
   - `deals.tsx`: `getDeals(country)`, map `Deal.current` price/regular/cut/shop/background_image.
   - `games.$gameId.tsx`: `getCatalogGame(gameId)` plus `getPriceHistory(gameId)` and existing `addWishlist` mutation.
   - Detail page’s friends/price-history mock graph must remain visually; replace with available live price history and an honest empty state when data is absent.

4. **Profile and notifications**:
   - `account.tsx`: `getProfile()` and `getLibrary()`.
   - `NotificationsPanel.tsx`: `getNotifications`, `markNotificationRead`, `markAllNotificationsRead`.
   - Remove the profile theme card: user requires theme selection only in the sidebar (the archive `ProfileView` reintroduced it).

5. **Friends**:
   - `friends.index.tsx`, `friends.$friendId.tsx`: `getFriends()` first.
   - Existing backend friend response has only `user` data in the client type; preserve richer archive panels as empty/unavailable states rather than fake activity until the backend endpoints/types are extended.

## Known build/lint state

- `rtk npm run build` from `...\archive-full-ui\web` passes after all recent work.
- `rtk npm run lint -- --fix` reports no new formatting issues, but fails due to two pre-existing/archived `no-empty` errors in `web/src/lib/theme.tsx` at lines 103 and 120. It also reports existing Fast Refresh warnings in UI files.
- The current archive port lacks the old focused test files; add tests for new request wiring before release.

## Verification/release checklist

1. `rtk npm run lint` — fix `theme.tsx` empty blocks or document why they are needed.
2. `rtk npm test -- <focused test files>` and add tests for API wiring.
3. `rtk npm run build`.
4. Start local production preview and visually compare `/` against the supplied archive. Verify the hero includes:
   - description paragraph;
   - Search games button;
   - typeahead cards;
   - full Live deals/region/friends/CTA layout.
5. Push `codex/archive-full-ui`, create PR against `main`, and merge only after checks pass (user has already authorized merge/deploy in prior chat, but verify the final scope first).
6. Verify GitHub Actions Lightsail run and use `Invoke-WebRequest https://playfinder.cc` to confirm the generated asset hash and the full hero markup changed.

## Commands

```powershell
cd C:\Users\zagir\PycharmProjects\game_finder\.worktrees\archive-full-ui\web
rtk npm run build
rtk npm run lint
rtk rg -n 'mockData|setTimeout' src -g '*.tsx' --max-count 100
```

All shell commands in this repository must be prefixed with `rtk`; use `apply_patch` for normal source edits. Do not use subagents.
