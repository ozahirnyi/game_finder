# Steam recommendation fallback

## Goal

Keep recommendations useful when Steam is linked but its owned-games request is temporarily unavailable.

## Behaviour

- When Steam games load, build personalised recommendations from Steam games and saved Library games.
- When Steam cannot be read but saved Library games or profile signals exist, build personalised recommendations from those available signals.
- When no personal signals are available, return the existing popular-games fallback instead of an empty recommendations state.

## Scope

Only the dashboard recommendation decision is changed. Steam status reporting remains unchanged, so the UI can still state that Steam is temporarily unavailable.

## Verification

Add regression coverage for a linked Steam account whose Steam request fails while it has saved Library games. The dashboard must return a ready recommendations block rather than the empty-state message. Preserve coverage for successful Steam recommendations and the no-signal popular-games fallback.
