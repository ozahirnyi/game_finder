# Hide unavailable profile-library playtime

## Goal

Profile-library cards must show playtime only when the API provides a usable value. A missing playtime must not produce placeholder text.

## Behavior

- A card with a numeric `playtime` shows whole hours only, using the existing profile playtime formatter's hour value.
- A card with `null` or omitted `playtime` renders no playtime row.
- No API, storage, or platform-import behavior changes; the UI treats Steam, PlayStation, and other sources identically.

## Implementation and testing

- Update the profile-library card markup in `web/src/components/ProfileView.tsx` to conditionally render the label only for non-null playtime.
- Adjust the profile formatter to output complete hours without minutes.
- Add focused component coverage for both a known playtime and an unavailable playtime.
