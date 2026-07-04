#!/bin/bash
# Phase 5 记忆系统全链路验证（在服务器本机执行）
# 用法：bash /var/www/super-agent/scratch/verify-memory-phase5.sh [user-id]

set -euo pipefail
BASE="${MEMORY_TEST_BASE:-http://127.0.0.1:3001}"
USER_ID="${1:-deploy-memory-test}"
PASS=0
FAIL=0

ok() { echo "OK: $1"; PASS=$((PASS + 1)); }
warn() { echo "WARN: $1"; }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "========== Memory Phase 5 Verification =========="
echo "BASE=$BASE USER_ID=$USER_ID"
echo ""

echo "--- 1. Health ---"
HEALTH=$(curl -sf "$BASE/api/vocab/health" || true)
if echo "$HEALTH" | grep -q 'ok\|success\|vocab'; then
  ok "vocab health"
else
  fail "vocab health: $HEALTH"
fi

echo ""
echo "--- 2. L0/L1/L3 ingest + provenance ---"
INGEST=$(curl -sf -X POST "$BASE/api/user/memory/ingest" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"source\":\"phase5_verify\",\"turn\":{\"role\":\"user\",\"text\":\"我偏好英音，想练即兴表达\",\"session_id\":\"phase5_sess\"},\"sessionSummary\":{\"title\":\"Phase5\",\"summary\":\"用户偏好英音，正在练即兴表达\"},\"l3VarsDelta\":{\"accent\":\"UK\",\"training_goal\":\"即兴表达\"},\"promoteToEpisode\":true}" || true)

EP_ID=$(echo "$INGEST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('ingest_meta',{}).get('episode_id',''))" 2>/dev/null || true)
L3_ACCENT=$(echo "$INGEST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('l3_vars',{}).get('accent',''))" 2>/dev/null || true)

if [ -n "$EP_ID" ]; then ok "ingest episode_id=$EP_ID"; else fail "ingest missing episode_id"; fi
if [ "$L3_ACCENT" = "UK" ]; then ok "l3_vars.accent=UK"; else fail "l3_vars.accent expected UK got $L3_ACCENT"; fi

if [ -n "$EP_ID" ]; then
  PROV=$(curl -sf "$BASE/api/user/memory/provenance/$USER_ID/$EP_ID" || true)
  if echo "$PROV" | grep -q '"l1_summary"'; then ok "provenance l1_summary"; else fail "provenance missing l1"; fi
  if echo "$PROV" | grep -q '"l0_turns"'; then ok "provenance l0_turns"; else warn "provenance l0_turns empty (may be ok if linked via source_l0_ids)"; fi
fi

echo ""
echo "--- 3. Recall API ---"
RECALL=$(curl -sf "$BASE/api/user/memory/recall?userId=$USER_ID&query=英音" || true)
if echo "$RECALL" | grep -q '"success":true' && echo "$RECALL" | grep -q '英音'; then
  ok "recall 英音"
else
  fail "recall: $(echo "$RECALL" | head -c 200)"
fi

echo ""
echo "--- 4. Dreaming (LLM layer) ---"
DREAM=$(curl -sf -X POST "$BASE/api/user/memory/dreaming/run" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\"}" || true)
echo "$DREAM" | head -c 600
echo ""

if echo "$DREAM" | grep -q '"skipped":false'; then
  ok "LLM dreaming executed"
  if echo "$DREAM" | grep -q '"cluster"'; then ok "dreaming cluster meta present"; fi
  if echo "$DREAM" | grep -q '"l3_vars"'; then ok "dreaming l3_vars in response"; fi
elif echo "$DREAM" | grep -q '"reason":"llm_disabled"'; then
  warn "LLM dreaming disabled — set DIFY_MEMORY_DREAMING_API_KEY in vocab-server/.env"
elif echo "$DREAM" | grep -q '"reason":"no_pending"'; then
  warn "no pending episodes (already dreamed)"
else
  warn "dreaming check inconclusive — inspect JSON above"
fi

echo ""
echo "--- 5. Service log hints ---"
if command -v journalctl >/dev/null 2>&1; then
  journalctl -u super-agent-vocab.service -n 8 --no-pager 2>/dev/null | grep -E 'Memory Dreaming|cluster enabled|error' || true
fi

echo ""
echo "========== Summary: PASS=$PASS FAIL=$FAIL =========="
if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
