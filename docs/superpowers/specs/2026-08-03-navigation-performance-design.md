# Navigation Performance Design

## Goal

Make the first authenticated screen useful quickly and transitions to Library and Friends feel immediate, while preserving fresh user data.

## Scope

- Optimize authenticated navigation to `/library` and `/friends`.
- Optimize the initial authenticated home render without changing its content.
- Do not change product features, API response shapes, or Steam synchronization.
- Keep a clear loading state only for a first visit or an actual request failure.

## Approach

Use React Query as a short-lived shared cache and prefetch the two high-value destinations after authentication. Add hover/focus prefetching in the desktop and mobile navigation so a likely destination is warmed before a click. Route modules should be preloaded where TanStack Router supports it; data must never block navigation when cached data exists.

## Data Flow

1. The first authenticated home render prioritizes profile and the visible dashboard. Sidebar deals and low-priority social data render after the initial content is ready.
2. Once authentication is known, `AppShell` prefetches `library-overview`, `friends`, incoming friend requests, and the first Steam-social page at idle priority.
2. Navigation entries for Library and Friends prefetch their route and respective query data on hover or keyboard focus.
3. Library and Friends render cached data immediately. React Query revalidates stale data in the background.
4. On a cold navigation, each route renders a skeleton; on an error, it renders the existing explicit error state.

## Cache Policy

- `profile`, `library-overview`, `friends`, incoming friend requests, and the first Steam-social page use a 90-second `staleTime`.
- Cached data may be shown while a background refetch is active.
- Mutations that change friends invalidate the relevant cached queries immediately.
- No persistent browser storage is introduced; a full reload begins with an empty in-memory cache.

## Success Criteria

- Clicking Library or Friends after initial authenticated load updates navigation feedback in under 100 ms.
- With warmed cache, page content is available in under 500 ms in normal conditions.
- A cold visit shows an intentional skeleton rather than a blank page or a misleading empty state.
- The first authenticated screen renders its shell and primary content without waiting for sidebar deals or route prefetches.
- Existing friend mutations still refresh Friends data correctly.

## Verification

- Unit tests cover prefetch requests, cache reuse, and mutation invalidation.
- Browser checks cover cold navigation, warmed navigation, keyboard focus prefetch, and a simulated slow response.
- Record development timing measurements for initial route navigation and a warmed repeat navigation.
