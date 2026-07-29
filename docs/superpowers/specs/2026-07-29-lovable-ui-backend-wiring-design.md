# Lovable UI Backend Wiring Design

## Goal

Replace the current web UI with the updated Lovable archive while preserving the existing FastAPI product behavior. The shipped UI must never rely on mock data or decorative controls that do not invoke a supported API operation.

## Scope

- Adopt the updated visual components: `GameCard`, `ConnectedServices`, `SocialAuthButtons`, `NotificationsPanel`, price presentation, real-cover support, and the PSN import route.
- Keep theme controls in the sidebar/mobile header only; remove them from profile content.
- Restore the user-facing flows already supported by FastAPI: Google and Steam OAuth, Steam account linking/sync/unlink, PSN preview/confirm import, profile editing, catalogue detail, prices, wishlist, library, friends, notifications, and invitations.
- Preserve the current same-origin `/api` boundary, token storage, deployment model, and TanStack Start routes.

## Architecture

The archive supplies presentation components only. `web/src/lib/api.ts` becomes the single typed adapter for every backend flow, including auth redirects and authenticated actions. Page-level React Query hooks load those operations and map API responses into the archive component props; components remain presentational where practical.

`GameCard` always receives an internal catalogue ID and links to `/games/$gameId`. Store URLs are rendered solely as explicit controls on a game detail page. `GameCover` receives an image URL from catalogue, price, library, or collection data and falls back to the existing generated cover only when the URL is absent or fails to load.

## User Flows

### Authentication and connected services

Sign-in and sign-up invoke Google and Steam login URL endpoints and navigate to the provider. The callback exchanges the returned code, stores the access token, and returns to the requested in-app route. Profile service rows invoke Google linking, Steam linking, Steam library sync, and Steam unlink endpoints, surface API errors, and invalidate profile/library queries after success.

### PlayStation import

The `/psn-import` stepper uses a selected export file with `/psn/import/preview`; the preview lists backend-detected titles and selected entries. Confirmation posts the selected titles to `/psn/import/confirm` and renders actual created, updated, skipped, and total counts.

### Catalogue and prices

Home, search, deals, library, wishlist, and friends use cards with actual cover URLs. All card clicks remain internal. Detail pages show real price, regular price, discount, currency, shop, and store URL when available. Formatting uses `Intl.NumberFormat`; missing prices are explicit unavailable states.

### Social and notifications

Friends, requests, conversations, invitations, and notifications render only API-returned data. Empty/loading/error states replace mock compatibility, activity, timers, and counts.

## Error Handling and Data Rules

- Authenticated endpoints without a valid token direct users to sign-in or render an intentional sign-in call to action.
- API errors are visible in the component that initiated the action and retain the user’s current page state.
- Loading states use archive skeletons; empty states explain the next supported action.
- Archive `mockData.ts` is not imported by production routes/components after migration.
- Values such as last sync, notifications, game counts, currency, cover image, and price come only from API data.

## Verification

- Unit tests prove the API client forms correct OAuth, Steam, PSN, and price requests.
- Component/route tests prove internal game navigation, real cover propagation, absence of profile theme selector, and integration action states.
- Run frontend tests, lint, production build, backend pytest suite, then browser-test deployed pages after release.
