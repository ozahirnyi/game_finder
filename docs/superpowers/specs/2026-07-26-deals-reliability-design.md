# Deals reliability design

## Goal

Always show up to four discounted games in the `Popular on Steam` row and refresh homepage recommendations when their server cache expires.

## Popular Steam deals

Steam's `top_sellers` category can contain fewer than four discounted applications. Build the popular list in priority order: discounted applications from `top_sellers`, then discounted applications from `specials`, excluding duplicate app IDs. Stop at four items. The genre-deal candidate pool remains unchanged.

## Recommendations

The recommendation service will return cache metadata alongside its recommendations: the UTC time at which the current cache entry expires. The dashboard forwards that metadata. The homepage schedules one refetch for that time, then continues to schedule refetches from the latest response. It does not poll and it never triggers an extra AI request while Redis has a valid entry.

If Redis is unavailable, recommendations keep their current behavior and omit the expiry metadata; the page does not schedule an automatic refresh in that case.

## Testing

Backend tests cover fallback from top sellers to specials and expiry metadata for cached and newly generated recommendations. Frontend tests use fake timers to verify that the dashboard is refetched at the returned expiry time.
