#!/usr/bin/env bash
set -Eeuo pipefail

readonly app_dir="/opt/adpulse"
readonly compose_file="$app_dir/compose.prod.yml"
readonly backup_dir="$app_dir/backups"
readonly keep_days=14

# compose.prod.yml references APP_IMAGE for the app/migrate services even
# though backups only touch db — compose validates the whole file regardless
# of which service is targeted, so an unset APP_IMAGE fails config parsing.
export APP_IMAGE="${APP_IMAGE:-unused-for-backup}"

cd "$app_dir"
mkdir -p "$backup_dir"

readonly dump_file="$backup_dir/adpulse-$(date +%Y%m%d-%H%M%S).sql.gz"
readonly partial_file="$dump_file.partial"
trap 'rm -f "$partial_file"' EXIT

docker compose --env-file .env -f "$compose_file" exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$partial_file"
mv "$partial_file" "$dump_file"

find "$backup_dir" -name 'adpulse-*.sql.gz' -mtime "+$keep_days" -delete

printf 'Backed up to %s\n' "$dump_file"
