const DEFAULT_LISTEN_VOICE_ID = 'en-US-BrianNeural';

const CRON_FORCE_LISTEN_EFFECTS = Object.freeze({
  interruptions: true,
  packet_loss: true,
  information_gap: true,
});

/** 与 src/config/voices.ts 的 id 对齐 */
const ALLOWED_LISTEN_VOICE_IDS = new Set([
  'en-GB-LibbyNeural',
  'en-GB-MaisieNeural',
  'en-GB-RyanNeural',
  'en-GB-SoniaNeural',
  'en-GB-ThomasNeural',
  'en-US-EmmaNeural',
  'en-US-AvaNeural',
  'en-US-AndrewNeural',
  'en-US-BrianNeural',
  'en-US-AnaNeural',
  'en-US-AriaNeural',
  'en-US-ChristopherNeural',
  'en-US-EricNeural',
  'en-US-GuyNeural',
  'en-US-JennyNeural',
  'en-US-MichelleNeural',
  'en-US-RogerNeural',
  'en-US-SteffanNeural',
  'en-US-AndrewMultilingualNeural',
  'en-US-AvaMultilingualNeural',
  'en-US-BrianMultilingualNeural',
  'en-US-EmmaMultilingualNeural',
  'en-AU-WilliamMultilingualNeural',
  'en-AU-NatashaNeural',
  'en-CA-ClaraNeural',
  'en-CA-LiamNeural',
  'en-HK-YanNeural',
  'en-HK-SamNeural',
  'en-IN-NeerjaNeural',
  'en-IN-PrabhatNeural',
  'en-IE-ConnorNeural',
  'en-IE-EmilyNeural',
  'en-KE-AsiliaNeural',
  'en-KE-ChilembaNeural',
  'en-NZ-MitchellNeural',
  'en-NZ-MollyNeural',
  'en-NG-AbeoNeural',
  'en-NG-EzinneNeural',
  'en-PH-JamesNeural',
  'en-PH-RosaNeural',
  'en-SG-LunaNeural',
  'en-SG-WayneNeural',
  'en-ZA-LeahNeural',
  'en-ZA-LukeNeural',
  'en-TZ-ElimuNeural',
  'en-TZ-ImaniNeural',
]);

function initListenPrefsTable(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS user_listen_prefs (
      user_id TEXT PRIMARY KEY,
      listen_voice_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run();
}

function isAllowedListenVoiceId(voiceId) {
  return typeof voiceId === 'string' && ALLOWED_LISTEN_VOICE_IDS.has(voiceId);
}

function getListenVoiceId(db, userId) {
  const row = db.prepare(
    'SELECT listen_voice_id FROM user_listen_prefs WHERE user_id = ?'
  ).get(userId);
  if (row && isAllowedListenVoiceId(row.listen_voice_id)) {
    return row.listen_voice_id;
  }
  return DEFAULT_LISTEN_VOICE_ID;
}

function upsertListenVoiceId(db, userId, voiceId) {
  if (!isAllowedListenVoiceId(voiceId)) {
    throw new Error('invalid voiceId');
  }
  const now = Date.now();
  db.prepare(`
    INSERT INTO user_listen_prefs (user_id, listen_voice_id, updated_at, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      listen_voice_id = excluded.listen_voice_id,
      updated_at = excluded.updated_at
  `).run(userId, voiceId, now, now);
  return voiceId;
}

module.exports = {
  DEFAULT_LISTEN_VOICE_ID,
  CRON_FORCE_LISTEN_EFFECTS,
  ALLOWED_LISTEN_VOICE_IDS,
  initListenPrefsTable,
  isAllowedListenVoiceId,
  getListenVoiceId,
  upsertListenVoiceId,
};
