#!/usr/bin/env bash
#
# What start.sh and stop.sh both know. Shared on purpose: the check "is this process OURS?"
# is a safety rule, and two copies of it drift apart.

RUN_DIR="${TMPDIR:-/tmp}/youcus-dev"
API_PORT="${API_PORT:-4000}"
CLIENT_PORT=5173
API_URL="http://localhost:$API_PORT"
CLIENT_URL="http://localhost:$CLIENT_PORT"
DB_VOLUME="youcus_youcus-db-data"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m\xe2\x9c\x93\033[0m %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }
die()  { printf '  \033[31m\xe2\x9c\x97\033[0m %s\n' "$*" >&2; exit 1; }

# PID of the process listening on a TCP port, or nothing.
port_pid() {
  ss -ltnp 2>/dev/null \
    | awk -v p=":$1 " '$0 ~ p { if (match($0, /pid=[0-9]+/)) { print substr($0, RSTART+4, RLENGTH-4); exit } }'
}

# Directory a process was started from.
pid_cwd() {
  readlink "/proc/$1/cwd" 2>/dev/null || echo unknown
}

# 0 = the process on port $1 was started from directory $2 (or below it).
# 1 = someone else holds the port. 2 = the port is free. Writes the reason to stdout.
# A server that answers on the port is not necessarily ours: a Vite from another project,
# or the api-dev container of this very compose file, answers just as well.
port_is_ours() {
  local port="$1" expected="$2" pid cwd
  pid="$(port_pid "$port")"
  if [ -z "$pid" ]; then echo "port $port free"; return 2; fi
  cwd="$(pid_cwd "$pid")"
  case "$cwd" in
    "$expected"|"$expected"/*) echo "pid $pid"; return 0 ;;
    *) echo "pid $pid, started from \"$cwd\" and not from \"$expected\""; return 1 ;;
  esac
}

# Stops a process started by start.sh, WITH its children. The watcher restarts the API as soon
# as only the listening child dies, so we kill the whole process group that setsid created.
stop_group() {
  local name="$1" pidfile="$RUN_DIR/$1.pid" pgid
  [ -f "$pidfile" ] || return 1
  pgid="$(cat "$pidfile")"
  if kill -0 "$pgid" 2>/dev/null; then
    kill -TERM -- "-$pgid" 2>/dev/null
    for _ in $(seq 1 10); do kill -0 "$pgid" 2>/dev/null || break; sleep 1; done
    kill -0 "$pgid" 2>/dev/null && kill -KILL -- "-$pgid" 2>/dev/null
  fi
  rm -f "$pidfile"
  return 0
}
