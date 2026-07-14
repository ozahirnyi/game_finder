# Game Finder dashboard UI redesign

## Goal

Turn Game Finder from a search-first collection of pages into a cohesive, responsive gaming dashboard. Search remains important, but Deals, Library, Steam, Friends, and Profile become equally discoverable parts of the product.

The redesign keeps the current monochrome visual theme and all existing backend behaviour. It changes information architecture, page composition, navigation, buttons, spacing, and responsive behaviour.

## Scope

The redesign covers every frontend route and shared UI element:

- Dashboard and global navigation
- Search and AI search
- Deals and price information
- Game detail
- Library and saved-game detail
- Steam account, library analysis, and recommendations
- Friends
- Profile and connected services
- Login, registration, and authentication callbacks
- Shared buttons, fields, panels, toolbars, rows, alerts, and empty/loading states

Backend endpoints, authentication contracts, imports, alerts, prices, Steam sync, social data, and recommendation behaviour remain unchanged.

## Information architecture

The authenticated application uses these primary destinations:

| Destination | Route | Purpose |
| --- | --- | --- |
| Dashboard | `/` | Compact overview and entry points into the product |
| Search | `/search` | Title search and AI-assisted discovery |
| Deals | `/deals` | Current discounts and saved-game prices |
| Library | `/favorites` | Saved games, notes, sources, and alerts |
| Steam | `/steam` | Steam connection, library, playtime, and AI recommendations |
| Friends | `/friends` | Steam friend comparison and shared taste |
| Profile | `/profile` | Account settings, connections, notifications, and imports |

Existing game and saved-game detail routes remain `/games/[id]` and `/favorites/[id]`.

The current search experience moves from `/` to `/search`. Dashboard becomes the root route. Links and redirects inside the application must be updated so no workflow still assumes that `/` is the search page.

Unauthenticated users can open Dashboard, Search, Deals, Login, and Register. Library, Steam, Friends, and Profile retain their authentication checks and redirect to Login with an explanatory message.

## Application shell and navigation

### Desktop

At desktop widths, a 72 px icon rail is always visible. It contains the GF mark, primary destinations, and the profile control. Labels are available through accessible tooltips on hover and keyboard focus.

Pressing the GF mark or menu control opens a labelled drawer up to 320 px wide over the content. The drawer does not resize or permanently obscure the page. It closes after navigation, when the close button is pressed, when the user presses Escape, or when the user clicks the scrim.

The active destination has a clearly visible selected state in both the rail and drawer. Drawer focus is trapped while open and returns to the trigger when closed.

### Tablet

Tablet has no permanent rail. A compact 64 px top bar, extended by the top safe-area inset, contains the brand and menu trigger. The trigger opens the same labelled drawer above the page. The interaction, focus behaviour, and route order match desktop.

### Mobile

Mobile has a fixed bottom navigation with Search, Deals, Library, Steam, and Friends. The GF mark in the top bar opens Dashboard and the profile avatar opens Profile. The bottom navigation remains visible while page content scrolls.

The bar is at least 64 px high, accounts for `env(safe-area-inset-bottom)`, and keeps icon labels visible. Page content includes enough bottom padding that the last control is never hidden under navigation. If the user is unauthenticated, protected destinations lead through the existing Login flow rather than appearing silently unavailable.

### Breakpoints

- Mobile: 320–767 px
- Tablet: 768–1023 px
- Desktop: 1024 px and above

Layout decisions are based on available width, not device detection. At every width, the document has no horizontal page scroll.

## Shared visual system

### Theme and hierarchy

The existing black, white, and grey palette remains. Hierarchy comes from spacing, surface contrast, type scale, borders, imagery, and restrained elevation. No new brand colour is introduced.

The page hierarchy is consistent:

1. App shell and route context
2. Page title, description, and one primary action
3. Toolbar or summary
4. Main content
5. Secondary metadata and destructive actions

### Buttons

Buttons use explicit variants rather than broad page-specific CSS overrides:

- `primary`: the single main action on a screen or focused panel
- `secondary`: ordinary supporting action
- `ghost`: low-emphasis navigation or inline action
- `danger`: destructive action such as disconnect or delete
- `icon`: square control with an accessible label and optional tooltip

All button-like links and native buttons share the same height, padding, radius, typography, focus ring, disabled state, and pressed feedback. Compact buttons are used only in dense rows. Icon and label alignment must not depend on individual SVG dimensions.

Primary actions are never used for both sides of a two-button choice. Destructive actions remain visually distinct and are not placed beside unrelated primary actions without spacing or grouping.

### Primitives

Shared frontend primitives include:

- `AppShell`, `IconRail`, `NavigationDrawer`, and `BottomNavigation`
- `PageHeader` and `Toolbar`
- `Button` and `IconButton`
- `Panel`, `Stat`, `Badge`, and `DataRow`
- `GameCard`, `GameRow`, and image fallback
- `Tabs` or segmented controls for sibling views
- `EmptyState`, `LoadingState`, `ErrorState`, and inline success feedback

Primitives define appearance and accessibility. Pages own data fetching and business actions.

## Screen designs

### Dashboard

Dashboard is a concise overview, not a second search page. Authenticated users see useful counts and compact sections derived from existing data: Library, Steam connection or playtime when loaded, available deals, and a Friends entry point. It also surfaces a small “continue exploring” list and direct links into the primary destinations.

The existing Trending and Upcoming discovery feeds move here as compact dashboard modules. Their current save behaviour is preserved. Until a dedicated per-game alert API exists, the Upcoming action is labelled Save or Add to watchlist rather than promising a notification.

Dashboard must not automatically trigger expensive AI generation or the bounded Steam social comparison. Social, library, or price data load independently, and failure in one summary must not block the rest of the page. If a heavy summary has not been requested yet, its card provides an honest entry point rather than displaying an invented count.

Unauthenticated Dashboard presents the product destinations, a compact discovery preview, and clear Login/Register actions.

### Search

Title search and AI search are sibling modes inside one Search screen. The search field and mode control form a single toolbar. Prompt suggestions are secondary helpers, not dominant pills scattered across the page.

Query and mode are represented in the URL so refresh and browser Back restore the active search. A late response from an older query must not overwrite a newer result set.

Search results use the shared game-card system. Details is a secondary link; Save is the primary card action when authentication permits it. AI recommendations use the same card anatomy and action order as ordinary results.

### Deals

Deals uses one page-level toolbar for sorting and filtering. Popular discounts and saved-game prices share the same visual language rather than appearing as unrelated panels. Cards prioritise cover, discount, current price, store, and action.

Saved-game price comparison remains available to authenticated users. Unauthenticated users receive a compact inline sign-in state without an oversized empty panel.

Public deals and personalised saved-game prices have independent loading and error states. One failed saved-game price lookup does not remove successful offers or turn the public section into an error.

### Game detail

Game detail uses a stable two-column desktop layout and a single-column mobile layout. Cover art anchors the page. Title, release information, genres, description, price, and actions follow a clear reading order.

Save, alert, store, and removal actions use the shared button hierarchy. Long descriptions remain expandable, with the toggle placed next to the text it controls.

The displayed price region remains explicit. It uses the connected Steam country when available and the current US fallback otherwise.

### Library

Library uses a compact searchable list rather than large nested cards. The toolbar contains query, source filter, and sort. Each row shows cover, title, source, notes/status, and contextual actions.

Editing and deletion do not turn the whole row into an ambiguous button. Row navigation and row actions have separate, accessible targets. Empty Library points to Search and supported import paths.

### Steam

Steam begins with a compact account summary and connection/sync actions. Connected users then use ordinary page tabs for Overview, Recommendations, and Library.

- Overview shows statistics and most-played games.
- Recommendations contains the optional prompt, generation action, and recommendation cards.
- Library shows the ranked game list and sync status.

The current large `details` disclosures are removed. Friends content moves to the separate Friends route.

Sync retains its current semantics. If a sync can remove previously imported Steam records from the saved Library, the interface explains that effect before the action and reports the resulting changes.

### Friends

Friends is a master-detail workspace. The left column contains searchable friend rows with avatar, public/private status, and taste match. The main column displays the selected friend, match summary, shared games, and the friend's top games.

One friend's content is visible at a time. The page does not render every friend's full shared-game lists simultaneously. Private libraries receive a compact explanatory state.

On mobile, the friend list becomes the first view; selecting a friend opens the detail view with a clear Back to friends control. This avoids squeezing both columns onto a narrow screen.

Friends continues to use the existing Steam social endpoint and refresh action. Opening layout controls does not trigger new API requests by itself.

The existing endpoint returns a bounded social payload rather than a pageable directory. Search and selection operate on the friends already returned by that endpoint; the first implementation does not imply pagination or server-side friend search. To preserve current request timing and load, the social payload remains user-triggered through Load friends or Refresh rather than being fetched automatically on every route entry.

### Profile

Profile behaves like settings, not a dashboard. A small profile summary is followed by a section navigation for Account, Connections, Notifications, and Imports.

Connections displays Google, Steam, PlayStation, and Telegram as consistent rows with service identity, status, and one relevant action. PlayStation import and Telegram test/disconnect flows keep their current behaviour but appear inside their corresponding settings section rather than separate disclosure cards.

Logout remains visible but low-emphasis. Destructive disconnect actions use the danger treatment.

### Authentication

Login and Register use the same fields, buttons, separators, validation messages, and social sign-in rows. The form remains narrow and centred but aligns visually with the application shell. OAuth callback states reuse shared loading and error components.

## Responsive content rules

- Toolbars wrap into stacked controls before labels or buttons truncate.
- Card grids reduce column count based on a meaningful minimum card width.
- Dense desktop tables become labelled rows or cards on mobile; essential information is not hidden only by CSS.
- Master-detail layouts become sequential navigation on mobile.
- Images preserve aspect ratio and have deterministic fallbacks.
- Text and actions never depend on hover for discovery.
- Touch targets are at least 44 by 44 CSS pixels on mobile and tablet.
- Fixed navigation, sticky toolbars, and drawers never cover focused elements or the final page controls.
- Grid and flex children use `min-width: 0` and `minmax(0, 1fr)` where content could otherwise push navigation outside its viewport.
- Full-height overlays use dynamic viewport units with a `100vh` fallback and local scrolling.
- Hover-only lift or reveal effects are limited to devices that actually support hover.
- Page-level `overflow-x: hidden` is not used to conceal layout defects; horizontal scrolling is local and intentional where required.

The minimum supported viewport is 320 px wide.

## State and data flow

Existing functions in `web/src/lib/api.ts` remain the source of backend data. Page-level components own loading, error, and mutation state. Shared visual primitives remain stateless except for local interaction state such as drawer visibility, selected tab, or controlled disclosure.

Independent data regions load independently. For example, Dashboard can render Library even if deals or Steam data fails. Refresh and mutation actions update only their owning region and show feedback adjacent to the affected control.

Authentication state remains driven by the current token subscription. The app shell reacts to authentication changes without requiring a full refresh.

Because authentication is stored in `localStorage`, protected API calls and redirects remain inside a small client authentication boundary. The redesign does not move them into Server Components or introduce a server-auth contract.

Saved records and catalogue games remain different identities. The redesign must not infer a durable catalogue ID from fuzzy title search or from parsing the free-form `info` field. Image enrichment is treated as best-effort and has a deterministic fallback.

## Error, loading, and empty states

Every asynchronous region has four explicit states: loading, error, empty, and content.

- Loading uses stable skeleton or compact status space so layouts do not jump.
- Errors explain what failed and provide Retry when the operation is recoverable.
- Empty states explain the next useful action.
- Success feedback is placed near the operation and does not replace unrelated page content.
- A `401` continues to clear or reject the session through the existing Login redirect flow.

Buttons keep their width while labels change to loading text. Busy controls are disabled without making the rest of the page unusable.

## Accessibility

- Navigation uses semantic landmarks and `aria-current="page"`.
- A skip link moves focus to the main content landmark.
- The drawer is a modal navigation dialog with an accessible name, close control, Escape handling, focus trap, and focus restoration. Background content is inert while it is open, and the closed drawer is removed from the tab order.
- Icon-only controls always have accessible labels.
- Tabs use the appropriate tab semantics and keyboard behaviour, or links when they change routes.
- Focus rings remain visible against every surface.
- Status is not conveyed by colour alone.
- Live feedback uses restrained `aria-live` regions.
- Motion respects `prefers-reduced-motion`.
- Text, controls, and borders maintain readable contrast in the monochrome palette.
- Current, focus, and disabled states remain understandable in forced-colours mode and never rely on colour alone.

## Implementation boundaries

The redesign should split the current large page-specific CSS into shared primitives plus focused page styles. Global CSS retains tokens, resets, typography, layout shell, and genuinely shared components. Feature and component styling moves to focused CSS Modules so late global overrides cannot change unrelated screens.

Large pages, especially Search, Steam, and Profile, should be decomposed into focused feature components with clear props. Business behaviour remains in page-level hooks or route components; presentational components do not call the API directly. Desktop rail, drawer, and bottom navigation consume one shared navigation model so authentication visibility, labels, and active state cannot drift.

Route `page.tsx` files remain Server Component wrappers where practical so they can provide unique metadata and one useful page title. Interactive feature screens sit behind narrow Client Component boundaries. `usePathname` and reactive authentication remain in the navigation client component. Any route using `useSearchParams` retains a production-safe `Suspense` boundary.

No backend migration is required. A new `/friends` frontend route and `/search` frontend route reuse existing API functions.

## Verification

The implementation is complete only when:

- `npm run lint` passes in `web`.
- `npx tsc --noEmit --incremental false` passes in `web`.
- `npm run build` passes in `web`.
- Existing backend tests remain green.
- Dashboard, Search, Deals, game detail, Library, saved-game detail, Steam, Friends, Profile, Login, and Register are visually checked.
- Authenticated and unauthenticated navigation are checked.
- Drawer and bottom navigation are checked with keyboard and touch-sized targets.
- Layout is checked at 1440×900, 1024×768, 768×1024, 390×844, and 320×568, including landscape and 200% zoom spot checks.
- No viewport has horizontal page scroll or content hidden behind fixed navigation.
- Reduced motion and keyboard-only navigation remain usable.

## Out of scope

- A new colour theme or user-selectable themes
- Backend API redesign
- New social features beyond the data already returned by Steam social APIs
- New recommendation algorithms
- New import formats
- New notification channels
