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
}
"""
