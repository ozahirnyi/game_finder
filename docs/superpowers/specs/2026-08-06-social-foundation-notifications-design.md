# Social Foundation and Social Notifications Design

## Goal

Deliver private, owner-scoped friendships, direct messages, game invites, and
typed actionable notifications.  A person can be found by a non-unique
nickname, added from their minimal public profile, or added through an exact
opaque friend code when nickname search is insufficient.  No presence,
compatibility, activity, or private game-library data is created or exposed.

## Baseline and Scope

The retention branch already persists owner-scoped price notifications, but
its notification record only represents price targets and the active
`/friends` route is mock data with inert controls.  A previous social design
is useful for canonical relationship and messaging rules, but its public
profile pages are outside this delivery's explicitly excluded scope.  This
phase supersedes that exclusion with a deliberately minimal public profile:
it is only a durable friend-request entry point and must not grow into a social
feed or privacy surface.

This phase adds nickname search, a private friend-code exchange, minimal
public-profile link, friend-request lifecycle, confirmed friendship, one-to-one
HTTP conversations, game invites for a confirmed friend, and notifications for
request, message, invite, and invite-response events.  It does not add
favourites, online status, compatibility, social activity, Party Finder,
Groups, Discord, privacy settings, or onboarding.

## Considered Approaches

1. **Nickname search plus exact friend code (recommended).** Each account has
   a non-unique display nickname, permanent random profile id, and private
   friend code.  Search returns a bounded list of minimal profile cards for an
   exact or prefix nickname match; a visitor chooses one card before requesting
   friendship.  The exact code remains a reliable fallback for duplicate or
   hard-to-find names.  Neither path exposes email or private data.
2. **Exact friend code only.** This is strongest for privacy but makes adding a
   known person unnecessarily cumbersome.
3. **Email-based request.** This enables account enumeration and makes private
   account email part of the social boundary.

## Data Model and Integrity

The migration adds `users.display_name` (non-null, non-unique, normalised
case-insensitively for search), plus unique, non-null `users.profile_id` and
`users.friend_code`, generated with collision-safe random defaults and
backfilled for existing accounts.  Existing accounts receive their Steam
persona where available, otherwise a generated `Player-<short-code>` name.
New accounts choose a 1--64-character display name during registration.  A
nickname is never an authorization key: a selected profile id or exact friend
code identifies the request recipient.  It also adds:

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

- `GET /social/me` returns the caller's profile link, friend code, confirmed
  friends, and incoming/outgoing requests with safe display labels.
- `GET /social/profiles/{profile_id}` returns only the non-unique nickname and
  caller-specific relationship state; it never exposes email, friendship lists,
  games, requests belonging to others, or any private account information.
- `GET /social/profiles?query=` performs a bounded, authenticated nickname
  search only after at least two characters.  It returns minimal profile cards
  (`profile_id`, `display_name`, and relationship state), ordered
  deterministically, never emails or private data.  Empty and no-match states
  are explicit.
- `POST /social/friend-requests` accepts either an exact friend code or a
  profile id selected from search, but not a nickname string alone.  List,
  accept, reject, and sender-cancel operations are owner-scoped and idempotent
  where retrying a completed response can safely return its current result.
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
Friends screen: copy friend code and profile link, send request by code,
incoming/outgoing requests, confirmed friends, and real Message/Invite
actions.  A debounced nickname search starts after two characters, renders
minimal matching profile cards, and lets the user select a result before the
send action.  The exact-code field remains available alongside it.  The
minimal `/users/$profileId` route presents the nickname and the single
relationship-appropriate action (send, pending, accept/reject, or already
friends).  It has explicit loading, signed-out, empty, error, retry, pending,
and mutation-error states.  No Steam social summary or mock-data card remains
in this delivered route.

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

- A user can search by a non-unique nickname, use an exact private code, or
  open another user's profile; they can then create a request and accept,
  reject, or cancel it without private-data leakage.
- Only confirmed friends can list or send direct messages and game invites.
- Every social notification has durable identifiers, opens real action
  context, and is read only after navigation begins.
- Deleted, missing, or unauthorized targets remain controlled and unread.
- `/friends`, conversation, invite, and notification surfaces contain no mock
  social data or inert controls.
