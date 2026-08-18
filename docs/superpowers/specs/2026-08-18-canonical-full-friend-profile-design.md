# Canonical full friend profile

## Goal

Make `/users/<publicId>` the only profile URL and make the prior, known-working
`ProfileView` the one profile screen for every viewer role. The server-selected
data and actions change with the viewer relationship; the visual profile shell
does not.

## Route and data design

- `/users/<publicId>` remains the sole public profile route.
- Its public response supplies the authorized identity and collection blocks
  for anonymous visitors, strangers, and owners.
- When that response says the viewer is a friend, the page additionally
  requests a friend-authorized endpoint keyed by `publicId`. The server
  validates friendship and returns shared games, conversation history, and the
  action UUID needed by the existing profile component.
- The friend action UUID appears only in this authorized response; the ordinary
  public-profile response never exposes it.
- The frontend adapts each authorized response shape into one existing
  `ProfileView`. It does not render `PublicProfileView` or a second profile UI.

## Actions and navigation

- On a friend profile, Message and Invite are buttons on `/users/<publicId>`.
- `/users/<publicId>?compose=message` and `?compose=invite` open the existing
  composers. Closing either composer removes its query state without changing
  the profile destination.
- All visible identities link only to `/users/<publicId>`.
- Remove `/friends/<id>` as a route and stop generating it. No current visible
  UI links target it; legacy bookmarked URLs are intentionally not retained.

## Privacy and roles

- Anonymous visitors receive the existing profile shell with only public data
  and no actions.
- Eligible strangers receive that same shell plus Add friend.
- Friends receive that same shell with friend-authorized data and actions
  through the new server-side relationship check.
- Owners receive that same shell with the account settings path and never get
  friend actions.
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
