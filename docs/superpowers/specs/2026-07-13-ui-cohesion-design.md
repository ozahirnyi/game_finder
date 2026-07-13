# UI Cohesion Design

## Goal

Unify the Game Finder interface across search, deals, game detail, saved games, authentication, profile, and Steam pages while retaining the existing monochrome theme and all current features.

## Visual direction

- Preserve the established black, white, grey, success, and danger colour values; do not add a Steam-blue or other new accent palette.
- Create hierarchy through contrast, spacing, type scale, images, borders, shadows, and small line icons.
- Treat a game cover as the primary visual anchor, then title and price/status, then supporting actions.
- Use short motion only for hover, focus, card lift, and active controls; respect reduced-motion preferences.

## Component system

- Normalise surface, card, compact-row, badge, button, field, alert, and empty-state treatments in `globals.css`.
- Add a small reusable inline SVG icon component. Icons are decorative when adjacent to text and labelled for icon-only controls.
- Update the header to use icons, visibly mark the active route, and collapse gracefully without overlap at narrow widths.
- Keep controls reachable and readable at 320px wide. Preserve keyboard focus visibility and sufficient tap targets.

## Screen application

- Search: strengthen hero/search grouping, mode control, game cards, recommendation cards, and discovery sections.
- Deals and game details: make prices, discounts, external-store actions, and metadata immediately scannable.
- Library, profile, Steam, and auth: apply the same panel hierarchy, compact rows, labels, and action styles.
- Existing data flow, routes, API calls, and copy remain intact unless a label must be clarified by an icon.

## Quality checks

- No API or behavioural changes.
- Build and lint succeed.
- Verify the main, deals, game detail, favourites, profile, Steam, login, and register routes in desktop and mobile viewports.
