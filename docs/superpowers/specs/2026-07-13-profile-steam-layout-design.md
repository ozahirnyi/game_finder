# Profile and Steam layout design

## Goal

Make account integrations and game libraries easy to scan in Profile, and reduce the initial vertical size of the Steam screen without changing its data or API behaviour.

## Profile

- Keep the profile summary for quick status, but group the detailed content into visibly labelled panels: Account, Your library, PlayStation, Steam, and Telegram.
- The Steam panel is a whole-card link to `/steam`. It shows only connection status and the linked persona (when available); it has no separate navigation button.
- Account remains the place for sign-in identity and Google connection. Library remains a preview with its existing Manage link. PlayStation retains the existing import flow. Telegram retains its connection, test, and disconnect controls.
- Keyboard focus and screen-reader labels make the clickable Steam card discoverable and accessible.

## Steam

- Preserve the account/control panel and all existing calls and states.
- Render AI recommendations and Steam friends as wide `details` disclosure panels. Their closed summaries expose the key status/count; opening reveals their existing controls and content. No fetch occurs only because a panel is opened.
- Render Most played games as a compact ranked sidebar list with icon, title, and playtime. The existing Show more/less behaviour remains available. At narrow widths it moves below the wide panels.
- The desktop layout uses a broad primary column for AI and friends and a narrower secondary column for Most played games. It collapses to one column on mobile.

## Behaviour and quality

- No API, authentication, import, connection, sync, recommendation, or social-data behaviour changes.
- Existing visual tokens and responsive conventions in `globals.css` are reused.
- Validate with lint and production build after implementation.
