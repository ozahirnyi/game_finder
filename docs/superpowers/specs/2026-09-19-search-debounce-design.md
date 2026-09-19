# Search debounce and stable results

## Goal

Make catalog search wait until the user pauses typing, and prevent a background
refresh from replacing existing game cards with the full-page searching state.

## Behaviour

- The text box updates immediately and keeps the URL query parameter current.
- Catalog requests use a debounced version of the text, delayed by 700 ms after
  the most recent edit.
- Filter changes remain immediate: they use the current debounced text and do
  not wait for the text timer.
- The initial catalog request, when no results are available yet, shows the
  existing "Searching games" empty state.
- When a request is refreshing cached or prior results, cards remain visible;
  the full-page searching state is not rendered over them.
- Returning to Search may refresh stale cached data, but cannot hide already
  rendered results behind a transient loading state.

## Implementation outline

Keep the input value separate from the value used in the React Query key. A
small local debounce hook provides the latter. Use React Query's initial-loading
state, rather than its broad fetching state, for the empty-state loading UI.

## Tests

- Typing several characters produces no catalog request until the 700 ms pause
  elapses, then produces one request using the completed term.
- Cached catalog results remain displayed when Search is remounted and its query
  refreshes in the background.
