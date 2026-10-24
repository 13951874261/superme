#!/usr/bin/env bash
# =============================================================================
# manual-daily-pack-cron.sh  —  服务器端完整手动调度脚本
# 路径建议: /var/www/super-agent/vocab-server/scripts/manual-daily-pack-cron.sh
#
# 功能:
#   1) 触发 daily-pack cron（唤醒+破绽，等同定时任务）
#   2) 可选: 触发 listen 预生成 cron
#   3) 可选: 指定用户 sync theme + regenerate wakeup + GET today
#   4) 打印服务状态摘要
#
# 用法（在服务器上）:
#   bash manual-daily-pack-cron.sh --cron-only
#   bash manual-daily-pack-cron.sh --listen-too --cron-only
#   bash manual-daily-pack-cron.sh \
#     --user 'user_6f33882d-3363-4e8b-877b-f4c5ace73176' \
#     --theme '商务谈判：让步与施压'
#   bash manual-daily-pack-cron.sh --cron-only --user '...' --theme '...'
# =============================================================================

set -euo pipefail

ROOT="/var/www/super-agent/vocab-server"
BASE="http://127.0.0.1:3001"
ENV_FILE="$ROOT/.env"

USER_ID=""
THEME=""
CRON_ONLY=0
SKIP_CRON=0
LISTEN_TOO=0

usage() {
  cat <<'EOF'
Usage:
  bash manual-daily-pack-cron.sh [options]

Options:
  --cron-only          Only run daily-pack cron-run (no per-user regenerate)
  --skip-cron          Skip cron-run; only do --user/--theme steps
  --listen-too         Also run listen pregenerate cron-run
  --user <id>          Target userId for theme sync + wakeup regenerate + GET today
  --theme <text>       Theme required with --user
  -h, --help           Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user) USER_ID="${2:-}"; shift 2 ;;
    --theme) THEME="${2:-}"; shift 2 ;;
    --cron-only) CRON_ONLY=1; shift ;;
    --skip-cron) SKIP_CRON=1; shift ;;
    --listen-too) LISTEN_TOO=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage >&2; exit 1 ;;
  esac
done

echo "=============================================="
echo " manual-daily-pack-cron  $(date '+%F %T %Z')"
echo " ROOT=$ROOT"
echo " BASE=$BASE"
echo "=============================================="

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: missing $ENV_FILE" >&2
  exit 1
fi

SECRET="$(grep -E '^DAILY_PACK_CRON_SECRET=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
if [[ -z "$SECRET" ]]; then
  echo "ERROR: DAILY_PACK_CRON_SECRET empty" >&2
  exit 1
fi

echo
echo "---------- service status ----------"
systemctl is-active super-agent-vocab.service || true
curl -sS -o /dev/null -w "GET /api/vocab/stats HTTP %{http_code}\n" "$BASE/api/vocab/stats" || true

urlencode() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
  else
    # fallback: only safe for typical user_* ids
    printf '%s' "$1" | sed 's/ /%20/g'
  fi
}

json_escape() {
  # minimal escape for embedding in JSON string
  printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])' 2>/dev/null \
    || printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

if [[ "$SKIP_CRON" -eq 0 ]]; then
  echo
  echo "---------- [1] POST /api/daily-pack/cron-run ----------"
  echo "(may take minutes if many users / Dify slow)"
  curl -sS -X POST "$BASE/api/daily-pack/cron-run" \
    -H "x-cron-secret: $SECRET" \
    -H "Content-Type: application/json"
  echo
  echo

  if [[ "$LISTEN_TOO" -eq 1 ]]; then
    echo "---------- [2] POST /api/listen/pregenerated/cron-run ----------"
    curl -sS -X POST "$BASE/api/listen/pregenerated/cron-run" \
      -H "x-cron-secret: $SECRET" \
      -H "Content-Type: application/json"
    echo
    echo
  fi
else
  echo
  echo "---------- skip cron (--skip-cron) ----------"
fi

if [[ "$CRON_ONLY" -eq 1 && -z "$USER_ID" ]]; then
  echo
  echo "DONE (--cron-only)."
  exit 0
fi

if [[ -n "$USER_ID" ]]; then
  if [[ -z "$THEME" ]]; then
    echo "ERROR: --user requires --theme" >&2
    exit 1
  fi

  THEME_ESC="$(json_escape "$THEME")"
  USER_ESC="$(json_escape "$USER_ID")"

  echo
  echo "---------- [3] PUT /api/user/theme ----------"
  curl -sS -X PUT "$BASE/api/user/theme" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data-binary "{\"userId\":\"$USER_ESC\",\"theme\":\"$THEME_ESC\"}"
  echo
  echo

  echo "---------- [4] POST /api/daily-pack/regenerate type=wakeup ----------"
  echo "(Dify wakeup; often 30s-120s)"
  curl -sS -X POST "$BASE/api/daily-pack/regenerate" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data-binary "{\"userId\":\"$USER_ESC\",\"type\":\"wakeup\",\"theme\":\"$THEME_ESC\"}"
  echo
  echo

  QUID="$(urlencode "$USER_ID")"
  echo "---------- [5] GET /api/daily-pack/today ----------"
  curl -sS "$BASE/api/daily-pack/today?userId=$QUID"
  echo
  echo
fi

echo "=============================================="
echo " DONE  $(date '+%F %T %Z')"
echo " Frontend: hard-refresh -> 英语引擎 -> 每日唤醒"
echo "=============================================="
