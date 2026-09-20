# Banner media and shared games design

## Problem

Catalog normalization currently stores the IGDB portrait cover in
`background_image`. Wide UI surfaces (the home page, search, deal cards and
recommendations) use that value in 16:9 containers when a real hero artwork is
unavailable. `object-cover` then crops a portrait as a landscape banner.

`GameCover` replaces a failed image with a gradient, but most consumers do not
provide an alternative URL. A failed provider image therefore has no visual
asset to show. The friend profile's shared-games endpoint already returns a
`cover_url`, while its UI renders text-only tiles and ignores that media.

## Chosen approach

Keep wide cards for discovery surfaces, but only use a verified wide hero
artwork in them. When no suitable artwork exists, render a composed fallback:
a readable, contained portrait cover over the existing themed background rather
than stretching or cropping it into 16:9.

Use portrait 2:3 cards for personal collections and shared games, where users
scan a set of titles rather than browse editorial banners. Shared games will
use the endpoint's `cover_url`, retain the source label and expose the existing
Invite action.

## Data and component boundaries

* The IGDB integration will retain portrait cover media separately from wide
  hero media; a portrait cover must never be presented as a hero fallback.
* The central `GameCover` component will own media loading, aspect-aware
  rendering and fallback state. Consumers will declare whether they require a
  hero or a portrait/card presentation rather than duplicating crop rules.
* The card presentation API will carry an optional alternate provider image for
  known Steam games. On image failure, it will try that alternative before the
  branded title fallback.
* Shared games will reuse `GameCover` rather than introduce an independent
  image-loading implementation.

## User-visible behavior

1. A verified hero image fills a wide discovery card.
2. A title with only portrait cover art remains fully legible in the same wide
   card via the composed portrait treatment; it is not enlarged and cropped.
3. A failed primary image tries a provided alternate URL. If that also fails or
   no URL exists, the card remains intentional and identifiable through its
   gradient and title fallback.
4. Shared games on a friend's profile are image-based portrait cards with title,
   source and Invite control. Existing visibility, friendship and invitation
   behavior remains unchanged.

## Error handling and accessibility

All provider images keep meaningful game-title alt text. Broken images do not
leave an invisible area, and the non-image fallback remains accessible.
Alternate-image failures follow the same final fallback. Invite buttons keep
their explicit accessible labels.

## Verification

Frontend tests will cover hero versus portrait rendering, retrying an alternate
image URL and the final fallback. Friend-profile tests will cover rendering a
shared-game cover and dispatching its invitation. Backend API tests will verify
the shared-games contract continues to expose the selected cover URL.
