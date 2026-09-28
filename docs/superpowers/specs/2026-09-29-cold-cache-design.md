# Cold Cache Response Design

## Goal

Reduce long waits for homepage catalog and deal data when a fresh Redis entry has expired, and avoid fetching sidebar deals for the default US region before a signed-in user's profile region is known.

## Design

When a fresh JSON cache entry is missing but its stale copy is available, return that copy immediately and start one in-process background refresh for the cache key. A successful refresh replaces both fresh and stale entries using the existing TTLs. A failed refresh is logged and leaves the stale copy available. If no stale copy exists, keep the current synchronous fetch path.

For signed-in users, keep the sidebar deals query disabled until the profile query has settled. Then use the profile's region, retaining the current US fallback if profile loading fails. Guests can continue loading sidebar deals without a profile.

## Boundaries

- Preserve the existing fresh cache TTL and 24-hour stale TTL.
- Do not change catalog payloads, deal ranking, or provider integrations.
- Background refresh failures must not fail the response already served from stale data.
- Add focused backend and frontend tests for these behaviors.
