#!/usr/bin/env bash
set -euo pipefail

cd /home/ec2-user/game_finder
docker compose -f docker-compose.lightsail.yml up -d
docker compose -f docker-compose.lightsail.yml ps
