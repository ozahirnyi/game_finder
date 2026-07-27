# Public Profiles and Library Visibility Design

## Goal

Make PlayFinder profiles useful social destinations: show the owner’s chosen public data, expose linked Steam profiles, and reliably render library covers, favorite games, active wishlist items, and manual library games.

## Scope

### Profile visibility

Each user has independent visibility settings for Library, Favorite games, Active wishlist, and Steam connection. Every setting accepts `private`, `friends`, or `public`; all settings default to `public` for existing and new users.

Public profile identity — nickname, avatar, and public ID — remains visible so users can find and identify a profile. A hidden section returns a deliberate unavailable state rather than empty data, preventing information leaks.

### Public profile pages

`/users/<publicId>` is the canonical profile route. It shows permitted sections: Library, Favorite games, Active wishlist, and Steam account details. Steam details include persona/avatar and an external `steamcommunity.com/profiles/<steam_id>` link when connected.

Friend cards and Steam-friend cards link to a PlayFinder public profile when the person has a PlayFinder account. A Steam friend without a PlayFinder account remains an external Steam destination or receives an explicit unavailable status; no fake profile is created.

### Library and covers

Library entries must include a usable cover URL: saved catalog cover first, Steam image URL for Steam entries, then a catalog-search cover where applicable, and finally the existing visual fallback. Manual games are returned by the same owner-scoped library query as other saved games and cannot be omitted by source filtering.

Favorite and wishlist cards expose stored catalog cover URLs and never rely on placeholder demo data.

## Architecture

The backend supplies one owner-safe public-profile projection. It evaluates each data section against the owner’s visibility setting and the viewer’s friendship relationship before serializing it. Collection blocks preserve explicit `ready`, `empty`, and `hidden` statuses so the frontend can distinguish no data from private data.

The frontend keeps `/profile` as the owner settings page and adds a read-only public route. Shared game-card and cover helpers consume normalized public collection records. Social lists use `public_id` to link only real PlayFinder accounts.

## Error Handling and Safety

- Direct requests for hidden sections return `hidden` without record counts, titles, or cover URLs.
- Anonymous and authenticated strangers are both treated as non-friends.
- A missing, disabled, or unlinked Steam account never exposes an invalid external link.
- Owner access always overrides visibility settings.
- Profile lookups use public IDs, not database UUIDs or emails.

## Acceptance Criteria

- Manual games, Steam games, and catalog games appear in the owner Library with covers or an intentional fallback.
- Owner Profile shows nickname, favorite games, and active wishlist from live data.
- Any visitor can open a public profile and see all sections whose setting is `public`.
- A `friends` section is visible only to confirmed friends and the owner; a `private` section only to the owner.
- Public profile cards link to Steam only when a Steam ID exists.
- Friend and eligible Steam-friend cards open the corresponding PlayFinder public profile.
- Backend tests cover every viewer relationship and visibility mode; frontend tests cover permitted, hidden, empty, and missing-account states.
