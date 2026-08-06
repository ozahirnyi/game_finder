# Foundation and Discovery Design

## Goal

Make the active Vite and TanStack frontend deliver real, end-to-end authentication and game-discovery flows. Users can sign in, search the catalog, act on AI recommendations, and use a game-detail page without prototype data, invalid links, or misleading UI.

## Scope

This delivery covers the API foundation and OpenSpecs user-flow fixes for email auth and sign-out, actionable AI recommendations, truthful search suggestions, and truthful game-detail sections. It also completes the Vite/TanStack migration: active application code, shared components, and tests must not depend on Next.js modules or Next-only entrypoints.

It does not add notifications, price-alert changes, favorites, public profiles, privacy controls, onboarding, Party Finder, Groups, or Discord. Those features remain separate deliveries.

## Architecture

`web/src/routes` is the only active application surface. It uses Vite, TanStack Router, and TanStack Query. `web/src/lib/api.ts` is the sole browser HTTP and JWT client and reads `VITE_API_URL`.

Feature-specific modules in `web/src/lib/` own FastAPI DTO mapping and query options for auth, catalog search, recommendations, and game detail. `currentUserQueryOptions()` exclusively owns `/auth/me`: it uses `["auth", "me"]`, is enabled only with a stored token, and is marked as authenticated query data. The routes and shared shell touched by this delivery consume those modules rather than importing prototype data or directly constructing HTTP requests. Other OpenSpecs routes are not silently represented as complete by this delivery.

`web/src/app`, `next/*` imports, and their tests are legacy artifacts, not a second application surface. Reusable behavior is migrated into `web/src/routes` and shared Vite-compatible components; obsolete files are removed. Vitest covers the TanStack runtime and must not discover tests for deleted/archived Next entrypoints.

## Data and Navigation Flow

1. The sign-in and sign-up routes submit through the API client. A successful login stores the JWT, notifies auth subscribers, invalidates `["auth", "me"]`, and navigates to the canonical authenticated route.
2. Signing out clears the JWT, notifies subscribers, clears authenticated query data, and routes to a signed-out screen. No protected view may remain rendered with stale data. The shared shell obtains its account label only through `currentUserQueryOptions()`.
3. Search suggestions update the search query and perform a real catalog search. A selected suggestion is represented in route state so the active visual state and empty copy reflect the submitted query.
4. AI recommendations expose optional `rawg_id`, `steam_appid`, and `steam_url` fields. Matching prefers a positive `rawg_id` for an internal catalog link; otherwise, a positive `steam_appid` together with a nonempty `steam_url` yields an external Steam link; otherwise it uses a normalized exact-title catalog match with a non-null catalog ID. It never infers an identity through fuzzy matching. An unmatched recommendation stays non-linking and offers a title search.
5. Game detail loads real catalog or Steam data. Store, price, wishlist, alert, recommendation, and social sections appear only when their underlying resource and action are implemented. Sections that are in scope render useful empty states; out-of-scope prototype promises are removed from the active UI.

## Error and State Rules

- Every query renders explicit pending, empty, and retryable error states.
- A 401 from an authenticated request clears the stored token and changes the auth snapshot.
- Recommendation IDs are trusted only when valid and explicitly supplied by FastAPI; response schemas preserve every supplied optional identity field.
- No game link may use a placeholder, missing, or zero identity.
- Search-result absence distinguishes an empty query from no matching results.
- A game-detail resource that is missing, private, or unavailable renders a controlled route state rather than crashing.
- User-visible data in the auth and discovery flow must originate from FastAPI responses, never from `mockData`.

## Testing Strategy

- Vitest tests the API client, `currentUserQueryOptions`, auth form success/failure/pending behavior, sign-out state clearing, search suggestions, AI link-precedence and unmatched states, and game-detail pending/empty/error states.
- Pytest covers FastAPI recommendation schema and response preservation for rawg/Steam identity fields.
- Route-integration tests assert that active routes and their shared shell are free of `mockData` and `next/` imports. The full Vitest suite runs only Vite/TanStack-supported source and tests.
- The focused frontend suites, backend suites, lint, and production build must pass before the delivery is considered ready.

## Delivery Sequence

1. Establish the Vite/TanStack API foundation and migrate email auth/sign-out.
2. Connect search and implement query suggestions.
3. Add AI recommendation identity matching and safe navigation.
4. Connect game detail and replace prototype sections with real in-scope states.
5. Remove remaining prototype data from the shared shell and auth/discovery routes and run the full focused verification suite.
6. Remove the remaining Next-only components, entrypoints, and tests; migrate any reusable component to TanStack APIs and make the complete Vite build, lint, and Vitest suite pass.

## Success Criteria

- A user can register, sign in, and sign out through the active Vite/TanStack routes.
- Search results and suggestions reflect real API data and query state.
- Every AI recommendation either opens the correct game detail or offers a safe title search.
- Game detail contains only real data and real actions, with clear states for absent data.
- The shared shell and auth/discovery routes do not import `mockData`.
- No production or executed test source imports `next/*`; the complete frontend runs under Vite/TanStack.
