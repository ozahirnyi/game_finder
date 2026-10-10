# Phase 0 Game Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each displayed game lead to its correct detail page and an appropriate owned, wishlist, store, or price-alert action, including a complete alert-to-offer path.

**Architecture:** Use provider-aware game identity and an owner-scoped membership lookup. Keep wishlist UUID as the stable alert target. Preserve unmatched AI suggestions without inventing a route. Store an offer snapshot in the notification and retrieve it by owner-scoped notification ID on the game page.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, pytest, TanStack React/Router/Query, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-phase-0-game-path-design.md`

## Global Constraints

- Start implementation from a freshly fetched `origin/main` on a unique `codex/<task-name>` branch, in the mandatory command order in `AGENTS.md`. The branch holding these documents is a planning branch, not an instruction to implement on it.
- Do not change production while implementing or testing. Do not use live IGDB, Redis, OpenAI, Steam, Google, Telegram, or price-provider calls in automated tests.
- Keep user-owned resources owner-scoped; another user's object returns `404` without revealing existence.
- Any model change includes an Alembic migration and a test of the changed contract.
- Set `DATABASE_URL` and `SECRET_KEY` before importing app modules in standalone scripts or tests that need them.
- Use `rtk` for shell commands. On Windows invoke npm through `npm.cmd`.

## File map and sequence

| Task | Main files | Reviewable result |
| --- | --- | --- |
| 1 | `app/game_identity.py`, `app/main.py`, `app/schemas.py`, `tests/integration/backend/test_game_membership_api.py` | Source-aware, owner-scoped membership response |
| 2 | `app/database.py`, `app/schemas.py`, `app/main.py`, `app/price_alerts.py`, `app/alert_ownership.py`, `alembic/versions/f2b0c4d6e8a1_pause_price_alerts.py`, focused pytest files | Alert targets wishlist UUID and pauses after ownership |
| 3 | `web/src/lib/api.ts`, `web/src/routes/games.$gameId.tsx`, `web/src/components/PriceAlertForm.tsx`, `web/src/routes/wishlist.tsx`, focused Vitest files | Correct owned, wishlist, and Steam-only actions |
| 4 | `app/recommendations.py`, `app/worker.py`, `web/src/routes/search.tsx`, `web/src/routes/index.tsx`, `web/src/routes/games.$gameId.tsx`, focused pytest and Vitest files | Every result has a safe destination or a visible search fallback |
| 5 | `app/notifications.py`, `app/price_alerts.py`, `app/main.py`, `app/schemas.py`, `web/src/lib/notificationNavigation.ts`, `web/src/components/NotificationsPanel.tsx`, `web/src/routes/games.$gameId.tsx`, focused tests | Notification opens the right game and saved offer |
| 6 | `tests/integration/backend/test_price_alert_journey_api.py`, `web/e2e/phase-zero-game-path.spec.ts`, `web/e2e/fixtures/api-fixtures.ts` | Controlled full-path evidence and browser acceptance |

Tasks 1 and 2 establish contracts used by Task 3. Task 4 can be reviewed independently after Task 1. Task 5 uses Task 2's wishlist identity and Task 3's game page. Task 6 is the final gate.

### Task 1: Source-aware library membership

**Files:** Create `app/game_identity.py`, `tests/integration/backend/test_game_membership_api.py`; modify `app/main.py`, `app/schemas.py`.

**Interfaces:** Consume `Game.owner_id`, `Game.source`, `Game.external_id`, and confirmed `Game.catalog_game_id`. Produce `owned_library_games(db: Session, user_id: UUID, *, catalog_game_id: int | None, steam_appid: int | None) -> list[Game]` and `GET /library/membership?catalog_game_id=<id>&steam_appid=<appid>` with `{owned, matches:[{id,source}]}`. Require at least one positive ID. Guests receive `401`.

- [ ] **Step 1: Write failing integration tests.** Create two users; give the first a Steam game with appid `730`, a linked PSN game with catalog ID `242408`, and a raw PSN title with no catalog ID. Assert the endpoint finds both confirmed routes, ignores the raw title, returns `owned:false` for the second user, rejects missing IDs with `422`, and does not confuse Steam appid `730` with catalog ID `730`.

```python
assert api_client.get('/library/membership?steam_appid=730').json()['matches'][0]['source'] == 'steam'
assert api_client.get('/library/membership?catalog_game_id=730').json()['owned'] is False
```

- [ ] **Step 2: Run** `rtk pytest tests/integration/backend/test_game_membership_api.py -q`; expect failure because the route does not exist.
- [ ] **Step 3: Implement the query and route.** Filter every query by `Game.owner_id == current_user.id`. Match Steam only with `Game.source == 'steam'` and string appid; match catalog identity only with a confirmed `catalog_game_id`. Exclude quarantined PSN entries. Deduplicate by `Game.id`. Return no title-derived matches.
- [ ] **Step 4: Run the focused test**, then `rtk pytest tests/integration/backend/test_auth_games_api.py -q`; expect both commands to exit zero.
- [ ] **Step 5: Commit** the four files with `rtk git commit -m "feat: expose owner scoped game membership"` after staging them.

### Task 2: Stable alert target and automatic pause

**Files:** Create `app/alert_ownership.py`, `alembic/versions/f2b0c4d6e8a1_pause_price_alerts.py`, `tests/test_alert_ownership.py`; modify `app/database.py`, `app/schemas.py`, `app/main.py`, `app/price_alerts.py`, `app/steam_library.py`, `tests/integration/backend/test_collections_price_alerts_api.py`, `tests/test_price_alert_runner.py`, `tests/test_migration_graph.py`.

**Interfaces:** Consume Task 1's identity helper. `PriceAlertCreate` accepts `wishlist_item_id: UUID`; the legacy `wishlist_catalog_game_id: int` remains accepted only for a source=`catalog` wishlist item. `PriceAlertRead` adds `wishlist_item_id`, `source`, `external_id`, `paused_at`, and `pause_reason`. `pause_owned_alerts(db: Session, user_id: UUID) -> int` sets `paused_at` once for matching active alerts and creates one `price_alert_paused` in-app notice per paused alert. The watcher skips paused alerts.

- [ ] **Step 1: Write failing contract tests.** Create catalog ID `730` and Steam appid `730` wishlist items for the same owner. Create one alert for each by UUID; assert two distinct `PriceAlert.wishlist_item_id` values. Assert a legacy numeric request resolves the catalog item only, and another user's UUID returns `404`. Assert an owned game cannot be newly wishlisted or alerted through a direct API call. Assert a Steam ownership sync pauses only the Steam alert, repeated sync creates no second notice, and the watcher sends nothing for the paused alert.

```python
created = api_client.post('/price-alerts', json={
    'wishlist_item_id': steam_wishlist['id'],
    'target_discount': 25,
    'delivery_channels': ['in_app'],
})
assert created.status_code == 201
assert created.json()['source'] == 'steam'
```

- [ ] **Step 2: Run** `rtk pytest tests/integration/backend/test_collections_price_alerts_api.py tests/test_alert_ownership.py -q`; expect the UUID request and pause assertions to fail.
- [ ] **Step 3: Add the migration.** Use revision `f2b0c4d6e8a1`, down revision `f1a2b3c4d5e6`, and nullable `price_alerts.paused_at TIMESTAMP WITH TIME ZONE` plus `price_alerts.pause_reason VARCHAR(32)`. `upgrade()` adds both columns; `downgrade()` drops them. Update the SQLAlchemy model and migration graph assertion.
- [ ] **Step 4: Implement alert creation and pause.** Resolve UUID with `WishlistItem.id` and `WishlistItem.user_id`; resolve legacy number with `WishlistItem.source == 'catalog'`. Use the Task 1 identity query before accepting a new wishlist item or alert. Invoke `pause_owned_alerts` after Steam snapshot persistence, PlayStation import/link, and manual library creation, inside the same database transaction where possible. Keep the watcher-side ownership check before sending. In the watcher, query only alerts with `paused_at IS NULL`.
- [ ] **Step 5: Run** `rtk pytest tests/integration/backend/test_collections_price_alerts_api.py tests/test_alert_ownership.py tests/test_price_alert_runner.py tests/test_migration_graph.py -q`; expect zero failures. Run an Alembic upgrade and downgrade against a disposable test database and check both columns appear and disappear.
- [ ] **Step 6: Commit** the task files with `rtk git commit -m "feat: target alerts by wishlist entry and pause owned games"`.

### Task 3: Detail-page action states

**Files:** Modify `web/src/lib/api.ts`, `web/src/routes/games.$gameId.tsx`, `web/src/components/PriceAlertForm.tsx`, `web/src/routes/wishlist.tsx`; update `web/src/routes/-games.actions.test.tsx`, `web/src/routes/-games.detail.test.tsx`, `web/src/components/PriceAlertForm.test.tsx`, `web/src/routes/-wishlist.test.tsx`.

**Interfaces:** Consume `GET /library/membership`, provider-aware `CollectionGame.id`, and Task 2's UUID alert contract. `PriceAlertForm` emits target thresholds and channels; its parent adds the selected `wishlist_item_id`. An owned state renders a library link and no wishlist or alert controls. Query errors render an explicit unavailable membership state instead of asserting that the game is unowned.

- [ ] **Step 1: Add failing Vitest cases.** Test owned Steam, linked PSN, and linked manual records; unowned catalog and Steam-only records; a membership API failure; and a Steam-only alert that first calls `/wishlist/steam-games/<appid>` then posts that response's UUID to `/price-alerts`. Test that equal numeric Steam and catalog IDs do not make the UI select the other provider's wishlist entry.

```tsx
expect(screen.getByText('In your library')).toBeInTheDocument();
expect(screen.queryByRole('button', { name: 'Alert' })).not.toBeInTheDocument();
expect(api.createPriceAlert).toHaveBeenCalledWith(expect.objectContaining({ wishlist_item_id: 'steam-wishlist-id' }));
```

- [ ] **Step 2: Run** `rtk proxy npm.cmd run test -- src/routes/-games.actions.test.tsx src/routes/-wishlist.test.tsx` from `web`; expect the new assertions to fail.
- [ ] **Step 3: Add `getGameMembership` to the API client and key its query by both IDs and account.** Derive `catalog_game_id` from the resolved catalog detail and `steam_appid` from the verified Steam detail. Show the owned source and Library link. Reuse existing provider-specific wishlist endpoints. For a saved item, use `item.id` to create an alert. Update the wishlist alert selector to use UUID values rather than numeric IDs; show paused status rather than treating it as active.
- [ ] **Step 4: Run** the four focused Vitest files and `rtk proxy npm.cmd run build` from `web`; expect exit zero. Confirm the build type-checks the changed API contract.
- [ ] **Step 5: Commit** the task files with `rtk git commit -m "feat: align game actions with ownership and Steam alerts"`.

### Task 4: Safe destinations from discovery and recommendations

**Files:** Modify `app/recommendations.py`, `app/worker.py`, `web/src/routes/search.tsx`, `web/src/routes/index.tsx`, `web/src/routes/games.$gameId.tsx`; update `tests/test_recommendation_enrichment.py`, `web/src/routes/-search.test.tsx`, `web/src/routes/-index.recommendations.test.tsx`, `web/src/routes/-games.loader.test.ts`, `web/src/lib/gameRoute.test.ts`.

**Interfaces:** Each AI item keeps `title`, `reason`, and `tags` and gains a resolution state: `matched`, `unmatched`, or `catalog_unavailable`. Only `matched` has a verified `game.id`. Existing home recommendation items without a valid IGDB ID keep their search fallback. `gameDetailTarget(catalogId, steamAppId)` remains the route constructor.

- [ ] **Step 1: Write failing tests.** Stub catalog batch results with an exact hit, a title variant with no exact hit, and a provider failure. Assert all three AI suggestions remain visible, only the exact hit links to `/games/<IGDB ID>`, and the others link to `/search?q=<title>` with distinct messages. Assert a Steam-only ordinary-search card routes with `source=steam`. Assert a stale catalog ID never silently opens another game found through a prefix title match.

```python
assert [item['resolution_status'] for item in result] == [
    'matched', 'unmatched', 'catalog_unavailable'
]
```

- [ ] **Step 2: Run** `rtk pytest tests/test_recommendation_enrichment.py -q` and the four focused Vitest files; expect new cases to fail.
- [ ] **Step 3: Preserve unresolved AI items in `enrich_recommendations` and expose their status through the background-job result.** On provider failure, preserve each suggestion with `catalog_unavailable`. In Search, render a text result and search action when no verified `game.id` exists. Keep the reason visible. In the detail loader, retain exact ID validation and replace silent title-based substitution with a recoverable unavailable result/search link. Do not construct a route from a title or a merely similar catalog candidate.
- [ ] **Step 4: Run** the focused backend and frontend tests, then `rtk proxy npm.cmd run build` from `web`; expect exit zero.
- [ ] **Step 5: Commit** the task files with `rtk git commit -m "fix: keep unresolved recommendations and safe game routes"`.

### Task 5: Offer snapshot in alert notifications

**Files:** Modify `app/notifications.py`, `app/price_alerts.py`, `app/main.py`, `app/schemas.py`, `web/src/lib/api.ts`, `web/src/lib/notificationNavigation.ts`, `web/src/components/NotificationsPanel.tsx`, `web/src/routes/games.$gameId.tsx`; update `tests/test_price_alert_runner.py`, `tests/integration/backend/test_collections_price_alerts_api.py`, `web/src/lib/notificationNavigation.test.ts`, `web/src/components/NotificationsPanel.test.tsx`, `web/src/routes/-games.detail.test.tsx`.

**Interfaces:** `price_alert_payload` includes `source`, `external_id`, `offer: {shop, price, currency, discount, url, observed_at}`, and catalog ID for old clients when the item is catalog-backed. `GET /notifications/{notification_id}` returns only the current user's notification or `404`. `notificationDestination` returns `/games/$gameId` plus `source=steam` for Steam targets and `offer=<notification ID>` for new price alerts. Legacy payloads containing only `catalog_game_id` keep their old route. The notification panel describes `price_alert_paused` as an alert stopped because the game is now in the library.

- [ ] **Step 1: Write failing tests.** Mock a priced Steam-only item and a priced catalog item. Run the watcher and assert distinct source-aware payloads with the saved offer, no duplicate in-app notification for the same offer key, and no delivery-key update after a failed Telegram send. Assert `GET /notifications/<id>` returns `404` to another user. Assert the frontend routes a new Steam alert to `/games/<appid>?source=steam&offer=<notification ID>`, preserves a legacy catalog route, shows the offer after a page reload, and explains an automatic alert pause.

```ts
expect(notificationDestination(steamAlert)).toEqual({
  to: '/games/$gameId',
  params: { gameId: '730' },
  search: { source: 'steam', offer: 'notification-id' },
});
```

- [ ] **Step 2: Run** the focused pytest and Vitest files; expect payload, route, and offer assertions to fail.
- [ ] **Step 3: Build the payload from the provider's `current` offer before committing the notification.** Include the observed UTC time and provider URL. Extend the notification panel navigation without discarding its `source` and `offer` search fields when adding `returnTo`. Validate `offer` as a UUID in the game route search contract; fetch its notification through the owner-scoped endpoint and show a prominent saved-offer panel with price, store, timestamp, and external link. For missing/deleted offers, show a neutral message and keep the game detail available.
- [ ] **Step 4: Run** the focused tests and `rtk proxy npm.cmd run build` from `web`; expect zero failures.
- [ ] **Step 5: Commit** the task files with `rtk git commit -m "feat: open price notifications on the matched offer"`.

### Task 6: Full-path and release verification

**Files:** Create `tests/integration/backend/test_price_alert_journey_api.py`, `web/e2e/phase-zero-game-path.spec.ts`; modify `web/e2e/fixtures/api-fixtures.ts` to expose source-aware membership, UUID alert, and saved-notification fixtures. Adjust existing `web/e2e/search-collections-alerts.spec.ts` and `web/e2e/notifications.spec.ts` to the new contract.

**Interfaces:** The backend integration test uses the existing `api_client`, `db_session`, `user_factory`, and `auth_as` fixtures. The browser spec uses the existing Playwright `page`, `api`, and `waitForHydration` fixtures. No real external price or messaging service is called.

- [ ] **Step 1: Add one backend journey test.** Authenticate a user, save a Steam-only game to wishlist, post a UUID-targeted alert, inject a sale through the mocked price provider, run `check_persisted_price_alerts`, list the created notification, fetch its saved offer, and verify the duplicate run creates no second notification. Include a second user and assert that user gets `404` for the notification and cannot alter the alert.
- [ ] **Step 2: Add one Playwright journey spec.** Start from ordinary search, open a Steam-only game, save the alert, inject a matching notification through the fixture, click it, assert the URL still contains `source=steam`, assert the saved offer panel and its store URL, and navigate back. Add separate cases for an owned catalog game and an unmatched AI suggestion. Keep `web/e2e-business` unchanged because it targets a deployed environment.
- [ ] **Step 3: Run** `rtk pytest tests/integration/backend/test_price_alert_journey_api.py -q`; expect zero failures. From `web`, run `rtk proxy npm.cmd run test:ui -- phase-zero-game-path.spec.ts`; expect zero failures.
- [ ] **Step 4: Run release gates.** From repository root: `rtk pytest` and `rtk proxy python scripts/check_backend_coverage.py`. From `web`: `rtk proxy npm.cmd run test`, `rtk proxy npm.cmd run lint`, `rtk proxy npm.cmd run build`, and `rtk proxy npm.cmd run test:ui`. Investigate any failure before claiming Phase 0 complete. Run the backend migration against the disposable test database.
- [ ] **Step 5: Perform browser acceptance in a non-production environment** with a seeded owned Steam item, linked PSN item, raw PSN item, Steam-only item, resolved and unresolved AI suggestions, and a controlled offer. Record the actual URL and visible result for each path. A production check may be read-only and must not be used to trigger a real alert without separate deployment authorization.
- [ ] **Step 6: Commit** the journey tests and fixture updates with `rtk git commit -m "test: cover complete phase zero game path"`. Summarize evidence and any remaining limitation; do not report production alert delivery unless it was actually observed.

## Self-review checklist

- Every Phase 0 requirement in the spec maps to one task above: owned state (1–3), provider-aware Steam wishlist/alert (2–3), ordinary/home/AI routes (4), offer notification (5), and full-path verification (6).
- Recheck signatures and JSON names when implementing: `wishlist_item_id` is a UUID, `external_id` is a string, and `catalog_game_id` and `steam_appid` never share a namespace. Route search fields are `source`, `offer`, and `returnTo`.
- Check the migration head again after a fresh implementation-task fetch; the revision named here descends from `f1a2b3c4d5e6` at the planning baseline.
