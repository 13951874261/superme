const assert = require('assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const post = server.slice(
  server.indexOf("app.post('/api/english/daily-extract'"),
  server.indexOf('async function runDailyExtractAsync')
);
assert.match(post, /taskQueue\.createTask\(\s*['"]daily_extract['"]/, '创建时必须登记 taskQueue');
assert.match(post, /res\.json\(\{[\s\S]*taskId/, '必须返回 taskId');

const runAsync = server.slice(
  server.indexOf('async function runDailyExtractAsync'),
  server.indexOf('async function runDailyExtractAsync') + 90000
);
assert.match(runAsync, /taskQueue\.updateTask/, 'worker 必须更新 taskQueue');
assert.match(runAsync, /status:\s*['"]completed['"]/, '完成态必须回写');
assert.match(runAsync, /status:\s*['"]failed['"]/, '失败态必须回写');
console.log('✅ dailyExtractTaskQueueContract.test.js 通过');
