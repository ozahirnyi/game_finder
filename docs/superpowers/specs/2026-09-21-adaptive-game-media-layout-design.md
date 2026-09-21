# Adaptive game media layout design

## Goal

Keep the game artwork that already looks good, while preventing portrait-only
or unavailable artwork from becoming a poor wide banner. Make shared-game
cards smaller without changing their data, permissions, or Invite action.

## Media rules

1. A game with a verified `hero_image` renders in the existing wide discovery
   card or game-detail hero.
2. A game with a cover but no `hero_image` renders as a compact 2:3 cover card.
   It is not placed inside a synthetic gradient or cropped to a wide rectangle.
3. A game with no usable image renders a neutral dark surface with a border,
   title and game icon. This fallback contains no color gradient.
4. If a primary or alternate image URL fails at runtime, the renderer advances
   through the same rules and finishes at the neutral title fallback.

## Layout

Discovery sections retain their responsive grids. Each item chooses its own
visual card internally, while title, metadata, price, keyboard focus, routing
and card spacing remain consistent. Hero-backed items use the existing wide
composition. Cover-only items use a compact portrait composition with the
same metadata panel below it, so a mixed result set still reads as a library.

The friend-profile Shared games section keeps the current portrait card
composition but uses smaller cover dimensions and a denser responsive grid.
The source label and Invite control remain visible.

## Boundaries

The backend keeps publishing separate `hero_image` and `cover_image` values.
The frontend `GameCover` remains the sole owner of image-error and fallback
behavior. `GameCard` selects the presentation from media availability; routes
only map API fields. No friendship, invitation or catalog identity behavior is
changed.

## Verification

Vitest tests will verify hero, cover-only and no-image card presentations;
runtime image errors will verify the neutral fallback. Profile tests will
verify the compact Shared games grid and its unchanged Invite action.
