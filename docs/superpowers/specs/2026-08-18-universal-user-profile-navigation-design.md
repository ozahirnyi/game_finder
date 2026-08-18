# Universal User Profile Navigation Design

## Goal

Make a person a single navigable entity across PlayFinder. Selecting a real user's avatar or name from an existing Friends surface opens that person's canonical profile at `/users/<public_id>`.

## Canonical profile

- `/users/<public_id>` remains the sole profile route.
- The stable `public_id` is used only to identify the route. The UI continues to show the user's nickname or display name.
- Owners use the same route and receive the existing profile-settings path. Other viewers receive only server-authorized data and actions.
- Privacy rules remain enforced by `GET /users/{public_id}`; navigation itself does not disclose hidden collections or Steam data.

## Viewer-specific behavior

The route never changes by viewer: every source opens `/users/<public_id>`. The public-profile response determines the permitted result for the relationship between the viewer and owner:

- Anonymous visitors see only public sections and no authenticated actions.
- Authenticated strangers see public sections and the existing friend-request action only when the server marks it eligible.
- Friends additionally see sections whose visibility is `friends` and do not receive an invalid duplicate friend action.
- The owner sees the same canonical profile with an obvious path to edit profile and privacy settings, never a self-friend action.

## API contracts

- Existing social response shapes that represent a user will include `public_id` in addition to any internal `id` and display name.
- This covers Friends search, friend lists, incoming requests, conversations/messages, and game invites where a user identity is displayed.
- The frontend must not add an `id`-to-`public_id` lookup request or infer a profile URL from a nickname.

## Frontend behavior

- A small shared user-profile link component owns URL generation and wraps the visible avatar/name identity.
- Friends search, friend lists, incoming requests, conversations, and game invites use that component whenever their contract carries a real user's `public_id`.
- Static text without a represented user and unrelated product areas remain unchanged.
- Anonymous visitors can open public-profile links, but no authenticated actions appear unless the public-profile contract authorizes them.

## Testing

- Pytest contract coverage proves the relevant social payloads include the owner's stable `public_id` without exposing private fields.
- Vitest verifies each targeted Friends surface emits `/users/<public_id>` links and does not create lookup calls.
- Existing public-profile anonymous/authenticated action and privacy tests remain green.

## Out of scope

- Custom nickname/slug URLs, profile URL editing, and redirects from renamed nicknames.
- Changes to catalog, Deals, Alerts, Home, Groups, Discord, Party Finder, or mock data.
