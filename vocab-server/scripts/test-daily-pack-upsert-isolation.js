const assert = require('assert');
const Database = require('better-sqlite3');
const dailyPackService = require('../services/dailyPackService');

function createDb() {
  const db = new Database(':memory:');
  dailyPackService.initDailyPackTables(db);
  return db;
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

function testSignatureChangeUpdatesSameUserDayRow() {
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

  assert.strictEqual(second.id, first.id, '同用户同日签名变化应 UPDATE 旧行');
  assert.strictEqual(second.input_signature, 'sig-new');
  assert.strictEqual(second.theme, '主题B');
  const count = db.prepare(
    'SELECT COUNT(*) AS c FROM daily_packs WHERE user_id = ? AND pack_date = ?'
  ).get('lzhmy', packDate).c;
  assert.strictEqual(count, 1, '同用户同日只能保留一行');
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

  const row = dailyPackService.getDailyPackRow(db, 'lzhmy', packDate, null);
  assert.strictEqual(row, undefined, '不得回退到任意用户当天 ready 包');
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

  const row = dailyPackService.getDailyPackRow(db, 'lzhmy', '2026-08-03', 'any-sig');
  assert.strictEqual(row, undefined, '不得回退到全局历史最新 ready 包');
}

function testGetDailyPackRowReturnsCurrentUserReadyOnly() {
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
  assert.strictEqual(byNull, undefined, '无 signature 时只找本人当天 ready，不返回 generating');

  db.prepare("UPDATE daily_packs SET status = 'ready' WHERE id = 'mine-generating'").run();
  const ready = dailyPackService.getDailyPackRow(db, 'lzhmy', packDate, null);
  assert.ok(ready);
  assert.strictEqual(ready.id, 'mine-generating');
  assert.strictEqual(ready.status, 'ready');

  const byExact = dailyPackService.getDailyPackRow(db, 'lzhmy', packDate, 'sig-gen');
  assert.ok(byExact, '精确签名匹配应返回本人记录（含任意状态）');
}

function main() {
  const tests = [
    ['upsert 不复用他人 id', testUpsertDoesNotReuseOtherUserId],
    ['签名变化 UPDATE 同日旧行', testSignatureChangeUpdatesSameUserDayRow],
    ['读不回退跨用户', testGetDailyPackRowDoesNotFallbackAcrossUsers],
    ['读不回退全局历史', testGetDailyPackRowDoesNotFallbackToGlobalHistory],
    ['读仅本人当天 ready', testGetDailyPackRowReturnsCurrentUserReadyOnly],
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
