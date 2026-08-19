# Phase 4: Truthful Home States - Design

**Date:** 2026-08-19  
**Status:** Approved design; awaiting review of this written specification

## Goal

Keep Home as a real-data entry point while making every asynchronous result
truthful and actionable. This phase fixes state presentation and invalid
recommendation navigation; it does not redesign Home or introduce a new product
surface.

## Repository evidence

- `web/src/routes/index.tsx` already reads real API resources through TanStack
  Query: `/dashboard`, `/catalog/trending-games`, `/prices/deals`, `/profile`,
  `/library/overview`, and `/friends`.
- Home search submits to the working `/search?q=...` route.
- `/prices/deals` is a public, cached API. Its current UI renders cards only
  when data exists, so pending, empty, and failed responses leave the section
  without a clear explanation or recovery action.
- The guest trending section has a similar ambiguity: an in-flight query falls
  through to the same copy as an unavailable API.
- The signed-in greeting and library/friends panels use `?? 0`, so a pending
  request can be displayed as a real zero count.
- `RecommendationCard` links every recommendation to a detail target built
  from `igdb_id ?? 0`. A recommendation with no verified catalog identity can
  therefore navigate to `/games/0`.

## Options considered

1. **Replace Home with a single dashboard endpoint.** This would centralize
   state but duplicates existing public discovery resources, changes cache and
   authorization boundaries, and is unnecessary for the identified issues.
2. **Use existing queries with explicit local presentation states.** This keeps
   the real API contract and current working navigation intact while making
   each state visible. **Chosen.**
3. **Hide sections whenever their query is not ready.** This avoids incorrect
   information but makes a slow API look like missing functionality and gives
   the user no retry path.

## Design

### Query and state rules

Home retains the existing TanStack Query keys and API methods. No backend route,
schema, migration, or aggregate endpoint is needed.

- The signed-in heading and the library/friends summary show a neutral loading
  description until their individual source query has settled. They must not
  claim zero games or friends while loading or after an error.
- Guest discovery distinguishes loading, an empty catalog result, and an API
  error. An error includes a retry control that refetches only trending games.
- `Price drops` distinguishes loading, empty, and error states. The error state
  includes a retry control that refetches only the selected-region deals. The
  visible grid is rendered only for real deal results.
- The existing region selector remains. Changing the region retains the normal
  TanStack Query transition and does not manufacture a result from the prior
  region.
- Signed-in personalized recommendations retain the dashboard contract:
  `ready`, `empty`, and `error` are rendered according to the server block.
  A network-level dashboard failure gets an explicit unavailable state and a
  retry control rather than being presented as an empty recommendation list.

### Recommendation navigation

- A recommendation with a positive verified `igdb_id` is a link to that real
  detail page.
- A recommendation without that identity is not a link and never constructs
  `/games/0`.
- The unmatched card preserves its title, AI reason, and tags, explains that a
  catalog page is not available, and provides a real `Search this title` link
  to `/search?q=<title>`.

### Scope boundaries

This phase does not add onboarding, Party Finder, Groups, Discord, presence,
new recommendation sources, local completion flags, new Home APIs, or a visual
redesign. It preserves the working routes `/search`, `/games/$gameId`,
`/library`, and `/friends`.

## Test design

Focused Vitest coverage in the Home route tests will prove:

1. a pending, empty, and failed price-deals request each has distinct visible
   copy, and retry refetches the active region;
2. guest trending has distinct pending, empty, and failed states, and retry
   refetches it;
3. pending profile/library/friends queries do not show false zero counts;
4. dashboard network failure is explicit and retryable;
5. a matched recommendation uses its verified detail link, while an unmatched
   one has no `/games/0` link and routes its search action to `/search`.

The existing focused Home tests remain the primary regression suite; no backend
tests are needed because the API contracts do not change.

## Acceptance criteria

- Home never presents pending or failed real data as a known zero or as a
  silently missing section.
- Every failed Home resource has clear copy and a scoped retry where the user
  can reasonably retry it.
- Home never links an unmatched recommendation to an invalid placeholder game
  route.
- All visible actions continue to execute an existing action or navigate to an
  existing route.
