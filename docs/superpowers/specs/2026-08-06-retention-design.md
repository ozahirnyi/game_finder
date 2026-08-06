# Retention: Notifications and Price Alerts Design

## Goal

Give PlayFinder durable, owner-scoped price alerts and actionable notifications. A user can choose a clear alert condition and delivery channels, and each delivered notification either reaches its real target or displays a controlled unavailable state.

## Baseline and Scope

The Foundation + Discovery branch has no persisted notification domain or alert configuration API. Its existing `Game` price-alert fields support a Telegram-only Steam-library watcher; they are not user-configured alert records. The active `/friends` and `/wishlist` routes are prototype surfaces with mock data, and this delivery must not manufacture social events or expose fake controls.

This delivery adds the minimal shared persistence, Alembic migration, authenticated APIs, real notification UI, and catalog-game alert UI required by OpenSpecs 4 and 5. It does not implement friends, messages, game invites, favorites, public profiles/privacy, onboarding, Party Finder, Groups, or Discord.

## Domain Model

`PriceAlert` is an owner-scoped record with:

- `user_id`, `identity_kind` (`rawg` or `steam`), canonical `identity_value`, and a display title;
- `mode` (`target_price`, `target_discount`, or `any_discount`);
- nullable numeric `threshold`, required only by the two target modes;
- `in_app` and `telegram` delivery booleans; and
- created/updated timestamps.

`any_discount` is in scope because the watcher can evaluate it truthfully as a deal with `cut > 0`; it has no threshold. A Steam identity is accepted only if the price resolver can obtain a supported offer. Steam-only games without a supported price lookup display an explicit unsupported state instead of an inert control.

`Notification` is owner-scoped and has a typed event enum, `read_at`, `created_at`, `target_kind`, and nullable target fields: `game_id`, `saved_game_id`, `friendship_id`, `conversation_id`, `message_id`, `invite_id`, `price_alert_id`, and `offer_url`. The service validates each event type's permitted and required target combination before persistence. DTO construction returns only fields safe for the owner and never exposes a private cross-user target.

The migration creates both tables, owner indexes, and an unambiguous uniqueness constraint for the stable alert identity/mode/threshold key. The service also performs explicit duplicate detection because channel combinations and nullable values need a human-readable conflict response.

## APIs and Delivery

Authenticated APIs provide:

- `GET`, `POST`, and `DELETE` for the current user's alerts;
- `GET` for the current user's notifications; and
- an owner-scoped mark-read action.

Alert creation accepts only canonical identity, a valid mode/threshold combination, and at least one enabled channel. In-app delivery is available to every authenticated user. Telegram can be selected only when the bot is configured and the user has linked their account; otherwise the UI explains how to connect through the existing Telegram link flow.

The watcher becomes a consumer of persisted `PriceAlert` records rather than the Steam-library watcher fields. For a matching deal it deduplicates by alert/deal state, creates an in-app notification with the alert/game/offer target, and sends Telegram only when that channel is enabled and linked. It creates no social notification rows: friend, message, and invite notification types remain validated future contracts until their source actions exist.

## Navigation and States

The authenticated shell exposes a real notification center. Each notification is mapped by its typed target to an existing route. On click, the client starts navigation and only then requests mark-read. Price alerts navigate to the catalog-game route or an exact offer URL when supplied.

Future friend/message/invite payloads map to their action routes only when those routes and IDs are available. A missing target, invalid payload, deleted resource, unavailable deal, or authorization failure stays inside the notification experience with an explicit unavailable state; it neither crashes nor reveals data from another user.

Catalog game detail renders real alert controls only for a price-supported game: any discount, target price, and target discount. It shows existing alerts, pending/empty/error states, a readable duplicate response, and enabled delivery channels. The prototype wishlist remains out of scope until it consumes real owner data; no fake alert controls are added there.

## Testing and Verification

Pytest covers migration-facing model constraints, DTO/service validation, owner isolation, alert duplicate conflicts, accepted modes and channel conditions, watcher evaluation/deduplication, and notification target payloads.

Vitest covers preset payload generation, Telegram connected/configured gates and guidance, existing-alert rendering, duplicate messaging, Steam unsupported state, notification target mapping, mark-read timing, and unavailable destinations. The delivery also runs focused tests, full frontend lint/build/test, backend pytest, and the Alembic upgrade path before merge.

## Success Criteria

- Alert records and notifications are persisted, owner-scoped, and migrated safely.
- A real price condition produces an in-app notification and an optional Telegram delivery.
- Every actionable notification includes stable identifiers and reaches its actual destination or a controlled unavailable state.
- No notification or alert API/UI manufactures social data or leaks another user's target fields.
- All visible controls in the delivered surfaces act, navigate, or are absent.
