#!/usr/bin/env bash
set -Eeuo pipefail

: "${APP_IMAGE:?APP_IMAGE must contain the immutable image tag to deploy}"

readonly app_dir="/opt/adpulse"
readonly compose_file="$app_dir/compose.prod.yml"

cd "$app_dir"
export APP_IMAGE

docker compose --env-file .env -f "$compose_file" pull --policy missing app migrate
docker compose --env-file .env -f "$compose_file" up -d db storage
docker compose --env-file .env -f "$compose_file" run --rm storage-init
docker compose --env-file .env -f "$compose_file" run --rm migrate
docker compose --env-file .env -f "$compose_file" up -d --remove-orphans app

for attempt in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:3100/healthz >/dev/null; then
    printf 'Deployed %s successfully\n' "$APP_IMAGE"
    exit 0
  fi
  sleep 2
done

docker compose --env-file .env -f "$compose_file" ps
docker compose --env-file .env -f "$compose_file" logs --tail=100 app
printf 'Deployment health check failed\n' >&2
exit 1
