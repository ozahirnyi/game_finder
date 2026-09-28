# Steam library background sync design

## Goal

After Steam sign-in or linking, fetch the user's owned games in a durable background job and save them to the PlayFinder library. Users must not have to open or stay on the Library page to start or finish the initial sync. Public profiles show the saved/live library according to existing privacy settings.

`Sync Now` remains an explicit request to fetch and reconcile the latest Steam library immediately.

## Current behavior

- Steam authentication creates or links the account and stores its Steam ID.
- The Library endpoint fetches owned games only when a user opens the Library page.
- The Steam callback does not queue a game-library sync.
- The public profile endpoint originally read saved games only, and the Steam badge inferred connection from game count.

## Proposed behavior

1. Queue a durable `steam_library_sync` job keyed to the linked Steam ID after successful Steam sign-in and after linking Steam to an existing account.
2. The worker fetches owned games and reconciles the existing owner-scoped `games` rows: create new app IDs, update current metadata/playtime, and remove IDs no longer owned.
3. If Steam fails or the library is private, leave the last successful saved snapshot and account link intact.
4. Use the same reconciliation for `Sync Now`; invalidate the actual Library page queries after it completes.
5. Public profile library reads merge saved Steam, PSN, and manual games with live Steam data while removing duplicate Steam app IDs and honoring library/Steam visibility.
6. Show `Steam connected` based on the link itself, even when no owned games are returned.

## Alternatives considered

- **Start fetching only when Library opens:** rejected because users should not need to stay on that page for sync to run.
- **Use only the live Steam response:** rejected because no server-side work would continue if the user navigates away, and the last successful library would not be available during Steam outages.
- **Remove `Sync Now`:** rejected because it remains useful for an immediate refresh after a recent Steam purchase.

## Storage and migrations

Use the existing `games` table for owner-scoped Steam rows and existing `background_jobs` table for durable work. No schema migration or separate snapshot table is needed.

## Testing

- Backend tests verify callbacks enqueue sync, the worker reconciles the stored snapshot without an open Library request, and failed Steam fetches preserve existing data.
- Public profile tests verify live data merges with saved games and respects visibility.
- Frontend tests verify the Steam connection badge and that Sync Now invalidates Library queries.
