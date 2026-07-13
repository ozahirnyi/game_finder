from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_railway_deployment_contract_is_documented() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    web_dockerfile = (ROOT / "web" / "Dockerfile").read_text(encoding="utf-8")
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    env_example = (ROOT / ".env.example").read_text(encoding="utf-8")

    assert "ARG NEXT_PUBLIC_API_URL" in web_dockerfile
    assert "Pre-Deploy Command" in readme
    assert "alembic upgrade head" in readme
    assert "one replica" in readme
    assert "steam-social-refresh-worker:" in compose
    worker_compose = compose.split("  steam-social-refresh-worker:", 1)[1].split("  db:", 1)[0]
    assert "SECRET_KEY: ${SECRET_KEY}" in worker_compose
    assert "SECRET_KEY=change-me" in env_example
    assert "same SECRET_KEY as the Backend" in readme
