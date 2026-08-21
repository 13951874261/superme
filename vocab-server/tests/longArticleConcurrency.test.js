const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  resolveLongArticleConcurrency,
  mapPool,
} = require('../services/dailyPackCron');

function testDefaultConcurrencyIsThree() {
  const prev = process.env.DAILY_LONG_ARTICLE_CONCURRENCY;
  delete process.env.DAILY_LONG_ARTICLE_CONCURRENCY;
  try {
    assert.strictEqual(resolveLongArticleConcurrency(), 3);
  } finally {
    if (prev === undefined) delete process.env.DAILY_LONG_ARTICLE_CONCURRENCY;
    else process.env.DAILY_LONG_ARTICLE_CONCURRENCY = prev;
  }
  console.log('OK default concurrency = 3');
}

function testConcurrencyCappedAtFour() {
  const prev = process.env.DAILY_LONG_ARTICLE_CONCURRENCY;
  process.env.DAILY_LONG_ARTICLE_CONCURRENCY = '99';
  try {
    assert.strictEqual(resolveLongArticleConcurrency(), 4);
  } finally {
    if (prev === undefined) delete process.env.DAILY_LONG_ARTICLE_CONCURRENCY;
    else process.env.DAILY_LONG_ARTICLE_CONCURRENCY = prev;
  }
  console.log('OK concurrency cap = 4');
}

async function testMapPoolHonorsConcurrency() {
  const seen = [];
  let inFlight = 0;
  let maxInFlight = 0;
  await mapPool([1, 2, 3, 4, 5, 6], 3, async (n) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    seen.push(n);
    await new Promise((r) => setTimeout(r, 20));
    inFlight -= 1;
    return n;
  });
  assert.deepStrictEqual(seen.sort(), [1, 2, 3, 4, 5, 6]);
  assert.ok(maxInFlight <= 3, `maxInFlight=${maxInFlight} should be <= 3`);
  assert.ok(maxInFlight >= 2, `maxInFlight=${maxInFlight} should actually run in parallel`);
  console.log('OK mapPool concurrency <= 3');
}

function testCronUsesPoolNotSerialSleep() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'dailyPackCron.js'), 'utf8');
  const start = src.indexOf('async function runDailyPackCronJob');
  const end = src.indexOf('function resolveCronHour');
  const fn = src.slice(start, end);
  assert.match(fn, /mapPool\(/, '64 套长文必须走 mapPool');
  assert.match(fn, /resolveLongArticleConcurrency\(/, '必须按服务器配置解析并发');
  assert.doesNotMatch(
    fn,
    /await new Promise\(r => setTimeout\(r, 1500\)\)/,
    '不得再对每套长文串行 sleep 1500ms',
  );
  console.log('OK cron long_article uses pool');
}

(async () => {
  testDefaultConcurrencyIsThree();
  testConcurrencyCappedAtFour();
  await testMapPoolHonorsConcurrency();
  testCronUsesPoolNotSerialSleep();
  console.log('✅ longArticleConcurrency.test.js 通过');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
