const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function testGameTheoryRoundStreamContract() {
  console.log('=== 测试：驭心博弈沙盘 SSE 流式通道与业务语言日志契约 ===');

  const serverPath = path.join(__dirname, '..', 'server.js');
  assert.ok(fs.existsSync(serverPath), 'server.js 必须存在');
  const serverContent = fs.readFileSync(serverPath, 'utf8');

  // 1. 验证 /api/game-theory/session/:sessionId/round 路由及流式设置
  assert.ok(serverContent.includes("app.post('/api/game-theory/session/:sessionId/round'"), '必须包含博弈轮次推演路由');
  assert.ok(serverContent.includes("res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');"), '流式模式必须设置 text/event-stream 头部');
  assert.ok(serverContent.includes("res.setHeader('X-Accel-Buffering', 'no');"), '必须设置 X-Accel-Buffering: no 禁止 Nginx 缓冲');

  // 2. 验证业务语言日志
  assert.ok(serverContent.includes('[博弈推演] 正在启动博弈沙盘对抗推演'), '必须包含业务化推演启动日志');
  assert.ok(serverContent.includes('[博弈推演] 本轮博弈对抗推演流式输出完成'), '必须包含业务化流式完成日志');
  assert.ok(serverContent.includes('[博弈容灾] 博弈沙盘推演发生异常'), '必须包含业务化容灾日志');

  // 3. 验证 gameTheorySessionService.js 支持流式及 onChunk
  const servicePath = path.join(__dirname, '..', 'services', 'gameTheorySessionService.js');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  assert.ok(serviceContent.includes("responseMode: 'streaming'"), '必须支持 Dify streaming 响应模式');
  assert.ok(serviceContent.includes('if (onChunk) onChunk(value);'), '必须支持 onChunk 实时数据回调');

  console.log('✅ gameTheoryRoundStream.test.js 所有博弈沙盘流式与业务日志契约测试通过！');
}

testGameTheoryRoundStreamContract().catch((err) => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
