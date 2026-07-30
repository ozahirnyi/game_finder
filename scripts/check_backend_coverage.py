"""Run the full backend pytest suite with the repository coverage gate."""

from __future__ import annotations

import subprocess
import sys


def main() -> int:
    command = [
        sys.executable,
        "-m",
        "pytest",
        "--cov-fail-under=94",
    ]
    return subprocess.call(command)


if __name__ == "__main__":
    raise SystemExit(main())
