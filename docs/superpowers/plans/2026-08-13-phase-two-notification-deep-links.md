# Phase 2: Notification Deep Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make actionable notifications open an authorized existing action context, become read only after navigation begins, and create deep-linkable in-app notifications for qualifying price alerts.

**Architecture:** Keep `notifications.payload` as its existing JSON column and add server-side payload builders rather than a migration or client-defined URLs. Extend the active `/friends` route with validated target search state and map notifications to that state through one pure frontend resolver. Extend the price-alert watcher narrowly to evaluate persisted owner alerts and add deduplicated `price_alert` notifications when `in_app` is selected, while retaining the legacy Telegram watcher path.

**Tech Stack:** Python 3, FastAPI, Pydantic, SQLAlchemy, pytest, React, TypeScript, Vite, TanStack Router/Query, Vitest, Testing Library.

## Global Constraints

- Implement only the approved Phase 2 notification-deep-link design from `docs/superpowers/specs/2026-08-13-phase-two-notification-deep-links-design.md`.
- Work from current verified `origin/main`; do not merge or reuse rejected mock/static PRs #142–145.
- Use `rtk` for every terminal command and `apply_patch` for edits; never stage `web/src/routeTree.gen.ts` or `web/.output`.
- Start every production change with the focused failing test and record RED before the minimum implementation and GREEN run.
- Preserve existing owner/participant authorization. Client route state is never authorization.
- Preserve active `/friends`, `/friends/$friendId`, `/games/$gameId`, `/deals`, legacy price-alert Telegram behavior, and all out-of-scope product surfaces.
- Mock price, Telegram, and external catalog providers in tests; do not use live network services.
- Remove the local-only notification-settings controls instead of presenting them as delivery preferences.

---

## File map

- `app/notifications.py` (new): trusted payload builders and one `create_notification` persistence boundary shared by FastAPI routes and the alert watcher.
- `app/main.py`: imports that boundary and supplies all stable IDs when creating social notifications.
- `app/price_alerts.py`: evaluates persisted `PriceAlert` + `WishlistItem` records and creates deduplicated `price_alert` notifications for the `in_app` channel.
- `tests/integration/backend/test_legacy_social_api.py`: endpoint-level payload and owner-scope coverage.
- `tests/test_price_alert_runner.py`: watcher qualification, channel, deduplication, and owner-isolation coverage.
- `web/src/lib/notificationNavigation.ts` (new): pure runtime validation from `Notification` to a TanStack destination.
- `web/src/lib/notificationNavigation.test.ts` (new): exact mapping and malformed-payload cases.
- `web/src/components/NotificationsPanel.tsx`: calls the resolver, begins navigation before marking read, renders unavailable feedback, and removes fake settings.
- `web/src/components/NotificationsPanel.test.tsx`: panel navigation/read timing and unavailable feedback.
- `web/src/routes/friends.index.tsx`: validates `request`, `conversation`, and `invite` search state; focuses matching owned targets; renders a neutral unavailable state.
- `web/src/routes/-friends.index.test.tsx`: real target and unavailable route-state coverage.

### Task 1: Establish trusted social-notification payload builders

**Files:**
- Create: `app/notifications.py`
- Modify: `app/main.py: notification helper and social notification producers`
- Modify: `tests/integration/backend/test_legacy_social_api.py`

**Consumes:** `Notification`, `FriendRequest`, `Conversation`, `GameInvite`, and existing authenticated social endpoints.

**Produces:** `create_notification(db, user_id, notification_type, payload)` plus builders that return only the approved JSON payload shapes.

- [ ] **Step 1: Write failing endpoint tests for every stable target.**

Add assertions after creating/accepting requests, messages, and invites. Assert the persisted recipient-owned notification payloads exactly include their stable ID; assert an accepting request notifies its sender with `friend_id`.

```python
assert notification.payload == {"request_id": str(request_id), "from": "Sender"}
assert accepted.payload == {"friend_id": str(recipient.id), "by": "Recipient"}
assert message_notice.payload["conversation_id"] == conversation_id
assert invite_notice.payload["invite_id"] == invite_id
assert response_notice.payload["invite_id"] == invite_id
```

- [ ] **Step 2: Run the social contract test and verify RED.**

Run: `rtk pytest tests/integration/backend/test_legacy_social_api.py -q`

Expected: FAIL because the accepted-request payload has no `friend_id`; direct payload construction is scattered in `app/main.py`.

- [ ] **Step 3: Add the minimal trusted builder module.**

Create `app/notifications.py` with typed functions and no request-derived URL fields:

```python
def create_notification(db: Session, user_id: UUID, notification_type: str, payload: dict[str, Any]) -> Notification:
    notification = Notification(user_id=user_id, type=notification_type, payload=payload)
    db.add(notification)
    return notification

def friend_request_accepted_payload(*, friend_id: UUID, by: str) -> dict[str, str]:
    return {"friend_id": str(friend_id), "by": by}
```

Also add equivalent builders for `friend_request`, `message`, `game_invite`, `game_invite_response`, and `price_alert` (requiring `catalog_game_id`). In `app/main.py`, import `create_notification` and these builders; remove the local duplicate helper. Use the request recipient as `friend_id` in `accept_friend_request`; keep all existing presentation fields.

- [ ] **Step 4: Run the focused test and verify GREEN.**

Run: `rtk pytest tests/integration/backend/test_legacy_social_api.py -q`

Expected: PASS.

- [ ] **Step 5: Commit the backend payload boundary.**

```powershell
rtk git add app/notifications.py app/main.py tests/integration/backend/test_legacy_social_api.py
rtk git commit -m "feat: add stable notification targets"
```

### Task 2: Add owner-scoped price-alert notification delivery

**Files:**
- Modify: `app/price_alerts.py`
- Modify: `app/database.py`
- Create: `alembic/versions/d13a20260813_add_price_alert_notification_key.py`
- Modify: `tests/test_price_alert_runner.py`
- Test: `tests/integration/backend/test_collections_price_alerts_api.py`

**Consumes:** Task 1's `create_notification`, `PriceAlert`, `WishlistItem`, `Notification`, `fetch_game_price_history`, and configured delivery channels.

**Produces:** one `price_alert` notification per owner/alert/new qualified offer when `in_app` is selected.

- [ ] **Step 1: Write failing watcher tests with fully local fixtures.**

Create an owner, wishlist item, price alert, and a mocked current deal. Cover threshold semantics, owner isolation, channels, and deduplication:

```python
alert = PriceAlert(user_id=owner.id, wishlist_item_id=item.id,
                   target_price=10.0, target_discount=50,
                   delivery_channels=["in_app"])

result = asyncio.run(check_price_alerts(db_session))
notice = db_session.query(Notification).one()
assert result.in_app_notifications_created == 1
assert notice.user_id == owner.id
assert notice.type == "price_alert"
assert notice.payload["catalog_game_id"] == item.catalog_game_id
```

Assert an alert matches only when every supplied threshold passes (`amount <= target_price` and `cut >= target_discount`), creates nothing for `delivery_channels=["telegram"]`, never creates a notice for another owner's alert, and does not duplicate the same offer key on a second run.

- [ ] **Step 2: Run the watcher tests and verify RED.**

Run: `rtk pytest tests/test_price_alert_runner.py -q`

Expected: FAIL because the watcher queries legacy manual `Game` records, ignores `PriceAlert`, and never writes `Notification`.

- [ ] **Step 3: Implement the narrow persisted-alert branch.**

Keep the legacy manual-game Telegram loop intact. Add a separate loop/helper that joins each `PriceAlert` to its owner-owned `WishlistItem`, uses the wishlist title for the existing price provider, and evaluates the current offer:

```python
def alert_matches(alert: PriceAlert, deal: dict[str, Any]) -> bool:
    amount = (deal.get("price") or {}).get("amount")
    cut = deal.get("cut")
    return (
        amount is not None and cut is not None
        and (alert.target_price is None or amount <= alert.target_price)
        and (alert.target_discount is None or cut >= alert.target_discount)
    )
```

Add nullable `PriceAlert.last_notification_key: Mapped[str | None]` and the revision `d13a20260813_add_price_alert_notification_key.py` with `revision = "d13a20260813"`, `down_revision = "b9c0d1e2f3a4"`, and `upgrade`/`downgrade` that add/drop `price_alerts.last_notification_key` as `String(255)`. Add `in_app_notifications_created: int = 0` to `PriceAlertRunResult` so existing Telegram `alerts_sent` semantics remain unchanged. For a newly observed `build_price_alert_key(deal)`, compare it with that field, create the `price_alert` notification when `"in_app" in alert.delivery_channels`, increment `in_app_notifications_created`, then set `last_notification_key` and `last_delivered_at` in the same commit. Include only offer presentation fields already returned by the provider; `catalog_game_id` is the navigation authority. Do not repurpose legacy `Game.price_alert_last_key` for a different entity.

- [ ] **Step 4: Verify focused GREEN and API regression coverage.**

Run: `rtk pytest tests/test_price_alert_runner.py tests/integration/backend/test_collections_price_alerts_api.py -q`

Expected: PASS; existing owner-scoped CRUD behavior remains unchanged.

- [ ] **Step 5: Commit the alert-delivery slice.**

```powershell
rtk git add app/price_alerts.py app/database.py alembic/versions tests/test_price_alert_runner.py tests/integration/backend/test_collections_price_alerts_api.py
rtk git commit -m "feat: deliver in-app price alert notifications"
```

### Task 3: Make `/friends` an existing deep-link action context

**Files:**
- Modify: `web/src/routes/friends.index.tsx`
- Modify: `web/src/routes/-friends.index.test.tsx`

**Consumes:** existing `getIncomingFriendRequests`, `getConversations`, and `getGameInvites` owner-/participant-scoped query functions.

**Produces:** validated `/friends?request=`, `/friends?conversation=`, and `/friends?invite=` states, with target focus or one neutral unavailable message.

- [ ] **Step 1: Add failing route tests for each accepted search target.**

Build the existing test router with search state. Assert a matching request/invite gets `data-notification-target="true"`; a matching conversation selects its participant and loads that conversation's messages. Assert each absent target renders exactly one neutral message.

```tsx
renderFriends({ initialEntries: ["/friends?invite=invite-1"] });
expect(await screen.findByTestId("notification-invite-invite-1")).toHaveAttribute(
  "data-notification-target", "true",
);

renderFriends({ initialEntries: ["/friends?conversation=gone"] });
expect(await screen.findByText("This notification action is no longer available.")).toBeInTheDocument();
```

Cover the same unavailable output for a missing request and invite. Do not mock an unscoped lookup endpoint.

- [ ] **Step 2: Run the focused route test and verify RED.**

Run: `rtk npm --prefix web test -- --run src/routes/-friends.index.test.tsx`

Expected: FAIL because `/friends` has no `validateSearch` or deep-link focus state.

- [ ] **Step 3: Implement validated state and focus.**

Add `validateSearch` accepting only non-empty strings for `request`, `conversation`, and `invite`. Derive a single `notificationTarget` from `Route.useSearch()`. Find it only in existing query results. For `conversation`, resolve its existing participant and use that participant ID as the selected friend; for request/invite, add an accessible target marker to the existing card. Once all needed query data has settled and no matching record is found, render the exact unavailable copy in an `aria-live="polite"` region. Keep ordinary `/friends` state unchanged.

- [ ] **Step 4: Run the focused route test and verify GREEN.**

Run: `rtk npm --prefix web test -- --run src/routes/-friends.index.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the friends deep-link slice.**

```powershell
rtk git add web/src/routes/friends.index.tsx web/src/routes/-friends.index.test.tsx
rtk git commit -m "feat: focus notification targets in friends"
```

### Task 4: Resolve notifications and navigate before marking read

**Files:**
- Create: `web/src/lib/notificationNavigation.ts`
- Create: `web/src/lib/notificationNavigation.test.ts`
- Modify: `web/src/components/NotificationsPanel.tsx`
- Modify: `web/src/components/NotificationsPanel.test.tsx`

**Consumes:** `Notification` from `web/src/lib/api.ts`, Task 1 payload shapes, Task 3 `/friends` search contract, and the active `/friends/$friendId` and `/games/$gameId` routes.

**Produces:** `notificationDestination(notification)` returning a valid TanStack destination or `null`; panel behavior that starts navigation then marks read.

- [ ] **Step 1: Write failing pure resolver tests.**

Assert every supported payload maps exactly and malformed/non-string IDs return `null`:

```ts
expect(notificationDestination({ type: "message", payload: { conversation_id: "c-1" } } as Notification))
  .toEqual({ to: "/friends", search: { conversation: "c-1" } });
expect(notificationDestination({ type: "price_alert", payload: { catalog_game_id: 42 } } as Notification))
  .toEqual({ to: "/games/$gameId", params: { gameId: "42" } });
expect(notificationDestination({ type: "game_invite", payload: {} } as Notification)).toBeNull();
```

- [ ] **Step 2: Write failing panel interaction tests and run RED.**

Mock `useNavigate` and assert it runs before `markNotificationRead` for an unread message. Test a read notification navigates without the mutation, and unsupported payload displays unavailable copy without either call.

Run: `rtk npm --prefix web test -- --run src/lib/notificationNavigation.test.ts src/components/NotificationsPanel.test.tsx`

Expected: FAIL because there is no resolver, router navigation, or unavailable feedback.

- [ ] **Step 3: Implement one guarded click path.**

Implement runtime guards and route mapping in `notificationNavigation.ts`; never pass arbitrary payload URL fields through. In the panel, use `useNavigate`, remove `showSettings`/`prefs` and its settings button, and use this click sequence:

```ts
const destination = notificationDestination(notification);
if (!destination) { setUnavailableId(notification.id); return; }
try {
  void navigate(destination);
  if (!notification.read_at) markRead.mutate(notification.id);
} catch {
  setUnavailableId(notification.id);
}
```

Render `This notification action is no longer available.` adjacent to the selected unsupported item with `aria-live="polite"`. Keep the existing explicit Mark all read action.

- [ ] **Step 4: Run focused frontend tests and verify GREEN.**

Run: `rtk npm --prefix web test -- --run src/lib/notificationNavigation.test.ts src/components/NotificationsPanel.test.tsx src/routes/-friends.index.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the panel navigation slice.**

```powershell
rtk git add web/src/lib/notificationNavigation.ts web/src/lib/notificationNavigation.test.ts web/src/components/NotificationsPanel.tsx web/src/components/NotificationsPanel.test.tsx
rtk git commit -m "feat: navigate notifications to real actions"
```

### Task 5: Full verification and browser smoke

**Files:** no production changes; only test adjustments required by the preceding tasks.

- [ ] **Step 1: Run all automated verification.**

```powershell
rtk pytest -q
rtk npm --prefix web test -- --run
rtk npm --prefix web run lint
rtk npm --prefix web run build
```

Expected: all commands pass; no generated output is staged.

- [ ] **Step 2: Perform browser smoke tests on the exact Phase 2 build.**

Verify an unread friend request opens the focused request; a message opens its conversation; incoming invite and response open their invite context; an in-app price alert opens the real game detail; each target is marked read only after click navigation starts; and deleted/unauthorized targets show the neutral unavailable state without leaked details or a crash.

- [ ] **Step 3: Review the publishable diff.**

Run: `rtk git status --short` and `rtk git diff --cached --check`.

Expected: only Phase 2 source/tests/migration documentation is staged; `web/src/routeTree.gen.ts` and `web/.output` are absent.

## Plan self-review

- Spec coverage: Tasks 1, 3, and 4 cover every social notification target, stable identifier, route state, read timing, unsupported payload, and unavailable state. Task 2 covers the separately audited in-app price-alert delivery gap with owner scope and deduplication.
- Security: every target is resolved through the current owner-/participant-scoped queries; unavailable output does not distinguish missing from forbidden.
- Scope: alert UI/presets, discovery, social redesign, Home, onboarding, and all other future phases remain excluded.
- Type consistency: Task 1 payload fields are the only fields Task 4 accepts, and Task 3 consumes exactly the `/friends` search keys Task 4 produces.
