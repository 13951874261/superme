#!/bin/bash
# Memory Dreaming Phase 1 端到端验证脚本
# 用法：bash /tmp/test-memory-dreaming.sh

set -e
BASE="http://127.0.0.1:3001"
USER_ID="${1:-test-user}"

echo "=== 1. ingest 测试 episode ==="
INGEST=$(curl -s -X POST "$BASE/api/user/memory/ingest" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"source\":\"manual\",\"episode\":{\"summary\":\"用户偏好英音，正在练即兴表达逻辑链\"}}")
echo "$INGEST" | head -c 500
echo ""
echo ""

echo "=== 2. 触发 Dreaming ==="
DREAM=$(curl -s -X POST "$BASE/api/user/memory/dreaming/run" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\"}")
echo "$DREAM"
echo ""

if echo "$DREAM" | grep -q '"skipped":false'; then
  echo "OK: LLM Dreaming 已执行"
  if echo "$DREAM" | grep -q '"synced":1'; then
    echo "OK: KB 同步成功"
  fi
  if echo "$DREAM" | grep -q '"totalRelations":[1-9]'; then
    echo "OK: Graph Memory 已有关系"
  elif echo "$DREAM" | grep -q '"source":"graph_'; then
    echo "WARN: Graph 由服务端兜底生成，请确认 Dify 工作流已更新"
  else
    echo "WARN: Graph relations 仍为 0，请上传最新 server.js 并确认 .env API Key"
  fi
elif echo "$DREAM" | grep -q '"reason":"llm_disabled"'; then
  echo "WARN: LLM 层未启用，检查 .env 中 DIFY_MEMORY_DREAMING_API_KEY"
elif echo "$DREAM" | grep -q '"reason":"no_pending"'; then
  echo "INFO: 无待处理 episode（可能已全部 dream 过）"
else
  echo "CHECK: 查看上方 JSON 中 llm.reason 字段"
fi

echo ""
echo "=== 3. 查看 Graph 关系记忆 ==="
curl -s "http://127.0.0.1:3001/api/user/profile/$USER_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); g=d.get('data',{}).get('memory_layers',{}).get('l2_graph',{}); print('relations:', len(g.get('relations',[]))); [print(r) for r in g.get('relations',[])[:5]]" 2>/dev/null || curl -s "http://127.0.0.1:3001/api/user/profile/$USER_ID"
