const crypto = require('crypto');
const { isUsableLongArticle } = require('./difyStreamMerge');
const {
  buildInjectedUserCurrentProfile,
  resolveUserCurrentProfileForDify,
} = require('./profileInject');

const PACK_TZ = process.env.DAILY_PACK_CRON_TZ || 'Asia/Shanghai';
const FLAW_SUB_THEMES = [
  'shifting the burden of proof and defensive responses',
  'ambiguous definitions and play on words',
  'false dilemmas and oversimplification',
];

const DAY_MS = 24 * 60 * 60 * 1000;
// 去重滚动窗口：窗口内推送过的词不再重复出现
const DEDUPE_WINDOW_DAYS = Number(process.env.DAILY_PACK_DEDUPE_WINDOW_DAYS || 30);
// 历史保留期：超期记录物理删除，避免表无限增长
const DEDUPE_RETENTION_DAYS = Number(process.env.DAILY_PACK_DEDUPE_RETENTION_DAYS || 90);
const WAKEUP_VOCAB_TARGET = 5;
const FLAW_VOCAB_TARGET = 6;
// 命中重复后最多再调 LLM 一次
const DEDUPE_RETRY_COUNT = 1;
const DEDUPE_BACKFILL_NOTICE = '本主题近期新词不足，已用较早推送词补齐至满额';
/** Dify paragraph 要求 history_exclude < 65535 */
const DIFY_HISTORY_EXCLUDE_MAX = 65534;

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

  // 已推送词汇历史：唤醒与破绽共用同一张表，用于跨模块、跨天去重
  // UNIQUE(user_id, word) 只保留每个词最近一次推送时间，
  // 既支撑「窗口内是否出现过」查询，也支撑「最久未出现」排序补齐
  db.prepare(`
    CREATE TABLE IF NOT EXISTS pushed_vocab_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      word TEXT NOT NULL,
      word_json TEXT,
      module TEXT NOT NULL DEFAULT 'wakeup',
      pushed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, word)
    )
  `).run();

  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_pushed_vocab_user_time ON pushed_vocab_history(user_id, pushed_at)'
  ).run();
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_pushed_vocab_user_word ON pushed_vocab_history(user_id, word)'
  ).run();
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

const DEFAULT_USER_THEME = '商务谈判：让步与施压';

function getOrCreateUserTheme(db, userId) {
  const uid = normalizeUserId(userId);
  const row = db.prepare(
    'SELECT theme FROM user_theme_prefs WHERE user_id = ? AND theme IS NOT NULL AND TRIM(theme) != \'\''
  ).get(uid);
  const existing = String(row?.theme || '').trim();
  if (existing) {
    return { userId: uid, theme: existing, created: false };
  }
  const saved = upsertUserTheme(db, uid, DEFAULT_USER_THEME);
  return { userId: uid, theme: saved.theme, created: true, syncedAt: saved.syncedAt };
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

function getTodayPackForCurrentTheme(db, userId, packDate, currentTheme) {
  const uid = normalizeUserId(userId);
  const theme = String(currentTheme || '').trim();
  if (theme) {
    const exact = db.prepare(
      'SELECT * FROM daily_packs WHERE user_id = ? AND pack_date = ? AND theme = ? ORDER BY created_at DESC LIMIT 1'
    ).get(uid, packDate, theme);
    if (exact) return exact;
  }
  return findUserDailyPackByDate(db, uid, packDate);
}

function isAccentProfile(value) {
  const t = String(value || '').trim();
  return t === '英国 (UK)' || t === '美国 (US)';
}

function sanitizeWeaknessProfile(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (isAccentProfile(raw)) return '';
  return raw
    .split(/[;；,，]/)
    .map((part) => part.trim())
    .filter((part) => part && !isAccentProfile(part))
    .join('; ');
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

function getUserVocabWords(db, userId) {
  if (userId == null || String(userId).trim() === '') return [];
  const uid = normalizeUserId(userId);
  try {
    const rows = db.prepare(
      'SELECT word FROM vocabulary WHERE user_id = ? ORDER BY added_at DESC'
    ).all(uid);
    return rows.map((r) => String(r.word || '').toLowerCase().trim()).filter(Boolean);
  } catch {
    return [];
  }
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

function getUserCurrentProfile(db, userId, opts = {}) {
  // 完整注入串（职业+短板+L3+账本+图谱），供日包/cron/Dify 回落；不再截断到 280
  return buildInjectedUserCurrentProfile(db, userId, opts);
}

function getHistoryExclude(db, userId) {
  const dbWords = getUserVocabWords(db, userId);
  return dbWords.slice(0, 50).join(', ');
}

function capHistoryExcludeForDify(csv, maxLen = DIFY_HISTORY_EXCLUDE_MAX) {
  const s = String(csv || '');
  const limit = Math.max(0, Number(maxLen) || DIFY_HISTORY_EXCLUDE_MAX);
  if (s.length <= limit) return s;
  const cut = s.slice(0, limit);
  const lastComma = cut.lastIndexOf(',');
  return (lastComma > 0 ? cut.slice(0, lastComma) : cut).trim();
}

function normalizePushedWord(raw) {
  return String(raw || '').toLowerCase().trim();
}

function normalizeWordSurface(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function stemToken(token) {
  let t = String(token || '').toLowerCase();
  if (t.length <= 3) return t;
  if (t.endsWith('lling')) return `${t.slice(0, -5)}l`;
  if (t.endsWith('ssion')) return t.slice(0, -3);
  const suffixes = [
    'ational', 'tional', 'ation', 'ition', 'ings', 'ating', 'ated', 'ate',
    'tion', 'sion', 'ing', 'ies', 'es', 'ed', 's',
  ];
  for (const suf of suffixes) {
    if (t.length - suf.length >= 3 && t.endsWith(suf)) {
      if (suf === 's' && t.endsWith('ss')) continue;
      return t.slice(0, -suf.length);
    }
  }
  return t;
}

function stemWordKey(raw) {
  const surface = normalizeWordSurface(raw);
  if (!surface) return '';
  return surface.split(' ').map(stemToken).filter(Boolean).join(' ');
}

function stemsMatch(a, b) {
  const sa = stemWordKey(a);
  const sb = stemWordKey(b);
  return Boolean(sa && sb && sa === sb);
}

function extractItemText(item) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  return String(item.word || item.text || item.term || item.phrase || '').trim();
}

function parseWordListJson(raw) {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(extractItemText).filter(Boolean);
}

function getSameDaySiblingWords(db, userId) {
  const uid = normalizeUserId(userId);
  const day = getPackDate();
  const out = [];
  try {
    const rows = db.prepare(
      'SELECT words_json, phrases_json FROM daily_extracted_articles WHERE user_id = ? AND quota_date = ?'
    ).all(uid, day);
    for (const row of rows) {
      out.push(...parseWordListJson(row.words_json));
      out.push(...parseWordListJson(row.phrases_json));
    }
  } catch { /* 单测或旧库可能无表 */ }
  try {
    const rows = db.prepare(
      'SELECT vocab_json, phrases_json FROM daily_listen_articles WHERE user_id = ? AND pack_date = ?'
    ).all(uid, day);
    for (const row of rows) {
      out.push(...parseWordListJson(row.vocab_json));
      out.push(...parseWordListJson(row.phrases_json));
    }
  } catch { /* 单测或旧库可能无表 */ }
  return out;
}

const GENERIC_BAN_WORDS = [
  'model', 'modeling', 'modelling', 'agenda', 'deadline',
  'meeting', 'email', 'discuss', 'discussion',
];

const THEORY_LEXICON = [
  "prisoner's dilemma", 'Nash equilibrium', 'zero-sum', 'butterfly effect',
  'information asymmetry', 'moral hazard', 'BATNA', 'coordination game',
  'dominant strategy', 'Pareto', 'anchoring', 'cobweb theorem',
  'zero-sum game', 'mixed strategy', 'cheap talk', 'signaling',
  'screening', 'tragedy of the commons', 'principal-agent',
  'bounded rationality', 'confirmation bias', 'false dilemma', 'slippery slope',
];

const DEDUPE_SHORT_NOTICE = '今日合格新词不足，已按不重复原则少推，未用旧词凑数。';

function isBannedGenericWord(word) {
  return GENERIC_BAN_WORDS.some((ban) => stemsMatch(word, ban));
}

function isTheoryLexiconWord(word) {
  return THEORY_LEXICON.some((term) => stemsMatch(word, term));
}

function resolveWakeupSlot(item) {
  const slot = String(item?.slot || '').trim();
  if (slot === 'theme' || slot === 'theory') return slot;
  return isTheoryLexiconWord(item?.word) ? 'theory' : 'theme';
}

function pickWakeupSlots(items) {
  const theme = [];
  const theory = [];
  const seen = new Set();

  const tryTake = (item, slot) => {
    const word = String(item?.word || '').trim();
    if (!word || isBannedGenericWord(word)) return;
    const key = stemWordKey(word);
    if (!key || seen.has(key)) return;
    if (slot === 'theory') {
      if (theory.length >= 2) return;
      theory.push(item);
    } else {
      if (theme.length >= 3) return;
      theme.push(item);
    }
    seen.add(key);
  };

  for (const item of items || []) {
    const slot = String(item?.slot || '').trim();
    if (slot === 'theme' || slot === 'theory') tryTake(item, slot);
  }
  for (const item of items || []) {
    const word = String(item?.word || '').trim();
    if (!word || isBannedGenericWord(word)) continue;
    const key = stemWordKey(word);
    if (!key || seen.has(key)) continue;
    const inferred = isTheoryLexiconWord(item?.word) ? 'theory' : 'theme';
    if (inferred === 'theory' && theory.length < 2) tryTake(item, 'theory');
    else if (theme.length < 3) tryTake(item, 'theme');
  }
  return [...theme, ...theory];
}

function unusedTheoryHints(picked, limit = 6) {
  const have = new Set((picked || []).map((i) => stemWordKey(i.word)));
  return THEORY_LEXICON.filter((term) => !have.has(stemWordKey(term))).slice(0, limit);
}

/** 窗口内已推送过的词（小写归一化），唤醒与破绽共用 */
function getRecentPushedWords(db, userId, windowDays = DEDUPE_WINDOW_DAYS) {
  const uid = normalizeUserId(userId);
  const since = Date.now() - Math.max(0, Number(windowDays) || 0) * DAY_MS;
  try {
    const rows = db.prepare(
      'SELECT word FROM pushed_vocab_history WHERE user_id = ? AND pushed_at >= ? ORDER BY pushed_at DESC'
    ).all(uid, since);
    return rows.map((r) => normalizePushedWord(r.word)).filter(Boolean);
  } catch {
    return [];
  }
}

/** 记录本批推送词；同一词重复推送时刷新为最近一次推送时间与最新词条快照 */
function recordPushedWords(db, userId, moduleName, items) {
  const uid = normalizeUserId(userId);
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return 0;
  const now = Date.now();
  const mod = String(moduleName || 'wakeup').trim() || 'wakeup';
  const stmt = db.prepare(`
    INSERT INTO pushed_vocab_history (id, user_id, word, word_json, module, pushed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, word) DO UPDATE SET
      word_json = excluded.word_json,
      module = excluded.module,
      pushed_at = excluded.pushed_at
  `);
  let saved = 0;
  const seen = new Set();
  const recentStems = new Set(getRecentPushedWords(db, uid).map(stemWordKey).filter(Boolean));
  const runAll = db.transaction((entries) => {
    for (const entry of entries) {
      const item = typeof entry === 'string' ? { word: entry } : (entry || {});
      const surface = normalizePushedWord(item.word);
      const stem = stemWordKey(item.word);
      if (!surface || !stem || seen.has(stem) || recentStems.has(stem)) continue;
      seen.add(stem);
      recentStems.add(stem);
      stmt.run(crypto.randomUUID(), uid, surface, JSON.stringify(item), mod, now, now);
      saved += 1;
    }
  });
  try {
    runAll(list);
  } catch (err) {
    console.error('[DailyPack] recordPushedWords failed:', err.message || err);
    return 0;
  }
  return saved;
}

/** 最久未出现的历史词，用于去重后数量不足时补齐 */
function getOldestPushedWords(db, userId, { limit = 10, exclude = [] } = {}) {
  const uid = normalizeUserId(userId);
  const excludeSet = new Set((exclude || []).map(normalizePushedWord).filter(Boolean));
  const max = Math.max(0, Number(limit) || 0);
  if (!max) return [];
  try {
    const rows = db.prepare(
      'SELECT word, word_json FROM pushed_vocab_history WHERE user_id = ? ORDER BY pushed_at ASC'
    ).all(uid);
    const picked = [];
    for (const row of rows) {
      if (picked.length >= max) break;
      const key = normalizePushedWord(row.word);
      if (!key || excludeSet.has(key)) continue;
      let item = null;
      try {
        item = row.word_json ? JSON.parse(row.word_json) : null;
      } catch {
        item = null;
      }
      if (!item || !item.word) item = { word: row.word };
      picked.push(item);
      excludeSet.add(key);
    }
    return picked;
  } catch {
    return [];
  }
}

/** 清理超过保留期的历史，避免表无限增长 */
function purgeExpiredPushedWords(db, retentionDays = DEDUPE_RETENTION_DAYS) {
  const days = Math.max(0, Number(retentionDays) || 0);
  if (!days) return 0;
  try {
    const info = db.prepare('DELETE FROM pushed_vocab_history WHERE pushed_at < ?')
      .run(Date.now() - days * DAY_MS);
    return Number(info.changes || 0);
  } catch {
    return 0;
  }
}

/** 合并多路排除词（生词本 / 推送历史 / 本轮拒收），统一小写去重 */
function mergeExcludeLists(...parts) {
  const set = new Set();
  for (const part of parts) {
    const tokens = Array.isArray(part)
      ? part
      : String(part || '').split(/[,，]/).map((s) => normalizePushedWord(s)).filter(Boolean);
    for (const t of tokens) set.add(t);
  }
  return [...set];
}

/**
 * LLM 实际使用的 history_exclude = 近 30 天已推送 + 当日长文/精听提纯词（按用户）。
 * 注意：不得用此结果参与 input_signature，否则会破坏 daily_packs 缓存键稳定性。
 */
function buildEffectiveHistoryExclude(db, userId, baseExclude = '') {
  return mergeExcludeLists(
    getRecentPushedWords(db, userId),
    getSameDaySiblingWords(db, userId),
    baseExclude,
  ).join(', ');
}

function filterVocabAgainstExclude(items, excludeList) {
  const exclude = mergeExcludeLists(excludeList);
  const excludeStems = new Set(exclude.map(stemWordKey).filter(Boolean));
  const kept = [];
  const rejected = [];
  for (const item of items || []) {
    const key = stemWordKey(item?.word);
    if (!key) continue;
    if (excludeStems.has(key) || kept.some((k) => stemWordKey(k.word) === key)) {
      rejected.push(normalizePushedWord(item.word));
      continue;
    }
    kept.push(item);
    excludeStems.add(key);
  }
  return { kept, rejected };
}

function fillVocabToTarget(db, userId, kept, targetCount, extraFallback = []) {
  const result = [...(kept || [])];
  const have = new Set(result.map((i) => stemWordKey(i.word)).filter(Boolean));
  let usedBackfill = false;

  if (result.length < targetCount) {
    const oldest = getOldestPushedWords(db, userId, {
      limit: targetCount - result.length,
      exclude: [...have],
    });
    for (const item of oldest) {
      if (result.length >= targetCount) break;
      const key = stemWordKey(item.word);
      if (!key || have.has(key)) continue;
      result.push(item);
      have.add(key);
      usedBackfill = true;
    }
  }

  if (result.length < targetCount) {
    for (const fb of extraFallback || []) {
      if (result.length >= targetCount) break;
      const key = stemWordKey(fb.word);
      if (!key || have.has(key)) continue;
      result.push(fb);
      have.add(key);
      usedBackfill = true;
    }
  }

  return { words: result.slice(0, targetCount), usedBackfill };
}

/**
 * 生成后硬过滤 + 可选重试 + 最久未出现补齐。
 * callLlm(excludeCsv) 由调用方注入，便于单测 mock。
 */
async function generateVocabWithDedupe(db, userId, {
  moduleName,
  targetCount,
  baseExclude = '',
  callLlm,
  extraFallback = [],
  extraExclude = [],
  allowBackfill = true,
  skipRecord = false,
}) {
  const uid = normalizeUserId(userId);
  const recent = getRecentPushedWords(db, uid);
  let excludeList = mergeExcludeLists(recent, extraExclude);
  let allKept = [];
  let lastParsed = null;
  let lastError = null;

  for (let attempt = 0; attempt <= DEDUPE_RETRY_COUNT; attempt++) {
    try {
      lastParsed = await callLlm(capHistoryExcludeForDify(excludeList.join(', ')));
      lastError = null;
    } catch (err) {
      lastError = err;
      if (attempt === 0 && allKept.length === 0) {
        // 首次即失败：仍尽量用 fallback/历史补齐，避免空屏
        break;
      }
      break;
    }
    const rawVocab = Array.isArray(lastParsed)
      ? lastParsed
      : (lastParsed?.vocab || []);
    const { kept, rejected } = filterVocabAgainstExclude(rawVocab, excludeList);
    for (const item of kept) {
      const key = normalizePushedWord(item.word);
      if (!allKept.some((k) => normalizePushedWord(k.word) === key)) allKept.push(item);
    }
    if (allKept.length >= targetCount) break;
    if (attempt < DEDUPE_RETRY_COUNT) {
      excludeList = mergeExcludeLists(excludeList, rejected, kept.map((k) => k.word));
      continue;
    }
    break;
  }

  const filled = allowBackfill
    ? fillVocabToTarget(db, uid, allKept, targetCount, extraFallback)
    : { words: allKept.slice(0, targetCount), usedBackfill: false };
  if (!skipRecord) recordPushedWords(db, uid, moduleName, filled.words);
  try { purgeExpiredPushedWords(db); } catch { /* ignore */ }
  const short = !allowBackfill && filled.words.length < targetCount;
  return {
    words: filled.words,
    usedBackfill: filled.usedBackfill,
    notice: filled.usedBackfill
      ? DEDUPE_BACKFILL_NOTICE
      : (short ? DEDUPE_SHORT_NOTICE : null),
    raw: lastParsed,
    error: lastError,
  };
}

const WAKEUP_DIFY_FETCH_ATTEMPTS = 2;

function wakeupDifyRetryDelayMs() {
  const n = Number(process.env.WAKEUP_DIFY_RETRY_MS);
  return Number.isFinite(n) && n >= 0 ? n : 1500;
}

function isTransientDifyFetchError(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.cause?.code || err?.code || '');
  return /fetch failed|Failed to fetch|NetworkError|Load failed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|UND_ERR|socket hang up/i.test(`${msg} ${code}`);
}

/** 禁止把 Node/undici 的 fetch failed 原文写入 daily_packs.error_message */
function formatWakeupDifyFetchError(err) {
  if (err == null || err === '') return null;
  const raw = String(err instanceof Error ? err.message : err).trim() || '未知错误';
  if (/唤醒服务暂时连不上/.test(raw)) return raw;
  if (isTransientDifyFetchError(err) || isTransientDifyFetchError(raw)) {
    const code = (err && err.cause && err.cause.code) || (err && err.code) || '';
    const suffix = code ? `（${code}）` : '';
    return `唤醒服务暂时连不上${suffix}，请稍后点「立即生成」重试`;
  }
  return raw;
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
  let lastErr;
  for (let attempt = 1; attempt <= WAKEUP_DIFY_FETCH_ATTEMPTS; attempt++) {
    try {
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
    } catch (err) {
      lastErr = err;
      if (attempt < WAKEUP_DIFY_FETCH_ATTEMPTS && isTransientDifyFetchError(err)) {
        const delay = wakeupDifyRetryDelayMs();
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new Error(formatWakeupDifyFetchError(err) || '唤醒服务请求失败');
    }
  }
  throw new Error(formatWakeupDifyFetchError(lastErr) || '唤醒服务请求失败');
}

function normalizeWakeupPayload(value, fallbackTheme = '') {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const grammar = source.grammar && typeof source.grammar === 'object' ? source.grammar : {};
  const examples = Array.isArray(grammar.examples)
    ? grammar.examples.map((example) => ({
        correct: String(example?.correct || ''),
        incorrect: String(example?.incorrect || ''),
      })).filter((example) => example.correct && example.incorrect)
    : [];

  return {
    ...source,
    theme: String(source.theme || fallbackTheme).trim(),
    vocab: Array.isArray(source.vocab) ? source.vocab : [],
    grammar: {
      point: String(grammar.point || '').trim() || '暂无语法点',
      explanation: String(grammar.explanation || '').trim() || '暂无语法讲解。',
      examples,
    },
  };
}

/** 唤醒最多 5 词：候选池收集后 3+2 挑选；普通词拒绝；博弈槽不足则带 hint 重试 */
async function generateWakeupVocabForUser(db, userId, {
  theme,
  historyExclude = '',
  userCurrentProfile = '',
  callLlm,
} = {}) {
  const uid = normalizeUserId(userId);
  const profile = userCurrentProfile || getUserCurrentProfile(db, uid);
  const baseExclude = String(historyExclude || '').trim();
  const runner = typeof callLlm === 'function'
    ? callLlm
    : (excludeCsv, theoryHint) => callWakeupWorkflow({
      theme: theoryHint
        ? `${theme} | fill 2 theory slots with: ${theoryHint}`
        : theme,
      userId: uid,
      historyExclude: excludeCsv,
      userCurrentProfile: profile,
    });

  const result = await generateVocabWithDedupe(db, uid, {
    moduleName: 'wakeup',
    targetCount: 20,
    baseExclude,
    extraExclude: [
      ...getSameDaySiblingWords(db, uid),
      ...GENERIC_BAN_WORDS,
    ],
    callLlm: (csv) => runner(csv),
    extraFallback: [],
    allowBackfill: false,
    skipRecord: true,
  });

  if (result.error && result.words.length === 0) {
    throw result.error;
  }

  let picked = pickWakeupSlots(result.words);
  const theoryCount = picked.filter((i) => resolveWakeupSlot(i) === 'theory').length;
  if (theoryCount < 2) {
    const hint = unusedTheoryHints(picked).join(', ');
    const retry = await generateVocabWithDedupe(db, uid, {
      moduleName: 'wakeup',
      targetCount: 20,
      baseExclude,
      extraExclude: [
        ...getSameDaySiblingWords(db, uid),
        ...GENERIC_BAN_WORDS,
        ...picked.map((i) => i.word),
      ],
      callLlm: (csv) => runner(csv, hint),
      allowBackfill: false,
      skipRecord: true,
    });
    picked = pickWakeupSlots([...picked, ...retry.words]);
  }

  recordPushedWords(db, uid, 'wakeup', picked);
  try { purgeExpiredPushedWords(db); } catch { /* ignore */ }

  const wakeup = normalizeWakeupPayload({
    ...((result.raw && typeof result.raw === 'object' && !Array.isArray(result.raw)) ? result.raw : {}),
    theme: (result.raw && result.raw.theme) || theme,
    vocab: picked,
  }, theme);
  if (picked.length < WAKEUP_VOCAB_TARGET) wakeup._dedupeNotice = DEDUPE_SHORT_NOTICE;
  return wakeup;
}

/** 破绽 6 词：与唤醒共用推送历史池 */
async function generateFlawVocabForUser(db, userId, themeOverride, { callLlm } = {}) {
  const uid = normalizeUserId(userId);
  const dbWords = getUserVocabWords(db, uid);
  const todayStr = getPackDate();
  const randomSalt = Math.floor(Math.random() * 10000);
  const randomFocus = FLAW_SUB_THEMES[Math.floor(Math.random() * FLAW_SUB_THEMES.length)];
  const userTheme = String(themeOverride || '').trim();
  const dynamicTheme = userTheme
    ? `${userTheme} | identifying logical flaws and business counterattack (Focus: ${randomFocus}, Date: ${todayStr}, Salt: ${randomSalt})`
    : `identifying logical flaws and business counterattack (Focus: ${randomFocus}, Date: ${todayStr}, Salt: ${randomSalt})`;
  const profile = getUserCurrentProfile(db, uid);

  const runner = typeof callLlm === 'function'
    ? callLlm
    : async (excludeCsv) => callWakeupWorkflow({
      theme: dynamicTheme,
      userId: uid,
      historyExclude: excludeCsv,
      userCurrentProfile: profile,
    });

  const result = await generateVocabWithDedupe(db, uid, {
    moduleName: 'flaw',
    targetCount: FLAW_VOCAB_TARGET,
    callLlm: runner,
    extraFallback: getFallbackFlawVocab(),
    extraExclude: getSameDaySiblingWords(db, uid),
  });

  // 保持返回值为纯数组，兼容前端 Array.isArray(pack.flawVocab)
  return result.words.length
    ? result.words
    : buildFlawDisplayWords([], dbWords, []);
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
  const historyExclude = getHistoryExclude(db, uid);
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
    const wakeup = await generateWakeupVocabForUser(db, uid, {
      theme,
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
      errorMessage: formatWakeupDifyFetchError(err) || err.message || String(err),
    });
    throw err;
  }
}

function serializeDailyPack(row, currentTheme) {
  const current = String(currentTheme || '').trim();
  if (!row) {
    return {
      success: true,
      status: 'missing',
      currentTheme: current || undefined,
      theme: current || undefined,
      stale: false,
    };
  }
  const packTheme = String(row.theme || '').trim();
  return {
    success: true,
    packDate: row.pack_date,
    theme: packTheme,
    currentTheme: current || packTheme,
    stale: Boolean(current && packTheme && current !== packTheme),
    status: row.status,
    source: row.source,
    errorMessage: formatWakeupDifyFetchError(row.error_message) || row.error_message || null,
    wakeup: row.wakeup_json ? normalizeWakeupPayload(JSON.parse(row.wakeup_json), row.theme) : null,
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

  const existing = db.prepare(
    'SELECT id, article FROM daily_extracted_articles WHERE user_id = ? AND quota_date = ? AND theme = ? AND genre = ? AND cefr_level = ? AND duration = ?'
  ).get(uid, packDate, theme, genre, cefrLevel, String(duration));

  if (existing && isUsableLongArticle(existing.article)) {
    console.log(`[LongArticle Service] Skipped user=${uid} - already generated for ${packDate} (${theme}/${genre}/${cefrLevel}/${duration})`);
    return { success: true, status: 'skipped', reason: 'already_generated' };
  }
  if (existing && !isUsableLongArticle(existing.article)) {
    console.warn(`[LongArticle Service] Existing cache unusable (think/empty) user=${uid} ${genre}/${cefrLevel}/${duration} — regenerating`);
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
  isAccentProfile,
  sanitizeWeaknessProfile,
  computeInputSignature,
  computeDailyArticleInputSignature,
  computeListenArticleInputSignature,
  getPackDate,
  getShanghaiHourMinute,
  initDailyPackTables,
  upsertUserTheme,
  getOrCreateUserTheme,
  DEFAULT_USER_THEME,
  listUsersWithSyncedTheme,
  findUserDailyPackByDate,
  getTodayPackForCurrentTheme,
  getDailyPackRow,
  getFallbackFlawVocab,
  buildFlawDisplayWords,
  getUserCurrentProfile,
  buildInjectedUserCurrentProfile,
  resolveUserCurrentProfileForDify,
  getHistoryExclude,
  capHistoryExcludeForDify,
  DIFY_HISTORY_EXCLUDE_MAX,
  DEDUPE_WINDOW_DAYS,
  DEDUPE_RETENTION_DAYS,
  DEDUPE_BACKFILL_NOTICE,
  WAKEUP_VOCAB_TARGET,
  FLAW_VOCAB_TARGET,
  normalizePushedWord,
  normalizeWordSurface,
  stemWordKey,
  stemsMatch,
  getSameDaySiblingWords,
  GENERIC_BAN_WORDS,
  THEORY_LEXICON,
  DEDUPE_SHORT_NOTICE,
  isBannedGenericWord,
  isTheoryLexiconWord,
  resolveWakeupSlot,
  pickWakeupSlots,
  unusedTheoryHints,
  getRecentPushedWords,
  recordPushedWords,
  getOldestPushedWords,
  purgeExpiredPushedWords,
  mergeExcludeLists,
  buildEffectiveHistoryExclude,
  filterVocabAgainstExclude,
  fillVocabToTarget,
  generateVocabWithDedupe,
  generateWakeupVocabForUser,
  generateFlawVocabForUser,
  generateDailyPackForUser,
  generateLongArticleForUser,
  waitForExtractTask,
  serializeDailyPack,
  upsertDailyPack,
  formatWakeupDifyFetchError,
  callWakeupWorkflow,
};
