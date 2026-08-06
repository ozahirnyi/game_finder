# Retention: Price Alerts, Wishlist, and Price Notifications Design

## Goal

Give PlayFinder a real owner-scoped wishlist, durable price alerts, and actionable price notifications. A user can save a catalog game, choose a clear alert condition and delivery channels, and each delivered price notification reaches its real target or displays a controlled unavailable state.

## Baseline and Scope

The Foundation + Discovery branch has no persisted notification domain, wishlist resource, or alert configuration API. Its existing `Game` price-alert fields support a Telegram-only Steam-library watcher; they are not user-configured alert records. The active `/friends` and `/wishlist` routes are prototype surfaces with mock data, and this delivery must not manufacture social events or expose fake controls.

This delivery adds the minimal shared persistence, Alembic migration, authenticated APIs, real wishlist UI, price-notification UI, and catalog-game/wishlist alert controls required by the price-alert portion of OpenSpecs 4 and 5. It does not complete OpenSpecs 4 social notification deep links: friend, message, and invite notifications move to a later **Social Foundation + Social Notifications** phase after their real backend resources and routes exist. It also does not implement favorites, public profiles/privacy, onboarding, Party Finder, Groups, or Discord.

## Domain Model

`WishlistItem` is an owner-scoped record with a canonical catalog or supported Steam identity, display title, optional cover metadata, and created/updated timestamps. An owner can list, add, and remove only their own items. The migration enforces one wishlist item per owner and canonical identity.

`PriceAlert` is an owner-scoped record with:

- `user_id`, `identity_kind` (`rawg` or `steam`), canonical `identity_value`, and a display title;
- `mode` (`target_price`, `target_discount`, or `any_discount`);
- nullable numeric `threshold`, required only by the two target modes;
- `in_app` and `telegram` delivery booleans; and
- created/updated timestamps.

`any_discount` is in scope because the watcher can evaluate it truthfully as a deal with `cut > 0`; it has no threshold. A Steam identity is accepted only if the price resolver can obtain a supported offer. Steam-only games without a supported price lookup display an explicit unsupported state instead of an inert control.

`Notification` is owner-scoped and is limited in this phase to price-alert/deal events. It has a typed price event enum, `read_at`, `created_at`, `target_kind`, and nullable price-target fields: `game_id`, `saved_game_id`, `price_alert_id`, and `offer_url`. The service validates the target combination before persistence. DTO construction returns only fields safe for the owner and never exposes a private cross-user target.

The migration creates all three tables, owner indexes, and unambiguous uniqueness constraints for the wishlist identity and stable alert identity/mode/threshold key. The service also performs explicit duplicate detection because channel combinations and nullable values need a human-readable conflict response.

## APIs and Delivery

Authenticated APIs provide:

- `GET`, `POST`, and `DELETE` for the current user's wishlist;
- `GET`, `POST`, and `DELETE` for the current user's alerts;
- `GET` for the current user's notifications; and
- an owner-scoped mark-read action.

Alert creation accepts only canonical identity, a valid mode/threshold combination, and at least one enabled channel. In-app delivery is available to every authenticated user. Telegram can be selected only when the bot is configured and the user has linked their account; otherwise the UI explains how to connect through the existing Telegram link flow.

The watcher becomes a consumer of persisted `PriceAlert` records rather than the Steam-library watcher fields. For a matching deal it deduplicates by alert/deal state, creates an in-app notification with the alert/game/offer target, and sends Telegram only when that channel is enabled and linked. It creates no social notification rows or social-event types in this phase.

## Navigation and States

The authenticated shell exposes a real price-notification center. Each notification is mapped by its price target to an existing route. On click, the client starts navigation and only then requests mark-read. Price alerts navigate to the catalog-game route or an exact offer URL when supplied.

A missing target, invalid payload, deleted resource, unavailable deal, or authorization failure stays inside the notification experience with an explicit unavailable state; it neither crashes nor reveals data from another user. Friend, message, and invite target mapping are deliberately absent from this phase.

Catalog game detail renders real wishlist and alert controls only for a price-supported game: any discount, target price, and target discount. The real wishlist route is migrated off `mockData` and lists only the current user's items with existing alerts and the same controls. Both surfaces provide pending/empty/error states, readable duplicate responses, and enabled delivery channels.

## Testing and Verification

Pytest covers migration-facing model constraints, owner isolation for wishlist/alerts/notifications, DTO/service validation, alert duplicate conflicts, accepted modes and channel conditions, watcher evaluation/deduplication, and price-notification target payloads.

Vitest covers real wishlist loading and ownership-safe empty/error states, preset payload generation from detail and wishlist, Telegram connected/configured gates and guidance, existing-alert rendering, duplicate messaging, Steam unsupported state, price-notification target mapping, mark-read timing, and unavailable destinations. The delivery also runs focused tests, full frontend lint/build/test, backend pytest, and the Alembic upgrade path before merge.

## Success Criteria

- Wishlist, alert, and price-notification records are persisted, owner-scoped, and migrated safely.
- A user can add/remove a real wishlist item and create/view/delete its alerts from the wishlist or catalog detail.
- A real price condition produces an in-app price notification and an optional Telegram delivery.
- Every actionable price notification includes stable identifiers and reaches its actual destination or a controlled unavailable state.
- No wishlist, alert, or price-notification API/UI manufactures social data or leaks another user's target fields.
- All visible controls in the delivered surfaces act, navigate, or are absent.
