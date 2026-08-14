# Friends Conversation Flow Design

## Purpose

Make the existing social APIs feel like one coherent workflow. A user must be
able to select a friend, read the existing conversation, send a message, send
or respond to a game invitation, and understand the outcome without relying on
an incidental sidebar state.

## Scope

This is a focused frontend UX fix on top of the active `origin/main` FastAPI
contracts:

- `/friends` becomes the primary friend-selection and conversation workspace.
- A friend-card click selects that friend in the existing right-hand context;
  it does not navigate away.
- Each selected friend gets an explicit **View profile** action.
- A friend profile exposes the existing conversation history and invitation
  history, in addition to the current message and invitation composers.
- Message send and invitation response invalidate/refetch the existing
  conversation and invite queries so the visible history updates immediately.
- An invitation response is displayed as a durable accepted/declined history
  state, not only as a temporary generic status message.

## Non-goals

- No new backend endpoints, tables, migrations, websocket transport, or global
  notification bell.
- No standalone chat route, redesign of Friends, public-profile/privacy work,
  or game-launch integration.
- No change to owner-scoping: existing APIs remain the sole authority for
  conversations, messages, and invitations.

## Interaction Design

### Friends workspace

Clicking a PlayFinder friend card stores that friend as the selection and
renders the existing right-hand messages/invites panel for them. The card has
an explicit secondary **View profile** control; it is the only route to the
friend-profile page from the list. The existing quick message/invite controls
continue to open profile composers intentionally.

### Friend profile

The profile retains its message and invitation dialogs. Beneath the actions it
shows the same owner-authorized history for the profile friend: chronological
messages and game invitations, including each invitation status. Sending a
message adds it to this context after the successful API response. Sending an
invite displays the pending invitation in the same history after refetch.

### Invitation response

The recipient can accept or decline an incoming invitation in Friends. The UI
updates the invitation list/history and provides a specific confirmation that
names the result. It does not pretend to launch a game. The sender observes the
accepted or declined invitation in their history and can still receive the
existing response notification.

## Error Handling and Privacy

If a friend relationship, conversation, or invite is no longer available, the
UI shows its existing controlled unavailable/empty state. It does not infer the
other user’s existence or reveal records returned for another owner. Failed
mutations remain visible as local error feedback and do not optimistically
invent a message or invitation.

## Verification

Vitest coverage will prove friend-card selection, explicit profile navigation,
history rendering on Friends and a friend profile, message-send refetching, and
accepted/declined invitation rendering. Existing backend API contract tests
remain sufficient because this change uses `getConversations`,
`getConversationMessages`, `getGameInvites`, `createMessage`, and
`respondToGameInvite` unchanged. Run focused tests, frontend lint, and a
production build; perform an authenticated two-account browser smoke test.
