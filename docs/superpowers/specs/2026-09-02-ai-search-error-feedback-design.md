# AI search error feedback

## Goal

Replace the generic AI-search failure state with actionable, safe feedback for
an authenticated user on the production site.

## Design

Keep the existing backend error payloads and do not expose credentials,
provider responses, or stack traces. The client already preserves API error
details; the search route will map status and known error codes to short user
messages: sign-in required, daily quota reached, cooldown active, or an
unavailable AI provider. Unknown failures retain a neutral retry message.

## Validation

Add route-level tests for each displayed category. Run the frontend test suite,
lint, and build, then deploy through the normal `main` workflow and verify the
visible production feedback in the authenticated browser session.
