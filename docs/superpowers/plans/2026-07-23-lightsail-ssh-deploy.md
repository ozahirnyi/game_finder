# Lightsail SSH Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release the application to the existing Lightsail host from GitHub Actions over a dedicated SSH key.

**Architecture:** Docker Compose keeps the application private to Nginx on the host. GitHub Actions tests the revision and invokes one idempotent host-side deployment script using SSH; no AWS deployment service or credentials are used.

**Tech Stack:** GitHub Actions, OpenSSH, Docker Compose, FastAPI, Alembic, Nginx.

## Global Constraints

- Target host: `ec2-user@3.68.130.113`; release directory: `/home/ec2-user/game_finder`.
- Application listens only on `127.0.0.1:8000`; only ports 80 and 443 are public.
- Workflow triggers only after a successful push to `main`.
- Secrets are GitHub Secrets and must not be committed or printed.

---

### Task 1: Production Compose and Nginx configuration

**Files:**
- Create: `docker-compose.lightsail.yml`
- Create: `infra/lightsail/nginx/game-finder.conf`
- Modify: `.env.example`

**Interfaces:**
- Consumes: runtime variables `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SECRET_KEY`, and `REDIS_URL`.
- Produces: an `app` service reachable at `127.0.0.1:8000` and proxy target for Nginx.

- [ ] **Step 1: Add the production Compose definition**

```yaml
services:
  app:
    build: .
    env_file: .env
    ports: ["127.0.0.1:8000:8000"]
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_started }
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
  redis:
    image: redis:7-alpine
```

- [ ] **Step 2: Add the Nginx API virtual host**

```nginx
server {
    listen 80;
    server_name api.gamefinder.example.com;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- [ ] **Step 3: Document non-secret environment keys in `.env.example`**

```dotenv
DEBUG=False
DB_NAME=gamefinder
DB_USER=gamefinder
DB_PASSWORD=replace-in-github-secret
DB_HOST=db
DB_PORT=5432
```

- [ ] **Step 4: Validate the Compose schema**

Run: `docker compose --env-file <temporary-file> -f docker-compose.lightsail.yml config --quiet`

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.lightsail.yml infra/lightsail/nginx/game-finder.conf .env.example
git commit -m "feat: add Lightsail production runtime"
```

### Task 2: Idempotent host deployment script

**Files:**
- Create: `scripts/deploy/ssh_deploy.sh`

**Interfaces:**
- Consumes: repository revision on standard input via `git fetch`, host environment file `/home/ec2-user/.game-finder.env`.
- Produces: running Compose services and a passing local health endpoint.

- [ ] **Step 1: Write a host deployment script with strict shell settings**

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
release_dir=/home/ec2-user/game_finder
env_file=/home/ec2-user/.game-finder.env
test -f "$env_file"
cd "$release_dir"
git fetch --prune origin main
git checkout --detach origin/main
cp "$env_file" .env
docker compose -f docker-compose.lightsail.yml build
docker compose -f docker-compose.lightsail.yml run --rm app alembic upgrade head
docker compose -f docker-compose.lightsail.yml up -d --remove-orphans
curl --fail --retry 10 --retry-connrefused http://127.0.0.1:8000/health
```

- [ ] **Step 2: Run shell syntax validation**

Run: `bash -n scripts/deploy/ssh_deploy.sh`

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy/ssh_deploy.sh
git commit -m "feat: add SSH deployment script"
```

### Task 3: GitHub Actions delivery workflow and documentation

**Files:**
- Create: `.github/workflows/deploy-lightsail-ssh.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: GitHub Secrets `LIGHTSAIL_HOST`, `LIGHTSAIL_SSH_PRIVATE_KEY`, and `LIGHTSAIL_KNOWN_HOSTS`.
- Produces: an auditable deployment run for each `main` push.

- [ ] **Step 1: Write workflow test and deployment jobs**

```yaml
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements.txt
      - run: pytest -q
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          install -m 700 -d ~/.ssh
          printf '%s' "$LIGHTSAIL_SSH_PRIVATE_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          printf '%s' "$LIGHTSAIL_KNOWN_HOSTS" > ~/.ssh/known_hosts
          scp scripts/deploy/ssh_deploy.sh "ec2-user@$LIGHTSAIL_HOST:/tmp/game-finder-deploy"
          ssh "ec2-user@$LIGHTSAIL_HOST" 'bash /tmp/game-finder-deploy'
```

- [ ] **Step 2: Add README setup instructions**

Document creating a repository-scoped SSH key, installing its public half in `~ec2-user/.ssh/authorized_keys`, adding the three workflow secrets, and performing a manual `workflow_dispatch` test.

- [ ] **Step 3: Validate workflow syntax and full test suite**

Run: `pytest -q`

Expected: `36 passed` or the current complete passing suite.

- [ ] **Step 4: Commit, push, and open a draft pull request**

```bash
git add .github/workflows/deploy-lightsail-ssh.yml README.md
git commit -m "ci: deploy Lightsail over SSH"
git push -u origin codex/ssh-deploy
```

## Review Findings

- Spec coverage: Tasks 1–3 cover the runtime, secure delivery path, health validation, and future CodeDeploy compatibility.
- Placeholder scan: no implementation placeholders remain.
- Consistency: GitHub workflow invokes the host script and uses only the declared SSH secrets.
