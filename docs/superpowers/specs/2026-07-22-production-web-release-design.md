# Production Web Release Design

## Goal

Make the currently working Railway `web` deployment the durable release source, then enable automatic Railway deployments only from GitHub branch `main`.

## Scope

- Preserve the exact source and dependency lockfile used by the running `web` service before changing its deployment source.
- Store that snapshot in Git history and promote it to `main`.
- Configure only Railway service `web` to use repository `ozahirnyi/game_finder`, branch `main`.
- Verify that the service is connected and that a deploy triggered from `main` remains healthy.

## Non-goals

- Do not change application features, API behaviour, environment variables, domains, database, worker, or API services.
- Do not deploy from a task worktree after the GitHub source is connected.
- Do not assume that an existing task branch is identical to the live application.

## Architecture

The running Railway container is the authoritative snapshot because the service was previously deployed by CLI from a local worktree and has no Git source. Its `/app` project files will be copied into a clean, isolated Git worktree on a release branch. After build and test verification, that commit will be integrated into `main` and pushed to `origin`.

Railway `web` will then be connected to `ozahirnyi/game_finder` at `main`. Railway becomes responsible for deployments on future pushes to `main`; manual `railway up` is not used for `web`. The current Railway image remains in service until the Git-backed release passes its health check.

## Data Flow

1. Railway running `web` container `/app` -> a local snapshot directory.
2. Snapshot -> isolated release worktree -> commit -> `origin/main`.
3. `origin/main` push -> Railway GitHub trigger -> new `web` deployment.
4. Railway status and URL -> confirmation that the Git-backed deployment is online.

## Error Handling and Rollback

- If the live container cannot be read, stop before changing Railway source. Do not substitute a task branch without explicit approval.
- If build or test verification fails, stop before the merge and preserve the captured snapshot for diagnosis.
- If the Git-triggered deployment fails, keep the previous known-good Railway deployment and use Railway rollback/redeploy only after inspecting its logs.
- The snapshot commit, branch name, deployment ID, and image digest are recorded in the release handoff so the state can be audited.

## Acceptance Criteria

- The committed release source is verified as originating from the current Railway `web` deployment.
- `main` contains the release source and its lockfile.
- `railway service list --json` reports `web.source.repo = ozahirnyi/game_finder` with branch `main`.
- Railway performs a successful `web` deployment from the connected source.
- No manual task/worktree deployment is used in this change.
