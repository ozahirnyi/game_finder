#!/usr/bin/env bash
set -Eeuo pipefail

release_dir=/home/ec2-user/game_finder
env_file=/home/ec2-user/.game-finder.env

test -f "$env_file"
cd "$release_dir"
git fetch --prune origin main
git checkout --detach origin/main
cp "$env_file" .env
docker compose -f docker-compose.lightsail.yml build
docker compose -f docker-compose.lightsail.yml run --rm app alembic upgrade head
docker compose -f docker-compose.lightsail.yml up -d --remove-orphans
curl --fail --retry 10 --retry-connrefused --retry-all-errors http://127.0.0.1:8000/health
