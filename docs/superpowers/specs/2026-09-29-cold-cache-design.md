# Cold Cache Response Design

## Goal

Reduce long waits for homepage catalog and deal data when a fresh Redis entry has expired, and avoid fetching deals for the default US region before a signed-in user's profile region is known.

## Design

When a fresh JSON cache entry is missing but its stale copy is available, explicitly opted-in external-provider fetches return that copy immediately and start one in-process background refresh for the cache key. A successful refresh replaces both fresh and stale entries using the existing TTLs. A failed refresh is logged and leaves the stale copy available. If the fetch is not opted in or no stale copy exists, keep the current synchronous fetch path. This avoids running request-scoped resources such as a SQLAlchemy session after the request ends.

For signed-in users, keep both home and sidebar deals queries disabled until the profile query has settled. Then use the profile's region, retaining the current US fallback if profile loading fails. Guests can continue loading deals without a profile.

## Boundaries

- Preserve the existing fresh cache TTL and 24-hour stale TTL.
- Do not change catalog payloads, deal ranking, or provider integrations.
- Background refresh failures must not fail the response already served from stale data.
- Only external-provider fetch closures without request-scoped database state may opt into background refresh.
- Add focused backend and frontend tests for these behaviors.
