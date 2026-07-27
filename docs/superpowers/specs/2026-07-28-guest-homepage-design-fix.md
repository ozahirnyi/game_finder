# Guest homepage design fix

## Problem

The public homepage renders correctly-functioning deal data but uses legacy
`stack`, `game-grid`, and related CSS class names that are not defined by the
current Vite/Tailwind design system. The result is unstyled layout, form
controls, and deal cards.

## Design

Keep the public data flow, region selector, USD fallback, and accessible
semantics unchanged. Replace only the visual class names in `GuestHome` and
`PublicDeals` with the existing Tailwind tokens used by the current dashboard:

- a bounded, responsive hero with a visible search field and primary action;
- a section header with the region selector aligned on larger screens;
- responsive deal cards with fixed-ratio covers, borders, spacing, and clear
  price hierarchy;
- styled loading, error, and empty states using existing surface, border, and
  muted-color tokens;
- preserved reduced-motion behavior from the global stylesheet.

## Validation

Add focused component assertions for the structural styling hooks, retain the
existing data and navigation tests, then run the web tests, lint, and build.
