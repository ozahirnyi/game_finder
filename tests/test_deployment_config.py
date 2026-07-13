from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_railway_deployment_contract_is_documented() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    web_dockerfile = (ROOT / "web" / "Dockerfile").read_text(encoding="utf-8")

    assert "ARG NEXT_PUBLIC_API_URL" in web_dockerfile
    assert "Pre-Deploy Command" in readme
    assert "alembic upgrade head" in readme
    assert "one replica" in readme
