from pathlib import Path


def test_lightsail_nginx_uses_production_hostname_and_certificate():
    config = Path("infra/lightsail/nginx/game-finder.conf").read_text(encoding="utf-8")

    assert "example.com" not in config
    assert config.count("server_name playfinder.cc;") == 2
    assert config.count("server_name www.playfinder.cc;") == 2
    assert config.count("/etc/letsencrypt/live/playfinder.cc/fullchain.pem") == 2
    assert config.count("/etc/letsencrypt/live/playfinder.cc/privkey.pem") == 2
