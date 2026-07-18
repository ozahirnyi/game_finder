# Auth, mobile navigation, and friends list fixes

## Scope

Restore OAuth that was lost during the TanStack/Lovable frontend migration,
replace the mobile navigation truncation with an accessible drawer, and show
the complete Steam friends list through incremental loading.

## OAuth restoration

The active TanStack application will provide `/login`, `/register`, and
`/auth/callback` routes. The login route will use the existing API helpers to
show Google and Steam sign-in when configured. The callback route will
exchange the provider result, persist the existing client auth state, and
redirect to the intended authenticated screen. Profile's Google connection
action will call the existing link endpoint rather than remain decorative.

The existing backend OAuth contracts are retained. Error and unavailable
provider states are explicit and do not leave stale client authentication.

## Mobile navigation

At mobile widths the fixed bottom navigation is replaced by a compact top bar
with a menu control. It opens the same labelled navigation drawer pattern as
the site navigation, exposing every destination without consuming vertical
screen space. Selecting a destination, clicking the scrim, pressing Escape,
or using the close control closes the drawer. Focus handling, keyboard use,
and safe-area spacing remain accessible.

## Friends

The redesigned Friends route will read real Steam social data rather than the
six-item mock list. The Steam social API will support bounded pages and return
the total number of friends plus whether another page exists. The UI will show
the total in the count, render a compact first page, and append subsequent
pages through a `Показать ещё` control until the full list is loaded.

Loading, empty, unlinked-account, and error states are distinct. Existing
activity and shared-game presentation remains separate from the friend source
when that data is unavailable.

## Validation

Add regression tests for OAuth routes/callback behavior, every mobile
destination being available through the drawer, and friends pagination,
total-count accuracy, and append behavior. Run focused frontend/backend tests
and the relevant full checks after integration.
