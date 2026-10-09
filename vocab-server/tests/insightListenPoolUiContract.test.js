const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('ListenModule 进页/刷新只走日池，刷尽进任务中心', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../../src/components/modules/ListenModule.tsx'),
    'utf8',
  );
  assert.match(src, /fetchInsightCasePool/);
  assert.match(src, /submitInsightCaseBackfill/);
  assert.match(src, /后台生成中，请稍后在任务中心查看/);
  assert.match(src, /nextInsightPoolAction/);
  assert.match(src, /backfillLockRef/);
  assert.match(src, /backfillLockRef\.current\[category\]/);
  assert.match(src, /loadGenRef/);
  assert.match(src, /loadNewScenarioRef/);
  assert.match(src, /type: 'insight_case_backfill'/);
  assert.match(src, /addTask\(/);
  assert.doesNotMatch(src, /fetchDynamicInsightScenario/);
});

test('前端 API 与任务类型已接日池', () => {
  const api = fs.readFileSync(path.join(__dirname, '../../src/services/difyAPI.ts'), 'utf8');
  const ctx = fs.readFileSync(path.join(__dirname, '../../src/components/TaskContext.tsx'), 'utf8');
  assert.match(api, /\/api\/insight\/listen\/pool/);
  assert.match(api, /pool\/backfill/);
  assert.match(ctx, /insight_case_backfill/);
  assert.match(ctx, /insight_daily_cron/);
});
