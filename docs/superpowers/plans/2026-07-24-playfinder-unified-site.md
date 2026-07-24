# Playfinder unified Lightsail site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the production frontend at `https://example.com` and the existing FastAPI API at the same origin under `/api/`, with no active Railway dependency.

**Architecture:** Docker Compose runs the existing FastAPI, Postgres, Redis, and a new production Vite/TanStack web service on loopback ports. Host Nginx sends `/api/` to FastAPI after stripping the prefix and all other routes to the web server. Browser API calls use a relative `/api` base, so no second public host is needed.

**Tech Stack:** Docker Compose, Node 22, Vite/TanStack Start, FastAPI, Nginx, Let's Encrypt, pytest, Vitest.

## Global Constraints

- Work only on `codex/playfinder-unified-site`; open a PR only into `main`.
- `https://example.com` is the sole public application origin; `www` redirects to it.
- The public API prefix is exactly `/api/`; Nginx must remove that prefix before proxying to FastAPI.
- Remove Railway only from active source, environment examples, and user-facing operational documentation; retain dated historical design records.
- Do not commit secrets or the server `.game-finder.env` file.

---

### Task 1: Make the frontend use a same-origin API base

**Files:**
- Modify: `web/src/lib/api.ts:298-302`
- Modify: `web/vite.config.ts:8-14`
- Modify: `web/.env.production.example:1`
- Test: `web/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `import.meta.env.VITE_API_URL` when explicitly supplied for local development.
- Produces: `API_URL` equal to `/api` by default in a production browser build.

- [ ] **Step 1: Write a failing frontend test**

Extract the API base selection into an exported `getApiUrl(value?: string): string` and add:

```ts
it("uses the same-origin API prefix when no environment URL is supplied", () => {
  expect(getApiUrl()).toBe("/api");
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- --run web/src/lib/api.test.ts`

Expected: FAIL because `getApiUrl` is not exported or the fallback remains the Railway URL.

- [ ] **Step 3: Implement the minimal production base**

Use:

```ts
export const getApiUrl = (value = import.meta.env.VITE_API_URL): string =>
  value?.replace(/\/$/, "") || "/api";

const API_URL = getApiUrl();
```

Remove the Railway `allowedHosts` override from `web/vite.config.ts`; it is only a former hosted domain. Set `VITE_API_URL=/api` in `web/.env.production.example`.

- [ ] **Step 4: Verify frontend tests and the production build**

Run: `npm test -- --run web/src/lib/api.test.ts && npm run build`

Expected: focused test passes and Vite exits 0.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api.ts web/src/lib/api.test.ts web/vite.config.ts web/.env.production.example
git commit -m "feat: route frontend API through same origin"
```

### Task 2: Add a production web service and domain-only backend settings

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example:25-31`
- Modify: `app/main.py:86-96`
- Modify: `tests/test_config.py:33-44`

**Interfaces:**
- Consumes: `FRONTEND_PUBLIC_URL`, `BACKEND_PUBLIC_URL`, and the `web` Docker build context.
- Produces: web server at `127.0.0.1:3000`, API server at `127.0.0.1:8000`, and no `RAILWAY_PUBLIC_DOMAIN` fallback.

- [ ] **Step 1: Write failing backend configuration tests**

Replace the Railway test with:

```python
def test_get_backend_public_url_uses_request_url_without_public_override(monkeypatch):
    class Request:
        base_url = "http://internal.example/"

    monkeypatch.delenv("BACKEND_PUBLIC_URL", raising=False)
    monkeypatch.delenv("RAILWAY_PUBLIC_DOMAIN", raising=False)

    assert get_backend_public_url(Request()) == "http://internal.example"
```

Add a Compose-text test asserting `web` is built from `./web` and both app and web port bindings begin with `127.0.0.1:`.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pytest -q tests/test_config.py tests/test_lightsail_compose.py`

Expected: FAIL because the Railway fallback and public port bindings remain.

- [ ] **Step 3: Implement Compose and public URL settings**

Add a `web` service with `build: ./web`, `restart: unless-stopped`, and `127.0.0.1:3000:3000`. Change app binding to `127.0.0.1:8000:8000`. Pass `FRONTEND_PUBLIC_URL` and `BACKEND_PUBLIC_URL` through to `app`.

Set production values in `.env.example` to:

```dotenv
FRONTEND_ORIGIN=https://example.com
FRONTEND_ORIGINS=https://example.com
FRONTEND_PUBLIC_URL=https://example.com
BACKEND_PUBLIC_URL=https://example.com/api
GOOGLE_REDIRECT_URI=https://example.com/api/auth/google/callback
```

Delete the `RAILWAY_PUBLIC_DOMAIN` branch from `get_backend_public_url`; use `BACKEND_PUBLIC_URL` when supplied, otherwise `request.base_url`.

- [ ] **Step 4: Verify focused tests and Compose syntax**

Run: `pytest -q tests/test_config.py tests/test_lightsail_compose.py && docker compose config --quiet`

Expected: all tests pass and Compose exits 0 without needing secret values.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example app/main.py tests/test_config.py tests/test_lightsail_compose.py
git commit -m "feat: run web with Lightsail deployment"
```

### Task 3: Route the unified domain through Nginx

**Files:**
- Modify: `infra/lightsail/nginx/game-finder.conf`
- Modify: `tests/test_lightsail_nginx_config.py`

**Interfaces:**
- Consumes: loopback web server `127.0.0.1:3000` and FastAPI `127.0.0.1:8000`.
- Produces: `/api/health` → FastAPI `/health`; `/` → frontend; HTTP and `www` retain canonical HTTPS redirects.

- [ ] **Step 1: Change the Nginx exact-content test before configuration**

Update the expected canonical host block to contain:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

- [ ] **Step 2: Run the Nginx test and confirm it fails**

Run: `pytest -q tests/test_lightsail_nginx_config.py`

Expected: FAIL because the current root route still proxies to port 8000.

- [ ] **Step 3: Update the tracked Nginx template**

Apply the tested `/api/` block before the root block. Preserve the certificate paths, canonical redirects, and required proxy headers exactly.

- [ ] **Step 4: Verify the template test**

Run: `pytest -q tests/test_lightsail_nginx_config.py`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add infra/lightsail/nginx/game-finder.conf tests/test_lightsail_nginx_config.py
git commit -m "feat: proxy unified site and API paths"
```

### Task 4: Remove active Railway instructions and release to Lightsail

**Files:**
- Modify: `README.md:140-205,266-271`
- Modify: `web/.env.local` only if it is tracked; otherwise do not stage it.

**Interfaces:**
- Consumes: deployment commands and variables established in Tasks 1-3.
- Produces: README instructions for a Lightsail-only `example.com` deployment and a source tree with no active Railway URL.

- [ ] **Step 1: Add a documentation assertion test**

Create `tests/test_deployment_docs.py` that reads `README.md` and asserts it contains `https://example.com/api` and does not contain `railway.app` or `Railway`.

- [ ] **Step 2: Run the test and confirm failure**

Run: `pytest -q tests/test_deployment_docs.py`

Expected: FAIL because README still documents Railway.

- [ ] **Step 3: Rewrite active deployment guidance**

Document the Lightsail Compose deployment, Nginx installation path, production values from Task 2, `/api/health` verification, and Google redirect URI. Remove Railway URLs and deployment instructions from README and tracked web environment samples. Do not change dated documents under `docs/superpowers/`.

- [ ] **Step 4: Run all verification**

Run: `pytest -q && npm test -- --run && npm run build && git diff --check`

Expected: backend tests and frontend tests/build pass; no whitespace errors.

- [ ] **Step 5: Commit and request code review**

```bash
git add README.md tests/test_deployment_docs.py web/.env.production.example
git commit -m "docs: document Lightsail-only deployment"
```

### Task 5: Deploy verified main to Lightsail

**Files:**
- Modify on server only: `/home/ec2-user/.game-finder.env`, `/etc/nginx/conf.d/game-finder.conf`

**Interfaces:**
- Consumes: merged `main`, Docker Compose services, Nginx template, Let's Encrypt certificate.
- Produces: public home page and API health under `example.com`.

- [ ] **Step 1: Update the server from `origin/main`**

Fetch `origin/main` over SSH, switch the server checkout to that exact commit, and set only the domain configuration values from Task 2. Preserve secret values already held in `.game-finder.env`.

- [ ] **Step 2: Rebuild application services**

Run `sudo docker compose --env-file /home/ec2-user/.game-finder.env up -d --build app web` from the server checkout. Confirm both services are healthy/running.

- [ ] **Step 3: Install and test the Nginx template**

Install `infra/lightsail/nginx/game-finder.conf` to `/etc/nginx/conf.d/game-finder.conf`, run `sudo nginx -t`, then reload Nginx.

- [ ] **Step 4: Verify public behavior**

Run:

```bash
curl --fail --silent --show-error https://example.com/
curl --fail --silent --show-error https://example.com/api/health
curl --fail --location --silent --show-error https://www.example.com/api/health
```

Expected: the first response is frontend HTML; both health requests return `{"status":"ok"}`.

- [ ] **Step 5: Update external OAuth provider settings**

In Google Cloud Console, replace the authorized redirect URI with `https://example.com/api/auth/google/callback`. Verify the API produces that URI before asking the user to complete a real provider sign-in.
