# All users and game activity design

## Goal

Help early Playfinder users discover each other by exposing a paginated public player directory and showing recent site-wide activity for a game.

## Scope

- Add a dedicated, authenticated `All users` route entered from the Friends page. It lists 10 eligible site users per page, newest first, excludes the viewer and blocked users, and provides numbered pagination.
- Keep the current Friends add dialog and its single nickname search. Remove the duplicate search control responsible for the Friends-page regression; the directory is not a search filter.
- Add an authenticated game-detail region showing up to 10 distinct public users whose imported Steam entry maps to the displayed catalog game and has `playtime_2weeks > 0`. Sort by descending two-week playtime, then a stable user key. Each row links to the existing public profile.
- Reuse the existing friend-request lifecycle. Directory cards expose profile and a request action only when no friendship or pending request already exists.
- Generate favicon variants from the supplied PNG and declare them in the TanStack root head.

## Data and privacy

The directory and activity endpoints must apply the existing social block/visibility policy. Activity is derived solely from imported `Game` rows with `source == "steam"`, a matched `catalog_game_id`, and a positive two-week value; no Steam request is made while rendering a game page. A game can contribute one row per user. Users without imported qualifying data are omitted.

## UX states

The directory has loading, empty, error/retry, and page navigation states. A request immediately disables the request action and invalidates relevant social queries after success. The game panel is omitted when nobody qualifies; endpoint failure renders a compact unavailable state without hiding game metadata or price actions.

## Testing

Backend tests cover pagination, self/block exclusion, relationship status, catalog identity, distinct-user ordering, and public privacy behavior. Route tests cover navigation to the directory, numbered pages, card actions, game-player rendering, and absent/error states. Test commands must be launched from the canonical `Z:` worktree path on this machine, because Vitest resolves the physical worktree path there.
