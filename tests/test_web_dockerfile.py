from pathlib import Path


def test_web_image_uses_the_committed_dependency_lockfile():
    dockerfile = Path("web/Dockerfile").read_text(encoding="utf-8")

    assert "COPY package.json package-lock.json ./" in dockerfile
    assert "RUN npm ci" in dockerfile


def test_web_build_context_excludes_host_dependencies():
    dockerignore = Path("web/.dockerignore").read_text(encoding="utf-8")

    assert "node_modules" in dockerignore.splitlines()
