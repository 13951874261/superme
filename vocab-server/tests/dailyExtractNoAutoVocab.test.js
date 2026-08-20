const assert = require('assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

const runAsyncStart = server.indexOf('async function runDailyExtractAsync');
assert.ok(runAsyncStart >= 0, '找不到 runDailyExtractAsync');

// 切到下一顶层 app. 路由（避免吃进后续 handler）
const nextApp = server.indexOf('\napp.', runAsyncStart + 1);
const runAsyncEnd = nextApp > runAsyncStart ? nextApp : runAsyncStart + 80000;
const runAsync = server.slice(runAsyncStart, runAsyncEnd);

assert.ok(
  !/INSERT INTO vocabulary[\s\S]{0,200}?ai_extracted/.test(runAsync) ||
    !/source: 'Daily Extract'/.test(runAsync),
  'runDailyExtractAsync 不得再以 Daily Extract 写入 vocabulary'
);
// 更硬：在 runDailyExtractAsync 函数体内禁止出现对 vocabulary 的 INSERT
const insertVocabInFn = (runAsync.match(/INSERT INTO vocabulary/g) || []).length;
assert.strictEqual(insertVocabInFn, 0, 'runDailyExtractAsync 内不得 INSERT vocabulary');

const postExtractStart = server.indexOf("app.post('/api/english/daily-extract'");
assert.ok(postExtractStart >= 0, '找不到 POST /api/english/daily-extract');
const postExtract = server.slice(postExtractStart, runAsyncStart);
assert.ok(
  !/wordsLeft <= 0 && phrasesLeft <= 0/.test(postExtract) ||
    /\/\/ SPEC: quota gate removed for generate/.test(postExtract),
  '生成入口不得因入库配额耗尽直接拒绝长文生成'
);

assert.match(runAsync, /wordsAddedCount\s*=\s*0/, '自动路径 wordsAddedCount 应为 0');
assert.match(runAsync, /phrasesAddedCount\s*=\s*0/, '自动路径 phrasesAddedCount 应为 0');
assert.match(runAsync, /sentencesAddedCount\s*=\s*0/, '自动路径 sentencesAddedCount 应为 0');

console.log('✅ dailyExtractNoAutoVocab.test.js 通过');
