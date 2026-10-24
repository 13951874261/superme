const assert = require('assert');
const path = require('path');

let Database;
try {
  Database = require('better-sqlite3');
} catch {
  console.log('SKIP learningUiSidecar.test.js (better-sqlite3 unavailable)');
  process.exit(0);
}

const learningUiService = require('../services/learningUiService');

function createDb() {
  try {
    const db = new Database(':memory:');
    db.prepare(`
      CREATE TABLE user_memories (
        user_id TEXT PRIMARY KEY,
        profile_content TEXT NOT NULL,
        error_ledger TEXT,
        memory_layers TEXT DEFAULT '{}',
        updated_at INTEGER NOT NULL
      )
    `).run();
    learningUiService.ensureLearningUiColumn(db);
    return db;
  } catch (e) {
    console.log('SKIP learningUiSidecar.test.js (better-sqlite3 native bindings unavailable)');
    process.exit(0);
  }
}

function testPersistCreatesRowWithoutTouchingProfileClock() {
  const db = createDb();
  const result = learningUiService.persistLearningUi(db, 'alice', {
    weeklyChatHistory: [{ id: '1', userContent: '夜话A' }],
    lastReviewDate: null,
  });
  assert.equal(result.created, true);
  const row = db.prepare('SELECT * FROM user_memories WHERE user_id = ?').get('alice');
  assert.equal(row.updated_at, 0);
  assert.equal(row.profile_content, '');
  const parsed = JSON.parse(row.learning_ui_json);
  assert.equal(parsed.weeklyChatHistory[0].userContent, '夜话A');
  console.log('OK U10 create placeholder');
}

function testPersistDoesNotBumpUpdatedAtOrTouchOtherUser() {
  const db = createDb();
  const now = 1_700_000_000_000;
  db.prepare(`
    INSERT INTO user_memories (user_id, profile_content, error_ledger, memory_layers, updated_at, learning_ui_json)
    VALUES ('lzhmy', '对抗性沟通怯懦', '{}', '{}', ?, NULL)
  `).run(now);
  db.prepare(`
    INSERT INTO user_memories (user_id, profile_content, error_ledger, memory_layers, updated_at, learning_ui_json)
    VALUES ('alice', '', '{}', '{}', ?, NULL)
  `).run(now);

  learningUiService.persistLearningUi(db, 'alice', {
    weeklyChatHistory: [{ id: '2', userContent: 'alice夜话' }],
  });

  const alice = db.prepare('SELECT * FROM user_memories WHERE user_id = ?').get('alice');
  const lzhmy = db.prepare('SELECT * FROM user_memories WHERE user_id = ?').get('lzhmy');
  assert.equal(alice.updated_at, now);
  assert.equal(lzhmy.profile_content, '对抗性沟通怯懦');
  assert.equal(lzhmy.learning_ui_json, null);
  assert.match(alice.learning_ui_json, /alice夜话/);
  console.log('OK U10/I2 no bump + isolation');
}

function testUpsertMemoryDoesNotClearLearningUi() {
  const db = createDb();
  learningUiService.persistLearningUi(db, 'alice', {
    weeklyChatHistory: [{ id: '3', userContent: '保留我' }],
  });
  // 模拟 upsertUserMemoryRow：只写画像列
  db.prepare(`
    INSERT INTO user_memories (user_id, profile_content, error_ledger, memory_layers, updated_at)
    VALUES ('alice', '新画像', '{}', '{}', ?)
    ON CONFLICT(user_id) DO UPDATE SET
      profile_content = excluded.profile_content,
      error_ledger = excluded.error_ledger,
      memory_layers = excluded.memory_layers,
      updated_at = excluded.updated_at
  `).run(Date.now());

  const row = db.prepare('SELECT profile_content, learning_ui_json FROM user_memories WHERE user_id = ?').get('alice');
  assert.equal(row.profile_content, '新画像');
  assert.match(row.learning_ui_json, /保留我/);
  console.log('OK I7 profile save does not clear learning_ui');
}

function testDreamingStyleUpsertLeavesLearningUi() {
  const db = createDb();
  learningUiService.persistLearningUi(db, 'alice', { oralWeaknessLog: [{ flaw: '迟滞' }] });
  const before = db.prepare('SELECT learning_ui_json FROM user_memories WHERE user_id = ?').get('alice').learning_ui_json;
  db.prepare(`
    UPDATE user_memories SET profile_content = ?, memory_layers = ?, updated_at = ?
    WHERE user_id = ?
  `).run('dreamed', '{}', Date.now(), 'alice');
  const after = db.prepare('SELECT learning_ui_json FROM user_memories WHERE user_id = ?').get('alice').learning_ui_json;
  assert.equal(after, before);
  console.log('OK U9/U11 dreaming path leaves learning_ui_json');
}

testPersistCreatesRowWithoutTouchingProfileClock();
testPersistDoesNotBumpUpdatedAtOrTouchOtherUser();
testUpsertMemoryDoesNotClearLearningUi();
testDreamingStyleUpsertLeavesLearningUi();
console.log('PASS learningUiSidecar');
