# PlayStation matching entry

**Goal:** Make the location of PlayStation catalog matching clear from All games.

**Design:** Add one compact guidance section below the library tabs, visible in All games when the aggregate library contains at least one unmatched PlayStation entry. Hide it when all PlayStation games are linked to the catalog, regardless of unmatched manual games. Explain that covers and details are added through PlayStation → Match PlayStation games. An “Open PlayStation library” button selects that tab without starting a lookup or changing games. Keep the existing surface, border, typography, and responsive spacing; stack the action on small screens. Hide the guidance in Steam and PlayStation. Refresh the aggregate overview after individual matching and background completion so the hint disappears without a reload; bulk matching already refreshes it.

A badge on the tab alone would not explain what matching does. Repeating matching controls in All games would undo the agreed separation of PlayStation tools. The contextual guidance gives a direct path while preserving that separation.

**Architecture:** Use the existing aggregate overview and local tab state in `web/src/routes/library.tsx`. No new endpoint or persisted state. Use existing design tokens and Gamepad2 icon. Do not depend on the current search, sort, or loaded page to discover whether the user has PlayStation games.

**Execution:** Inline, as requested. Existing authorization covers local implementation and preview updates.

- [x] Add route tests for guidance, tab switching without lookup/apply, visibility boundaries, and aggregate detection despite a filtered page.
- [x] Run the focused tests and observe the missing guidance failure: two expected failures before implementation.
- [x] Implement the guidance in `web/src/routes/library.tsx`.
- [x] Run route/component tests (25 passed), TypeScript, and scoped lint (both passed).
- [x] Verify the entry at desktop and mobile widths with stubbed browser tests (2 passed at 1280px and 390px). Inspect both screenshots; no horizontal overflow or clipped guidance.
- [x] Rebuild the local web preview and confirm `/library` responds HTTP 200.

**Validation commands:** From `web`, run `rtk npm run test -- src/routes/-library.test.tsx src/components/LibraryCatalogMatches.test.tsx`, `rtk proxy .\node_modules\.bin\tsc.cmd --noEmit`, `rtk proxy .\node_modules\.bin\eslint.cmd src/routes/library.tsx src/routes/-library.test.tsx e2e/phase-one-discovery.spec.ts --max-warnings 0`, and `rtk proxy .\node_modules\.bin\playwright.cmd test e2e/phase-one-discovery.spec.ts --grep "library guidance"`. From the workspace, rebuild only web using `.superpowers/local-preview.compose.json`.

Existing jsdom `scrollTo`, Vite path-plugin, route-export, and terminal color warnings remain. Browser tests stub APIs and verify no catalog-match request is triggered by navigation. No library data changed. Local preview only; no push or deployment.

Follow-up visibility refinement: reproduced two failures (fully matched library and stale overview after an individual link), then verified 26 route/component tests and 4 browser scenarios at desktop/mobile widths. TypeScript, scoped ESLint, diff check, and the rebuilt local web image passed; local `/library` returned HTTP 200. Bulk matching coverage now checks that the guidance disappears after the final link without reloading.
