# Lightsail Nginx Certificate Design

## Context

The production deployment replaces `/etc/nginx/conf.d/game-finder.conf` and
then runs `nginx -t`. The tracked configuration still names `example.com` and
loads certificate files below `/etc/letsencrypt/live/example.com`. Production
has only the `playfinder.cc` Let's Encrypt certificate, so every deployment
fails at the Nginx validation step.

## Options considered

1. Keep the placeholder host and provision an `example.com` certificate. This
   is invalid because the application is served as `playfinder.cc`.
2. Remove TLS from this configuration. This would make the public site less
   secure and does not match the existing deployment model.
3. Replace the placeholder host and certificate paths with the provisioned
   production hostname. This is the smallest change and preserves the current
   HTTP-to-HTTPS redirects and reverse proxying. Chosen.

## Design

All four virtual-host declarations use `playfinder.cc`; the `www` aliases use
`www.playfinder.cc`. Both TLS blocks reference
`/etc/letsencrypt/live/playfinder.cc/{fullchain.pem,privkey.pem}`. Proxy
locations and headers remain unchanged.

## Error handling and verification

The deployment script already runs `nginx -t` before reloading Nginx, so an
invalid configuration cannot replace the active process. Validate the exact
configuration values through a focused automated source test, then merge and
confirm the GitHub deployment succeeds and production responds over HTTPS.

## Scope

This does not issue or renew certificates, change DNS, alter proxy routing, or
modify application code.
