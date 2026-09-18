# Origin/Main Task Baseline Design

## Goal

Ensure every implementation task starts from the latest GitHub `origin/main`, rather than inheriting the branch or commit selected when a Codex chat was opened.

## Scope

Update the repository-level Git workflow instructions in `AGENTS.md`. The rule applies before code exploration, planning, tests, or edits for an implementation task.

## Required flow

1. Fetch `origin` with `rtk git fetch origin`.
2. Confirm the worktree is clean before changing branches.
3. Create a unique `codex/<task-name>` branch whose start point is `origin/main` using `rtk git switch -c codex/<task-name> origin/main`.
4. Work only in that branch, then follow the existing commit, push, and pull-request rules.

## Failure handling

If the worktree is not clean, the requested branch already exists, or Git cannot create the branch, stop and report the exact condition. Do not stash, reset, checkout over, or otherwise overwrite user changes.

## Non-goals

- Do not SSH to Lightsail for every task.
- Do not deploy or alter Lightsail from the startup rule.
- Do not treat a deployment server as a mutable development checkout.

## Rationale

Lightsail is currently verified to run a detached checkout at `origin/main`. Fetching that same remote ref and branching from it gives each implementation task the current production baseline while preserving branch isolation.
