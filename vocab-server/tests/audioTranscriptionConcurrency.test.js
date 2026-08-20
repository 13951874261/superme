const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function testAudioTranscriptionService() {
  console.log('=== 测试：语音转写并发互斥与业务语言日志契约 ===');

  const filePath = path.join(__dirname, '..', 'services', 'audioTranscriptionService.js');
  assert.ok(fs.existsSync(filePath), 'audioTranscriptionService.js 文件必须存在');

  const content = fs.readFileSync(filePath, 'utf8');

  // 1. 验证并发限制变量
  assert.ok(content.includes('let activeLocalJobs = 0;'), '必须包含 activeLocalJobs 计数器');
  assert.ok(content.includes('const MAX_LOCAL_CONCURRENCY = 1;'), '必须设置 MAX_LOCAL_CONCURRENCY = 1 单并发限制');

  // 2. 验证业务语言日志
  assert.ok(content.includes('[语音识别] 正在通过专属语音引擎解析学员发音音频:'), '必须包含专属语音引擎识别日志');
  assert.ok(content.includes('[语音调度] 专属语音引擎当前正忙，已自动分流至云端智能语音通道加速处理:'), '必须包含并发正忙自动分流业务日志');
  assert.ok(content.includes('[语音容灾] 专属语音引擎'), '必须包含专属语音引擎容灾降级日志');
  assert.ok(content.includes('[发音规整] 正在对识别文本进行口语表达优化与标点还原:'), '必须包含发音表达规整业务日志');

  // 3. 验证无技术生硬术语
  assert.ok(!content.includes('[STT Local]'), '不得包含旧的技术标签 [STT Local]');
  assert.ok(!content.includes('[STT Dify]'), '不得包含旧的技术标签 [STT Dify]');
  assert.ok(!content.includes('[STT Polish]'), '不得包含旧的技术标签 [STT Polish]');

  // 4. 验证并发互斥保护逻辑与 try...finally 释放
  assert.ok(content.includes('activeLocalJobs = Math.max(0, activeLocalJobs - 1);'), '必须在 finally 块中释放 activeLocalJobs');

  console.log('✅ audioTranscriptionConcurrency.test.js 所有业务契约测试通过！');
}

testAudioTranscriptionService().catch((err) => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
