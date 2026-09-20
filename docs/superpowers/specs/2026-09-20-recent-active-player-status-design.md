# Recent Active Player Status Design

## Goal

Ensure that a Steam outage is never presented as an empty `Recently active players` ranking.

## API contract

Both active-player endpoints will return a `RecentGamePlayersRead` object:

```json
{
  "players": [],
  "status": "ready"
}
```

`status` is one of:

- `ready`: every eligible public Steam library was read successfully, or there were no eligible Steam accounts to read.
- `partial`: at least one eligible library could not be read, while the response still has a usable ranking (including an empty ranking supported by stored game records).
- `unavailable`: Steam could not be queried for any eligible public Steam account and no stored ranking is available.

The response deliberately does not expose which account failed or why. A private library continues to be skipped normally and does not produce a warning.

## Server behavior

`recent_steam_players_for_app` continues to merge stored two-week playtime with live Steam library data, de-duplicate users, sort by descending minutes, and limit to ten. It additionally records whether live Steam lookups failed due to a provider/service failure (`HTTPException` other than the expected private-library `409`). The helper returns the players plus the aggregate status.

The catalog and direct-Steam routes retain their lookup rules and return this object through a Pydantic response model.

## Client behavior

The API client exposes the new object. The game-detail query passes both `players` and `status` to `GameRecentPlayers`.

- `ready`: existing ranking or honest empty state.
- `partial`: existing ranking/empty state plus a generic note that some Steam activity is temporarily unavailable.
- `unavailable`: the existing retryable unavailable state.

The component retains its client-side descending sort as a defensive presentation invariant.

## Tests

Backend contract tests cover a successful live result (`ready`), a private library (not degraded), a provider failure alongside another usable result (`partial`), and a provider failure with no usable result (`unavailable`). Frontend component tests cover the partial warning and unavailable presentation; existing sort coverage remains.
