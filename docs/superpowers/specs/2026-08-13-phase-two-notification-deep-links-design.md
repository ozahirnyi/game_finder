# Phase 2: Notification Deep Links Design

**Status:** approved for planning  
**Date:** 2026-08-13  
**Product source:** `C:\Users\zagir\Downloads\AyuGram Desktop\2026-08-06-user-flow-fixes.md`, Spec 4  
**Audited implementation baseline:** `origin/main` at `9d4e233`  
**Scope:** notification deep links only; do not implement the separate price-alert preset UI from source Spec 5.

## Goal

Make every actionable, real notification take its owner to the existing action context without exposing another user's data or failing when the target has disappeared. Notifications become read only after navigation intent has started.

## Audited current contracts

`Notification` stores an owner `user_id`, string `type`, untyped JSON `payload`, optional `read_at`, and `created_at`. `GET /notifications`, `POST /notifications/{notification_id}/read`, and `POST /notifications/read-all` are owner-scoped.

Current notification creation sites in `app/main.py` are:

| Type | Existing payload | Gap |
| --- | --- | --- |
| `friend_request` | `request_id`, `from` | Has the target ID. |
| `friend_request_accepted` | `by` | Needs the accepted friend's stable ID. |
| `message` | `conversation_id`, `from`, `preview` | Has the target ID. |
| `game_invite` | `invite_id`, `from`, `game_name` | Has the target ID. |
| `game_invite_response` | `invite_id`, `by`, `status` | Has the target ID. |

`NotificationsPanel` currently renders the list and marks an unread item read on click, but performs no navigation. The active Vite/TanStack routes are `/friends`, `/friends/$friendId`, `/games/$gameId`, and `/deals`.

The active price-alert CRUD model is owner-scoped, but the current watcher sends Telegram messages for legacy manual-library `Game` records and does not persist `Notification` rows. A deep-linkable in-app price alert therefore requires a narrow delivery bridge; it cannot be provided by the panel alone.

## Approved design

### Payload and destination contract

Retain the JSON storage column and the `NotificationRead` response shape. Centralize notification construction in a small typed server-side helper so creators cannot supply arbitrary client-controlled URLs.

| Notification type | Required stable target | Destination |
| --- | --- | --- |
| `friend_request` | `request_id` | `/friends?request=<id>` |
| `friend_request_accepted` | `friend_id` | `/friends/$friendId` |
| `message` | `conversation_id` | `/friends?conversation=<id>` |
| `game_invite` | `invite_id` | `/friends?invite=<id>` |
| `game_invite_response` | `invite_id` | `/friends?invite=<id>` |
| `price_alert` | `catalog_game_id` | `/games/$gameId` |

Existing human-readable fields (`from`, `by`, `preview`, `game_name`, and `status`) remain presentation metadata, not navigation authority. The Phase 2 price-alert payload may include current offer metadata only when the watcher has it, but it must not invent a deal identifier or a new deal route. The canonical game detail is the real destination and shows current available offers.

### Existing-route state

Extend the existing `/friends` route's validated search state with optional `request`, `conversation`, and `invite` identifiers. The route uses its existing owner-/participant-scoped queries to find and visibly focus the requested request, conversation, or invite. It must not fetch a target with a less-restricted endpoint merely to satisfy a deep link.

`/friends/$friendId` remains the friend-acceptance destination and continues to use its existing friend-scoped loader. `/games/$gameId` remains the price-alert destination. No new standalone notification, message, invite, or deal route is introduced.

### Read timing and unavailable state

The panel first maps a supported, well-formed payload to a real destination and starts TanStack navigation. Only then does it call the per-notification read mutation for an unread item. A malformed or unsupported payload does not silently mark the notification read.

After arrival, a missing, deleted, expired, or unauthorized target renders a neutral unavailable state in its existing surface: for example, “This notification action is no longer available.” It must not crash, disclose target data, expose whether an inaccessible resource exists, or allow an action on it.

### Price-alert in-app delivery bridge

The alert watcher will evaluate persisted, owner-scoped `PriceAlert` records against their configured price/discount criteria. When a newly qualified offer is deduplicated, it creates one owner-scoped `price_alert` notification only if `in_app` is selected. Telegram delivery remains controlled by the existing selected channel and connection requirements.

The notification includes the stable `catalog_game_id`; no schema migration is needed for the existing JSON payload. The implementation must preserve the existing legacy Telegram watcher behavior unless a focused audit proves a safe, equivalent migration path. The bridge must not change alert presets, discovery, deal selection, or delivery preferences.

### Presentation settings

The panel's local-only “Price drops” and “Friend activity” toggles do not control backend delivery. Phase 2 must remove or hide them rather than present them as functioning notification settings. Delivery configuration remains confined to real alert configuration already supported by the product.

## Security and error boundaries

- Notification listing and read mutations remain restricted to `Notification.user_id == current_user.id`.
- Friend request actions stay restricted to the recipient; conversations to participants; game-invite responses to the recipient; friend profiles to confirmed friends; and price alerts to the alert owner.
- The frontend treats IDs from a notification as route state, never as proof that a target is authorized.
- A 404/403 or an absent matching result is translated to the same unavailable presentation, without differentiating forbidden from deleted targets.
- No target title, preview, participant identity, price, or offer data is loaded from an unauthorized response.

## Verification requirements

Focused pytest must cover every producer's payload fields, notification read owner scoping, target route API owner scoping, and price-alert in-app creation/deduplication/channel behavior. All external providers remain mocked.

Focused Vitest must cover payload-to-destination mapping, navigation-before-read sequencing, each `/friends` target state, and malformed/missing/unauthorized target unavailable states. Existing panel readability coverage remains.

Before release, run the full backend and web suites, web lint, production build, and a browser smoke test from the exact Phase 2 build for friend request, message, incoming invite, invite response, price alert, and unavailable target flows.

## Non-goals

- Price-alert presets, Telegram-connection UI, or other source Spec 5 work.
- Discovery, deals redesign, friends/presence redesign, Party Finder, Groups, Discord, favorites, privacy, Home, or onboarding.
- New fake routes, client-defined external redirect URLs, or permanent notification preferences without a real backend contract.
