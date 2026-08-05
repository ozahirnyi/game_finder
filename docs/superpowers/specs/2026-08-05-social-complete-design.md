# PlayFinder Social Completion Design

## Goal

Make the Friends, friend-profile, and game-detail social workflows use real FastAPI data end to end: confirmed friendships, library-identity-based shared games, invitations, notifications, and direct messages.

## API contract

The frontend will consume one canonical social contract for the existing Friends, friend profile, game-detail, notification, and conversation screens.  A response must describe unavailable data explicitly; it must not manufacture activity, presence, compatibility, or collection counts.

- Friend and profile resources expose only the viewer-authorized fields.
- A shared-game record is produced only when both saved library records have the same non-empty `(source, external_id)` identity.  Titles, normalized titles, and fuzzy matching are not inputs to matching.
- Shared-library data is a stateful resource: `ready`, `private`, `disconnected`, or `error`, with a user-facing message for every non-ready state.
- The same explicit-state rule applies to Steam social/library data.  A private Steam library is not reported as empty; no Steam connection is not reported as zero games; Steam provider failure is not reported as an unavailable-looking statistic.

## Authorization and ownership

All social data is scoped to the authenticated viewer.  Friend profiles and conversations require a confirmed friendship.  A user can create, read, respond to, or cancel only records they own or are the designated recipient of.  Friend-request, invitation, message, and notification endpoints must not disclose data across users.

## Invitations and notifications

A confirmed friend can be invited from a shared-game card, friend profile, or game detail.  Creation stores the canonical game identity and an optional note.  The recipient has an incoming-invitation view and can accept or decline a pending invite.  Creation and response produce durable notifications.  The client refreshes invitations and notifications after every mutation and explains pending/terminal states instead of assuming success.

## Conversations and messages

The message composer uses the conversations API for confirmed friends.  Opening a conversation reuses or creates the single direct conversation for that pair; message history and sending are then available through that conversation.  The obsolete disabled "Messaging is coming soon" UI is removed only when the user is eligible to message.  Non-friends see a short explanation and an affordance to send a friend request rather than a disabled fake feature.

## UI behavior

Friends lists and friend profiles render real data and empty states.  The UI has no runtime `mockData` dependency for social screens.  It does not show compatibility, online status, activity, shared-game totals, or placeholder dashes unless an API-provided explanation makes the unavailable state explicit.

The game detail invite entrypoint lists only confirmed friends and handles an empty friend list.  Shared games are presented only for the selected friend and canonical identity match.  Private/disconnected/error Steam outcomes remain visible enough to distinguish an empty library from unavailable data.

## Error handling

FastAPI returns authorization failures without leaking target data, validation failures for invalid identities or mutations, and a controlled provider-unavailable state for Steam failures.  The frontend maps those responses to actionable UI states and retry guidance where appropriate.

## Testing

Pytest covers owner scoping, friendship lifecycle, canonical shared-game matching (including non-matching same-name games), invites and notification lifecycle, conversations/messages, Steam privacy/disconnection/provider failure.  Vitest covers loading, empty, unavailable, eligible invite, conversation-ready, and ineligible-message UI states.  The changed backend tests, targeted Vitest tests, lint, and production build are required before merge.

## Non-goals

This work does not infer game identity by name, scrape or alter private Steam libraries, generate synthetic presence/activity data, or run mutation tests against production.
