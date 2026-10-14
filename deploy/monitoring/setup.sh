#!/usr/bin/env bash
set -Eeuo pipefail

readonly monitoring_dir="/opt/monitoring"
readonly hub_url="http://127.0.0.1:8090"
readonly agent_socket="/beszel_socket/beszel.sock"
readonly system_name="adpulse-prod"

cd "$monitoring_dir"

compose() {
  docker compose --env-file .env -f compose.yml "$@"
}

write_env_value() {
  local name=$1 value=$2
  sed --in-place "/^$name=/d" .env
  printf '%s="%s"\n' "$name" "$value" >>.env
}

hub() {
  local method=$1 path=$2 token=$3
  shift 3
  curl --fail-with-body --silent --show-error --request "$method" \
    --header "Authorization: $token" --header 'Content-Type: application/json' \
    "$@" "$hub_url$path"
}

sign_in() {
  local collection=$1
  jq --null-input --arg identity "$BESZEL_USER_EMAIL" --arg password "$BESZEL_USER_PASSWORD" \
    '{$identity, $password}' \
    | curl --fail-with-body --silent --show-error --json @- \
      "$hub_url/api/collections/$collection/auth-with-password"
}

wait_for_hub() {
  for attempt in {1..30}; do
    if curl --fail --silent "$hub_url/api/health" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  printf 'The Beszel hub did not answer on %s\n' "$hub_url" >&2
  return 1
}

apply_alert() {
  local name=$1 value=$2 minutes=$3
  jq --null-input --arg name "$name" --argjson value "$value" --argjson min "$minutes" \
    --arg system "$system_id" '{$name, $value, $min, systems: [$system], overwrite: true}' \
    | hub POST /api/beszel/user-alerts "$user_token" --data @- >/dev/null
}

if [[ ! -f .env ]]; then
  (
    umask 077
    printf 'BESZEL_USER_EMAIL="%s"\nBESZEL_USER_PASSWORD="%s"\n' \
      "${BESZEL_USER_EMAIL:?pass BESZEL_USER_EMAIL on the first run}" "$(openssl rand -hex 24)" >.env
  )
fi
set -a
. ./.env
set +a

compose pull --quiet
compose up -d hub
wait_for_hub

superuser_token=$(sign_in _superusers | jq --raw-output .token)
user_auth=$(sign_in users)
user_token=$(jq --raw-output .token <<<"$user_auth")
user_id=$(jq --raw-output .record.id <<<"$user_auth")
hub PATCH "/api/collections/users/records/$user_id" "$superuser_token" --data '{"role":"admin"}' >/dev/null

write_env_value BESZEL_HUB_PUBLIC_KEY "$(hub GET /api/beszel/getkey "$user_token" | jq --raw-output .key)"
compose up -d agent

system_id=$(hub GET /api/collections/systems/records "$user_token" --get \
  --data-urlencode "filter=name='$system_name'" | jq --raw-output '.items[0].id // empty')
if [[ -z $system_id ]]; then
  system_id=$(jq --null-input --arg name "$system_name" --arg host "$agent_socket" --arg user "$user_id" \
    '{$name, $host, port: "45876", users: [$user]}' \
    | hub POST /api/collections/systems/records "$user_token" --data @- | jq --raw-output .id)
fi

apply_alert Disk 80 10
apply_alert Memory 85 10
apply_alert CPU 85 10
apply_alert LoadAvg5 2 10
apply_alert Bandwidth 10 5
apply_alert Status 0 2
apply_alert ContainerHealth 0 5

if [[ -n ${BESZEL_NOTIFY_URL:-} ]]; then
  settings=$(hub GET /api/collections/user_settings/records "$user_token" | jq '.items[0] // empty')
  if [[ -z $settings ]]; then
    settings=$(jq --null-input --arg user "$user_id" '{$user}' \
      | hub POST /api/collections/user_settings/records "$user_token" --data @-)
  fi
  jq --arg url "$BESZEL_NOTIFY_URL" '{settings: (.settings + {webhooks: [$url]})}' <<<"$settings" \
    | hub PATCH "/api/collections/user_settings/records/$(jq --raw-output .id <<<"$settings")" "$user_token" \
      --data @- >/dev/null
  jq --null-input --arg url "$BESZEL_NOTIFY_URL" '{$url}' \
    | hub POST /api/beszel/test-notification "$user_token" --data @-
  printf '\n'
fi

for attempt in {1..30}; do
  status=$(hub GET "/api/collections/systems/records/$system_id" "$user_token" | jq --raw-output .status)
  if [[ $status == up ]]; then
    printf '%s is up and its alerts are set\n' "$system_name"
    exit 0
  fi
  sleep 2
done

compose logs --tail=50
printf '%s is %s, not up\n' "$system_name" "$status" >&2
exit 1
