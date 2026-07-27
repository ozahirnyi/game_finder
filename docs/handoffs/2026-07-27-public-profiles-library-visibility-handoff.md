# Public Profiles, Covers, and Visibility — Handoff

## Start here

Read `AGENTS.md`, then `docs/superpowers/specs/2026-07-27-public-profiles-library-visibility-design.md` and execute `docs/superpowers/plans/2026-07-27-public-profiles-library-visibility.md` task by task using TDD. This is planning-only documentation; do not assume product code for this scope exists.

## Approved decisions

- Profile sections Library, Favorite games, Active wishlist, and Steam each support `private`, `friends`, and `public` visibility.
- Default for both new and existing users is `public`.
- Public identity (nickname, avatar, public ID) is always visible; each collection is independently filtered.
- Owners override settings; `friends` means a confirmed PlayFinder friendship; all other viewers are strangers.
- Hidden data must not leak counts, titles, covers, Steam IDs, or other metadata.
- Public profiles are available at `/users/<publicId>`.
- Friend cards link to PlayFinder profiles. Steam friends link to PlayFinder only when their Steam ID maps to a PlayFinder account; otherwise retain an external Steam route/status.
- Steam profile links use `https://steamcommunity.com/profiles/<steam_id>` only when the ID exists.
- Library covers prefer stored cover URL, then a valid Steam CDN image, then the existing fallback. Manual games are first-class library records.

## Relevant code map

- `app/database.py`: `User`, `Game`, `Favorite`, `WishlistItem`, and friendship persistence.
- `app/main.py`: profile summary blocks, social profile endpoint, Steam social aggregation, and relationship checks.
- `app/schemas.py`: Pydantic social/profile/read models.
- `app/crud.py`: owner-scoped game listing helpers.
- `web/src/routes/profile.tsx`: owner profile UI and settings.
- `web/src/routes/users.$publicId.tsx`: public profile route wrapper.
- `web/src/features/friends/PublicProfileScreen.tsx`: public profile/friend action UI.
- `web/src/features/friends/FriendsScreen.tsx`: PlayFinder friend and Steam friend cards.
- `web/src/lib/api.ts`: client types and API functions.
- `web/src/components/GameCover.tsx`: cover/fallback rendering.

## Mandatory workflow and GitHub rules

- Begin from a new `codex/<task>` branch in an isolated worktree based on current `origin/main`; do not work on main or a phase branch.
- Use `rtk` for all terminal commands and `apply_patch` for edits. Constrain searches and preserve unrelated changes.
- For every behavior change: write a focused failing test, run it, implement minimally, rerun focused tests, then make a thematic commit.
- Before each commit/PR, inspect `rtk git status --short`, scoped `rtk git diff`, and `rtk git diff --check`.
- Run `rtk proxy python -m pytest -q`, `rtk npm --prefix web test -- --run`, and `rtk npm --prefix web run build` before pushing.
- Push a draft PR to `main` whose description lists the changes and exact verification commands. Never merge/deploy until the user explicitly approves.
- After merge approval, wait for the `Deploy to Lightsail over SSH` workflow for the merged SHA and verify `https://playfinder.cc/api/health` returns `{"status":"ok"}`.
