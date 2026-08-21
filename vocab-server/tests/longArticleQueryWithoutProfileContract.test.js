const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const listen = fs.readFileSync(
  path.join(__dirname, '..', 'services', 'dailyListenPreGenerateService.js'),
  'utf8',
);
const yml = fs.readFileSync(
  path.join(__dirname, '..', '..', 'yml', 'materail_generate_url_enhanced.yml'),
  'utf8',
);

const getStart = server.indexOf('const handleGetDailyExtractArticle');
assert.ok(getStart >= 0, '找不到 handleGetDailyExtractArticle');
const getEnd = server.indexOf("app.get('/api/english/daily-extract/article'", getStart);
const getter = server.slice(getStart, getEnd);

assert.match(getter, /quota_date = \?/, '查长文必须带年月日');
assert.match(getter, /theme = \?/, '查长文必须带主题');
assert.match(getter, /genre = \?/, '查长文必须带题材');
assert.match(getter, /cefr_level = \?/, '查长文必须带难度');
assert.match(getter, /duration = \?/, '查长文必须带时长');
assert.match(getter, /user_id IN/, '查长文必须限定当前登录账号');
assert.doesNotMatch(getter, /COALESCE\(input_signature/, '查询 WHERE 不得用画像签名');
assert.doesNotMatch(getter, /getUserCurrentProfile/, '查询不得读取画像来拼条件');
assert.match(getter, /daily_listen_audios/, '命中长文时必须同时查对应音频');
assert.match(getter, /audioUrl:/, '返回体必须带 audioUrl');

const runStart = server.indexOf('async function runDailyExtractAsync');
const nextApp = server.indexOf('\napp.', runStart + 1);
const runAsync = server.slice(runStart, nextApp > runStart ? nextApp : runStart + 80000);
assert.match(runAsync, /user_current_profile: String\(user_current_profile \|\| dailyPackService\.getUserCurrentProfile/, '生成必须把当前用户画像传给 Dify');
assert.match(runAsync, /theme: topic \|\| "General Business"/, '落库主题必须是原主题，不得把画像拼进 theme');

const getArticle = listen.slice(
  listen.indexOf('function getArticleRow'),
  listen.indexOf('function getAudioRow'),
);
assert.doesNotMatch(getArticle, /input_signature/, '听力正文查询不得带画像签名');
const getAudio = listen.slice(
  listen.indexOf('function getAudioRow'),
  listen.indexOf('function fileOk'),
);
assert.doesNotMatch(getAudio, /input_signature/, '听力音频查询不得带画像签名');

assert.match(yml, /variable:\s*user_current_profile/, '开始节点必须声明 user_current_profile 供生成使用');
assert.match(yml, /{{#1780382595776\.user_current_profile#}}/, '大纲/扩写必须引用用户画像');
assert.match(yml, /Keep the theme title unchanged/, '生成时不得改写主题标题');

console.log('✅ longArticleQueryWithoutProfileContract.test.js 通过');
