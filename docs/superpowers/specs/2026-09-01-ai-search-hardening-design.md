# AI Search Hardening Design

## Goal

Make AI game recommendations useful, consistent with the catalog UI, and safe from token-spend abuse. Authenticated users receive at most three AI recommendation attempts per UTC calendar day, with a 60-second cooldown between attempts. Guests cannot invoke the AI endpoint.

## Scope

This delivery covers the active Vite and TanStack application, the FastAPI recommendation contract, persistent per-user quota enforcement, catalog enrichment, and recommendation-card UX.

It does not change ordinary catalog search limits, add paid quota tiers, add administrator quota controls, or introduce approximate catalog matches.

## Architecture

FastAPI remains the authority for authentication, quota enforcement, and recommendation enrichment. Browser-side disabled states and countdowns improve the experience but are not security controls.

A persistent daily quota record is keyed by user and UTC date. The backend atomically reserves an attempt before invoking the AI provider. This prevents parallel requests from exceeding the limit. Each request that reaches AI generation consumes an attempt even if the provider later fails. Invalid requests rejected before generation do not consume quota.

The existing `/recommendations` endpoint requires `get_current_user`. Its IP-oriented `5/minute` limiter is replaced or supplemented by the stricter authenticated quota. A read-only quota endpoint exposes the current state without consuming an attempt.

## API Contract

### Quota status

`GET /recommendations/quota` requires authentication and returns:

```json
{
  "limit": 3,
  "remaining": 3,
  "cooldown_until": null,
  "reset_at": "2026-09-02T00:00:00Z"
}
```

`remaining` is the number of attempts left in the current UTC day. `cooldown_until` is present when the 60-second interval has not elapsed. `reset_at` is always the next UTC midnight.

### Recommendation request

`POST /recommendations` requires authentication. Before AI generation it atomically validates and reserves quota. A successful response contains quota status and enriched recommendation items:

```json
{
  "recommendations": [
    {
      "title": "Hades II",
      "reason": "Fast runs and build variety match the request.",
      "tags": ["Roguelike", "Action"],
      "game": {
        "id": 123,
        "name": "Hades II",
        "released": "2025-09-25",
        "background_image": "https://example.test/hades-ii.jpg",
        "platforms": ["PC"]
      }
    }
  ],
  "quota": {
    "limit": 3,
    "remaining": 2,
    "cooldown_until": "2026-09-01T12:01:00Z",
    "reset_at": "2026-09-02T00:00:00Z"
  }
}
```

The nested `game` is nullable. It is populated only for an authoritative catalog result whose normalized title exactly matches the AI title and whose internal catalog ID is present. The original AI `reason` and `tags` are always preserved.

Authentication failures return `401`. Quota and cooldown rejections return `429` with a structured detail containing a stable error code, the current quota object, and the next allowed timestamp. The client uses server timestamps rather than guessing limits locally.

## Catalog Enrichment

After AI generation, the backend searches the catalog for each recommended title. Searches may run concurrently and use the existing cache, but their concurrency must be bounded so one AI response does not create an uncontrolled downstream burst.

Matching normalizes Unicode, case, punctuation, and repeated whitespace, then requires an exact normalized title. A similar title such as `Hades II Deluxe` must not be linked for an AI result titled `Hades II`.

A catalog failure for one item does not fail the entire response. That item retains its title, reason, and tags with `game: null`. The frontend offers ordinary catalog search for unmatched items.

## Frontend Experience

The AI section uses the active catalog visual system: the existing grid, `GameCover`, typography, badges, spacing, and hover behavior.

For authenticated users:

- The form shows the daily allowance, for example `3 of 3 AI searches remaining today`.
- Submitting preserves the prompt, shows recommendation-card skeletons, and prevents another submission while pending.
- After a request, the UI refreshes from the returned quota and disables submission during the 60-second cooldown with a visible countdown.
- When the daily allowance is exhausted, the form remains visible but disabled until `reset_at`.
- Existing successful recommendations remain visible if a later request fails or receives `429`.

Each matched recommendation is a full clickable card leading to `/games/{id}`. It shows the catalog cover, title, available release/platform metadata, an `AI pick` badge, the AI reason, and AI tags. Real price or discount information may appear only when supplied by an implemented backend contract.

An unmatched recommendation uses the normal cover fallback, keeps its AI reason and tags, and provides an action that opens ordinary catalog search for the title. It never constructs a placeholder game-detail URL.

For guests, the section does not render an enabled prompt form and does not call either recommendation endpoint. It shows a concise sign-in action and may show static explanatory copy, but not fabricated personalized results.

## State and Error Rules

- Quota is enforced in the database, not process memory or local storage, so restarts and multiple workers do not reset it.
- Reservation is atomic and safe under concurrent submissions.
- UTC midnight resets the daily count; the cooldown remains based on the last reserved attempt within the current day.
- Empty or invalid prompts are rejected before quota reservation.
- Provider failure does not refund an attempt because the request reached generation and may already have consumed tokens.
- A quota status fetch failure does not enable speculative requests; the UI renders a retryable unavailable state.
- Partial catalog-enrichment failures degrade individual cards instead of discarding the AI response.

## Testing Strategy

Backend tests cover mandatory authentication, quota status, three allowed daily reservations, fourth-request rejection, 60-second cooldown, UTC reset, invalid-prompt non-consumption, provider-failure consumption, and parallel-request enforcement.

The default test database is SQLite, which does not implement PostgreSQL's row-level `SELECT FOR UPDATE` semantics. The unit suite therefore asserts the PostgreSQL lock statement and session-refresh behavior without claiming to simulate contending database transactions. Before changing quota-locking code, run an opt-in PostgreSQL integration test with independent sessions to validate parallel reservations against the production locking model.

Enrichment tests cover normalized exact matching, rejection of similar titles, populated ID and cover fields, preservation of reason and tags, and partial catalog failure.

Frontend tests cover the guest sign-in state, authenticated quota display, pending-submit protection, cooldown countdown, exhausted daily quota, preservation of existing results after errors, matched internal links, cover rendering, AI reason and tags, and unmatched catalog-search actions.

Focused pytest and Vitest suites, frontend lint, and the production build must pass before delivery.

## Success Criteria

- Guests cannot invoke AI recommendations through the UI or API.
- An authenticated user cannot reserve more than three AI attempts in one UTC day or submit attempts less than 60 seconds apart.
- Parallel or direct API calls cannot bypass quota enforcement.
- Every matched recommendation displays a real catalog cover and opens the correct internal game-detail page.
- AI reasons and tags remain visible on recommendation cards.
- Unmatched results remain useful without generating invalid navigation.
- The AI section visually matches the rest of the catalog and communicates quota, cooldown, loading, empty, and error states clearly.
