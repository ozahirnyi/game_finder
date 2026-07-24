from pathlib import Path


def test_readme_documents_lightsail_without_railway() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")

    assert "https://example.com/api" in readme
    assert "railway.app" not in readme
    assert "Railway" not in readme


def test_lightsail_docs_use_the_base64_deploy_key_secret() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")
    local_env_example = Path("web/.env.local.example").read_text(encoding="utf-8")

    assert "LIGHTSAIL_SSH_PRIVATE_KEY_B64" in readme
    assert "base64" in readme.lower()
    assert local_env_example == "VITE_API_URL=http://localhost:8000\n"


def test_frontend_source_has_no_legacy_api_environment_name() -> None:
    api_client = Path("web/src/lib/api.ts").read_text(encoding="utf-8")

    assert "VITE_API_BASE_URL" not in api_client
