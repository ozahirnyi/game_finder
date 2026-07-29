# Lightsail Nginx Certificate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deployed Nginx configuration use the existing production TLS certificate so main-branch deployments complete.

**Architecture:** Keep the four existing virtual hosts and reverse-proxy locations intact. Replace only the placeholder hostnames and certificate directory with the verified production hostname `playfinder.cc`, and add a source-level regression test for the configuration contract.

**Tech Stack:** Nginx configuration, Python pytest, GitHub Actions deployment.

## Global Constraints

- Use `playfinder.cc` and `www.playfinder.cc` for public hosts.
- Use `/etc/letsencrypt/live/playfinder.cc/` for both TLS certificate files.
- Do not change proxy destinations, forwarding headers, certificate provisioning, DNS, or application code.

---

### Task 1: Correct and guard the production Nginx configuration

**Files:**
- Modify: `infra/lightsail/nginx/game-finder.conf`
- Create: `tests/test_lightsail_nginx_config.py`

**Interfaces:**
- Consumes: the deployment script's copy of `infra/lightsail/nginx/game-finder.conf` to `/etc/nginx/conf.d/game-finder.conf`.
- Produces: a configuration whose server names and certificate paths reference the provisioned `playfinder.cc` certificate.

- [ ] Write a test that reads the configuration and asserts it has no `example.com` entry, exactly two `server_name playfinder.cc;` entries, exactly two `server_name www.playfinder.cc;` entries, and two occurrences of each `playfinder.cc` certificate path.
- [ ] Run `pytest tests/test_lightsail_nginx_config.py -q`; it must fail because the current file contains `example.com`.
- [ ] Replace `example.com` only in server names, redirects, and certificate paths; preserve every proxy block and header exactly.
- [ ] Run `pytest tests/test_lightsail_nginx_config.py -q`; it must pass.
- [ ] Commit `infra/lightsail/nginx/game-finder.conf` and `tests/test_lightsail_nginx_config.py` with `fix: use production TLS certificate in Nginx`.

### Task 2: Deliver and validate the automatic deployment

**Files:**
- No repository file changes.

**Interfaces:**
- Consumes: the merged configuration and the main-branch deployment workflow.
- Produces: a successful Nginx validation/reload and an HTTPS production health response.

- [ ] Push `codex/fix-lightsail-nginx-certificate` and open a pull request.
- [ ] Merge the reviewed pull request, starting the default-branch deployment workflow.
- [ ] Inspect the deployment workflow; it must complete successfully without a certificate-load error.
- [ ] Request `https://playfinder.cc/api/health`; it must return HTTP 200.
