#!/usr/bin/env bash
set -euo pipefail

SERVICE_DIR="/home/ec2-user/game_finder"
BACKUP_DIR="/home/ec2-user/backups/game-finder"

mkdir -p "${BACKUP_DIR}"
cd "${SERVICE_DIR}"
set -a
. ./.env
set +a

BACKUP_FILE="${BACKUP_DIR}/game-finder_$(date +%Y%m%d_%H%M%S).sql"
docker compose -f docker-compose.lightsail.yml exec -T db \
  pg_dump -U "${DB_USER}" -d "${DB_NAME}" > "${BACKUP_FILE}"
gzip "${BACKUP_FILE}"
find "${BACKUP_DIR}" -name '*.sql.gz' -mtime +7 -delete
