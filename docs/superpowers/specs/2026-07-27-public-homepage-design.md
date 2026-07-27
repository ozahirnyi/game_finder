# Public homepage and motion design

## Goal

Make the homepage useful before authentication while preserving the existing
personal dashboard after authentication. Add a consistent, restrained animation
language across the web app.

## Homepage modes

### Guest

The root route is a public discovery page. Its primary action is searching for
a game or a deal.

1. A hero contains the message “Find your next game. Pay less.”, a prominent
   game search input, and quick search chips.
2. A short `Price drops` feed appears directly below the hero. It loads real
   public deal data rather than mock data and links each card to its game.
3. Region is detected automatically. The visitor can change it using a compact
   currency/region selector. If detection or the regional request fails, the
   app retries with the US/USD feed and states that fallback clearly.
4. The remainder of the public page may show public trending or discovery
   content. It must never require a session.
5. A concise call-to-action invites the visitor to sign in and connect Steam
   for personal features.

### Authenticated with Steam data

The root route remains the existing personal dashboard, supplied by the
authenticated user’s data: Steam library, wishlist price drops, friends,
activity, and recommendations. Personal data must not be shown on the guest
page.

### Authenticated without Steam data

The visitor still receives useful discovery content, plus an explicit
“Connect Steam” onboarding panel. This replaces any blank or misleading
personal sections. Once Steam sync completes, the normal personal dashboard
appears.

## Data and failures

- Public deal retrieval is independent from authentication.
- Loading states use deal-card skeletons; the hero and layout do not disappear.
- Empty results show a compact, honest empty state with a different region or
  search action.
- Request errors show an inline retry control. Region failure first falls back
  to USD; if that request also fails, the page communicates the issue without
  hiding search or the rest of the homepage.
- Authentication-gated endpoints are requested only after authentication.

## Motion system

Use a shared CSS motion vocabulary rather than page-specific one-offs.

- Route entry: content fades in and moves upward by a few pixels over roughly
  300–450 ms. Sections cascade with 60–80 ms delays, capped so the page feels
  immediate.
- Loading: skeletons use a restrained shimmer and are replaced by content with
  a short opacity transition.
- Interactive cards: hover lifts the card slightly, brightens its border, and
  may scale its cover subtly. Buttons and filter controls have quick pressed
  feedback without changing layout dimensions.
- Errors and empty states fade in; no looping attention animations are used
  beyond the existing small status indicator.
- `prefers-reduced-motion: reduce` removes translation, shimmer, pulsing, and
  route transitions while preserving readable state changes.

## Component boundaries

- `GuestHome`: public hero, public deals, and discovery content.
- `PersonalDashboard`: authenticated dashboard, reusing the existing personal
  modules.
- `SteamConnectPrompt`: authenticated-but-not-synced state.
- `PublicDeals`: region resolution, fetch state, USD fallback, cards, empty,
  and retry states.
- Shared motion utility/classes: page-entry, staggered children, card hover,
  and reduced-motion overrides.

The root route chooses one of these views from the auth and Steam-connection
state. This keeps public and private data flows separate and testable.

## Verification

- Guest visits never request authenticated resources and can search and view
  public deal states.
- Region detection is overridden by manual selection and falls back to USD on
  failure.
- Authenticated users with Steam data see the current personal dashboard.
- Authenticated users without Steam data see the connection prompt, not an
  empty dashboard.
- Tests cover loading, success, empty, retry, and reduced-motion styling hooks
  where practical.
