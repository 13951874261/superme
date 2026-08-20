const assert = require('assert');
const fs = require('fs');
const path = require('path');

function testFailedSnapshotWakeupUsesDedupe() {
  console.log('=== 测试：失败步骤重跑唤醒旁路必须走去重生成 ===');
  const serverPath = path.join(__dirname, '..', 'server.js');
  const content = fs.readFileSync(serverPath, 'utf8');

  // 定位 failed_snapshot 唤醒分支：应调用 generateWakeupVocabForUser，且不再直接 callWakeupWorkflow
  const marker = '失败步骤重跑：唤醒也走与手动刷新同一套去重';
  assert.ok(content.includes(marker), '必须包含失败重跑去重注释标记');

  const idx = content.indexOf(marker);
  assert.ok(idx > 0, '标记位置应可定位');
  const window = content.slice(idx, idx + 1200);

  assert.ok(
    window.includes('generateWakeupVocabForUser'),
    'failed_snapshot 唤醒分支必须调用 generateWakeupVocabForUser',
  );
  assert.ok(
    !window.includes('callWakeupWorkflow({'),
    'failed_snapshot 唤醒分支不得再直接调用 callWakeupWorkflow',
  );
  assert.ok(
    window.includes('upsertDailyPack'),
    '重跑生成结果必须写回 daily_packs，避免只记账不落库',
  );

  console.log('✅ failedSnapshotWakeupDedupe.test.js 通过');
}

try {
  testFailedSnapshotWakeupUsesDedupe();
} catch (err) {
  console.error('❌ 测试失败:', err);
  process.exit(1);
}
