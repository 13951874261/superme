const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dailyPackService = require('./dailyPackService');
const listenPrefsService = require('./listenPrefsService');
const { prepareLongArticleBody, isUsableLongArticle, stripThinkTags } = require('./difyStreamMerge');

const GENRES = ['meeting', 'news', 'podcast', 'reading'];
const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1'];
const DURATIONS = [1, 15, 25, 35]; // minutes
/** 登录补跑仅生成 1 分钟组合（4 体裁 × 4 等级 = 16）；全量时长留给 cron */
const LOGIN_CATCHUP_DURATIONS = [1];
const CAPACITY_BYTES = 1024 * 1024 * 1024; // 1024MB
const RETENTION_DAYS = 7;
const LOGIN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_CRON_THEME = '商务谈判：让步与施压';
/** 含首次，同一 run 精听失败最多尝试 3 次，避免每次重启空跑 */
const LISTEN_RESUME_MAX_ATTEMPTS = 3;

function resolveListenDurations(options = {}) {
  if (Array.isArray(options.durations) && options.durations.length > 0) {
    return options.durations.map((d) => Number(d)).filter((d) => Number.isFinite(d) && d > 0);
  }
  if (options.source === 'login-catchup') return [...LOGIN_CATCHUP_DURATIONS];
  return [...DURATIONS];
}

const ROOT = path.join(__dirname, '..');
const AUDIO_ROOT = path.join(ROOT, 'public', 'daily_listen_audio');
const ARTICLE_ROOT = path.join(ROOT, 'public', 'daily_long_articles');
const userListenTails = new Map();
const userCatchupTasks = new Map();
const CATCHUP_CONCURRENCY = 2;
const catchupQueue = [];
let activeCatchups = 0;

function ensureDirs() {
  for (const d of [AUDIO_ROOT, ARTICLE_ROOT]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function initDailyListenTables(db) {
  ensureDirs();
  db.prepare(`
    CREATE TABLE IF NOT EXISTS daily_extracted_articles (
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
      UNIQUE(user_id, quota_date, theme, genre, cefr_level, duration)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS user_login_logs (
      user_id TEXT NOT NULL,
      logged_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, logged_at)
    )
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_user_login_logs_user_time
    ON user_login_logs(user_id, logged_at DESC)
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS daily_listen_articles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      pack_date TEXT NOT NULL,
      theme TEXT NOT NULL,
      genre TEXT NOT NULL,
      cefr_level TEXT NOT NULL,
      duration INTEGER NOT NULL,
      body_text TEXT,
      vocab_json TEXT,
      phrases_json TEXT,
      file_path TEXT,
      status TEXT NOT NULL DEFAULT 'missing',
      source TEXT NOT NULL DEFAULT 'cron',
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, pack_date, theme, genre, cefr_level, duration)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS daily_listen_audios (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      pack_date TEXT NOT NULL,
      theme TEXT NOT NULL,
      genre TEXT NOT NULL,
      cefr_level TEXT NOT NULL,
      duration INTEGER NOT NULL,
      script_text TEXT,
      audio_path TEXT,
      audio_url TEXT,
      status TEXT NOT NULL DEFAULT 'missing',
      source TEXT NOT NULL DEFAULT 'cron',
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, pack_date, theme, genre, cefr_level, duration)
    )
  `).run();

  ensureListenInputSignatureSchema(db);
  ensureDailyExtractedArticlesSchema(db);
}

function ensureDailyExtractedArticlesSchema(db) {
  const tableSql = String(
    db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_extracted_articles'`).get()?.sql || ''
  );
  const needsRebuild =
    !tableSql ||
    !/UNIQUE\s*\(\s*user_id\s*,\s*quota_date\s*,\s*theme\s*,\s*genre\s*,\s*cefr_level\s*,\s*duration\s*\)/i.test(tableSql);

  if (needsRebuild && tableSql) {
    const cols = db.prepare(`PRAGMA table_info(daily_extracted_articles)`).all();
    if (!cols.some((c) => c.name === 'duration')) {
      db.exec(`ALTER TABLE daily_extracted_articles ADD COLUMN duration TEXT DEFAULT '25'`);
    }
    if (!cols.some((c) => c.name === 'input_signature')) {
      db.exec(`ALTER TABLE daily_extracted_articles ADD COLUMN input_signature TEXT DEFAULT ''`);
    }

    // Prefer GROUP BY + max(updated_at) over ROW_NUMBER for broader SQLite compatibility.
    const rebuild = db.transaction(() => {
      db.exec(`DROP TABLE IF EXISTS daily_extracted_articles_v2`);
      db.exec(`
        CREATE TABLE daily_extracted_articles_v2 (
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
          UNIQUE(user_id, quota_date, theme, genre, cefr_level, duration)
        );

        INSERT INTO daily_extracted_articles_v2
          (id,user_id,quota_date,theme,genre,cefr_level,article,words_json,phrases_json,sentences_json,duration,input_signature,created_at,updated_at)
        SELECT d.id, d.user_id, d.quota_date, d.theme, d.genre, d.cefr_level, d.article, d.words_json, d.phrases_json, d.sentences_json,
               COALESCE(d.duration,'25'), COALESCE(d.input_signature,''), d.created_at, d.updated_at
        FROM daily_extracted_articles d
        INNER JOIN (
          SELECT user_id, quota_date, theme, genre, cefr_level, COALESCE(duration,'25') AS dur,
                 MAX(COALESCE(updated_at, 0)) AS max_updated
          FROM daily_extracted_articles
          GROUP BY user_id, quota_date, theme, genre, cefr_level, COALESCE(duration,'25')
        ) keep ON keep.user_id = d.user_id
          AND keep.quota_date = d.quota_date
          AND keep.theme = d.theme
          AND keep.genre = d.genre
          AND keep.cefr_level = d.cefr_level
          AND keep.dur = COALESCE(d.duration,'25')
          AND keep.max_updated = COALESCE(d.updated_at, 0)
        WHERE d.rowid = (
          SELECT d2.rowid FROM daily_extracted_articles d2
          WHERE d2.user_id = d.user_id
            AND d2.quota_date = d.quota_date
            AND d2.theme = d.theme
            AND d2.genre = d.genre
            AND d2.cefr_level = d.cefr_level
            AND COALESCE(d2.duration,'25') = COALESCE(d.duration,'25')
            AND COALESCE(d2.updated_at, 0) = COALESCE(d.updated_at, 0)
          ORDER BY COALESCE(d2.created_at, 0) DESC, d2.rowid DESC
          LIMIT 1
        );

        DROP TABLE daily_extracted_articles;
        ALTER TABLE daily_extracted_articles_v2 RENAME TO daily_extracted_articles;
      `);
    });
    rebuild();
  } else if (!tableSql) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS daily_extracted_articles (
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
        UNIQUE(user_id, quota_date, theme, genre, cefr_level, duration)
      )
    `).run();
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dea_user_date_dims
      ON daily_extracted_articles(user_id, quota_date, theme, genre, cefr_level, duration);
    CREATE INDEX IF NOT EXISTS idx_dea_user_date_sig
      ON daily_extracted_articles(user_id, quota_date, input_signature);
  `);
}

function ensureListenInputSignatureSchema(db) {
  for (const table of ['daily_listen_articles', 'daily_listen_audios']) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some((c) => c.name === 'input_signature')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN input_signature TEXT NOT NULL DEFAULT ''`);
    }
  }

  const articleSql = String(
    db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_listen_articles'`).get()?.sql || '',
  );
  if (articleSql && !/input_signature/i.test(articleSql.split('UNIQUE')[1] || '')) {
    db.exec(`
      CREATE TABLE daily_listen_articles_l1 (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        pack_date TEXT NOT NULL,
        theme TEXT NOT NULL,
        genre TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        duration INTEGER NOT NULL,
        body_text TEXT,
        vocab_json TEXT,
        phrases_json TEXT,
        file_path TEXT,
        status TEXT NOT NULL DEFAULT 'missing',
        source TEXT NOT NULL DEFAULT 'cron',
        error_message TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        input_signature TEXT NOT NULL DEFAULT '',
        UNIQUE(user_id, pack_date, theme, genre, cefr_level, duration, input_signature)
      );
      INSERT INTO daily_listen_articles_l1
        (id,user_id,pack_date,theme,genre,cefr_level,duration,body_text,vocab_json,phrases_json,file_path,status,source,error_message,created_at,updated_at,input_signature)
      SELECT id,user_id,pack_date,theme,genre,cefr_level,duration,body_text,vocab_json,phrases_json,file_path,status,source,error_message,created_at,updated_at,COALESCE(input_signature,'')
      FROM daily_listen_articles;
      DROP TABLE daily_listen_articles;
      ALTER TABLE daily_listen_articles_l1 RENAME TO daily_listen_articles;
    `);
  }

  const audioSql = String(
    db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_listen_audios'`).get()?.sql || '',
  );
  if (audioSql && !/input_signature/i.test(audioSql.split('UNIQUE')[1] || '')) {
    db.exec(`
      CREATE TABLE daily_listen_audios_l1 (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        pack_date TEXT NOT NULL,
        theme TEXT NOT NULL,
        genre TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        duration INTEGER NOT NULL,
        script_text TEXT,
        audio_path TEXT,
        audio_url TEXT,
        status TEXT NOT NULL DEFAULT 'missing',
        source TEXT NOT NULL DEFAULT 'cron',
        error_message TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        input_signature TEXT NOT NULL DEFAULT '',
        UNIQUE(user_id, pack_date, theme, genre, cefr_level, duration, input_signature)
      );
      INSERT INTO daily_listen_audios_l1
        (id,user_id,pack_date,theme,genre,cefr_level,duration,script_text,audio_path,audio_url,status,source,error_message,created_at,updated_at,input_signature)
      SELECT id,user_id,pack_date,theme,genre,cefr_level,duration,script_text,audio_path,audio_url,status,source,error_message,created_at,updated_at,COALESCE(input_signature,'')
      FROM daily_listen_audios;
      DROP TABLE daily_listen_audios;
      ALTER TABLE daily_listen_audios_l1 RENAME TO daily_listen_audios;
    `);
  }
}

function recordUserLogin(db, userId, at = Date.now()) {
  const uid = dailyPackService.normalizeUserId(userId);
  db.prepare(`
    INSERT OR IGNORE INTO user_login_logs (user_id, logged_at) VALUES (?, ?)
  `).run(uid, at);
  // keep last 30 days of pings per user to bound growth
  const cutoff = at - 30 * 24 * 60 * 60 * 1000;
  db.prepare(`DELETE FROM user_login_logs WHERE user_id = ? AND logged_at < ?`).run(uid, cutoff);
  return { userId: uid, loggedAt: at };
}

function listEligibleUsers(db, now = Date.now(), windowMs = LOGIN_WINDOW_MS) {
  const since = now - windowMs;
  return db.prepare(`
    SELECT p.user_id, p.theme
    FROM user_theme_prefs p
    WHERE p.theme IS NOT NULL AND TRIM(p.theme) != ''
      AND EXISTS (
        SELECT 1 FROM user_login_logs l
        WHERE l.user_id = p.user_id AND l.logged_at >= ?
      )
  `).all(since);
}

/**
 * R3 统一选人：近 N 天登录且有 theme；若为空则回退「最近登录 1 人」。
 * A2：不合并账号别名，按字面 user_id。
 */
function listCronTargetUsers(db, now = Date.now(), { windowMs = LOGIN_WINDOW_MS, defaultTheme = DEFAULT_CRON_THEME } = {}) {
  const primary = listEligibleUsers(db, now, windowMs);
  if (primary.length > 0) {
    return primary.map((row) => ({
      user_id: row.user_id,
      theme: row.theme,
      fallback: false,
    }));
  }

  const latest = db.prepare(`
    SELECT user_id, MAX(logged_at) AS last_login
    FROM user_login_logs
    GROUP BY user_id
    ORDER BY last_login DESC
    LIMIT 1
  `).get();
  if (!latest?.user_id) return [];

  const pref = db.prepare(`
    SELECT theme FROM user_theme_prefs
    WHERE user_id = ? AND theme IS NOT NULL AND TRIM(theme) != ''
  `).get(latest.user_id);

  return [{
    user_id: latest.user_id,
    theme: pref?.theme || defaultTheme,
    fallback: true,
  }];
}

function isCacheableDuration(duration) {
  return DURATIONS.includes(Number(duration));
}

function comboKeyParts({ userId, packDate, theme, genre, cefrLevel, duration, historyExclude, userFlaws, userCurrentProfile, inputSignature }) {
  const themeVal = String(theme || '').trim();
  const genreVal = String(genre || '').trim();
  const cefrVal = String(cefrLevel || '').trim();
  const durationVal = Number(duration);
  const historyVal = String(historyExclude || '').trim();
  const flawsVal = String(userFlaws || '').trim();
  const profileVal = String(userCurrentProfile || '').trim();
  const sig = inputSignature || dailyPackService.computeListenArticleInputSignature({
    theme: themeVal,
    genre: genreVal,
    cefrLevel: cefrVal,
    duration: durationVal,
    historyExclude: historyVal,
    userFlaws: flawsVal,
    userCurrentProfile: profileVal,
  });
  return {
    userId: dailyPackService.normalizeUserId(userId),
    packDate,
    theme: themeVal,
    genre: genreVal,
    cefrLevel: cefrVal,
    duration: durationVal,
    historyExclude: historyVal,
    userFlaws: flawsVal,
    userCurrentProfile: profileVal,
    inputSignature: sig,
  };
}

function getListenRowByCombo(db, tableName, parts) {
  const table = tableName === 'daily_listen_audios'
    ? 'daily_listen_audios'
    : 'daily_listen_articles';
  // 查询不带画像签名：账号 + 日期 + 主题 + 题材 + 难度 + 时长。
  // 同一组合优先 ready，否则取 generating/failed 占位行，供 upsert 更新而不是再 INSERT。
  return db.prepare(`
    SELECT * FROM ${table}
    WHERE user_id=? AND pack_date=? AND theme=? AND genre=? AND cefr_level=? AND duration=?
    ORDER BY CASE status
      WHEN 'ready' THEN 0
      WHEN 'generating' THEN 1
      WHEN 'failed' THEN 2
      ELSE 3
    END, created_at DESC
    LIMIT 1
  `).get(
    parts.userId, parts.packDate, parts.theme, parts.genre, parts.cefrLevel, parts.duration,
  );
}

function getListenRowByComboLoose(db, tableName, parts) {
  const exact = getListenRowByCombo(db, tableName, parts);
  const table = tableName === 'daily_listen_audios'
    ? 'daily_listen_audios'
    : 'daily_listen_articles';
  let loose = null;
  try {
    loose = db.prepare(`
      SELECT * FROM ${table}
      WHERE user_id=? AND pack_date=? AND genre=? AND cefr_level=? AND duration=?
      ORDER BY CASE status
        WHEN 'ready' THEN 0
        WHEN 'generating' THEN 1
        WHEN 'failed' THEN 2
        ELSE 3
      END, created_at DESC
      LIMIT 1
    `).get(
      parts.userId, parts.packDate, parts.genre, parts.cefrLevel, parts.duration,
    );
  } catch {
    loose = null;
  }
  if (exact && exact.status === 'ready') return exact;
  if (loose && loose.status === 'ready') return loose;
  return exact || loose;
}

function getArticleRow(db, parts) {
  return getListenRowByCombo(db, 'daily_listen_articles', parts);
}

function getAudioRow(db, parts) {
  return getListenRowByCombo(db, 'daily_listen_audios', parts);
}

function extractedArticleText(row) {
  return String(row?.article || row?.article_text || row?.material_text || row?.body_text || '').trim();
}

function getExtractedArticleRow(db, parts) {
  if (!db || typeof db.prepare !== 'function') return null;
  try {
    const exact = db.prepare(`
      SELECT * FROM daily_extracted_articles
      WHERE user_id=? AND quota_date=? AND theme=? AND genre=? AND cefr_level=?
        AND (CAST(duration AS TEXT)=? OR duration=?)
      ORDER BY updated_at DESC LIMIT 1
    `).get(
      parts.userId,
      parts.packDate,
      parts.theme,
      parts.genre,
      parts.cefrLevel,
      String(parts.duration),
      parts.duration,
    );
    if (extractedArticleText(exact)) return exact;
    const loose = db.prepare(`
      SELECT * FROM daily_extracted_articles
      WHERE user_id=? AND quota_date=? AND genre=? AND cefr_level=?
        AND (CAST(duration AS TEXT)=? OR duration=?)
      ORDER BY updated_at DESC LIMIT 1
    `).get(
      parts.userId,
      parts.packDate,
      parts.genre,
      parts.cefrLevel,
      String(parts.duration),
      parts.duration,
    );
    return extractedArticleText(loose) ? loose : null;
  } catch {
    return null;
  }
}

function fileOk(p) {
  return p && fs.existsSync(p) && fs.statSync(p).size > 0;
}

function resolveArticleStatus(row) {
  if (!row) return 'missing';
  if (row.status === 'generating') return 'generating';
  if (row.status === 'failed') return 'failed';
  if (row.status === 'ready') {
    if (fileOk(row.file_path) || row.body_text) return 'ready';
    return 'missing';
  }
  return row.status || 'missing';
}

function resolveAudioStatus(row) {
  if (!row) return 'missing';
  if (row.status === 'generating') return 'generating';
  if (row.status === 'failed') return 'failed';
  if (row.status === 'ready') {
    if (fileOk(row.audio_path) || row.audio_url) return 'ready';
    return 'missing';
  }
  return row.status || 'missing';
}

function getPregeneratedCombo(db, raw) {
  const packDate = raw.date || dailyPackService.getPackDate();
  const parts = comboKeyParts({ ...raw, packDate, cefrLevel: raw.cefrLevel || raw.cefr });
  if (!isCacheableDuration(parts.duration)) {
    return { success: true, status: 'uncached_duration', canBackfill: false, packDate };
  }
  const articleRow = getListenRowByComboLoose(db, 'daily_listen_articles', parts);
  const audioRow = getListenRowByComboLoose(db, 'daily_listen_audios', parts);
  const articleStatus = resolveArticleStatus(articleRow);
  const audioStatus = resolveAudioStatus(audioRow);

  let status = 'missing';
  if (articleStatus === 'ready' && audioStatus === 'ready') status = 'ready';
  else if (articleStatus === 'generating' || audioStatus === 'generating') status = 'generating';
  else if (articleStatus === 'ready' || audioStatus === 'ready') status = 'partial';
  else if (articleStatus === 'failed' || audioStatus === 'failed') status = 'failed';

  const canBackfill = status === 'missing' || status === 'failed' || status === 'partial';

  return {
    success: true,
    status,
    canBackfill,
    packDate,
    articleStatus,
    audioStatus,
    article: articleStatus === 'ready' ? {
      body: articleRow.body_text,
      vocab: articleRow.vocab_json ? JSON.parse(articleRow.vocab_json) : [],
      phrases: articleRow.phrases_json ? JSON.parse(articleRow.phrases_json) : [],
      fileUrl: articleRow.file_path
        ? `/api/daily_long_articles/${path.relative(ARTICLE_ROOT, articleRow.file_path).replace(/\\/g, '/')}`
        : null,
    } : null,
    audio: audioStatus === 'ready' ? {
      script: audioRow.script_text,
      audioUrl: audioRow.audio_url,
    } : null,
  };
}

const listenSyncInflight = new Map();

function listenSyncKey(parts) {
  return `${parts.userId}|${parts.packDate}|${parts.genre}|${parts.cefrLevel}|${parts.duration}`;
}

function startListenSyncFromLongArticleIfNeeded(db, raw) {
  const packDate = raw.date || raw.packDate || dailyPackService.getPackDate();
  const parts = comboKeyParts({
    ...raw,
    packDate,
    cefrLevel: raw.cefrLevel || raw.cefr,
  });
  const comboRaw = { ...raw, date: packDate, cefrLevel: parts.cefrLevel };
  const combo = getPregeneratedCombo(db, comboRaw);
  if (combo.status === 'ready' || combo.status === 'generating' || !isCacheableDuration(parts.duration)) {
    return { started: false, combo, promise: Promise.resolve(combo) };
  }
  const extracted = getExtractedArticleRow(db, parts);
  if (!extractedArticleText(extracted)) {
    return { started: false, combo, promise: Promise.resolve(combo) };
  }

  const key = listenSyncKey(parts);
  const existing = listenSyncInflight.get(key);
  if (existing) return existing;

  const syncParts = comboKeyParts({
    ...parts,
    theme: extracted.theme || parts.theme,
  });
  if (combo.articleStatus !== 'ready') {
    upsertArticle(db, syncParts, { status: 'generating', source: 'auto-sync' });
  }
  if (combo.audioStatus !== 'ready') {
    upsertAudio(db, syncParts, { status: 'generating', source: 'auto-sync' });
  }
  const only = combo.articleStatus === 'ready' ? 'audio' : 'both';
  const promise = module.exports.generateOneCombo(
    db,
    {
      userId: syncParts.userId,
      theme: syncParts.theme,
      genre: syncParts.genre,
      cefrLevel: syncParts.cefrLevel,
      duration: syncParts.duration,
      packDate,
    },
    { source: 'auto-sync', only },
  ).catch((err) => {
    console.warn(
      '[DailyListen] auto-sync from long article failed user=%s %s/%s/%sm: %s',
      parts.userId,
      parts.genre,
      parts.cefrLevel,
      parts.duration,
      err.message || String(err),
    );
    return getPregeneratedCombo(db, comboRaw);
  }).finally(() => {
    listenSyncInflight.delete(key);
  });

  const started = {
    started: true,
    combo: getPregeneratedCombo(db, comboRaw),
    promise,
  };
  listenSyncInflight.set(key, started);
  return started;
}

let generators = {
  generateLongScript: async () => { throw new Error('generateLongScript not injected'); },
  extractVocabFromArticle: null,
  synthesizeAudioFile: async (text, outputPath, ctx = {}) => {
    if (typeof global !== 'undefined' && typeof global.synthesizeAndSaveAudio === 'function') {
      const voiceId = ctx.voiceId || listenPrefsService.DEFAULT_LISTEN_VOICE_ID;
      const model = `edge-tts/${voiceId}`;
      const effects = listenPrefsService.CRON_FORCE_LISTEN_EFFECTS;
      await global.synthesizeAndSaveAudio(text, model, outputPath, null, null, { effects });
      return outputPath;
    }
    throw new Error('synthesizeAudioFile engine not injected');
  },
};

function setGenerators(partial) {
  generators = { ...generators, ...partial };
}

function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

/** 抽词超时（毫秒）。默认 90s；0=不超时；SKIP_EXTRACT_VOCAB=1 可跳过抽词 */
function getExtractVocabTimeoutMs() {
  const n = Number(process.env.EXTRACT_VOCAB_TIMEOUT_MS);
  if (Number.isFinite(n) && n >= 0) return n;
  return 90 * 1000;
}

async function raceWithTimeout(promise, ms, label) {
  if (!ms || ms <= 0) return promise;
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function upsertArticle(db, parts, fields) {
  const now = Date.now();
  const sig = parts.inputSignature || '';
  const existing = getArticleRow(db, parts);
  if (existing) {
    db.prepare(`
      UPDATE daily_listen_articles SET
        body_text=?, vocab_json=?, phrases_json=?, file_path=?, status=?, source=?, error_message=?,
        input_signature=?, updated_at=?
      WHERE id=?
    `).run(
      fields.body_text !== undefined ? fields.body_text : existing.body_text,
      fields.vocab_json !== undefined ? fields.vocab_json : existing.vocab_json,
      fields.phrases_json !== undefined ? fields.phrases_json : existing.phrases_json,
      fields.file_path !== undefined ? fields.file_path : existing.file_path,
      fields.status,
      fields.source !== undefined ? fields.source : existing.source,
      fields.error_message !== undefined ? fields.error_message : null,
      sig,
      now,
      existing.id,
    );
    return existing.id;
  }
  const id = newId();
  db.prepare(`
    INSERT INTO daily_listen_articles
    (id,user_id,pack_date,theme,genre,cefr_level,duration,body_text,vocab_json,phrases_json,file_path,status,source,error_message,created_at,updated_at,input_signature)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, parts.userId, parts.packDate, parts.theme, parts.genre, parts.cefrLevel, parts.duration,
    fields.body_text || null, fields.vocab_json || null, fields.phrases_json || null, fields.file_path || null,
    fields.status, fields.source || 'cron', fields.error_message || null, now, now, sig,
  );
  return id;
}

function upsertAudio(db, parts, fields) {
  const now = Date.now();
  const sig = parts.inputSignature || '';
  const existing = getAudioRow(db, parts);
  if (existing) {
    db.prepare(`
      UPDATE daily_listen_audios SET
        script_text=?, audio_path=?, audio_url=?, status=?, source=?, error_message=?,
        input_signature=?, updated_at=?
      WHERE id=?
    `).run(
      fields.script_text !== undefined ? fields.script_text : existing.script_text,
      fields.audio_path !== undefined ? fields.audio_path : existing.audio_path,
      fields.audio_url !== undefined ? fields.audio_url : existing.audio_url,
      fields.status,
      fields.source !== undefined ? fields.source : existing.source,
      fields.error_message !== undefined ? fields.error_message : null,
      sig,
      now,
      existing.id,
    );
    return existing.id;
  }
  const id = newId();
  db.prepare(`
    INSERT INTO daily_listen_audios
    (id,user_id,pack_date,theme,genre,cefr_level,duration,script_text,audio_path,audio_url,status,source,error_message,created_at,updated_at,input_signature)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, parts.userId, parts.packDate, parts.theme, parts.genre, parts.cefrLevel, parts.duration,
    fields.script_text || null, fields.audio_path || null, fields.audio_url || null,
    fields.status, fields.source || 'cron', fields.error_message || null, now, now, sig,
  );
  return id;
}

function stripMarkdownJsonFence(text) {
  let clean = String(text || '').trim();
  if (clean.toLowerCase().startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  return clean.trim();
}

function normalizePhraseList(raw) {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    if (typeof p === 'string') return p;
    if (p && typeof p === 'object') return p.phrase || p.phrase_text || p.text || p.word || '';
    return '';
  }).map((s) => String(s).trim()).filter(Boolean);
}

function normalizeSentenceList(raw) {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    if (typeof s === 'string') return s;
    if (s && typeof s === 'object') return s.sentence || s.word || s.text || '';
    return '';
  }).map((s) => String(s).trim()).filter(Boolean);
}

function parseVocabFromRaw(raw) {
  const empty = { vocab: [], phrases: [], sentences: [] };
  if (!raw || typeof raw !== 'string') return empty;

  const fromParsed = (parsed) => {
    let vocab = [];
    if (Array.isArray(parsed)) vocab = parsed;
    else if (parsed && Array.isArray(parsed.words)) vocab = parsed.words;
    else if (parsed && Array.isArray(parsed.vocab)) vocab = parsed.vocab;
    const phrases = normalizePhraseList(
      parsed && !Array.isArray(parsed) ? (parsed.phrases || parsed.phrase || []) : [],
    );
    const sentences = normalizeSentenceList(
      parsed && !Array.isArray(parsed) ? (parsed.sentences || []) : [],
    );
    return { vocab, phrases, sentences };
  };

  const tryParse = (jsonPart) => {
    try {
      let clean = stripMarkdownJsonFence(jsonPart);
      if (!clean.startsWith('{') && !clean.startsWith('[')) {
        const brace = clean.indexOf('{');
        const bracket = clean.indexOf('[');
        const start = [brace, bracket].filter((i) => i >= 0).sort((a, b) => a - b)[0];
        if (start == null) return null;
        clean = clean.slice(start);
      }
      const lastObj = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'));
      if (lastObj >= 0) clean = clean.slice(0, lastObj + 1);
      return fromParsed(JSON.parse(clean));
    } catch {
      return null;
    }
  };

  // 1) 标准标记块
  const m = raw.split(/---VOCAB_JSON_START---/i);
  if (m.length >= 2) {
    const got = tryParse(m[1].split(/---VOCAB_JSON_END---/i)[0]);
    if (got && (got.vocab.length || got.phrases.length || got.sentences.length)) return got;
  }

  // 2) 兜底：全文里找带 words/phrases 的 JSON 对象
  const candidates = raw.match(/\{[\s\S]{20,}?\}/g) || [];
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const got = tryParse(candidates[i]);
    if (got && (got.vocab.length || got.phrases.length || got.sentences.length)) return got;
  }

  return empty;
}

function upsertExtractedArticleMirror(db, parts, {
  body,
  vocab = [],
  phrases = [],
  sentences = [],
} = {}) {
  if (!db || typeof db.prepare !== 'function') return;
  try {
    const now = Date.now();
    const durationVal = String(parts.duration);
    const sig = parts.inputSignature || '';
    const existing = db.prepare(`
      SELECT id FROM daily_extracted_articles
      WHERE user_id=? AND quota_date=? AND theme=? AND genre=? AND cefr_level=?
        AND (duration=? OR duration=?) AND COALESCE(input_signature,'')=?
      ORDER BY updated_at DESC LIMIT 1
    `).get(
      parts.userId,
      parts.packDate,
      parts.theme,
      parts.genre,
      parts.cefrLevel,
      durationVal,
      parts.duration,
      sig,
    );
    const id = existing?.id || crypto.randomUUID();
    db.prepare(`
      INSERT OR REPLACE INTO daily_extracted_articles (
        id, user_id, quota_date, theme, genre, cefr_level, article,
        words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      parts.userId,
      parts.packDate,
      parts.theme,
      parts.genre,
      parts.cefrLevel,
      body || '',
      JSON.stringify(vocab || []),
      JSON.stringify(phrases || []),
      JSON.stringify(sentences || []),
      durationVal,
      sig,
      now,
      now,
    );
  } catch (e) {
    console.warn('[DailyListen] mirror daily_extracted_articles failed:', e.message);
  }
}

async function generateOneCombo(db, raw, { source = 'cron', only = 'both' } = {}) {
  const packDate = raw.packDate || dailyPackService.getPackDate();
  const historyExclude = raw.historyExclude !== undefined
    ? String(raw.historyExclude || '').trim()
    : dailyPackService.getHistoryExclude(db);
  const userFlaws = String(raw.userFlaws || '').trim();
  const userCurrentProfile = raw.userCurrentProfile !== undefined
    ? String(raw.userCurrentProfile || '').trim()
    : dailyPackService.getUserCurrentProfile(db, raw.userId);
  const parts = comboKeyParts({
    ...raw,
    packDate,
    cefrLevel: raw.cefrLevel || raw.cefr,
    historyExclude,
    userFlaws,
    userCurrentProfile,
  });
  if (!isCacheableDuration(parts.duration)) throw new Error('duration not cacheable');

  const userDirA = path.join(ARTICLE_ROOT, parts.userId);
  const userDirAu = path.join(AUDIO_ROOT, parts.userId);
  fs.mkdirSync(userDirA, { recursive: true });
  fs.mkdirSync(userDirAu, { recursive: true });
  const baseName = `${packDate}_${parts.genre}_${parts.cefrLevel}_${parts.duration}m`;

  const extracted = getExtractedArticleRow(db, parts);
  if (extracted && String(extracted.article || extracted.article_text || extracted.material_text || extracted.body_text || '').trim()) {
    const existingCombo = getPregeneratedCombo(db, { ...parts, date: packDate, cefrLevel: parts.cefrLevel });
    if (only === 'both' && existingCombo.status === 'ready') return existingCombo;
    if (only === 'audio' && existingCombo.audioStatus === 'ready') return existingCombo;
    if (only === 'article' && existingCombo.articleStatus === 'ready') return existingCombo;
    if (only === 'article') {
      const scriptText = extracted.article || extracted.article_text || extracted.material_text || extracted.body_text;
      const txtPath = path.join(userDirA, `${baseName}.txt`);
      fs.writeFileSync(txtPath, scriptText, 'utf8');
      upsertArticle(db, parts, {
        status: 'ready',
        source,
        body_text: scriptText,
        vocab_json: extracted.words_json || extracted.extracted_words_json || '[]',
        phrases_json: extracted.phrases_json || extracted.extracted_phrases_json || '[]',
        file_path: txtPath,
      });
      return getPregeneratedCombo(db, { ...parts, date: packDate, cefrLevel: parts.cefrLevel });
    }
    await syncAudioFromLongArticleRow(db, extracted, source);
    return getPregeneratedCombo(db, { ...parts, date: packDate, cefrLevel: parts.cefrLevel });
  }

  let script = null;
  if (only === 'both' || only === 'article') {
    upsertArticle(db, parts, { status: 'generating', source });
    try {
      const rawScript = await generators.generateLongScript({
        theme: parts.theme,
        genre: parts.genre,
        cefr_level: parts.cefrLevel,
        duration: String(parts.duration),
        history_exclude: parts.historyExclude,
        user_flaws: parts.userFlaws,
        user_current_profile: parts.userCurrentProfile,
        userId: parts.userId,
      });
      script = typeof rawScript === 'string' ? rawScript : String(rawScript || '');
      if (!isUsableLongArticle(script)) {
        throw new Error('think_only_article');
      }
      let { vocab, phrases, sentences } = parseVocabFromRaw(stripThinkTags(script));
      const body = prepareLongArticleBody(script);

      // D-A: 正文优先落库 ready，抽词后置（带超时），避免 extract 卡死导致 generating 空 body
      const filePath = path.join(userDirA, `${baseName}.txt`);
      fs.writeFileSync(filePath, body, 'utf8');
      upsertArticle(db, parts, {
        status: 'ready',
        source,
        body_text: body,
        vocab_json: JSON.stringify(vocab || []),
        phrases_json: JSON.stringify(phrases || []),
        file_path: filePath,
      });
      upsertExtractedArticleMirror(db, parts, {
        body,
        vocab: vocab || [],
        phrases: phrases || [],
        sentences: sentences || [],
      });
      script = body;

      const needExtract = (!vocab || vocab.length === 0) && (!phrases || phrases.length === 0)
        && typeof generators.extractVocabFromArticle === 'function'
        && process.env.SKIP_EXTRACT_VOCAB !== '1';
      if (needExtract) {
        try {
          const timeoutMs = getExtractVocabTimeoutMs();
          console.log(
            `[DailyListen] extractVocab start user=${parts.userId} ${parts.genre}/${parts.cefrLevel}/${parts.duration}m timeoutMs=${timeoutMs}`,
          );
          const extracted = await raceWithTimeout(
            generators.extractVocabFromArticle({
              body,
              theme: parts.theme,
              genre: parts.genre,
              cefr_level: parts.cefrLevel,
              duration: String(parts.duration),
              userId: parts.userId,
            }),
            timeoutMs,
            'extractVocab',
          );
          if (extracted) {
            if (Array.isArray(extracted.vocab) && extracted.vocab.length) vocab = extracted.vocab;
            if (Array.isArray(extracted.phrases) && extracted.phrases.length) phrases = extracted.phrases;
            if (Array.isArray(extracted.sentences) && extracted.sentences.length) sentences = extracted.sentences;
          }
          if ((!vocab || vocab.length === 0) && (!phrases || phrases.length === 0)) {
            console.warn(
              `[DailyListen] vocab still empty after extract user=${parts.userId} `
              + `${parts.genre}/${parts.cefrLevel}/${parts.duration}m source=${source}`,
            );
          } else {
            console.log(
              `[DailyListen] vocab filled user=${parts.userId} `
              + `${parts.genre}/${parts.cefrLevel}/${parts.duration}m words=${vocab.length} phrases=${phrases.length}`,
            );
            upsertArticle(db, parts, {
              status: 'ready',
              source,
              body_text: body,
              vocab_json: JSON.stringify(vocab || []),
              phrases_json: JSON.stringify(phrases || []),
              file_path: filePath,
            });
            upsertExtractedArticleMirror(db, parts, {
              body,
              vocab: vocab || [],
              phrases: phrases || [],
              sentences: sentences || [],
            });
          }
        } catch (extractErr) {
          console.warn(
            `[DailyListen] extractVocabFromArticle failed user=${parts.userId} ${parts.genre}/${parts.cefrLevel}/${parts.duration}m:`,
            extractErr.message,
          );
        }
      }
    } catch (e) {
      upsertArticle(db, parts, { status: 'failed', source, error_message: e.message });
      throw e;
    }
  }

  if (only === 'both' || only === 'audio') {
    if (!script) {
      const art = getArticleRow(db, parts);
      script = art?.body_text;
      if (!script) throw new Error('article body required before audio');
    }
    upsertAudio(db, parts, { status: 'generating', source });
    try {
      const audioPath = path.join(userDirAu, `${baseName}.mp3`);
      const voiceId = listenPrefsService.getListenVoiceId(db, parts.userId);
      await generators.synthesizeAudioFile(script, audioPath, {
        userId: parts.userId,
        voiceId,
      });
      const audioUrl = `/api/daily_listen_audio/${parts.userId}/${baseName}.mp3`;
      upsertAudio(db, parts, {
        status: 'ready',
        source,
        script_text: script,
        audio_path: audioPath,
        audio_url: audioUrl,
      });
    } catch (e) {
      upsertAudio(db, parts, { status: 'failed', source, error_message: e.message });
      throw e;
    }
  }

  return getPregeneratedCombo(db, { ...parts, date: packDate });
}

/**
 * C3: 仅补词表（不重跑 TTS）。对已有 ready 正文调用 extractVocabFromArticle 后写回。
 */
async function backfillVocabForCombo(db, raw) {
  const packDate = raw.packDate || raw.date || dailyPackService.getPackDate();
  const parts = comboKeyParts({ ...raw, packDate, cefrLevel: raw.cefrLevel || raw.cefr });
  const art = getArticleRow(db, parts);
  if (!art || art.status !== 'ready' || !String(art.body_text || '').trim()) {
    return {
      success: false,
      error: 'ready article body required',
      articleStatus: art?.status || 'missing',
    };
  }

  let existingVocab = [];
  let existingPhrases = [];
  try { existingVocab = art.vocab_json ? JSON.parse(art.vocab_json) : []; } catch (_) {}
  try { existingPhrases = art.phrases_json ? JSON.parse(art.phrases_json) : []; } catch (_) {}
  if ((!raw.force) && existingVocab.length > 0 && existingPhrases.length > 0) {
    return {
      success: true,
      skipped: true,
      reason: 'vocab_already_present',
      vocabCount: existingVocab.length,
      phraseCount: existingPhrases.length,
    };
  }

  if (typeof generators.extractVocabFromArticle !== 'function') {
    return { success: false, error: 'extractVocabFromArticle not injected' };
  }

  const extracted = await generators.extractVocabFromArticle({
    body: art.body_text,
    theme: parts.theme,
    genre: parts.genre,
    cefr_level: parts.cefrLevel,
    duration: String(parts.duration),
    userId: parts.userId,
  });
  const vocab = Array.isArray(extracted?.vocab) ? extracted.vocab : [];
  const phrases = Array.isArray(extracted?.phrases) ? extracted.phrases : [];
  const sentences = Array.isArray(extracted?.sentences) ? extracted.sentences : [];

  if (vocab.length === 0 && phrases.length === 0) {
    console.warn(
      `[DailyListen] backfillVocab empty user=${parts.userId} `
      + `${parts.genre}/${parts.cefrLevel}/${parts.duration}m`,
    );
    return {
      success: false,
      error: 'extract returned empty vocab/phrases',
      vocabCount: 0,
      phraseCount: 0,
    };
  }

  upsertArticle(db, parts, {
    status: 'ready',
    source: art.source || 'backfill-vocab',
    body_text: art.body_text,
    vocab_json: JSON.stringify(vocab),
    phrases_json: JSON.stringify(phrases),
    file_path: art.file_path,
  });
  upsertExtractedArticleMirror(db, parts, {
    body: art.body_text,
    vocab,
    phrases,
    sentences,
  });

  return {
    success: true,
    skipped: false,
    vocabCount: vocab.length,
    phraseCount: phrases.length,
    sentenceCount: sentences.length,
  };
}

function writebackCombo(db, raw, { body, vocab, phrases, audioPath, audioUrl, script } = {}) {
  const packDate = raw.date || dailyPackService.getPackDate();
  const parts = comboKeyParts({ ...raw, packDate, cefrLevel: raw.cefrLevel || raw.cefr });
  if (!isCacheableDuration(parts.duration)) {
    return { success: false, error: 'uncached_duration' };
  }

  const baseName = `${packDate}_${parts.genre}_${parts.cefrLevel}_${parts.duration}m`;

  if (body != null) {
    const userDirA = path.join(ARTICLE_ROOT, parts.userId);
    fs.mkdirSync(userDirA, { recursive: true });
    const filePath = path.join(userDirA, `${baseName}.txt`);
    const bodyText = String(body);
    fs.writeFileSync(filePath, bodyText, 'utf8');
    const articleFields = {
      status: 'ready',
      source: 'manual',
      body_text: bodyText,
      file_path: filePath,
      error_message: null,
    };
    if (vocab !== undefined) articleFields.vocab_json = JSON.stringify(vocab || []);
    if (phrases !== undefined) articleFields.phrases_json = JSON.stringify(phrases || []);
    upsertArticle(db, parts, articleFields);
  }

  if (audioPath || audioUrl) {
    const audioFields = {
      status: 'ready',
      source: 'manual',
      error_message: null,
    };
    if (audioPath) audioFields.audio_path = audioPath;
    if (audioUrl) audioFields.audio_url = audioUrl;
    if (script != null) audioFields.script_text = String(script);
    else if (body != null) audioFields.script_text = String(body);
    upsertAudio(db, parts, audioFields);
  }

  return getPregeneratedCombo(db, { ...parts, date: packDate });
}

function dirSize(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else total += st.size;
    }
  };
  walk(dir);
  return total;
}

function unlinkQuiet(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
}

function cleanupDailyListenStorage(db, { capacityBytes = CAPACITY_BYTES } = {}) {
  const cutoffDate = (() => {
    const d = new Date(Date.now() - RETENTION_DAYS * 86400000);
    return dailyPackService.getPackDate(d);
  })();
  // pack_date is YYYY-MM-DD lexicographic comparable
  const oldArts = db.prepare(`SELECT * FROM daily_listen_articles WHERE pack_date < ?`).all(cutoffDate);
  const oldAuds = db.prepare(`SELECT * FROM daily_listen_audios WHERE pack_date < ?`).all(cutoffDate);
  for (const r of oldArts) {
    unlinkQuiet(r.file_path);
    db.prepare(`DELETE FROM daily_listen_articles WHERE id=?`).run(r.id);
  }
  for (const r of oldAuds) {
    unlinkQuiet(r.audio_path);
    db.prepare(`DELETE FROM daily_listen_audios WHERE id=?`).run(r.id);
  }

  let total = dirSize(AUDIO_ROOT) + dirSize(ARTICLE_ROOT);
  while (total > capacityBytes) {
    const oldestAudio = db.prepare(`SELECT * FROM daily_listen_audios ORDER BY created_at ASC LIMIT 1`).get();
    const oldestArt = db.prepare(`SELECT * FROM daily_listen_articles ORDER BY created_at ASC LIMIT 1`).get();
    if (!oldestAudio && !oldestArt) break;
    const pickAudio = oldestAudio && (!oldestArt || oldestAudio.created_at <= oldestArt.created_at);
    if (pickAudio) {
      unlinkQuiet(oldestAudio.audio_path);
      db.prepare(`DELETE FROM daily_listen_audios WHERE id=?`).run(oldestAudio.id);
    } else {
      unlinkQuiet(oldestArt.file_path);
      db.prepare(`DELETE FROM daily_listen_articles WHERE id=?`).run(oldestArt.id);
    }
    total = dirSize(AUDIO_ROOT) + dirSize(ARTICLE_ROOT);
  }
  return { cutoffDate, totalBytes: total };
}

async function runDailyListenForUser(
  db,
  user,
  {
    packDate = dailyPackService.getPackDate(),
    source = 'cron',
    skipReadyAudio = false,
    durations,
  } = {},
) {
  const userId = dailyPackService.normalizeUserId(user?.user_id || user?.userId || user);
  const theme = String(user?.theme || '').trim();
  let durationList = resolveListenDurations({ source, durations });
  const summary = {
    packDate,
    userId,
    source,
    durations: durationList,
    syncedFromArticles: 0,
    combosOk: 0,
    combosFail: 0,
    errors: [],
  };

  console.log(
    `[DailyListen] start user=${userId} date=${packDate} source=${source} durations=${durationList.join(',')}`,
  );

  // 选项 B 批次联动：在所有组合长文全量生成完毕后，统一按长文素材跑一遍音频合成批处理
  try {
    const syncRes = await batchSyncAudiosFromLongArticles(
      db,
      userId,
      packDate,
      source,
      { skipReadyAudio },
    );
    summary.syncedFromArticles += (syncRes?.success || 0);
  } catch (syncErr) {
    console.warn(`[DailyListen] Batch audio sync warning for user=${userId}:`, syncErr.message);
  }

  let genreList = GENRES;
  let cefrList = CEFR_LEVELS;

  // 取消 MVP_MODE 限制，支持 4体裁 x 4等级 x 4时长 共 64 种组合精听生成

  for (const genre of genreList) {
    for (const cefrLevel of cefrList) {
      for (const duration of durationList) {
        const existing = module.exports.getPregeneratedCombo(db, {
          userId, theme, genre, cefrLevel, duration, date: packDate,
        });
        if (existing.status === 'ready') continue;
        console.log(
          `[DailyListen] combo start user=${userId} ${genre}/${cefrLevel}/${duration}m source=${source}`,
        );
        try {
          await module.exports.generateOneCombo(db, {
            userId, theme, genre, cefrLevel, duration, packDate,
          }, { source });
          summary.combosOk += 1;
          console.log(
            `[DailyListen] combo ok user=${userId} ${genre}/${cefrLevel}/${duration}m source=${source}`,
          );
        } catch (e) {
          summary.combosFail += 1;
          summary.errors.push({ userId, genre, cefrLevel, duration, error: e.message });
          console.error(
            `[DailyListen] combo fail user=${userId} ${genre}/${cefrLevel}/${duration}m:`,
            e.message,
          );
        }
      }
    }
  }

  console.log(
    `[DailyListen] done user=${userId} source=${source} ok=${summary.combosOk} fail=${summary.combosFail}`,
  );
  return summary;
}

function drainCatchupQueue() {
  while (activeCatchups < CATCHUP_CONCURRENCY && catchupQueue.length > 0) {
    const item = catchupQueue.shift();
    activeCatchups++;
    Promise.resolve()
      .then(item.work)
      .then(item.resolve, item.reject)
      .finally(() => {
        activeCatchups--;
        drainCatchupQueue();
      });
  }
}

function enqueueCatchupTask(work) {
  return new Promise((resolve, reject) => {
    catchupQueue.push({ work, resolve, reject });
    drainCatchupQueue();
  });
}

function runCoordinatedUserListen(db, user, options) {
  const packDate = options.packDate;
  const userId = user?.user_id || user?.userId || user;
  const uid = dailyPackService.normalizeUserId(userId);
  const taskKey = `${uid}:${packDate}`;
  const previous = userListenTails.get(taskKey) || Promise.resolve();
  const task = previous
    .catch(() => undefined)
    .then(() => module.exports.runDailyListenForUser(db, user, options))
    .catch((error) => {
      console.error(`[Daily Listen Task] user=${uid} date=${packDate} failed:`, error);
      throw error;
    });

  userListenTails.set(taskKey, task);
  const cleanup = () => {
    if (userListenTails.get(taskKey) === task) {
      userListenTails.delete(taskKey);
    }
  };
  task.then(cleanup, cleanup);
  return task;
}

function createCatchupRecord(db, uid, theme, requestedDate) {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    db,
    uid,
    theme,
    requestedDate,
    executionDate: null,
    promise,
    resolve,
    reject,
  };
}

function startCatchupRecord(state, record) {
  state.active = record;
  const task = enqueueCatchupTask(async () => {
    const packDate = dailyPackService.getPackDate();
    record.executionDate = packDate;
    const pack = record.db.prepare(`
      SELECT * FROM daily_packs
      WHERE user_id = ? AND pack_date = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(record.uid, packDate);
    const packGenerated = pack?.status !== 'ready';
    if (packGenerated) {
      await dailyPackService.generateDailyPackForUser(
        record.db,
        record.uid,
        record.theme,
        'login-catchup',
      );
    }

    const listen = await runCoordinatedUserListen(
      record.db,
      { user_id: record.uid, theme: record.theme },
      {
        packDate,
        source: 'login-catchup',
        skipReadyAudio: true,
        durations: [...LOGIN_CATCHUP_DURATIONS],
      },
    );
    return {
      status: 'completed',
      userId: record.uid,
      packDate,
      packGenerated,
      listen,
    };
  });

  const advance = () => {
    if (state.active !== record) return;
    const nextEntry = state.followUps.entries().next();
    if (!nextEntry.done) {
      const [date, nextRecord] = nextEntry.value;
      state.followUps.delete(date);
      startCatchupRecord(state, nextRecord);
    } else if (userCatchupTasks.get(record.uid) === state) {
      userCatchupTasks.delete(record.uid);
    }
  };

  task.then(
    (result) => {
      record.resolve(result);
      advance();
    },
    (error) => {
      console.error(
        `[Daily User Task] user=${record.uid} date=${record.executionDate || record.requestedDate} failed:`,
        error,
      );
      record.reject(error);
      advance();
    },
  );
}

function scheduleUserDailyCatchup(db, { userId, theme }) {
  const uid = dailyPackService.normalizeUserId(userId);
  const requestedDate = dailyPackService.getPackDate();
  let state = userCatchupTasks.get(uid);
  if (state) {
    if (state.active.executionDate === null || state.active.executionDate === requestedDate) {
      return state.active.promise;
    }
    const pendingFollowUp = state.followUps.get(requestedDate);
    if (pendingFollowUp) return pendingFollowUp.promise;

    const followUp = createCatchupRecord(db, uid, theme, requestedDate);
    state.followUps.set(requestedDate, followUp);
    return followUp.promise;
  }

  state = { active: null, followUps: new Map() };
  userCatchupTasks.set(uid, state);
  const record = createCatchupRecord(db, uid, theme, requestedDate);
  startCatchupRecord(state, record);
  return record.promise;
}

async function runDailyListenCronJob(db, options = {}) {
  const dailyCronRunService = require('./dailyCronRunService');
  const packDate = dailyPackService.getPackDate();
  const cronTickId = options.cronTickId || null;

  // PRD: when cronTickId present, freeze user set from materialized runs ? never listCronTargetUsers
  let users;
  let fallback = false;
  if (cronTickId) {
    let ids = dailyCronRunService.listUserIdsForTick(db, cronTickId);
    if (options.userId) {
      const targetUid = dailyPackService.normalizeUserId(options.userId);
      ids = ids.filter(id => dailyPackService.normalizeUserId(id) === targetUid);
    }
    users = ids.map((user_id) => {
      const pref = db.prepare(`
        SELECT theme FROM user_theme_prefs
        WHERE user_id = ? AND theme IS NOT NULL AND TRIM(theme) != ''
      `).get(user_id);
      return {
        user_id,
        theme: pref?.theme || DEFAULT_CRON_THEME,
        fallback: false,
      };
    });
  } else if (options.userId) {
    const targetUid = dailyPackService.normalizeUserId(options.userId);
    const pref = db.prepare(`
      SELECT theme FROM user_theme_prefs
      WHERE user_id = ? AND theme IS NOT NULL AND TRIM(theme) != ''
    `).get(targetUid);
    users = [{
      user_id: targetUid,
      theme: pref?.theme || DEFAULT_CRON_THEME,
      fallback: false,
    }];
  } else {
    // Manual listen-only cron-run: own tick + listen-only runs (no pack stitch)
    users = listCronTargetUsers(db);
    fallback = users.some((u) => u.fallback);
  }

  const summary = {
    packDate,
    cronTickId,
    users: users.length,
    fallback,
    syncedFromArticles: 0,
    combosOk: 0,
    combosFail: 0,
    errors: [],
    openMiss: 0,
  };
  if (users.length === 0) {
    console.warn('[DailyListen Cron] no cron target users');
  } else if (summary.fallback) {
    console.warn(
      '[DailyListen Cron] no active users in window; fallback to latest login user=%s',
      users[0].user_id,
    );
  }

  // Manual path without tick: create listen-only tick + runs
  let effectiveTickId = cronTickId;
  if (!effectiveTickId && users.length > 0) {
    effectiveTickId = dailyCronRunService.createCronTickId();
    summary.cronTickId = effectiveTickId;
    summary.listenOnly = true;
    for (const user of users) {
      dailyCronRunService.createPerUserRun(db, {
        cronTickId: effectiveTickId,
        userId: user.user_id,
        packDate,
        triggerSource: 'manual_api',
        unitTotal: dailyCronRunService.LISTEN_ONLY_UNIT_TOTAL,
      });
    }
  }

  for (const user of users) {
    let run = null;
    if (effectiveTickId) {
      run = dailyCronRunService.getRunByTickUser(db, effectiveTickId, user.user_id);
      if (!run) {
        // OPEN miss: never INSERT second card
        summary.openMiss += 1;
        summary.errors.push({
          userId: user.user_id,
          error: 'listen_open_miss: no per-user run for cron_tick_id',
        });
        console.warn(
          '[DailyListen Cron] OPEN miss user=%s tick=%s — skip (no INSERT)',
          user.user_id,
          effectiveTickId,
        );
        continue;
      }
      dailyCronRunService.upsertStep(db, {
        runId: run.id,
        userId: user.user_id,
        module: 'listen',
        status: 'running',
        attempt: currentListenAttempt(db, dailyCronRunService, run.id),
      });
    }

    try {
      const userSummary = await runCoordinatedUserListen(
        db,
        user,
        {
          packDate,
          source: 'cron',
          skipReadyAudio: options.skipReadyAudio === true,
        },
      );
      summary.syncedFromArticles += userSummary.syncedFromArticles;
      summary.combosOk += userSummary.combosOk;
      summary.combosFail += userSummary.combosFail;
      summary.errors.push(...userSummary.errors);

      if (run) {
        const listenFailed = (userSummary.combosFail || 0) > 0;
        dailyCronRunService.upsertStep(db, {
          runId: run.id,
          userId: user.user_id,
          module: 'listen',
          status: listenFailed ? 'failed' : 'completed',
          progress: 100,
          finishedAt: Date.now(),
          attempt: currentListenAttempt(db, dailyCronRunService, run.id),
          errorMessage: listenFailed
            ? `combosFail=${userSummary.combosFail}`
            : null,
          resultSummary: userSummary,
        });
        const unitTotal = summary.listenOnly
          ? dailyCronRunService.LISTEN_ONLY_UNIT_TOTAL
          : dailyCronRunService.STANDARD_UNIT_TOTAL;
        dailyCronRunService.refreshRunAggregation(db, run.id, { unitTotal });
      }
    } catch (err) {
      summary.errors.push({ userId: user.user_id, error: err.message || String(err) });
      if (run) {
        dailyCronRunService.upsertStep(db, {
          runId: run.id,
          userId: user.user_id,
          module: 'listen',
          status: 'failed',
          progress: 100,
          finishedAt: Date.now(),
          attempt: currentListenAttempt(db, dailyCronRunService, run.id),
          errorMessage: err.message || String(err),
        });
        dailyCronRunService.refreshRunAggregation(db, run.id);
      }
    }
  }
  const cleanup = module.exports.cleanupDailyListenStorage(db);
  console.log('[DailyListen Cron] done', summary, cleanup);
  return { summary, cleanup };
}

function currentListenAttempt(db, dailyCronRunService, runId) {
  const step = dailyCronRunService.findStep(db, { runId, module: 'listen' });
  const n = Number(step && step.attempt);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

async function resumeInterruptedListenJobs(db) {
  const packDate = dailyPackService.getPackDate();
  let rows = [];
  try {
    rows = db.prepare(`
      SELECT DISTINCT r.cron_tick_id AS cronTickId, s.user_id AS userId, s.id AS stepId,
             IFNULL(s.attempt, 1) AS attempt
      FROM daily_cron_steps s
      JOIN daily_cron_runs r ON r.id = s.run_id
      WHERE s.module = 'listen'
        AND s.status = 'failed'
        AND r.pack_date = ?
        AND IFNULL(s.attempt, 1) < ?
    `).all(packDate, LISTEN_RESUME_MAX_ATTEMPTS);
  } catch {
    return { resumed: 0 };
  }
  for (const row of rows) {
    try {
      const nextAttempt = Number(row.attempt || 1) + 1;
      if (row.stepId) {
        db.prepare('UPDATE daily_cron_steps SET attempt = ?, updated_at = ? WHERE id = ?')
          .run(nextAttempt, Date.now(), row.stepId);
      }
      await module.exports.runDailyListenCronJob(db, {
        cronTickId: row.cronTickId,
        userId: row.userId,
        skipReadyAudio: true,
      });
    } catch (err) {
      console.warn('[DailyListen Cron] resume interrupted fail user=%s: %s', row.userId, err.message);
    }
  }
  return { resumed: rows.length };
}

/**
 * 从单条每日长文记录直接复用文本，合成精听音频并同步写入 daily_listen_audios 与 daily_listen_articles
 */
async function syncAudioFromLongArticleRow(db, row, source = 'cron') {
  if (!row || !row.user_id) return null;
  const uid = dailyPackService.normalizeUserId(row.user_id);
  const packDate = row.quota_date || dailyPackService.getPackDate();
  const theme = row.theme || '商务英语';
  const genre = row.genre || 'meeting';
  const cefrLevel = row.cefr_level || 'B1';
  const duration = Number(row.duration) || 25;

  const scriptText = row.article || row.article_text || row.material_text || row.body_text || '';
  if (!scriptText) {
    console.warn(`[ListenAudio Sync] Skip user=${uid} ${genre}/${cefrLevel}/${duration}m - article text empty`);
    return null;
  }

  const parts = comboKeyParts({ userId: uid, packDate, theme, genre, cefrLevel, duration });
  const baseName = `${packDate}_${parts.genre}_${parts.cefrLevel}_${parts.duration}m`;

  const userDirA = path.join(ARTICLE_ROOT, parts.userId);
  const userDirAu = path.join(AUDIO_ROOT, parts.userId);
  fs.mkdirSync(userDirA, { recursive: true });
  fs.mkdirSync(userDirAu, { recursive: true });

  // 1. 同步保存精听文本
  const txtPath = path.join(userDirA, `${baseName}.txt`);
  fs.writeFileSync(txtPath, scriptText, 'utf8');
  upsertArticle(db, parts, {
    status: 'ready',
    source,
    body_text: scriptText,
    vocab_json: row.words_json || row.extracted_words_json || '[]',
    phrases_json: row.phrases_json || row.extracted_phrases_json || '[]',
    file_path: txtPath,
  });

  const audioPath = path.join(userDirAu, `${baseName}.mp3`);
  const audioUrl = `/api/daily_listen_audio/${parts.userId}/${baseName}.mp3`;
  if (fileOk(audioPath)) {
    upsertAudio(db, parts, {
      status: 'ready',
      source,
      script_text: scriptText,
      audio_path: audioPath,
      audio_url: audioUrl,
    });
    console.log(`[ListenAudio Sync] ✅ Adopted existing audio for user=${uid} (${genre}/${cefrLevel}/${duration}m)`);
    return { success: true, audioUrl, adopted: true };
  }

  // 2. 调用音频合成引擎，直接基于长文文本生成 .mp3 音频
  upsertAudio(db, parts, { status: 'generating', source });
  try {
    const voiceId = listenPrefsService.getListenVoiceId(db, parts.userId);
    if (generators.synthesizeAudioFile) {
      await generators.synthesizeAudioFile(scriptText, audioPath, {
        userId: parts.userId,
        voiceId,
      });
    } else {
      const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_STEREO_MD5);
      const stream = tts.toStream(scriptText);
      const outStream = fs.createWriteStream(audioPath);
      await new Promise((resolve, reject) => {
        stream.pipe(outStream);
        outStream.on('finish', resolve);
        outStream.on('error', reject);
        stream.on('error', reject);
      });
    }
    upsertAudio(db, parts, {
      status: 'ready',
      source,
      script_text: scriptText,
      audio_path: audioPath,
      audio_url: audioUrl,
    });
    console.log(`[ListenAudio Sync] ✅ Successfully synced audio for user=${uid} (${genre}/${cefrLevel}/${duration}m)`);
    return { success: true, audioUrl };
  } catch (e) {
    try {
      upsertAudio(db, parts, { status: 'failed', source, error_message: e.message });
    } catch (writeErr) {
      console.error(`[ListenAudio Sync] mark failed also threw for user=${uid}:`, writeErr.message);
    }
    console.error(`[ListenAudio Sync] ❌ Audio synthesis failed for user=${uid}:`, e.message);
    return { success: false, error: e.message };
  }
}

/**
 * 批处理：为某用户某天的所有已生成长文记录批量合成精听音频
 */
async function batchSyncAudiosFromLongArticles(
  db,
  userId,
  packDate,
  source = 'cron',
  { skipReadyAudio = false } = {},
) {
  const uid = dailyPackService.normalizeUserId(userId);
  const date = packDate || dailyPackService.getPackDate();

  console.log(`\n[ListenAudio Batch Sync] Starting batch audio synthesis for user=${uid}, date=${date}...`);

  const articles = db.prepare(`
    SELECT * FROM daily_extracted_articles 
    WHERE user_id = ? AND (quota_date = ? OR quota_date IS NULL OR quota_date = '')
  `).all(uid, date);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const article of articles) {
    if (skipReadyAudio) {
      const parts = comboKeyParts({
        userId: uid,
        packDate: article.quota_date || date,
        theme: article.theme || '商务英语',
        genre: article.genre || 'meeting',
        cefrLevel: article.cefr_level || 'B1',
        duration: Number(article.duration) || 25,
      });
      if (resolveAudioStatus(getAudioRow(db, parts)) === 'ready') {
        skipped++;
        continue;
      }
    }
    try {
      const res = await syncAudioFromLongArticleRow(db, article, source);
      if (res && res.success) {
        success++;
      } else {
        failed++;
      }
    } catch (itemErr) {
      failed++;
      console.error(
        `[ListenAudio Batch Sync] combo error user=${uid} ${article.genre}/${article.cefr_level}/${article.duration}m:`,
        itemErr.message,
      );
    }
  }

  console.log(`[ListenAudio Batch Sync] Completed for user=${uid}: ${success} succeeded, ${failed} failed.\n`);
  return { total: articles.length, success, failed, skipped };
}

module.exports = {
  GENRES,
  CEFR_LEVELS,
  DURATIONS,
  LOGIN_CATCHUP_DURATIONS,
  CAPACITY_BYTES,
  RETENTION_DAYS,
  LOGIN_WINDOW_MS,
  DEFAULT_CRON_THEME,
  AUDIO_ROOT,
  ARTICLE_ROOT,
  resolveListenDurations,
  initDailyListenTables,
  ensureDirs,
  recordUserLogin,
  listEligibleUsers,
  listCronTargetUsers,
  isCacheableDuration,
  comboKeyParts,
  getArticleRow,
  getAudioRow,
  getExtractedArticleRow,
  fileOk,
  resolveArticleStatus,
  resolveAudioStatus,
  getPregeneratedCombo,
  startListenSyncFromLongArticleIfNeeded,
  setGenerators,
  upsertArticle,
  upsertAudio,
  parseVocabFromRaw,
  stripMarkdownJsonFence,
  upsertExtractedArticleMirror,
  getExtractVocabTimeoutMs,
  raceWithTimeout,
  generateOneCombo,
  backfillVocabForCombo,
  writebackCombo,
  dirSize,
  unlinkQuiet,
  cleanupDailyListenStorage,
  runDailyListenForUser,
  scheduleUserDailyCatchup,
  runDailyListenCronJob,
  resumeInterruptedListenJobs,
  LISTEN_RESUME_MAX_ATTEMPTS,
  syncAudioFromLongArticleRow,
  batchSyncAudiosFromLongArticles,
};
