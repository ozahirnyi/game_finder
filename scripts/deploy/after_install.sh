#!/usr/bin/env bash
set -euo pipefail

SERVICE_DIR="/home/ec2-user/game_finder"
SERVICE_USER="ec2-user"
PARAM_PREFIX="/game-finder/production"
AWS_REGION="${AWS_REGION:-eu-central-1}"
ENV_BACKUP="/home/${SERVICE_USER}/.game-finder.env.backup"

cd "${SERVICE_DIR}"

TEMP_OUTPUT="$(mktemp)"
TEMP_ERROR="$(mktemp)"
trap 'rm -f "${TEMP_OUTPUT}" "${TEMP_ERROR}"' EXIT

if ! aws ssm get-parameters-by-path \
  --path "${PARAM_PREFIX}" \
  --recursive \
  --with-decryption \
  --region "${AWS_REGION}" \
  --query 'Parameters[*].[Name,Value]' \
  --output text > "${TEMP_OUTPUT}" 2> "${TEMP_ERROR}"; then
  cat "${TEMP_ERROR}" >&2
  if [ -s "${ENV_BACKUP}" ]; then
    cp "${ENV_BACKUP}" .env
  else
    exit 1
  fi
else
  : > .env
  while IFS=$'\t' read -r name value; do
    [ -z "${name}" ] && continue
    key="${name#${PARAM_PREFIX}/}"
    printf '%s=%s\n' "${key}" "${value}" >> .env
  done < "${TEMP_OUTPUT}"
fi

test -s .env
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${SERVICE_DIR}"
chmod 600 .env

docker compose -f docker-compose.lightsail.yml build
docker compose -f docker-compose.lightsail.yml run --rm app alembic upgrade head
