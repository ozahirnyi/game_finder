# Steam library auto-sync implementation plan

## Goal

Automatically import and persist a user's Steam library after sign-in or linking, without depending on the user opening or staying on the Library page. Keep public-profile privacy and a manual Sync Now action.

## Changes

1. Enqueue a durable Steam sync job on successful Steam sign-in and account linking.
2. Add a worker operation and shared snapshot reconciliation using existing owner-scoped `games` rows; reuse the reconciliation for Sync Now.
3. Load saved/live Steam games in public profiles, preserve privacy checks, and derive connection status from the Steam link.
4. Make Sync Now invalidate the actual Library page query.
5. Add focused backend and frontend regression tests.

## Verification

Run focused backend Steam/auth/profile tests and relevant Vitest suites. Run `git diff --check` and inspect the final working tree. Do not deploy or change production.
