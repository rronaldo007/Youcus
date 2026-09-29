#!/usr/bin/env bash
#
# Youcus up in one command, and it only says "ready" once everything really answers.
#
#   ./scripts/start.sh
#
# MySQL and Redis run in Docker; the API and the client run on the host (hot reload,
# readable logs). Logs and pid files live in $RUN_DIR, outside the repo.
#
# Why not `docker compose up`: compose gives control back when containers have STARTED,
# not when the API answers. Clicking too early shows errors that look like app bugs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/common.sh
. "$ROOT/scripts/common.sh"
mkdir -p "$RUN_DIR"

# --- Docker ------------------------------------------------------------------------------
say "Docker"
docker info >/dev/null 2>&1 || die "Docker is not running: start it, then run this script again"
ok "running"

# --- database and cache ------------------------------------------------------------------
# Naming the services starts only them, whatever COMPOSE_PROFILES says in .env.
# --wait returns once the healthchecks pass, not when the containers start.
say "Database and cache"
docker compose up -d --wait db cache >/dev/null 2>&1 || die "db or cache did not become healthy (docker compose logs db cache)"
ok "youcus-db and youcus-cache healthy"

# --- dependencies and schema -------------------------------------------------------------
say "Schema"
[ -d node_modules ] || npm ci
# `migrate deploy`, NEVER `migrate dev`: dev may WRITE a migration, which is a decision a
# start script must not take. deploy only applies what is already in the repo.
(cd server && npx prisma migrate deploy >"$RUN_DIR/migrate.log" 2>&1) \
  || die "prisma migrate deploy failed (see $RUN_DIR/migrate.log)"
# We do not take deploy at its word: status must say nothing is pending.
(cd server && npx prisma migrate status 2>&1) | grep -q "Database schema is up to date" \
  || die "migrations are still pending"
(cd server && npx prisma generate >/dev/null 2>&1) || die "prisma generate failed"
ok "schema up to date, client generated"

# --- API ---------------------------------------------------------------------------------
say "API"
# Without REDIS_URL the API silently runs without its cache. server/.env does not set it for
# the host, so we point it at the youcus-cache container unless it is already given.
if ! grep -q '^REDIS_URL=' server/.env 2>/dev/null && [ -z "${REDIS_URL:-}" ]; then
  export REDIS_URL="redis://localhost:${REDIS_PORT:-6379}"
  note "REDIS_URL=$REDIS_URL (cache container)"
fi

api_state=0
reason="$(port_is_ours "$API_PORT" "$ROOT")" || api_state=$?
case "$api_state" in
  0) ok "already running from this repo ($reason)" ;;
  1) die "port $API_PORT is held by something else: $reason.
      If it is the api-dev container: docker compose stop api-dev" ;;
  2) setsid npm run dev:server >"$RUN_DIR/api.log" 2>&1 < /dev/null &
     echo $! >"$RUN_DIR/api.pid"
     ;;
esac

# A non-empty body is not enough: an error page is a non-empty body too.
health=""
for _ in $(seq 1 60); do
  health="$(curl -fs "$API_URL/api/health?nc=$RANDOM" 2>/dev/null || true)"
  case "$health" in *'"status":"ok"'*) break ;; esac
  sleep 1
done
case "$health" in
  *'"status":"ok"'*) ok "answers on $API_URL/api/health" ;;
  *) die "the API never answered ok (see $RUN_DIR/api.log)" ;;
esac

# --- client ------------------------------------------------------------------------------
say "Client"
client_state=0
reason="$(port_is_ours "$CLIENT_PORT" "$ROOT")" || client_state=$?
case "$client_state" in
  0) ok "already running from this repo ($reason)" ;;
  1) die "port $CLIENT_PORT is held by something else: $reason" ;;
  2) setsid npm run dev >"$RUN_DIR/client.log" 2>&1 < /dev/null &
     echo $! >"$RUN_DIR/client.pid"
     ;;
esac
for _ in $(seq 1 60); do curl -fs -o /dev/null "$CLIENT_URL" 2>/dev/null && break; sleep 1; done
curl -fs -o /dev/null "$CLIENT_URL" 2>/dev/null || die "the client never answered (see $RUN_DIR/client.log)"
# The proxy must reach the API too, or every page shows "request failed".
curl -fs "$CLIENT_URL/api/health" 2>/dev/null | grep -q '"status":"ok"' \
  || die "the client answers but its /api proxy does not reach the API"
ok "answers on $CLIENT_URL, /api proxy ok"

cat <<INFO

  App       $CLIENT_URL
  API       $API_URL/api/health
  Logs      $RUN_DIR/api.log   $RUN_DIR/client.log

  Stop everything:  ./scripts/stop.sh   (the database volume is kept)

INFO
