from pathlib import Path


def test_lightsail_deploy_retries_curl_exit_56_during_health_check() -> None:
    script = Path("scripts/deploy/ssh_deploy.sh").read_text(encoding="utf-8")

    assert (
        "curl --fail --retry 10 --retry-connrefused --retry-all-errors "
        "http://127.0.0.1:8000/health"
    ) in script
