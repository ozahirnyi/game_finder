# Account Steam library overview design

## Goal

Show connected Steam games and playtime accurately on the account profile by using the same unified library data as the Library page.

## Evidence

The production Steam integration returns 147 owned games for the affected connected account, with nonzero playtime. The account route currently calls the legacy `getLibrary()` endpoint, which contains only persisted manual or imported records; consequently the profile shows zero Steam games and zero hours. The Library page already calls `getLibraryOverview()`, which includes live Steam records.

## Scope

Update only the self-account route and its tests. The Steam transport, Steam API key, OpenID link flow, database persistence model, public/friend profiles, and Library page remain unchanged.

## Design

`web/src/routes/account.tsx` will request `getLibraryOverview()` and derive its profile cards from `overview.games`. Steam and PlayStation counts retain their current source-based calculation. Hours are computed from `playtime_forever` in the unified list, so live Steam values are included.

The account route will render an empty array while the overview request is loading or unavailable, preserving the current non-crashing loading behavior. The existing `steam_error` value is not reworded or remapped in this narrowly scoped fix.

## Testing

Add a focused route/component test with a mocked overview containing a Steam game and a persisted manual game. It must verify the profile renders the Steam count and the aggregated hours from the overview response, preventing a return to the legacy endpoint.

## Verification

Run the focused frontend test and production build. After the normal Lightsail deployment of the merged SHA, open `/account` while signed in to the affected account and verify that its Games, Steam, and Hours counters match `/library`.
