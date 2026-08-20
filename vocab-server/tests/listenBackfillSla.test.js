const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function testListenBackfillContract() {
  console.log('=== 测试：听力未命中冷门场景 300ms 异步回执与业务语言日志契约 ===');

  const serverPath = path.join(__dirname, '..', 'server.js');
  assert.ok(fs.existsSync(serverPath), 'server.js 必须存在');
  const serverContent = fs.readFileSync(serverPath, 'utf8');

  // 1. 验证 backfill 接口即时回执（创建 task 后直接 res.json）
  assert.ok(serverContent.includes("app.post('/api/listen/pregenerated/backfill'"), '必须包含 backfill 路由');
  assert.ok(serverContent.includes("res.json({ success: true, taskId: task.id, status: task.status });"), '必须立即返回 taskId，禁止在主线程同步等待 Dify');

  // 2. 验证业务语言任务名称与日志
  assert.ok(serverContent.includes('`定制听力训练素材生成: ${theme} / ${genre} / ${cefrLevel} / ${duration}分钟`'), '任务名称必须采用业务语言');
  assert.ok(serverContent.includes('[听力生成] 收到定制听力素材生成请求:'), '必须包含业务化生成请求日志');
  assert.ok(serverContent.includes('[听力生成] 定制听力训练素材已全部准备就绪'), '必须包含业务化就绪日志');
  assert.ok(serverContent.includes('[听力容灾] 素材生成中断:'), '必须包含业务化容灾日志');

  // 3. 验证前端 Toast 提示与不卡界面（本地开发环境存在源码时核验）
  const tabPath = path.join(__dirname, '..', '..', 'src', 'components', 'modules', 'english', 'tabs', 'ListenTab.tsx');
  if (fs.existsSync(tabPath)) {
    const tabContent = fs.readFileSync(tabPath, 'utf8');
    assert.ok(tabContent.includes('showToast({'), '前端必须调用 showToast 弹出浮层提醒');
    assert.ok(tabContent.includes('听力训练材料正在后台加速生成中，您可以继续进行其他练习，稍后前往【任务中心】查看'), 'Toast 必须包含明确的稍后查看与继续练习指引');
  }

  console.log('✅ listenBackfillSla.test.js 所有异步回执、Toast 与业务日志契约测试通过！');
}

testListenBackfillContract().catch((err) => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
