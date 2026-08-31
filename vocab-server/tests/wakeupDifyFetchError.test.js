const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dailyPackService = require('../services/dailyPackService');

function testFormatNeverLeaksFetchFailed() {
  console.log('=== 1. fetch failed 必须转成中文用户文案 ===');
  assert.equal(typeof dailyPackService.formatWakeupDifyFetchError, 'function');

  const err = new TypeError('fetch failed');
  err.cause = { code: 'ECONNRESET', message: 'read ECONNRESET' };
  const msg = dailyPackService.formatWakeupDifyFetchError(err);
  assert.ok(msg && !/fetch failed/i.test(msg), `不得出现 fetch failed，实际: ${msg}`);
  assert.match(msg, /唤醒服务暂时连不上/);
  assert.match(msg, /立即生成/);

  const browser = dailyPackService.formatWakeupDifyFetchError(new TypeError('Failed to fetch'));
  assert.ok(!/Failed to fetch/i.test(browser));
  assert.match(browser, /唤醒服务暂时连不上/);

  const biz = dailyPackService.formatWakeupDifyFetchError(new Error('Dify HTTP 401'));
  assert.strictEqual(biz, 'Dify HTTP 401');
}

function testSerializeSanitizesCachedFetchFailed() {
  console.log('=== 2. 已落库的 fetch failed 读出时也要中文化 ===');
  const pack = dailyPackService.serializeDailyPack({
    pack_date: '2026-08-31',
    theme: '商务谈判：让步与施压',
    status: 'failed',
    source: 'manual',
    error_message: 'fetch failed',
    wakeup_json: null,
    flaw_vocab_json: null,
  }, '商务谈判：让步与施压');
  assert.ok(pack.errorMessage && !/fetch failed/i.test(pack.errorMessage), pack.errorMessage);
  assert.match(pack.errorMessage, /唤醒服务暂时连不上/);
}

async function testCallWakeupRetriesTransientThenSucceeds() {
  console.log('=== 3. 瞬时 fetch failed 必须自动重试一次 ===');
  const originalFetch = global.fetch;
  let attempts = 0;
  const payload = {
    theme: '商务谈判：让步与施压',
    vocab: [],
    grammar: { point: 'p', explanation: 'e', examples: [] },
  };
  global.fetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      const err = new TypeError('fetch failed');
      err.cause = { code: 'ECONNRESET' };
      throw err;
    }
    return {
      ok: true,
      json: async () => ({ data: { outputs: { wakeup_json: JSON.stringify(payload) } } }),
    };
  };
  const prevKey = process.env.DIFY_WAKEUP_API_KEY;
  const prevRetry = process.env.WAKEUP_DIFY_RETRY_MS;
  process.env.DIFY_WAKEUP_API_KEY = 'test-key';
  process.env.WAKEUP_DIFY_RETRY_MS = '0';
  try {
    const parsed = await dailyPackService.callWakeupWorkflow({
      theme: payload.theme,
      userId: 'lzhumy',
    });
    assert.strictEqual(attempts, 2);
    assert.strictEqual(parsed.theme, payload.theme);
  } finally {
    global.fetch = originalFetch;
    process.env.DIFY_WAKEUP_API_KEY = prevKey;
    process.env.WAKEUP_DIFY_RETRY_MS = prevRetry;
  }
}

function testFrontendMapsFetchFailed() {
  console.log('=== 4. 前端不得把 fetch failed 原文展示给用户 ===');
  const api = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'services', 'dailyPackAPI.ts'), 'utf8');
  assert.match(api, /export function friendlyDailyPackError/);
  assert.match(api, /fetch failed/);
  const wakeup = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'components', 'modules', 'DailyWakeupModule.tsx'),
    'utf8',
  );
  assert.match(wakeup, /friendlyDailyPackError/);
}

async function main() {
  testFormatNeverLeaksFetchFailed();
  testSerializeSanitizesCachedFetchFailed();
  await testCallWakeupRetriesTransientThenSucceeds();
  testFrontendMapsFetchFailed();
  console.log('\n✅ wakeupDifyFetchError.test.js 全部通过');
}

main().catch((err) => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
