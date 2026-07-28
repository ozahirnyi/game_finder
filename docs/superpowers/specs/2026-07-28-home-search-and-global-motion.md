# Home search handoff and global motion

## Problem

The guest homepage correctly navigates to `/search?q=<term>`, but the search
route does not consume `q`, so the input and results are empty. Authenticated
users have only a static search link on their dashboard. Entrance animation is
limited to a few home components instead of applying consistently to app pages.

## Design

`/search` will validate an optional `q` search parameter, synchronize its
catalog-search input from that parameter, and request catalog results as it
does for manually entered text. The guest search form remains the source of
the same navigation. The authenticated dashboard receives a matching compact
search form that navigates to `/search?q=<trimmed-term>`.

`AppShell` will wrap route content in one keyed, lightweight reveal container
based on the current pathname. This applies the existing reduced-motion-safe
animation to every primary page transition without animating controls, dialogs,
or list items unnecessarily. Existing component-level loading and hover states
remain unchanged.

The public deal API already returns UAH for `country=UA`; no currency
conversion or country remapping is part of this change. Regional catalog
differences remain intentional.

## Validation

Add route and dashboard tests for prefilled home searches, plus an AppShell
test that verifies the shared reveal wrapper. Retain existing guest search and
deal-region coverage. Run focused tests, the full web suite, lint, and build.
