const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readWithIdleTimeout, resolveDifyStreamIdleTimeout } = require('../services/streamIdleTimeout');
const { resolveListenDurations } = require('../services/dailyListenPreGenerateService');

async function main() {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const extractStart = server.indexOf('async function runDailyExtractAsync');
  const extractEnd = server.indexOf("app.post('/api/english/login'", extractStart);
  const extract = server.slice(extractStart, extractEnd);
  const listen = server.slice(server.indexOf('async function generateListenLongScriptSync'), server.indexOf('async function generateListenLongScriptSync') + 5000);

  assert.ok(extractStart >= 0, '应存在后台长文生成函数');
  for (const source of [extract, listen]) {
    assert.match(source, /collectDifyStreamingAnswer\(wfResponse, \{ sanitize: false, longArticle: true \}\)/, '两条长文路径都应启用长文超时');
  }
  assert.match(extract, /DIFY_LONG_ARTICLE_MAX_ATTEMPTS/, '后台长文应支持瞬时流错误重试');
  assert.match(extract, /stream idle timeout/i, '应保留空闲超时重试');

  const keys = ['DIFY_STREAM_IDLE_TIMEOUT_MS', 'DIFY_LONG_ARTICLE_STREAM_IDLE_TIMEOUT_MS'];
  const original = keys.map(key => process.env[key]);
  try {
    keys.forEach(key => delete process.env[key]);
    assert.strictEqual(resolveDifyStreamIdleTimeout(), 120000);
    assert.strictEqual(resolveDifyStreamIdleTimeout({ longArticle: true }), 300000);
    process.env[keys[0]] = '180000';
    assert.strictEqual(resolveDifyStreamIdleTimeout({ longArticle: true }), 180000);
    process.env[keys[1]] = '600000';
    assert.strictEqual(resolveDifyStreamIdleTimeout({ longArticle: true }), 600000);
    assert.strictEqual(resolveDifyStreamIdleTimeout(), 180000);
    assert.strictEqual(resolveDifyStreamIdleTimeout({ longArticle: true, idleTimeoutMs: 50 }), 50);
    for (const value of ['invalid', '0', '-1', 'Infinity', '2147483648', '1.5']) {
      process.env[keys[1]] = value;
      assert.strictEqual(resolveDifyStreamIdleTimeout({ longArticle: true }), 180000);
      process.env[keys[0]] = value;
      assert.strictEqual(resolveDifyStreamIdleTimeout({ longArticle: true }), 300000);
      process.env[keys[0]] = '180000';
    }
  } finally {
    keys.forEach((key, index) => original[index] === undefined ? delete process.env[key] : process.env[key] = original[index]);
  }

  let cancelled = false;
  let returned = false;
  const stalled = {
    [Symbol.asyncIterator]() { return this; },
    next() { return new Promise(() => {}); },
    return() { returned = true; return new Promise(() => {}); },
  };
  let watchdog;
  try {
    await Promise.race([
      assert.rejects(async () => {
        for await (const chunk of readWithIdleTimeout(stalled, {
          idleTimeoutMs: 10,
          onTimeout() { cancelled = true; },
        })) {}
      }, /stream idle timeout after 10ms/),
      new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error('超时清理阻塞重试')), 200); }),
    ]);
  } finally { clearTimeout(watchdog); }
  assert.ok(cancelled && returned, '超时应取消底层请求并清理迭代器');

  const cron = fs.readFileSync(path.join(__dirname, '..', 'services', 'dailyPackCron.js'), 'utf8');
  assert.deepStrictEqual(resolveListenDurations({ source: 'cron' }), [1]);
  assert.match(cron, /combos\.push\(\{ genre, cefrLevel, duration: 1 \}\)/, '每日 Cron 只能自动生成 1 分钟长文');
  assert.doesNotMatch(cron, /4体裁 x 4等级 x 4时长 = 64/);
  console.log('dailyLongArticleReliabilityContract.test.js passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
