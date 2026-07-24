from pathlib import Path


def test_lightsail_deploy_installs_and_reloads_nginx_template() -> None:
    script = Path("scripts/deploy/ssh_deploy.sh").read_text(encoding="utf-8")

    assert "infra/lightsail/nginx/game-finder.conf" in script
    assert "sudo nginx -t" in script
    assert "sudo systemctl reload nginx" in script
