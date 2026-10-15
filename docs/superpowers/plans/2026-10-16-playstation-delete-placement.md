# PlayStation deletion placement

**Goal:** Separate deletion of the whole PlayStation library from routine tab navigation.

**Design:** Move the existing delete action from the tab bar into a “Manage PlayStation library” disclosure after the game list. Add a separate management region with a top divider and explanatory copy that it removes all imported PlayStation entries from Playfinder. Retain the red delete label, existing confirmation, pending state, and result/error message. Show management only in PlayStation. Use existing typography, surface, border, and red action tokens; no new dependencies or endpoint changes.

An always-visible footer button would separate it from navigation but keep a destructive action exposed. A menu beside the tabs would still put it close to routine clicks. The footer disclosure adds both physical separation and a deliberate management step.

**Execution:** Inline, under the user's existing authorization for local changes.

- [x] Add failing tests for management disclosure, confirmation/cancellation, and source-tab scope. Observed two expected missing-management failures before implementation.
- [x] Move the existing control into the footer disclosure without changing its mutation.
- [x] Run route tests (20 passed), scoped lint and TypeScript (passed), and browser checks at desktop/mobile widths (2 passed at 1280px/390px). Inspected screenshots. Browser checks verify the management region follows the game list, deletion stays hidden until expanded, and cancelling confirmation sends no delete request.
- [x] Rebuild the local preview (passed) and verify `/library` HTTP 200. No local library data changed.

Existing jsdom scrollTo, Vite path-plugin, route-export, and terminal color warnings remain. External services are stubbed in tests. No push or deployment.
