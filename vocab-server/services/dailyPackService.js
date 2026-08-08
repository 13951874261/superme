const crypto = require('crypto');

const PACK_TZ = process.env.DAILY_PACK_CRON_TZ || 'Asia/Shanghai';
const FLAW_SUB_THEMES = [
  'shifting the burden of proof and defensive responses',
  'ambiguous definitions and play on words',
  'false dilemmas and oversimplification',
];

function normalizeUserId(raw) {
  if (!raw) return 'default-user';
  const base = String(raw).split('@')[0].trim();
  return base || 'default-user';
}

// 稳定输入签名 — 仅对三个稳定字段哈希，时间类字段不参与缓存定位
function computeInputSignature(theme, historyExclude, userCurrentProfile) {
  const stable = JSON.stringify({
    theme: String(theme || '').trim(),
    history_exclude: String(historyExclude || '').trim(),
    user_current_profile: String(userCurrentProfile || '').trim(),
  });
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

function getPackDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PACK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function getShanghaiHourMinute(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PACK_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { hour, minute };
}

function initDailyPackTables(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS user_theme_prefs (
      user_id TEXT PRIMARY KEY,
      theme TEXT NOT NULL,
      synced_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS daily_packs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      pack_date TEXT NOT NULL,
      theme TEXT NOT NULL,
      input_signature TEXT NOT NULL DEFAULT '',
      wakeup_json TEXT,
      flaw_vocab_json TEXT,
      source TEXT NOT NULL DEFAULT 'cron',
      status TEXT NOT NULL DEFAULT 'generating',
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, pack_date, input_signature)
    )
  `).run();

  // 迁移：若旧表缺少 input_signature 列，则重建（SQLite 不支持 DROP CONSTRAINT）
  const cols = db.prepare('PRAGMA table_info(daily_packs)').all();
  const hasSignature = cols.some((c) => c.name === 'input_signature');
  if (!hasSignature) {
    db.transaction(() => {
      db.exec('ALTER TABLE daily_packs RENAME TO daily_packs_old');
      db.exec(`
        CREATE TABLE daily_packs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          pack_date TEXT NOT NULL,
          theme TEXT NOT NULL,
          input_signature TEXT NOT NULL DEFAULT '',
          wakeup_json TEXT,
          flaw_vocab_json TEXT,
          source TEXT NOT NULL DEFAULT 'cron',
          status TEXT NOT NULL DEFAULT 'generating',
          error_message TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(user_id, pack_date, input_signature)
        )
      `);
      db.exec(`
        INSERT INTO daily_packs
          SELECT id, user_id, pack_date, theme, '',
                 wakeup_json, flaw_vocab_json, source,
                 status, error_message, created_at, updated_at
          FROM daily_packs_old
      `);
      db.exec('DROP TABLE daily_packs_old');
    })();
    console.log('[DailyPack] migrated daily_packs: added input_signature, updated UNIQUE constraint');
  }
}

function upsertUserTheme(db, userId, theme) {
  const uid = normalizeUserId(userId);
  const trimmed = String(theme || '').trim();
  if (!trimmed) throw new Error('theme is required');
  const now = Date.now();
  db.prepare(`
    INSERT INTO user_theme_prefs (user_id, theme, synced_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      theme = excluded.theme,
      synced_at = excluded.synced_at,
      updated_at = excluded.updated_at
  `).run(uid, trimmed, now, now);
  return { userId: uid, theme: trimmed, syncedAt: now };
}

function listUsersWithSyncedTheme(db) {
  return db.prepare(`
    SELECT user_id, theme FROM user_theme_prefs
    WHERE theme IS NOT NULL AND TRIM(theme) != ''
  `).all();
}

function findUserDailyPackByDate(db, userId, packDate) {
  const uid = normalizeUserId(userId);
  return db.prepare(
    'SELECT * FROM daily_packs WHERE user_id = ? AND pack_date = ? ORDER BY created_at DESC LIMIT 1'
  ).get(uid, packDate);
}

function getDailyPackRow(db, userId, packDate, inputSignature = null, theme = null) {
  const uid = normalizeUserId(userId);
  // D1: 有签名则精确命中；无签名不宽回退到「任意 ready」
  if (inputSignature === null || inputSignature === undefined) return undefined;
  const exact = db.prepare(
    "SELECT * FROM daily_packs WHERE user_id = ? AND pack_date = ? AND input_signature = ?"
  ).get(uid, packDate, inputSignature);
  if (exact) return exact;

  const fallback = db.prepare(
    "SELECT * FROM daily_packs WHERE user_id = ? AND pack_date = ? AND status = 'ready' ORDER BY created_at DESC LIMIT 1"
  ).get(uid, packDate);
  if (fallback) {
    if (theme && fallback.theme !== theme) {
      return undefined;
    }
    console.log(`[DailyPack Row Fallback] userId=${uid} matched today's ready pack via fallback instead of exact signature.`);
    return fallback;
  }
  return undefined;
}

function getFallbackFlawVocab() {
  return [
    { word: 'fallacy', ipa: '/ˈfæləsi/', pronunciation_note: '指出逻辑漏洞', meaning_zh: '谬误', example: 'We must identify the logical fallacy in their pricing argument.' },
    { word: 'counterproductive', ipa: '/ˌkaʊntərprəˈdʌktɪv/', pronunciation_note: '指出提案弊端', meaning_zh: '适得其反', example: 'That concession would be counterproductive to our long-term strategy.' },
    { word: 'ambiguity', ipa: '/ˌæmbɪˈɡjuːəti/', pronunciation_note: '要求澄清模糊表述', meaning_zh: '模糊性', example: 'There is too much ambiguity in your delivery timeline.' },
    { word: 'oversimplification', ipa: '/ˌoʊvərsɪmplɪfɪˈkeɪʃn/', pronunciation_note: '指出以偏概全', meaning_zh: '过度简化', example: 'Your analysis is an oversimplification of a complex market dynamic.' },
    { word: 'deflection', ipa: '/dɪˈflekʃn/', pronunciation_note: '识别转移话题', meaning_zh: '转移', example: 'That answer is a deflection from the core pricing issue.' },
    { word: 'inconsistency', ipa: '/ˌɪnkənˈsɪstənsi/', pronunciation_note: '指出前后矛盾', meaning_zh: '不一致', example: 'There is an inconsistency between your Q1 forecast and today\'s claim.' },
  ];
}

function getUserVocabWords(db) {
  const rows = db.prepare('SELECT word FROM vocabulary ORDER BY added_at DESC').all();
  return rows.map((r) => String(r.word || '').toLowerCase().trim()).filter(Boolean);
}

function buildFlawDisplayWords(rawVocab, dbWordStrings, sessionExclude = []) {
  const filtered = (rawVocab || []).filter((item) => {
    const wLower = String(item.word || '').toLowerCase().trim();
    return wLower && !dbWordStrings.includes(wLower) && !sessionExclude.includes(wLower);
  });
  let finalWords = [...filtered];
  const fallbackList = getFallbackFlawVocab();
  for (const fb of fallbackList) {
    if (finalWords.length >= 6) break;
    const fbLower = fb.word.toLowerCase();
    if (!dbWordStrings.includes(fbLower) && !finalWords.some((w) => w.word.toLowerCase() === fbLower)) {
      finalWords.push(fb);
    }
  }
  if (finalWords.length < 6) {
    for (const fb of fallbackList) {
      if (finalWords.length >= 6) break;
      const fbLower = fb.word.toLowerCase();
      if (!finalWords.some((w) => w.word.toLowerCase() === fbLower)) finalWords.push(fb);
    }
  }
  return finalWords.slice(0, 6);
}

function getSystemFormattedTime(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: PACK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const val = (type) => parts.find((p) => p.type === type)?.value || '';
  const weekdayMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  // getDay() is local machine weekday; for Asia/Shanghai pack TZ use formatter weekday if available
  const shanghaiWeekday = new Intl.DateTimeFormat('en-US', { timeZone: PACK_TZ, weekday: 'short' }).format(now);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayIdx = map[shanghaiWeekday] ?? now.getDay();
  return `${val('year')}-${val('month')}-${val('day')} ${val('hour')}:${val('minute')}:${val('second')} ${weekdayMap[dayIdx]}`;
}

function getUserCurrentProfile(db, userId) {
  const uid = normalizeUserId(userId);
  try {
    const row = db.prepare('SELECT profile_content FROM user_memories WHERE user_id = ?').get(uid);
    return String(row?.profile_content || '').trim().slice(0, 280);
  } catch {
    return '';
  }
}

function getHistoryExclude(db) {
  const dbWords = getUserVocabWords(db);
  return dbWords.slice(0, 50).join(', ');
}

async function callWakeupWorkflow({ theme, userId, historyExclude = '', userCurrentProfile = '' }) {
  const apiKey = process.env.DIFY_WAKEUP_API_KEY || process.env.VITE_DIFY_WAKEUP_API_KEY;
  if (!apiKey) throw new Error('DIFY_WAKEUP_API_KEY not configured');
  const baseUrl = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  const inputs = {
    theme,
    history_exclude: historyExclude || '',
    user_current_profile: userCurrentProfile || '',
    _system_time: getSystemFormattedTime(),
    _system_timestamp_ms: Date.now(),
  };
  const res = await fetch(`${baseUrl}/workflows/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs,
      response_mode: 'blocking',
      user: normalizeUserId(userId),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `Dify HTTP ${res.status}`);
  const raw = data?.data?.outputs?.wakeup_json ?? data?.data?.outputs?.result ?? data?.answer ?? '';
  const clean = String(raw).replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
}

async function generateFlawVocabForUser(db, userId, themeOverride) {
  const dbWords = getUserVocabWords(db);
  const apiExclude = dbWords.slice(-50).join(', ');
  const todayStr = getPackDate();
  const randomSalt = Math.floor(Math.random() * 10000);
  const randomFocus = FLAW_SUB_THEMES[Math.floor(Math.random() * FLAW_SUB_THEMES.length)];
  const userTheme = String(themeOverride || '').trim();
  const dynamicTheme = userTheme
    ? `${userTheme} | identifying logical flaws and business counterattack (Focus: ${randomFocus}, Date: ${todayStr}, Salt: ${randomSalt})`
    : `identifying logical flaws and business counterattack (Focus: ${randomFocus}, Date: ${todayStr}, Salt: ${randomSalt})`;
  const profile = getUserCurrentProfile(db, userId);
  try {
    const parsed = await callWakeupWorkflow({
      theme: dynamicTheme,
      userId,
      historyExclude: apiExclude,
      userCurrentProfile: profile,
    });
    return buildFlawDisplayWords(parsed.vocab || [], dbWords);
  } catch {
    return buildFlawDisplayWords([], dbWords);
  }
}

function upsertDailyPack(db, { userId, packDate, theme, inputSignature, wakeup, flawVocab, source, status, errorMessage }) {
  const uid = normalizeUserId(userId);
  const sig = inputSignature || '';
  const now = Date.now();
  // D1: 按 user_id + pack_date + input_signature 独立行
  const existing = db.prepare(
    'SELECT * FROM daily_packs WHERE user_id = ? AND pack_date = ? AND input_signature = ?'
  ).get(uid, packDate, sig);
  const wakeupJson = wakeup ? JSON.stringify(wakeup) : null;
  const flawVocabJson = flawVocab ? JSON.stringify(flawVocab) : null;
  const errorMsg = errorMessage || null;

  if (existing?.id) {
    db.prepare(`
      UPDATE daily_packs SET
        theme = ?,
        wakeup_json = ?,
        flaw_vocab_json = ?,
        source = ?,
        status = ?,
        error_message = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      theme,
      wakeupJson,
      flawVocabJson,
      source,
      status,
      errorMsg,
      now,
      existing.id,
    );
    return db.prepare(
      'SELECT * FROM daily_packs WHERE user_id = ? AND pack_date = ? AND input_signature = ?'
    ).get(uid, packDate, sig);
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO daily_packs (
      id, user_id, pack_date, theme, input_signature, wakeup_json, flaw_vocab_json,
      source, status, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    uid,
    packDate,
    theme,
    sig,
    wakeupJson,
    flawVocabJson,
    source,
    status,
    errorMsg,
    now,
    now,
  );
  return db.prepare(
    'SELECT * FROM daily_packs WHERE user_id = ? AND pack_date = ? AND input_signature = ?'
  ).get(uid, packDate, sig);
}

async function generateDailyPackForUser(db, userId, theme, source = 'cron') {
  const packDate = getPackDate();
  const uid = normalizeUserId(userId);
  // 生成前先计算稳定输入签名，后续所有 upsert 都使用同一个签名
  const historyExclude = getHistoryExclude(db);
  const profile = getUserCurrentProfile(db, uid);
  const inputSignature = computeInputSignature(theme, historyExclude, profile);
  upsertDailyPack(db, {
    userId: uid,
    packDate,
    theme,
    inputSignature,
    wakeup: null,
    flawVocab: null,
    source,
    status: 'generating',
    errorMessage: null,
  });
  try {
    const wakeup = await callWakeupWorkflow({
      theme,
      userId: uid,
      historyExclude,
      userCurrentProfile: profile,
    });
    const flawVocab = await generateFlawVocabForUser(db, uid, theme);
    return upsertDailyPack(db, {
      userId: uid,
      packDate,
      theme,
      inputSignature,
      wakeup,
      flawVocab,
      source,
      status: 'ready',
      errorMessage: null,
    });
  } catch (err) {
    upsertDailyPack(db, {
      userId: uid,
      packDate,
      theme,
      inputSignature,
      wakeup: null,
      flawVocab: null,
      source,
      status: 'failed',
      errorMessage: err.message || String(err),
    });
    throw err;
  }
}

function serializeDailyPack(row) {
  if (!row) return { success: true, status: 'missing' };
  return {
    success: true,
    packDate: row.pack_date,
    theme: row.theme,
    status: row.status,
    source: row.source,
    errorMessage: row.error_message || null,
    wakeup: row.wakeup_json ? JSON.parse(row.wakeup_json) : null,
    flawVocab: row.flaw_vocab_json ? JSON.parse(row.flaw_vocab_json) : null,
  };
}

function computeDailyArticleInputSignature({ topic, materialText, userId, cefrLevel, genre, duration }) {
  const payload = {
    topic: (topic || '').trim(),
    materialText: (materialText || '').trim(),
    userId: normalizeUserId(userId),
    cefrLevel: String(cefrLevel || 'B1'),
    genre: String(genre || 'meeting'),
    duration: String(duration || '25'),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** L1: 长文 Dify 稳定入参签名（不含 _system_*） */
function computeListenArticleInputSignature({
  theme,
  genre,
  cefrLevel,
  duration,
  historyExclude = '',
  userFlaws = '',
  userCurrentProfile = '',
}) {
  const stable = JSON.stringify({
    theme: String(theme || '').trim(),
    genre: String(genre || '').trim(),
    cefr_level: String(cefrLevel || '').trim(),
    duration: String(duration ?? ''),
    history_exclude: String(historyExclude || '').trim(),
    user_flaws: String(userFlaws || '').trim(),
    user_current_profile: String(userCurrentProfile || '').trim(),
  });
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

function requestLocalJson(method, urlPath, payload = null, port = process.env.PORT || 3001) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const data = payload == null ? null : JSON.stringify(payload);
    const headers = { Accept: 'application/json' };
    if (data != null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: urlPath,
      method,
      headers,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode, json });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body.substring(0, 100)}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (data != null) req.write(data);
    req.end();
  });
}

function postLocalJson(urlPath, payload, port = process.env.PORT || 3001) {
  return requestLocalJson('POST', urlPath, payload, port).then(({ statusCode, json }) => {
    if (statusCode >= 200 && statusCode < 300 && json.success !== false) {
      return json;
    }
    throw new Error(json.error || json.message || `HTTP ${statusCode}`);
  });
}

async function waitForExtractTask(taskId, {
  port = process.env.PORT || 3001,
  timeoutMs = Number(process.env.DAILY_EXTRACT_AWAIT_TIMEOUT_MS || 10 * 60 * 1000),
  pollMs = 2000,
} = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { statusCode, json } = await requestLocalJson(
      'GET',
      `/api/english/daily-extract/status/${encodeURIComponent(taskId)}`,
      null,
      port,
    );
    if (statusCode === 404) {
      throw new Error('task_lost');
    }
    const status = json.status || (json.success === false ? 'failed' : null);
    if (status === 'completed') {
      return { status: 'completed', data: json };
    }
    if (status === 'failed') {
      throw new Error(json.error || 'extract failed');
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error('timeout');
}

async function generateLongArticleForUser(db, userId, theme, source = 'cron', genre = 'meeting', cefrLevel = 'B1', duration = '25') {
  const uid = normalizeUserId(userId);
  const packDate = getPackDate();
  const port = process.env.PORT || 3001;

  console.log(`[LongArticle Service] Starting long article generation for user=${uid}, theme="${theme}", genre=${genre}, cefr=${cefrLevel}, duration=${duration}`);

  try { db.prepare("ALTER TABLE daily_extracted_articles ADD COLUMN duration TEXT DEFAULT '25'").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE daily_extracted_articles ADD COLUMN input_signature TEXT DEFAULT ''").run(); } catch (e) {}

  let existing;
  try {
    existing = db.prepare(
      'SELECT id FROM daily_extracted_articles WHERE user_id = ? AND quota_date = ? AND genre = ? AND cefr_level = ? AND duration = ?'
    ).get(uid, packDate, genre, cefrLevel, String(duration));
  } catch (e) {
    existing = db.prepare(
      'SELECT id FROM daily_extracted_articles WHERE user_id = ? AND quota_date = ? AND genre = ? AND cefr_level = ?'
    ).get(uid, packDate, genre, cefrLevel);
  }

  if (existing) {
    console.log(`[LongArticle Service] Skipped user=${uid} - already generated for ${packDate} (${genre}/${cefrLevel}/${duration})`);
    return { success: true, status: 'skipped', reason: 'already_generated' };
  }

  let attempts = 0;
  while (attempts < 2) {
    attempts++;
    try {
      // Cron/rerun adapter: accept taskId then await terminal; disable detached TTS sync
      const data = await postLocalJson('/api/english/daily-extract', {
        topic: theme,
        materialText: theme,
        userId: uid,
        cefrLevel,
        genre,
        duration: String(duration),
        user_current_profile: getUserCurrentProfile(db, uid),
        businessPackDate: packDate,
        skipListenAudioSync: source === 'cron' || source === 'user_rerun' || source === 'manual_api',
        triggerSource: source,
      }, port);

      if (!data?.taskId) {
        throw new Error('daily-extract missing taskId');
      }
      await waitForExtractTask(data.taskId, { port });

      console.log(`[LongArticle Service] Successfully completed long article task for user=${uid}`);
      return { success: true, data, taskId: data.taskId };
    } catch (err) {
      console.warn(`[LongArticle Service] Attempt ${attempts} failed for user=${uid}:`, err.message);
      if (attempts >= 2) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

module.exports = {
  PACK_TZ,
  FLAW_SUB_THEMES,
  normalizeUserId,
  computeInputSignature,
  computeDailyArticleInputSignature,
  computeListenArticleInputSignature,
  getPackDate,
  getShanghaiHourMinute,
  initDailyPackTables,
  upsertUserTheme,
  listUsersWithSyncedTheme,
  findUserDailyPackByDate,
  getDailyPackRow,
  getFallbackFlawVocab,
  buildFlawDisplayWords,
  getUserCurrentProfile,
  getHistoryExclude,
  generateFlawVocabForUser,
  generateDailyPackForUser,
  generateLongArticleForUser,
  waitForExtractTask,
  serializeDailyPack,
  upsertDailyPack,
  callWakeupWorkflow,
};
