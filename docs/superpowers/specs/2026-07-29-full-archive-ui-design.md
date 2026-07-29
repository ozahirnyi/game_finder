# Full archive UI port

## Goal

Make the deployed frontend visually match `C:\Users\zagir\Downloads\lovable-project-cf1fe460.zip` across every route, while preserving each control and visual element from that archive.

## Design source of truth

The supplied archive is the canonical UI version. Its routes, components, styles, layout, empty states, labels, panels, and buttons are copied into `web/src` without selectively removing elements.

## Integration rules

- Keep every visible UI control from the archive, including controls whose backend behaviour is not yet available.
- Replace mock data with the existing FastAPI client wherever an endpoint exists.
- Replace artificial loading delays with real query/mutation states.
- Preserve the archive’s interaction and layout when wiring real data.
- If a design control has no backend endpoint, retain it as a non-destructive visual control and record it for a later integration pass; do not delete or redesign it.
- Keep the existing `/api` proxy and production server configuration.

## Data mapping

- Homepage: catalogue search, trending games, deals, and authenticated friends data when available.
- Authentication: Google and Steam OAuth URLs and exchange callback.
- Connected services: Google linking, Steam linking/sync/unlink, PSN import.
- Collection routes: catalogue game details, price history, library, wishlist, friends, notifications.

## Verification

The new route tree must build, no route may import `mockData`, active API controls must issue real client calls, and the application must pass tests, linting, production build, and browser visual checks of the homepage and authenticated account UI.
