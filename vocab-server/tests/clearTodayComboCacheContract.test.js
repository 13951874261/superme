const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const difyApi = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'services', 'difyAPI.ts'),
  'utf8',
);
const dashboard = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'modules', 'english', 'tabs', 'DashboardTab.tsx'),
  'utf8',
);
const arsenal = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'modules', 'english', 'tabs', 'dashboard', 'ArsenalPanel.tsx'),
  'utf8',
);

const clearStart = server.indexOf("app.post('/api/english/clear-today'");
assert.ok(clearStart >= 0, '找不到 POST /api/english/clear-today');
const clearEnd = server.indexOf('\napp.', clearStart + 1);
const clearFn = server.slice(clearStart, clearEnd > clearStart ? clearEnd : clearStart + 12000);

assert.match(clearFn, /getPackDate\(\)/, 'clear-today 必须用业务日年月日，不能只用 UTC ISO');
assert.match(clearFn, /DELETE FROM daily_extracted_articles/, '必须删除当前条件长文缓存');
assert.match(clearFn, /DELETE FROM daily_listen_articles/, '必须删除当前条件听力正文');
assert.match(clearFn, /DELETE FROM daily_listen_audios/, '必须删除当前条件音频记录');
assert.match(clearFn, /unlinkQuiet/, '必须删除对应磁盘文件');
assert.match(clearFn, /theme = \?/, '删除必须带主题');
assert.match(clearFn, /genre = \?/, '删除必须带题材');
assert.match(clearFn, /cefr_level = \?/, '删除必须带难度');
assert.match(clearFn, /duration = \?/, '删除必须带时长');
assert.match(clearFn, /user_id = \?/, '删除必须限定当前登录账号');

const clearApi = difyApi.slice(
  difyApi.indexOf('export async function clearTodayQuotaAndData'),
  difyApi.indexOf('export async function transcribeAudioWithWhisper'),
);
assert.match(clearApi, /genre:/, '前端 clearToday 必须传题材');
assert.match(clearApi, /cefrLevel:/, '前端 clearToday 必须传难度');
assert.match(clearApi, /duration:/, '前端 clearToday 必须传时长');

assert.match(dashboard, /clearTodayQuotaAndData\(getAppUserId\(\), \{/, '重置今日必须带当前条件');
assert.match(dashboard, /genre,/, '重置今日必须传入 genre');
assert.match(dashboard, /cefrLevel,/, '重置今日必须传入 cefrLevel');
assert.match(dashboard, /duration,/, '重置今日必须传入 duration');
assert.match(arsenal, /当前条件下的长文与对应音频/, '确认文案必须说明会删长文与音频');

console.log('✅ clearTodayComboCacheContract.test.js 通过');
