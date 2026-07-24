from pathlib import Path


def test_readme_documents_lightsail_without_railway() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")

    assert "https://example.com/api" in readme
    assert "railway.app" not in readme
    assert "Railway" not in readme
