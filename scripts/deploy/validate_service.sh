#!/usr/bin/env bash
set -euo pipefail

SERVICE_DIR="/home/ec2-user/game_finder"
HEALTH_URL="http://127.0.0.1:8000/health/"

cd "${SERVICE_DIR}"
docker compose -f docker-compose.lightsail.yml ps

for attempt in $(seq 1 10); do
  if curl -fsS "${HEALTH_URL}" > /dev/null; then
    exit 0
  fi
  sleep 3
done

docker compose -f docker-compose.lightsail.yml logs --tail=100 app
exit 1
