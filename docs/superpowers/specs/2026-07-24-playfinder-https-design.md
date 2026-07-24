# playfinder.cc HTTPS Design

## Goal

Expose the deployed Game Finder API at `https://playfinder.cc`, redirect `https://www.playfinder.cc` to the canonical hostname, and terminate TLS on the Lightsail Nginx instance.

## Architecture

Cloudflare publishes DNS-only A records for both hostnames to the Lightsail static IPv4 address. Nginx redirects all HTTP requests for either hostname to the canonical HTTPS hostname, proxies canonical HTTPS requests to the existing application at `127.0.0.1:8000`, and serves the Let’s Encrypt certificate. Certbot obtains and renews the certificate with the HTTP-01 challenge.

## Decisions

- `playfinder.cc` is the sole canonical API hostname.
- `www.playfinder.cc` receives a permanent redirect to `https://playfinder.cc` while its certificate name remains covered.
- DNS stays unproxied during issuance; no Cloudflare-origin TLS mode changes are required.
- The Nginx template in `infra/lightsail/nginx/game-finder.conf` is the durable source of the server configuration.

## Error Handling and Verification

- Run `nginx -t` before Nginx reload.
- Verify the certificate covers both hostnames.
- Verify HTTP redirects and that `https://playfinder.cc/health` returns HTTP 200.
- Keep Docker services and database ports unchanged.
