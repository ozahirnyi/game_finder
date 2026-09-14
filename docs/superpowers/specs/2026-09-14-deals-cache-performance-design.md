# Deals Cache Performance Design

## Goal

Make the Deals screen fast after the first request by sharing cached Steam and
IGDB work across users, while keeping regional prices correct and avoiding
sequential IGDB enrichment.

## Current problem

`GET /prices/genre-deals` fetches up to 60 country-specific Steam candidates.
`build_genre_deal_groups` enriches those candidates one at a time through
IGDB. The result is cached for one hour, but a cache miss can therefore wait
for many serial IGDB requests.

## Design

### Cache layers

1. Cache Steam deal candidates by country for one hour. Steam availability,
   currency, prices, and discounts are country-specific, so the country stays
   part of this key.
2. Cache the normalized IGDB match for each Steam app ID globally for seven
   days. The cached value contains the selected IGDB match (or the explicit
   no-match result), so its metadata can be reused by every user and country.
3. Cache the completed genre-deals response by country plus the canonical,
   sorted set of selected genres for six hours. It is shared by every user
   whose request resolves to that same country and genre set.

The outer response cache is checked first. On a miss, its builder reads the
Steam candidate cache and then the global per-game IGDB cache. A miss at any
lower layer only rebuilds that layer and stores a new value before the outer
response is saved.

### Batched, rate-limited enrichment

IGDB enrichment will batch up to 10 title searches into one IGDB `multiquery`
request, then schedule those batch requests with a small fixed concurrency
limit. This matches IGDB's documented limits of four requests per second,
eight open requests, and ten subqueries per multiquery request. At most six
batch requests are needed for the current 60 Steam candidates, rather than 60
sequential HTTP requests.

The IGDB request governor will reserve a rate-limit slot before starting a
network request, then release its lock while that request is in flight. This
preserves the four-request-per-second limit while allowing several safe batch
requests to overlap. Cache hits do not consume a provider slot.

If an IGDB lookup times out or fails, the affected deal still appears with
Steam metadata. A failed provider response is not stored as a successful
global match. Existing Steam genre fallback remains responsible for filling
genre sections when IGDB genres are unavailable.

### Canonical shared keys

The response key uses normalized, de-duplicated genre names sorted
case-insensitively. Thus `Action,RPG` and `RPG,Action` reuse the same server
entry. Country remains normalized to its two-letter uppercase code.

## TTL decisions

| Data | Key scope | TTL | Reason |
| --- | --- | --- | --- |
| Steam candidates | country | 1 hour | Prices and availability are regional and volatile. |
| IGDB match | Steam app ID | 7 days | Catalog metadata changes rarely and is not regional. |
| Completed genre response | country + genre set | 6 hours | Reuses whole results while limiting discount staleness. |

## Testing

Tests will prove that 11 titles become two IGDB multiquery batches, that the
rate governor releases its lock before HTTP work completes, that a cached
IGDB match avoids a new lookup, and that two users with the same country and
genres reuse a shared canonical completed-response key. Existing endpoint
tests will continue to cover unauthenticated users, country selection,
timeouts, and Steam fallback.

## Scope limits

This change does not alter the response schema, client routes, authentication,
or Steam's source of prices. It does not introduce persistent database tables;
Redis remains the shared cache store.
