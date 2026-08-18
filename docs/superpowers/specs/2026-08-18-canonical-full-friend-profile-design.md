# Canonical full friend profile

## Goal

Make `/users/<publicId>` the only profile URL and restore the complete, known
working friend-profile experience for friends: shared games, conversation
history, message composer, and game-invite composer.

## Route and data design

- `/users/<publicId>` remains the sole public profile route.
- Its public response continues to drive anonymous, stranger, and owner views.
- When that response says the viewer is a friend, the page requests a new
  friend-authorized endpoint keyed by `publicId`. The server validates the
  viewer relationship and returns the same data needed by the existing full
  friend profile.
- The response includes the friend action UUID only after friendship is
  authorized. The ordinary public-profile response never exposes it.
- The frontend maps that response into the existing `ProfileView` rather than
  recreating a second profile UI.

## Actions and navigation

- On a friend profile, Message and Invite are buttons on `/users/<publicId>`.
- `/users/<publicId>?compose=message` and `?compose=invite` open the existing
  composers. Closing either composer removes its query state without changing
  the profile destination.
- All visible identities link only to `/users/<publicId>`.
- Remove `/friends/<id>` as a route and stop generating it. No current visible
  UI links target it; legacy bookmarked URLs are intentionally not retained.

## Privacy and roles

- Anonymous visitors receive only existing public data and no actions.
- Eligible strangers retain only Add friend.
- Friends receive friend-authorized profile data and actions through the new
  server-side relationship check.
- Owners retain the account settings path and never get friend actions.
- A non-friend requesting friend-only data receives the existing no-existence
  behavior (`404`), not an existence-revealing response. Hidden public blocks
  remain hidden in every view.

## Testing

- Pytest covers friend-only endpoint authorization by public ID, owner/self,
  stranger, anonymous, and unknown-profile cases.
- Vitest covers canonical friend profile rendering, `compose` URL state,
  message/invite actions, and absence of `/friends/<id>` navigation.
- Run full backend and web suites, lint, build, and a browser smoke test before
  the draft PR.
