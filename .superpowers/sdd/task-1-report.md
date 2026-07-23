# Task 1 Report: Lightsail SSH Key Base64 Decode

## Status

Completed.

## Files changed

- `.github/workflows/deploy-lightsail-ssh.yml`
  - Replaced the legacy SSH-key secret mapping with `LIGHTSAIL_SSH_PRIVATE_KEY_B64`.
  - Decodes the Base64 value directly into `~/.ssh/id_ed25519`.
- `docs/superpowers/plans/2026-07-23-lightsail-ssh-key-base64.md`
  - Included the pre-existing implementation plan in the implementation commit.

## Implementation commit

`de4c78826605ee8a9997c56683cbaf2020df9a42` — `ci: decode Lightsail SSH key from Base64`

## Verification

- `rtk git diff --check` — passed (no whitespace errors).
- `rtk git diff -- .github/workflows/deploy-lightsail-ssh.yml` — confirmed only the secret-variable name and Base64 decode command changed.
- `rtk pytest -q` — passed: 45 passed.

## Self-review

- The decoded key still uses the existing `~/.ssh/id_ed25519` path and `chmod 600`.
- Known-hosts setup and the `scp` / `ssh` deployment commands are unchanged.
- No private key or GitHub Secret value was displayed, read, or set.
- No target-host, deploy-script, or firewall changes were made.

## Concerns

None. GitHub-side secret configuration and workflow execution were intentionally not performed because they are outside this task's authorized scope.
