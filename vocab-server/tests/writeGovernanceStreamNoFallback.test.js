const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function testWriteGovernanceStreamContract() {
  console.log('=== 测试：文治公文批改 SSE 流式通道、业务语言日志与严禁降级契约 ===');

  const serverPath = path.join(__dirname, '..', 'server.js');
  assert.ok(fs.existsSync(serverPath), 'server.js 必须存在');
  const serverContent = fs.readFileSync(serverPath, 'utf8');

  // 1. 验证 write-governance 路由及流式模式
  assert.ok(serverContent.includes("app.post('/api/english/write-governance'"), '必须包含 /api/english/write-governance 路由');
  assert.ok(serverContent.includes("res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');"), '流式模式必须设置 text/event-stream');
  assert.ok(serverContent.includes("res.setHeader('X-Accel-Buffering', 'no');"), '必须设置 X-Accel-Buffering: no 禁止 Nginx 缓冲');

  // 2. 验证严格禁止降级（handleWriteGovernanceWorkflow 函数内不得包含 llm_fallback 或 analyzeWriting）
  const startIdx = serverContent.indexOf('async function handleWriteGovernanceWorkflow');
  const endIdx = serverContent.indexOf('app.post(\'/api/vocab/purify\'', startIdx);
  const fnBody = serverContent.substring(startIdx, endIdx);

  assert.ok(!fnBody.includes('llm_fallback'), '严禁在 handleWriteGovernanceWorkflow 中使用 llm_fallback 降级');
  assert.ok(!fnBody.includes('analyzeWriting('), '严禁在 handleWriteGovernanceWorkflow 中调用本地低参数大模型 analyzeWriting 降级');
  assert.ok(!fnBody.includes('WRITE_GOVERNANCE_LLM_API_KEY'), '严禁读取本地写作备用 LLM key');

  // 3. 验证业务语言日志
  assert.ok(serverContent.includes('[公文批改] 正在启动深度公文批改与润色分析'), '必须包含业务化启动日志');
  assert.ok(serverContent.includes('[公文批改] 收到首批专家批改建议，正在持续流式呈现...'), '必须包含业务化流式推送日志');
  assert.ok(serverContent.includes('[公文批改] 深度公文批改与润色分析流式输出完成'), '必须包含业务化完成日志');
  assert.ok(serverContent.includes('[公文容灾]'), '必须包含业务化容灾日志');

  // 4. 验证 englishWorkflowProxy.js 支持 streaming rawResponse
  const proxyPath = path.join(__dirname, '..', 'services', 'englishWorkflowProxy.js');
  const proxyContent = fs.readFileSync(proxyPath, 'utf8');
  assert.ok(proxyContent.includes("responseMode === 'streaming'"), 'englishWorkflowProxy.js 必须支持 streaming 响应返回');

  console.log('✅ writeGovernanceStreamNoFallback.test.js 所有流式与严禁降级契约测试通过！');
}

testWriteGovernanceStreamContract().catch((err) => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
