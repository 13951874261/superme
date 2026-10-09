const assert = require('assert');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { initDailyListenTables } = require('../services/dailyListenPreGenerateService');

function openTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dea-schema-'));
  const dbPath = path.join(dir, 't.db');
  const db = new Database(dbPath);
  return { db, dir };
}

function testNewUniqueIncludesThemeDuration() {
  const { db, dir } = openTempDb();
  try {
    initDailyListenTables(db);
    const sql = String(
      db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_extracted_articles'`).get()?.sql || ''
    );
    assert.match(
      sql,
      /UNIQUE\s*\(\s*user_id\s*,\s*quota_date\s*,\s*theme\s*,\s*genre\s*,\s*cefr_level\s*,\s*duration\s*\)/i,
      'UNIQUE 必须含 theme 与 duration'
    );
    const indexes = db.prepare(`SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='daily_extracted_articles'`).all();
    const names = indexes.map((r) => r.name);
    assert.ok(names.includes('idx_dea_user_date_dims'), '缺少维度索引');
    assert.ok(names.includes('idx_dea_user_date_sig'), '缺少 signature 索引');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testMigrationDedupesKeepLatest() {
  const { db, dir } = openTempDb();
  try {
    // 模拟旧表：UNIQUE 不含 theme
    db.exec(`
      CREATE TABLE daily_extracted_articles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quota_date TEXT NOT NULL,
        theme TEXT NOT NULL,
        genre TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        article TEXT NOT NULL,
        words_json TEXT NOT NULL,
        phrases_json TEXT NOT NULL,
        sentences_json TEXT NOT NULL,
        duration TEXT DEFAULT '25',
        input_signature TEXT DEFAULT '',
        created_at INTEGER,
        updated_at INTEGER,
        UNIQUE(user_id, quota_date, genre, cefr_level)
      );
    `);
    const ins = db.prepare(`
      INSERT INTO daily_extracted_articles
      (id,user_id,quota_date,theme,genre,cefr_level,article,words_json,phrases_json,sentences_json,duration,input_signature,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    ins.run('old1', 'u1', '2026-08-20', 'ThemeA', 'reading', 'B1', 'a1', '[]', '[]', '[]', '35', 'sigA', 1, 100);
    // 无法在旧 UNIQUE 下插入同 genre/cefr 不同 theme；用手工破坏再迁移：先删 UNIQUE 场景用两行同 dims 不同 updated_at
    db.exec('DROP TABLE daily_extracted_articles');
    db.exec(`
      CREATE TABLE daily_extracted_articles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quota_date TEXT NOT NULL,
        theme TEXT NOT NULL,
        genre TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        article TEXT NOT NULL,
        words_json TEXT NOT NULL,
        phrases_json TEXT NOT NULL,
        sentences_json TEXT NOT NULL,
        duration TEXT DEFAULT '25',
        input_signature TEXT DEFAULT '',
        created_at INTEGER,
        updated_at INTEGER
      );
    `);
    ins.run('dup1', 'u1', '2026-08-20', 'ThemeA', 'reading', 'B1', 'old', '[]', '[]', '[]', '35', 'sig', 1, 100);
    ins.run('dup2', 'u1', '2026-08-20', 'ThemeA', 'reading', 'B1', 'new', '[]', '[]', '[]', '35', 'sig', 2, 200);

    initDailyListenTables(db);
    const rows = db.prepare(`
      SELECT id, article FROM daily_extracted_articles
      WHERE user_id='u1' AND quota_date='2026-08-20' AND theme='ThemeA' AND genre='reading' AND cefr_level='B1' AND duration='35'
    `).all();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].article, 'new');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testMigrateOldUniqueKeepsRowAndAllowsDifferentTheme() {
  const { db, dir } = openTempDb();
  try {
    db.exec(`
      CREATE TABLE daily_extracted_articles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quota_date TEXT NOT NULL,
        theme TEXT NOT NULL,
        genre TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        article TEXT NOT NULL,
        words_json TEXT NOT NULL,
        phrases_json TEXT NOT NULL,
        sentences_json TEXT NOT NULL,
        duration TEXT DEFAULT '25',
        input_signature TEXT DEFAULT '',
        created_at INTEGER,
        updated_at INTEGER,
        UNIQUE(user_id, quota_date, genre, cefr_level)
      );
    `);
    db.prepare(`
      INSERT INTO daily_extracted_articles
      (id,user_id,quota_date,theme,genre,cefr_level,article,words_json,phrases_json,sentences_json,duration,input_signature,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run('keep1', 'u1', '2026-08-20', 'ThemeA', 'reading', 'B1', 'article-a', '[]', '[]', '[]', '35', 'sigA', 1, 100);

    // Do NOT drop the table — migrate in place via initDailyListenTables
    initDailyListenTables(db);

    const sql = String(
      db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_extracted_articles'`).get()?.sql || ''
    );
    assert.match(
      sql,
      /UNIQUE\s*\(\s*user_id\s*,\s*quota_date\s*,\s*theme\s*,\s*genre\s*,\s*cefr_level\s*,\s*duration\s*\)/i,
      '迁移后 UNIQUE 必须含 theme 与 duration'
    );

    const kept = db.prepare(`SELECT id, theme, article FROM daily_extracted_articles WHERE id='keep1'`).get();
    assert.ok(kept, '原行应保留');
    assert.strictEqual(kept.theme, 'ThemeA');
    assert.strictEqual(kept.article, 'article-a');

    // Same genre/cefr, different theme must succeed after migration
    db.prepare(`
      INSERT INTO daily_extracted_articles
      (id,user_id,quota_date,theme,genre,cefr_level,article,words_json,phrases_json,sentences_json,duration,input_signature,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run('new2', 'u1', '2026-08-20', 'ThemeB', 'reading', 'B1', 'article-b', '[]', '[]', '[]', '35', 'sigB', 2, 200);

    const themes = db.prepare(`
      SELECT theme FROM daily_extracted_articles
      WHERE user_id='u1' AND quota_date='2026-08-20' AND genre='reading' AND cefr_level='B1'
      ORDER BY theme
    `).all().map((r) => r.theme);
    assert.deepStrictEqual(themes, ['ThemeA', 'ThemeB']);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

testNewUniqueIncludesThemeDuration();
testMigrationDedupesKeepLatest();
testMigrateOldUniqueKeepsRowAndAllowsDifferentTheme();
console.log('✅ dailyExtractedArticlesSchema.test.js 通过');
