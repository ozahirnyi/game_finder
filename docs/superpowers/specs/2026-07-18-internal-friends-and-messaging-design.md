# Internal friends and messaging

## Goal

Replace the Friends tab's Steam-only view with an internal Game Finder social
system. Signed-in users can share a public profile link, send and handle friend
requests, and exchange direct messages with confirmed friends. Steam social
data remains available as a separate informational section.

## Scope

- Every user has an immutable, opaque public identifier used in a URL such as
  `/users/<public-id>`.
- A public profile shows the account's display label and the applicable
  friendship action for the visitor: add, request sent, accept/decline, or
  already friends.
- A request is directional until the recipient accepts or declines it. The
  service rejects self-requests, duplicate active requests, and actions by a
  user other than the request recipient.
- A confirmed friendship is bidirectional and provides access to a private,
  one-to-one conversation.
- Conversations use ordinary authenticated HTTP endpoints. The client loads
  the message history when the dialog opens and refreshes it after a message is
  sent; real-time sockets are explicitly out of scope.
- The Friends screen has sections for confirmed Game Finder friends, incoming
  and outgoing requests, a copyable profile link, and the existing Steam
  social information.

## Data model

`users.public_id` is a unique, non-null, randomly generated URL-safe value.
It is immutable and is not derived from email or a third-party account.
The public label is the Steam persona when linked; otherwise the UI uses a
short non-identifying form of the public id. Email is never exposed.

`friend_requests` stores `sender_id`, `recipient_id`, `status` (`pending`,
`accepted`, or `declined`), and timestamps. A database constraint prevents a
duplicate directional request. On acceptance, the service creates or preserves
a single canonical friendship relation.

`friendships` stores a canonical unordered user pair and `created_at`. The
lower UUID is stored first, preventing duplicate relations regardless of which
person initiated the original request.

`direct_messages` stores the canonical friendship id, author id, text, and
timestamp. The author must be one of the friendship's members. Message text is
trimmed, required, and limited to 2,000 characters; results are oldest-first
with a default limit of 50 and a cursor for earlier messages.

## API

- `GET /social/me` returns the current user's public profile link, friends and
  pending requests.
- `GET /social/profiles/{public_id}` returns the public profile and relationship
  state for the authenticated viewer.
- `POST /social/friend-requests` sends a request to a public id.
- `POST /social/friend-requests/{id}/accept` and `/decline` handle an incoming
  request.
- `GET /social/friends/{friend_id}/messages` returns the private conversation.
- `POST /social/friends/{friend_id}/messages` sends a validated text message.

All social endpoints require authentication. The server returns clear `400`,
`403`, `404`, or `409` responses for invalid state without disclosing private
data.

## UI flow

1. A user copies their profile link from Friends and shares it.
2. A signed-in recipient opens the link and selects **Add friend**.
3. The sender sees an outgoing pending state; the recipient sees the request
   under incoming requests and accepts or declines it.
4. Once accepted, both users see each other in My friends and can open the
   dialog from **Message**.
5. Sending a message refreshes the conversation. Refreshing or reopening the
   dialog retrieves any newer messages.

Steam data stays in its own section and does not grant Game Finder friendship
or message access.

## Error handling and privacy

- Links for unknown users render a not-found state.
- Users cannot message, inspect message history, or alter requests that do not
  belong to them.
- The public profile exposes no email address and no private library data.
- Empty friends, requests, and conversations use actionable empty states.

## Testing

- Backend contract tests cover public ids, profile lookups, the entire request
  lifecycle, duplicate and unauthorized actions, and message authorization.
- Frontend tests cover the Friends states, profile-link request flow, request
  handling, conversation loading, and sending.
- The frontend production build and backend test suite must pass before handoff.
