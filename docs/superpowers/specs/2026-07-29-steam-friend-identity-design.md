# Steam friend identity design

## Goal

Show a connected friend's Steam persona name in the Friends list and friend profile when it is available, while always rendering a stable non-empty fallback.

## Evidence

`GET /friends` currently serializes `PublicUserRead` through `public_user_response`. It includes the Steam avatar but omits `User.steam_persona_name`. Both frontend friend routes render only `user.display_name`, so a Steam persona can never reach the UI.

## Scope

Change the public friendship response and the two friend-facing routes. Do not alter Steam OpenID, the Steam profile batch transport, friendship persistence, direct messages, or public profile privacy settings.

## Contract

`PublicUserRead` gains `steam_persona_name: str | None`. `public_user_response` maps the linked user's stored Steam persona into that field. The field is optional so friends without Steam remain compatible.

The frontend selects `steam_persona_name` when it is non-empty after trimming; otherwise it uses the existing Playfinder `display_name`. The UI never substitutes a fuzzy game-related name or a blank string.

## Testing

Add a backend API contract test proving that a friend response includes the linked Steam persona. Add a frontend test for the name-selection helper or friend presentation path that covers both persona-present and persona-absent cases.

## Verification

Run the focused backend and frontend tests plus the frontend production build. After normal deployment, inspect a Steam-linked friend in `/friends` and `/friends/<id>`; both surfaces must show the same persona name, while a non-Steam friend keeps the Playfinder display name.
