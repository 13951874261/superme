const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dify = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'services', 'difyAPI.ts'), 'utf8');
assert.match(dify, /export const DAILY_EXTRACT_RACE_MS = 3000/);
assert.match(dify, /withDailyExtractTimeout/);
assert.match(dify, /triggerEnglishMasteryExtraction/);
assert.ok(
  !/while \(true\) \{\s*await new Promise\(resolve => setTimeout\(resolve, 3000\)\)/.test(dify.replace(/\s+/g, ' ')),
  '不得再无限 while+每3秒轮询阻塞调用方'
);

const dash = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'modules', 'english', 'tabs', 'DashboardTab.tsx'),
  'utf8'
);
assert.match(dash, /withDailyExtractTimeout|DAILY_EXTRACT_RACE_MS/);
assert.match(dash, /已转入后台/);
assert.match(dash, /addTask\(/);
assert.match(dash, /type:\s*['"]daily_extract['"]/);
assert.ok(!dash.includes('预计需 15~30 秒'), '阻塞文案应移除或改为短时反馈');
assert.ok(!/入库 \$\{wordsAddedCount\}/.test(dash), '不得再提示自动入库词数');

console.log('✅ dailyExtractFrontendRaceContract.test.js 通过');
