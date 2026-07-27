# Auth home navigation design

## Goal

Let a user leave an account without being forced into the sign-in screen, and let a
visitor leave either authentication form for the public home page.

## Sign-out destination

The existing profile sign-out handler continues to clear the local access token and
React Query cache, but navigates to `/` rather than `/login`. This applies to both the
normal profile header and the profile-summary error state.

## Authentication forms

Both `/login` and `/register` display a top-level `← Back to PlayFinder` link that
navigates to `/`. The link is available before any form interaction and does not submit
or clear either form.

## Verification

Frontend tests assert sign-out routes to `/` in both profile states and that both
authentication forms expose a home link with `href="/"`.
