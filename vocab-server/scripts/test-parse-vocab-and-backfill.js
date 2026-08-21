#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const dailyListen = require('../services/dailyListenPreGenerateService');
const USABLE_ARTICLE = [
  'Good morning everyone and thank you for joining this pricing review.',
  'We will walk through the concession package, the supply chain risk memo, and the budget ceiling.',
  'Please flag any compliance gaps before we meet the counterparty this afternoon.',
  'If we cannot close the unit price gap today, legal and finance will schedule a follow-up session.',
  'Keep the discussion focused on decisions so we can leave with a signed action list.',
].join(' ');

function testParseFenceJson() {
  const raw = [
    'Article body here.',
    '---VOCAB_JSON_START---',
    '```json',
    '{"words":[{"word":"leverage"}],"phrases":["drive a hard bargain"],"sentences":["We need leverage."]}',
    '```',
    '---VOCAB_JSON_END---',
  ].join('\n');
  const got = dailyListen.parseVocabFromRaw(raw);
  assert.strictEqual(got.vocab[0].word || got.vocab[0], 'leverage');
  assert.deepStrictEqual(got.phrases, ['drive a hard bargain']);
  assert.ok(Array.isArray(got.sentences));
  assert.ok(got.sentences.length >= 1);
}

function testParseWithoutEndMarker() {
  const raw = 'Body.\n---VOCAB_JSON_START---\n{"vocab":["alpha"],"phrases":["beta gamma"]}\ntrailing junk';
  const got = dailyListen.parseVocabFromRaw(raw);
  assert.ok(got.vocab.length >= 1);
  assert.ok(got.phrases.length >= 1);
}

function testParseMissingReturnsEmpty() {
  const got = dailyListen.parseVocabFromRaw('plain article without markers');
  assert.deepStrictEqual(got.vocab, []);
  assert.deepStrictEqual(got.phrases, []);
}

async function testGenerateBackfillsVocabWhenMissing() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'listen-vocab-'));
  const articleRoot = path.join(tmp, 'articles');
  const audioRoot = path.join(tmp, 'audios');
  fs.mkdirSync(articleRoot, { recursive: true });
  fs.mkdirSync(audioRoot, { recursive: true });

  // lightweight in-memory db stub
  const store = { articles: new Map(), audios: new Map() };
  const db = {
    prepare(sql) {
      return {
        get(...args) {
          if (/FROM daily_listen_articles/i.test(sql)) {
            const key = args.join('|');
            for (const row of store.articles.values()) {
              if (
                row.user_id === args[0]
                && row.pack_date === args[1]
                && (row.theme === args[2] || sql.includes('genre=?') && !sql.includes('theme=?'))
              ) {
                return row;
              }
            }
            // fallback query shape: user, date, genre, cefr, duration
            return [...store.articles.values()].find((r) =>
              r.user_id === args[0] && r.pack_date === args[1] && r.genre === args[2]
              && r.cefr_level === args[3] && Number(r.duration) === Number(args[4]),
            );
          }
          if (/FROM daily_listen_audios/i.test(sql)) {
            return [...store.audios.values()].find((r) =>
              r.user_id === args[0] && r.pack_date === args[1] && r.genre === (args[3] || args[2]),
            );
          }
          if (/FROM daily_extracted_articles/i.test(sql)) return undefined;
          return undefined;
        },
        run(...args) {
          if (/INSERT INTO daily_listen_articles|UPDATE daily_listen_articles/i.test(sql)) {
            // upsertArticle paths vary; capture via side effect from real upsert using better mock
          }
          if (/INSERT OR REPLACE INTO daily_extracted_articles/i.test(sql) || /INSERT INTO daily_extracted_articles/i.test(sql)) {
            store.extracted = args;
          }
          return { changes: 1 };
        },
        all() { return []; },
      };
    },
  };

  // Prefer real sqlite if available; otherwise skip integration-style assert via generators only
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    Database = null;
  }

  if (!Database) {
    console.log('SKIP generate backfill (no better-sqlite3)');
    return;
  }

  let dbReal;
  try {
    dbReal = new Database(':memory:');
  } catch (e) {
    console.log('SKIP generate backfill (sqlite ABI):', e.message.split('\n')[0]);
    return;
  }

  dailyListen.initDailyListenTables(dbReal);
  dbReal.prepare(`CREATE TABLE IF NOT EXISTS vocabulary (word TEXT, added_at INTEGER)`).run();
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
  const userId = `vocab-test-${Date.now()}`;
  const theme = '商务谈判：让步与施压';
  let extractCalled = 0;

  const prev = { ...require('../services/dailyListenPreGenerateService') };
  dailyListen.setGenerators({
    generateLongScript: async () => `${USABLE_ARTICLE} No vocab block.`,
    synthesizeAudioFile: async (_t, p) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from('ID3')); },
    extractVocabFromArticle: async () => {
      extractCalled += 1;
      return {
        vocab: [{ word: 'pricing' }],
        phrases: ['unit price'],
        sentences: ['We discussed pricing.'],
      };
    },
  });

  try {
    const result = await dailyListen.generateOneCombo(
      dbReal,
      { userId, theme, genre: 'meeting', cefrLevel: 'A2', duration: 1, packDate: '2026-08-03' },
      { source: 'backfill', only: 'article' },
    );
    assert.strictEqual(extractCalled, 1, '空词表时应调用 extractVocabFromArticle');
    assert.ok(result.articleStatus === 'ready' || result.status === 'ready');
    const row = dbReal.prepare(`
      SELECT vocab_json, phrases_json FROM daily_listen_articles
      WHERE user_id=? AND pack_date=? AND genre='meeting' AND cefr_level='A2' AND duration=1
    `).get(userId, '2026-08-03');
    const vocab = JSON.parse(row.vocab_json || '[]');
    const phrases = JSON.parse(row.phrases_json || '[]');
    assert.ok(vocab.length >= 1, 'vocab应写回 vocab');
    assert.ok(phrases.length >= 1, '监听应写回 phrases');

    const ext = dbReal.prepare(`
      SELECT words_json, phrases_json, sentences_json FROM daily_extracted_articles
      WHERE user_id=? AND quota_date=? AND genre='meeting' AND cefr_level='A2'
        AND (duration='1' OR duration=1)
      ORDER BY updated_at DESC LIMIT 1
    `).get(userId, '2026-08-03');
    assert.ok(ext, '应同步 daily_extracted_articles');
    assert.ok(JSON.parse(ext.words_json || '[]').length >= 1);
    assert.ok(JSON.parse(ext.phrases_json || '[]').length >= 1);
  } finally {
    dailyListen.setGenerators({
      generateLongScript: async () => { throw new Error('generateLongScript not injected'); },
      synthesizeAudioFile: async () => { throw new Error('synthesizeAudioFile not injected'); },
      extractVocabFromArticle: null,
    });
    try { dbReal.close(); } catch (_) {}
  }
}

async function openMemoryDb() {
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    return null;
  }
  let dbReal;
  try {
    dbReal = new Database(':memory:');
  } catch (e) {
    console.log('SKIP sqlite:', e.message.split('\n')[0]);
    return null;
  }
  dailyListen.initDailyListenTables(dbReal);
  dbReal.prepare(`CREATE TABLE IF NOT EXISTS vocabulary (word TEXT, added_at INTEGER)`).run();
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
  return dbReal;
}

/** D-A: 抽词挂起时，正文仍应在超时后 ready，且整段不卡死 */
async function testReadyWhenExtractHangs() {
  const dbReal = await openMemoryDb();
  if (!dbReal) {
    console.log('SKIP ready-when-extract-hangs (no sqlite)');
    return;
  }
  const prevTimeout = process.env.EXTRACT_VOCAB_TIMEOUT_MS;
  process.env.EXTRACT_VOCAB_TIMEOUT_MS = '150';
  const userId = `hang-test-${Date.now()}`;
  dailyListen.setGenerators({
    generateLongScript: async () => `${USABLE_ARTICLE} Hang test body about negotiation tactics.`,
    synthesizeAudioFile: async () => {},
    extractVocabFromArticle: () => new Promise(() => {}), // never resolves
  });
  try {
    const t0 = Date.now();
    await dailyListen.generateOneCombo(
      dbReal,
      { userId, theme: '商务谈判：让步与施压', genre: 'podcast', cefrLevel: 'A2', duration: 1, packDate: '2026-08-04' },
      { source: 'backfill', only: 'article' },
    );
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 3000, `应在抽词超时后尽快返回, elapsed=${elapsed}`);
    const row = dbReal.prepare(`
      SELECT status, length(COALESCE(body_text,'')) AS bl FROM daily_listen_articles
      WHERE user_id=? AND pack_date=? AND genre='podcast' AND cefr_level='A2'
    `).get(userId, '2026-08-04');
    assert.strictEqual(row.status, 'ready', '抽词挂起时正文仍应 ready');
    assert.ok(Number(row.bl) > 10, 'ready 行应已有 body');
  } finally {
    if (prevTimeout === undefined) delete process.env.EXTRACT_VOCAB_TIMEOUT_MS;
    else process.env.EXTRACT_VOCAB_TIMEOUT_MS = prevTimeout;
    dailyListen.setGenerators({
      generateLongScript: async () => { throw new Error('generateLongScript not injected'); },
      synthesizeAudioFile: async () => { throw new Error('synthesizeAudioFile not injected'); },
      extractVocabFromArticle: null,
    });
    try { dbReal.close(); } catch (_) {}
  }
}

/** D-A: 抽词进行中时 DB 已是 ready（正文优先落库） */
async function testReadyBeforeExtractFinishes() {
  const dbReal = await openMemoryDb();
  if (!dbReal) {
    console.log('SKIP ready-before-extract (no sqlite)');
    return;
  }
  const prevTimeout = process.env.EXTRACT_VOCAB_TIMEOUT_MS;
  process.env.EXTRACT_VOCAB_TIMEOUT_MS = '5000';
  const userId = `order-test-${Date.now()}`;
  let sawReadyDuringExtract = false;
  dailyListen.setGenerators({
    generateLongScript: async () => `${USABLE_ARTICLE} Order test body without vocab markers.`,
    synthesizeAudioFile: async () => {},
    extractVocabFromArticle: async () => {
      for (let i = 0; i < 40; i += 1) {
        const row = dbReal.prepare(`
          SELECT status, length(COALESCE(body_text,'')) AS bl FROM daily_listen_articles
          WHERE user_id=? AND pack_date=? AND genre='podcast' AND cefr_level='B1'
        `).get(userId, '2026-08-04');
        if (row && row.status === 'ready' && Number(row.bl) > 10) {
          sawReadyDuringExtract = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      return {
        vocab: [{ word: 'order' }],
        phrases: ['in order'],
        sentences: ['Keep order.'],
      };
    },
  });
  try {
    await dailyListen.generateOneCombo(
      dbReal,
      { userId, theme: '商务谈判：让步与施压', genre: 'podcast', cefrLevel: 'B1', duration: 1, packDate: '2026-08-04' },
      { source: 'backfill', only: 'article' },
    );
    assert.ok(sawReadyDuringExtract, '抽词尚未结束时 DB 就应已 ready');
    const row = dbReal.prepare(`
      SELECT vocab_json FROM daily_listen_articles
      WHERE user_id=? AND pack_date=? AND genre='podcast' AND cefr_level='B1'
    `).get(userId, '2026-08-04');
    assert.ok(JSON.parse(row.vocab_json || '[]').length >= 1, '抽词成功后应写回 vocab');
  } finally {
    if (prevTimeout === undefined) delete process.env.EXTRACT_VOCAB_TIMEOUT_MS;
    else process.env.EXTRACT_VOCAB_TIMEOUT_MS = prevTimeout;
    dailyListen.setGenerators({
      generateLongScript: async () => { throw new Error('generateLongScript not injected'); },
      synthesizeAudioFile: async () => { throw new Error('synthesizeAudioFile not injected'); },
      extractVocabFromArticle: null,
    });
    try { dbReal.close(); } catch (_) {}
  }
}

async function main() {
  testParseFenceJson();
  console.log('PASS parse fence json');
  testParseWithoutEndMarker();
  console.log('PASS parse without end marker');
  testParseMissingReturnsEmpty();
  console.log('PASS parse missing empty');
  await testGenerateBackfillsVocabWhenMissing();
  console.log('PASS generate backfill vocab');
  await testReadyWhenExtractHangs();
  console.log('PASS ready when extract hangs');
  await testReadyBeforeExtractFinishes();
  console.log('PASS ready before extract finishes');
  console.log('OK parse-vocab-and-backfill');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
