from pathlib import Path


def test_active_backend_and_readme_use_playfinder_brand() -> None:
    source = "\n".join(
        Path(path).read_text(encoding="utf-8")
        for path in ("app/main.py", "app/telegram.py", "README.md")
    )

    assert "PlayFinder" in source
    assert "GameFinder" not in source
    assert "Game Finder" not in source
