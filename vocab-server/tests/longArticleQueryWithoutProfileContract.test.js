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
assert.match(getter, /主题先精确，未命中再回退今日同组合/, '主题未命中时必须回退今日同组合长文');
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
assert.match(yml, /Keep the theme title unchanged|Do NOT change the theme/, '生成时不得改写主题标题');
assert.match(yml, /MAY be empty|允许为空/, '画像必须允许为空');
assert.match(yml, /OUTPUT MUST MEET DURATION \(HARD\)|LENGTH HARD CONSTRAINT/, '必须硬约束成稿满足时长');
assert.match(yml, /PROFILE RELEVANCE \(WHEN PRESENT\)|PROFILE RULE \(HARD when present\)/, '有画像时必须贴合画像');
assert.match(yml, /If profile is EMPTY|If the profile is EMPTY/, '画像为空时不得虚构个人画像');
assert.doesNotMatch(yml, /title: 校验 duration\+画像/, '不得再用字段非空硬门代码节点');
assert.doesNotMatch(yml, /id: answer_reject/, '不得再因画像为空拒绝生成');
assert.match(yml, /1780382595776-source-1780385608087-target/, '开始节点应直连变量赋值进入生成');

console.log('✅ longArticleQueryWithoutProfileContract.test.js 通过');
