const assert = require('assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const post = server.slice(
  server.indexOf("app.post('/api/english/daily-extract'"),
  server.indexOf('async function runDailyExtractAsync')
);
assert.match(post, /taskQueue\.createTask\(\s*['"]daily_extract['"]/, '创建时必须登记 taskQueue');
assert.match(post, /presentation:\s*['"]路演汇报['"]/, 'presentation 必须显示为路演汇报');
assert.match(post, /长文生成｜\$\{genreLabel\}｜\$\{cefrLevel\}｜\$\{duration\}分钟/, '标题必须展示前台选择条件');
assert.match(post, /const generationConditions = \{[\s\S]*genreLabel[\s\S]*cefrLevel[\s\S]*duration/, '任务必须保存条件快照');
assert.match(post, /res\.json\(\{[\s\S]*taskId/, '必须返回 taskId');

const runAsync = server.slice(
  server.indexOf('async function runDailyExtractAsync'),
  server.indexOf('async function runDailyExtractAsync') + 90000
);
assert.match(runAsync, /taskQueue\.updateTask/, 'worker 必须更新 taskQueue');
assert.match(runAsync, /status:\s*['"]completed['"]/, '完成态必须回写');
assert.match(runAsync, /status:\s*['"]failed['"]/, '失败态必须回写');

const dashboard = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'modules', 'english', 'tabs', 'DashboardTab.tsx'), 'utf8');
assert.match(dashboard, /name: `长文生成｜\$\{genreLabel\}｜\$\{cefrLevel\}｜\$\{duration\}分钟`/, '前台任务标题必须与后台格式一致');
assert.match(dashboard, /generationConditions,/, '前台任务必须携带条件快照');

const taskCenter = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'GlobalTaskCenter.tsx'), 'utf8');
assert.match(taskCenter, /提交条件：\{task\.generationConditions \? '与前台一致' : '无法核验'\}/, '任务中心必须明确条件核验状态');
console.log('✅ dailyExtractTaskQueueContract.test.js 通过');
