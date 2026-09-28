# Steam library visibility and refresh design

## Goal

When a user signs in with Steam or connects Steam to an existing Playfinder account, their owned Steam games should be available in their Playfinder library and visible on their profile according to their privacy settings. The user should not need to save or import each game manually.

`Sync Now` remains an explicit manual refresh for users who want to request a fresh Steam library response immediately.

## Current behavior

- Steam authentication creates or links the Playfinder account and stores the Steam ID.
- The signed-in user's library endpoint can fetch owned Steam games directly from Steam.
- The public profile endpoint builds its library from saved `games` rows only, so it omits live Steam-owned games.
- The profile's Steam status chip is inferred from the count of Steam games, so an empty profile can incorrectly say Steam is not connected.
- Steam-owned games are not stored as ordinary saved-game rows; keep this live-data model and avoid duplicating the library in the database.

## Proposed behavior

1. Keep Steam authentication and account linking as the source of the connected state.
2. Include the live Steam library in public profile library data when the owner's existing library and Steam visibility settings allow the viewer to see it. Reuse the existing visible-library snapshot/fetch path where practical.
3. Keep manually saved and PlayStation games in the same profile library result, with duplicate Steam app IDs removed.
4. Show `Steam connected` from the account link state even when the Steam API returns zero games. If the API is temporarily unavailable, retain the connected status and report the library as unavailable rather than disconnected.
5. Keep `Sync Now` as a manual fresh fetch. Normal library/profile reads continue to load the current Steam library automatically; no scheduled background polling is added.
6. Honor existing library and Steam visibility rules for public profiles and friend views.

## Alternatives considered

- **Persist Steam snapshots in `games`:** rejected because the current library path deliberately treats Steam games as live data and cleans legacy Steam rows; persistence adds duplicate and stale-data behavior.
- **Remove `Sync Now`:** rejected because it is a useful explicit refresh even when normal views already fetch current data.
- **Only correct the connected badge:** rejected because it leaves Steam games absent from public profiles.

## Testing

- Backend contract tests verify that a visible public profile includes Steam games returned by the Steam client, merges saved games without duplicate Steam app IDs, and hides Steam data when visibility disallows it.
- Frontend tests verify that the profile shows a connected Steam state independently of game count and renders the returned library games.
- Existing `Sync Now` behavior remains covered as an explicit refresh action.

## Constraints

- No migration or Steam-game snapshot table is planned.
- Failed Steam API calls must not undo account creation or Steam linking.
- Tests mock the Steam provider; no live Steam API call or key is needed.
