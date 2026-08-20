const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function testOralChatStreamContract() {
  console.log('=== 测试：口语沙盘 SSE 流式通道与业务语言日志契约 ===');

  const serverPath = path.join(__dirname, '..', 'server.js');
  assert.ok(fs.existsSync(serverPath), 'server.js 必须存在');
  const content = fs.readFileSync(serverPath, 'utf8');

  // 1. 验证路由定义及 stream 参数提取
  assert.ok(content.includes("app.post('/api/english/oral/chat'"), '必须包含 /api/english/oral/chat 路由');
  assert.ok(content.includes('const isStream = Boolean(stream === true || stream === \'true\');'), '必须支持 stream: true 解析');

  // 2. 验证 Dify response_mode 动态分流
  assert.ok(content.includes("response_mode: isStream ? 'streaming' : 'blocking'"), '向 Dify 请求必须支持 streaming 与 blocking 动态分流');

  // 3. 验证 SSE 响应头与无缓冲配置
  assert.ok(content.includes("res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');"), '必须配置 text/event-stream 响应头');
  assert.ok(content.includes("res.setHeader('X-Accel-Buffering', 'no');"), '必须设置 X-Accel-Buffering: no 禁止 Nginx 缓冲');

  // 4. 验证业务语言日志
  assert.ok(content.includes('[沙盘推演] 正在启动多角色谈判沙盘对话推演'), '必须包含业务化沙盘启动日志');
  assert.ok(content.includes('[沙盘推演] 收到首段推演思维与发言，正在持续流式呈现...'), '必须包含首段流式呈现业务日志');
  assert.ok(content.includes('[沙盘推演] 本轮多角色沙盘推演流式输出完成'), '必须包含推演完成业务日志');

  // 5. 验证向下兼容分支
  assert.ok(content.includes("console.log('[沙盘推演] 本轮多角色沙盘推演完成 (标准报文)');"), '必须保留非流式标准 JSON 兼容逻辑');

  console.log('✅ oralChatStream.test.js 所有流式契约与业务日志测试通过！');
}

testOralChatStreamContract().catch((err) => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
