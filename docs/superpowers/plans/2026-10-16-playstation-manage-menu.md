# PlayStation management menu

**Goal:** Keep whole-library removal easy to find without placing it among the source tabs.

**Approved design:** A neutral “Manage” button on the right of the search field, above the game list, visible only in PlayStation. The button opens an end-aligned dropdown with a red “Delete all PlayStation games” item. Selecting it retains the existing confirmation and mutation. Remove the footer disclosure. Keep pending state on the trigger and status/error text below the search toolbar so feedback remains visible after the menu closes. Reuse the existing Radix dropdown for keyboard navigation, Escape/outside dismissal, focus return, and mobile collision handling.

**Execution:** Inline. No API or data changes; update only the Library route and focused tests.

- [x] Change deletion tests to expect the management trigger and menu item, including cancelled/confirmed deletion and tab scope; observed two expected failures before implementation.
- [x] Replace the footer disclosure with the search-toolbar menu and existing deletion callback. Verify success and error feedback remains visible after the menu closes.
- [x] Run route tests (21 passed), TypeScript and scoped lint (passed), and desktop/mobile browser checks (2 passed at 1280px and 390px) for placement, keyboard dismissal/focus return, confirmation cancellation, and overflow. Inspected both screenshots.
- [x] Rebuild the local web preview (passed) and verify `/library` returns HTTP 200. No real local entries deleted or changed.

Existing jsdom scrollTo, Vite path-plugin, route-export, and terminal color warnings remain. Tests use stubbed APIs. No push or deployment.
