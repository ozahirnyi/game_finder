# Lightsail SSH Key Base64 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.

**Goal:** Make the Lightsail deployment workflow reconstruct its SSH key from a Base64 GitHub secret, avoiding secret text-format corruption.

**Architecture:** The GitHub Actions deploy job receives `LIGHTSAIL_SSH_PRIVATE_KEY_B64` only in the SSH setup step. It decodes the value to the runner-local key file, applies restrictive permissions, and retains the existing host-key and deployment commands.

**Tech Stack:** GitHub Actions YAML, Bash, GNU coreutils `base64`, GitHub CLI.

## Global Constraints

- Never print a private key or GitHub Secret.
- Do not change the target host, deploy script, or firewall configuration.
- Merge only a reviewed, passing PR into `main`.

---

### Task 1: Decode the deploy key from the Base64 secret

**Files:**
- Modify: `.github/workflows/deploy-lightsail-ssh.yml`
- Test: workflow YAML inspection and GitHub Actions run

**Interfaces:**
- Consumes: repository secret `LIGHTSAIL_SSH_PRIVATE_KEY_B64` containing the exact bytes of `game_finder_github_deploy` encoded as Base64.
- Produces: `~/.ssh/id_ed25519`, a mode-600 private key used by existing `scp` and `ssh` commands.

- [ ] **Step 1: Update the failing configuration path**

Replace the `LIGHTSAIL_SSH_PRIVATE_KEY` step environment entry with:

```yaml
LIGHTSAIL_SSH_PRIVATE_KEY_B64: ${{ secrets.LIGHTSAIL_SSH_PRIVATE_KEY_B64 }}
```

Replace direct `printf` writing with:

```bash
printf '%s' "$LIGHTSAIL_SSH_PRIVATE_KEY_B64" | base64 --decode > ~/.ssh/id_ed25519
```

- [ ] **Step 2: Verify the workflow diff**

Run:

```powershell
rtk git diff --check
rtk git diff -- .github/workflows/deploy-lightsail-ssh.yml
```

Expected: only the secret variable name and Base64 decode command differ; no secret value is in the diff.

- [ ] **Step 3: Install the Base64 GitHub secret without displaying it**

Run:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\Users\zagir\.ssh\game_finder_github_deploy')) | gh secret set LIGHTSAIL_SSH_PRIVATE_KEY_B64 --repo ozahirnyi/game_finder
```

Expected: GitHub CLI confirms secret update without echoing its content.

- [ ] **Step 4: Commit, open PR, and validate on GitHub Actions**

Run:

```powershell
rtk git add .github/workflows/deploy-lightsail-ssh.yml docs/superpowers/plans/2026-07-23-lightsail-ssh-key-base64.md
rtk git commit -m "ci: decode Lightsail SSH key from Base64"
rtk git push -u origin codex/lightsail-ssh-key-base64
```

Open a PR with base branch `main`, wait for the test check, merge it into `main`, then run `deploy-lightsail-ssh.yml` manually on `main`.

- [ ] **Step 5: Verify the resulting deployment**

Run:

```powershell
ssh -i C:\Users\zagir\.ssh\LightsailDefaultKey-eu-central-1.pem ec2-user@3.68.130.113 "docker compose -f /home/ec2-user/game_finder/docker-compose.lightsail.yml ps; curl --fail http://127.0.0.1:8000/health"
```

Expected: Compose services are running and `/health` returns successfully.
