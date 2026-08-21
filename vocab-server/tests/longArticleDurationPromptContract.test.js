const assert = require('assert');
const fs = require('fs');
const path = require('path');

const yml = fs.readFileSync(
  path.join(__dirname, '..', '..', 'yml', 'materail_generate_url_enhanced.yml'),
  'utf8',
);
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const pack = fs.readFileSync(path.join(__dirname, '..', 'services', 'dailyPackService.js'), 'utf8');
const cron = fs.readFileSync(path.join(__dirname, '..', 'services', 'dailyPackCron.js'), 'utf8');
const difyApi = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'services', 'difyAPI.ts'),
  'utf8',
);

assert.match(yml, /variable:\s*duration/, '开始节点必须声明 duration');
assert.match(yml, /{{#1780382595776\.duration#}}/, '大纲/扩写必须引用开始节点 duration');
assert.match(yml, /EXACTLY 1 segment/, '方案 B：1 分钟必须恰好 1 段');
assert.match(yml, /EXACTLY 3 segment/, '方案 B：15 分钟必须恰好 3 段');
assert.match(yml, /EXACTLY 5 chapter/, '方案 B：25 分钟必须恰好 5 段');
assert.match(yml, /EXACTLY 7 independent segment/, '方案 B：35 分钟必须恰好 7 段');
assert.match(yml, /100-150/, '方案 B：1 分钟 100-150 词');
assert.match(yml, /1950-2400/, '方案 B：15 分钟总词数 1950-2400');
assert.match(yml, /3250-4000/, '方案 B：25 分钟总词数 3250-4000');
assert.match(yml, /4550-5600/, '方案 B：35 分钟总词数 4550-5600');
assert.match(yml, /650-800 words/, '方案 B：15/25/35 每段 650-800 词');
assert.doesNotMatch(yml, /Plan 6-8 independent/, '不得再按题材写死 6-8 段');
assert.doesNotMatch(yml, /Minimum 600 words for audio genres/, '扩写不得再写死每段最少 600 词');
assert.match(yml, /exactly 50 items/, '本次不改 LLM3：仍抽 50 词');
assert.match(yml, /exactly 30 items/, '本次不改 LLM3：仍抽 30 短语');

const runAsyncStart = server.indexOf('async function runDailyExtractAsync');
assert.ok(runAsyncStart >= 0, '找不到 runDailyExtractAsync');
const nextApp = server.indexOf('\napp.', runAsyncStart + 1);
const runAsync = server.slice(runAsyncStart, nextApp > runAsyncStart ? nextApp : runAsyncStart + 80000);
assert.match(runAsync, /duration:\s*String\(duration\)/, '前台 daily-extract 调 Dify 必须传入 duration');

const genFn = pack.slice(
  pack.indexOf('async function generateLongArticleForUser'),
  pack.indexOf('module.exports'),
);
assert.match(genFn, /duration:\s*String\(duration\)/, '后台长文任务调 daily-extract 必须传入 duration');
assert.match(cron, /String\(duration\)/, 'cron 64 套必须把 duration 传给 generateLongArticleForUser');

const startFn = difyApi.slice(
  difyApi.indexOf('export async function startEnglishMasteryExtraction'),
  difyApi.indexOf('export async function pollEnglishMasteryExtractionOnce'),
);
assert.match(startFn, /duration: '1' \| '15' \| '25' \| '35'/, '前台类型必须包含 1 分钟');
assert.match(startFn, /^\s*duration,$/m, '前台 POST body 必须带 duration 字段');

console.log('✅ longArticleDurationPromptContract.test.js 通过');
