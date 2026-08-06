# Price Alerts, Wishlist, and Price Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver owner-scoped wishlists, configurable price alerts, and actionable price notifications without adding social features or mock data.

**Architecture:** SQLAlchemy models and one Alembic revision establish owner-scoped wishlist, alert, and price-notification records. FastAPI routes use typed schemas and small services; the watcher evaluates persisted alerts, creates price notifications, and optionally calls Telegram. The Vite app uses typed API functions and focused feature components in the catalog detail, real wishlist route, and shell notification center.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, pytest, Vite, React, TanStack Router, Vitest.

## Global Constraints

- Do not add friend, message, invite, favorite, profile/privacy, onboarding, Party Finder, Groups, or Discord functionality.
- Notification events in this delivery are price-alert/deal events only; do not claim social deep links are complete.
- Every resource query and mutation is authenticated and owner-scoped; never return another user's wishlist, alert, or notification.
- A visible control must mutate real state, navigate to a real route, or be absent.
- `any_discount` means a current deal with `cut > 0`; it must never be a cosmetic preset.
- Telegram is selectable only when both configured and linked. Unsupported Steam price identities show an explanation.
- Never commit generated `web/.output` artifacts.

## File Structure

- `app/database.py` — `WishlistItem`, `PriceAlert`, and `Notification` SQLAlchemy models and owner/duplicate indexes.
- `alembic/versions/<revision>_add_retention_models.py` — creates/drops all three tables and indexes.
- `app/schemas.py` — request/response DTOs and mode/target validation.
- `app/retention.py` — owner-scoped CRUD and price-notification creation helpers.
- `app/main.py` — authenticated wishlist, alert, and notification routes.
- `app/price_alerts.py` — evaluate persisted alerts and channel delivery.
- `tests/test_retention.py` — schema/service/API ownership and duplicate tests.
- `tests/test_price_alerts.py` — watcher condition/deduplication/delivery tests.
- `web/src/lib/api.ts` — retention DTOs and request functions.
- `web/src/features/retention/AlertControls.tsx` — presets, threshold fields, channels, and existing-alert list.
- `web/src/features/retention/AlertControls.test.tsx` — alert UI payload/channel/duplicate tests.
- `web/src/features/retention/NotificationsMenu.tsx` — price-notification list, navigation, and mark-read timing.
- `web/src/features/retention/NotificationsMenu.test.tsx` — target/unavailable/read tests.
- `web/src/features/retention/WishlistScreen.tsx` — real owner wishlist with controls.
- `web/src/features/retention/WishlistScreen.test.tsx` — list/empty/error/add/remove/alert tests.
- `web/src/features/discovery/GameDetailScreen.tsx` — real wishlist and alert composition for catalog games.
- `web/src/routes/wishlist.tsx`, `web/src/components/AppShell.tsx` — route and shell integration.

---

### Task 1: Persist and validate retention records

**Files:**
- Modify: `app/database.py`, `app/schemas.py`
- Create: `app/retention.py`, `alembic/versions/<revision>_add_retention_models.py`, `tests/test_retention.py`

**Interfaces:**
- Produces `WishlistItemCreate`, `PriceAlertCreate`, `PriceAlertRead`, `PriceNotificationRead`, `create_wishlist_item(db, user, data)`, and `create_price_alert(db, user, data, telegram)`.

- [ ] **Step 1: Write failing DTO and owner-isolation tests**

```python
def test_price_alert_rejects_bad_mode_threshold_pair():
    with pytest.raises(ValidationError):
        PriceAlertCreate(identity_kind="rawg", identity_value="30", title="Hades", mode="any_discount", threshold=10, in_app=True, telegram=False)

def test_wishlist_service_never_lists_other_owner_items(db, alice, bob):
    create_wishlist_item(db, alice, WishlistItemCreate(identity_kind="rawg", identity_value="30", title="Hades"))
    assert list_wishlist_items(db, bob.id) == []
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk pytest -q tests/test_retention.py`

Expected: FAIL because the retention schemas and service do not exist.

- [ ] **Step 3: Implement the models, migration, DTOs, and services**

```python
class PriceAlertCreate(BaseModel):
    identity_kind: Literal["rawg", "steam"]
    identity_value: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)
    mode: Literal["target_price", "target_discount", "any_discount"]
    threshold: float | None = Field(default=None, gt=0)
    in_app: bool = True
    telegram: bool = False

    @model_validator(mode="after")
    def validate_threshold(self):
        if (self.mode == "any_discount") != (self.threshold is None):
            raise ValueError("any_discount must not have a threshold")
        if self.mode != "any_discount" and self.threshold is None:
            raise ValueError("A target price or discount is required")
        if not self.in_app and not self.telegram:
            raise ValueError("Choose at least one delivery channel")
        return self
```

Add owner foreign keys, timestamps, and unique `(user_id, identity_kind, identity_value)` wishlist identity. Add the alert uniqueness key where threshold is non-null; `create_price_alert` checks all existing owner alerts and raises `HTTPException(409, "You already have this price alert.")` before insert. Write explicit Alembic `upgrade()`/`downgrade()` operations matching the models.

- [ ] **Step 4: Run focused tests and migration check**

Run: `rtk pytest -q tests/test_retention.py`

Expected: PASS.

Run: `rtk alembic upgrade head`

Expected: the retention revision applies successfully.

- [ ] **Step 5: Commit**

Run: `rtk git add app/database.py app/schemas.py app/retention.py alembic/versions tests/test_retention.py`

Run: `rtk git commit -m "feat: add persisted retention models"`

### Task 2: Expose authenticated wishlist, alert, and notification APIs

**Files:**
- Modify: `app/main.py`, `tests/test_retention.py`

**Interfaces:**
- Produces `GET/POST/DELETE /wishlist`, `GET/POST/DELETE /price-alerts`, `GET /notifications`, and `POST /notifications/{notification_id}/read`.

- [ ] **Step 1: Write failing route tests**

```python
def test_alert_duplicate_is_owner_scoped_409(client, auth_headers, alert_payload):
    assert client.post("/price-alerts", json=alert_payload, headers=auth_headers).status_code == 201
    response = client.post("/price-alerts", json=alert_payload, headers=auth_headers)
    assert response.status_code == 409
    assert response.json()["detail"] == "You already have this price alert."

def test_mark_read_rejects_another_users_notification(client, alice_headers, bob_notification):
    assert client.post(f"/notifications/{bob_notification.id}/read", headers=alice_headers).status_code == 404
```

- [ ] **Step 2: Run RED tests**

Run: `rtk pytest -q tests/test_retention.py -k "duplicate or mark_read"`

Expected: FAIL because routes are absent.

- [ ] **Step 3: Implement thin owner-scoped routes**

```python
@app.post("/price-alerts", status_code=201, response_model=PriceAlertRead)
def create_alert(data: PriceAlertCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return create_price_alert(db, current_user, data, telegram_account_response(current_user))

@app.post("/notifications/{notification_id}/read", response_model=PriceNotificationRead)
def mark_notification_read(notification_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return mark_price_notification_read(db, current_user.id, notification_id)
```

Use a 404 for absent or foreign IDs, return ordered newest-first DTOs, and make delete idempotently owner-scoped with 204 only for an owned record.

- [ ] **Step 4: Run focused API tests**

Run: `rtk pytest -q tests/test_retention.py`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `rtk git add app/main.py tests/test_retention.py`

Run: `rtk git commit -m "feat: add retention APIs"`

### Task 3: Make the watcher evaluate persisted alerts and create price notifications

**Files:**
- Modify: `app/price_alerts.py`, `tests/test_price_alerts.py`

**Interfaces:**
- Consumes `PriceAlert` and `create_price_notification`.
- Produces `alert_matches_deal(alert, deal) -> bool` and per-alert deduplicated in-app/Telegram delivery.

- [ ] **Step 1: Write failing watcher tests**

```python
def test_any_discount_matches_only_positive_cut():
    assert alert_matches_deal(alert(mode="any_discount"), {"cut": 25, "price": {"amount": 10, "currency": "USD"}})
    assert not alert_matches_deal(alert(mode="any_discount"), {"cut": 0, "price": {"amount": 10, "currency": "USD"}})

async def test_matching_alert_creates_in_app_notification_without_telegram(monkeypatch, db):
    alert = make_alert(db, in_app=True, telegram=False)
    await check_price_alerts(db)
    assert db.query(Notification).filter_by(price_alert_id=alert.id).count() == 1
    send_telegram_message.assert_not_called()
```

- [ ] **Step 2: Run RED tests**

Run: `rtk pytest -q tests/test_price_alerts.py`

Expected: FAIL because the watcher still iterates Steam-library games.

- [ ] **Step 3: Replace the watcher input and delivery logic**

```python
def alert_matches_deal(alert: PriceAlert, deal: dict[str, Any]) -> bool:
    price = (deal.get("price") or {}).get("amount")
    cut = deal.get("cut") or 0
    if price is None:
        return False
    if alert.mode == "any_discount": return cut > 0
    if alert.mode == "target_price": return price <= alert.threshold
    return cut >= alert.threshold
```

Fetch each alert's supported identity price data; store a per-alert deal key after successful delivery, create the in-app row when enabled, and call Telegram only when `alert.telegram` and the owner has a chat ID. Retire use of `Game.price_alert_*` as the watcher state.

- [ ] **Step 4: Run watcher tests**

Run: `rtk pytest -q tests/test_price_alerts.py tests/test_retention.py`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `rtk git add app/price_alerts.py tests/test_price_alerts.py tests/test_retention.py`

Run: `rtk git commit -m "feat: deliver persisted price alerts"`

### Task 4: Add typed browser retention API and alert controls

**Files:**
- Modify: `web/src/lib/api.ts`, `web/src/features/discovery/GameDetailScreen.tsx`
- Create: `web/src/features/retention/AlertControls.tsx`, `web/src/features/retention/AlertControls.test.tsx`

**Interfaces:**
- Produces `listPriceAlerts`, `createPriceAlert`, `deletePriceAlert`, `listWishlist`, and `<AlertControls identity title alerts />`.

- [ ] **Step 1: Write failing component tests**

```tsx
it("sends target-discount and selected channels", async () => {
  render(<AlertControls identity={{ kind: "rawg", value: "30" }} title="Hades" alerts={[]} telegram={{ linked: true, configured: true }} />)
  await user.click(screen.getByRole("radio", { name: /target discount/i }))
  await user.type(screen.getByLabelText(/discount/i), "35")
  await user.click(screen.getByLabelText(/telegram/i))
  await user.click(screen.getByRole("button", { name: /create alert/i }))
  expect(createPriceAlert).toHaveBeenCalledWith(expect.objectContaining({ mode: "target_discount", threshold: 35, telegram: true }))
})
```

- [ ] **Step 2: Run RED test**

Run: `rtk npm.cmd --prefix web test -- --run src/features/retention/AlertControls.test.tsx`

Expected: FAIL because the component and API functions are absent.

- [ ] **Step 3: Implement typed API and controls**

Define DTOs exactly matching FastAPI. Render existing alerts, three real mode radios, only the relevant numeric field, in-app checked by default, a disabled Telegram checkbox plus `Connect Telegram in Profile` route when unavailable, 409 detail text, deletion action, and an explicit Steam unsupported panel. Compose the control after successful game/price data in `GameDetailScreen`.

- [ ] **Step 4: Run component tests and lint**

Run: `rtk npm.cmd --prefix web test -- --run src/features/retention/AlertControls.test.tsx`

Expected: PASS.

Run: `rtk npm.cmd --prefix web run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `rtk git add web/src/lib/api.ts web/src/features/retention web/src/features/discovery/GameDetailScreen.tsx`

Run: `rtk git commit -m "feat: add price alert controls"`

### Task 5: Replace mock wishlist with the owner-scoped surface

**Files:**
- Modify: `web/src/routes/wishlist.tsx`
- Create: `web/src/features/retention/WishlistScreen.tsx`, `web/src/features/retention/WishlistScreen.test.tsx`

**Interfaces:**
- Consumes `listWishlist`, `deleteWishlistItem`, price alerts, and `AlertControls`.
- Produces a real `/wishlist` with controlled loading, empty, error, item remove, and alert states.

- [ ] **Step 1: Write failing UI tests**

```tsx
it("renders only API wishlist items and their existing alerts", async () => {
  vi.mocked(listWishlist).mockResolvedValue([{ id: "w1", identity_kind: "rawg", identity_value: "30", title: "Hades" }])
  render(<WishlistScreen />)
  expect(await screen.findByText("Hades")).toBeVisible()
  expect(screen.queryByText("Baldur's Gate 3")).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run RED test**

Run: `rtk npm.cmd --prefix web test -- --run src/features/retention/WishlistScreen.test.tsx`

Expected: FAIL because the route reads `mockData`.

- [ ] **Step 3: Implement and integrate the real route**

Use `WishlistScreen` from `routes/wishlist.tsx`; remove every `mockData` import and inert button. Render remove only for its real API action and add each item's alert controls. The empty state links to `/search`; errors offer a real retry. Do not invent friend counts, price history, or deals.

- [ ] **Step 4: Run focused tests**

Run: `rtk npm.cmd --prefix web test -- --run src/features/retention/WishlistScreen.test.tsx src/features/retention/AlertControls.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `rtk git add web/src/routes/wishlist.tsx web/src/features/retention/WishlistScreen.tsx web/src/features/retention/WishlistScreen.test.tsx`

Run: `rtk git commit -m "feat: add real wishlist alerts"`

### Task 6: Add price-notification navigation and completion verification

**Files:**
- Modify: `web/src/components/AppShell.tsx`
- Create: `web/src/features/retention/NotificationsMenu.tsx`, `web/src/features/retention/NotificationsMenu.test.tsx`

**Interfaces:**
- Consumes `listNotifications`, `markNotificationRead`.
- Produces a shell menu that routes a price notification to `/games/$gameId`, opens `offer_url`, or renders its controlled unavailable state.

- [ ] **Step 1: Write failing navigation/read tests**

```tsx
it("navigates before marking a price notification read", async () => {
  const order: string[] = []
  render(<NotificationsMenu navigate={() => order.push("navigate")} markRead={async () => order.push("read")} />)
  await user.click(await screen.findByRole("button", { name: /Hades is on sale/i }))
  expect(order).toEqual(["navigate", "read"])
})
```

- [ ] **Step 2: Run RED test**

Run: `rtk npm.cmd --prefix web test -- --run src/features/retention/NotificationsMenu.test.tsx`

Expected: FAIL because no price-notification component exists.

- [ ] **Step 3: Implement the real menu**

Use only price notification DTO fields. Require a positive catalog game ID for an internal route; use a valid HTTPS offer URL only as external navigation. For missing/revoked/deleted targets, keep the user in the menu and render `This price alert is no longer available.`; do not mark it read on failed navigation intent. Add the menu to authenticated `AppShell` only.

- [ ] **Step 4: Run full verification**

Run: `rtk pytest -q`

Expected: PASS.

Run: `rtk npm.cmd --prefix web test -- --run`

Expected: PASS.

Run: `rtk npm.cmd --prefix web run lint`

Expected: PASS.

Run: `rtk npm.cmd --prefix web run build`

Expected: PASS.

Run: `rtk alembic upgrade head`

Expected: PASS.

- [ ] **Step 5: Commit and publish for review**

Run: `rtk git add web/src/components/AppShell.tsx web/src/features/retention/NotificationsMenu.tsx web/src/features/retention/NotificationsMenu.test.tsx`

Run: `rtk git commit -m "feat: add price notification navigation"`

Run: `rtk git push -u origin codex/retention-notifications-alerts`

Run: `rtk gh pr create --draft --base codex/foundation-discovery-continuation --title "Retention: wishlist, price alerts, and notifications" --body "Implements owner-scoped wishlist, price alerts, and price notifications. Social notifications remain deferred."`

## Self-Review

- Spec coverage: Tasks 1–2 provide owner-scoped persistence/API; Task 3 gives truthful evaluation and delivery; Tasks 4–5 implement game-detail and wishlist controls; Task 6 provides only price-notification routing and verification. Social notification flows are not included.
- Placeholder scan: no deferred implementation markers or unspecified error handling remain.
- Type consistency: all browser DTOs mirror `WishlistItemCreate`, `PriceAlertCreate`, `PriceAlertRead`, and `PriceNotificationRead`; the watcher uses the same persisted `PriceAlert` model as the API.
