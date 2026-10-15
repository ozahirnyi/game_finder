# Individual PlayStation matching covers

**Goal:** Show game covers beside catalog results when matching a single PlayStation entry.

**Design:** Reuse GameCover with a 48 × 64px portrait slot beside the existing selectable title. Prefer `cover_image`, fall back to `background_image`, and preserve the existing missing-image fallback. Keep the full title readable on mobile and retain the button's accessible name and explicit selection behavior. The alternative of adding a separate preview popup would add navigation without helping this small list.

**Scope:** Change only the inline picker in `web/src/routes/library.tsx`, its route tests, and focused browser coverage. No API changes. Work inline under the user's existing local implementation authorization.

- [x] Add a failing test for cover preference, legacy images, and missing images; retain the explicit link action. Observed the missing-image assertion fail before implementation.
- [x] Implement covers and responsive result layout with existing design tokens.
- [x] Run focused route/component tests (38 passed), TypeScript and scoped lint (passed), and desktop/mobile browser coverage (2 passed at 1280px and 390px). Inspected both screenshots. Browser tests verify actual image loading, broken/missing-image fallback, no horizontal overflow, no automatic application, and the selected catalog ID on click.
- [x] Rebuild local web preview (passed; `/library` HTTP 200), then unlink only GTA V in the local test account and verify all entry IDs and the other five games remain unchanged.

Existing jsdom scrollTo, Vite path-plugin, route-export, and terminal color warnings remain. External APIs are stubbed in tests. No push or deployment.
