from pathlib import Path


def test_lightsail_compose_runs_web_and_app_only_on_loopback() -> None:
    config = Path("docker-compose.yml").read_text(encoding="utf-8")

    assert "  web:\n    build: ./web" in config
    assert '      - "127.0.0.1:3000:3000"' in config
    assert '      - "127.0.0.1:8000:8000"' in config


def test_production_lightsail_compose_runs_web_on_loopback() -> None:
    config = Path("docker-compose.lightsail.yml").read_text(encoding="utf-8")

    assert "  web:\n    build: ./web" in config
    assert '      - "127.0.0.1:3000:3000"' in config
