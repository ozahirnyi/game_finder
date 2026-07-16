# Lovable Backend Integration Design

## Goal

Connect the public Lovable/TanStack interface to the existing FastAPI backend while preserving the approved visual design. Replace mock content with real API data wherever the backend supports it.

## Scope

The frontend will use `https://game-finder.up.railway.app` as its production API base and the existing authenticated FastAPI endpoints for account, game-library, Steam, Telegram, search, catalogue, pricing and recommendations data.

The existing Lovable routes will keep their markup and visual hierarchy. They will no longer import `src/lib/mockData.ts` for user-visible data:

- Dashboard: authenticated user, catalogue/deals and available Steam social data.
- Search and game detail: catalogue search, game details and price history.
- Library and wishlist: authenticated `/games` CRUD data, with source/notes shown when available.
- Deals: `/prices/deals` and game price-history data.
- Steam: connection state, imported library, sync, recommendations and social data.
- Profile: `/auth/me`, Google status, and Telegram account actions.
- PSN: real preview-and-confirm import flow.

## Architecture

`web/src/lib/api.ts` is the single HTTP boundary. It reads `VITE_API_URL` and falls back to the Railway backend URL. The client sends an `Authorization: Bearer` header only when a local auth token exists, normalizes API failures, and exposes typed endpoint functions.

Lovable routes call those functions through React Query hooks. Queries use keys scoped by endpoint inputs; successful mutations invalidate the affected queries so the UI immediately reflects server state. Route components retain the approved Lovable layout and map API DTOs to its presentational card shapes locally or through small focused adapters.

Authentication remains token-based: login/register and OAuth exchange store the returned JWT; logout clears it and invalidates protected data. Public catalogue and price queries remain available when signed out.

## Honest Missing-Feature Behaviour

No social activity, friend list or LFG record will be fabricated. `/steam/social` data is rendered only after a connected Steam account has supplied it. Screens show an explicit sign-in, connect-Steam, empty, or unavailable state for missing data. This replaces the current mock social cards without changing the surrounding page design.

## Error Handling

The UI distinguishes unauthenticated (`401`), Steam-not-connected (`409`), validation (`422`), and service/network failures. Protected views provide a sign-in or account-connection action; mutation failures stay local to the action that failed and provide a retry. Query failures retain existing page chrome and show a retry control rather than a blank page.

## Deployment Configuration

The backend Railway service must permit `https://web-production-1d5b1.up.railway.app` in `FRONTEND_ORIGINS` and use it as `FRONTEND_PUBLIC_URL` for OAuth return URLs. The frontend Railway service receives `VITE_API_URL=https://game-finder.up.railway.app` at build time. Both production URLs are explicit configuration, not hard-coded component values.

## Verification

Add focused tests for API error classification and key route states (signed out, empty, loaded, mutation failure). Run frontend typecheck/lint/tests/build and backend API contract tests. Deploy frontend and backend configuration, then verify the public site serves the dashboard and a cross-origin API request succeeds.

## Exclusions

This work does not introduce a new social graph, persistent LFG service, new recommendations engine, or backend endpoints beyond configuration necessary for the already implemented API. Those unavailable features remain explicit empty states.
