# Auth recovery report

## Root cause

The Vite/TanStack application had no `/login` or `/register` routes. The existing auth pages were Next-specific and therefore absent from the generated TanStack route tree, leaving signed-out users unable to establish the token required by `/auth/me` and `/games`.

## Changes

- Added TanStack `/login` and `/register` routes using the existing Lovable auth classes.
- Login stores the access token and navigates to `/profile`.
- Registration creates the user, signs in, stores the token, and navigates to `/profile`.
- Preserved visible form errors and credentials after a failed request.
- Added a `/login` link when the profile request fails with HTTP 401.
- Regenerated `web/src/routeTree.gen.ts` so both routes are live.

## Verification

- `npm test -- --run src/test/auth-recovery.routes.test.tsx` — passed: 4 tests.
- `npm run build` — passed.
- `npm test` — remains blocked by pre-existing frontend-suite failures: several legacy modules resolve `next/link`/`next/navigation`, the PostCSS config references missing `@tailwindcss/postcss`, and `AppShell.test.tsx` renders TanStack navigation outside a RouterProvider. The auth-recovery focused test passes independently.
