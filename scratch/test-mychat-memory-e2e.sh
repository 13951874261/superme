#!/bin/bash
# mychat_memory_kb 端到端 smoke test（真实 userId）
#
# 流程：Dify mychat 发一条带唯一标记的消息 → 等待侧写/L1 HTTP 回写 → 校验 vocab-server 记忆层
#
# 用法（生产服务器，推荐）：
#   export DIFY_CHAT_API_KEY='app-...'   # 与 systemd super-agent-vocab 中一致
#   bash /var/www/super-agent/scratch/test-mychat-memory-e2e.sh YOUR_USER_ID
#
# 仅模拟 mychat HTTP 回写（跳过 Dify，快速验通路）：
#   bash test-mychat-memory-e2e.sh YOUR_USER_ID --simulate-only
#
# 列出最近活跃用户 ID：
#   bash test-mychat-memory-e2e.sh --list-users
#
# 浏览器获取自己的 userId（登录 https://app.liujingzhuwo.site 后 F12 Console）：
#   localStorage.getItem('super_agent_user_id')

set -euo pipefail

VOCAB_BASE="${VOCAB_BASE:-http://127.0.0.1:3001}"
PUBLIC_BASE="${PUBLIC_BASE:-https://app.liujingzhuwo.site}"
DIFY_BASE="${DIFY_API_BASE_URL:-https://dify.234124123.xyz/v1}"
DIFY_KEY="${DIFY_CHAT_API_KEY:-app-TyztRkdBVX4kNUxA8dZ0frk7}"
DB_PATH="${VOCAB_DB:-/var/www/super-agent/vocab.db}"
SIMULATE_ONLY=0
USER_ID=""

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \?//'
  exit 1
}

for arg in "$@"; do
  case "$arg" in
    --simulate-only) SIMULATE_ONLY=1 ;;
    --list-users)
      if [ -f "$DB_PATH" ]; then
        echo "Recent user_memories (user_id | updated_at):"
        sqlite3 "$DB_PATH" "SELECT user_id, datetime(updated_at/1000,'unixepoch','localtime') FROM user_memories ORDER BY updated_at DESC LIMIT 15;" 2>/dev/null || \
          sqlite3 "$DB_PATH" "SELECT user_id, updated_at FROM user_memories ORDER BY updated_at DESC LIMIT 15;"
      else
        echo "DB not found: $DB_PATH"
        exit 1
      fi
      exit 0
      ;;
    -h|--help) usage ;;
    *)
      if [ -z "$USER_ID" ]; then USER_ID="$arg"; fi
      ;;
  esac
done

if [ -z "$USER_ID" ]; then
  echo "ERROR: 缺少 userId。用法: $0 <user-id> [--simulate-only]"
  echo "      或: $0 --list-users"
  exit 1
fi

MARKER="smoke-mychat-$(date +%Y%m%d%H%M%S)"
PASS=0
FAIL=0

ok() { echo "OK: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "WARN: $1"; }

count_mychat_layers() {
  local json="$1"
  echo "$json" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print('0 0 0')
    sys.exit(0)
layers = (d.get('data') or {}).get('memory_layers') or {}
l1 = [x for x in (layers.get('l1_summaries') or []) if x.get('source') == 'mychat_memory_kb']
eps = [x for x in (layers.get('l2_episodes') or []) if x.get('source') == 'mychat_memory_kb']
prof = ((d.get('data') or {}).get('profile_content') or '')
print(len(l1), len(eps), len(prof))
" 2>/dev/null || echo "0 0 0"
}

fetch_profile() {
  curl -sf "$VOCAB_BASE/api/user/profile/$USER_ID" || echo '{"success":false}'
}

echo "========== mychat Memory E2E Smoke Test =========="
echo "USER_ID=$USER_ID  MARKER=$MARKER"
echo "VOCAB_BASE=$VOCAB_BASE  SIMULATE_ONLY=$SIMULATE_ONLY"
echo ""

echo "--- 0. Before snapshot ---"
BEFORE=$(fetch_profile)
read -r L1_BEFORE EP_BEFORE PROF_BEFORE <<< "$(count_mychat_layers "$BEFORE")"
echo "mychat L1=$L1_BEFORE episodes=$EP_BEFORE profile_len=$PROF_BEFORE"
echo ""

if [ "$SIMULATE_ONLY" -eq 1 ]; then
  echo "--- 1. Simulate mychat HTTP nodes (L1 + profileDelta) ---"
  SIM_TITLE="mychat模拟-$MARKER"
  SIM_TEXT="用户长期偏好英音，正在系统性练习即兴表达。标记:${MARKER}"
  curl -sf -X POST "$VOCAB_BASE/api/user/memory/ingest" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$USER_ID\",\"source\":\"mychat_memory_kb\",\"sessionSummary\":{\"title\":\"$SIM_TITLE\",\"summary\":\"$SIM_TEXT\"},\"promoteToEpisode\":true}" > /dev/null
  curl -sf -X POST "$VOCAB_BASE/api/user/memory/ingest" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$USER_ID\",\"source\":\"mychat_memory_kb\",\"profileDelta\":\"${SIM_TEXT:0:200}\"}" > /dev/null
  ok "simulated L1 + profile ingest"
else
  echo "--- 1. Dify mychat_memory_kb chat (blocking, may take 2-5 min) ---"
  QUERY="【${MARKER}】我长期偏好英音，正在系统性练习商务即兴表达。请记住这个学习目标，便于后续个性化辅导。"
  echo "Query: $QUERY"
  PAYLOAD=$(USER_ID="$USER_ID" QUERY="$QUERY" python3 -c "import json,os; print(json.dumps({'inputs':{},'query':os.environ['QUERY'],'user':os.environ['USER_ID'],'response_mode':'blocking'}))")
  CHAT_RESP=$(curl -sf --max-time 600 -X POST "$DIFY_BASE/chat-messages" \
    -H "Authorization: Bearer $DIFY_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" 2>&1) || {
    fail "Dify chat-messages failed (check DIFY_CHAT_API_KEY / network). Response: ${CHAT_RESP:0:300}"
    CHAT_RESP=""
  }
  if [ -n "$CHAT_RESP" ]; then
    if echo "$CHAT_RESP" | grep -q '"answer"'; then
      ok "Dify chat returned answer"
    else
      fail "Dify response missing answer: ${CHAT_RESP:0:400}"
    fi
  fi
  echo "Waiting 15s for async 侧写/L1 HTTP nodes..."
  sleep 15
fi

echo ""
echo "--- 2. After snapshot ---"
AFTER=$(fetch_profile)
read -r L1_AFTER EP_AFTER PROF_AFTER <<< "$(count_mychat_layers "$AFTER")"
echo "mychat L1=$L1_AFTER episodes=$EP_AFTER profile_len=$PROF_AFTER"

if [ "$L1_AFTER" -gt "$L1_BEFORE" ] || [ "$EP_AFTER" -gt "$EP_BEFORE" ]; then
  ok "new mychat_memory_kb L1/episode ingested"
else
  fail "no new mychat L1/episode (before L1=$L1_BEFORE ep=$EP_BEFORE → after L1=$L1_AFTER ep=$EP_AFTER)"
fi

if [ "$PROF_AFTER" -gt "$PROF_BEFORE" ]; then
  ok "profile_content grew (侧写回写)"
else
  warn "profile_content unchanged (侧写可能未触发或内容重复)"
fi

echo ""
echo "--- 3. Recall by marker ---"
RECALL=$(curl -sf -G "$VOCAB_BASE/api/user/memory/recall" \
  --data-urlencode "userId=$USER_ID" \
  --data-urlencode "query=$MARKER" || true)
if echo "$RECALL" | grep -q "$MARKER"; then
  ok "recall hits marker $MARKER"
elif echo "$RECALL" | grep -q '英音'; then
  ok "recall hits 英音 (marker may be in episode only)"
else
  fail "recall: $(echo "$RECALL" | head -c 250)"
fi

echo ""
echo "--- 4. Latest mychat episode provenance ---"
EP_ID=$(echo "$AFTER" | python3 -c "
import json, sys
d = json.load(sys.stdin)
eps = (d.get('data') or {}).get('memory_layers', {}).get('l2_episodes') or []
my = [e for e in eps if e.get('source')=='mychat_memory_kb']
if not my:
    print('')
else:
    print(my[0].get('_id',''))
" 2>/dev/null || true)
if [ -n "$EP_ID" ]; then
  PROV=$(curl -sf "$VOCAB_BASE/api/user/memory/provenance/$USER_ID/$EP_ID" || true)
  if echo "$PROV" | grep -q '"l1_summary"'; then
    ok "provenance for $EP_ID"
  else
    fail "provenance missing l1 for $EP_ID"
  fi
else
  warn "no mychat episode for provenance check"
fi

echo ""
echo "--- 5. Public API spot check (optional) ---"
PUB=$(curl -sf "$PUBLIC_BASE/api/user/profile/$USER_ID" 2>/dev/null | head -c 120 || true)
if [ -n "$PUB" ]; then
  ok "public profile reachable"
else
  warn "public profile check skipped/failed ($PUBLIC_BASE)"
fi

echo ""
echo "========== Summary: PASS=$PASS FAIL=$FAIL =========="
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "排查提示："
  echo "  1. Dify 是否已导入并发布 yml/mychat_memory_kb.yml（含 L1摘要回写vocab-server 节点）"
  echo "  2. 档案员是否 save=true（消息需含明确学习目标）"
  echo "  3. userId 是否与浏览器 localStorage super_agent_user_id 一致"
  echo "  4. 快速验通路: $0 $USER_ID --simulate-only"
  exit 1
fi
exit 0
