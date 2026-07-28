# FastAPI Frontend Integration Design

## Goal

Replace the current `web/` application with the supplied Playfinder TanStack
Start frontend and connect every screen to the existing FastAPI backend. The
existing backend remains the source of truth; Supabase and Lovable Cloud are
not introduced.

## Scope and constraints

- Preserve the archive's markup, Tailwind styling, layout, and route tree.
- Do not edit `web/src/routeTree.gen.ts`.
- Keep existing FastAPI JWT authentication, RAWG catalog, Steam, PSN, price,
  Google, Telegram, and recommendation integrations.
- Add only the FastAPI persistence and endpoints needed by screens that do
  not have an equivalent current API: profile preferences, wishlist state,
  and application friendships.
- Configure the client API origin with `VITE_API_URL`; no backend URL or
  secret is hard-coded in the frontend.
- Continue using one `ProfileView` for account and friend-profile routes.

## Architecture

`web/` will be replaced atomically from the provided archive after recording
the current frontend state in Git. A small client API module will own fetch,
JWT storage, authentication-change notifications, request errors, and
TypeScript DTO mapping. Route-level query options call that module; components
remain presentation-focused and retain the archive UI.

FastAPI will expose resource-oriented endpoints that return the shapes the
frontend consumes. Existing endpoints are reused for public game discovery,
deals, price history, owned games, Steam social data, and authentication.
New SQLAlchemy/Alembic data covers user profile preferences, wishlist entries,
and accepted/requested friendships. Authorization stays server-enforced:
users may mutate only their own profile/library/wishlist, and a friend profile
is returned only to an accepted friend. Private email, notification settings,
and connection tokens are never returned in friend responses.

## API mapping

| Frontend area | Backend source |
| --- | --- |
| Sign in/sign up/sign out | Existing `/auth/register`, `/auth/login`, `/auth/me`; client-side token removal for sign out |
| Search and game detail | Existing `/search/games`, `/catalog/games/{id}`, `/prices/games/{id}` |
| Home and deals | Existing `/catalog/trending-games`, `/catalog/upcoming-games`, `/prices/deals` |
| Library | Existing `/games`, `/steam/library`, `/steam/library/sync`, plus source/status mapping |
| Wishlist | New authenticated wishlist endpoints backed by a persistent table |
| Account | New authenticated profile read/update endpoint composed with existing Steam/PSN/Telegram connection state |
| Friends | New friendship endpoints and safe friend-profile endpoint; Steam social remains a supplementary source for shared-game metadata |

## Data and error behavior

Public pages (`/`, `/search`, `/deals`, `/games/$gameId`) load without a token.
Library, wishlist, friends, and account redirect to `/sign-in?returnTo=…` when
the client has no valid JWT. Each data surface has an inline skeleton while a
query is pending, a friendly empty state with a relevant action, and an inline
retryable error. The friend-profile route uses the router `notFound()` path for
missing users and non-friends.

## Delivery order

1. Replace `web/` from the archive and establish its build/test baseline.
2. Add the frontend API/auth foundation and wire sign-in/sign-up/public routes
   to existing FastAPI endpoints.
3. Add FastAPI migrations and endpoints for profiles, wishlist, and
   friendships, with ownership and friendship authorization tests.
4. Wire protected library, wishlist, friends, and account routes, preserving
   UI and adding loading/empty/error states.
5. Verify frontend lint/typecheck/build and backend tests; run an authenticated
   browser pass for core public and protected flows.

## Testing

Backend tests cover authentication boundaries, profile ownership, wishlist
ownership, friendship visibility, and DTO serialization. Frontend tests cover
unauthenticated redirects, API error rendering/retry, empty states, sign-out,
and successful mapped responses. Production build and typecheck are required
after every delivery phase.
