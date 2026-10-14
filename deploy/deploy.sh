#!/usr/bin/env bash
set -Eeuo pipefail

: "${APP_IMAGE:?APP_IMAGE must contain the immutable image tag to deploy}"

readonly app_dir="/opt/adpulse"
readonly compose_file="$app_dir/compose.prod.yml"

remove_superseded_app_images() {
  docker images "${APP_IMAGE%:*}" --format '{{.Repository}}:{{.Tag}}' \
    | { grep --invert-match --line-regexp --fixed-strings "$APP_IMAGE" || true; } \
    | xargs --no-run-if-empty docker rmi
}

cd "$app_dir"
export APP_IMAGE

docker compose --env-file .env -f "$compose_file" pull --policy missing app migrate
docker compose --env-file .env -f "$compose_file" up -d --wait db storage
bash "$app_dir/backup.sh"
docker compose --env-file .env -f "$compose_file" run --rm storage-init
docker compose --env-file .env -f "$compose_file" run --rm migrate
docker compose --env-file .env -f "$compose_file" up -d --remove-orphans app

for attempt in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:3100/healthz >/dev/null; then
    printf 'Deployed %s successfully\n' "$APP_IMAGE"
    if ! remove_superseded_app_images; then
      printf 'Could not remove superseded app images; free the disk by hand\n' >&2
    fi
    exit 0
  fi
  sleep 2
done

docker compose --env-file .env -f "$compose_file" ps
docker compose --env-file .env -f "$compose_file" logs --tail=100 app
printf 'Deployment health check failed\n' >&2
exit 1
