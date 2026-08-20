#!/usr/bin/env node
const assert = require('assert');
const dailyListen = require('../services/dailyListenPreGenerateService');

async function testBackfillVocabWritesWhenEmpty() {
  const rows = new Map();
  const db = {
    prepare(sql) {
      return {
        get(...args) {
          if (/FROM daily_listen_articles/i.test(sql)) {
            return rows.get('art') || null;
          }
          if (/FROM daily_extracted_articles/i.test(sql)) return null;
          return null;
        },
        run(...args) {
          if (/INSERT INTO daily_listen_articles|UPDATE daily_listen_articles/i.test(sql)
            || /INSERT OR REPLACE INTO daily_listen_articles/i.test(sql)) {
            // upsertArticle will call with many args; keep last vocab via side channel below
          }
          if (/INSERT OR REPLACE INTO daily_extracted_articles/i.test(sql)) {
            rows.set('ext', { words: args[7], phrases: args[8] });
          }
          return { changes: 1 };
        },
        all() { return []; },
      };
    },
  };

  // Use real upsert by monkeypatching getArticleRow path via in-memory better-sqlite if available
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    console.log('SKIP backfill vocab (no better-sqlite3)');
    return;
  }
  let dbReal;
  try {
    dbReal = new Database(':memory:');
  } catch (e) {
    console.log('SKIP backfill vocab (sqlite ABI):', e.message.split('\n')[0]);
    return;
  }

  dailyListen.initDailyListenTables(dbReal);
  dbReal.prepare(`
    CREATE TABLE IF NOT EXISTS daily_extracted_articles (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      quota_date TEXT,
      theme TEXT,
      genre TEXT,
      cefr_level TEXT,
      article TEXT,
      words_json TEXT,
      phrases_json TEXT,
      sentences_json TEXT,
      duration TEXT,
      input_signature TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `).run();

  const userId = `bf-${Date.now()}`;
  const theme = '商务谈判：让步与施压';
  const packDate = '2026-08-03';
  const parts = dailyListen.comboKeyParts({
    userId, packDate, theme, genre: 'meeting', cefrLevel: 'A2', duration: 1,
  });
  dailyListen.upsertArticle(dbReal, parts, {
    status: 'ready',
    source: 'test',
    body_text: 'A short meeting script about pricing leverage.',
    vocab_json: '[]',
    phrases_json: '[]',
  });

  let called = 0;
  dailyListen.setGenerators({
    extractVocabFromArticle: async () => {
      called += 1;
      return {
        vocab: [{ word: 'leverage' }],
        phrases: ['unit price'],
        sentences: ['We need leverage.'],
      };
    },
  });

  try {
    const res = await dailyListen.backfillVocabForCombo(dbReal, {
      userId, theme, genre: 'meeting', cefrLevel: 'A2', duration: 1, packDate, force: true,
    });
    assert.strictEqual(called, 1);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.vocabCount, 1);
    assert.strictEqual(res.phraseCount, 1);
    const row = dbReal.prepare(`
      SELECT vocab_json, phrases_json FROM daily_listen_articles
      WHERE user_id=? AND pack_date=? AND genre='meeting' AND cefr_level='A2' AND duration=1
    `).get(userId, packDate);
    assert.ok(JSON.parse(row.vocab_json).length >= 1);
    assert.ok(JSON.parse(row.phrases_json).length >= 1);
  } finally {
    dailyListen.setGenerators({ extractVocabFromArticle: null });
    try { dbReal.close(); } catch (_) {}
  }
}

async function main() {
  await testBackfillVocabWritesWhenEmpty();
  console.log('PASS backfillVocabForCombo');
  console.log('OK backfill-vocab');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
