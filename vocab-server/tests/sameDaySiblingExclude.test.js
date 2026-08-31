const assert = require('assert');
const dailyPackService = require('../services/dailyPackService');

function openDatabase() {
  try {
    const Database = require('better-sqlite3');
    return new Database(':memory:');
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(':memory:');
  }
}

function testCollectsTodayOnly() {
  const db = openDatabase();
  dailyPackService.initDailyPackTables(db);
  const day = dailyPackService.getPackDate();
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_extracted_articles (
      id TEXT, user_id TEXT, quota_date TEXT, words_json TEXT, phrases_json TEXT
    );
    CREATE TABLE IF NOT EXISTS daily_listen_articles (
      id TEXT, user_id TEXT, pack_date TEXT, vocab_json TEXT, phrases_json TEXT
    );
  `);
  db.prepare('INSERT INTO daily_extracted_articles VALUES (?,?,?,?,?)')
    .run('a1', 'u1', day, JSON.stringify([{ word: 'butterfly effect' }]), JSON.stringify(['signaling']));
  db.prepare('INSERT INTO daily_listen_articles VALUES (?,?,?,?,?)')
    .run('l1', 'u1', day, JSON.stringify(['Nash equilibrium']), JSON.stringify([{ phrase: 'moral hazard' }]));
  db.prepare('INSERT INTO daily_extracted_articles VALUES (?,?,?,?,?)')
    .run('a0', 'u1', '1999-01-01', JSON.stringify(['old-word']), '[]');

  const got = dailyPackService.getSameDaySiblingWords(db, 'u1');
  const keys = got.map(dailyPackService.stemWordKey);
  assert.ok(keys.includes(dailyPackService.stemWordKey('butterfly effect')));
  assert.ok(keys.includes(dailyPackService.stemWordKey('signaling')));
  assert.ok(keys.includes(dailyPackService.stemWordKey('Nash equilibrium')));
  assert.ok(keys.includes(dailyPackService.stemWordKey('moral hazard')));
  assert.ok(!keys.includes(dailyPackService.stemWordKey('old-word')));
  assert.deepStrictEqual(dailyPackService.getSameDaySiblingWords(db, 'other'), []);
  db.close();
  console.log('PASS sameDaySiblingExclude');
}

function testMissingTablesReturnsEmpty() {
  const db = openDatabase();
  dailyPackService.initDailyPackTables(db);
  assert.deepStrictEqual(dailyPackService.getSameDaySiblingWords(db, 'u1'), []);
  db.close();
  console.log('PASS sameDaySiblingExclude missing tables');
}

testCollectsTodayOnly();
testMissingTablesReturnsEmpty();
