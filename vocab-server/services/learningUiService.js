/**
 * learning_ui_json sidecar：独立于画像 upsert / updated_at。
 */

function parseLearningUi(raw) {
  if (!raw) {
    return {
      v: 1,
      biweeklyReviewHistory: [],
      lastReviewDate: null,
      nextWeekPush: null,
      difficultyAdjustment: {},
      pausedModules: [],
      weeklyChatHistory: [],
      oralWeaknessLog: [],
      writeBenchmarkText: '',
      writeDailyFeedback: null,
    };
  }
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { v: 1, biweeklyReviewHistory: [], weeklyChatHistory: [] };
  }
}

function clampReviewHistory(state) {
  const next = { ...state, v: 1 };
  if (Array.isArray(next.biweeklyReviewHistory) && next.biweeklyReviewHistory.length > 20) {
    next.biweeklyReviewHistory = next.biweeklyReviewHistory.slice(0, 20);
  }
  if (Array.isArray(next.weeklyChatHistory) && next.weeklyChatHistory.length > 50) {
    next.weeklyChatHistory = next.weeklyChatHistory.slice(0, 50);
  }
  return next;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} userId
 * @param {object|string} learningUi
 * @returns {{ userId: string, learning_ui: object, created: boolean }}
 */
function persistLearningUi(db, userId, learningUi) {
  const uid = String(userId || '').trim();
  if (!uid) throw new Error('userId required');
  const payload = clampReviewHistory(parseLearningUi(learningUi));
  const json = JSON.stringify(payload);

  const existing = db.prepare(
    'SELECT user_id, updated_at, learning_ui_json FROM user_memories WHERE user_id = ?',
  ).get(uid);

  if (!existing) {
    db.prepare(`
      INSERT INTO user_memories (
        user_id, profile_content, error_ledger, memory_layers, updated_at, learning_ui_json
      ) VALUES (?, '', '{}', '{}', 0, ?)
    `).run(uid, json);
    return { userId: uid, learning_ui: payload, created: true };
  }

  const beforeUpdatedAt = existing.updated_at;
  db.prepare(`
    UPDATE user_memories SET learning_ui_json = ? WHERE user_id = ?
  `).run(json, uid);

  const after = db.prepare(
    'SELECT updated_at, learning_ui_json FROM user_memories WHERE user_id = ?',
  ).get(uid);

  if (Number(after.updated_at) !== Number(beforeUpdatedAt)) {
    throw new Error('persistLearningUi must not bump updated_at');
  }
  if (after.learning_ui_json !== json) {
    throw new Error('persistLearningUi failed to write JSON');
  }

  return { userId: uid, learning_ui: payload, created: false };
}

function getLearningUi(db, userId) {
  const uid = String(userId || '').trim();
  if (!uid) throw new Error('userId required');
  const row = db.prepare(
    'SELECT learning_ui_json FROM user_memories WHERE user_id = ?',
  ).get(uid);
  return parseLearningUi(row?.learning_ui_json);
}

function ensureLearningUiColumn(db) {
  try {
    db.prepare("ALTER TABLE user_memories ADD COLUMN learning_ui_json TEXT").run();
  } catch {
    /* column may exist */
  }
}

module.exports = {
  persistLearningUi,
  getLearningUi,
  parseLearningUi,
  ensureLearningUiColumn,
};
