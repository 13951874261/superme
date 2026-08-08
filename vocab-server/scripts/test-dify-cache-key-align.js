const assert = require('assert');
const Database = require('better-sqlite3');
const dailyPackService = require('../services/dailyPackService');
const dailyListen = require('../services/dailyListenPreGenerateService');

function createPackDb() {
  const db = new Database(':memory:');
  dailyPackService.initDailyPackTables(db);
  return db;
}

function testDifferentThemeCreatesTwoRows() {
  const db = createPackDb();
  const packDate = '2026-08-03';
  const a = dailyPackService.upsertDailyPack(db, {
    userId: 'lzhmy',
    packDate,
    theme: '主题A',
    inputSignature: dailyPackService.computeInputSignature('主题A', 'w1', 'p1'),
    wakeup: { theme: 'Dify改写A', vocab: [{ word: 'alpha' }] },
    flawVocab: null,
    source: 'cron',
    status: 'ready',
    errorMessage: null,
  });
  const b = dailyPackService.upsertDailyPack(db, {
    userId: 'lzhmy',
    packDate,
    theme: '主题B',
    inputSignature: dailyPackService.computeInputSignature('主题B', 'w1', 'p1'),
    wakeup: { theme: 'Dify改写B', vocab: [{ word: 'beta' }] },
    flawVocab: null,
    source: 'cron',
    status: 'ready',
    errorMessage: null,
  });
  assert.notStrictEqual(a.id, b.id);
  const count = db.prepare(
    'SELECT COUNT(*) AS c FROM daily_packs WHERE user_id=? AND pack_date=?'
  ).get('lzhmy', packDate).c;
  assert.strictEqual(count, 2);
}

function testReadExactSignatureHitAndMiss() {
  const db = createPackDb();
  const packDate = '2026-08-03';
  const theme = '商务谈判：让步与施压';
  const sig = dailyPackService.computeInputSignature(theme, 'collaborate', 'profile');
  dailyPackService.upsertDailyPack(db, {
    userId: 'lzhmy',
    packDate,
    theme,
    inputSignature: sig,
    wakeup: { theme: '商务沟通', vocab: [{ word: 'collaborate' }] },
    flawVocab: [{ word: 'fallacy' }],
    source: 'manual',
    status: 'ready',
    errorMessage: null,
  });

  const hit = dailyPackService.getDailyPackRow(db, 'lzhmy', packDate, sig, theme);
  assert.ok(hit);
  assert.strictEqual(hit.theme, theme, '库内 theme 应为入参主题而非 Dify 输出');

  const miss = dailyPackService.getDailyPackRow(
    db,
    'lzhmy',
    packDate,
    dailyPackService.computeInputSignature('别的主题', 'collaborate', 'profile'),
    '别的主题'
  );
  assert.strictEqual(miss, undefined);

  const nullMiss = dailyPackService.getDailyPackRow(db, 'lzhmy', packDate, null);
  assert.strictEqual(nullMiss, undefined, '无签名不得宽回退');
}

function testListenNoThemeFallback() {
  const db = new Database(':memory:');
  dailyPackService.initDailyPackTables(db);
  dailyListen.initDailyListenTables(db);

  const packDate = '2026-08-03';
  const partsA = dailyListen.comboKeyParts({
    userId: 'lzhmy',
    packDate,
    theme: '主题A',
    genre: 'meeting',
    cefrLevel: 'A2',
    duration: 1,
    historyExclude: 'x',
    userFlaws: '',
    userCurrentProfile: 'p',
  });
  dailyListen.upsertArticle(db, partsA, {
    status: 'ready',
    source: 'cron',
    body_text: 'body-a',
    vocab_json: '[]',
    phrases_json: '[]',
  });

  const partsB = dailyListen.comboKeyParts({
    userId: 'lzhmy',
    packDate,
    theme: '主题B',
    genre: 'meeting',
    cefrLevel: 'A2',
    duration: 1,
    historyExclude: 'x',
    userFlaws: '',
    userCurrentProfile: 'p',
  });
  const miss = dailyListen.getArticleRow(db, partsB);
  assert.strictEqual(miss, undefined, '不同 theme 不得命中');

  const hit = dailyListen.getArticleRow(db, partsA);
  assert.ok(hit);
  assert.strictEqual(hit.body_text, 'body-a');
  assert.ok(hit.input_signature || partsA.inputSignature);
}

function testListenHistoryChangesSignature() {
  const a = dailyPackService.computeListenArticleInputSignature({
    theme: 'T', genre: 'meeting', cefrLevel: 'A2', duration: 1,
    historyExclude: 'a', userFlaws: '', userCurrentProfile: '',
  });
  const b = dailyPackService.computeListenArticleInputSignature({
    theme: 'T', genre: 'meeting', cefrLevel: 'A2', duration: 1,
    historyExclude: 'b', userFlaws: '', userCurrentProfile: '',
  });
  assert.notStrictEqual(a, b);
}

function main() {
  const tests = [
    ['不同 theme 两行 pack', testDifferentThemeCreatesTwoRows],
    ['pack 精确签名读写 + theme 保留入参', testReadExactSignatureHitAndMiss],
    ['listen 无 theme 宽兜底', testListenNoThemeFallback],
    ['listen history 改变签名', testListenHistoryChangesSignature],
  ];
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      fn();
      console.log(`PASS ${name}`);
    } catch (e) {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error(e);
    }
  }
  if (failed) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log(`\nAll ${tests.length} passed`);
}

main();
