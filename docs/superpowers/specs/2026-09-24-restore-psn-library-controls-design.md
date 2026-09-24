# PSN library controls and totals

## Goal

Make the destructive PSN-library action reachable from the Library page and make the header counts independent of infinite-scroll loading, filtering, and the selected source tab.

## User experience

- Selecting the `PlayStation` tab shows a `Delete all PlayStation games` action.
- The action retains the existing confirmation dialog, deletes only PSN entries for the authenticated user, and refreshes both the paginated library and the aggregate summary after success.
- The action is not shown on `All games` or `Steam`.
- `Games`, `Steam`, and `PlayStation` in the Library header always show the user's complete inventory totals. They do not change when a search query, source filter, sort order, or an incomplete infinite-scroll page changes the displayed cards.

## Technical design

`LibraryPage` will retain the paginated query for cards and add a complete-library overview query exclusively for the three header totals. The existing overview endpoint already supplies the full owner-scoped inventory and avoids a backend contract change.

The existing `deletePsnLibrary` API function and confirmation text will be reused. A mutation local to `LibraryPage` will invalidate the overview, paginated-library, and repair queries after successful deletion. Its success/error feedback will remain within the PlayStation tab.

## Tests

- A Library route test demonstrates that aggregate header counts are derived from the overview rather than the first loaded page.
- A Library route test demonstrates that the destructive PSN action is available only on the PlayStation tab, calls the existing deletion API after confirmation, and refreshes affected queries.
