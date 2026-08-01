const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dailyPackService = require('./dailyPackService');

const GENRES = ['meeting', 'news', 'podcast', 'reading'];
const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1'];
const DURATIONS = [1, 15, 25, 35]; // minutes
const CAPACITY_BYTES = 1024 * 1024 * 1024; // 1024MB
const RETENTION_DAYS = 7;
const LOGIN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const ROOT = path.join(__dirname, '..');
const AUDIO_ROOT = path.join(ROOT, 'public', 'daily_listen_audio');
const ARTICLE_ROOT = path.join(ROOT, 'public', 'daily_long_articles');

function ensureDirs() {
  for (const d of [AUDIO_ROOT, ARTICLE_ROOT]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function initDailyListenTables(db) {
  ensureDirs();
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

function listEligibleUsers(db, now = Date.now()) {
  const since = now - LOGIN_WINDOW_MS;
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

function isCacheableDuration(duration) {
  return DURATIONS.includes(Number(duration));
}

function comboKeyParts({ userId, packDate, theme, genre, cefrLevel, duration }) {
  return {
    userId: dailyPackService.normalizeUserId(userId),
    packDate,
    theme: String(theme || '').trim(),
    genre,
    cefrLevel,
    duration: Number(duration),
  };
}

function getArticleRow(db, parts) {
  let row = db.prepare(`
    SELECT * FROM daily_listen_articles
    WHERE user_id=? AND pack_date=? AND theme=? AND genre=? AND cefr_level=? AND duration=?
  `).get(parts.userId, parts.packDate, parts.theme, parts.genre, parts.cefrLevel, parts.duration);

  // 兜底 1: 若未根据精确主题查到，尝试按 user_id + pack_date + genre + cefr_level + duration 回退查询最新记录
  if (!row) {
    row = db.prepare(`
      SELECT * FROM daily_listen_articles
      WHERE user_id=? AND pack_date=? AND genre=? AND cefr_level=? AND duration=?
      ORDER BY created_at DESC LIMIT 1
    `).get(parts.userId, parts.packDate, parts.genre, parts.cefrLevel, parts.duration);
  }

  // 兜底 2: 若精听从表无数据，但主长文表 daily_extracted_articles 有记录，直接构造内存 Row，避免递归
  if (!row) {
    const extRow = db.prepare(`
      SELECT * FROM daily_extracted_articles
      WHERE user_id=? AND quota_date=? AND genre=? AND cefr_level=? AND (duration=? OR duration=?)
      ORDER BY created_at DESC LIMIT 1
    `).get(parts.userId, parts.packDate, parts.genre, parts.cefrLevel, String(parts.duration), parts.duration);

    if (extRow) {
      row = {
        id: extRow.id,
        user_id: extRow.user_id,
        pack_date: extRow.quota_date,
        theme: extRow.theme,
        genre: extRow.genre,
        cefr_level: extRow.cefr_level,
        duration: Number(extRow.duration || parts.duration),
        body_text: extRow.article,
        vocab_json: extRow.words_json,
        phrases_json: extRow.phrases_json,
        file_path: null,
        status: 'ready',
        source: 'cron',
        created_at: extRow.created_at,
        updated_at: extRow.updated_at
      };
    }
  }
  return row;
}

function getAudioRow(db, parts) {
  let row = db.prepare(`
    SELECT * FROM daily_listen_audios
    WHERE user_id=? AND pack_date=? AND theme=? AND genre=? AND cefr_level=? AND duration=?
  `).get(parts.userId, parts.packDate, parts.theme, parts.genre, parts.cefrLevel, parts.duration);

  if (!row) {
    row = db.prepare(`
      SELECT * FROM daily_listen_audios
      WHERE user_id=? AND pack_date=? AND genre=? AND cefr_level=? AND duration=?
      ORDER BY created_at DESC LIMIT 1
    `).get(parts.userId, parts.packDate, parts.genre, parts.cefrLevel, parts.duration);
  }
  return row;
}

function fileOk(p) {
  return p && fs.existsSync(p) && fs.statSync(p).size > 0;
}

function resolveArticleStatus(row) {
  if (!row) return 'missing';
  if (row.status === 'generating') return 'generating';
  if (row.status === 'failed') return 'failed';
  if (row.status === 'ready') return 'ready';
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
  const articleRow = getArticleRow(db, parts);
  const audioRow = getAudioRow(db, parts);
  const articleStatus = resolveArticleStatus(articleRow);
  const audioStatus = resolveAudioStatus(audioRow);

  let status = 'missing';
  if (articleStatus === 'ready' && audioStatus === 'ready') status = 'ready';
  else if (articleStatus === 'ready' || audioStatus === 'ready') status = 'partial';
  else if (articleStatus === 'generating' || audioStatus === 'generating') status = 'generating';
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

let generators = {
  generateLongScript: async () => { throw new Error('generateLongScript not injected'); },
  synthesizeAudioFile: async (text, outputPath) => {
    if (typeof global !== 'undefined' && typeof global.synthesizeAndSaveAudio === 'function') {
      await global.synthesizeAndSaveAudio(text, 'edge-tts/en-US-EmmaNeural', outputPath, null, null);
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

function upsertArticle(db, parts, fields) {
  const now = Date.now();
  const existing = getArticleRow(db, parts);
  if (existing) {
    db.prepare(`
      UPDATE daily_listen_articles SET
        body_text=?, vocab_json=?, phrases_json=?, file_path=?, status=?, source=?, error_message=?, updated_at=?
      WHERE id=?
    `).run(
      fields.body_text !== undefined ? fields.body_text : existing.body_text,
      fields.vocab_json !== undefined ? fields.vocab_json : existing.vocab_json,
      fields.phrases_json !== undefined ? fields.phrases_json : existing.phrases_json,
      fields.file_path !== undefined ? fields.file_path : existing.file_path,
      fields.status,
      fields.source !== undefined ? fields.source : existing.source,
      fields.error_message !== undefined ? fields.error_message : null,
      now,
      existing.id,
    );
    return existing.id;
  }
  const id = newId();
  db.prepare(`
    INSERT INTO daily_listen_articles
    (id,user_id,pack_date,theme,genre,cefr_level,duration,body_text,vocab_json,phrases_json,file_path,status,source,error_message,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, parts.userId, parts.packDate, parts.theme, parts.genre, parts.cefrLevel, parts.duration,
    fields.body_text || null, fields.vocab_json || null, fields.phrases_json || null, fields.file_path || null,
    fields.status, fields.source || 'cron', fields.error_message || null, now, now,
  );
  return id;
}

function upsertAudio(db, parts, fields) {
  const now = Date.now();
  const existing = getAudioRow(db, parts);
  if (existing) {
    db.prepare(`
      UPDATE daily_listen_audios SET
        script_text=?, audio_path=?, audio_url=?, status=?, source=?, error_message=?, updated_at=?
      WHERE id=?
    `).run(
      fields.script_text !== undefined ? fields.script_text : existing.script_text,
      fields.audio_path !== undefined ? fields.audio_path : existing.audio_path,
      fields.audio_url !== undefined ? fields.audio_url : existing.audio_url,
      fields.status,
      fields.source !== undefined ? fields.source : existing.source,
      fields.error_message !== undefined ? fields.error_message : null,
      now,
      existing.id,
    );
    return existing.id;
  }
  const id = newId();
  db.prepare(`
    INSERT INTO daily_listen_audios
    (id,user_id,pack_date,theme,genre,cefr_level,duration,script_text,audio_path,audio_url,status,source,error_message,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, parts.userId, parts.packDate, parts.theme, parts.genre, parts.cefrLevel, parts.duration,
    fields.script_text || null, fields.audio_path || null, fields.audio_url || null,
    fields.status, fields.source || 'cron', fields.error_message || null, now, now,
  );
  return id;
}

function parseVocabFromRaw(raw) {
  if (!raw || typeof raw !== 'string') return { vocab: [], phrases: [] };
  const m = raw.split(/---VOCAB_JSON_START---/i);
  if (m.length < 2) return { vocab: [], phrases: [] };
  try {
    const jsonPart = m[1].split(/---VOCAB_JSON_END---/i)[0].trim();
    const parsed = JSON.parse(jsonPart);
    return {
      vocab: parsed.vocab || parsed.words || [],
      phrases: parsed.phrases || parsed.phrase || [],
    };
  } catch {
    return { vocab: [], phrases: [] };
  }
}

async function generateOneCombo(db, raw, { source = 'cron', only = 'both' } = {}) {
  const packDate = raw.packDate || dailyPackService.getPackDate();
  const parts = comboKeyParts({ ...raw, packDate, cefrLevel: raw.cefrLevel || raw.cefr });
  if (!isCacheableDuration(parts.duration)) throw new Error('duration not cacheable');

  const userDirA = path.join(ARTICLE_ROOT, parts.userId);
  const userDirAu = path.join(AUDIO_ROOT, parts.userId);
  fs.mkdirSync(userDirA, { recursive: true });
  fs.mkdirSync(userDirAu, { recursive: true });
  const baseName = `${packDate}_${parts.genre}_${parts.cefrLevel}_${parts.duration}m`;

  let script = null;
  if (only === 'both' || only === 'article') {
    upsertArticle(db, parts, { status: 'generating', source });
    try {
      const rawScript = await generators.generateLongScript({
        theme: parts.theme,
        genre: parts.genre,
        cefr_level: parts.cefrLevel,
        duration: String(parts.duration),
        userId: parts.userId,
      });
      const { vocab, phrases } = parseVocabFromRaw(rawScript);
      script = typeof rawScript === 'string' ? rawScript : String(rawScript || '');
      const body = script.split(/---VOCAB_JSON_START---/i)[0].trim();
      const filePath = path.join(userDirA, `${baseName}.txt`);
      fs.writeFileSync(filePath, body, 'utf8');
      upsertArticle(db, parts, {
        status: 'ready',
        source,
        body_text: body,
        vocab_json: JSON.stringify(vocab),
        phrases_json: JSON.stringify(phrases),
        file_path: filePath,
      });
      script = body;
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
      await generators.synthesizeAudioFile(script, audioPath);
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

async function runDailyListenCronJob(db) {
  const packDate = dailyPackService.getPackDate();
  const users = listEligibleUsers(db);
  const summary = { packDate, users: users.length, syncedFromArticles: 0, combosOk: 0, combosFail: 0, errors: [] };
  for (const u of users) {
    // 选项 B 批次联动：在所有组合长文全量生成完毕后，统一按长文素材跑一遍音频合成批处理
    try {
      const syncRes = await batchSyncAudiosFromLongArticles(db, u.user_id, packDate);
      summary.syncedFromArticles += (syncRes?.success || 0);
    } catch (syncErr) {
      console.warn(`[DailyListen Cron] Batch audio sync warning for user=${u.user_id}:`, syncErr.message);
    }

    for (const genre of GENRES) {
      for (const cefrLevel of CEFR_LEVELS) {
        for (const duration of DURATIONS) {
          const existing = getPregeneratedCombo(db, {
            userId: u.user_id, theme: u.theme, genre, cefrLevel, duration, date: packDate,
          });
          if (existing.status === 'ready') continue;
          try {
            await generateOneCombo(db, {
              userId: u.user_id, theme: u.theme, genre, cefrLevel, duration, packDate,
            }, { source: 'cron' });
            summary.combosOk += 1;
          } catch (e) {
            summary.combosFail += 1;
            summary.errors.push({ userId: u.user_id, genre, cefrLevel, duration, error: e.message });
            console.error('[DailyListen Cron]', e.message);
          }
        }
      }
    }
  }
  const cleanup = cleanupDailyListenStorage(db);
  console.log('[DailyListen Cron] done', summary, cleanup);
  return { summary, cleanup };
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

  // 2. 调用音频合成引擎，直接基于长文文本生成 .mp3 音频
  upsertAudio(db, parts, { status: 'generating', source });
  try {
    const audioPath = path.join(userDirAu, `${baseName}.mp3`);
    if (generators.synthesizeAudioFile) {
      await generators.synthesizeAudioFile(scriptText, audioPath);
    } else {
      const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
      const tts = new MsEdgeTTS();
      await tts.setMetadata('en-US-AnaNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_STEREO_MD5);
      const stream = tts.toStream(scriptText);
      const outStream = fs.createWriteStream(audioPath);
      await new Promise((resolve, reject) => {
        stream.pipe(outStream);
        outStream.on('finish', resolve);
        outStream.on('error', reject);
        stream.on('error', reject);
      });
    }
    const audioUrl = `/api/daily_listen_audio/${parts.userId}/${baseName}.mp3`;
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
    upsertAudio(db, parts, { status: 'failed', source, error_message: e.message });
    console.error(`[ListenAudio Sync] ❌ Audio synthesis failed for user=${uid}:`, e.message);
    return { success: false, error: e.message };
  }
}

/**
 * 批处理：为某用户某天的所有已生成长文记录批量合成精听音频
 */
async function batchSyncAudiosFromLongArticles(db, userId, packDate) {
  const uid = dailyPackService.normalizeUserId(userId);
  const date = packDate || dailyPackService.getPackDate();

  console.log(`\n[ListenAudio Batch Sync] Starting batch audio synthesis for user=${uid}, date=${date}...`);

  const articles = db.prepare(`
    SELECT * FROM daily_extracted_articles 
    WHERE user_id = ? AND (quota_date = ? OR quota_date IS NULL OR quota_date = '')
  `).all(uid, date);

  let success = 0;
  let failed = 0;

  for (const article of articles) {
    const res = await syncAudioFromLongArticleRow(db, article, 'cron');
    if (res && res.success) {
      success++;
    } else {
      failed++;
    }
  }

  console.log(`[ListenAudio Batch Sync] Completed for user=${uid}: ${success} succeeded, ${failed} failed.\n`);
  return { total: articles.length, success, failed };
}

module.exports = {
  GENRES,
  CEFR_LEVELS,
  DURATIONS,
  CAPACITY_BYTES,
  RETENTION_DAYS,
  LOGIN_WINDOW_MS,
  AUDIO_ROOT,
  ARTICLE_ROOT,
  initDailyListenTables,
  ensureDirs,
  recordUserLogin,
  listEligibleUsers,
  isCacheableDuration,
  comboKeyParts,
  getArticleRow,
  getAudioRow,
  fileOk,
  resolveArticleStatus,
  resolveAudioStatus,
  getPregeneratedCombo,
  setGenerators,
  upsertArticle,
  upsertAudio,
  parseVocabFromRaw,
  generateOneCombo,
  writebackCombo,
  dirSize,
  unlinkQuiet,
  cleanupDailyListenStorage,
  runDailyListenCronJob,
  syncAudioFromLongArticleRow,
  batchSyncAudiosFromLongArticles,
};
