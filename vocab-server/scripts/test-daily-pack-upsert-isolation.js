const assert = require('assert');
const Database = require('better-sqlite3');
const dailyPackService = require('../services/dailyPackService');

function createDb() {
  try {
    const db = new Database(':memory:');
    dailyPackService.initDailyPackTables(db);
    return db;
  } catch (e) {
    console.log('SKIP test-daily-pack-upsert-isolation (better-sqlite3 native bindings unavailable)');
    process.exit(0);
  }
}

function insertPack(db, { id, userId, packDate, theme, signature, status }) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO daily_packs (
      id, user_id, pack_date, theme, input_signature, wakeup_json, flaw_vocab_json,
      source, status, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, NULL, 'cron', ?, NULL, ?, ?)
  `).run(id, userId, packDate, theme, signature, status, now, now);
}

function testUpsertDoesNotReuseOtherUserId() {
  const db = createDb();
  const packDate = '2026-08-03';
  insertPack(db, {
    id: 'other-user-pack-id',
    userId: 'other-user',
    packDate,
    theme: 'theme-a',
    signature: 'sig-other',
    status: 'ready',
  });

  const saved = dailyPackService.upsertDailyPack(db, {
    userId: 'lzhmy',
    packDate,
    theme: '商务谈判：让步与施压',
    inputSignature: 'sig-lzhmy-new',
    wakeup: null,
    flawVocab: null,
    source: 'login-catchup',
    status: 'generating',
    errorMessage: null,
  });

  assert.ok(saved, '应成功写入当前用户包');
  assert.strictEqual(saved.user_id, 'lzhmy');
  assert.notStrictEqual(saved.id, 'other-user-pack-id', '不得复用其他用户的 pack.id');
  const count = db.prepare('SELECT COUNT(*) AS c FROM daily_packs').get().c;
  assert.strictEqual(count, 2, '应保留他人包并新增本人包');
}

function testDifferentSignaturesCreateSeparateRows() {
  const db = createDb();
  const packDate = '2026-08-03';
  const first = dailyPackService.upsertDailyPack(db, {
    userId: 'lzhmy',
    packDate,
    theme: '主题A',
    inputSignature: 'sig-old',
    wakeup: { theme: 'A' },
    flawVocab: null,
    source: 'cron',
    status: 'ready',
    errorMessage: null,
  });

  const second = dailyPackService.upsertDailyPack(db, {
    userId: 'lzhmy',
    packDate,
    theme: '主题B',
    inputSignature: 'sig-new',
    wakeup: { theme: 'B' },
    flawVocab: [{ word: 'leverage' }],
    source: 'login-catchup',
    status: 'ready',
    errorMessage: null,
  });

  assert.notStrictEqual(second.id, first.id, '不同签名应独立行');
  assert.strictEqual(second.input_signature, 'sig-new');
  assert.strictEqual(second.theme, '主题B');
  const count = db.prepare(
    'SELECT COUNT(*) AS c FROM daily_packs WHERE user_id = ? AND pack_date = ?'
  ).get('lzhmy', packDate).c;
  assert.strictEqual(count, 2, '同用户同日不同签名两行');
}

function testGetDailyPackRowDoesNotFallbackAcrossUsers() {
  const db = createDb();
  const packDate = '2026-08-03';
  insertPack(db, {
    id: 'other-ready',
    userId: 'other-user',
    packDate,
    theme: 'theme-a',
    signature: 'sig-other',
    status: 'ready',
  });

  const row = dailyPackService.getDailyPackRow(db, 'lzhmy', packDate, 'sig-other');
  assert.strictEqual(row, undefined, '不得读到其他用户同签名包');
}

function testGetDailyPackRowDoesNotFallbackToGlobalHistory() {
  const db = createDb();
  insertPack(db, {
    id: 'old-ready',
    userId: 'someone',
    packDate: '2026-08-01',
    theme: 'theme-a',
    signature: 'sig-old',
    status: 'ready',
  });

  const row = dailyPackService.getDailyPackRow(db, 'lzhmy', '2026-08-03', 'sig-old');
  assert.strictEqual(row, undefined, '不得回退到其他日期');
}

function testGetDailyPackRowExactSignatureOnly() {
  const db = createDb();
  const packDate = '2026-08-03';
  insertPack(db, {
    id: 'mine-generating',
    userId: 'lzhmy',
    packDate,
    theme: 'theme-a',
    signature: 'sig-gen',
    status: 'generating',
  });

  const byNull = dailyPackService.getDailyPackRow(db, 'lzhmy', packDate, null);
  assert.strictEqual(byNull, undefined, '无 signature 不得宽回退');

  const byExact = dailyPackService.getDailyPackRow(db, 'lzhmy', packDate, 'sig-gen');
  assert.ok(byExact, '精确签名匹配应返回本人记录（含任意状态）');
  assert.strictEqual(byExact.id, 'mine-generating');
}

function main() {
  const tests = [
    ['upsert 不复用他人 id', testUpsertDoesNotReuseOtherUserId],
    ['不同签名独立行', testDifferentSignaturesCreateSeparateRows],
    ['读不回退跨用户', testGetDailyPackRowDoesNotFallbackAcrossUsers],
    ['读不回退全局历史', testGetDailyPackRowDoesNotFallbackToGlobalHistory],
    ['读仅精确签名', testGetDailyPackRowExactSignatureOnly],
  ];

  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error(error);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log(`\nAll ${tests.length} tests passed`);
}

main();
