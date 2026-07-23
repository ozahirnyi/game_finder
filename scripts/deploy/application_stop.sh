#!/usr/bin/env bash
set -euo pipefail

SERVICE_DIR="/home/ec2-user/game_finder"

if [ -f "${SERVICE_DIR}/docker-compose.lightsail.yml" ]; then
  cd "${SERVICE_DIR}"
  docker compose -f docker-compose.lightsail.yml down || true
fi
