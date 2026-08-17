const assert = require('assert');
const {
  initListenPrefsTable,
  getListenVoiceId,
  upsertListenVoiceId,
  DEFAULT_LISTEN_VOICE_ID,
  CRON_FORCE_LISTEN_EFFECTS,
  isAllowedListenVoiceId,
} = require('../services/listenPrefsService');

/** Node 23 下 better-sqlite3 原生绑定不可用时的轻量假 DB（仅覆盖本 service SQL） */
function createFakeDb() {
  const store = new Map();
  return {
    prepare(sql) {
      const isSelect = /SELECT listen_voice_id FROM user_listen_prefs/.test(sql);
      const isUpsert = /INSERT INTO user_listen_prefs/.test(sql);
      const isCreate = /CREATE TABLE IF NOT EXISTS user_listen_prefs/.test(sql);
      return {
        run(...args) {
          if (isCreate) return;
          if (isUpsert) {
            const [userId, voiceId, updatedAt, createdAt] = args;
            const prev = store.get(userId);
            store.set(userId, {
              listen_voice_id: voiceId,
              updated_at: updatedAt,
              created_at: prev ? prev.created_at : createdAt,
            });
          }
        },
        get(userId) {
          if (!isSelect) return undefined;
          const row = store.get(userId);
          return row ? { listen_voice_id: row.listen_voice_id } : undefined;
        },
      };
    },
  };
}

const db = createFakeDb();
initListenPrefsTable(db);

assert.strictEqual(getListenVoiceId(db, 'u1'), DEFAULT_LISTEN_VOICE_ID);
assert.strictEqual(DEFAULT_LISTEN_VOICE_ID, 'en-US-BrianNeural');
assert.deepStrictEqual(CRON_FORCE_LISTEN_EFFECTS, {
  interruptions: true,
  packet_loss: true,
  information_gap: true,
});

assert.ok(isAllowedListenVoiceId('en-IN-NeerjaNeural'));
assert.ok(!isAllowedListenVoiceId('not-a-voice'));

upsertListenVoiceId(db, 'u1', 'en-IN-NeerjaNeural');
assert.strictEqual(getListenVoiceId(db, 'u1'), 'en-IN-NeerjaNeural');

assert.throws(() => upsertListenVoiceId(db, 'u1', 'bad-voice'), /invalid voice/i);

console.log('listenPrefsService tests passed');
