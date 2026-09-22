#!/usr/bin/env bash
set -Eeuo pipefail

readonly app_dir="/opt/adpulse"
readonly compose_file="$app_dir/compose.prod.yml"
readonly backup_dir="$app_dir/backups"
readonly keep_days=14

cd "$app_dir"
mkdir -p "$backup_dir"

readonly dump_file="$backup_dir/adpulse-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose --env-file .env -f "$compose_file" exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$dump_file"

find "$backup_dir" -name 'adpulse-*.sql.gz' -mtime "+$keep_days" -delete

printf 'Backed up to %s\n' "$dump_file"
