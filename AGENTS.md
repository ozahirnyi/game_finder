# Project instructions

@C:\Users\zagir\.codex\RTK.md

## Token-efficient terminal work

Apply these rules in every chat working in this project:

- Prefix every shell command with `rtk`. Use an RTK-specific subcommand when one exists.
- Constrain searches before running them: provide a path and file glob/type, and cap output with `--max-count` or a similarly narrow query. Do not run broad recursive `rg` searches across the whole repository unless necessary. Always use `rtk rg` for ripgrep searches; `rtk proxy rg` is prohibited.
- Read only the relevant portion of a file. Prefer `rtk read` and bounded line ranges; never print a large file in full merely to inspect it.
- Use `rtk diff` and target individual files or commits. Request the smallest useful diff context.
- Use specialized RTK wrappers for tests, linters, builds, logs, JSON, and dependency output. Return failures and concise summaries rather than full successful output.
- PowerShell cmdlets are not executable programs. When they are needed, run them as `rtk proxy powershell -NoProfile -Command "..."`; prefer a native RTK command when available.
- Avoid raw or fallback command execution. `rtk proxy` is an exception only for PowerShell cmdlets or a command without an RTK-specific wrapper; explicitly limit its output first. Never use it for commands that RTK supports natively.
- Do not repeat command output already present in the conversation. Do not emit unfiltered large JSON, logs, generated assets, lockfiles, or build artifacts.
- When diagnostics need more detail, expand output incrementally: start with a compact summary, then inspect only the relevant files, lines, or errors.

## Git workflow

Apply this workflow in every chat working in this project, including the current chat:

- Create a separate `codex/<task-name>` branch before starting each implementation task; do not work directly on a shared phase branch.
- Keep each task's commits limited to that task and preserve unrelated working-tree changes.
- After a task is verified, push its branch and create a pull request for review before considering the task complete.
