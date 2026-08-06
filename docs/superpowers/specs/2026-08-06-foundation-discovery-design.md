# Foundation and Discovery Design

## Goal

Make the active Vite and TanStack frontend deliver real, end-to-end authentication and game-discovery flows. Users can sign in, search the catalog, act on AI recommendations, and use a game-detail page without prototype data, invalid links, or misleading UI.

## Scope

This delivery covers the API foundation and OpenSpecs user-flow fixes for email auth and sign-out, actionable AI recommendations, truthful search suggestions, and truthful game-detail sections.

It does not add notifications, price-alert changes, favorites, public profiles, privacy controls, onboarding, Party Finder, Groups, or Discord. Those features remain separate deliveries.

## Architecture

`web/src/routes` is the only active application surface. It uses Vite, TanStack Router, and TanStack Query. `web/src/lib/api.ts` is the sole browser HTTP and JWT client and reads `VITE_API_URL`.

Feature-specific modules in `web/src/lib/` own FastAPI DTO mapping and query options for auth, catalog search, recommendations, and game detail. Routes consume those modules rather than importing prototype data or directly constructing HTTP requests.

The remaining Next-oriented files under `web/src/app` and components importing `next/*` are not runtime dependencies. Reusable authentication behavior is migrated into the active routes; dead duplicates are removed or isolated so Vite builds do not depend on them.

## Data and Navigation Flow

1. The sign-in and sign-up routes submit through the API client. A successful login stores the JWT, notifies auth subscribers, invalidates authenticated queries, and navigates to the canonical authenticated route.
2. Signing out clears the JWT, notifies subscribers, clears authenticated query data, and routes to a signed-out screen. No protected view may remain rendered with stale data.
3. Search suggestions update the search query and perform a real catalog search. A selected suggestion is represented in route state so the active visual state and empty copy reflect the submitted query.
4. AI recommendations are matched to a catalog or Steam identity before rendering a game-detail link. Matching uses authoritative IDs when supplied, then normalized exact-title matches. An unmatched recommendation stays non-linking and offers a title search.
5. Game detail loads real catalog or Steam data. Store, price, wishlist, alert, recommendation, and social sections appear only when their underlying resource and action are implemented. Sections that are in scope render useful empty states; out-of-scope prototype promises are removed from the active UI.

## Error and State Rules

- Every query renders explicit pending, empty, and retryable error states.
- A 401 from an authenticated request clears the stored token and changes the auth snapshot.
- No game link may use a placeholder, missing, or zero identity.
- Search-result absence distinguishes an empty query from no matching results.
- A game-detail resource that is missing, private, or unavailable renders a controlled route state rather than crashing.
- User-visible data must originate from FastAPI responses, never from `mockData`.

## Testing Strategy

- Vitest tests the API client, auth form success/failure/pending behavior, sign-out state clearing, search suggestions, AI match/unmatched states, and game-detail pending/empty/error states.
- Pytest covers any new or changed FastAPI contract used by this delivery, including response identity fields necessary for AI links.
- A route-integration test asserts that every active route is free of `mockData` imports.
- The focused frontend suites, backend suites, lint, and production build must pass before the delivery is considered ready.

## Delivery Sequence

1. Establish the Vite/TanStack API foundation and migrate email auth/sign-out.
2. Connect search and implement query suggestions.
3. Add AI recommendation identity matching and safe navigation.
4. Connect game detail and replace prototype sections with real in-scope states.
5. Remove remaining prototype data from active routes and run the full focused verification suite.

## Success Criteria

- A user can register, sign in, and sign out through the active Vite/TanStack routes.
- Search results and suggestions reflect real API data and query state.
- Every AI recommendation either opens the correct game detail or offers a safe title search.
- Game detail contains only real data and real actions, with clear states for absent data.
- Active user-facing routes do not import `mockData`.
