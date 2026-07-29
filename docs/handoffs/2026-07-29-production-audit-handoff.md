# Production audit handoff — 2026-07-29

## Scope and latest merged changes

The latest merged PRs are:

- `#68` (`d3f0f1a`): authenticated home, Steam-backed library overview, PSN XLSX support.
- `#69` (`68e5b9e`): featured deal artwork, game-detail price-history crash, compact friend store labels, and removal of the favicon link.

There is an additional unmerged branch `codex/fix-live-game-steam-profile` with the same changes as PR #69; it is already merged and needs no further integration.

## What was verified locally

- `web`: `npm run build` completed successfully after the latest UI fixes.
- `web`: `npm test -- src/lib/api.test.ts` passed (7 tests).
- Earlier PSN parser verification passed: `pytest tests/test_psn_export.py -q` (4 tests).
- The game detail crash had a direct code cause: the page rendered `priceHistory.map(...)` although no `priceHistory` existed in `GameDetail`. This is fixed by deriving graph points from `getPriceHistory(...).deals` and passing them into `Sparkline`.

## Production audit blocker

The historical frontend/API Railway URL `https://game-finder.up.railway.app/` was opened in the browser on 2026-07-29 and returned Railway's **404 Not Found / The train has not arrived at the station** page. It cannot be used to validate the live user session.

The canonical production hostname is redacted as `https://example.com` in repository documentation and Nginx configuration. Before any live UI claim, obtain the real public hostname or restore the deployment/domain, then verify `/`, `/api/health`, and the deployment workflow for the merged SHA.

## Confirmed remaining work

### 1. Steam sign-in and library synchronization — highest priority

User report: Steam sign-in returns an error; the account can appear connected but no owned games or playtime appear.

Relevant chain:

- frontend: `web/src/components/ConnectedServices.tsx`, `web/src/lib/api.ts`;
- backend routes: `app/main.py` Steam auth/link/callback and `/library/overview`;
- Steam transport: `app/steam.py`, notably `fetch_owned_games` and profile retrieval.

Audit steps for the next chat:

1. Use the restored production URL while signed in as the user.
2. Start Steam linking and record the callback query/error safely (never expose tokens).
3. Call authenticated `/api/steam/account` and `/api/library/overview` in browser network/dev logs.
4. Confirm the backend has `STEAM_API_KEY`, correct `BACKEND_PUBLIC_URL`, and `FRONTEND_PUBLIC_URL` without printing secret values.
5. Verify `fetch_owned_games` returns records and that `playtime_forever` survives API serialization into the library UI.

### 2. Steam friends and friend identity

User report: Steam friend names do not show.

The friend route currently derives a profile from `getFriends()` in `web/src/routes/friends.$friendId.tsx`. Audit how `/friends` maps a Steam identity, whether `display_name` is present, and whether the Steam profile batch lookup falls back cleanly when it has no data. Do not render a blank name; use a stable fallback such as the profile handle/Steam ID only when real display data is unavailable.

### 3. Invite to Play and Message are visual-only controls

`web/src/components/ProfileView.tsx` renders plain buttons for both actions on another user's profile. They have no click handlers. Choose one explicit product behavior:

- wire Message to the existing direct-message API and an actual compose UI;
- wire Invite to Play to a defined invite API; or
- until those flows are implemented, render disabled explanatory controls rather than clickable no-ops.

### 4. Search journey must be tested on production

The user reported: entering `Portal` from the homepage led to a broken game detail page. The direct detail crash is fixed, but re-test this exact path after deployment:

1. type `Portal` on `/`;
2. choose a result and ensure its displayed title, card link ID, and detail title match;
3. submit/search navigation should preserve the query in `/search`;
4. test a result with and without price data.

### 5. Featured deal ID/data integrity

The featured card now renders `deal.background_image` and links with `deal.id`, but its integrity depends on `/prices/deals` returning a catalog-compatible ID. Validate one live card end-to-end: displayed deal name, target URL, and loaded catalog title must match. If they do not, backend pricing data needs an explicit `catalog_game_id` or a detail route must resolve the deal identifier before linking.

### 6. Friend profile visual QA

The large standalone `Connected stores` panel was removed for friend profiles. Steam/PSN status pills now appear in the avatar/name card, eliminating the right-side empty panel. Validate narrow and desktop breakpoints with a real friend who has: Steam only, PSN only, neither, and both.

### 7. Favicon verification

The frontend `rel=icon` entry was removed from `web/src/routes/__root.tsx`. After deployment, hard-refresh and inspect the browser tab. If an icon still appears, it is likely browser cache or an existing `public/favicon.ico`; then remove/neutralize the public asset only after confirming its exact path and build behavior.

## Known type-check debt (not introduced by the latest UI fixes)

`npm exec tsc -- --noEmit` still reported pre-existing errors in:

- `web/src/routes/friends.$friendId.tsx` / `friends.index.tsx` (`never` inferred for mock-style arrays);
- `web/src/routes/games.$gameId.tsx` (`never` arrays around owners/similar were present; priceHistory reference was fixed);
- `web/src/lib/api.test.ts` generic mock typing;
- `web/src/routes/search.tsx` nullable cover typing.

The Vite production build succeeds, but this debt prevents a clean strict TypeScript gate. Fix these while adding the production regression tests above.

## Working-tree caution

The local worktree used for the last UI branch had a modified `web/package-lock.json` caused by `npm install`; it was intentionally not committed. Do not include it unless dependency changes are actually required.
