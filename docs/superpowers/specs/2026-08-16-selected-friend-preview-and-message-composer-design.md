# Selected Friend Preview and Message Composer Design

## Goal

Make the existing **Selected friend** panel truthful and useful without turning it into a duplicate profile page. Make the direct-message composer grow with its content instead of allowing manual resizing.

## Scope

- Preserve and render the real friend `avatar` and `bio` returned by the active `/friends` contract.
- Render the selected friend’s real display name once and use an actual available handle/name value rather than duplicating the display name as a fabricated handle.
- Keep using `/friends/{id}/social-summary` for compatibility, shared-game count, and wishlist count.
- Show deterministic loading and unavailable values for the social summary. Do not invent values when the API cannot provide them.
- Keep the current **View profile**, invite, message, and conversation-history flows unchanged.
- In the existing message dialog, disable manual textarea resizing and auto-size the field to its content. Cap its visual height and allow internal scrolling beyond that cap. Reset the height after send or close.

## Non-goals

- No backend routes, schema changes, migrations, or privacy-policy changes.
- No full profile, library, activity, or shared-game-list duplication in the selected-friend panel.
- No separate chat page, notification redesign, or changes to conversation/invite semantics.
- Do not change unrelated profile settings textareas.

## Design

### Friend data flow

`friendsQueryOptions()` already returns a user object with `display_name`, optional `steam_persona_name`, `bio`, and `avatar`. `FriendsPage` must retain those values when deriving its local friend presentation object instead of replacing them with a fixed gradient and duplicate handle.

The panel continues to request `getFriendSocialSummary(selectedFriend.id)`. Its three existing server-calculated values are the source of truth:

- `compatibility_percent`
- `shared_games`
- `wishlist_count`

The avatar receives the returned image when present and keeps its existing generated-color fallback only when no avatar was supplied. The panel shows bio only when public data includes one. The display name is not repeated as a pretend `@handle`; if a distinct Steam persona name exists, it may be presented as the secondary identity, otherwise the secondary identity is omitted.

For the social summary, pending data shows `…`. A settled error shows `Unavailable`, including the wishlist metric, so a failed owner-scoped request is neither misrepresented as zero nor exposed as an implementation error.

### Composer sizing

The message textarea remains controlled by `messageBody`. Its input handler resets height to its minimum and then applies the element’s `scrollHeight`, clamped to a documented maximum. CSS disables browser resize controls and enables `overflow-y-auto` after that cap. Closing the dialog and successful sends clear `messageBody`; the field is recreated in its initial height when opened again.

This behavior applies only to the direct-message composer (`aria-label="Message text"`), not the profile-bio textarea.

## Testing

- Extend the Friends route tests with a friend carrying an avatar, bio, and different Steam persona name. Select that friend and assert the selected panel uses the image, real secondary identity, bio, and social-summary values.
- Add an unavailable-summary case that asserts `Unavailable` instead of zero or fabricated values.
- Extend ProfileView tests to verify the message textarea disables manual resize and auto-sizing is exercised by input with a content-dependent height stub; verify the composer is reset when reopened after a successful send/close.
- Run focused Vitest suites for Friends and ProfileView, then lint and build. Preserve `web/src/routeTree.gen.ts` and `web/.output` as generated, unstaged output.
