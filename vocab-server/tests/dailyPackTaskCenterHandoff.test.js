const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const server = read('vocab-server/server.js');
const regenStart = server.indexOf("app.post('/api/daily-pack/regenerate'");
assert.ok(regenStart >= 0, '必须有 /api/daily-pack/regenerate');
const regen = server.slice(regenStart, server.indexOf("app.post('/api/daily-pack/cron-run'"));

assert.match(regen, /taskQueue\.createTask\(\s*['"]daily_pack['"]/, '刷新今日包必须登记任务中心');
assert.match(regen, /taskId/, '必须把 taskId 回给前端');
assert.match(regen, /status:\s*['"]completed['"]/, '成功必须回写 taskQueue completed');
assert.match(regen, /status:\s*['"]failed['"]/, '失败必须回写 taskQueue failed');

const api = read('src/services/dailyPackAPI.ts');
assert.match(api, /DAILY_PACK_RACE_MS\s*=\s*3000/, '3 秒竞速阈值');
assert.doesNotMatch(
  api.slice(api.indexOf('export async function regenerateDailyPack'), api.indexOf('export async function regenerateDailyPack') + 1200),
  /pollTodayUntilSettled/,
  'regenerate 不得在 API 层空等 180 秒',
);

const wakeup = read('src/components/modules/DailyWakeupModule.tsx');
assert.match(wakeup, /DAILY_PACK_RACE_MS/, '唤醒刷新必须走 3 秒竞速');
assert.match(wakeup, /addTask/, '超时必须写入任务中心');
assert.match(wakeup, /notifyBackgroundHandoff/, '超时必须提醒');
assert.match(wakeup, /任务中心/, '提醒文案必须指向任务中心');

const flaw = read('src/components/modules/DailyErrorVocabularyModule.tsx');
assert.match(flaw, /DAILY_PACK_RACE_MS/, '破绽刷新同样 3 秒竞速');
assert.match(flaw, /addTask/, '破绽超时必须写入任务中心');
assert.match(flaw, /notifyBackgroundHandoff/, '破绽超时必须提醒');

const taskType = read('src/components/TaskContext.tsx');
assert.match(taskType, /daily_pack/, 'TaskItem 必须支持 daily_pack');

console.log('✅ dailyPackTaskCenterHandoff.test.js 通过');
