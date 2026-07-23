#!/usr/bin/env bash
set -euo pipefail

SERVICE_DIR="/home/ec2-user/game_finder"
SERVICE_USER="ec2-user"
ENV_BACKUP="/home/${SERVICE_USER}/.game-finder.env.backup"

if [ -f "${SERVICE_DIR}/docker-compose.lightsail.yml" ]; then
  cd "${SERVICE_DIR}"
  docker compose -f docker-compose.lightsail.yml down || true
fi

if [ -f "${SERVICE_DIR}/.env" ]; then
  cp "${SERVICE_DIR}/.env" "${ENV_BACKUP}"
fi

mkdir -p "${SERVICE_DIR}"
find "${SERVICE_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
