# playfinder.cc HTTPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the Game Finder API at canonical HTTPS address `playfinder.cc`, redirect `www.playfinder.cc`, and provision a renewable Let’s Encrypt certificate.

**Architecture:** The committed Nginx template declares every HTTP and HTTPS server block and proxies only canonical HTTPS traffic to `127.0.0.1:8000`. Certbot obtains the certificate in standalone mode before the template is installed, so repository configuration remains the durable source; Docker and application configuration stay unchanged.

**Tech Stack:** Nginx, Certbot 2.6, Python pytest, GitHub Actions, Amazon Linux 2023.

## Global Constraints

- `playfinder.cc` is canonical; `www.playfinder.cc` redirects to it.
- Both DNS records stay DNS-only during certificate issuance.
- Do not expose database or Redis ports, or change Docker service configuration.
- Run every repository change on `codex/playfinder-https`, merge only a reviewed PR into `main`.

---

### Task 1: Version-control canonical HTTP and HTTPS routing

**Files:**
- Modify: `infra/lightsail/nginx/game-finder.conf`
- Create: `tests/test_lightsail_nginx_config.py`
- Test: `tests/test_lightsail_nginx_config.py`

**Interfaces:**
- Consumes: hostnames `playfinder.cc`, `www.playfinder.cc`; upstream `http://127.0.0.1:8000`.
- Produces: an Nginx template whose canonical host is HTTPS-ready and whose `www` traffic redirects to canonical HTTPS.

- [ ] **Step 1: Write the failing template contract test**

Create `tests/test_lightsail_nginx_config.py`:

```python
from pathlib import Path


def test_lightsail_nginx_uses_playfinder_as_canonical_https_host() -> None:
    config = Path("infra/lightsail/nginx/game-finder.conf").read_text(encoding="utf-8")

    assert config == """server {
    listen 80;
    server_name playfinder.cc;
    return 301 https://playfinder.cc$request_uri;
}

server {
    listen 80;
    server_name www.playfinder.cc;
    return 301 https://playfinder.cc$request_uri;
}

server {
    listen 443 ssl;
    server_name www.playfinder.cc;
    ssl_certificate /etc/letsencrypt/live/playfinder.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/playfinder.cc/privkey.pem;
    return 301 https://playfinder.cc$request_uri;
}

server {
    listen 443 ssl;
    server_name playfinder.cc;
    ssl_certificate /etc/letsencrypt/live/playfinder.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/playfinder.cc/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
"""
```

- [ ] **Step 2: Verify the contract fails before implementation**

Run:

```powershell
rtk pytest -q tests/test_lightsail_nginx_config.py
```

Expected: FAIL because the template lacks the required TLS listeners and certificate paths.

- [ ] **Step 3: Implement the durable HTTP and HTTPS template**

Replace `infra/lightsail/nginx/game-finder.conf` with:

```nginx
server {
    listen 80;
    server_name playfinder.cc;
    return 301 https://playfinder.cc$request_uri;
}

server {
    listen 80;
    server_name www.playfinder.cc;
    return 301 https://playfinder.cc$request_uri;
}

server {
    listen 443 ssl;
    server_name www.playfinder.cc;
    ssl_certificate /etc/letsencrypt/live/playfinder.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/playfinder.cc/privkey.pem;
    return 301 https://playfinder.cc$request_uri;
}

server {
    listen 443 ssl;
    server_name playfinder.cc;
    ssl_certificate /etc/letsencrypt/live/playfinder.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/playfinder.cc/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Issue the certificate in Task 2 before installing this template on Lightsail.

- [ ] **Step 4: Verify the repository change**

Run:

```powershell
rtk pytest -q tests/test_lightsail_nginx_config.py
rtk pytest -q
rtk git diff --check
```

Expected: contract test passes, full suite has zero failures, and diff check is clean.

- [ ] **Step 5: Commit the source change**

Run:

```powershell
rtk git add infra/lightsail/nginx/game-finder.conf tests/test_lightsail_nginx_config.py
rtk git commit -m "infra: configure playfinder HTTPS hostnames"
```

Expected: one focused commit for template routing and its regression test.

### Task 2: Issue the certificate and apply the reviewed Nginx configuration

**Files:**
- Modify: `/etc/nginx/conf.d/game-finder.conf` on the Lightsail instance, copied from the reviewed `main` template after certificate issuance
- Create: `/etc/letsencrypt/live/playfinder.cc/` certificate material, managed by Certbot
- Test: Nginx syntax, Let’s Encrypt certificate inspection, HTTP redirect, HTTPS health endpoint

**Interfaces:**
- Consumes: published DNS-only A records for both names, port 80/443 access, `/etc/nginx/conf.d/game-finder.conf`.
- Produces: valid TLS for both hosts and canonical API traffic at `https://playfinder.cc`.

- [ ] **Step 1: Verify public DNS resolves to Lightsail**

Run:

```powershell
rtk proxy nslookup playfinder.cc 1.1.1.1
rtk proxy nslookup www.playfinder.cc 1.1.1.1
```

Expected: both names resolve to `3.68.130.113`.

- [ ] **Step 2: Install Certbot and its Nginx plugin**

Run on the server:

```bash
sudo dnf install -y certbot python3-certbot-nginx
```

Expected: Certbot 2.6 and the Nginx plugin are installed.

- [ ] **Step 3: Issue the certificate without letting Certbot modify Nginx**

Run on the server:

```bash
sudo bash -c 'systemctl stop nginx; trap "systemctl start nginx" EXIT; certbot certonly --standalone --non-interactive --agree-tos --register-unsafely-without-email -d playfinder.cc -d www.playfinder.cc'
```

Expected: Certbot validates both names and creates `/etc/letsencrypt/live/playfinder.cc/fullchain.pem` and `privkey.pem`; the final template remains unmodified by Certbot.

- [ ] **Step 4: Copy the reviewed template and activate HTTPS**

Run on the server:

```bash
sudo install -m 644 /home/ec2-user/game_finder/infra/lightsail/nginx/game-finder.conf /etc/nginx/conf.d/game-finder.conf
sudo nginx -t
sudo systemctl reload nginx
curl --fail http://127.0.0.1:8000/health
```

Expected: Nginx syntax succeeds, Nginx reloads, and the local app health endpoint remains healthy.

- [ ] **Step 5: Verify externally visible routing and TLS**

Run:

```powershell
curl --fail --location --silent --show-error http://www.playfinder.cc/health
curl --fail --silent --show-error https://playfinder.cc/health
```

Expected: both commands return the health JSON; the first follows a redirect to canonical HTTPS.

- [ ] **Step 6: Verify automatic certificate renewal**

Run on the server:

```bash
sudo certbot renew --dry-run
```

Expected: dry-run succeeds with no renewal errors.
