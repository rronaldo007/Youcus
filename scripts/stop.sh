#!/usr/bin/env bash
#
# Everything down. THE DATABASE VOLUME IS NEVER TOUCHED.
#
#   ./scripts/stop.sh
#
# Only what this repo started is stopped: a process on port 4000 or 5173 that comes from
# another project is left alone and named.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/common.sh
. "$ROOT/scripts/common.sh"

stop_port() {
  local label="$1" name="$2" port="$3" state reason pid
  say "$label"
  if stop_group "$name"; then
    note "process group from start.sh stopped"
  fi
  state=0
  reason="$(port_is_ours "$port" "$ROOT")" || state=$?
  case "$state" in
    2) ok "port $port free" ;;
    0) # Started by hand (npm run dev...): stop it, and its group if it has one.
       pid="${reason#pid }"
       kill -TERM -- "-$(ps -o pgid= -p "$pid" | tr -d ' ')" 2>/dev/null || kill "$pid" 2>/dev/null
       for _ in $(seq 1 10); do [ -z "$(port_pid "$port")" ] && break; sleep 1; done
       [ -z "$(port_pid "$port")" ] && ok "port $port free (it had been started by hand)" \
         || die "port $port still held by $reason"
       ;;
    1) note "LEFT IN PLACE: $reason (not this repo)" ;;
  esac
}

stop_port "Client" client "$CLIENT_PORT"
stop_port "API" api "$API_PORT"

say "Containers"
# down without -v: containers go, the volume stays. That is the whole point.
docker compose down >/dev/null 2>&1 || die "docker compose down failed"
ok "stopped"

# The proof, not the absence of an error.
say "Database volume"
if docker volume inspect "$DB_VOLUME" >/dev/null 2>&1; then
  ok "$DB_VOLUME is still there"
else
  printf '  \033[33m!\033[0m %s no longer exists: abnormal, nothing here deletes it\n' "$DB_VOLUME"
fi
echo
