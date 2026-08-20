const assert = require('assert');
const crypto = require('crypto');

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

function createSchema(db) {
  db.exec(`
    CREATE TABLE custom_themes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'default-user',
      theme_name TEXT NOT NULL,
      display_name TEXT,
      associated_file TEXT,
      dify_document_id TEXT,
      dify_dataset_id TEXT,
      extracted_keywords TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE vocabulary (
      id TEXT PRIMARY KEY,
      word TEXT,
      dict_type TEXT,
      category TEXT,
      payload TEXT,
      added_at INTEGER,
      next_review_date INTEGER,
      review_history TEXT
    );
    CREATE TABLE generation_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'default-user',
      theme TEXT NOT NULL,
      generated_at INTEGER,
      article_summary TEXT,
      keywords TEXT,
      ttl_days INTEGER DEFAULT 3
    );
    CREATE TABLE training_attempts (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      user_id TEXT,
      module_type TEXT,
      scene_type TEXT,
      case_text TEXT,
      user_answer TEXT,
      duration_seconds INTEGER,
      score REAL,
      created_at INTEGER
    );
    CREATE TABLE training_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT
    );
  `);
}

function seedTheme(db, overrides = {}) {
  const id = overrides.id || crypto.randomUUID();
  const themeName = overrides.theme_name || 'Tesla Q3 Earnings Call';
  const displayName = overrides.display_name || 'Tesla Q3 Earnings Call - 特斯拉Q3财报电话会议';
  db.prepare(`
    INSERT INTO custom_themes (id, user_id, theme_name, display_name, associated_file, dify_document_id, dify_dataset_id, extracted_keywords, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    overrides.user_id || 'u1',
    themeName,
    displayName,
    'deck.pdf',
    overrides.dify_document_id || 'doc-1',
    overrides.dify_dataset_id || 'ds-1',
    '[]',
    Date.now(),
    Date.now()
  );
  return { id, themeName, displayName };
}

function seedLinked(db, { themeName, displayName, otherTheme }) {
  db.prepare(`
    INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'v-keep',
    'leverage',
    'ai_extracted',
    'business',
    JSON.stringify({ topic: otherTheme, source: 'Custom Theme Extract', meaning: '保留' }),
    Date.now(), Date.now(), '[]'
  );
  db.prepare(`
    INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'v-del-word',
    'earnings',
    'ai_extracted',
    'business',
    JSON.stringify({ topic: displayName, source: 'Custom Theme Extract', meaning: '应删' }),
    Date.now(), Date.now(), '[]'
  );
  db.prepare(`
    INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'v-del-phrase',
    'beat expectations',
    'ai_phrase',
    'business',
    JSON.stringify({ topic: themeName, source: 'Custom Theme Extract', meaning: '应删短语' }),
    Date.now(), Date.now(), '[]'
  );
  db.prepare(`
    INSERT INTO generation_history (id, user_id, theme, generated_at, article_summary, keywords)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('g-del', 'u1', displayName, Date.now(), 'summary', '[]');
  db.prepare(`
    INSERT INTO generation_history (id, user_id, theme, generated_at, article_summary, keywords)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('g-keep', 'u1', otherTheme, Date.now(), 'other', '[]');
  db.prepare(`
    INSERT INTO training_attempts (id, session_id, user_id, module_type, scene_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('a-del', 's1', 'u1', 'oral', displayName, Date.now());
  db.prepare(`
    INSERT INTO training_attempts (id, session_id, user_id, module_type, scene_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('a-keep', 's1', 'u1', 'oral', otherTheme, Date.now());
}

async function main() {
  const {
    cascadeDeleteCustomTheme,
    buildThemeMatchKeys,
  } = require('../services/customThemeCascadeDelete');

  console.log('=== 用例 1：匹配键包含 theme_name 与 display_name ===');
  const keys = buildThemeMatchKeys({
    theme_name: 'Tesla Q3 Earnings Call',
    display_name: 'Tesla Q3 Earnings Call - 特斯拉Q3财报电话会议',
  });
  assert.deepStrictEqual(
    keys.sort(),
    ['Tesla Q3 Earnings Call', 'Tesla Q3 Earnings Call - 特斯拉Q3财报电话会议'].sort()
  );

  console.log('=== 用例 2：级联删除本主题数据，保留其他主题 ===');
  const db = openDatabase();
  createSchema(db);
  const theme = seedTheme(db);
  const otherTheme = '危机公关';
  seedLinked(db, { ...theme, otherTheme });

  let difyCalls = 0;
  const result = await cascadeDeleteCustomTheme(db, {
    id: theme.id,
    deleteDifyDocument: async ({ documentId, datasetId }) => {
      difyCalls += 1;
      assert.strictEqual(documentId, 'doc-1');
      assert.strictEqual(datasetId, 'ds-1');
      return { ok: true };
    },
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.stats.vocabularyDeleted, 2);
  assert.strictEqual(result.stats.generationDeleted, 1);
  assert.strictEqual(result.stats.attemptsDeleted, 1);
  assert.strictEqual(result.stats.themeDeleted, 1);
  assert.strictEqual(difyCalls, 1);
  assert.ok(result.themeSnapshot);
  assert.strictEqual(result.themeSnapshot.id, theme.id);
  assert.strictEqual(result.dify.ok, true);

  assert.strictEqual(db.prepare('SELECT COUNT(*) AS c FROM custom_themes WHERE id = ?').get(theme.id).c, 0);
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS c FROM vocabulary WHERE id = 'v-del-word'").get().c, 0);
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS c FROM vocabulary WHERE id = 'v-del-phrase'").get().c, 0);
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS c FROM vocabulary WHERE id = 'v-keep'").get().c, 1);
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS c FROM generation_history WHERE id = 'g-del'").get().c, 0);
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS c FROM generation_history WHERE id = 'g-keep'").get().c, 1);
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS c FROM training_attempts WHERE id = 'a-del'").get().c, 0);
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS c FROM training_attempts WHERE id = 'a-keep'").get().c, 1);

  console.log('=== 用例 3：Dify 失败时本地仍删除，并标记云端未完成 ===');
  const db2 = openDatabase();
  createSchema(db2);
  const theme2 = seedTheme(db2, { id: 't2', dify_document_id: 'doc-x', dify_dataset_id: 'ds-x' });
  const result2 = await cascadeDeleteCustomTheme(db2, {
    id: theme2.id,
    deleteDifyDocument: async () => ({ ok: false, error: 'network' }),
  });
  assert.strictEqual(result2.success, true);
  assert.strictEqual(result2.dify.ok, false);
  assert.ok(result2.dify.cloudCleanupIncomplete);
  assert.strictEqual(db2.prepare('SELECT COUNT(*) AS c FROM custom_themes').get().c, 0);

  console.log('=== 用例 4：主题不存在 ===');
  const missing = await cascadeDeleteCustomTheme(db2, { id: 'nope' });
  assert.strictEqual(missing.success, false);
  assert.match(missing.error || '', /not found/i);

  console.log('=== 用例 5：自定义名撞系统主题时不级联系统数据；非萃取来源词保留 ===');
  const db3 = openDatabase();
  createSchema(db3);
  // 恶意/撞名：theme_name 故意等于系统主题
  const clash = seedTheme(db3, {
    id: 't-clash',
    theme_name: '危机公关：外媒答疑',
    display_name: '危机公关：外媒答疑',
  });
  db3.prepare(`
    INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'v-system-topic',
    'crisis',
    'ai_extracted',
    'business',
    JSON.stringify({ topic: '危机公关：外媒答疑', source: 'Daily Pack', meaning: '应保留' }),
    Date.now(), Date.now(), '[]'
  );
  db3.prepare(`
    INSERT INTO generation_history (id, user_id, theme, generated_at, article_summary, keywords)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('g-system', 'u1', '危机公关：外媒答疑', Date.now(), 'system article', '[]');
  db3.prepare(`
    INSERT INTO training_attempts (id, session_id, user_id, module_type, scene_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('a-system', 's1', 'u1', 'oral', '危机公关：外媒答疑', Date.now());

  const clashResult = await cascadeDeleteCustomTheme(db3, {
    id: clash.id,
    deleteDifyDocument: async () => ({ ok: true }),
  });
  assert.strictEqual(clashResult.success, true);
  assert.deepStrictEqual(clashResult.themeKeys, [], '撞名系统主题时匹配键应为空');
  assert.strictEqual(db3.prepare("SELECT COUNT(*) AS c FROM vocabulary WHERE id = 'v-system-topic'").get().c, 1);
  assert.strictEqual(db3.prepare("SELECT COUNT(*) AS c FROM generation_history WHERE id = 'g-system'").get().c, 1);
  assert.strictEqual(db3.prepare("SELECT COUNT(*) AS c FROM training_attempts WHERE id = 'a-system'").get().c, 1);
  assert.strictEqual(db3.prepare('SELECT COUNT(*) AS c FROM custom_themes WHERE id = ?').get(clash.id).c, 0);

  console.log('customThemeCascadeDelete tests passed');
  db.close();
  db2.close();
  db3.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
