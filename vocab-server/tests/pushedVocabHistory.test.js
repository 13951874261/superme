const assert = require('assert');
const dailyPackService = require('../services/dailyPackService');

const DAY_MS = 24 * 60 * 60 * 1000;

// 生产用 better-sqlite3；本地 Windows 缺少对应 Node ABI 的原生构建，
// 这里用内置 node:sqlite 并补齐 better-sqlite3 的 transaction() 接口
function openDatabase() {
  try {
    const Database = require('better-sqlite3');
    return new Database(':memory:');
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.transaction = (fn) => (...args) => {
      db.exec('BEGIN');
      try {
        const result = fn(...args);
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    };
    return db;
  }
}

function createDb() {
  const db = openDatabase();
  dailyPackService.initDailyPackTables(db);
  return db;
}

function backdate(db, word, daysAgo) {
  db.prepare('UPDATE pushed_vocab_history SET pushed_at = ? WHERE word = ?')
    .run(Date.now() - daysAgo * DAY_MS, word);
}

function testTableAndIndex() {
  console.log('=== 用例 1：建表与索引 ===');
  const db = createDb();
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pushed_vocab_history'").get();
  assert.ok(table, 'pushed_vocab_history 表必须存在');

  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='pushed_vocab_history'").all()
    .map((r) => r.name);
  assert.ok(indexes.includes('idx_pushed_vocab_user_time'), '必须存在 (user_id, pushed_at) 索引');
  assert.ok(indexes.includes('idx_pushed_vocab_user_word'), '必须存在 (user_id, word) 索引');

  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', [{ word: 'alpha' }]);
  const plan = db.prepare(
    'EXPLAIN QUERY PLAN SELECT word FROM pushed_vocab_history WHERE user_id = ? AND pushed_at >= ?'
  ).all('u1', 0).map((r) => r.detail).join(' ');
  assert.ok(/USING (COVERING )?INDEX/i.test(plan), `窗口查询必须走索引，实际计划：${plan}`);

  console.log('  通过：表、双索引已建立，窗口查询走索引');
  db.close();
}

function testRecordAndNormalize() {
  console.log('=== 用例 2：写入与归一化 ===');
  const db = createDb();
  const saved = dailyPackService.recordPushedWords(db, 'u1', 'wakeup', [
    { word: '  Negotiate  ', ipa: '/nɪˈɡoʊʃieɪt/', meaning_zh: '谈判' },
    { word: 'NEGOTIATE' },
    { word: 'leverage' },
    { word: '' },
  ]);
  assert.strictEqual(saved, 2, '同批内大小写/空格重复的词只应写入一次，空词跳过');

  const words = dailyPackService.getRecentPushedWords(db, 'u1');
  assert.deepStrictEqual(words.slice().sort(), ['leverage', 'negotiate'], '存储必须小写归一化');

  const row = db.prepare('SELECT word_json FROM pushed_vocab_history WHERE word = ?').get('negotiate');
  const snapshot = JSON.parse(row.word_json);
  assert.strictEqual(snapshot.ipa, '/nɪˈɡoʊʃieɪt/', '同批重复词以先到的完整词条为准，不被后面的精简词条覆盖');

  console.log('  通过：大小写与空格归一化、同批去重、空词跳过');
  db.close();
}

function testWindowBoundary() {
  console.log('=== 用例 3：30 天滚动窗口边界 ===');
  const db = createDb();
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', [
    { word: 'fresh' }, { word: 'edge' }, { word: 'expired' },
  ]);
  backdate(db, 'edge', 29);
  backdate(db, 'expired', 31);

  const inWindow = dailyPackService.getRecentPushedWords(db, 'u1', 30);
  assert.ok(inWindow.includes('fresh'), '当天词必须在窗口内');
  assert.ok(inWindow.includes('edge'), '29 天前的词必须仍在 30 天窗口内');
  assert.ok(!inWindow.includes('expired'), '31 天前的词必须已滑出窗口');

  console.log('  通过：窗口内保留、超窗口释放');
  db.close();
}

function testSharedPoolAcrossModules() {
  console.log('=== 用例 4：唤醒与破绽共享同一去重池 ===');
  const db = createDb();
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', [{ word: 'negotiate' }]);
  const pool = dailyPackService.getRecentPushedWords(db, 'u1');
  assert.ok(pool.includes('negotiate'), '唤醒推送的词必须出现在破绽模块可见的共享池中');

  dailyPackService.recordPushedWords(db, 'u1', 'flaw', [{ word: 'negotiate' }]);
  const count = db.prepare('SELECT COUNT(*) AS c FROM pushed_vocab_history WHERE user_id = ?').get('u1').c;
  assert.strictEqual(count, 1, '跨模块推送同一词只保留一行，刷新推送时间');
  const mod = db.prepare('SELECT module FROM pushed_vocab_history WHERE word = ?').get('negotiate').module;
  assert.strictEqual(mod, 'flaw', '重复推送时 module 更新为最近一次');

  console.log('  通过：跨模块共享池，重复词合并为单行');
  db.close();
}

function testUserIsolation() {
  console.log('=== 用例 5：多用户隔离 ===');
  const db = createDb();
  dailyPackService.recordPushedWords(db, 'userA', 'wakeup', [{ word: 'alpha' }]);
  dailyPackService.recordPushedWords(db, 'userB', 'wakeup', [{ word: 'beta' }]);

  assert.deepStrictEqual(dailyPackService.getRecentPushedWords(db, 'userA'), ['alpha'], 'A 用户只应看到自己的历史');
  assert.deepStrictEqual(dailyPackService.getRecentPushedWords(db, 'userB'), ['beta'], 'B 用户只应看到自己的历史');

  console.log('  通过：用户间历史互不干扰');
  db.close();
}

function testOldestForBackfill() {
  console.log('=== 用例 6：最久未出现词补齐 ===');
  const db = createDb();
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', [
    { word: 'oldest', ipa: '/o/', meaning_zh: '最旧' },
    { word: 'middle' },
    { word: 'newest' },
  ]);
  backdate(db, 'oldest', 40);
  backdate(db, 'middle', 20);

  const picked = dailyPackService.getOldestPushedWords(db, 'u1', { limit: 2 });
  assert.deepStrictEqual(picked.map((w) => w.word), ['oldest', 'middle'], '必须按最久未出现优先返回');
  assert.strictEqual(picked[0].meaning_zh, '最旧', '必须回填完整词条快照，避免补齐后缺音标释义');

  const excluded = dailyPackService.getOldestPushedWords(db, 'u1', { limit: 2, exclude: ['OLDEST'] });
  assert.deepStrictEqual(excluded.map((w) => w.word), ['middle', 'newest'], '排除名单必须大小写不敏感');

  console.log('  通过：按最久未出现排序、词条快照回填、排除名单生效');
  db.close();
}

function testPurgeRetention() {
  console.log('=== 用例 7：过期清理 ===');
  const db = createDb();
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', [{ word: 'keep' }, { word: 'drop' }]);
  backdate(db, 'drop', 100);

  const removed = dailyPackService.purgeExpiredPushedWords(db, 90);
  assert.strictEqual(removed, 1, '仅应删除超过 90 天保留期的记录');
  const left = db.prepare('SELECT word FROM pushed_vocab_history').all().map((r) => r.word);
  assert.deepStrictEqual(left, ['keep'], '保留期内的记录必须留存');

  console.log('  通过：超期记录清理，未超期记录保留');
  db.close();
}

function testIdempotentInit() {
  console.log('=== 用例 8：重复初始化安全 ===');
  const db = createDb();
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', [{ word: 'alpha' }]);
  dailyPackService.initDailyPackTables(db);
  assert.deepStrictEqual(dailyPackService.getRecentPushedWords(db, 'u1'), ['alpha'], '重复建表不得丢失既有数据');

  console.log('  通过：initDailyPackTables 可重复执行');
  db.close();
}

function run() {
  console.log('=== 测试：已推送词汇历史数据层 ===\n');
  testTableAndIndex();
  testRecordAndNormalize();
  testWindowBoundary();
  testSharedPoolAcrossModules();
  testUserIsolation();
  testOldestForBackfill();
  testPurgeRetention();
  testIdempotentInit();
  console.log('\n✅ pushedVocabHistory.test.js 全部 8 个用例通过！');
}

try {
  run();
} catch (err) {
  console.error('❌ 测试失败:', err);
  process.exit(1);
}
