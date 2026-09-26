# Responsive social and profile UI design

## Goal

Improve four existing interface details: prevent the game invitation friend picker from overflowing its card on narrow screens, keep the profile notifications panel compact until expanded, make chat participants' names link to their profiles and show their avatars, and make the game page's “Back to search” action easier to notice.

## Design

Keep the work in the existing Vite/TanStack React UI and reuse current components and API fields. Constrain the game invitation form and its friend picker to the card width, with responsive sizing and wrapping for its actions. In the self profile, show at most five notifications initially and provide a clearly labeled control to reveal the rest; preserve existing read and navigation behavior. In the conversation list and active chat header, show the participant avatar when available (use the existing avatar fallback otherwise) and make the display name a link to that participant's public profile. Increase the visual prominence and hit area of “Back to search” on the game detail page without changing its destination or search state.

## Behavior and accessibility

- Narrow layouts must not cause the friend picker, invitation form, or controls to extend beyond their container.
- Notifications show no more than five entries while collapsed. The expand/collapse control has an accessible name and exposes the current expanded state.
- Chat profile links remain usable without triggering conversation selection or other enclosing controls. Avatar images have useful alternative text; fallback avatars remain available for missing images.
- The game page return action remains a link, has a larger readable target, and retains its current route/search parameters.

## Scope and validation

No backend or API contract changes are planned. Add focused Vitest coverage for the notification limit and expansion, chat profile links and avatar display, and responsive/action semantics where component tests can assert them. Run the focused frontend tests and the relevant frontend type/build checks after implementation.
