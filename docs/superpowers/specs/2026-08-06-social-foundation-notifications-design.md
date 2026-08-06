# Social Foundation and Social Notifications Design

## Goal

Deliver private, owner-scoped friendships, direct messages, game invites, and
typed actionable notifications.  A person becomes visible to another person
only through an exchanged opaque friend code or an accepted friendship; no
presence, compatibility, activity, public profile, or game-library data is
created or exposed.

## Baseline and Scope

The retention branch already persists owner-scoped price notifications, but
its notification record only represents price targets and the active
`/friends` route is mock data with inert controls.  A previous social design
is useful for canonical relationship and messaging rules, but its public
profile pages are outside this delivery's explicitly excluded scope.

This phase adds a private friend-code exchange, friend-request lifecycle,
confirmed friendship, one-to-one HTTP conversations, game invites for a
confirmed friend, and notifications for request, message, invite, and invite
response events.  It does not add public profiles, favourites, online status,
compatibility, social activity, Party Finder, Groups, Discord, privacy
settings, or onboarding.

## Considered Approaches

1. **Opaque friend code (recommended).** Each account receives a permanent,
   random, URL-safe code.  The Friends screen lets its owner copy it and lets
   another signed-in owner paste it to request friendship.  This has no search
   or public page, does not expose email, and makes discovery deliberate.
2. **Email-based request.** This removes a new code but enables account
   enumeration and makes private account email part of the social boundary.
3. **Public profile URL.** This is ergonomic but explicitly excluded from the
   requested outcome and would expand privacy requirements.

## Data Model and Integrity

The migration adds a unique, non-null `users.friend_code`, generated with a
collision-safe random default and backfilled for existing accounts.  It also
adds:

- `friend_requests`: sender, recipient, `pending`/`accepted`/`rejected`/
  `cancelled`, timestamps, and a directional uniqueness constraint.  The
  service treats an existing pending request in either direction, or an
  existing friendship, as a conflict.
- `friendships`: a single canonical UUID-ordered pair with a uniqueness
  constraint.  Only this row authorizes conversations and invitations.
- `direct_messages`: friendship, author, trimmed text (1--2,000 characters),
  and timestamp.  A sender must be one of the friendship members.
- `game_invites`: friendship, sender, recipient, stable catalog-game identity
  (`rawg` id) plus title snapshot, `pending`/`accepted`/`declined`/
  `cancelled`, and timestamps.  Only the recipient can respond; only the
  sender can cancel a pending invite.

`notifications` gains nullable, foreign-key-backed identifiers for friend
request, friendship, direct message, and game invite.  Its event type is one
of `price_alert`, `friend_request`, `message`, `game_invite`, or
`game_invite_response`; a service-level validator accepts only the exact
target combination for that event.  Creation happens in the same transaction
as each mutation and uses the underlying event id as its stable, naturally
deduplicated target.  Notification DTOs expose only the owner's event context
and safe display text, never an email or another user's private data.

## API and Authorization

All social endpoints require authentication and derive ownership from the
session, never from a client-supplied user id.

- `GET /social/me` returns the caller's friend code, confirmed friends, and
  incoming/outgoing requests with safe display labels.
- `POST /social/friend-requests` accepts an exact friend code; list, accept,
  reject, and sender-cancel operations are owner-scoped and idempotent where
  retrying a completed response can safely return its current result.
- `GET/POST /social/friends/{friend_id}/messages` requires canonical
  friendship; history is oldest-first, cursor-paged, and a failed friendship
  check returns a controlled 403 without revealing message existence.
- `GET /social/invites`, `POST /social/friends/{friend_id}/invites`, and
  recipient response/sender cancellation actions require friendship and
  enforce the invite state transition.  A catalog identity is validated before
  creation.
- Existing notification list/read endpoints become generic owner-scoped
  notification endpoints.  Mark-read is idempotent but succeeds only for the
  owner and only after a valid navigation target has been selected by the
  client.

Unknown, deleted, stale, foreign, or no-longer-authorized event targets do not
fall back to another resource: target resolution returns an unavailable state,
and its notification remains unread.

## Browser Routes and Interaction

The Vite/TanStack `/friends` route is replaced with a TanStack Query-backed
Friends screen: copy friend code, send request by code, incoming/outgoing
requests, confirmed friends, and real Message/Invite actions.  It has explicit
loading, signed-out, empty, error, retry, pending, and mutation-error states.
No Steam social summary or mock-data card remains in this delivered route.

`/friends/$friendId/messages` renders an authorized conversation and sends a
real message.  `/friends/invites` lists incoming and outgoing real invites and
their response actions.  A notification deep link uses route search state to
focus an incoming request or invite; message events open the corresponding
conversation.  Every visible action either performs its mutation, navigates
to one of these routes, or is absent.

The notification menu maps event targets as follows: friend request to
`/friends?request=<id>`, message to `/friends/<friendId>/messages`, invite to
`/friends/invites?invite=<id>`, invite response to the same invite context,
and price events retain their existing catalog/offer mapping.  Navigation is
initiated first; only then does the client call mark-read.  Invalid, deleted,
or unauthorized targets show an in-menu unavailable state and never call
mark-read.

## Tests and Verification

Pytest covers migration upgrade/downgrade metadata, friend-code backfill,
request and invite lifecycle/idempotency, canonical friendship constraints,
cross-owner denial, message trimming/paging, notification event validation,
payload ownership, and unread unavailable targets.

Vitest covers Friends, conversations, and invites for loading/empty/error/
retry/private states; request/message/invite mutations; route focus and deep
link mapping; navigation-before-read ordering; and unavailable targets.  Final
verification runs focused tests during TDD plus full pytest, frontend tests,
lint, build, and Alembic upgrade against an isolated temporary database.

## Success Criteria

- A user can exchange a private code, create a request, and accept, reject, or
  cancel it without data leaking beyond the involved accounts.
- Only confirmed friends can list or send direct messages and game invites.
- Every social notification has durable identifiers, opens real action
  context, and is read only after navigation begins.
- Deleted, missing, or unauthorized targets remain controlled and unread.
- `/friends`, conversation, invite, and notification surfaces contain no mock
  social data or inert controls.
