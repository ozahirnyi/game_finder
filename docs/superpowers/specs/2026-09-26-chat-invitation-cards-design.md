# Chat Invitation Cards Design

**Status:** approved  
**Date:** 2026-09-26  
**Baseline:** `origin/main` at `c8a3bbf`  
**Scope:** chat navigation label, unread chat count, game invitation cards in conversations, and profile notification navigation.

## Goal

Make chat the shared place where friends receive messages and game invitations. Show a total unread count on the Chats navigation item, render game invitations as actionable cards with reliable accept/decline behavior, and make invitation notifications in the profile open the relevant chat.

## Current behavior

- The app navigation labels `/messages` as **Messages**. The route and APIs already support conversations, messages, and per-conversation unread counts.
- Game invitations are stored in `GameInvite` and can be accepted or declined through `/game-invites/{invite_id}/response`. They create profile notifications, but they are not part of a conversation.
- The profile notification destination for `game_invite` and `game_invite_response` is `/friends` with invite search state.
- Message history uses `Message` records with plain text bodies. A conversation's unread count is based on unread messages.

## Design

### Chats navigation and unread count

Rename the user-facing navigation label **Messages** to **Chats** in both desktop and mobile navigation. Keep `/messages` and `/messages/$conversationId` as the route paths so existing links continue to work.

Show a badge on Chats with the sum of unread messages across the signed-in user's conversations. The badge is absent at zero and capped visually at `99+`; expose the exact count accessibly. Invalidate/refetch conversations after send, read, invite creation, and invite response so the badge stays current. The invitation card is one conversation message and contributes one unread item; the related profile notification is not counted separately.

### Invitation card persistence and rendering

Keep `GameInvite` as the authoritative invitation status record. When an invitation is created, ensure the pair's existing conversation exists and add one associated conversation message. Extend `Message` with a typed kind (`text` or `game_invite`) and an optional unique `game_invite_id` reference. The message's body remains a safe fallback/summary, while its kind and linked invitation determine the card rendering. Existing messages default to `text`.

The recipient sees the game name, optional note, sender, current status, and **Accept** / **Decline** controls while the invitation is pending. The sender sees the same invitation as a status card without response controls. Once answered, both participants see the card's accepted or declined state. No accept/decline control remains after a successful response.

After a response, add one durable system-style conversation message stating who accepted or declined the invitation. This message is visible to both participants and increments unread count for the other participant. Do not create a second invitation card on response. The existing invite response notification remains available in the profile and links to this same conversation.

### API and authorization

Extend message read contracts with the message kind and, for invitation messages, safe linked invitation details needed for the card. The linked invitation must be visible only to conversation participants, and response remains restricted to the invite recipient. Preserve the existing friend visibility and participant checks. Enforce pending status server-side; repeat or stale responses return the existing conflict/unavailable behavior and cannot produce duplicate response messages.

Creating the conversation, invitation, invitation message, and profile notification is one transaction. Responding to an invitation, changing its status, creating the response message, and creating the sender's response notification is one transaction. An error rolls back all effects of that operation.

### Profile notifications

For both `game_invite` and `game_invite_response`, include a stable `conversation_id` in the server-generated notification payload and navigate to `/messages/$conversationId`. Mark an unread notification read after navigation is started. The message's read state remains governed by the conversation read API; notification read state must not create an extra unread chat item.

### Error and loading states

While a response is pending, disable both card actions. On success, update/invalidate conversation messages, conversation summaries, and notifications. On failure, preserve the pending invitation and show a concise retryable error. If an invite is no longer available or the user is no longer authorized, show a neutral unavailable state without exposing whether another user's invite exists.

## Alternatives considered

1. Keep invitations only in profile notifications and Friends. This does not satisfy the desired single chat workflow or unread chat badge.
2. Insert ordinary text alone. This cannot reliably show current invitation status or support working accept/decline controls in the conversation.
3. Render a linked invitation card backed by `GameInvite` (recommended). This keeps invitation state authoritative while using the existing conversation and unread mechanisms.

## Verification scope

Implementation should cover persistence and owner/participant authorization for invitation messages, one-time response behavior, card rendering for pending and completed states, correct notification destination, and aggregate Chats unread badge behavior. Tests should mock external services; this feature requires no external provider calls.

## Out of scope

- WebSocket or push delivery; existing polling remains the refresh mechanism.
- A new chat URL scheme, a separate notification center, or notification preferences.
- Game launching or presence/party mechanics.
- Replacing the existing Friends invitation controls; they may remain as entry points, but chat cards become a complete way to respond.
