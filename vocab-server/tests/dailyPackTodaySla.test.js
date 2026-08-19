const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function testDailyPackTodayContract() {
  console.log('=== 测试：首页唤醒包读缓存与业务语言日志契约 ===');

  const serverPath = path.join(__dirname, '..', 'server.js');
  assert.ok(fs.existsSync(serverPath), 'server.js 必须存在');
  const serverContent = fs.readFileSync(serverPath, 'utf8');

  // 1. 验证 /api/daily-pack/today 路由
  assert.ok(serverContent.includes("app.get('/api/daily-pack/today'"), '必须包含 /api/daily-pack/today 路由');
  assert.ok(serverContent.includes('dailyPackService.getDailyPackRow(db, u, packDate, inputSignature, theme)'), '必须从 SQLite 缓存读取，禁止同步调用 LLM');

  // 2. 验证业务语言日志
  assert.ok(serverContent.includes('[每日唤醒] 成功命中学员专属晨间预生成训练包'), '必须包含业务化命中日志');
  assert.ok(serverContent.includes('[每日唤醒] 今日训练包当前状态为'), '必须包含业务化状态日志');
  assert.ok(serverContent.includes('[每日唤醒] 读取今日训练包发生异常:'), '必须包含业务化异常日志');

  // 3. 验证前端防白屏与业务语言提示（本地开发环境存在源码时核验）
  const modulePath = path.join(__dirname, '..', '..', 'src', 'components', 'modules', 'DailyWakeupModule.tsx');
  if (fs.existsSync(modulePath)) {
    const moduleContent = fs.readFileSync(modulePath, 'utf8');
    assert.ok(moduleContent.includes('正在为您智能定制今日专属唤醒训练...'), '必须包含业务化生成提示');
    assert.ok(moduleContent.includes('今日唤醒包正在后台加速准备，您可先在生词本或听力模块进行热身'), '必须包含防白屏兜底引导文案');
  }

  console.log('✅ dailyPackTodaySla.test.js 所有今日包读缓存与业务日志契约测试通过！');
}

testDailyPackTodayContract().catch((err) => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
