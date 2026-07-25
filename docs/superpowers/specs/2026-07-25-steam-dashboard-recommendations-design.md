# Steam Dashboard Recommendations Design

## Goal

Automatically populate the dashboard's `Recommended for you` block for a user with
a linked Steam account and owned games, without repeat AI calls for an unchanged
library.

## Scope

This project implements only Steam-backed dashboard recommendations from the
PlayFinder handoff. Genre-based deal sections remain a separate follow-up.

## Backend Design

Create a reusable async helper for Steam recommendations rather than invoking
`get_recommendation` inside the dashboard or route handlers. It accepts the current
user and fetched Steam games, then:

1. Builds a stable fingerprint from sorted valid Steam app IDs and each game's
   `playtime_forever` and `playtime_2weeks` values.
2. Builds a cache key containing the user ID and fingerprint.
3. Reuses a cached `RecommendationResponse` for six hours, otherwise builds the
   existing Steam prompt, passes owned app IDs as exclusions, and calls the
   recommendation provider.

The helper is used by `/dashboard` and remains compatible with
`POST /steam/recommendations`. Owned Steam app IDs remain excluded from generated
recommendations.

When the dashboard receives a linked Steam account with games, it calls the helper
and returns `recommendations` as `DataBlock(status="ready", data=result)`. A
provider failure becomes `DataBlock(status="error", data=[],
message="Recommendations are temporarily unavailable. Please try again later.")`.
It must not become a Steam-connect CTA.

For users without linked Steam or without owned games, the dashboard returns the
existing empty recommendation block with the connect/add-games message.

## Cache Invalidation

Cache entries are logically invalidated by a changed fingerprint, since a changed
Steam library generates a different key. The Steam library sync endpoint additionally
deletes known recommendation cache entries for the current user after a successful
sync so the next dashboard request cannot reuse a stale entry even if the provider's
library response is temporarily unchanged.

The cache TTL is exactly six hours. Keys are user-scoped, preventing one user's
recommendations from being served to another user with a similar library.

## Frontend Design

Continue using `DashboardResponse.recommendations: DataBlock<RecommendationResponse>`
and the existing `Dashboard` query. No separate dashboard button or client-side
recommendation request is added.

The `Recommended for you` UI renders recommendation cards for `ready` data. For an
`error` block with no results, it renders the server message in the existing block
area, visually distinct from the Steam connect/add-games empty guidance. Empty and
not-connected behavior remains unchanged.

## Error Handling

- A Steam library fetch failure continues to make the Steam block an error and leaves
  recommendations empty; it must not call the AI provider.
- A linked but empty library remains an empty recommendation state.
- A provider failure is contained to the recommendations block; deals, library, and
  Steam information still return normally.
- Cache read/write failures must not prevent recommendation generation; they degrade
  to an uncached provider request or an error block if the provider fails.

## Tests

Backend contract and helper tests cover: no linked Steam, empty Steam library,
successful linked-library recommendations, owned-app exclusion, cache reuse for an
unchanged fingerprint, changed-library cache miss, provider error block, user cache
isolation, and sync invalidation.

Frontend dashboard tests cover ready recommendation cards, the existing connect/add
games empty state, and the new provider-error message. Existing dashboard block tests
remain in place.

## Acceptance Criteria

- A linked Steam account with owned games receives dashboard recommendations without
  a manual action.
- Identical user/library inputs reuse cached recommendations for six hours.
- Steam library changes and a successful sync invalidate prior recommendation results.
- Recommendations exclude owned Steam app IDs.
- Provider failures appear as a helpful dashboard error, not a Steam CTA.
- Users without Steam or with no owned games retain the current CTA.
