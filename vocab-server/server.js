const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

// ??????????????
require('dotenv').config({ path: path.join(__dirname, '.env') });

const KNOWLEAGE_PRO_SCENARIOS_DATASET_ID = 'c53857b1-f54f-42ef-a6e8-fe54e9333862';

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// ??????????????????????????????
const tempAudioDir = path.join(__dirname, 'public', 'temp_audio');
const TEMP_AUDIO_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isValidCachedAudio(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

function removeInvalidCachedAudio(filePath) {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size === 0) {
      fs.unlinkSync(filePath);
    }
  } catch { /* ignore */ }
}

function cleanExpiredTempAudioFiles() {
  const files = fs.readdirSync(tempAudioDir);
  const now = Date.now();
  let cleaned = 0;
  for (const file of files) {
    if (!file.endsWith('.mp3')) continue;
    const filePath = path.join(tempAudioDir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.size === 0 || now - stat.mtimeMs > TEMP_AUDIO_MAX_AGE_MS) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    } catch { /* ignore individual file errors */ }
  }
  return cleaned;
}

if (!fs.existsSync(tempAudioDir)) {
  fs.mkdirSync(tempAudioDir, { recursive: true });
} else {
  try {
    const cleaned = cleanExpiredTempAudioFiles();
    console.log(`[TTS Cache] Startup clean: removed ${cleaned} expired audio files.`);
  } catch (err) {
    console.error('[TTS Cache] Failed to clean temporary audio cache on startup:', err);
  }
}

setInterval(() => {
  try {
    const cleaned = cleanExpiredTempAudioFiles();
    if (cleaned > 0) console.log(`[TTS Cache] Periodic clean: removed ${cleaned} expired audio files.`);
  } catch (err) {
    console.error('[TTS Cache] Periodic clean failed:', err);
  }
}, 60 * 60 * 1000);

app.use('/api/temp_audio', express.static(tempAudioDir, {
  setHeaders: (res) => res.setHeader('Content-Type', 'audio/mpeg')
}));

const dailyListenAudioDir = path.join(__dirname, 'public', 'daily_listen_audio');
const dailyLongArticlesDir = path.join(__dirname, 'public', 'daily_long_articles');
app.use('/api/daily_listen_audio', express.static(dailyListenAudioDir));
app.use('/api/daily_long_articles', express.static(dailyLongArticlesDir));

// ?????????????????????????????
const longAudioDir = path.join(__dirname, 'public', 'long_audio');
if (!fs.existsSync(longAudioDir)) {
  fs.mkdirSync(longAudioDir, { recursive: true });
}
app.use('/api/long_audio', express.static(longAudioDir));

// ???????????????????????????????
const tempVideoDir = path.join(__dirname, 'public', 'temp_videos');
if (!fs.existsSync(tempVideoDir)) {
  fs.mkdirSync(tempVideoDir, { recursive: true });
}
app.use('/api/temp_videos', express.static(tempVideoDir));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3001;

// ==========================================
// ??????????????
// ?? SOP?????????????????????????????/var/www/super-agent/vocab.db
// ????????????????????????????./vocab.db
// ==========================================
const isProd = process.env.NODE_ENV === 'production' || __dirname.includes('/opt/vocab-server');
const dbPath = isProd ? '/var/www/super-agent/vocab.db' : path.join(__dirname, 'vocab.db');

// ??????????????????????????????????????????????????
if (isProd && !fs.existsSync('/var/www/super-agent')) {
  fs.mkdirSync('/var/www/super-agent', { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ????????vocabulary ???
db.prepare(`
  CREATE TABLE IF NOT EXISTS vocabulary (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    dict_type TEXT,
    category TEXT DEFAULT 'business',
    scene_type TEXT DEFAULT 'business',
    payload TEXT,
    added_at INTEGER,
    repetitions INTEGER DEFAULT 0,
    ease_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 1,
    next_review_date INTEGER,
    last_review_date INTEGER,
    review_history TEXT DEFAULT '[]'
  )
`).run();

// ????????????????????????????????category ?????????????????????
try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN category TEXT DEFAULT 'business'").run();
  console.log('Migration: Added category column to vocabulary table.');
} catch (err) {
  // ???????????????
}

try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN scene_type TEXT DEFAULT 'business'").run();
  console.log('Migration: Added scene_type column to vocabulary table.');
} catch (err) {}

try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN repetitions INTEGER DEFAULT 0").run();
} catch (err) {}

try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN ease_factor REAL DEFAULT 2.5").run();
} catch (err) {}

try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN interval_days INTEGER DEFAULT 1").run();
} catch (err) {}

// ??????????????? memory_aids ???
try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN memory_aids TEXT").run();
  console.log('Migration: Added memory_aids column to vocabulary table.');
} catch (err) {
  // ???????????????
}

// 澶嶄範/鍒楄〃鏌ヨ绱㈠紩锛堟棤鎹熸€ц兘锛?try {
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_review ON vocabulary(next_review_date, repetitions)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_added_at ON vocabulary(added_at)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_word_nocase ON vocabulary(word COLLATE NOCASE)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_category ON vocabulary(category)').run();
} catch (err) {
  console.warn('Migration: vocabulary indexes skipped:', err?.message || err);
}

try {
  const result = db.prepare(`
    UPDATE vocabulary
    SET category = 'business'
    WHERE category IS NULL OR category NOT IN ('business', 'general')
  `).run();
  if (result.changes > 0) {
    console.log(`[Vocab] normalized ${result.changes} legacy categories to business`);
  }
} catch (err) {
  console.warn('Migration: vocabulary category normalization skipped:', err?.message || err);
}

// ??????????????????????????????????????????
db.prepare(`
  CREATE TABLE IF NOT EXISTS dict_query_log (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    dict_type TEXT NOT NULL,
    direction TEXT,
    user_context TEXT,
    locale TEXT,
    is_success INTEGER,
    response_payload TEXT,
    created_at INTEGER
  )
`).run();

// ?????????????? (????????????????????????????????)
db.prepare(`CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, title TEXT, created_at INTEGER)`).run();

// ????????training_sessions ???training_attempts ???
db.prepare(`
  CREATE TABLE IF NOT EXISTS training_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    training_date TEXT UNIQUE,
    total_minutes INTEGER DEFAULT 0,
    listen_minutes INTEGER DEFAULT 0,
    logic_minutes INTEGER DEFAULT 0,
    extra_json TEXT DEFAULT '{}',
    created_at INTEGER,
    updated_at INTEGER
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS training_attempts (
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
  )
`).run();

// Ensure columns exist for older DB versions
try {
  db.prepare("ALTER TABLE training_attempts ADD COLUMN module_type TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE training_attempts ADD COLUMN scene_type TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE training_attempts ADD COLUMN score REAL").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE training_attempts ADD COLUMN case_text TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE training_attempts ADD COLUMN duration_seconds INTEGER").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE training_attempts ADD COLUMN user_answer TEXT").run();
} catch (e) {}

// ????????theme_progress ????????????????????????????
db.prepare(`
  CREATE TABLE IF NOT EXISTS theme_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    theme TEXT,
    has_perfect_email INTEGER DEFAULT 0,
    updated_at INTEGER,
    UNIQUE(user_id, theme)
  )
`).run();

// ????????personal_prototypes ???
db.prepare(`
  CREATE TABLE IF NOT EXISTS personal_prototypes (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    type TEXT,
    description TEXT,
    added_at INTEGER
  )
`).run();

// 鍗氬紙瀵瑰眬鍘嗗彶锛堟渚嬬爺鍒?/ 浜烘満瀵规垬锛?db.prepare(`
  CREATE TABLE IF NOT EXISTS game_theory_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default-user',
    source_type TEXT NOT NULL,
    title TEXT NOT NULL,
    scene_type TEXT,
    game_model TEXT,
    score INTEGER,
    is_success INTEGER,
    suggestion TEXT,
    causal_chain_json TEXT,
    full_result_json TEXT,
    created_at INTEGER
  )
`).run();

// ???????? custom_themes ? (??????????)
db.prepare(`
  CREATE TABLE IF NOT EXISTS custom_themes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default-user',
    theme_name TEXT NOT NULL,
    display_name TEXT,
    associated_file TEXT,
    dify_document_id TEXT,
    dify_dataset_id TEXT,
    extracted_keywords TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    UNIQUE(user_id, theme_name)
  )
`).run();

// ???????? generation_history ? (??????????????)
db.prepare(`
  CREATE TABLE IF NOT EXISTS generation_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default-user',
    theme TEXT NOT NULL,
    generated_at INTEGER,
    article_summary TEXT,
    keywords TEXT,
    ttl_days INTEGER DEFAULT 3
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS user_memories (
    user_id TEXT PRIMARY KEY,
    profile_content TEXT NOT NULL,
    error_ledger TEXT,
    updated_at INTEGER NOT NULL
  )
`).run();

try {
  db.prepare("ALTER TABLE user_memories ADD COLUMN memory_layers TEXT DEFAULT '{}'").run();
  console.log('Migration: Added memory_layers column to user_memories.');
} catch (e) {
  /* column may already exist */
}

const dailyPackService = require('./services/dailyPackService');
const dailyPackCron = require('./services/dailyPackCron');
dailyPackService.initDailyPackTables(db);
const dailyListenPreGenerateService = require('./services/dailyListenPreGenerateService');
dailyListenPreGenerateService.initDailyListenTables(db);

function normalizeMemoryUserId(raw) {
  if (!raw) return 'default-user';
  const base = String(raw).split('@')[0].trim();
  return base || 'default-user';
}

function parseJsonObject(raw, fallback = {}) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function mergeProfileNarrative(existing, delta) {
  const prev = String(existing || '').trim();
  const next = String(delta || '').trim();
  if (!next) return prev;
  if (!prev) return next.slice(0, 2000);
  if (prev.includes(next)) return prev;
  return `${prev}; ${next}`.slice(0, 2000);
}

function splitProfileSegments(text) {
  return String(text || '')
    .split(/[;锛沒\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeProfileSegment(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/鏍囪:[^\s;锛沒+/gi, '')
    .replace(/\s+/g, '')
    .slice(0, 500);
}

function profileSegmentBigrams(text) {
  const normalized = normalizeProfileSegment(text);
  const set = new Set();
  for (let i = 0; i < normalized.length - 1; i += 1) {
    set.add(normalized.slice(i, i + 2));
  }
  return set;
}

function profileSegmentSimilarity(a, b) {
  const na = normalizeProfileSegment(a);
  const nb = normalizeProfileSegment(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = na.length <= nb.length ? na : nb;
    const longer = na.length > nb.length ? na : nb;
    return shorter.length / Math.max(longer.length, 1);
  }
  const ba = profileSegmentBigrams(a);
  const bb = profileSegmentBigrams(b);
  if (!ba.size || !bb.size) return 0;
  let inter = 0;
  for (const token of ba) {
    if (bb.has(token)) inter += 1;
  }
  return inter / (ba.size + bb.size - inter);
}

function dedupeProfileLocal(existing, delta) {
  const segments = [...splitProfileSegments(existing), ...splitProfileSegments(delta)];
  if (!segments.length) return '';
  const merged = [];
  let dedupeCount = 0;
  for (const seg of segments) {
    const idx = merged.findIndex((item) => profileSegmentSimilarity(item, seg) >= 0.62);
    if (idx >= 0) {
      merged[idx] = seg;
      dedupeCount += 1;
    } else {
      merged.push(seg);
    }
  }
  return { mergedProfile: merged.join('; ').slice(0, 2000), dedupeCount };
}

function parseProfileDedupeXml(rawText) {
  const text = String(rawText || '');
  const pick = (tag) => {
    const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return m ? m[1].trim() : '';
  };
  const mergedProfile = pick('merged_profile');
  if (!mergedProfile) return null;
  return {
    mergedProfile: mergedProfile.slice(0, 2000),
    dedupeCount: Number(pick('dedupe_count') || 0),
  };
}

function isProfileDedupeEnabled() {
  return Boolean(process.env.DIFY_PROFILE_DEDUPE_API_KEY);
}

async function runProfileDedupeWorkflow(existingProfile, newDelta, userId, meta = {}) {
  const apiKey = process.env.DIFY_PROFILE_DEDUPE_API_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  const timeoutMs = Number(process.env.PROFILE_DEDUPE_TIMEOUT_MS || 45000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          existing_profile: String(existingProfile || '').slice(0, 2000),
          new_delta: String(newDelta || '').slice(0, 800),
          delta_source: String(meta.source || 'unknown').slice(0, 80),
          delta_timestamp_ms: String(meta.at || Date.now()),
        },
        response_mode: 'blocking',
        user: normalizeMemoryUserId(userId),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Dify profile dedupe HTTP ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? '';
    const parsed = parseProfileDedupeXml(rawResult);
    if (!parsed?.mergedProfile) {
      throw new Error('profile dedupe parse_failed');
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

async function mergeProfileWithDedupe(existing, delta, userId, meta = {}) {
  const prev = String(existing || '').trim();
  const next = String(delta || '').trim();
  if (!next) return prev;
  if (!prev) return next.slice(0, 2000);
  if (prev.includes(next)) return prev;

  if (isProfileDedupeEnabled()) {
    try {
      const llmResult = await runProfileDedupeWorkflow(prev, next, userId, meta);
      if (llmResult?.mergedProfile) return llmResult.mergedProfile;
    } catch (err) {
      console.warn('[Profile Dedupe] LLM failed, using local fallback:', err.message);
    }
  }

  return dedupeProfileLocal(prev, next).mergedProfile;
}

const MANUAL_PROFILE_COMPRESS_DELTA = '銆愭墜鍔ㄥ帇缂┿€戝宸叉湁鐢诲儚鍏ㄦ枃鍋氳涔夊幓閲嶄笌绮剧偧锛屽悎骞堕噸澶嶄富棰橈紝淇濈暀鏈€鏂颁俊鎭紱蹇界暐鏈潯鎻愮ず鏈韩銆?;

async function compressProfileContent(profileContent, userId) {
  const text = String(profileContent || '').trim();
  if (!text) {
    return { mergedProfile: '', dedupeCount: 0, source: 'empty' };
  }

  if (isProfileDedupeEnabled()) {
    try {
      const llmResult = await runProfileDedupeWorkflow(
        text,
        MANUAL_PROFILE_COMPRESS_DELTA,
        userId,
        { source: 'manual_compress', at: Date.now() },
      );
      if (llmResult?.mergedProfile) {
        return { ...llmResult, source: 'dify' };
      }
    } catch (err) {
      console.warn('[Profile Dedupe] manual compress failed:', err.message);
    }
  }

  const local = dedupeProfileLocal(text, '');
  return {
    mergedProfile: local.mergedProfile,
    dedupeCount: local.dedupeCount,
    source: 'local',
  };
}

const L3_VAR_KEYS = new Set(['accent', 'locale', 'timezone', 'training_goal', 'spelling_variant', 'weakness_focus']);

function normalizeL3VarKey(key) {
  return String(key || '').trim().replace(/[^a-z0-9_]/gi, '_').slice(0, 40);
}

function normalizeL3VarValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  return String(val).trim().slice(0, 200);
}

function getL3VarsObject(memoryLayers) {
  const raw = memoryLayers?.l3_vars;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...raw };
}

function mergeL3Vars(existing, delta) {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  const conflicts = [];
  if (!delta || typeof delta !== 'object' || Array.isArray(delta)) {
    return { vars: base, conflicts };
  }
  for (const [rawKey, rawVal] of Object.entries(delta)) {
    const key = normalizeL3VarKey(rawKey);
    if (!key || !L3_VAR_KEYS.has(key)) continue;
    const next = normalizeL3VarValue(rawVal);
    if (!next) continue;
    const prev = base[key];
    if (prev !== undefined && String(prev) !== next) {
      conflicts.push(`${key}=${prev}`);
    }
    base[key] = next;
  }
  return { vars: base, conflicts };
}

function inferL3VarsDeltaFromText(text) {
  const delta = {};
  const raw = String(text || '');
  if (/婢冲紡|婢冲ぇ鍒╀簹|\(AU\)|\bAU\b|婢虫床/i.test(raw)) {
    delta.accent = 'AU';
  } else if (/鑻遍煶|鑻卞浗|\(UK\)|\bUK\b|\[profile:\s*uk\]/i.test(raw)) {
    delta.accent = 'UK';
    delta.spelling_variant = 'UK';
  } else if (/缇庨煶|缇庡浗|\(US\)|\bUS\b|\[profile:\s*us\]/i.test(raw)) {
    delta.accent = 'US';
    delta.spelling_variant = 'US';
  }
  if (/鍗冲叴/.test(raw) && /琛ㄨ揪|鍙ｈ/.test(raw)) {
    delta.training_goal = '鍗冲叴琛ㄨ揪';
  }
  return delta;
}

function applyL3VarsToMemoryLayers(memoryLayers, delta, profileConflicts = null) {
  if (!delta || typeof delta !== 'object') return { changed: false, conflicts: [] };
  const merged = mergeL3Vars(getL3VarsObject(memoryLayers), delta);
  if (Object.keys(merged.vars).length) {
    memoryLayers.l3_vars = merged.vars;
  }
  if (merged.conflicts.length && Array.isArray(profileConflicts)) {
    for (const c of merged.conflicts) {
      if (!profileConflicts.includes(c)) profileConflicts.push(c);
    }
  }
  return { changed: Object.keys(merged.vars).length > 0, conflicts: merged.conflicts };
}

function upsertUserMemoryRow(userId, { profileContent, errorLedger, memoryLayers, updatedAt }) {
  const now = updatedAt || Date.now();
  db.prepare(`
    INSERT INTO user_memories (user_id, profile_content, error_ledger, memory_layers, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      profile_content = COALESCE(excluded.profile_content, user_memories.profile_content),
      error_ledger = COALESCE(excluded.error_ledger, user_memories.error_ledger),
      memory_layers = COALESCE(excluded.memory_layers, user_memories.memory_layers),
      updated_at = excluded.updated_at
  `).run(
    userId,
    profileContent ?? '',
    errorLedger ?? '{}',
    memoryLayers ?? '{}',
    now,
  );
}

function formatEpisodeLine(episode, index) {
  const source = episode.source || 'unknown';
  const at = episode.at ? new Date(episode.at).toLocaleDateString('zh-CN') : '';
  const text = String(
    episode.summary
    || episode.preview
    || episode.weaknessScan
    || episode.practicalTest
    || '',
  ).trim().slice(0, 180);
  if (!text) return null;
  return `${index + 1}. [${source}${at ? `路${at}` : ''}] ${text}`;
}

function buildMemoryContextForUser(userId) {
  const uid = normalizeMemoryUserId(userId);
  const row = db.prepare('SELECT profile_content, memory_layers, error_ledger FROM user_memories WHERE user_id = ?').get(uid);
  const memoryLayers = parseJsonObject(row?.memory_layers, {});
  const ledger = parseJsonObject(row?.error_ledger, {});
  const profileSummary = String(row?.profile_content || '').trim().slice(0, 600)
    || '鏆傛棤鐢ㄦ埛鐢诲儚鎽樿銆?;

  const episodeLines = (Array.isArray(memoryLayers.l2_episodes) ? memoryLayers.l2_episodes : [])
    .slice(0, 5)
    .map(formatEpisodeLine)
    .filter(Boolean);
  const recentEpisodesSummary = episodeLines.length
    ? episodeLines.join('\n')
    : '鏆傛棤杩戞湡鎯呮櫙璁板繂銆?;

  const errorParts = [];
  for (const cat of ['oral', 'listening', 'vocab']) {
    const items = ledger[cat];
    if (!Array.isArray(items) || !items.length) continue;
    const top = items.slice(0, 3).map((e) => {
      if (cat === 'oral') return e.flaw;
      if (cat === 'listening') return e.pattern || e.reason;
      return e.word;
    }).filter(Boolean);
    if (top.length) errorParts.push(`${cat}: ${top.join('銆?)}`);
  }
  const errorLedgerSummary = errorParts.length
    ? errorParts.join('; ')
    : '鏆傛棤缁撴瀯鍖栫煭鏉胯褰曘€?;

  const graphSummary = formatGraphSummary(memoryLayers);

  return { profileSummary, recentEpisodesSummary, errorLedgerSummary, graphSummary, memoryLayers };
}

function normalizeGraphNodeName(name) {
  return String(name || '').trim().slice(0, 80);
}

function formatGraphSummary(memoryLayers) {
  const graph = memoryLayers?.l2_graph;
  if (!graph || typeof graph !== 'object') return '鏆傛棤鍏崇郴璁板繂銆?;
  const relations = Array.isArray(graph.relations) ? graph.relations.slice(0, 8) : [];
  if (!relations.length) return '鏆傛棤鍏崇郴璁板繂銆?;
  return relations.map((r, i) => {
    const ev = r.evidence ? ` (${String(r.evidence).slice(0, 60)})` : '';
    return `${i + 1}. ${r.from} 鈥擺${r.rel}]鈫?${r.to}${ev}`;
  }).join('\n');
}

function mergeGraphMemory(existing, { entities = [], relations = [] }, source = 'llm_dreaming') {
  const graph = existing && typeof existing === 'object' ? existing : {};
  const entityList = Array.isArray(graph.entities) ? [...graph.entities] : [];
  const relationList = Array.isArray(graph.relations) ? [...graph.relations] : [];
  const now = Date.now();
  let newEntities = 0;
  let newRelations = 0;

  for (const e of entities.slice(0, 10)) {
    if (!e || typeof e !== 'object') continue;
    const name = normalizeGraphNodeName(e.name);
    if (!name) continue;
    const type = String(e.type || 'general').trim().slice(0, 40);
    const key = `${type}:${name}`;
    if (!entityList.some((x) => `${x.type || 'general'}:${x.name}` === key)) {
      entityList.unshift({ name, type, source, at: now });
      newEntities += 1;
    }
  }

  for (const r of relations.slice(0, 15)) {
    if (!r || typeof r !== 'object') continue;
    const from = normalizeGraphNodeName(r.from);
    const to = normalizeGraphNodeName(r.to);
    const rel = String(r.rel || r.relation || '鍏宠仈').trim().slice(0, 40);
    if (!from || !to) continue;
    const evidence = String(r.evidence || '').trim().slice(0, 200);
    const key = `${from}|${rel}|${to}`;
    const existingIdx = relationList.findIndex((x) => `${x.from}|${x.rel}|${x.to}` === key);
    if (existingIdx >= 0) {
      relationList[existingIdx] = {
        ...relationList[existingIdx],
        evidence: evidence || relationList[existingIdx].evidence,
        at: now,
        source,
      };
    } else {
      relationList.unshift({ from, rel, to, evidence, source, at: now });
      newRelations += 1;
    }
  }

  return {
    graph: {
      entities: entityList.slice(0, 40),
      relations: relationList.slice(0, 60),
    },
    newEntities,
    newRelations,
  };
}

/** LLM 鏈緭鍑?relations 鏃讹紝浠?episode/鐢诲儚鏂囨湰瑙勫垯鍚堟垚鍩虹鍥捐氨 */
function fallbackGraphFromMemory(pending, profileContent, profileDelta) {
  const entities = [];
  const relations = [];
  const texts = [
    ...pending.map((ep) => getEpisodeText(ep)),
    String(profileContent || ''),
    String(profileDelta || ''),
  ].filter(Boolean);
  const corpus = texts.join(' ');
  if (!corpus.trim()) return { entities, relations };

  const pushEntity = (name, type) => {
    if (!entities.some((e) => e.name === name)) entities.push({ name, type });
  };
  const pushRel = (from, rel, to, evidence) => {
    pushEntity(from, from === '鐢ㄦ埛' ? 'person' : 'concept');
    pushEntity(to, 'concept');
    relations.push({ from, rel, to, evidence: String(evidence || corpus).slice(0, 120) });
  };

  pushEntity('鐢ㄦ埛', 'person');
  const evidence = texts[0] || corpus;
  if (/鑻遍煶|鑻卞浗|\(UK\)|\bUK\b/i.test(corpus)) {
    pushRel('鐢ㄦ埛', '鍋忓ソ', '鑻遍煶', evidence);
  }
  if (/缇庨煶|缇庡浗|\(US\)|\bUS\b/i.test(corpus)) {
    pushRel('鐢ㄦ埛', '鍋忓ソ', '缇庨煶', evidence);
  }
  if (/鍗冲叴/.test(corpus) && /閫昏緫|琛ㄨ揪/.test(corpus)) {
    pushRel('鐢ㄦ埛', '姝ｅ湪缁冧範', '鍗冲叴琛ㄨ揪閫昏緫閾?, evidence);
  }

  return { entities, relations };
}

/** 浠?LLM 宸茶緭鍑虹殑 semantics 鍚堟垚鍏崇郴锛堝伐浣滄祦鏈繑鍥?relations 鏃剁殑鍏滃簳锛?*/
function graphFromSemantics(semantics) {
  const entities = [{ name: '鐢ㄦ埛', type: 'person' }];
  const relations = [];
  if (!Array.isArray(semantics)) return { entities, relations };

  for (const sem of semantics.slice(0, 5)) {
    if (!sem || typeof sem !== 'object') continue;
    const pattern = String(sem.pattern || sem.tag?.split(':').slice(1).join(':') || '').trim();
    if (!pattern) continue;
    const category = String(sem.category || 'general').trim();
    const rel = category === 'oral' ? '姝ｅ湪缁冧範' : category === 'general' ? '鐗瑰緛' : '鐭澘';
    if (!entities.some((e) => e.name === pattern)) {
      entities.push({ name: pattern, type: 'concept' });
    }
    relations.push({
      from: '鐢ㄦ埛',
      rel,
      to: pattern,
      evidence: String(sem.evidence || pattern).slice(0, 120),
    });
  }
  return { entities, relations };
}

function composeMemorySummaryForPrompt(memoryCtx) {
  const parts = [memoryCtx.recentEpisodesSummary];
  if (memoryCtx.graphSummary && memoryCtx.graphSummary !== '鏆傛棤鍏崇郴璁板繂銆?) {
    parts.push(`鍏崇郴璁板繂锛圙raph锛夛細\n${memoryCtx.graphSummary}`);
  }
  return parts.join('\n\n');
}

const ACCENT_AUTHORITY_LABELS = {
  AU: '婢冲紡鍙ｉ煶',
  UK: '鑻遍煶',
  US: '缇庡紡鍙ｉ煶',
};

function resolveAuthoritativeAccent(profileText, l3Vars) {
  const p = String(profileText || '');
  const ausCount = (p.match(/婢冲紡|婢冲ぇ鍒╀簹/g) || []).length;
  const ukCount = (p.match(/鑻遍煶|鑻卞紡/g) || []).length;
  if (ausCount > 0 && ausCount >= ukCount) return 'AU';
  if (/缇庡紡/.test(p)) return 'US';
  if (ukCount > 0) return 'UK';
  const l3 = l3Vars?.accent;
  if (l3 === 'AU' || l3 === 'UK' || l3 === 'US') return l3;
  return null;
}

function filterStaleUkAccentLines(text, authAccent) {
  if (!text || authAccent !== 'AU') return String(text || '').trim();

  const cleanSegment = (seg) => {
    const s = String(seg || '').trim();
    if (!s) return '';
    if (/鑻遍煶|鑻卞紡|accent\s*=\s*UK/i.test(s) && !/婢冲紡|婢冲ぇ鍒╀簹/.test(s)) return '';
    return s.replace(/\baccent=UK\b/gi, 'accent=AU');
  };

  return String(text)
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/;/.test(trimmed)) {
        const parts = trimmed.split(';').map(cleanSegment).filter(Boolean);
        return parts.join('; ');
      }
      return cleanSegment(trimmed);
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function buildMemoryPackForLlm(userId, query) {
  const uid = normalizeMemoryUserId(userId);
  const ctx = buildMemoryContextForUser(uid);
  const recall = recallMemoryForUser(uid, query || 'memory', 8);
  const authAccent = resolveAuthoritativeAccent(ctx.profileSummary, ctx.memoryLayers?.l3_vars);
  const authLabel = authAccent ? ACCENT_AUTHORITY_LABELS[authAccent] : null;

  let recallContext = filterStaleUkAccentLines(recall.context || '', authAccent);
  const profileSummary = filterStaleUkAccentLines(ctx.profileSummary || '', authAccent);
  const recentEpisodesSummary = filterStaleUkAccentLines(ctx.recentEpisodesSummary || '', authAccent);
  const errorLedgerSummary = filterStaleUkAccentLines(ctx.errorLedgerSummary || '', authAccent);
  const graphSummary = filterStaleUkAccentLines(ctx.graphSummary || '', authAccent);

  const sections = [];
  if (authLabel) {
    sections.push(
      `銆愬彛闊冲亸濂斤紙鏉冨▉锛夈€戠敤鎴风粌鍙ｈ鍋忓ソ${authLabel}銆俙
      + '鑻ヤ笅鏂?graph/episode/鍚戦噺搴?鏃т晶鍐?L3 鍑虹幇涓庢鍐茬獊鐨勫叾浠栧彛闊宠〃杩帮紝涓€寰嬩互鏈涓哄噯锛岃涓鸿繃鏈熻褰曘€?,
    );
  }
  if (recallContext) {
    sections.push(`銆愮粨鏋勫寲鍗虫椂鍙洖銆慭n${recallContext}`);
  }
  const ctxParts = [];
  if (profileSummary && profileSummary !== '鏆傛棤鐢ㄦ埛鐢诲儚鎽樿銆?) {
    ctxParts.push(`銆愮敤鎴风敾鍍忋€慭n${profileSummary}`);
  }
  if (recentEpisodesSummary && recentEpisodesSummary !== '鏆傛棤杩戞湡鎯呮櫙璁板繂銆?) {
    ctxParts.push(`銆愯繎鏈熸儏鏅€慭n${recentEpisodesSummary}`);
  }
  if (errorLedgerSummary && errorLedgerSummary !== '鏆傛棤缁撴瀯鍖栫煭鏉胯褰曘€?) {
    ctxParts.push(`銆愯缁冪煭鏉裤€慭n${errorLedgerSummary}`);
  }
  if (graphSummary && graphSummary !== '鏆傛棤鍏崇郴璁板繂銆?) {
    ctxParts.push(`銆愬叧绯昏蹇嗐€慭n${graphSummary}`);
  }
  const l3 = ctx.memoryLayers?.l3_vars;
  if (l3 && typeof l3 === 'object') {
    const l3Copy = { ...l3 };
    if (authAccent === 'AU' && l3Copy.accent === 'UK') {
      l3Copy.accent = 'AU';
    }
    if (l3Copy.accent) {
      ctxParts.push(`銆怢3鍙橀噺銆慭naccent=${l3Copy.accent}${l3Copy.training_goal ? `\ntraining_goal=${l3Copy.training_goal}` : ''}`);
    }
  }
  if (ctxParts.length) {
    sections.push(`銆愮敾鍍忎笌鍏崇郴涓婁笅鏂囥€慭n${ctxParts.join('\n\n')}`);
  }
  return sections.join('\n\n').trim();
}

function buildRecallQueryFromUserQuery(query) {
  const q = String(query || '').trim();
  const keywords = ['鍙ｉ煶', '鑻卞紡', '鑻遍煶', '婢冲紡', '缇庡紡', '鍋忓ソ', '涔犳儻', '鐩爣', '杈圭晫'];
  const found = keywords.filter((kw) => q.includes(kw));
  return found.length ? found.join(' ') : (q.slice(0, 80) || 'memory');
}

function normalizeRecallQuery(query) {
  return String(query || '').trim().toLowerCase();
}

function recallQueryTokens(query) {
  const q = normalizeRecallQuery(query);
  if (!q) return [];
  const parts = q.split(/[\s,锛?锛涖€併€傦紒锛??]+/).filter((t) => t.length >= 2);
  if (!parts.length) return [q];
  return parts;
}

function scoreRecallText(query, tokens, text) {
  const t = String(text || '').toLowerCase();
  if (!t || !query) return 0;
  let score = 0;
  if (t.includes(query)) score += 10;
  for (const tok of tokens) {
    if (tok.length >= 2 && t.includes(tok)) score += 3;
  }
  return score;
}

function pushRecallHit(hits, seen, item) {
  const key = item.key || `${item.kind}:${item.text}`;
  if (!item.text || seen.has(key)) return;
  seen.add(key);
  hits.push(item);
}

function recallMemoryForUser(userId, query, topK = 5) {
  const q = normalizeRecallQuery(query);
  const tokens = recallQueryTokens(q);
  const limit = Math.min(Math.max(Number(topK) || 5, 1), 15);
  if (!q) {
    return { query: '', items: [], context: '' };
  }

  const uid = normalizeMemoryUserId(userId);
  const row = db.prepare('SELECT profile_content, memory_layers FROM user_memories WHERE user_id = ?').get(uid);
  const memoryLayers = parseJsonObject(row?.memory_layers, {});
  const hits = [];
  const seen = new Set();

  const profileScore = scoreRecallText(q, tokens, row?.profile_content || '');
  if (profileScore > 0) {
    pushRecallHit(hits, seen, {
      kind: 'profile',
      score: profileScore + 2,
      text: String(row?.profile_content || '').trim().slice(0, 200),
      at: 0,
      key: 'profile:main',
    });
  }

  for (const sem of (Array.isArray(memoryLayers.l2_semantics) ? memoryLayers.l2_semantics : [])) {
    if (!sem || typeof sem !== 'object') continue;
    const blob = [sem.tag, sem.pattern, sem.evidence, sem.category].filter(Boolean).join(' ');
    const score = scoreRecallText(q, tokens, blob);
    if (score > 0) {
      pushRecallHit(hits, seen, {
        kind: 'semantic',
        score,
        text: String(sem.pattern || sem.tag || blob).trim().slice(0, 180),
        at: Number(sem.at || 0),
        key: `semantic:${sem.tag || sem.pattern}`,
      });
    }
  }

  for (const ep of (Array.isArray(memoryLayers.l2_episodes) ? memoryLayers.l2_episodes : [])) {
    if (!ep || typeof ep !== 'object') continue;
    const text = getEpisodeText(ep);
    const score = scoreRecallText(q, tokens, text);
    if (score > 0) {
      pushRecallHit(hits, seen, {
        kind: 'episode',
        score,
        text: text.slice(0, 180),
        at: Number(ep.at || 0),
        source: ep.source || 'unknown',
        key: `episode:${ep._id || text.slice(0, 40)}`,
      });
    }
  }

  const graph = memoryLayers.l2_graph;
  const relations = graph && typeof graph === 'object' && Array.isArray(graph.relations) ? graph.relations : [];
  const entities = graph && typeof graph === 'object' && Array.isArray(graph.entities) ? graph.entities : [];
  const matchedEntities = new Set();
  for (const e of entities) {
    const name = normalizeGraphNodeName(e?.name);
    if (name && scoreRecallText(q, tokens, name) > 0) matchedEntities.add(name);
  }
  for (const r of relations) {
    if (!r || typeof r !== 'object') continue;
    const line = `${r.from} ${r.rel} ${r.to} ${r.evidence || ''}`;
    const score = scoreRecallText(q, tokens, line);
    const entityBoost = matchedEntities.has(normalizeGraphNodeName(r.from))
      || matchedEntities.has(normalizeGraphNodeName(r.to)) ? 4 : 0;
    if (score + entityBoost > 0) {
      pushRecallHit(hits, seen, {
        kind: 'graph',
        score: score + entityBoost,
        text: `${r.from} 鈥擺${r.rel}]鈫?${r.to}`.slice(0, 180),
        at: Number(r.at || 0),
        key: `graph:${r.from}|${r.rel}|${r.to}`,
      });
    }
  }

  hits.sort((a, b) => (b.score - a.score) || (b.at - a.at));
  const items = hits.slice(0, limit);
  const context = items.length
    ? items.map((item, i) => {
      const src = item.source ? ` 路 ${item.source}` : '';
      return `${i + 1}. [${item.kind}${src}] ${item.text}`;
    }).join('\n')
    : '';

  return { query: q, items, context };
}

const DREAMING_MIN_PATTERN_COUNT = 2;
const MEMORY_KB_DATASET_ID_DEFAULT = '99abd904-f0e0-45f3-95a8-660b44b17cc5';
const L0_TURNS_MAX = 100;
const L1_SUMMARIES_MAX = 40;
const DREAM_BACKOFF_HTTP_STATUSES = new Set([429, 502, 503, 504]);

function getDreamBackoffMs() {
  return Number(process.env.MEMORY_DREAMING_BACKOFF_MS || 30 * 60 * 1000);
}

function isKbSyncEnabled() {
  return process.env.MEMORY_DREAMING_KB_SYNC !== '0';
}

function getPendingEpisodesFromLayers(memoryLayers, batchSize) {
  const l1Materialized = materializePendingL1ToEpisodes(memoryLayers);
  const episodes = Array.isArray(memoryLayers.l2_episodes)
    ? memoryLayers.l2_episodes.map((ep) => ensureEpisodeMeta(ep))
    : [];
  const limit = Math.min(Math.max(Number(batchSize) || 5, 1), 15);
  const poolSize = isDreamingClusterEnabled()
    ? Math.max(limit, getDreamClusterPoolSize())
    : limit;
  const allPending = episodes.filter((ep) => ep._dreamed !== true);
  const pool = allPending.slice(0, poolSize);
  const selection = selectDreamingBatchFromPending(pool, limit);
  return {
    episodes,
    pending: selection.batch,
    l1Materialized,
    clusterMeta: {
      label: selection.clusterLabel,
      clusterCount: selection.clusterCount,
      pendingTotal: selection.pendingTotal,
      pendingPoolSize: pool.length,
      clustered: selection.clustered,
    },
  };
}

function isDreamingClusterEnabled() {
  return process.env.MEMORY_DREAMING_CLUSTER !== '0';
}

function getDreamClusterWindowMs() {
  return Number(process.env.MEMORY_DREAMING_CLUSTER_WINDOW_MS || 7 * 24 * 60 * 60 * 1000);
}

function getDreamClusterMinSimilarity() {
  const n = Number(process.env.MEMORY_DREAMING_CLUSTER_MIN_SIM || 0.6);
  if (!Number.isFinite(n)) return 0.6;
  return Math.min(Math.max(n, 0), 1);
}

function getDreamClusterPoolSize() {
  return Number(process.env.MEMORY_DREAMING_CLUSTER_POOL || 30);
}

function normalizeClusterText(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, '');
}

function episodeClusterText(ep) {
  return getEpisodeText(ep);
}

function prefixSimilarity(a, b) {
  const x = normalizeClusterText(a);
  const y = normalizeClusterText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return shorter.length / longer.length;
  }
  let i = 0;
  const minLen = Math.min(x.length, y.length);
  while (i < minLen && x[i] === y[i]) i += 1;
  const lcpScore = i === 0 ? 0 : (2 * i) / (x.length + y.length);
  let sharedScore = 0;
  for (let len = Math.min(shorter.length, 20); len >= 6; len -= 1) {
    for (let j = 0; j <= shorter.length - len; j += 1) {
      const sub = shorter.slice(j, j + len);
      if (longer.includes(sub)) {
        sharedScore = Math.max(sharedScore, (2 * len) / (x.length + y.length));
        break;
      }
    }
    if (sharedScore > 0) break;
  }
  return Math.max(lcpScore, sharedScore);
}

function episodesAreSimilar(a, b, minSim) {
  if (prefixSimilarity(a, b) >= minSim) return true;
  const x = normalizeClusterText(a);
  const y = normalizeClusterText(b);
  if (!x || !y) return false;
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  for (let len = Math.min(shorter.length, 20); len >= 6; len -= 1) {
    for (let j = 0; j <= shorter.length - len; j += 1) {
      if (longer.includes(shorter.slice(j, j + len))) return true;
    }
  }
  return false;
}

function getEpisodeClusterGroupKey(ep, windowMs) {
  const source = String(ep.source || 'unknown').trim() || 'unknown';
  const at = Number(ep.at || Date.now());
  const bucket = Math.floor(at / windowMs);
  return `${source}:${bucket}`;
}

function clusterEpisodesInGroup(episodes, batchSize, minSim) {
  const remaining = [...episodes].sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
  const clusters = [];

  while (remaining.length) {
    const seed = remaining.shift();
    const cluster = [seed];
    const seedText = episodeClusterText(seed);
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      if (cluster.length >= batchSize) break;
      const candidate = remaining[i];
      if (episodesAreSimilar(seedText, episodeClusterText(candidate), minSim)) {
        cluster.push(candidate);
        remaining.splice(i, 1);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function clusterPendingEpisodes(pending, batchSize, options = {}) {
  const limit = Math.min(Math.max(Number(batchSize) || 5, 1), 15);
  const windowMs = options.windowMs ?? getDreamClusterWindowMs();
  const minSim = options.minSim ?? getDreamClusterMinSimilarity();
  if (!pending.length) return [];

  const byGroup = new Map();
  for (const ep of pending) {
    const key = getEpisodeClusterGroupKey(ep, windowMs);
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(ep);
  }

  const clusters = [];
  for (const groupEps of byGroup.values()) {
    clusters.push(...clusterEpisodesInGroup(groupEps, limit, minSim));
  }

  clusters.sort((a, b) => {
    const aMin = Math.min(...a.map((ep) => Number(ep.at || 0)));
    const bMin = Math.min(...b.map((ep) => Number(ep.at || 0)));
    return aMin - bMin;
  });
  return clusters;
}

function buildDreamClusterLabel(batch) {
  if (!Array.isArray(batch) || !batch.length) return '';
  const source = String(batch[0].source || 'unknown').trim() || 'unknown';
  const hint = episodeClusterText(batch[0]).slice(0, 24);
  return `${source}路${hint}路${batch.length}鏉;
}

function selectDreamingBatchFromPending(pending, batchSize) {
  const limit = Math.min(Math.max(Number(batchSize) || 5, 1), 15);
  if (!pending.length) {
    return {
      batch: [],
      clusterLabel: '',
      clusterCount: 0,
      pendingTotal: 0,
      clustered: false,
    };
  }

  if (!isDreamingClusterEnabled() || pending.length <= 1) {
    const batch = pending.slice(0, limit);
    return {
      batch,
      clusterLabel: buildDreamClusterLabel(batch),
      clusterCount: 1,
      pendingTotal: pending.length,
      clustered: false,
    };
  }

  const clusters = clusterPendingEpisodes(pending, limit);
  const batch = clusters[0] || pending.slice(0, limit);
  return {
    batch,
    clusterLabel: buildDreamClusterLabel(batch),
    clusterCount: clusters.length,
    pendingTotal: pending.length,
    clustered: true,
  };
}

function shouldRunLlmDreaming(memoryLayers, options = {}) {
  const episodes = Array.isArray(memoryLayers.l2_episodes) ? memoryLayers.l2_episodes : [];
  const hasPending = episodes.some((ep) => ensureEpisodeMeta(ep)._dreamed !== true);
  if (!hasPending) return false;
  if (options.force) return true;
  if (Number(memoryLayers._dream_backoff_until || 0) > Date.now()) return false;
  return true;
}

function persistMemoryLayersOnly(uid, row, memoryLayers) {
  upsertUserMemoryRow(uid, {
    profileContent: row.profile_content || '',
    errorLedger: row.error_ledger || '{}',
    memoryLayers: JSON.stringify(memoryLayers),
    updatedAt: Date.now(),
  });
}

async function postEpisodeSummaryToKb(userId, episode, profileContent) {
  const apiKey = process.env.DIFY_KB_API_KEY || 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
  const baseUrl = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  const datasetId = process.env.DIFY_KB_DATASET_ID || MEMORY_KB_DATASET_ID_DEFAULT;
  const summary = getEpisodeText(episode);
  if (!summary) return { skipped: true, reason: 'empty_summary' };

  const dreamDate = episode._dreamed_at
    ? new Date(episode._dreamed_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const title = `Dreaming鎽樿路${userId}路${dreamDate}`.slice(0, 120);
  const text = `[鐢ㄦ埛 ${userId} 路 ${episode.source || 'unknown'}]\n${summary}\n\n鐢诲儚涓婁笅鏂? ${String(profileContent || '').slice(0, 300)}`;

  const response = await fetch(`${baseUrl}/datasets/${datasetId}/document/create-by-text`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: title,
      text,
      indexing_technique: 'high_quality',
      doc_form: 'text_model',
      doc_language: 'Chinese',
      embedding_model: 'bge-small-zh-v1.5',
      embedding_model_provider: 'langgenius/xinference/xinference',
      process_rule: { mode: 'automatic' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.warn(`[Memory Dreaming] KB sync HTTP ${response.status}:`, errText.slice(0, 300));
    return { skipped: true, reason: 'kb_http_error', status: response.status };
  }

  const data = await response.json().catch(() => ({}));
  return { synced: true, documentId: data?.document?.id || data?.id || null, title };
}

async function syncDreamedEpisodesToKb(userId, episodes, profileContent) {
  if (!isKbSyncEnabled()) return { skipped: true, reason: 'kb_sync_disabled', synced: 0 };

  const targets = episodes.filter((ep) => ep._dreamed === true && !ep._kb_synced && getEpisodeText(ep));
  if (!targets.length) return { skipped: true, reason: 'no_kb_targets', synced: 0 };

  let synced = 0;
  const errors = [];
  for (const ep of targets.slice(0, 5)) {
    try {
      const result = await postEpisodeSummaryToKb(userId, ep, profileContent);
      if (result.synced) {
        ep._kb_synced = true;
        ep._kb_synced_at = Date.now();
        synced += 1;
      } else if (result.reason === 'kb_http_error') {
        errors.push(result.status);
      }
    } catch (e) {
      errors.push(e.message);
    }
  }

  return { synced, errors, skipped: synced === 0 };
}

function isLlmDreamingEnabled() {
  if (process.env.MEMORY_DREAMING_LLM_ENABLED === '0') return false;
  return Boolean(process.env.DIFY_MEMORY_DREAMING_API_KEY);
}

function generateEpisodeId(at = Date.now()) {
  return `ep_${at}_${crypto.randomBytes(4).toString('hex')}`;
}

function getEpisodeText(ep) {
  return String(ep.summary || ep.preview || ep.weaknessScan || ep.practicalTest || '').trim();
}

function ensureEpisodeMeta(ep, at = Date.now()) {
  const episode = { ...ep };
  if (!episode._id) episode._id = generateEpisodeId(episode.at || at);
  if (episode._dreamed !== true) episode._dreamed = false;
  return episode;
}

function generateMemoryLayerId(prefix, at = Date.now()) {
  return `${prefix}_${at}_${crypto.randomBytes(4).toString('hex')}`;
}

function ensureL0TurnMeta(turn, at = Date.now()) {
  const item = { ...turn };
  if (!item._id) item._id = generateMemoryLayerId('l0', item.at || at);
  if (item._summarized !== true) item._summarized = false;
  return item;
}

function ensureL1SummaryMeta(summary, at = Date.now()) {
  const item = { ...summary };
  if (!item._id) item._id = generateMemoryLayerId('l1', item.at || at);
  if (item._dreamed !== true) item._dreamed = false;
  if (item._materialized !== true) item._materialized = false;
  const text = String(item.summary || item.text || '').trim();
  if (text && !item.summary) item.summary = text;
  return item;
}

function markL0Summarized(memoryLayers, l0Ids) {
  if (!Array.isArray(l0Ids) || !l0Ids.length) return;
  const idSet = new Set(l0Ids.map(String));
  const turns = Array.isArray(memoryLayers.l0_turns) ? memoryLayers.l0_turns : [];
  memoryLayers.l0_turns = turns.map((t) => (
    idSet.has(String(t._id)) ? { ...t, _summarized: true, _summarized_at: Date.now() } : t
  ));
}

function l1ToEpisodeShape(l1, source) {
  return ensureEpisodeMeta({
    summary: String(l1.summary || l1.text || l1.title || '').trim(),
    source: l1.source || source || 'l1_summary',
    at: l1.at || Date.now(),
    source_l1_id: l1._id,
    source_l0_ids: Array.isArray(l1.source_l0_ids) ? l1.source_l0_ids : [],
    session_id: l1.session_id || '',
    title: l1.title || '',
    _from_l1: true,
  }, l1.at);
}

function materializePendingL1ToEpisodes(memoryLayers) {
  const l1List = Array.isArray(memoryLayers.l1_summaries) ? memoryLayers.l1_summaries : [];
  const episodes = Array.isArray(memoryLayers.l2_episodes)
    ? memoryLayers.l2_episodes.map((ep) => ensureEpisodeMeta(ep))
    : [];
  let changed = false;

  for (const l1 of l1List) {
    if (!l1 || typeof l1 !== 'object') continue;
    if (l1._dreamed === true || l1._materialized === true) continue;
    if (episodes.some((ep) => ep.source_l1_id === l1._id)) {
      l1._materialized = true;
      changed = true;
      continue;
    }
    const text = String(l1.summary || l1.text || '').trim();
    if (!text) continue;
    episodes.unshift(l1ToEpisodeShape(l1, l1.source || 'l1_summary'));
    l1._materialized = true;
    changed = true;
  }

  if (changed) memoryLayers.l2_episodes = episodes.slice(0, 50);
  return changed;
}

function markL1DreamedForEpisodes(memoryLayers, dreamedEpisodeIds) {
  if (!dreamedEpisodeIds || !dreamedEpisodeIds.size) return;
  const episodes = Array.isArray(memoryLayers.l2_episodes) ? memoryLayers.l2_episodes : [];
  const l1Ids = new Set();
  for (const ep of episodes) {
    if (dreamedEpisodeIds.has(ep._id) && ep.source_l1_id) {
      l1Ids.add(String(ep.source_l1_id));
    }
  }
  if (!l1Ids.size) return;
  const now = Date.now();
  const l1List = Array.isArray(memoryLayers.l1_summaries) ? memoryLayers.l1_summaries : [];
  memoryLayers.l1_summaries = l1List.map((l1) => (
    l1Ids.has(String(l1._id))
      ? { ...l1, _dreamed: true, _dreamed_at: now }
      : l1
  ));
}

function ingestL0Turn(memoryLayers, turnInput, source, now) {
  const turn = ensureL0TurnMeta({ ...turnInput, source, at: turnInput.at || now }, now);
  const turns = Array.isArray(memoryLayers.l0_turns) ? memoryLayers.l0_turns : [];
  turns.unshift(turn);
  memoryLayers.l0_turns = turns.slice(0, L0_TURNS_MAX);
  return turn;
}

function ingestSessionSummary(memoryLayers, summaryInput, source, now, options = {}) {
  const promote = options.promoteToEpisode !== false;
  const s = ensureL1SummaryMeta({ ...summaryInput, source, at: summaryInput.at || now }, now);
  if (Array.isArray(s.source_l0_ids) && s.source_l0_ids.length) {
    markL0Summarized(memoryLayers, s.source_l0_ids);
  }
  const l1List = Array.isArray(memoryLayers.l1_summaries) ? memoryLayers.l1_summaries : [];
  l1List.unshift(s);
  memoryLayers.l1_summaries = l1List.slice(0, L1_SUMMARIES_MAX);

  if (promote) {
    s._materialized = true;
    const episodes = Array.isArray(memoryLayers.l2_episodes)
      ? memoryLayers.l2_episodes.map((ep) => ensureEpisodeMeta(ep))
      : [];
    if (!episodes.some((ep) => ep.source_l1_id === s._id)) {
      episodes.unshift(l1ToEpisodeShape(s, source));
      memoryLayers.l2_episodes = episodes.slice(0, 50);
    }
  }
  return s;
}

function ingestEpisodeRecord(memoryLayers, episodeInput, source, now) {
  const ep = ensureEpisodeMeta({ ...episodeInput, source, at: episodeInput.at || now }, now);
  if (!ep.source_l1_id) {
    const l1 = ensureL1SummaryMeta({
      summary: getEpisodeText(ep),
      title: episodeInput.title || '',
      session_id: episodeInput.session_id || '',
      source_l0_ids: Array.isArray(episodeInput.source_l0_ids) ? episodeInput.source_l0_ids : [],
      source,
      at: ep.at || now,
      _materialized: true,
    }, ep.at || now);
    ep.source_l1_id = l1._id;
    if (Array.isArray(ep.source_l0_ids) && ep.source_l0_ids.length) {
      markL0Summarized(memoryLayers, ep.source_l0_ids);
    }
    const l1List = Array.isArray(memoryLayers.l1_summaries) ? memoryLayers.l1_summaries : [];
    l1List.unshift(l1);
    memoryLayers.l1_summaries = l1List.slice(0, L1_SUMMARIES_MAX);
  }
  const episodes = Array.isArray(memoryLayers.l2_episodes)
    ? memoryLayers.l2_episodes.map((e) => ensureEpisodeMeta(e))
    : [];
  episodes.unshift(ep);
  memoryLayers.l2_episodes = episodes.slice(0, 50);
  return ep;
}

function stripProfileConflicts(profile, conflicts) {
  let result = String(profile || '');
  if (!Array.isArray(conflicts)) return result;
  for (const c of conflicts) {
    const fragment = String(c || '').trim();
    if (!fragment) continue;
    result = result.split(fragment).join('').replace(/;\s*;/g, ';').replace(/^;\s*|;\s*$/g, '').trim();
  }
  return result.replace(/\s{2,}/g, ' ').trim();
}

function parseMemoryDreamingResult(rawText) {
  const empty = {
    profile_delta: '',
    profile_conflicts: [],
    l3_vars_delta: {},
    semantics: [],
    episode_summaries: [],
    dedupe_keys: [],
    entities: [],
    relations: [],
  };
  if (!rawText) return empty;
  try {
    const clean = String(rawText).replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    const l3Delta = parsed.l3_vars_delta && typeof parsed.l3_vars_delta === 'object' && !Array.isArray(parsed.l3_vars_delta)
      ? parsed.l3_vars_delta
      : {};
    return {
      profile_delta: String(parsed.profile_delta || '').trim(),
      profile_conflicts: Array.isArray(parsed.profile_conflicts) ? parsed.profile_conflicts : [],
      l3_vars_delta: l3Delta,
      semantics: Array.isArray(parsed.semantics) ? parsed.semantics : [],
      episode_summaries: Array.isArray(parsed.episode_summaries) ? parsed.episode_summaries : [],
      dedupe_keys: Array.isArray(parsed.dedupe_keys) ? parsed.dedupe_keys : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      relations: Array.isArray(parsed.relations) ? parsed.relations : [],
    };
  } catch (e) {
    console.warn('[Memory Dreaming] JSON parse failed:', e.message);
    return null;
  }
}

function dedupeEpisodes(episodes) {
  const seen = new Set();
  return episodes.filter((ep) => {
    const key = String(ep.summary || ep.preview || ep.weaknessScan || '').trim().slice(0, 80);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectFrequentLedgerPatterns(ledger) {
  const promoted = [];
  for (const [category, items] of Object.entries(ledger)) {
    if (!Array.isArray(items)) continue;
    const counts = {};
    for (const item of items) {
      const key = String(item.pattern || item.flaw || item.word || item.reason || '').trim();
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }
    for (const [pattern, count] of Object.entries(counts)) {
      if (count >= DREAMING_MIN_PATTERN_COUNT) {
        promoted.push({ category, pattern, count });
      }
    }
  }
  return promoted.sort((a, b) => b.count - a.count);
}

function runRuleBasedDreamingForUser(userId) {
  const uid = normalizeMemoryUserId(userId);
  const row = db.prepare('SELECT * FROM user_memories WHERE user_id = ?').get(uid);
  if (!row) return { userId: uid, changed: false, skipped: true };

  const ledger = parseJsonObject(row.error_ledger, {});
  const memoryLayers = parseJsonObject(row.memory_layers, {});
  let profileContent = row.profile_content || '';
  let changed = false;
  const details = { dedupedEpisodes: 0, promotedPatterns: 0, newSemantics: 0 };

  if (Array.isArray(memoryLayers.l2_episodes) && memoryLayers.l2_episodes.length) {
    const before = memoryLayers.l2_episodes.length;
    memoryLayers.l2_episodes = dedupeEpisodes(memoryLayers.l2_episodes).slice(0, 50);
    if (memoryLayers.l2_episodes.length !== before) {
      details.dedupedEpisodes = before - memoryLayers.l2_episodes.length;
      changed = true;
    }
  }

  const promoted = collectFrequentLedgerPatterns(ledger);
  if (promoted.length) {
    const semantics = Array.isArray(memoryLayers.l2_semantics) ? memoryLayers.l2_semantics : [];
    for (const item of promoted.slice(0, 5)) {
      const tag = `${item.category}:${item.pattern}`;
      if (!semantics.some((s) => s.tag === tag)) {
        semantics.unshift({
          tag,
          pattern: item.pattern,
          category: item.category,
          count: item.count,
          source: 'dreaming',
          at: Date.now(),
        });
        details.newSemantics += 1;
        changed = true;
      }
      if (!profileContent.includes(item.pattern)) {
        profileContent = mergeProfileNarrative(profileContent, item.pattern);
        details.promotedPatterns += 1;
        changed = true;
      }
    }
    memoryLayers.l2_semantics = semantics.slice(0, 30);
  }

  if (changed) {
    upsertUserMemoryRow(uid, {
      profileContent,
      errorLedger: row.error_ledger,
      memoryLayers: JSON.stringify(memoryLayers),
      updatedAt: Date.now(),
    });
  }

  return { userId: uid, changed, skipped: false, details, promotedCount: promoted.length };
}

async function runLlmMemoryDreamingForUser(userId, options = {}) {
  if (!isLlmDreamingEnabled()) {
    return { skipped: true, reason: 'llm_disabled' };
  }

  const uid = normalizeMemoryUserId(userId);
  const row = db.prepare('SELECT * FROM user_memories WHERE user_id = ?').get(uid);
  if (!row) return { skipped: true, reason: 'no_user' };

  const memoryLayers = parseJsonObject(row.memory_layers, {});
  const batchSize = Number(process.env.MEMORY_DREAMING_BATCH_SIZE || 5);

  const backoffUntil = Number(memoryLayers._dream_backoff_until || 0);
  if (!options.force && backoffUntil > Date.now()) {
    return { skipped: true, reason: 'backoff', backoffUntil };
  }

  let { episodes, pending, clusterMeta, l1Materialized } = getPendingEpisodesFromLayers(memoryLayers, batchSize);
  if (l1Materialized) persistMemoryLayersOnly(uid, row, memoryLayers);
  if (!pending.length) return { skipped: true, reason: 'no_pending' };

  const memoryCtx = buildMemoryContextForUser(uid);
  const semantics = Array.isArray(memoryLayers.l2_semantics) ? memoryLayers.l2_semantics : [];
  const apiKey = process.env.DIFY_MEMORY_DREAMING_API_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  const timeoutMs = Number(process.env.MEMORY_DREAMING_TIMEOUT_MS || 90000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const applyBackoff = () => {
    memoryLayers._dream_backoff_until = Date.now() + getDreamBackoffMs();
    persistMemoryLayersOnly(uid, row, memoryLayers);
    return memoryLayers._dream_backoff_until;
  };

  try {
    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          current_profile: row.profile_content || '',
          pending_episodes_json: JSON.stringify(pending),
          error_ledger_summary: memoryCtx.errorLedgerSummary,
          recent_semantics_json: JSON.stringify(semantics.slice(0, 10)),
          recent_graph_json: JSON.stringify(memoryLayers.l2_graph || { entities: [], relations: [] }),
          batch_label: clusterMeta?.label || '',
          current_l3_vars_json: JSON.stringify(getL3VarsObject(memoryLayers)),
        },
        response_mode: 'blocking',
        user: uid,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Memory Dreaming] Dify HTTP ${response.status}:`, errText.slice(0, 500));
      if (DREAM_BACKOFF_HTTP_STATUSES.has(response.status)) {
        const until = applyBackoff();
        return { skipped: true, reason: 'dify_http_error', status: response.status, backoffUntil: until };
      }
      return { skipped: true, reason: 'dify_http_error', status: response.status };
    }

    const data = await response.json();
    const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? '';
    const parsed = parseMemoryDreamingResult(rawResult);
    if (!parsed) return { skipped: true, reason: 'parse_failed' };

    let profileContent = stripProfileConflicts(row.profile_content || '', parsed.profile_conflicts);
    if (parsed.profile_delta) {
      profileContent = mergeProfileNarrative(profileContent, parsed.profile_delta);
    }

    const profileConflicts = Array.isArray(parsed.profile_conflicts) ? [...parsed.profile_conflicts] : [];
    applyL3VarsToMemoryLayers(memoryLayers, parsed.l3_vars_delta, profileConflicts);
    applyL3VarsToMemoryLayers(memoryLayers, inferL3VarsDeltaFromText(parsed.profile_delta), profileConflicts);
    if (profileConflicts.length > parsed.profile_conflicts.length) {
      parsed.profile_conflicts = profileConflicts;
    }

    const summaryById = new Map();
    for (const item of parsed.episode_summaries) {
      if (item && item.id) summaryById.set(String(item.id), item);
    }

    const pendingIds = new Set(pending.map((ep) => ep._id));
    episodes = episodes.map((ep) => {
      if (!pendingIds.has(ep._id)) return ep;
      const update = summaryById.get(String(ep._id));
      if (update?.discard === true) {
        return { ...ep, _dreamed: true, _discarded: true, _dreamed_at: Date.now() };
      }
      const merged = String(update?.merged_summary || '').trim();
      return {
        ...ep,
        summary: merged || getEpisodeText(ep),
        _dreamed: true,
        _dreamed_at: Date.now(),
      };
    });

    episodes = episodes.filter((ep) => !ep._discarded);

    markL1DreamedForEpisodes(memoryLayers, pendingIds);

    if (parsed.dedupe_keys.length) {
      const keys = parsed.dedupe_keys.map((k) => String(k).trim().slice(0, 80)).filter(Boolean);
      const seen = new Set();
      episodes = episodes.filter((ep) => {
        const text = getEpisodeText(ep).slice(0, 80);
        const matchKey = keys.find((k) => text.includes(k) || k.includes(text));
        if (!matchKey) return true;
        if (seen.has(matchKey)) return false;
        seen.add(matchKey);
        return true;
      });
    }

    let mergedSemantics = Array.isArray(memoryLayers.l2_semantics) ? [...memoryLayers.l2_semantics] : [];
    for (const sem of parsed.semantics.slice(0, 10)) {
      if (!sem || typeof sem !== 'object') continue;
      const tag = String(sem.tag || `${sem.category || 'general'}:${sem.pattern || ''}`).trim();
      if (!tag || tag === ':' || tag === 'general:') continue;
      if (!mergedSemantics.some((s) => s.tag === tag)) {
        mergedSemantics.unshift({
          tag,
          pattern: String(sem.pattern || '').trim(),
          category: String(sem.category || 'general').trim(),
          evidence: String(sem.evidence || '').trim().slice(0, 200),
          source: 'llm_dreaming',
          at: Date.now(),
        });
      }
    }

    memoryLayers.l2_episodes = episodes.slice(0, 50);
    memoryLayers.l2_semantics = mergedSemantics.slice(0, 30);
    let graphPayload = { entities: parsed.entities, relations: parsed.relations };
    let graphSource = 'llm_dreaming';
    if (!graphPayload.relations.length && parsed.semantics.length) {
      graphPayload = graphFromSemantics(parsed.semantics);
      graphSource = 'graph_from_semantics';
    }
    if (!graphPayload.relations.length) {
      const fallback = fallbackGraphFromMemory(pending, profileContent, parsed.profile_delta);
      if (fallback.relations.length) {
        graphPayload = fallback;
        graphSource = 'graph_fallback';
      }
    }
    const graphMerge = mergeGraphMemory(memoryLayers.l2_graph, graphPayload, graphSource);
    memoryLayers.l2_graph = graphMerge.graph;
    memoryLayers._last_llm_dream_at = Date.now();
    memoryLayers._dream_backoff_until = 0;

    const kbResult = await syncDreamedEpisodesToKb(uid, memoryLayers.l2_episodes, profileContent);

    upsertUserMemoryRow(uid, {
      profileContent,
      errorLedger: row.error_ledger,
      memoryLayers: JSON.stringify(memoryLayers),
      updatedAt: Date.now(),
    });

    return {
      skipped: false,
      changed: true,
      dreamedCount: pending.length,
      newSemantics: parsed.semantics.length,
      profileUpdated: Boolean(parsed.profile_delta || parsed.profile_conflicts.length || Object.keys(parsed.l3_vars_delta || {}).length),
      l3_vars: getL3VarsObject(memoryLayers),
      kb: kbResult,
      cluster: clusterMeta,
      graph: {
        newEntities: graphMerge.newEntities,
        newRelations: graphMerge.newRelations,
        totalRelations: graphMerge.graph.relations.length,
        source: graphSource,
      },
    };
  } catch (e) {
    if (e.name === 'AbortError') {
      const until = applyBackoff();
      return { skipped: true, reason: 'timeout', backoffUntil: until };
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function runMemoryDreamingForUser(userId, options = {}) {
  const uid = normalizeMemoryUserId(userId);
  const ruleResult = runRuleBasedDreamingForUser(uid);
  let llmResult = { skipped: true, reason: 'not_attempted' };

  const row = db.prepare('SELECT * FROM user_memories WHERE user_id = ?').get(uid);
  const layers = parseJsonObject(row?.memory_layers, {});

  if (row) {
    layers._last_dream_scan_at = Date.now();
    persistMemoryLayersOnly(uid, row, layers);
  }

  if (row && shouldRunLlmDreaming(layers, options)) {
    try {
      llmResult = await runLlmMemoryDreamingForUser(uid, { force: options.force === true });
    } catch (e) {
      console.warn('[Memory Dreaming] LLM layer failed:', e.message);
      llmResult = { skipped: true, reason: 'llm_error', error: e.message };
    }
  } else if (options.incrementalOnly) {
    const hasPending = (layers.l2_episodes || []).some((ep) => ensureEpisodeMeta(ep)._dreamed !== true);
    if (!hasPending) {
      llmResult = { skipped: true, reason: 'no_pending_incremental' };
    } else if (Number(layers._dream_backoff_until || 0) > Date.now()) {
      llmResult = { skipped: true, reason: 'backoff', backoffUntil: layers._dream_backoff_until };
    }
  } else if (row && !(layers.l2_episodes || []).some((ep) => ensureEpisodeMeta(ep)._dreamed !== true)) {
    llmResult = { skipped: true, reason: 'no_pending' };
  }

  return {
    userId: ruleResult.userId || uid,
    changed: ruleResult.changed || llmResult.changed === true,
    skipped: ruleResult.skipped && llmResult.skipped,
    rule: ruleResult,
    llm: llmResult,
  };
}

async function runMemoryDreamingJob() {
  const users = db.prepare('SELECT user_id FROM user_memories').all();
  let processed = 0;
  let updated = 0;
  let skippedLlm = 0;
  for (const { user_id } of users) {
    const result = await runMemoryDreamingForUser(user_id, { incrementalOnly: true });
    processed += 1;
    if (result.changed) updated += 1;
    if (result.llm?.skipped && ['no_pending_incremental', 'backoff', 'no_pending'].includes(result.llm.reason)) {
      skippedLlm += 1;
    }
  }
  console.log(`[Memory Dreaming] processed=${processed} updated=${updated} skipped_llm=${skippedLlm}`);
  return { processed, updated, skippedLlm, at: Date.now() };
}

// ?????????????????
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_gen_history_theme 
  ON generation_history(user_id, theme, generated_at)
`).run();

// ==========================================
// SM-2 ??????????????
// ==========================================
function calculateNextReview(quality, repetitions, easeFactor, interval) {
  // ????????????
  if (!easeFactor) easeFactor = 2.5;
  if (!interval) interval = 1;

  // ???? >= 3 ???????????
  if (quality >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);

    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  // ???????????????????ease factor??
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.02 + (5 - quality) * 0.008));
  if (easeFactor < 1.3) easeFactor = 1.3; // 涓嬮檺

  return { repetitions, easeFactor, interval };
}

const DEFAULT_IMAGE_GEN_MODELS = [
  'agnes-image-2.1-flash',
  'agnes-image-2.0-flash'
];

function extractGeneratedImageUrl(responseData) {
  const firstImage = Array.isArray(responseData?.data) ? responseData.data[0] : null;
  let imageUrl = '';
  let downloadUrl = '';
  let revisedPrompt = '';

  if (firstImage?.url) {
    imageUrl = firstImage.url;
    downloadUrl = firstImage.url;
    revisedPrompt = firstImage.revised_prompt || '';
  } else if (firstImage?.b64_json) {
    imageUrl = `data:image/png;base64,${firstImage.b64_json}`;
    downloadUrl = imageUrl;
    revisedPrompt = firstImage.revised_prompt || '';
  } else if (responseData?.url) {
    imageUrl = responseData.url;
    downloadUrl = responseData.url;
  } else if (responseData?.image_url) {
    imageUrl = responseData.image_url;
    downloadUrl = responseData.download_url || responseData.image_url;
  } else if (responseData?.preview) {
    imageUrl = responseData.preview;
    downloadUrl = responseData.download_url || responseData.preview;
  }

  if (!imageUrl) {
    const responseText = typeof responseData === 'string' ? responseData : JSON.stringify(responseData || '');
    const urlMatches = [...responseText.matchAll(/(https?:\/\/[^\s"'`<>\{\}\[\]]+\.(jpg|jpeg|png|webp))/gi)];
    if (urlMatches.length > 0) {
      imageUrl = urlMatches[0][1];
      downloadUrl = urlMatches.length > 1 ? urlMatches[1][1] : imageUrl;
    }
  }

  return { imageUrl, downloadUrl: downloadUrl || imageUrl, revisedPrompt };
}

function buildImageGenerationPayload(model, prompt) {
  if (model === 'agnes-image-2.1-flash' || model === 'agnes-image-2.0-flash') {
    return {
      model,
      prompt,
      size: '1024x768',
      extra_body: {
        response_format: 'url',
      },
    };
  }

  if (model === 'nb/nanobanana-flash' || model === 'nb/nanobanana-pro') {
    return {
      model,
      prompt,
      n: 1,
      size: 'auto',
      quality: 'auto',
      background: 'auto',
      image_detail: 'high',
      output_format: 'png',
    };
  }

  if (model === 'stability/stable-image-ultra') {
    return {
      model,
      prompt,
      output_format: 'png',
      aspect_ratio: '1:1',
    };
  }

  if (model === 'runway/gen4_image') {
    return {
      model,
      prompt,
      promptText: prompt,
      ratio: '1024:1024',
      referenceImages: [],
    };
  }

  return {
    model,
    prompt,
    size: '1024x768',
    extra_body: {
      response_format: 'url',
    },
  };
}

async function tryGenerateImageOnce(baseUrl, apiKey, model, prompt) {
  const requestUrl = `${String(baseUrl || '').replace(/\/$/, '')}/images/generations`;
  const payload = buildImageGenerationPayload(model, prompt);

  let parsedUrl;
  try {
    parsedUrl = new URL(requestUrl);
  } catch (err) {
    return { ok: false, error: `鏃犳晥鐨勮姹傚湴鍧€: ${requestUrl}` };
  }

  const isHttps = parsedUrl.protocol === 'https:';
  const transport = isHttps ? require('https') : require('http');
  const isIpHost = /^\d{1,3}(\.\d{1,3}){3}$/.test(parsedUrl.hostname);
  const insecureTls = process.env.IMAGE_GEN_INSECURE_TLS === '1'
    || process.env.IMAGE_GEN_INSECURE_TLS === 'true'
    || isIpHost;

  const reqOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'POST',
    family: 4,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    ...(isHttps && insecureTls ? { rejectUnauthorized: false } : {}),
  };

  return new Promise((resolve) => {
    const req = transport.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawText = Buffer.concat(chunks).toString('utf8');
        let responseData = {};
        try {
          responseData = rawText ? JSON.parse(rawText) : {};
        } catch (error) {
          resolve({
            ok: false,
            error: `鐢熷浘鏈嶅姟杩斿洖鏁版嵁瑙ｆ瀽澶辫触 (HTTP ${res.statusCode}): ${rawText.substring(0, 200) || '鏃犳硶瑙ｆ瀽鐨勫搷搴斿唴瀹?}`
          });
          return;
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          const errMsg = responseData?.error?.message || responseData?.error || responseData?.message || JSON.stringify(responseData).substring(0, 200);
          resolve({ ok: false, error: `鐢熷浘鏈嶅姟杩斿洖閿欒鐘舵€佺爜 (${res.statusCode}): ${errMsg}` });
          return;
        }

        const { imageUrl, downloadUrl, revisedPrompt } = extractGeneratedImageUrl(responseData);
        if (!imageUrl) {
          resolve({
            ok: false,
            error: `鐢熷浘鎴愬姛浣嗘湭鎵惧埌鍥剧墖鍦板潃鎴?Base64 鏁版嵁: ${JSON.stringify(responseData).substring(0, 200)}`
          });
          return;
        }

        resolve({ ok: true, imageUrl, downloadUrl, revisedPrompt });
      });
    });

    req.on('error', (error) => {
      resolve({ ok: false, error: `鐢熷浘鏈嶅姟杩炴帴澶辫触 (${model} @ ${baseUrl}): ${error.message || error}` });
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

// ==========================================
// ?????????????????????????????????????????
// ==========================================

/** 鍚堝苟 Dify SSE 娴佸紡 answer锛氬吋瀹瑰閲?delta 涓庡叏閲?cumulative 涓ょ妯″紡 */
const {
  mergeStreamAnswer,
  estimateEnglishWordCount,
  softWordLimitForDuration,
  isOverSoftWordLimit,
} = require('./services/difyStreamMerge');

/** 灏?Dify / 涓嬫父妯″瀷閿欒杞负鍙搷浣滅殑鎻愮ず锛坉aily-extract銆乧ompletion 绛夊叡鐢級 */
function formatDifyModelError(raw) {
  const text = String(raw || '').trim();
  if (!text) return 'Dify 妯″瀷璋冪敤澶辫触锛屾湭杩斿洖閿欒璇︽儏';
  if (/Server Unavailable|ConnectTimeout|23\.95\.214\.232|38000|Max retries exceeded/i.test(text)) {
    return [
      'Dify 涓嬫父 LLM 鎺ㄧ悊鏈嶅姟涓嶅彲鐢紙23.95.214.232:38000 杩炴帴瓒呮椂锛夈€?,
      '闀挎枃鐢熸垚搴旂敤锛歮aterail_generate_url_enhanced',
      '閴存潈鐜鍙橀噺锛欴IFY_ENGLISH_MASTERY_KEY锛堥粯璁?app-OShKY1EcVuLFkuxrpO28ZB0A锛?,
      '璇峰湪 Dify 鈫?璁剧疆 鈫?妯″瀷渚涘簲鍟?鈫?OpenAI-API-compatible 妫€鏌?Base URL锛屾垨閲嶅惎 38000 绔彛鎺ㄧ悊鏈嶅姟銆?,
    ].join(' ');
  }
  if (/^\[models\]/i.test(text)) return `Dify 妯″瀷璋冪敤澶辫触: ${text}`;
  return text;
}

/** 娓呮礂鍚姏闀挎枃绋匡細鍘绘帀 Dify 妯℃澘澶翠笌璇嶆眹 JSON 娈碉紝浠呬繚鐣欏彲鏈楄姝ｆ枃 */
function sanitizeListenMaterialScript(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let script = raw.trim();
  script = script.replace(/^馃摑[^\n]*\n+/m, '');
  script = script.replace(/^[^\n]*(鐢熸垚瀹屾瘯|娌夋蹈寮忓惉鍔泑闃呰闀跨瘒鏉愭枡)[^\n]*\n+/m, '');
  script = script.split(/---VOCAB_JSON_START---/i)[0].trim();
  return script;
}

/** 浠?Dify chat-messages SSE 娴佷腑鏀堕泦瀹屾暣 answer锛泂anitize=false 鏃朵繚鐣?VOCAB_JSON 娈?*/
async function collectDifyStreamingAnswer(wfResponse, { sanitize = true, idleTimeoutMs } = {}) {
  const { readWithIdleTimeout } = require('./services/streamIdleTimeout');
  const idleMs = Number(
    idleTimeoutMs
      || process.env.DIFY_STREAM_IDLE_TIMEOUT_MS
      || 120000,
  );
  let finalAnswer = '';
  const decoder = new TextDecoder();
  let buffer = '';

  const processLine = (line) => {
    if (!line.startsWith('data: ')) return;
    const dataStr = line.slice(6).trim();
    if (dataStr === '[DONE]') return;
    try {
      const parsed = JSON.parse(dataStr);
      const event = parsed.event;
      if (typeof parsed.answer === 'string' && parsed.answer) {
        finalAnswer = mergeStreamAnswer(finalAnswer, parsed.answer);
      }
      if ((event === 'message' || event === 'agent_message') && parsed.answer) {
        finalAnswer = mergeStreamAnswer(finalAnswer, parsed.answer);
      }
      if (event === 'message_end' && parsed.data?.outputs?.answer) {
        finalAnswer = mergeStreamAnswer(finalAnswer, parsed.data.outputs.answer);
      }
      if (event === 'workflow_finished' && parsed.data?.outputs) {
        const out = parsed.data.outputs;
        const finished = out.answer ?? out.result ?? out.text ?? out.content ?? out.listening_material_preview;
        if (typeof finished === 'string' && finished.trim()) {
          finalAnswer = mergeStreamAnswer(finalAnswer, finished);
        }
      }
      if (event === 'text_chunk' && parsed.data?.text) {
        finalAnswer = mergeStreamAnswer(finalAnswer, parsed.data.text);
      }
      if (!finalAnswer && parsed.data?.outputs) {
        for (const key of Object.keys(parsed.data.outputs)) {
          const val = parsed.data.outputs[key];
          if (typeof val === 'string' && val.trim()) {
            finalAnswer = mergeStreamAnswer(finalAnswer, val);
            break;
          }
        }
      }
    } catch (_) {}
  };

  const parseChunk = (text) => {
    buffer += text;
    let lineEnd = buffer.indexOf('\n');
    while (lineEnd !== -1) {
      processLine(buffer.substring(0, lineEnd).trim());
      buffer = buffer.substring(lineEnd + 1);
      lineEnd = buffer.indexOf('\n');
    }
  };

  if (!wfResponse.body) {
    const trimmed = finalAnswer.trim();
    return sanitize ? sanitizeListenMaterialScript(trimmed) : trimmed;
  }

  async function* bodyChunks() {
    if (typeof wfResponse.body.getReader === 'function') {
      const reader = wfResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } else {
      for await (const chunk of wfResponse.body) {
        yield chunk;
      }
    }
  }

  for await (const value of readWithIdleTimeout(bodyChunks(), { idleTimeoutMs: idleMs })) {
    parseChunk(decoder.decode(value, { stream: true }));
  }

  const trimmed = finalAnswer.trim();
  return sanitize ? sanitizeListenMaterialScript(trimmed) : trimmed;
}

/** 鍚屾 await Dify 闀挎枃娴佸紡鐢熸垚锛岃繑鍥炲師濮?answer锛堝彲鍚?VOCAB_JSON锛夛紱涓嶈蛋 taskQueue */
async function generateListenLongScriptSync(inputs, userId = 'default-user') {
  const apiKey = process.env.DIFY_LONG_AUDIO_API_KEY
    || process.env.VITE_DIFY_LONG_AUDIO_API_KEY
    || process.env.DIFY_LISTEN_GEN_API_KEY
    || 'app-vBQMyqeHD16U0XxzUt9DdJYI';
  if (!apiKey) {
    throw new Error('缂哄皯鍏抽敭閴存潈鍙傛暟 (API KEY)');
  }

  const baseUrl = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  const duration = String((inputs && inputs.duration) || '1');
  const maxAttempts = 2; // 瓒呰蒋涓婇檺鏃堕噸璇?1 娆★紱浠嶈秴鍒?D1锛氳惤搴撳彲鐢?+ warning
  let lastAnswer = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 30 * 60 * 1000);
    const query = attempt === 1
      ? 'generate'
      : `generate again: keep duration=${duration} minutes, much shorter, target under ${softWordLimitForDuration(duration)} English words`;

    let wfResponse;
    try {
      wfResponse = await fetch(`${baseUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: fetchController.signal,
        body: JSON.stringify({
          inputs: injectOralSystemTime(inputs || {}),
          query,
          response_mode: 'streaming',
          user: userId,
        }),
      });
    } finally {
      clearTimeout(fetchTimeout);
    }

    if (!wfResponse.ok) {
      const errText = await wfResponse.text().catch(() => '');
      let errMsg = errText || `Dify HTTP ${wfResponse.status}`;
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed.message || parsed.error || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }

    const answer = await collectDifyStreamingAnswer(wfResponse, { sanitize: false });
    if (!answer) {
      throw new Error('鎺ユ敹鎴愬姛浣嗙瓟妗堜负绌?);
    }
    lastAnswer = answer;

    const bodyOnly = answer.split(/---VOCAB_JSON_START---/i)[0];
    const words = estimateEnglishWordCount(bodyOnly);
    const limit = softWordLimitForDuration(duration);
    if (!isOverSoftWordLimit(bodyOnly, duration)) {
      if (attempt > 1) {
        console.warn(
          `[DailyListen] length retry ok duration=${duration}m words=${words} limit=${limit} attempt=${attempt}`,
        );
      }
      return answer;
    }

    console.warn(
      `[DailyListen] over soft word limit duration=${duration}m words=${words} limit=${limit} attempt=${attempt}/${maxAttempts} (D1: keep if final)`,
    );
  }

  return lastAnswer;
}

app.post('/api/listen/generate-material', async (req, res) => {
  try {
    const { inputs, userId = 'default-user' } = req.body;
    const apiKey = process.env.DIFY_LISTEN_GEN_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: '鍚庣鏈厤缃?DIFY_LISTEN_GEN_API_KEY' });
    }
    const difyUrl = `${process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1'}/completion-messages`;
    
    const response = await fetch(difyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: inputs || {},
        response_mode: 'blocking',
        user: userId,
      })
    });
    
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errMsg = formatDifyModelError(data.message || data.error || 'Dify API Error');
      return res.status(response.status).json({ success: false, error: errMsg });
    }
    
    if (!data.answer) {
      return res.status(500).json({ success: false, error: 'Dify 鏈繑鍥炲惉鍔涙潗鏂欐鏂囷紝璇锋鏌?listen_material_generator 搴旂敤閰嶇疆' });
    }
    
    res.json({ success: true, answer: data.answer });
  } catch (error) {
    console.error('generate-material error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ???????????????5 ????????????? SSE ???????????????????? Dify ??? HTTP/2 ???????????
app.post('/api/listen/generate-material-long', async (req, res) => {
  try {
    const { inputs, userId = 'default-user' } = req.body;
    const apiKey = process.env.DIFY_LONG_AUDIO_API_KEY
      || process.env.VITE_DIFY_LONG_AUDIO_API_KEY
      || process.env.DIFY_LISTEN_GEN_API_KEY
      || 'app-vBQMyqeHD16U0XxzUt9DdJYI';
    if (!apiKey) {
      return res.status(500).json({ success: false, error: '缂哄皯鍏抽敭閴存潈鍙傛暟 (API KEY)' });
    }

    // 寮曞叆浠诲姟闃熷垪锛屽垱寤轰换鍔?    const taskQueue = require('./services/taskQueue');
    const taskTitle = inputs.theme ? `鎾鏂囩: ${inputs.theme}` : '娣卞害鎾鐢熸垚';
    const task = taskQueue.createTask('material', taskTitle);

    // 绔嬪嵆鍝嶅簲缁欏墠绔?taskId锛岀敱鍓嶇浣跨敤鍏ㄥ眬鐨?TaskContext 鎺ョ杞
    res.json({ success: true, taskId: task.id, status: task.status });

    // ========= 浠ヤ笅杩涘叆寮傛鍚庡彴鎵ц锛屼笉浼氶樆濉炲鎴风杩炴帴 =========
    (async () => {
      try {
        taskQueue.updateTask(task.id, { progress: 10, logs: ['姝ｅ湪杩炴帴鏅哄簱骞跺垵濮嬪寲鎺ㄦ紨妯″瀷 (Dify API)...'] });
        taskQueue.updateTask(task.id, { progress: 30, logs: ['鎴愬姛杩炴帴锛屾ā鍨嬫鍦ㄦ祦寮忎笅鍙戝墽鏈暟鎹?..'] });

        const rawAnswer = await generateListenLongScriptSync(inputs, userId);
        const answer = sanitizeListenMaterialScript(rawAnswer);
        if (!answer) {
          taskQueue.updateTask(task.id, { status: 'failed', error: '鎺ユ敹鎴愬姛浣嗙瓟妗堜负绌? });
          return;
        }
        if (answer.length < 500) {
          console.warn(`[generate-material-long] suspiciously short script (${answer.length} chars) for task ${task.id}`);
        }

        // 淇濆瓨鐢熸垚鐨勬枃绋垮唴瀹圭粰鍓嶇鎻愬彇 (淇濆瓨鍦?task.result.content)
        taskQueue.updateTask(task.id, { 
          progress: 100, 
          logs: [`闀块煶棰戝墽鏈敓鎴愬渾婊″畬鎴愶紒锛?{answer.length} 瀛楃锛塦], 
          status: 'completed', 
          result: { content: answer } 
        });

      } catch (error) {
        console.error('generate-material-long background task error:', error);
        const msg = error.name === 'AbortError'
          ? '鍚庡彴浠诲姟鍥犺秴鏃惰涓 (30鍒嗛挓鎷︽埅鏈哄埗)'
          : error.message;
        taskQueue.updateTask(task.id, { status: 'failed', error: `鍚庡彴鐢熸垚寮傚父: ${msg}` });
      }
    })();

  } catch (error) {
    console.error('generate-material-long request handler error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ???????? API
// ==========================================

const longAudiosConfig = require('./config/longAudios.json');

// ?????????????????
app.get('/api/listen/long-audio/list', (req, res) => {
  try {
    const list = longAudiosConfig.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      duration: item.duration,
      genre: item.genre,
      cefrLevel: item.cefrLevel,
      segmentCount: item.segments.length
    }));
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ?????????????????????????????
app.get('/api/listen/long-audio/:id', (req, res) => {
  try {
    const { id } = req.params;
    const audio = longAudiosConfig.find(item => item.id === id);
    if (!audio) {
      return res.status(404).json({ success: false, error: 'Audio not found' });
    }
    res.json({ success: true, data: audio });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/listen/pregenerated', (req, res) => {
  try {
    const { userId, theme, genre, cefrLevel, cefr, duration, date } = req.query;
    if (!userId || !theme || !genre || !(cefrLevel || cefr) || !duration) {
      return res.status(400).json({ success: false, error: 'userId, theme, genre, cefrLevel, duration required' });
    }
    const historyExclude = String(req.query.historyExclude ?? dailyPackService.getHistoryExclude(db) ?? '').trim();
    const userFlaws = String(req.query.userFlaws || '').trim();
    const userCurrentProfile = String(
      req.query.userCurrentProfile ?? dailyPackService.getUserCurrentProfile(db, userId) ?? '',
    ).trim();
    const result = dailyListenPreGenerateService.getPregeneratedCombo(db, {
      userId,
      theme,
      genre,
      cefrLevel: cefrLevel || cefr,
      duration: Number(duration),
      date,
      historyExclude,
      userFlaws,
      userCurrentProfile,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/listen/pregenerated/backfill', async (req, res) => {
  try {
    const { userId, theme, genre, cefrLevel, duration, only } = req.body || {};
    if (!userId || !theme || !genre || !cefrLevel || !duration) {
      return res.status(400).json({ success: false, error: 'missing fields' });
    }
    if (!dailyListenPreGenerateService.isCacheableDuration(duration)) {
      return res.status(400).json({ success: false, error: 'duration not cacheable; use realtime generate' });
    }
    const taskQueue = require('./services/taskQueue');
    const task = taskQueue.createTask(
      'listen_backfill',
      `鍚啓棰勭敓鎴愯ˉ璺? ${theme} / ${genre} / ${cefrLevel} / ${duration}m`,
    );
    res.json({ success: true, taskId: task.id, status: task.status });

    (async () => {
      try {
        taskQueue.updateTask(task.id, { status: 'running', progress: 5, logs: ['寮€濮嬪悗鍙拌ˉ鐢熸垚...'] });
        const mode = only === 'audio' || only === 'article' ? only : 'both';
        const result = await dailyListenPreGenerateService.generateOneCombo(
          db,
          { userId, theme, genre, cefrLevel, duration },
          { source: 'backfill', only: mode },
        );
        taskQueue.updateTask(task.id, {
          status: 'completed',
          progress: 100,
          logs: ['琛ョ敓鎴愬畬鎴?],
          result: {
            status: result.status,
            genre,
            cefrLevel,
            duration,
            articleReady: result.articleStatus === 'ready',
            audioReady: result.audioStatus === 'ready',
            audioUrl: result.audio?.audioUrl,
            content: result.article?.body,
          },
        });
      } catch (e) {
        taskQueue.updateTask(task.id, { status: 'failed', error: e.message });
      }
    })();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** C3: 浠呰ˉ璇嶈〃锛屼笉閲嶈窇鏂囩珷/TTS */
app.post('/api/listen/pregenerated/backfill-vocab', async (req, res) => {
  try {
    const { userId, theme, genre, cefrLevel, duration, force } = req.body || {};
    if (!userId || !theme || !genre || !cefrLevel || !duration) {
      return res.status(400).json({ success: false, error: 'missing fields' });
    }
    const result = await dailyListenPreGenerateService.backfillVocabForCombo(db, {
      userId,
      theme,
      genre,
      cefrLevel,
      duration,
      force: force === true,
    });
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/listen/pregenerated/writeback', (req, res) => {
  try {
    const {
      userId, theme, genre, cefrLevel, duration, date,
      body, vocab, phrases, audioUrl, audioPath, script,
    } = req.body || {};
    if (!userId || !theme || !genre || !cefrLevel || !duration) {
      return res.status(400).json({ success: false, error: 'missing fields' });
    }
    const result = dailyListenPreGenerateService.writebackCombo(
      db,
      { userId, theme, genre, cefrLevel, duration, date },
      { body, vocab, phrases, audioPath, audioUrl, script },
    );
    if (result.success === false) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/listen/pregenerated/cron-run', async (req, res) => {
  try {
    const secret = process.env.DAILY_PACK_CRON_SECRET || '';
    if (secret && req.headers['x-cron-secret'] !== secret) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }
    const result = await dailyListenPreGenerateService.runDailyListenCronJob(db);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Daily Listen Cron Manual]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// User profile & long-term memory API
// ==========================================

app.get('/api/user/profile/:userId', (req, res) => {
  try {
    const uid = normalizeMemoryUserId(req.params.userId);
    const row = db.prepare('SELECT * FROM user_memories WHERE user_id = ?').get(uid);
    const memoryCtx = buildMemoryContextForUser(uid);
    res.json({
      success: true,
      data: row
        ? {
            ...row,
            memory_layers: parseJsonObject(row.memory_layers, {}),
            error_ledger: parseJsonObject(row.error_ledger, {}),
            recent_episodes_summary: memoryCtx.recentEpisodesSummary,
            error_ledger_summary: memoryCtx.errorLedgerSummary,
            graph_summary: memoryCtx.graphSummary,
          }
        : {
            user_id: uid,
            profile_content: '',
            error_ledger: {},
            memory_layers: {},
            recent_episodes_summary: memoryCtx.recentEpisodesSummary,
            error_ledger_summary: memoryCtx.errorLedgerSummary,
            graph_summary: memoryCtx.graphSummary,
            updated_at: 0,
          },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/user/memory/context/:userId', (req, res) => {
  try {
    const uid = normalizeMemoryUserId(req.params.userId);
    const ctx = buildMemoryContextForUser(uid);
    res.json({ success: true, data: ctx });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/user/memory/recall', (req, res) => {
  try {
    const userId = req.query.userId || req.query.user_id;
    const query = req.query.query || req.query.q || '';
    const topK = req.query.topK || req.query.top_k || 5;
    if (!userId) {
      return res.status(400).json({ success: false, error: '缂哄皯 userId銆? });
    }
    if (!String(query).trim()) {
      return res.status(400).json({ success: false, error: '缂哄皯 query銆? });
    }
    const data = recallMemoryForUser(userId, query, topK);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/user/memory/pack-for-llm', (req, res) => {
  try {
    const userId = req.query.userId || req.query.user_id;
    const query = req.query.query || req.query.q || '';
    const format = String(req.query.format || 'json').trim().toLowerCase();
    if (!userId) {
      return res.status(400).json({ success: false, error: '缂哄皯 userId銆? });
    }
    const text = buildMemoryPackForLlm(userId, query);
    if (format === 'text') {
      return res.type('text/plain; charset=utf-8').send(text || '锛堟湰杞湭妫€绱㈠埌缁撴瀯鍖栬蹇嗐€傦級');
    }
    res.json({ success: true, data: { text: text || '锛堟湰杞湭妫€绱㈠埌缁撴瀯鍖栬蹇嗐€傦級' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/memory/dreaming/run', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (userId) {
      const result = await runMemoryDreamingForUser(userId, { force: true });
      return res.json({ success: true, data: result });
    }
    const result = await runMemoryDreamingJob();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/profile/save', (req, res) => {
  const { userId, profileContent, errorLedger } = req.body;
  const uid = normalizeMemoryUserId(userId);
  const now = Date.now();
  try {
    const existing = db.prepare('SELECT profile_content, error_ledger, memory_layers FROM user_memories WHERE user_id = ?').get(uid);
    upsertUserMemoryRow(uid, {
      profileContent: profileContent ?? existing?.profile_content ?? '',
      errorLedger: errorLedger || existing?.error_ledger || '{}',
      memoryLayers: existing?.memory_layers || '{}',
      updatedAt: now,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/profile/compress', async (req, res) => {
  const { userId, profileContent, save = true } = req.body || {};
  const uid = normalizeMemoryUserId(userId);
  const now = Date.now();

  try {
    const row = db.prepare('SELECT * FROM user_memories WHERE user_id = ?').get(uid);
    const input = String(profileContent ?? row?.profile_content ?? '').trim();
    if (!input) {
      return res.status(400).json({ success: false, error: '鐢诲儚鍐呭涓虹┖锛屾棤娉曞帇缂┿€? });
    }

    const beforeLen = input.length;
    const compressed = await compressProfileContent(input, uid);
    const mergedProfile = String(compressed.mergedProfile || '').trim();
    if (!mergedProfile) {
      return res.status(500).json({ success: false, error: '鍘嬬缉缁撴灉涓虹┖锛岃绋嶅悗閲嶈瘯銆? });
    }

    if (save) {
      upsertUserMemoryRow(uid, {
        profileContent: mergedProfile,
        errorLedger: row?.error_ledger || '{}',
        memoryLayers: row?.memory_layers || '{}',
        updatedAt: now,
      });
    }

    res.json({
      success: true,
      data: {
        user_id: uid,
        profile_content: mergedProfile,
        dedupe_count: compressed.dedupeCount || 0,
        source: compressed.source || 'unknown',
        before_length: beforeLen,
        after_length: mergedProfile.length,
        updated_at: now,
      },
    });
  } catch (err) {
    console.error('[Profile Compress] error:', err);
    res.status(500).json({ success: false, error: err.message || '鐢诲儚鍘嬬缉澶辫触' });
  }
});

app.post('/api/user/memory/ingest', async (req, res) => {
  const {
    userId,
    profileDelta,
    source = 'unknown',
    episode,
    semantic,
    turn,
    sessionSummary,
    l1,
    promoteToEpisode,
    l3VarsDelta,
    l3_vars_delta,
  } = req.body || {};
  const uid = normalizeMemoryUserId(userId);
  const now = Date.now();

  try {
    const row = db.prepare('SELECT * FROM user_memories WHERE user_id = ?').get(uid);
    let profileContent = row?.profile_content || '';
    let memoryLayers = parseJsonObject(row?.memory_layers, {});

    if (profileDelta) {
      profileContent = await mergeProfileWithDedupe(profileContent, profileDelta, uid, { source, at: now });
      applyL3VarsToMemoryLayers(memoryLayers, inferL3VarsDeltaFromText(profileDelta));
    }

    const l3Delta = l3VarsDelta || l3_vars_delta;
    if (l3Delta && typeof l3Delta === 'object') {
      applyL3VarsToMemoryLayers(memoryLayers, l3Delta);
    }

    const ingestMeta = { l0_id: null, l1_id: null, episode_id: null };

    if (turn && typeof turn === 'object') {
      const savedTurn = ingestL0Turn(memoryLayers, turn, source, now);
      ingestMeta.l0_id = savedTurn._id;
    }

    const l1Input = sessionSummary || l1;
    if (l1Input && typeof l1Input === 'object') {
      const l1Payload = { ...l1Input };
      if (
        ingestMeta.l0_id
        && (!Array.isArray(l1Payload.source_l0_ids) || !l1Payload.source_l0_ids.length)
      ) {
        l1Payload.source_l0_ids = [ingestMeta.l0_id];
      }
      const savedL1 = ingestSessionSummary(memoryLayers, l1Payload, source, now, {
        promoteToEpisode: promoteToEpisode !== false,
      });
      ingestMeta.l1_id = savedL1._id;
      const promoted = (memoryLayers.l2_episodes || []).find((ep) => ep.source_l1_id === savedL1._id);
      if (promoted) ingestMeta.episode_id = promoted._id;
    } else if (episode && typeof episode === 'object') {
      const epPayload = { ...episode };
      if (
        ingestMeta.l0_id
        && (!Array.isArray(epPayload.source_l0_ids) || !epPayload.source_l0_ids.length)
      ) {
        epPayload.source_l0_ids = [ingestMeta.l0_id];
      }
      const savedEp = ingestEpisodeRecord(memoryLayers, epPayload, source, now);
      ingestMeta.episode_id = savedEp._id;
      ingestMeta.l1_id = savedEp.source_l1_id || null;
    }

    if (semantic && typeof semantic === 'object') {
      const semantics = Array.isArray(memoryLayers.l2_semantics) ? memoryLayers.l2_semantics : [];
      semantics.unshift({ ...semantic, source, at: now });
      memoryLayers.l2_semantics = semantics.slice(0, 50);
    }

    upsertUserMemoryRow(uid, {
      profileContent,
      errorLedger: row?.error_ledger || '{}',
      memoryLayers: JSON.stringify(memoryLayers),
      updatedAt: now,
    });

    ingestMeta.l3_vars = getL3VarsObject(memoryLayers);

    res.json({
      success: true,
      data: {
        user_id: uid,
        profile_content: profileContent,
        memory_layers: memoryLayers,
        ingest_meta: ingestMeta,
        l3_vars: getL3VarsObject(memoryLayers),
        updated_at: now,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/user/memory/provenance/:userId/:episodeId', (req, res) => {
  try {
    const uid = normalizeMemoryUserId(req.params.userId);
    const episodeId = String(req.params.episodeId || '').trim();
    if (!episodeId) {
      return res.status(400).json({ success: false, error: '缂哄皯 episodeId銆? });
    }
    const row = db.prepare('SELECT memory_layers FROM user_memories WHERE user_id = ?').get(uid);
    const memoryLayers = parseJsonObject(row?.memory_layers, {});
    const episodes = Array.isArray(memoryLayers.l2_episodes) ? memoryLayers.l2_episodes : [];
    const episode = episodes.find((ep) => String(ep._id) === episodeId);
    if (!episode) {
      return res.status(404).json({ success: false, error: 'episode 鏈壘鍒般€? });
    }
    const l1List = Array.isArray(memoryLayers.l1_summaries) ? memoryLayers.l1_summaries : [];
    const l1 = episode.source_l1_id
      ? l1List.find((item) => String(item._id) === String(episode.source_l1_id))
      : null;
    const l0Ids = Array.isArray(episode.source_l0_ids) ? episode.source_l0_ids.map(String) : [];
    const turns = Array.isArray(memoryLayers.l0_turns) ? memoryLayers.l0_turns : [];
    const l0_turns = l0Ids.length
      ? turns.filter((t) => l0Ids.includes(String(t._id)))
      : [];
    res.json({
      success: true,
      data: {
        episode,
        l1_summary: l1 || null,
        l0_turns,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/error-ledger/append', (req, res) => {
  const { userId, category, entries } = req.body || {};
  const uid = normalizeMemoryUserId(userId);
  const now = Date.now();

  if (!category || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ success: false, error: '缂哄皯 category 鎴?entries銆? });
  }

  try {
    const row = db.prepare('SELECT * FROM user_memories WHERE user_id = ?').get(uid);
    const ledger = parseJsonObject(row?.error_ledger, {});
    const bucket = Array.isArray(ledger[category]) ? ledger[category] : [];

    for (const entry of entries) {
      if (entry && typeof entry === 'object') {
        bucket.unshift({ ...entry, at: entry.at || now });
      }
    }

    ledger[category] = bucket.slice(0, 30);
    upsertUserMemoryRow(uid, {
      profileContent: row?.profile_content || '',
      errorLedger: JSON.stringify(ledger),
      memoryLayers: row?.memory_layers || '{}',
      updatedAt: now,
    });

    res.json({ success: true, data: { error_ledger: ledger, updated_at: now } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 1. ???????? API (Vocab)
// ==========================================

// ??????????
app.get('/api/vocab/stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM vocabulary').get().count;
    const now = Date.now();
    const dueToday = db.prepare('SELECT COUNT(*) as count FROM vocabulary WHERE next_review_date <= ? AND repetitions < 999').get(now).count;
    res.json({ total, dueToday });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

function mapLightVocabRow(r) {
  return {
    id: r.id,
    word: r.word,
    dict_type: r.dict_type,
    category: r.category,
    scene_type: r.scene_type,
    added_at: r.added_at,
    repetitions: r.repetitions,
    ease_factor: r.ease_factor,
    interval_days: r.interval_days,
    next_review_date: r.next_review_date,
    last_review_date: r.last_review_date,
    review_history: [],
    payload: {},
    _light: true,
  };
}

// 杞婚噺鍒楄〃锛氬彧鍙栨爣閲忓垪锛岀姝?json_extract锛?000 琛屼細鎵撴弧浜嬩欢寰幆瀵艰嚧鍏ㄧ珯瓒呮椂锛?const LIGHT_SELECT = `
  id, word, dict_type, category, scene_type, added_at, repetitions, ease_factor, interval_days, next_review_date, last_review_date
`;

function parseVocabCategory(value) {
  return value === 'business' || value === 'general' ? value : null;
}

// ???????????????
app.get('/api/vocab/list', (req, res) => {
  try {
    const light = String(req.query.light || '') === '1';
    if (light) {
      const limit = Number(req.query.limit);
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const category = parseVocabCategory(req.query.category);
      if (Number.isInteger(limit) && limit > 0) {
        const pageSize = Math.min(limit, 100);
        const rows = category
          ? db.prepare(`
              SELECT ${LIGHT_SELECT}
              FROM vocabulary
              WHERE category = ?
              ORDER BY added_at DESC
              LIMIT ? OFFSET ?
            `).all(category, pageSize + 1, offset)
          : db.prepare(`
              SELECT ${LIGHT_SELECT}
              FROM vocabulary
              ORDER BY added_at DESC
              LIMIT ? OFFSET ?
            `).all(pageSize + 1, offset);
        return res.json({
          items: rows.slice(0, pageSize).map(mapLightVocabRow),
          hasMore: rows.length > pageSize,
        });
      }
      const rows = db.prepare(`SELECT ${LIGHT_SELECT} FROM vocabulary ORDER BY added_at DESC`).all();
      return res.json(rows.map(mapLightVocabRow));
    }
    const rows = db.prepare('SELECT * FROM vocabulary ORDER BY added_at DESC').all();
    const formatted = rows.map(r => ({
      ...r,
      payload: r.payload ? JSON.parse(r.payload) : {},
      review_history: r.review_history ? JSON.parse(r.review_history) : []
    }));
    res.json(formatted);
  } catch (error) {
    console.error('[vocab/list]', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ????????????
app.get('/api/vocab/review', (req, res) => {
  try {
    const now = Date.now();
    const light = String(req.query.light || '') === '1';
    if (light) {
      const limit = Number(req.query.limit);
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const category = parseVocabCategory(req.query.category);
      if (Number.isInteger(limit) && limit > 0) {
        const pageSize = Math.min(limit, 100);
        const rows = category
          ? db.prepare(`
              SELECT ${LIGHT_SELECT}
              FROM vocabulary
              WHERE next_review_date <= ? AND repetitions < 999 AND category = ?
              ORDER BY next_review_date ASC
              LIMIT ? OFFSET ?
            `).all(now, category, pageSize + 1, offset)
          : db.prepare(`
              SELECT ${LIGHT_SELECT}
              FROM vocabulary
              WHERE next_review_date <= ? AND repetitions < 999
              ORDER BY next_review_date ASC
              LIMIT ? OFFSET ?
            `).all(now, pageSize + 1, offset);
        return res.json({
          items: rows.slice(0, pageSize).map(mapLightVocabRow),
          hasMore: rows.length > pageSize,
        });
      }
      const rows = db.prepare(
        `SELECT ${LIGHT_SELECT} FROM vocabulary WHERE next_review_date <= ? AND repetitions < 999 ORDER BY next_review_date ASC`
      ).all(now);
      return res.json(rows.map(mapLightVocabRow));
    }
    const rows = db.prepare('SELECT * FROM vocabulary WHERE next_review_date <= ? AND repetitions < 999 ORDER BY next_review_date ASC').all(now);
    res.json(rows.map(r => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : {} })));
  } catch (error) {
    console.error('[vocab/review]', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 鍗曟潯瀹屾暣璇嶆潯锛堣交閲忓垪琛ㄦ寜闇€琛ュ叏 payload锛?app.get('/api/vocab/item/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Word not found' });
    res.json({
      ...row,
      payload: row.payload ? JSON.parse(row.payload) : {},
      review_history: row.review_history ? JSON.parse(row.review_history) : [],
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ???????
app.post('/api/vocab/add', (req, res) => {
  try {
    const { word, dictType, category, scene_type = 'business', payload } = req.body;
    
    // ?????????????? category?????????? scene_type ??????
    const actualCategory = category || (scene_type === 'general' ? 'general' : 'business');

    // ??????
    const existing = db.prepare('SELECT id FROM vocabulary WHERE word = ? COLLATE NOCASE').get(word);
    if (existing) {
      return res.json({ success: false, message: '璇嶆潯宸插瓨鍦?, id: existing.id });
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO vocabulary (id, word, dict_type, category, scene_type, payload, added_at, next_review_date, review_history, repetitions, interval_days, ease_factor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, word, dictType, actualCategory, scene_type, JSON.stringify(payload || {}), now, now, '[]', 0, 1, 2.5);
    
    res.json({ success: true, id, message: '瀛樺叆鎴愬姛' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ????????????? (???? Dify ????????HTTP ???????????????????????????????
app.post('/api/vocab/batch-add', (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Expected a JSON array of vocabulary items' });
    }

    let addedCount = 0;
    const now = Date.now();

    // ???????SQLite ??????????????????????????????????????????????????????
    const insertMany = db.transaction((words) => {
      for (const item of words) {
        const word = item.word;
        if (!word) continue;
        
        const isPhrase = !!item.is_phrase;
        const isSentence = !!item.is_sentence
          || item.dictType === 'ai_sentence' || item.dict_type === 'ai_sentence'
          || (item.payload && item.payload.partOfSpeech === 'sentence');
        const dictType = item.dictType || item.dict_type || (isSentence ? 'ai_sentence' : (isPhrase ? 'ai_phrase' : 'ai_extracted'));
        const scene_type = item.scene_type || 'business';
        const category = item.category || (scene_type === 'general' ? 'general' : 'business');
        const payload = item.payload || {};

        const existing = db.prepare('SELECT id, payload FROM vocabulary WHERE word = ? COLLATE NOCASE').get(word);
        if (!existing) {
          const id = crypto.randomUUID();
          db.prepare(`
            INSERT INTO vocabulary (id, word, dict_type, category, scene_type, payload, added_at, next_review_date, review_history, repetitions, interval_days, ease_factor)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, word, dictType, category, scene_type, JSON.stringify(payload), now, now, '[]', 0, 1, 2.5);
          addedCount++;
        } else {
          db.prepare('UPDATE vocabulary SET dict_type = ?, category = ?, scene_type = ?, payload = ? WHERE id = ?').run(
            dictType,
            category,
            scene_type,
            JSON.stringify(payload),
            existing.id
          );
        }
      }
    });
    insertMany(items);

    console.log(`[Batch Add] Success: callback batch added ${addedCount} words.`);
    res.json({ success: true, addedCount, message: `Successfully batch added ${addedCount} words.` });
  } catch (error) {
    console.error('Batch Add Error:', error);
    res.status(500).json({ success: false, error: 'Database error on batch add' });
  }
});

// ???????????
app.put('/api/vocab/move/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { category } = req.body;
    db.prepare('UPDATE vocabulary SET category = ? WHERE id = ?').run(category, id);
    res.json({ success: true, message: '杩佺Щ鎴愬姛' });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ????????
app.patch('/api/vocab/update_payload/:id', (req, res) => {
  try {
    db.prepare('UPDATE vocabulary SET payload = ? WHERE id = ?').run(JSON.stringify(req.body.payload), req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ????????????????????????????????????? payload????
app.put('/api/vocab/update/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { word, category, payload } = req.body;
    db.prepare('UPDATE vocabulary SET word = ?, category = ?, payload = ? WHERE id = ?')
      .run(word, category, JSON.stringify(payload || {}), id);
    res.json({ success: true, message: '杩佺Щ鎴愬姛' });
  } catch (error) {
    console.error('Update vocab error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ?????????
app.put('/api/vocab/review/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { quality } = req.body;
    
    const word = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(id);
    if (!word) return res.status(404).json({ error: 'Word not found' });
    
    const calc = calculateNextReview(quality, word.repetitions, word.ease_factor, word.interval_days);
    const now = Date.now();
    const nextReview = now + (calc.interval * 86400000);
    
    const history = word.review_history ? JSON.parse(word.review_history) : [];
    history.push({ date: now, quality });

    db.prepare(`
      UPDATE vocabulary 
      SET repetitions = ?, ease_factor = ?, interval_days = ?, next_review_date = ?, last_review_date = ?, review_history = ?
      WHERE id = ?
    `).run(calc.repetitions, calc.easeFactor, calc.interval, nextReview, now, JSON.stringify(history), id);
    
    res.json({ success: true, nextReviewDate: nextReview, interval: calc.interval, message: 'ok' });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ?????
app.put('/api/vocab/manual-intervention/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { action } = req.body;
    const now = Date.now();
    let stmt;

    if (action === 'restart') {
      stmt = db.prepare('UPDATE vocabulary SET repetitions = 0, interval_days = 0, ease_factor = 2.5, next_review_date = ? WHERE id = ?');
      stmt.run(now, id);
    } else if (action === 'master') {
      stmt = db.prepare('UPDATE vocabulary SET repetitions = 999, next_review_date = 4102444800000 WHERE id = ?');
      stmt.run(id); // Set to year 2100
    } else if (action === 'step-forward') {
      const w = db.prepare('SELECT interval_days FROM vocabulary WHERE id = ?').get(id);
      const nextDate = now + ((w.interval_days + 3) * 86400000);
      stmt = db.prepare('UPDATE vocabulary SET next_review_date = ?, interval_days = interval_days + 3 WHERE id = ?');
      stmt.run(nextDate, id);
    } else if (action === 'step-back') {
      stmt = db.prepare('UPDATE vocabulary SET next_review_date = ?, interval_days = MAX(1, interval_days - 2) WHERE id = ?');
      stmt.run(now, id);
    }
    res.json({ success: true, message: 'Intervention applied' });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ????????
app.delete('/api/vocab/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM vocabulary WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ==========================================
// ??????????????????????????????????????????????????????????????????????// ==========================================
db.prepare(`
  CREATE TABLE IF NOT EXISTS daily_vocab_quota (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    quota_date TEXT NOT NULL,
    words_added INTEGER DEFAULT 0,
    phrases_added INTEGER DEFAULT 0,
    last_extraction_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    UNIQUE(user_id, quota_date)
  )
`).run();

// ==========================================
// 2. ???????????????????????(????????????????????????API)
// ==========================================

// Upsert ??? Session
app.post('/api/training/session/upsert', (req, res) => {
  try {
    const { userId = 'default-user', trainingDate, totalMinutes = 0, listenMinutes = 0, logicMinutes = 0, extraJson } = req.body;
    
    // Check if session exists
    const existing = db.prepare('SELECT id, extra_json FROM training_sessions WHERE training_date = ?').get(trainingDate);
    const now = Date.now();
    let sessionId;
    
    if (existing) {
      sessionId = existing.id;
      let newExtra = existing.extra_json ? JSON.parse(existing.extra_json) : {};
      if (extraJson) {
        newExtra = { ...newExtra, ...extraJson };
      }
      db.prepare(`
        UPDATE training_sessions 
        SET total_minutes = total_minutes + ?, listen_minutes = listen_minutes + ?, logic_minutes = logic_minutes + ?, extra_json = ?, updated_at = ?
        WHERE id = ?
      `).run(totalMinutes, listenMinutes, logicMinutes, JSON.stringify(newExtra), now, sessionId);
      
      res.json({ success: true, sessionId, status: 'updated' });
    } else {
      sessionId = crypto.randomBytes(16).toString('hex');
      const initialExtra = extraJson ? JSON.stringify(extraJson) : '{}';
      db.prepare(`
        INSERT INTO training_sessions (id, user_id, training_date, total_minutes, listen_minutes, logic_minutes, extra_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sessionId, userId, trainingDate, totalMinutes, listenMinutes, logicMinutes, initialExtra, now, now);
      
      res.json({ success: true, sessionId, status: 'created' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error on upsert session' });
  }
});

// ???????????????Session ????
app.get('/api/training/session-by-date', (req, res) => {
  try {
    const { trainingDate, userId = 'default-user' } = req.query;
    const session = db.prepare('SELECT * FROM training_sessions WHERE training_date = ? AND user_id = ?').get(trainingDate, userId);
    
    if (!session) {
      return res.json({ session: null, attempts: [], review: null });
    }
    
    const attempts = db.prepare('SELECT * FROM training_attempts WHERE session_id = ?').all(session.id);
    const formattedAttempts = attempts.map(a => ({
      ...a,
      userAnswer: a.user_answer ? JSON.parse(a.user_answer) : {}
    }));
    
    res.json({
      session: {
        ...session,
        extra_json: session.extra_json ? JSON.parse(session.extra_json) : {}
      },
      attempts: formattedAttempts,
      review: null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error on get session-by-date' });
  }
});

// ??????? Attempt
app.post('/api/training/attempt', (req, res) => {
  try {
    const { sessionId, userId = 'default-user', moduleType, sceneType, caseText, userAnswer, durationSeconds = 0, score = null } = req.body;
    const attemptId = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO training_attempts (id, session_id, user_id, module_type, scene_type, case_text, user_answer, duration_seconds, score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(attemptId, sessionId, userId, moduleType, sceneType, caseText, JSON.stringify(userAnswer || {}), durationSeconds, score, now);
    
    res.json({ success: true, attemptId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error on create attempt: ' + error.message });
  }
});

// ?? Feedback
app.post('/api/training/feedback', (req, res) => {
  res.json({ success: true, feedbackId: crypto.randomBytes(16).toString('hex'), status: 'archived' });
});

// ????????????????????(?? + ????? + ????)
app.get('/api/theme/check-mastery', (req, res) => {
  try {
    const { theme, userId = 'default-user' } = req.query;

    // Count oral attempts for this theme
    const oralCountRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM training_attempts
      WHERE user_id = ? AND scene_type = ? AND module_type = 'oral'
    `).get(userId, theme);
    const oralCount = oralCountRow ? oralCountRow.count : 0;

    // Get max write score for this theme
    const maxWriteRow = db.prepare(`
      SELECT MAX(score) as max_score
      FROM training_attempts
      WHERE user_id = ? AND scene_type = ? AND module_type = 'write'
    `).get(userId, theme);
    const maxWriteScore = (maxWriteRow && maxWriteRow.max_score !== null) ? maxWriteRow.max_score : 0;

    // Get email completion status for this theme
    const emailRow = db.prepare(`
      SELECT has_perfect_email FROM theme_progress WHERE user_id = ? AND theme = ?
    `).get(userId, theme);
    const emailCompleted = emailRow ? !!emailRow.has_perfect_email : false;

    const isMastered = oralCount >= 10 && maxWriteScore >= 8 && emailCompleted;

    res.json({
      success: true,
      theme,
      userId,
      oralCount,
      oralPassed: oralCount >= 10,
      maxWriteScore,
      emailCompleted,
      isMastered
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error on check-mastery' });
  }
});

// ?????????????????????????
app.get('/api/theme/mastered-list', (req, res) => {
  try {
    const { userId = 'default-user' } = req.query;

    // 1. ???????????????????????????
    const candidateThemesRows = db.prepare(`
      SELECT DISTINCT theme FROM (
        SELECT scene_type AS theme FROM training_attempts WHERE user_id = ? AND scene_type IS NOT NULL
        UNION
        SELECT theme FROM theme_progress WHERE user_id = ? AND theme IS NOT NULL
      )
    `).all(userId, userId);

    const masteredThemes = [];

    // 2. ?????????????????
    for (const row of candidateThemesRows) {
      const themeName = row.theme;

      const oralCountRow = db.prepare(`
        SELECT COUNT(*) as count FROM training_attempts
        WHERE user_id = ? AND scene_type = ? AND module_type = 'oral'
      `).get(userId, themeName);
      const oralCount = oralCountRow ? oralCountRow.count : 0;

      const maxWriteRow = db.prepare(`
        SELECT MAX(score) as max_score FROM training_attempts
        WHERE user_id = ? AND scene_type = ? AND module_type = 'write'
      `).get(userId, themeName);
      const maxWriteScore = (maxWriteRow && maxWriteRow.max_score !== null) ? maxWriteRow.max_score : 0;

      const emailRow = db.prepare(`
        SELECT has_perfect_email FROM theme_progress WHERE user_id = ? AND theme = ?
      `).get(userId, themeName);
      const emailCompleted = emailRow ? !!emailRow.has_perfect_email : false;

      if (oralCount >= 10 && maxWriteScore >= 8 && emailCompleted) {
        masteredThemes.push(themeName);
      }
    }

    res.json({
      success: true,
      userId,
      masteredThemes
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error on mastered-list' });
  }
});

app.post('/api/theme/focus', (req, res) => res.json({ success: true, theme: req.body.theme || 'default' }));

// ???????????????????
app.post('/api/theme/mark-email-complete', (req, res) => {
  try {
    const { theme, userId = 'default-user' } = req.body;
    if (!theme) return res.status(400).json({ error: 'Missing theme' });
    const now = Date.now();
    db.prepare(`
      INSERT INTO theme_progress (id, user_id, theme, has_perfect_email, updated_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(user_id, theme) DO UPDATE SET has_perfect_email = 1, updated_at = ?
    `).run(crypto.randomBytes(8).toString('hex'), userId, theme, now, now);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error on mark-email-complete' });
  }
});

// ==========================================
// ????????????????????? API
// ==========================================

// ??????????????
app.post('/api/theme/custom-add', async (req, res) => {
  const { themeName, file, user_current_profile, userId = 'default-user' } = req.body;

  if (!themeName || !file) {
    return res.status(400).json({ success: false, error: '缂哄皯蹇呰鍙傛暟 themeName 鎴?file' });
  }

  const DATASET_KEY = 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
  const WORKFLOW_KEY = 'app-F6daqhSXH942sBrnGki4kzZq';
  const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

  try {
    // 1. 浣跨敤鍥哄畾 ID 璁块棶 Knowleage_Pro_Scenarios锛屽苟娓呯┖鐜版湁鏂囨。
    const datasetId = KNOWLEAGE_PRO_SCENARIOS_DATASET_ID;

    console.log('[Custom Theme] 姝ｅ湪娓呯┖ Knowleage_Pro_Scenarios 鐭ヨ瘑搴?..');
    const docsResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/documents?page=1&limit=100`, {
      headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
    });
    if (!docsResponse.ok) throw new Error(`鑾峰彇鐭ヨ瘑搴撴枃妗ｅ垪琛ㄥけ璐?(HTTP ${docsResponse.status})`);
    const docsData = await docsResponse.json();
    const docIds = docsData.data?.map(d => d.id) || [];

    if (docIds.length > 0) {
      console.log(`[Custom Theme] 鍙戠幇 ${docIds.length} 涓棫鏂囨。锛屾鍦ㄥ垹闄?..`);
      await Promise.all(docIds.map(async docId => {
        const delRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${docId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
        });
        if (!delRes.ok) console.warn(`[Custom Theme] 鍒犻櫎鏂囨。 ${docId} 澶辫触 (HTTP ${delRes.status})`);
      }));
      console.log('[Custom Theme] 鐭ヨ瘑搴撳凡娓呯┖');
    } else {
      console.log('[Custom Theme] 鐭ヨ瘑搴撲负绌猴紝鏃犻渶娓呯┖');
    }

    // 2. ???????????????????????????????????????????????????????????????????
    const base64Data = file.content || file.base64 || '';
    const base64Content = base64Data.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');
    
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const formData = new FormData();
    formData.append('file', blob, file.fileName || 'custom_material.pdf');
    formData.append('data', JSON.stringify({ 
      indexing_technique: 'high_quality', 
      doc_form: 'hierarchical_model',
      process_rule: { 
        mode: 'hierarchical',
        rules: {
          pre_processing_rules: [
            { id: 'remove_extra_spaces', enabled: true },
            { id: 'remove_urls_emails', enabled: false }
          ],
          parent_mode: 'paragraph',
          segmentation: {
            separator: '\\n',
            max_tokens: 1000
          },
          subchunk_segmentation: {
            separator: '\\n',
            max_tokens: 200
          }
        }
      } 
    }));

    const uploadResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/document/create_by_file`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DATASET_KEY}` },
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      throw new Error(`Dify 鏂囦欢鍏ュ簱澶辫触: ${errText}`);
    }

    const uploadData = await uploadResponse.json();
    const documentId = uploadData.document?.id;
    const batchId = uploadData.batch; 

    if (!documentId || !batchId) {
      throw new Error('鏂囦欢宸插彂閫侊紝浣嗘湭浠?Dify 鎷垮埌 batch ID 瀵艰嚧鏃犳硶璺熻釜');
    }

    console.log(`[Custom Theme] 鏂囨。涓婁紶鎴愬姛 (ID: ${documentId}, Batch: ${batchId})锛屾鍦ㄨ疆璇㈠悜閲忓寲杩涘害...`);

    // 3. ???????????????????
    let isIndexed = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${batchId}/indexing-status`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
      });
      
      if (!statusRes.ok) continue;      
      const statusData = await statusRes.json();
      const docInfo = statusData.data?.[0];
      
      if (docInfo) {
        console.log(`[Custom Theme] 绗?${i + 1} 娆¤繘搴︽壂鎻? status = ${docInfo.indexing_status}`);
        if (docInfo.indexing_status === 'completed') {
          isIndexed = true;
          break;
        } else if (docInfo.indexing_status === 'error') {
          throw new Error('Dify 鍚戦噺鍖栧垏鍒嗘姤閿欙紝璇峰墠寰€鍚庡彴鏌ョ湅鍘熷洜');
        }
      }
    }

    if (!isIndexed) {
      throw new Error('Dify 鍚戦噺鍖栫储寮曡秴鏃?(>120s)銆?);
    }

    console.log(`[Custom Theme] 鍚戦噺鍖栬杞藉畬姣曪紝璋冪敤涓婚钀冨彇宸ヤ綔娴?..`);

    // 4. ????????? A ??????????
    const wfResponse = await fetch(`${BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKFLOW_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: { 
          custom_theme_name: themeName,
          topic: themeName,
          user_current_profile: user_current_profile || ''
        },
        response_mode: 'blocking',
        user: userId
      })
    });
    
    const wfData = await wfResponse.json();
    if (!wfResponse.ok) throw new Error(`宸ヤ綔娴佹墽琛屽け璐? ${JSON.stringify(wfData)}`);
    
    const outputs = wfData?.data?.outputs || {};
    const extractedThemeName = outputs.theme_name || themeName;
    const extractedWordsRaw = outputs.extracted_words || '[]';
    const keyPhrasesRaw = outputs.key_phrases || '[]';

    let extractedWords = [];
    try {
      extractedWords = typeof extractedWordsRaw === 'string' ? JSON.parse(extractedWordsRaw) : extractedWordsRaw;
    } catch (e) {
      console.error("瑙ｆ瀽 extracted_words 澶辫触", e);
    }
    
    let keyPhrases = [];
    try {
      keyPhrases = typeof keyPhrasesRaw === 'string' ? JSON.parse(keyPhrasesRaw) : keyPhrasesRaw;
    } catch (e) {
      console.error("瑙ｆ瀽 key_phrases 澶辫触", e);
    }

    // 5. ?????? custom_themes ?
    const themeId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO custom_themes (id, user_id, theme_name, display_name, associated_file, dify_document_id, dify_dataset_id, extracted_keywords, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      themeId,
      userId,
      themeName,
      extractedThemeName,
      file.fileName || 'custom_material.pdf',
      documentId,
      datasetId,
      JSON.stringify(extractedWords),
      Date.now(),
      Date.now()
    );

    // 6. ????????????????????????????????????????
    let addedWordsCount = 0;
    const now = Date.now();
    if (Array.isArray(extractedWords)) {
      for (const item of extractedWords) {
        const w = (item.word || '').trim();
        if (!w || w.length > 100) continue;
        const existing = db.prepare('SELECT id FROM vocabulary WHERE word = ? COLLATE NOCASE').get(w);
        if (!existing) {
          const id = crypto.randomUUID();
          const payload = {
            phonetic: item.ipa || item.phonetic || '',
            partOfSpeech: item.partOfSpeech || item.part_of_speech || '',
            meaning: item.meaning || item.meaning_zh || '',
            definition_en: item.definition_en || '',
            business_note: item.business_note || '',
            examples: item.examples || [],
            source: 'Custom Theme Extract',
            topic: extractedThemeName
          };
          db.prepare(`
            INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, w, 'ai_extracted', 'business', JSON.stringify(payload), now, now, '[]');
          addedWordsCount++;
        }
      }
    }

    let addedPhrasesCount = 0;
    if (Array.isArray(keyPhrases)) {
      for (const phraseObj of keyPhrases) {
        const phraseStr = typeof phraseObj === 'string' ? phraseObj.trim() : (phraseObj.phrase || phraseObj.word || '').trim();
        if (!phraseStr || phraseStr.length > 500) continue;
        const existingPhrase = db.prepare(
          "SELECT id FROM vocabulary WHERE dict_type = 'ai_phrase' AND payload LIKE ? COLLATE NOCASE"
        ).get(`%${phraseStr.substring(0, 50)}%`);
        if (!existingPhrase) {
          const id = crypto.randomUUID();
          const payload = {
            source: 'Custom Theme Extract',
            topic: extractedThemeName,
            type: 'phrase',
            meaning: phraseObj.meaning || phraseObj.meaning_zh || '',
            definition_en: phraseObj.definition_en || '',
            examples: phraseObj.examples || []
          };
          db.prepare(`
            INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, phraseStr, 'ai_phrase', 'business', JSON.stringify(payload), now, now, '[]');
          addedPhrasesCount++;
        }
      }
    }

    res.json({
      success: true,
      theme: {
        id: themeId,
        themeName: themeName,
        displayName: extractedThemeName,
        associatedFile: file.fileName,
        difyDocumentId: documentId,
        difyDatasetId: datasetId,
        extractedKeywords: extractedWords,
        createdAt: now
      },
      addedWordsCount,
      addedPhrasesCount
    });

  } catch (error) {
    console.error('Custom Theme Upload and Extraction Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ?????????????????????
app.get('/api/theme/list', (req, res) => {
  const { userId = 'default-user' } = req.query;
  try {
    const rows = db.prepare('SELECT * FROM custom_themes WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    const formatted = rows.map(r => ({
      id: r.id,
      themeName: r.theme_name,
      displayName: r.display_name,
      associatedFile: r.associated_file,
      difyDocumentId: r.dify_document_id,
      difyDatasetId: r.dify_dataset_id,
      extractedKeywords: r.extracted_keywords ? JSON.parse(r.extracted_keywords) : [],
      source: 'custom',
      createdAt: r.created_at
    }));
    res.json({ success: true, themes: formatted });
  } catch (error) {
    console.error('Failed to list custom themes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ???????????????? (??????????????????????)
app.delete('/api/theme/custom/:id', async (req, res) => {
  const id = req.params.id;
  const DATASET_KEY = 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
  const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

  try {
    const row = db.prepare('SELECT * FROM custom_themes WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Custom theme not found' });
    }

    if (row.dify_document_id && row.dify_dataset_id) {
      console.log(`[Delete Theme] Deleting document ${row.dify_document_id} from dataset ${row.dify_dataset_id}`);
      const delResponse = await fetch(`${BASE_URL}/datasets/${row.dify_dataset_id}/documents/${row.dify_document_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
      });
      if (!delResponse.ok) {
        console.warn(`[Delete Theme] Failed to delete Dify document: ${await delResponse.text()}`);
      }
    }

    db.prepare('DELETE FROM custom_themes WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete custom theme:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ??????????????????????????????????
app.get('/api/theme/stay-stats', (req, res) => {
  const { theme, userId = 'default-user' } = req.query;
  if (!theme) {
    return res.status(400).json({ success: false, error: 'Missing theme parameter' });
  }

  try {
    const earliestGen = db.prepare(`
      SELECT MIN(generated_at) as earliest FROM generation_history 
      WHERE user_id = ? AND theme = ?
    `).get(userId, theme);

    const earliestAttempt = db.prepare(`
      SELECT MIN(created_at) as earliest FROM training_attempts 
      WHERE user_id = ? AND scene_type = ?
    `).get(userId, theme);

    let earliestTime = Date.now();
    if (earliestGen?.earliest) earliestTime = Math.min(earliestTime, earliestGen.earliest);
    if (earliestAttempt?.earliest) earliestTime = Math.min(earliestTime, earliestAttempt.earliest);

    const stayDays = earliestTime === Date.now() 
      ? 1 
      : Math.max(1, Math.ceil((Date.now() - earliestTime) / (24 * 60 * 60 * 1000)));

    const genCountRow = db.prepare(`
      SELECT COUNT(*) as count FROM generation_history 
      WHERE user_id = ? AND theme = ?
    `).get(userId, theme);
    const articleCount = genCountRow ? genCountRow.count : 0;

    const escapedTheme = theme.replace(/"/g, '\\"');
    const wordCountRow = db.prepare(`
      SELECT COUNT(*) as count FROM vocabulary 
      WHERE dict_type = 'ai_extracted' AND payload LIKE ?
    `).get(`%${escapedTheme}%`);
    const wordCount = wordCountRow ? wordCountRow.count : 0;

    const phraseCountRow = db.prepare(`
      SELECT COUNT(*) as count FROM vocabulary 
      WHERE dict_type = 'ai_phrase' AND payload LIKE ?
    `).get(`%${escapedTheme}%`);
    const phraseCount = phraseCountRow ? phraseCountRow.count : 0;

    let weakPoints = { pronunciation: '鏆傛棤鍙戦煶闂璁板綍', grammar: '鏆傛棤璇硶闂璁板綍' };
    let todaySuggestion = '寤鸿锛氬畬鎴愪粖鏃ュ崟璇嶇殑鑻辨眽鍙屽悜鐔熺粌搴﹂粯鍐欙紝骞惰繘琛屾祦寮忛暱鏂囧惉鍔涚簿鍚€?;

    const latestSession = db.prepare(`
      SELECT extra_json FROM training_sessions 
      WHERE user_id = ? 
      ORDER BY training_date DESC LIMIT 1
    `).get(userId);

    if (latestSession?.extra_json) {
      try {
        const extra = JSON.parse(latestSession.extra_json);
        const ef = extra.englishFoundation || {};
        if (ef.pronunciationNotes) weakPoints.pronunciation = ef.pronunciationNotes;
        if (ef.grammarNotes) weakPoints.grammar = ef.grammarNotes;
        
        if (ef.pronunciationNotes || ef.grammarNotes) {
          todaySuggestion = `浠婃棩閽堝鎬у缓璁細閲嶇偣绾犳銆?{ef.pronunciationNotes || '鏃犵壒娈婂彂闊抽棶棰?}銆戠殑鍙戦煶涔犳儻锛涘湪鍙ｈ/鍐欎綔缁冧範涓埢鎰忚繍鐢ㄣ€?{ef.grammarNotes || '鏃犺娉曞亸宸?}銆戠殑淇鏂规銆俙;
        }
      } catch {}
    }

    res.json({
      success: true,
      stayDays,
      articleCount,
      wordCount,
      phraseCount,
      weakPoints,
      todaySuggestion
    });
  } catch (error) {
    console.error('Failed to get stay stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post('/api/material/upload', (req, res) => res.json({ success: true, message: 'Material upload mocked' }));
app.get('/api/material/list', (req, res) => res.json([]));
app.get('/api/knowledge-node/list', (req, res) => res.json([]));
// Dify embed 浼氳瘽鏍￠獙锛氭湁鏁堝垯杩斿洖 conversation_id 渚?iframe URL锛況enew=1 鏃跺垱寤烘柊浼氳瘽
app.get('/api/dify/embed-session', async (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  const conversationId = typeof req.query.conversationId === 'string'
    ? req.query.conversationId.trim()
    : '';
  const renew = req.query.renew === '1';

  if (!userId) {
    return res.status(400).json({ message: '缂哄皯 userId 鍙傛暟銆? });
  }

  const apiKey = process.env.DIFY_CHATBOT_API_KEY
    || process.env.VITE_DIFY_CHATBOT_API_KEY
    || 'app-TyztRkdBVX4kNUxA8dZ0frk7';
  const baseUrl = process.env.DIFY_API_BASE_URL
    || process.env.VITE_DIFY_API_BASE_URL
    || 'https://dify.234124123.xyz/v1';

  async function validateConversation(convId) {
    if (!convId) return false;
    const url = `${baseUrl}/messages?user=${encodeURIComponent(userId)}&conversation_id=${encodeURIComponent(convId)}&limit=1`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return response.ok;
    } catch (err) {
      console.error('[embed-session] validate conversation failed:', err);
      return false;
    }
  }

  async function listLatestConversation() {
    const url = `${baseUrl}/conversations?user=${encodeURIComponent(userId)}&limit=1&sort_by=-updated_at`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) return null;
      const data = await response.json().catch(() => ({}));
      return data?.data?.[0]?.id || null;
    } catch (err) {
      console.error('[embed-session] list conversations failed:', err);
      return null;
    }
  }

  async function createConversation() {
    try {
      const response = await fetch(`${baseUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {},
          query: ' ',
          user: userId,
          response_mode: 'blocking',
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('[embed-session] create conversation failed:', response.status, errText);
        return null;
      }
      const data = await response.json().catch(() => ({}));
      return data?.conversation_id || null;
    } catch (err) {
      console.error('[embed-session] create conversation error:', err);
      return null;
    }
  }

  try {
    if (renew) {
      const created = await createConversation();
      if (created && await validateConversation(created)) {
        return res.json({ conversationId: created, stale: false, created: true });
      }
      return res.json({ conversationId: null, stale: false, forceNew: true, reason: 'renew_failed' });
    }

    if (conversationId) {
      if (await validateConversation(conversationId)) {
        return res.json({ conversationId, stale: false });
      }
      const latest = await listLatestConversation();
      if (latest && await validateConversation(latest)) {
        return res.json({ conversationId: latest, stale: false, recovered: true });
      }
      return res.json({ conversationId: null, stale: true, reason: 'cached_invalid' });
    }

    const latest = await listLatestConversation();
    if (latest && await validateConversation(latest)) {
      return res.json({ conversationId: latest, stale: false });
    }
    if (latest) {
      return res.json({ conversationId: null, stale: true, reason: 'listed_invalid' });
    }

    const created = await createConversation();
    if (created && await validateConversation(created)) {
      return res.json({ conversationId: created, stale: false, created: true });
    }
    return res.json({ conversationId: null, stale: false, forceNew: true, reason: 'no_conversation' });
  } catch (err) {
    console.error('[embed-session] error:', err);
    return res.status(500).json({ message: err.message || 'embed 浼氳瘽鏍￠獙澶辫触' });
  }
});

// mychat 瀵硅瘽浠ｇ悊锛氭湇鍔＄鎷夊彇 memory_pack 娉ㄥ叆 Dify inputs锛堣閬垮伐浣滄祦 HTTP 鑺傜偣涓?body锛?app.post('/api/dify/mychat/chat', async (req, res) => {
  const {
    query,
    conversationId = null,
    userId = 'default-user',
    inputs = {},
    responseMode = 'blocking',
  } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ message: '缂哄皯 query 鍙傛暟銆? });
  }

  const apiKey = process.env.DIFY_CHATBOT_API_KEY
    || process.env.VITE_DIFY_CHATBOT_API_KEY
    || 'app-TyztRkdBVX4kNUxA8dZ0frk7';
  const baseUrl = process.env.DIFY_API_BASE_URL
    || process.env.VITE_DIFY_API_BASE_URL
    || 'https://dify.234124123.xyz/v1';

  const rawUser = String(userId || inputs.app_user_id || 'default-user').trim();
  const uid = normalizeMemoryUserId(rawUser.split('@')[0] || rawUser);
  const recallQ = buildRecallQueryFromUserQuery(query);
  let memoryPack = '';
  try {
    memoryPack = buildMemoryPackForLlm(uid, recallQ);
  } catch (err) {
    console.error('[mychat/chat] memory pack failed:', err);
  }

  const packText = String(inputs.memory_pack || memoryPack || '').trim();
  const mergedInputs = {
    ...inputs,
    app_user_id: uid,
    memory_pack: packText,
  };
  // 灏?memory_pack 宓屽叆 sys.query锛岃閬?Dify 宸ヤ綔娴?paragraph/璺ㄨ妭鐐瑰彉閲忎涪澶?  const difyQuery = packText
    ? `[缁撴瀯鍖栬蹇哴\n${packText}\n\n[鐢ㄦ埛闂]\n${query}`
    : query;

  try {
    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: mergedInputs,
        query: difyQuery,
        response_mode: responseMode,
        user: rawUser,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[mychat/chat] Dify error:', response.status, data);
      return res.status(response.status).json(data);
    }
    return res.json(data);
  } catch (err) {
    console.error('[mychat/chat] error:', err);
    return res.status(500).json({ message: err.message || 'mychat 瀵硅瘽浠ｇ悊澶辫触' });
  }
});

// 璇嶅吀鏌ヨ锛氬悗绔唬鐞?Dify dict_tool_workflow锛岄伩鍏嶅墠绔毚闇?API Key
app.post('/api/dify/dict-query', async (req, res) => {
  const { word, dictType, direction = 'auto', userContext = '', locale = 'zh-CN', user_current_profile, userId = 'frontend-panel' } = req.body;

  if (!word) {
    return res.status(400).json({ ok: false, message: 'Please input a word to query.' });
  }

  const DIFY_DICT_API_KEY = 'app-zGyrsyvvzHAIO5yx11OcYdpa';
  const BASE_URL = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  const DICT_QUERY_TIMEOUT_MS = Number(process.env.DIFY_DICT_QUERY_TIMEOUT_MS) || 120000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DICT_QUERY_TIMEOUT_MS);

  try {
    console.log(`[Dict Query] 鍙戣捣鏌ヨ: "${word}", 璇嶅吀绫诲瀷: "${dictType}"`);

    const response = await fetch(`${BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_DICT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: injectOralSystemTime({
          word: word.trim(),
          dict_type: dictType || 'en_zh_bidirectional',
          direction: direction || 'auto',
          user_context: userContext || '',
          locale: locale || 'zh-CN',
          user_current_profile: user_current_profile || ''
        }),
        response_mode: 'blocking',
        user: userId || 'frontend-panel'
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Dict Query] Dify 宸ヤ綔娴佽繑鍥為敊璇?(${response.status}):`, errText);

      try {
        db.prepare(`
          INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(crypto.randomUUID(), word.trim(), dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify({ error: errText }), Date.now());
      } catch (logErr) {}

      return res.json({ ok: false, fallback: true, message: `Dify 宸ヤ綔娴佽皟鐢ㄥけ璐? HTTP ${response.status}` });
    }

    const data = await response.json();
    const resultStr = data?.data?.outputs?.result;

    if (!resultStr) {
      console.warn('[Dict Query] 宸ヤ綔娴佽緭鍑虹己灏?result 瀛楁:', data);

      try {
        db.prepare(`
          INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(crypto.randomUUID(), word.trim(), dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify({ error: 'Missing result in outputs', raw: data }), Date.now());
      } catch (logErr) {}

      return res.json({ ok: false, fallback: true, message: 'Dify 宸ヤ綔娴佹湭杩斿洖鏈夋晥缁撴灉锛岃绋嶅悗閲嶈瘯' });
    }

    let parsedResult;
    try {
      parsedResult = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr;
    } catch (e) {
      console.warn('[Dict Query] 瑙ｆ瀽 result JSON 澶辫触:', e.message);

      try {
        db.prepare(`
          INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(crypto.randomUUID(), word.trim(), dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify({ error: 'JSON parse error', raw: resultStr }), Date.now());
      } catch (logErr) {}

      return res.json({ ok: false, fallback: true, message: '璇嶅吀缁撴灉鏍煎紡寮傚父锛屾棤娉曡В鏋? });
    }

    try {
      db.prepare(`
        INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(crypto.randomUUID(), word.trim(), dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify(parsedResult), Date.now());
    } catch (logErr) {}

    console.log(`[Dict Query] 璇嶆潯 "${word}" 鏌ヨ鎴愬姛锛屽瓧娈?`, Object.keys(parsedResult?.payload || {}));
    return res.json(parsedResult);
  } catch (error) {
    const isTimeout = error.name === 'AbortError' || /aborted/i.test(error.message || '');
    console.warn('[Dict Query] 鏌ヨ澶辫触:', error.message);
    const message = isTimeout
      ? `璇嶅吀鏌ヨ瓒呮椂锛?{DICT_QUERY_TIMEOUT_MS / 1000} 绉掞級锛屽伐浣滄祦浠嶅湪杩愯涓紝璇风◢鍚庨噸璇昤
      : `璇嶅吀鏌ヨ澶辫触: ${error.message}`;
    return res.json({ ok: false, fallback: true, message });
  } finally {
    clearTimeout(timeoutId);
  }
});

// 杈呭姪鍑芥暟锛氫粠娣锋潅鏂囨湰涓彁鍙栧彲 JSON.parse 鐨勭墖娈碉紙```json 鍧楁垨鏈€澶栦晶 {}锛?function extractJsonFromString(raw) {
  const rawStr = String(raw ?? '').trim();
  const jsonBlockMatch = rawStr.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    return jsonBlockMatch[1].trim();
  }
  const startIdx = rawStr.indexOf('{');
  const endIdx = rawStr.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return rawStr.substring(startIdx, endIdx + 1).trim();
  }
  return rawStr.replace(/```json/gi, '').replace(/```/g, '').trim();
}

// ????????????????????????? (???? Dify ???????????????)
app.post('/api/dify/write-review', async (req, res) => {
  const { user_text, mail_intent, theme, user_current_profile } = req.body;
  if (!user_text || !mail_intent || !theme) {
    return res.status(400).json({ success: false, error: 'Missing required parameters: user_text, mail_intent, or theme.' });
  }

  const apiKey = process.env.DIFY_WRITE_GOVERNANCE_KEY || 'app-l4RcdCyDTzUPnY0GHlsgrUcs';
  const baseUrl = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

  try {
    console.log(`[Write Review] 寮€濮嬭繘琛屼功闈㈡壒闃呰瘎浼帮紝涓婚: "${theme}"`);

    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          user_text: user_text.trim(),
          mail_intent: mail_intent.trim(),
          theme: theme.trim(),
          user_current_profile: user_current_profile || ''
        },
        response_mode: 'blocking',
        user: 'system-agent'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Write Review] Dify 鏈嶅姟鍣ㄨ繑鍥為敊璇?${response.status}):`, errText);
      return res.status(response.status).json({ success: false, error: `Dify 鎺ュ彛寮傚父: ${response.status}`, details: errText });
    }

    const data = await response.json();
    const resultStr = data?.data?.outputs?.result;

    if (!resultStr) {
      console.warn('[Write Review] 宸ヤ綔娴佹湭杩斿洖 result 瀛楁:', data);
      return res.status(500).json({ success: false, error: 'Dify 宸ヤ綔娴佹湭杩斿洖姝ｇ‘鐨?result 瀛楁' });
    }

    let parsedResult;
    try {
      parsedResult = typeof resultStr === 'object' && resultStr !== null
        ? resultStr
        : JSON.parse(extractJsonFromString(resultStr));
    } catch (e) {
      console.error('[Write Review] 瑙ｆ瀽 result JSON 澶辫触:', e, resultStr);
      return res.status(500).json({ success: false, error: '宸ヤ綔娴佺粨鏋滆В鏋愬紓甯革紝杩斿洖鏁版嵁闈炲悎娉?JSON' });
    }

    const responseData = {
      L1: parsedResult.L1 || parsedResult.L1_Grammar || '',
      L2: parsedResult.L2 || parsedResult.L2_Business_Tone || '',
      L3: parsedResult.L3 || parsedResult.L3_Strategic_Position || '',
      optimized_version: parsedResult.optimized_version || ''
    };

    console.log(`[Write Review] 鎵归槄鎴愬姛锛屽凡娓呯悊骞惰繑鍥炵函 JSON 鏁版嵁`);
    return res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('[Write Review] 鏈嶅姟绔姹傚紓甯?, error);
    return res.status(500).json({ success: false, error: `鏈嶅姟鍣ㄥ唴閮ㄥ紓甯? ${error.message}` });
  }
});


// ????????????????????????
app.get('/api/dify/dict-coverage', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM dict_query_log').get().count;
    const success = db.prepare('SELECT COUNT(*) as count FROM dict_query_log WHERE is_success = 1').get().count;
    const successRate = total > 0 ? (success / total * 100).toFixed(2) : 0;

    const rows = db.prepare('SELECT response_payload FROM dict_query_log WHERE is_success = 1').all();
    const levelCounts = {
      'CET-4': 0,
      'CET-6': 0,
      '鑰冪爺': 0,
      'TOEFL': 0,
      'GRE': 0,
      'BUSINESS': 0,
      '鑰冪爺': 0,
      '鏈垎绫?: 0
    };
    
    rows.forEach(r => {
      try {
        const parsed = JSON.parse(r.response_payload);
        const level = parsed?.payload?.level || parsed?.level;
        if (level && levelCounts[level] !== undefined) {
          levelCounts[level]++;
        } else if (level) {
          levelCounts['鍏朵粬']++;
        } else {
          levelCounts['鍏朵粬']++;
        }
      } catch (e) {}
    });

    res.json({
      success: true,
      total_queries: total,
      success_queries: success,
      success_rate: parseFloat(successRate),
      level_distribution: levelCounts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error on dict-coverage' });
  }
});

// ==========================================
// ???????????????????????????? API
// ==========================================

// ????????????????????????????
app.get('/api/vocab/memory/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT memory_aids FROM vocabulary WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Word not found' });
    }
    const memoryAids = row.memory_aids ? JSON.parse(row.memory_aids) : {};
    res.json(memoryAids);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ???????????????????????????????????? payload ????????
async function checkAndEnrichPlaceholderPayload(row) {
  let payload = {};
  try {
    payload = row.payload ? JSON.parse(row.payload) : {};
  } catch (e) {
    console.error(`[Payload Enrich] Parse failed for word: ${row.word}`, e);
  }

  // ???????????????
  const hasPlaceholder = 
    !payload.meaning || 
    payload.meaning === '寰呭涔犺ˉ鍏? || 
    payload.meaning === '寰呭涔犺ˉ鍏? || 
    (payload.phonetic && payload.phonetic.includes('??')) ||
    (payload.definition_en && payload.definition_en.includes('绮惧噯瀹氫箟')) ||
    (payload.business_note && payload.business_note.includes('鐗瑰畾鍟嗙幆澧?)) ||
    (Array.isArray(payload.examples) && payload.examples.some(ex => typeof ex === 'string' && ex.includes('渚嬪彞1')));

  if (hasPlaceholder) {
    console.log(`[Payload Enrich] 妫€娴嬪埌璇嶆潯 "${row.word}" (ID: ${row.id}) 浣跨敤浜嗗崰浣嶇 payload锛屾鍦ㄥ惎鍔ㄩ潤榛樺瓧鍏告煡璇㈢籂姝?..`);
    const DIFY_DICT_API_KEY = 'app-zGyrsyvvzHAIO5yx11OcYdpa';
    const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    try {
      const response = await fetch(`${BASE_URL}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_DICT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {
            word: row.word.trim(),
            dict_type: 'en_en_business',
            direction: 'auto',
            user_context: '',
            locale: 'zh-CN',
            user_current_profile: ''
          },
          response_mode: 'blocking',
          user: 'backend-enrich-job'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const resultStr = data?.data?.outputs?.result;
        if (resultStr) {
          const parsedResult = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr;
          if (parsedResult && parsedResult.ok && parsedResult.payload) {
            const dp = parsedResult.payload;
            
            let meaning = dp.translation_main || (Array.isArray(dp.definitions_en) ? dp.definitions_en[0] : '寰呭涔犺ˉ鍏?);
            let definition_en = Array.isArray(dp.definitions_en) ? dp.definitions_en.join('; ') : (dp.definition || '');
            let business_note = dp.business_notes || '';
            let examples = [];

            if (parsedResult.type === 'en_zh_bidirectional') {
              meaning = dp.translation_main || '';
              definition_en = dp.translation_main || '';
              if (Array.isArray(dp.example_sentences)) {
                examples = dp.example_sentences.map(s => typeof s === 'object' ? `${s.en || ''} ${s.zh || ''}` : s);
              } else if (Array.isArray(dp.business_examples)) {
                examples = dp.business_examples.map(s => `${s.en || ''} ${s.zh || ''}`);
              }
            } else {
              if (Array.isArray(dp.example_sentences)) {
                examples = dp.example_sentences.map(s => typeof s === 'object' ? `${s.en || ''} ${s.zh || ''}` : s);
              } else {
                examples = dp.example_sentences || [];
              }
            }

            const newPayload = {
              word: row.word,
              phonetic: dp.phonetic || '',
              partOfSpeech: dp.pos || '',
              meaning: meaning,
              definition_en: definition_en,
              business_note: business_note,
              examples: examples,
              source: '鑷姩绾犳鍑€鍖?
            };

            db.prepare('UPDATE vocabulary SET payload = ? WHERE id = ?').run(JSON.stringify(newPayload), row.id);
            console.log(`[Payload Enrich] 鎴愬姛鏇存柊璇嶆潯 "${row.word}" 鏁版嵁搴?payload`);
            return newPayload;
          }
        }
      }
    } catch (err) {
      console.error(`[Payload Enrich] 闈欓粯瀛楀吀鏌ヨ鍙婃洿鏂板け璐?for "${row.word}":`, err);
    }
  }

  return payload;
}

// ????? Dify ?????????????????????????????????
app.post('/api/vocab/enrich-memory/:id', async (req, res) => {
  try {
    const { user_current_profile } = req.body;
    const row = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Word not found' });
    }

    const payload = await checkAndEnrichPlaceholderPayload(row);
    const word = row.word;
    
    let phonetic = payload.phonetic || '';
    let pos = payload.partOfSpeech || payload.pos || '';
    let definition = payload.meaning || payload.definition || payload.translation_main || '';
    if (payload.definition_en) {
      definition += (definition ? '; ' : '') + payload.definition_en;
    } else if (Array.isArray(payload.definitions_en)) {
      definition += (definition ? '; ' : '') + payload.definitions_en.join('; ');
    }
    let examples = '';
    if (Array.isArray(payload.examples)) {
      examples = payload.examples.map(s => typeof s === 'object' ? `${s.en || ''} ${s.zh || ''}` : s).join('\n');
    } else if (Array.isArray(payload.example_sentences)) {
      examples = payload.example_sentences.map(s => typeof s === 'object' ? `${s.en || ''} ${s.zh || ''}` : s).join('\n');
    } else if (Array.isArray(payload.business_examples)) {
      examples = payload.business_examples.map(s => `${s.en || ''} ${s.zh || ''}`).join('\n');
    }

    const memoryApiKey = process.env.DIFY_MEMORY_AID_API_KEY || 'app-aElSukJkmKmojPkVSk6H1mmN';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    console.log(`[Memory Aid] Generating memory aid for "${word}" (ID: ${row.id})`);

    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memoryApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          word: word.trim(),
          phonetic: phonetic || '',
          pos: pos || '',
          definition: definition || '',
          examples: examples || '',
          user_current_profile: user_current_profile || ''
        },
        response_mode: 'blocking',
        user: 'system-agent'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Memory Aid] Dify response error (${response.status}):`, errText);
      return res.status(response.status).json({ error: `Dify workflow error: ${response.status}` });
    }

    const data = await response.json();
    const resultStr = data?.data?.outputs?.result;

    if (!resultStr) {
      console.warn('[Memory Aid] Workflow did not return result:', data);
      return res.status(500).json({ error: 'Dify workflow failed to return memory aids.' });
    }

    let parsedResult;
    try {
      parsedResult = typeof resultStr === 'string' ? JSON.parse(resultStr.trim()) : resultStr;
    } catch (e) {
      let cleanStr = resultStr.trim();
      if (cleanStr.startsWith('```')) {
        const lines = cleanStr.split('\n');
        if (lines[0].startsWith('```')) {
          lines.shift();
        }
        if (lines[lines.length - 1].startsWith('```')) {
          lines.pop();
        }
        cleanStr = lines.join('\n').trim();
      }
      try {
        parsedResult = JSON.parse(cleanStr);
      } catch (innerErr) {
        console.error('[Memory Aid] Parsing Dify result failed:', innerErr, resultStr);
        return res.status(500).json({ error: 'Memory Aid result is not valid JSON.' });
      }
    }

    let existingMemoryAids = {};
    if (row.memory_aids) {
      try { existingMemoryAids = JSON.parse(row.memory_aids); } catch (e) {}
    }

    const mergedMemoryAids = {
      root_memory: parsedResult.root_memory || '',
      association_memory: parsedResult.association_memory || '',
      mnemonic_phrase: parsedResult.mnemonic_phrase || '',
      image_prompt: parsedResult.image_prompt || '',
      image_url: existingMemoryAids.image_url || '',
      download_url: existingMemoryAids.download_url || '',
      generated_at: Date.now()
    };

    db.prepare('UPDATE vocabulary SET memory_aids = ? WHERE id = ?').run(JSON.stringify(mergedMemoryAids), row.id);

    res.json(mergedMemoryAids);
  } catch (error) {
    console.error('[Memory Aid Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// ????????????????????????????????
app.get('/api/vocab/ebbinghaus/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT id, word, repetitions, interval_days, next_review_date, added_at, review_history FROM vocabulary WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Word not found' });
    }

    const history = row.review_history ? JSON.parse(row.review_history) : [];
    const addedAt = row.added_at;

    // ????????????????????????????????????(Day 0 ??? Day 30)
    const theoreticalIntervals = [0, 0.1, 0.5, 1, 2, 4, 7, 15, 30];
    const points = theoreticalIntervals.map(t => {
      let retention = 100;
      if (t > 0) {
        retention = Math.round(100 * (0.85 / (Math.pow(t, 0.18) + 0.05)));
        if (retention > 100) retention = 100;
        if (retention < 20) retention = 20;
      }
      return {
        day: t,
        retention_estimated: retention,
        is_theoretical: true
      };
    });

    // ?????????????????????????????????? Day 0??
    points.push({
      day: 0,
      quality: 5,
      is_review: true,
      review_index: 0,
      is_theoretical: false
    });

    history.forEach((rev, idx) => {
      const diffDays = Math.max(0, (rev.date - addedAt) / 86400000);
      points.push({
        day: parseFloat(diffDays.toFixed(2)),
        quality: rev.quality,
        is_review: true,
        review_index: idx + 1,
        is_theoretical: false
      });
    });

    points.sort((a, b) => a.day - b.day);

    res.json({
      id: row.id,
      word: row.word,
      repetitions: row.repetitions,
      interval_days: row.interval_days,
      next_review_date: row.next_review_date,
      points
    });
  } catch (error) {
    console.error('[Ebbinghaus API Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// ?????????????????????? text2image ??????
app.post('/api/vocab/generate-image/:id', async (req, res) => {
  try {
    const { user_current_profile } = req.body;
    const row = db.prepare('SELECT id, word, memory_aids FROM vocabulary WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Word not found' });
    }

    let memoryAids = {};
    try { memoryAids = JSON.parse(row.memory_aids || '{}'); } catch {}

    if (!memoryAids.image_prompt) {
      return res.status(400).json({ error: 'No image_prompt found, please generate memory aids first' });
    }

    const taskQueue = require('./services/taskQueue');
    const taskName = `鐢熸垚璁板繂鍥剧墖: ${row.word}`;
    const task = taskQueue.createTask('image-gen', taskName);

    // ???????? task ID ??????
    res.json({ success: true, taskId: task.id, status: task.status });

    // ??????????????????
    setImmediate(async () => {
      try {
        const baseUrl = process.env.IMAGE_GEN_BASE_URL || 'https://apihub.agnes-ai.cn/v1';
        const apiKey = process.env.IMAGE_GEN_API_KEY || 'sk-97VoIHRT895EXhp0fSJWhQUMjzzMUyPMQsgmYLgVB0XFymkp';
        const models = (process.env.IMAGE_GEN_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
        if (models.length === 0) models.push(...DEFAULT_IMAGE_GEN_MODELS);

        taskQueue.updateTask(task.id, { status: 'running', logs: ['寮€濮嬭皟鐢?Agnes /v1/images/generations'] });
        console.log(`[generate-image] prompt: "${memoryAids.image_prompt}", models: [${models.join(', ')}]`);

        let imageUrl = '';
        let downloadUrl = '';
        let lastError = '';

        for (const model of models) {
          console.log(`[generate-image] try model=${model}`);
          taskQueue.updateTask(task.id, { logs: [`灏濊瘯妯″瀷: ${model}`] });

          const result = await tryGenerateImageOnce(baseUrl, apiKey, model, memoryAids.image_prompt);
          if (result.ok) {
            imageUrl = result.imageUrl;
            downloadUrl = result.downloadUrl;
            console.log(`[generate-image] success model=${model} url=${imageUrl}`);
            taskQueue.updateTask(task.id, { logs: [`妯″瀷 ${model} 鎴愬姛`] });
            break;
          } else {
            lastError = result.error;
            console.log(`[generate-image] model ${model} failed: ${lastError}`);
            taskQueue.updateTask(task.id, { logs: [`妯″瀷 ${model} 澶辫触: ${lastError}`] });
          }
        }

        if (!imageUrl) {
          console.error('[generate-image] all models failed');
          taskQueue.updateTask(task.id, {
            status: 'failed',
            error: `鎵€鏈夌敓鍥炬ā鍨嬪潎澶辫触锛屾渶鍚庨敊璇? ${lastError}`
          });
          return;
        }

        // ????????????
        memoryAids.image_url = imageUrl;
        memoryAids.download_url = downloadUrl;
        memoryAids.image_generated_at = Date.now();

        db.prepare('UPDATE vocabulary SET memory_aids = ? WHERE id = ?')
          .run(JSON.stringify(memoryAids), row.id);

        taskQueue.updateTask(task.id, {
          status: 'completed',
          result: {
            id: row.id,
            image_url: imageUrl,
            download_url: downloadUrl,
          },
          logs: ['鍥剧墖鐢熸垚涓庡叆搴撳畬鎴?]
        });
      } catch (err) {
        console.error('[generate-image async] Error:', err);
        taskQueue.updateTask(task.id, { status: 'failed', error: formatTtsFetchError(err) });
      }
    });

  } catch (error) {
    console.error('[generate-image] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 澶勭悊鏉愭枡鎻愮函瑙ｆ瀽璇锋眰锛堢湡瀹?Dify 鑱斿姩锛氭壘搴?-> 娓呯┖ -> 涓婁紶 -> 宸ヤ綔娴佹娊鎻愶級
app.post('/api/material/process-and-extract', async (req, res) => {
  const { topic, userId, files, user_current_profile } = req.body;

  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: '鏈彁渚涘彲澶勭悊鐨勪笂浼犳枃浠? });
  }

  const taskQueue = require('./services/taskQueue');
  const taskName = `鏉愭枡鎻愮函: ${files[0]?.fileName || '鏈煡鏂囦欢'}`;
  const task = taskQueue.createTask('material', taskName);

  // 绔嬪嵆杩斿洖 taskId锛屽悗缁湪鍚庡彴寮傛鎵ц
  res.json({ success: true, taskId: task.id, status: task.status });

  // 寮傛鎵ц鏉愭枡涓婁紶涓庣煡璇嗗簱鍐欏叆娴佺▼
  setImmediate(async () => {
    // 鍒涘缓 Dify 鐭ヨ瘑搴撴枃妗ｏ紝杞绱㈠紩鐘舵€侊紝瑙﹀彂鎻愮函宸ヤ綔娴侊紝鍐欏叆鐢熻瘝鏈?    const DATASET_KEY = 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
    const WORKFLOW_KEY = 'app-cArGQg7bAnePU0ts63FoHrAG';
    const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    try {
      taskQueue.updateTask(task.id, {
        status: 'running',
        progress: 5,
        logs: ['[杩涘害] 姝ｅ湪鍒濆鍖栨彁鍙栦换鍔?..']
      });

      // ---------------------------------------------------------
      // 浣跨敤鍥哄畾 ID 鐩存帴璁块棶 Knowleage_Pro_Scenarios 鐭ヨ瘑搴?      // ---------------------------------------------------------
      const datasetId = KNOWLEAGE_PRO_SCENARIOS_DATASET_ID;

      // ---------------------------------------------------------
      // 鎵归噺鍒犻櫎鏃ф枃妗ｏ紙濡傛灉瀛樺湪锛?      // ---------------------------------------------------------
      taskQueue.updateTask(task.id, {
        progress: 20,
        logs: ['[杩涘害] 姝ｅ湪娓呯┖ Knowleage_Pro_Scenarios 鐭ヨ瘑搴?..']
      });
      const docsResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/documents?page=1&limit=100`, {
        headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
      });
      if (!docsResponse.ok) throw new Error(`鑾峰彇鐭ヨ瘑搴撴枃妗ｅ垪琛ㄥけ璐?(HTTP ${docsResponse.status})`);
      const docsData = await docsResponse.json();
      const docIds = docsData.data?.map(d => d.id) || [];

      // 寮傛骞惰鍒犻櫎鎵€鏈夋棫鏂囨。
      if (docIds.length > 0) {
        taskQueue.updateTask(task.id, {
          progress: 30,
          logs: [`[杩涘害] 鍙戠幇宸插瓨鍦?${docIds.length} 涓棫鏂囨。锛屾鍦ㄦ竻绌?..`]
        });
        await Promise.all(docIds.map(async docId => {
          const delRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${docId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
          });
          if (!delRes.ok) console.warn(`[璀﹀憡] 鍒犻櫎鏃ф枃妗?${docId} 澶辫触 (HTTP ${delRes.status})`);
        }));
        taskQueue.updateTask(task.id, {
          progress: 40,
          logs: ['[杩涘害] 鏃ф枃妗ｆ竻绌哄畬鎴?]
        });
      } else {
        taskQueue.updateTask(task.id, {
          progress: 40,
          logs: ['[杩涘害] 鐭ヨ瘑搴撲负绌猴紝鏃犻渶娓呯┖']
        });
      }

      // ---------------------------------------------------------
      // 鍑嗗涓婁紶鏂囦欢鍒?Dify 鐭ヨ瘑搴?      // ---------------------------------------------------------
      taskQueue.updateTask(task.id, {
        progress: 45,
        logs: ['[杩涘害] 姝ｅ湪瑙ｆ瀽 Base64 鏍煎紡鐨勪笂浼犳潗鏂?..']
      });
      const fileObj = files[0];
      const base64Data = fileObj.content || fileObj.base64 || '';
      const base64Content = base64Data.replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');

      // Node 18+ 浣跨敤鍏ㄥ眬 Blob 鏋勯€?FormData锛堝吋瀹规祻瑙堝櫒鍜?Node 鐜锛?      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', blob, fileObj.fileName || 'upload_material.pdf');
      // 浣跨敤 Hierarchical 妯″紡淇濈暀鏂囨。缁撴瀯锛堟+瀛愭锛?      // 閰嶇疆瑙ｆ瀽瑙勫垯锛氶澶勭悊锛堝幓澶氫綑绌烘牸锛夈€佺埗娈佃惤妯″紡銆佸瓙娈靛垎鍓?      formData.append('data', JSON.stringify({
        indexing_technique: 'high_quality',
        doc_form: 'hierarchical_model',
        process_rule: {
          mode: 'hierarchical',
          rules: {
            pre_processing_rules: [
              { id: 'remove_extra_spaces', enabled: true },
              { id: 'remove_urls_emails', enabled: false }
            ],
            parent_mode: 'paragraph',
            segmentation: {
              separator: '\\n',
              max_tokens: 1000
            },
            subchunk_segmentation: {
              separator: '\\n',
              max_tokens: 200
            }
          }
        }
      }));

      taskQueue.updateTask(task.id, {
        progress: 50,
        logs: ['[杩涘害] 姝ｅ湪涓婁紶瑙ｆ瀽鍚庣殑鏉愭枡鍒?Dify 鐭ヨ瘑搴?..']
      });
      const uploadResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/document/create_by_file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DATASET_KEY}` },
        body: formData
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`Dify 鏂囦欢涓婁紶澶辫触: ${errText}`);
      }

      const uploadData = await uploadResponse.json();
      const documentId = uploadData.document?.id;
      const batchId = uploadData.batch;

      if (!documentId || !batchId) {
        throw new Error('鏈兘浠?Dify 鍝嶅簲涓幏鍙?document / batch ID');
      }

      taskQueue.updateTask(task.id, {
        progress: 55,
        logs: [`[杩涘害] 瀵煎叆鏂囨。鎴愬姛 (ID: ${documentId}, Batch: ${batchId})锛屾鍦ㄥ紑濮嬬储寮?..`]
      });

      // ---------------------------------------------------------
      // 杞 Dify 鏂囨。绱㈠紩鐘舵€侊紝绛夊緟鍚戦噺鍖栧畬鎴?      // ---------------------------------------------------------
      let isIndexed = false;
      // 鏈€澶氱瓑寰?100 杞紙姣忚疆 3 绉掞級锛屾€昏 300 绉掞紙5鍒嗛挓锛夎秴鏃?      for (let i = 0; i < 100; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const statusRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${batchId}/indexing-status`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
        });

        if (!statusRes.ok) continue; // 鏈疆鐘舵€佹煡璇㈠け璐ュ垯璺宠繃锛岀户缁笅涓€杞?        const statusData = await statusRes.json();
        // 鑾峰彇鍗曚釜鏂囨。鐨勭储寮曠姸鎬侊紙pending / indexing / completed / error锛?        const docInfo = statusData.data?.[0];

        if (docInfo) {
          taskQueue.updateTask(task.id, {
            progress: Math.min(68, 55 + i),
            logs: [`[杩涘害] 绗?${i + 1} 杞幏鍙?Dify 绱㈠紩鐘舵€? ${docInfo.indexing_status}`]
          });
          if (docInfo.indexing_status === 'completed') {
            isIndexed = true;
            break;
          } else if (docInfo.indexing_status === 'error') {
            throw new Error('Dify 鏂囨。绱㈠紩澶辫触锛岃妫€鏌ヤ笂浼犳枃浠舵垨鐭ヨ瘑搴撻厤缃?);
          }
        }
      }

      if (!isIndexed) {
        throw new Error('Dify indexing timeout (>300s).');
      }

      taskQueue.updateTask(task.id, {
        progress: 70,
        logs: ['[杩涘害] 鐭ヨ瘑搴撴枃妗ｅ悜閲忓寲灏辩华锛屽噯澶囨彁绾?..']
      });

      // --- 灞曠ず鐢ㄦ鏂囷細浼樺厛鏈湴鎶藉彇鍘熸枃锛汥ify 鍒嗘浠呬綔鍥為€€锛堝垎娈垫嫾鎺ヤ細鏀规钀界粨鏋勶級---
      // Dify knowledge create-by-file / hierarchical 鐢ㄤ簬妫€绱㈡彁绾紝涓嶅疁浣滀负闃呰鍣ㄥ睍绀烘簮銆?      let articleText = "";
      let originalText = "";
      const uploadedFileName = fileObj.fileName || '';
      try {
        const isPlainText = /\.(txt|md|text|html|htm)$/i.test(uploadedFileName);
        const isPdf = /\.pdf$/i.test(uploadedFileName) || (!uploadedFileName && buffer.length > 4 && buffer.slice(0, 5).toString() === '%PDF-');

        if (isPlainText && buffer.length > 0) {
          originalText = buffer.toString('utf-8');
          taskQueue.updateTask(task.id, {
            logs: ['[杩涘害] 绾枃鏈潗鏂欙紝宸茬洿鎺ヨВ鐮佷负灞曠ず鍘熸枃']
          });
        } else if (isPdf && buffer.length > 0) {
          const pdfParse = require('pdf-parse');
          const pdfData = await pdfParse(buffer);
          originalText = String(pdfData?.text || '').replace(/\r\n/g, '\n').trim();
          taskQueue.updateTask(task.id, {
            logs: [`[杩涘害] PDF 鏈湴鎶芥枃鏈畬鎴愶紙绾?${originalText.length} 瀛楋級锛岀敤浜庢矇娴稿紡闃呰灞曠ず`]
          });
        }
      } catch (e) {
        console.warn('[Material] 鏈湴鎶藉彇鍘熸枃澶辫触锛屽皢鍥為€€ Dify 鍒嗘:', e.message);
        originalText = '';
        taskQueue.updateTask(task.id, {
          logs: [`[杩涘害] 鏈湴鍘熸枃鎶藉彇澶辫触锛?{e.message}锛夛紝鍥為€€ Dify 鍒嗘鎷兼帴`]
        });
      }

      if (originalText) {
        articleText = originalText;
      } else {
        try {
          const segmentsRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${documentId}/segments`, {
            headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
          });
          if (segmentsRes.ok) {
            const segmentsData = await segmentsRes.json();
            const segments = segmentsData.data || [];
            articleText = segments.map(s => s.content || '').join('\n\n');
          } else {
            console.warn("[Material] 鑾峰彇鏂囨。鍒嗘澶辫触", segmentsRes.status);
          }
        } catch (e) {
          console.error("[Material] 鑾峰彇鏂囨。鍒嗘寮傚父:", e.message);
        }
      }

      // ---------------------------------------------------------
      // 杩愯 Dify 鑻辨枃鍟嗕笟瀹炴垬鏉愭枡鎻愮函宸ヤ綔娴?      // ---------------------------------------------------------
      taskQueue.updateTask(task.id, {
        progress: 75,
        logs: ['[杩涘害] 姝ｅ湪杩愯 Dify 鎻愮函宸ヤ綔娴佹彁鍙栨牳蹇冭瘝鍙?..']
      });
      const wfResponse = await fetch(`${BASE_URL}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WORKFLOW_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {
            topic: topic || 'General Business',
            user_current_profile: user_current_profile || ''
          },
          response_mode: 'blocking',
          user: userId || 'system'
        })
      });

      if (!wfResponse.ok) {
        const errText = await wfResponse.text().catch(() => '');
        throw new Error(`鎻愮函宸ヤ綔娴佸け璐?(HTTP ${wfResponse.status}): ${errText.substring(0, 200)}`);
      }
      const wfData = await wfResponse.json();

      // 浠庡伐浣滄祦 outputs 涓彁鍙栬瘝姹囧拰鍙ュ瀷缁撴灉
      const outputs = wfData?.data?.outputs || {};
      const rawExtracted = outputs.extracted_words || outputs.result || outputs.text || '';

      let extractedItems = [];
      if (Array.isArray(rawExtracted)) {
        extractedItems = rawExtracted;
      } else if (typeof rawExtracted === 'string') {
        // 灏濊瘯灏嗗瓧绗︿覆缁撴灉瑙ｆ瀽涓?JSON 鏍煎紡
        let cleanJson = rawExtracted.trim();
        if (cleanJson.startsWith('\`\`\`json')) cleanJson = cleanJson.substring(7);
        else if (cleanJson.startsWith('\`\`\`')) cleanJson = cleanJson.substring(3);
        if (cleanJson.endsWith('\`\`\`')) cleanJson = cleanJson.substring(0, cleanJson.length - 3);
        cleanJson = cleanJson.trim();
        try {
          const parsed = JSON.parse(cleanJson);
          if (parsed.words && Array.isArray(parsed.words)) extractedItems.push(...parsed.words);
          if (parsed.phrases && Array.isArray(parsed.phrases)) extractedItems.push(...parsed.phrases);
          if (parsed.sentences && Array.isArray(parsed.sentences)) {
            extractedItems.push(...parsed.sentences.map(s => {
              if (typeof s === 'string') return { word: s, is_sentence: true };
              if (typeof s === 'object' && s !== null) {
                if (s.sentence && !s.word) s.word = s.sentence;
                return { ...s, is_sentence: true };
              }
              return s;
            }));
          }
          if (Array.isArray(parsed)) extractedItems = parsed;
        } catch (e) {
          // 瑙ｆ瀽澶辫触鏃舵寜閫楀彿/鎹㈣绮楀垎
          extractedItems = rawExtracted.split(/[,锛屻€乗n]+/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 500);
        }
      }

      // 鏍规嵁 extractedItems 涓瘡椤圭殑 category 瀛楁琛ュ厖甯冨皵鏍囪
      for (const item of extractedItems) {
        if (typeof item === 'object' && item !== null) {
          // 鑻ユā鍨嬪凡缁欏嚭 category锛屽垯鍚屾鍒?is_phrase / is_sentence
          if (item.category === 'word') item.is_phrase = false;
          else if (item.category === 'phrase') item.is_phrase = true;
          else if (item.category === 'sentence') item.is_sentence = true;
        }
      }

      let wordsToReturn = [];
      let phrasesToReturn = [];
      let sentencesToReturn = [];

      // 鎸夎瘝鏁拌鍒欏垎绫?      for (const item of extractedItems) {
        const isObject = typeof item === 'object' && item !== null;
        const wordStr = isObject ? (item.word || item.phrase || item.text || JSON.stringify(item)) : item;
        const cleanStr = String(wordStr).trim();
        if (!cleanStr) continue;

        // 缁熶竴璧拌瘝鏁板垎绫伙紝鍐冲畾鍐欏叆璇?璇嶇粍/鍙ュ瀷
        let dictType = classifyByWordCount(cleanStr);

        if (dictType === 'ai_sentence') {
          sentencesToReturn.push(isObject ? item : cleanStr);
        } else if (dictType === 'ai_phrase') {
          phrasesToReturn.push(isObject ? item : cleanStr);
        } else {
          wordsToReturn.push(isObject ? item : cleanStr);
        }
      }

      // 鍚堝苟璇嶆眹鍜岃瘝缁勶紝鍑嗗鍐欏叆鏁版嵁搴?      const vocabToInsert = [...wordsToReturn, ...phrasesToReturn];

      taskQueue.updateTask(task.id, {
        progress: 85,
        logs: [`[杩涘害] 鎻愬彇鍒?${vocabToInsert.length} 涓瘝姹囧拰 ${sentencesToReturn.length} 涓彞瀛愶紝姝ｅ湪鎺掗噸鍐欏叆 SQLite 鐢熻瘝鏈?..`]
      });

      /**
       * 璁＄畻瀛楃涓蹭腑鐨勮嫳鏂囧崟璇嶆暟锛堢敤浜庡垎绫昏瘝姹?璇嶇粍/鍙ュ瀷锛?       * @param {string} str - 杈撳叆瀛楃涓?       * @returns {number} 鍗曡瘝鏁伴噺
       */
      function countWords(str) {
        if (!str || typeof str !== 'string') return 0;
        return str
          .trim()
          .replace(/[.!?,;:'"()[\]{}]/g, '')   // 鍘绘帀甯歌鏍囩偣
          .split(/\s+/)                           // 鎸夌┖鐧藉垎璇?          .filter(w => w.length > 0)             // 鍘绘帀绌烘
          .length;
      }

      /**
       * 鎸夎嫳鏂囧崟璇嶆暟绮楀垎绫诲瀷
       * - ai_extracted锛氱害 1 涓瘝
       * - ai_phrase锛氳嚦灏?2 涓瘝涓斾笉浠ュ彞鍙风粨灏?       * - ai_sentence锛氫互 . ! ? 缁撳熬涓旇嚦灏?5 涓瘝
       *
       * @param {string} wordStr - 寰呭垎绫绘枃鏈?       * @returns {'ai_extracted'|'ai_phrase'|'ai_sentence'}
       */
      function classifyByWordCount(wordStr) {
        const trimmed = String(wordStr || '').trim();
        if (!trimmed) return 'ai_extracted';

        const wc = countWords(trimmed);
        const endsWithPunctuation = /[.!?]$/.test(trimmed);

        if (wc >= 5 && endsWithPunctuation) {
          return 'ai_sentence';
        } else if (wc >= 2 && !endsWithPunctuation) {
          return 'ai_phrase';
        } else {
          return 'ai_extracted';
        }
      }

      // 鍐欏叆 SQLite
      let addedCount = 0;
      const now = Date.now();
      for (const item of vocabToInsert) {
        const isObject = typeof item === 'object' && item !== null;
        const wordStr = isObject ? (item.word || item.phrase || item.text || JSON.stringify(item)) : String(item);
        if (!wordStr) continue;

        // 鍐嶆鎸夎瘝鏁板垎绫伙紝鍐冲畾 dict_type
        const dictType = classifyByWordCount(wordStr);

        // 缁勮 payload
        let payload = { source: 'Material Upload' };
        if (isObject && item.payload) {
          payload = item.payload;
          if (!payload.source) payload.source = 'Material Upload';
        }
        payload = { ...payload, topic: payload.topic || topic || '' };

        const existing = db.prepare('SELECT id, payload FROM vocabulary WHERE word = ? COLLATE NOCASE').get(wordStr);
        if (!existing) {
          const id = crypto.randomUUID();
          db.prepare(`
            INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, wordStr, dictType, 'business', JSON.stringify(payload), now, now, '[]');
          addedCount++;
        } else {
          // 宸插瓨鍦ㄥ垯浠呭湪 payload 杈冪┖鏃惰鐩栨洿鏂?          let oldPayload = {};
          try { oldPayload = JSON.parse(existing.payload || '{}'); } catch(e) {}
          if (!oldPayload.meaning || Object.keys(oldPayload).length <= 2) {
            db.prepare('UPDATE vocabulary SET dict_type = ?, category = ?, payload = ? WHERE id = ?').run(
              dictType,
              'business',
              JSON.stringify(payload),
              existing.id
            );
          }
        }
      }

      // ===== 鍐欏叆鍙ュ瀷锛坉ict_type = 'ai_sentence'锛?=====
      let addedSentenceCount = 0;
      for (const item of sentencesToReturn) {
        const isObject = typeof item === 'object' && item !== null;
        const sentenceStr = isObject
          ? (item.word || item.sentence || item.text || '')
          : String(item);
        const cleanSent = String(sentenceStr).trim();
        if (!cleanSent || cleanSent.length > 500) continue;

        // 鐢ㄥ墠 50 瀛楃鍋?LIKE 鍓嶇紑鎺掗噸锛岄伩鍏嶉噸澶嶉暱鍙?        const probe = cleanSent.substring(0, 50).replace(/[%_]/g, '\\$&');
        const existingSent = db.prepare(
          "SELECT id FROM vocabulary WHERE dict_type = 'ai_sentence' AND word LIKE ? COLLATE NOCASE"
        ).get(`${probe}%`);
        if (existingSent) continue;

        let sentPayload = { source: 'Material Upload', type: 'sentence', topic: topic || '' };
        if (isObject && item.payload) {
          sentPayload = { ...sentPayload, ...item.payload };
          sentPayload.type = 'sentence';
          if (!sentPayload.source) sentPayload.source = 'Material Upload';
        }

        const id = crypto.randomUUID();
        db.prepare(`
          INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, cleanSent, 'ai_sentence', 'business', JSON.stringify(sentPayload), now, now, '[]');
        addedSentenceCount++;
      }

      // 缁勮瀹屾垚缁撴灉骞舵爣璁颁换鍔″畬鎴?      taskQueue.updateTask(task.id, {
        status: 'completed',
        progress: 100,
        result: {
          success: true,
          topic: topic || 'Unknown Topic',
          total: files.length,
          words: wordsToReturn.map(i => typeof i === 'object' ? (i.word || i.text) : String(i)),
          phrases: phrasesToReturn.map(i => typeof i === 'object' ? (i.word || i.phrase || i.text) : String(i)),
          sentences: sentencesToReturn.map(i => typeof i === 'object' ? (i.word || i.sentence || i.text) : String(i)),
          addedSentenceCount,
          article: articleText,
          originalText: originalText || undefined,
          results: [
            {
              fileName: fileObj.fileName || "Document",
              summary: `Closed loop completed: cleared ${docIds.length} old documents, new file imported successfully. Model extracted ${vocabToInsert.length} terms, actual added ${addedCount} words.`,
              key_points: wordsToReturn.slice(0, 5).map(i => typeof i === 'object' ? (i.word || i.text) : String(i))
            }
          ]
        },
        logs: ['[瀹屾垚] Dify 鎻愮函鍒嗘瀽涓庣敓璇嶆湰鍐欏叆鍏ㄩ儴椤哄埄瀹屾垚锛佽壘瀹炬旦鏂涔犲紩鎿庡凡鍒锋柊']
      });

    } catch (error) {
      console.error('[Material Process Worker Error]:', error);
      taskQueue.updateTask(task.id, {
        status: 'failed',
        progress: 100,
        logs: [`[閿欒] 鎻愮函鍒嗘瀽澶辫触: ${error.message}`]
      });
    }
  });
});// ==========================================
// 娓呯┖浠婃棩閰嶉涓庡綋鏃ユ柊澧炶瘝鏉★紙鐢熻瘝鏈棩娓咃級
// ==========================================
app.post('/api/english/clear-today', (req, res) => {
  const { userId = 'default-user' } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  // ?????????????????????? 00:00:00 ??????
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  try {
    // 1. ?????????????????????????????
    const deleteWords = db.prepare("DELETE FROM vocabulary WHERE added_at >= ? AND (dict_type = 'ai_extracted' OR dict_type = 'ai_phrase')");
    const wordsResult = deleteWords.run(todayStartMs);

    // 2. ????????????????
    const resetQuota = db.prepare("UPDATE daily_vocab_quota SET words_added = 0, phrases_added = 0 WHERE user_id = ? AND quota_date = ?");
    const quotaResult = resetQuota.run(userId, today);

    console.log(`[Clear Today] User ${userId}: deleted ${wordsResult.changes} words/phrases, reset quota for ${today}`);

    return res.json({
      success: true,
      message: 'Successfully cleared today\'s vocabulary entries and reset daily quota.',
      deletedCount: wordsResult.changes,
      quotaReset: quotaResult.changes > 0
    });
  } catch (error) {
    console.error('Failed to clear today\'s data:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 澶氳鑹叉矙鐩橈細English_Oral_Sandbox v10 鏃堕棿 inputs 娉ㄥ叆锛堜笌鍓嶇 profileHelper 瀵归綈锛?// ==========================================
function getOralSystemFormattedTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
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
  const weekdayMap = ['鏄熸湡鏃?, '鏄熸湡涓€', '鏄熸湡浜?, '鏄熸湡涓?, '鏄熸湡鍥?, '鏄熸湡浜?, '鏄熸湡鍏?];
  return `${val('year')}-${val('month')}-${val('day')} ${val('hour')}:${val('minute')}:${val('second')} ${weekdayMap[now.getDay()]}`;
}

function injectOralSystemTime(inputs = {}) {
  const base = typeof inputs === 'object' && inputs !== null ? { ...inputs } : {};
  if (!base._system_time) {
    base._system_time = getOralSystemFormattedTime();
  }
  if (base._system_timestamp_ms == null || base._system_timestamp_ms === '') {
    base._system_timestamp_ms = Date.now();
  }
  if (!base.theme) base.theme = '鍟嗗姟璋堝垽锛氳姝ヤ笌鏂藉帇';
  if (!base.genre) base.genre = 'meeting';
  if (!base.cefr_level) base.cefr_level = 'B1';
  if (!base.duration) base.duration = '15';
  return base;
}

// ==========================================
// 澶氳鑹叉矙鐩橈細涓诲璇濅唬鐞嗭紙English_Oral_Sandbox Chatflow锛?// API Key 浠呬繚瀛樺湪鏈嶅姟绔?DIFY_ORAL_API_KEY
// ==========================================
app.post('/api/english/oral/chat', async (req, res) => {
  const {
    query,
    conversationId = null,
    userId = 'default-user',
    inputs = {},
  } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ message: '缂哄皯 query 鍙傛暟銆? });
  }

  const apiKey = process.env.DIFY_ORAL_API_KEY
    || process.env.VITE_DIFY_ORAL_API_KEY
    || 'app-LfCGgdQrwlGTfegQNYeEzpB9';
  const baseUrl = process.env.DIFY_API_BASE_URL
    || process.env.VITE_DIFY_API_BASE_URL
    || 'https://dify.234124123.xyz/v1';

  try {
    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: injectOralSystemTime(inputs),
        query,
        response_mode: 'blocking',
        user: userId,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[oral/chat] Dify error:', response.status, data);
      return res.status(response.status).json(data);
    }
    return res.json(data);
  } catch (err) {
    console.error('[oral/chat] error:', err);
    return res.status(500).json({ message: err.message || '鍙ｈ娌欑洏瀵硅瘽浠ｇ悊澶辫触' });
  }
});

// ==========================================
// 澶氳鑹叉矙鐩橈細鐮寸唤璇嗗埆鍒ゅ畾锛堣蛋 English_Oral_Sandbox Chatflow锛?// API Key: DIFY_ORAL_API_KEY / VITE_DIFY_ORAL_API_KEY锛堜笌鍙ｈ娌欑洏涓诲璇濈浉鍚岋級
// ==========================================
app.post('/api/english/breakthrough/submit', async (req, res) => {
  const {
    messageId,
    type,
    selectedText,
    conversationId = null,
    flawPoint = '',
    sceneTitle = '',
    userId = 'default-user',
  } = req.body || {};

  if (!selectedText || !type) {
    return res.status(400).json({ correct: false, feedback: '缂哄皯鍒掕瘝鍐呭鎴栫牬缁界被鍨嬨€? });
  }

  const typeLabels = {
    logic: '閫昏緫鐮寸唤',
    fact: '浜嬪疄鐭涚浘',
    intent: '鎰忓浘閬块噸',
  };

  const apiKey = process.env.DIFY_ORAL_API_KEY
    || process.env.VITE_DIFY_ORAL_API_KEY
    || 'app-LfCGgdQrwlGTfegQNYeEzpB9';
  const baseUrl = process.env.DIFY_API_BASE_URL
    || process.env.VITE_DIFY_API_BASE_URL
    || 'https://dify.234124123.xyz/v1';

  const query = `[绯荤粺鎸囦护锛氱牬缁借瘑鍒垽瀹?鈥?浠呰緭鍑?JSON锛屼笉瑕?Markdown]
鍦烘櫙锛?{sceneTitle || '澶氳鑹叉矙鐩?}
娑堟伅ID锛?{messageId || 'unknown'}
鐢ㄦ埛鍒掕瘝锛?{String(selectedText).slice(0, 500)}
鐢ㄦ埛鏍囪绫诲瀷锛?{typeLabels[type] || type}
AI 鍩嬭鐮寸唤锛坒law_point锛夛細${String(flawPoint).slice(0, 800)}

鍒ゅ畾瑙勫垯锛?1. 鐢ㄦ埛鍒掕瘝鏄惁瑕嗙洊鎴栨寚鍚?flaw_point 涓殑鍏抽敭鐭涚浘鐗囨锛?2. 鐢ㄦ埛閫夋嫨鐨勭牬缁界被鍨嬶紙logic/fact/intent锛夋槸鍚︿笌 flaw_point 鎻忚堪鐨勮艾璇被鍨嬩竴鑷淬€?
鍙緭鍑轰竴琛屽悎娉?JSON锛歿"correct":true鎴杅alse,"feedback":"涓嶈秴杩?0瀛楃殑涓枃璇存槑"}`;

  try {
    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: injectOralSystemTime({
          scene_title: sceneTitle || '澶氳鑹叉矙鐩?,
          role_judgement: type,
          intent_judgement: 'breakthrough_audit',
        }),
        query,
        response_mode: 'blocking',
        user: userId,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[breakthrough/submit] Dify error:', response.status, data);
      return res.status(response.status).json({
        correct: false,
        feedback: data.message || data.error || `Dify 鍒ゅ畾澶辫触 (${response.status})`,
      });
    }

    const rawAnswer = String(data.answer || data.message || '').trim();
    const jsonText = rawAnswer.replace(/```json/g, '').replace(/```/g, '').trim();
    let parsed = null;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      const match = jsonText.match(/\{[\s\S]*"correct"[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
      }
    }

    if (parsed && typeof parsed.correct === 'boolean') {
      return res.json({
        correct: parsed.correct,
        feedback: String(parsed.feedback || (parsed.correct ? '鐮寸唤鏍囪姝ｇ‘銆? : '鐮寸唤绫诲瀷涓嶅尮閰嶃€?)),
      });
    }

    // Dify 鏈繑鍥?JSON 鏃跺仛鏈湴鍥為€€
    const flaw = String(flawPoint).toLowerCase();
    const selection = String(selectedText).toLowerCase();
    const typeKeywords = {
      logic: ['causal', 'fallacy', 'overgeneral', 'equivalence', 'logic', '鍥犳灉', '浠ュ亸姒傚叏', '铏氬亣'],
      fact: ['contradict', 'vague', 'data', 'fact', 'factual_vague', '鐭涚浘', '妯＄硦', '鏁版嵁'],
      intent: ['evad', 'avoid', 'shift', 'intent', 'intent_evade', '閬块噸', '鎺ㄨ', '杞Щ'],
    };
    const typeMatch = (typeKeywords[type] || []).some((kw) => flaw.includes(kw));
    const textOverlap = selection.length >= 3 && (
      flaw.includes(selection.slice(0, Math.min(20, selection.length)))
      || selection.split(/\s+/).some((w) => w.length > 4 && flaw.includes(w))
    );
    const correct = Boolean(flaw && flaw !== '鏈瘑鍒埌鐮寸唤' && (typeMatch || textOverlap));

    return res.json({
      correct,
      feedback: correct
        ? '宸茶瘑鍒牬缁斤紙鏈湴鍥為€€鍒ゅ畾锛夛紝璇风敤鑻辫鍙戣捣閽堝鎬ф彁闂€?
        : '鏍囪涓?AI 鍩嬭鐮寸唤涓嶅尮閰嶏紝璇烽噸鏂板垝璇嶃€?,
    });
  } catch (err) {
    console.error('[breakthrough/submit] error:', err);
    return res.status(500).json({ correct: false, feedback: '鐮寸唤鍒ゅ畾鏈嶅姟寮傚父锛岃绋嶅悗閲嶈瘯銆? });
  }
});

const WORD_DAILY_LIMIT = 50;
const PHRASE_DAILY_LIMIT = 30;

// ???????? extraction tasks
const extractionTasks = new Map();

// ????????????????????????????????????
setInterval(() => {
  const now = Date.now();
  for (const [taskId, task] of extractionTasks.entries()) {
    if (now - task.createdAt > 2 * 60 * 60 * 1000) { // 瓒呰繃2灏忔椂娓呯悊
      extractionTasks.delete(taskId);
    }
  }
}, 60 * 60 * 1000);

// ????????????????????
app.get('/api/english/daily-extract/status/:taskId', (req, res) => {
  const taskId = req.params.taskId;
  const task = extractionTasks.get(taskId);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found or expired.' });
  }
  
  if (task.status === 'pending') {
    return res.json({ success: true, status: 'pending' });
  } else if (task.status === 'failed') {
    return res.json({ success: false, status: 'failed', error: task.error });
  } else if (task.status === 'completed') {
    return res.json({
      success: true,
      status: 'completed',
      ...task.payload
    });
  }
});

const handleGetDailyExtractArticle = (req, res) => {
  try {
    const rawUserId = req.query.userId || 'default-user';
    const genre = String(req.query.genre || 'meeting').trim();
    const cefrLevel = String(req.query.cefrLevel || 'B1').trim();
    const duration = String(req.query.duration || '1').trim();
    const topic = String(req.query.topic || req.query.theme || '').trim();
    const today = dailyPackService.getPackDate();

    const userIds = [rawUserId];
    if (rawUserId === 'lzhmy') userIds.push('lzhumy');
    if (rawUserId === 'lzhumy') userIds.push('lzhmy');

    // L1: 涓庣敓鎴愬悓婧愰噸绠?history/flaws/profile锛堝墠绔彲鍙紶 theme锛?    let historyExclude = String(req.query.historyExclude || '').trim();
    let userFlaws = String(req.query.userFlaws || '').trim();
    const userCurrentProfile = String(
      req.query.userCurrentProfile
      || dailyPackService.getUserCurrentProfile(db, rawUserId)
      || '',
    ).trim();

    if (topic && !historyExclude) {
      try {
        const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
        const historyRows = db.prepare(`
          SELECT keywords FROM generation_history
          WHERE user_id = ? AND theme = ? AND generated_at > ?
          ORDER BY generated_at DESC
        `).all(rawUserId, topic, cutoff);
        const allKeywords = [];
        for (const row of historyRows) {
          try {
            const kw = JSON.parse(row.keywords || '[]');
            if (Array.isArray(kw)) allKeywords.push(...kw);
          } catch {}
        }
        historyExclude = [...new Set(allKeywords)].slice(0, 30).join(', ');
      } catch (_) {}
    }
    if (topic && !userFlaws) {
      try {
        const session = db.prepare(`
          SELECT extra_json FROM training_sessions
          WHERE user_id = ? ORDER BY training_date DESC LIMIT 1
        `).get(rawUserId);
        if (session?.extra_json) {
          const extra = JSON.parse(session.extra_json);
          const ef = extra.englishFoundation || {};
          const flaws = [];
          if (ef.pronunciationNotes) flaws.push(`鍙戦煶闂: ${ef.pronunciationNotes}`);
          if (ef.grammarNotes) flaws.push(`璇硶闂: ${ef.grammarNotes}`);
          userFlaws = flaws.join('; ');
        }
      } catch (_) {}
    }

    const inputSignature = dailyPackService.computeListenArticleInputSignature({
      theme: topic,
      genre,
      cefrLevel,
      duration,
      historyExclude,
      userFlaws,
      userCurrentProfile,
    });

    let row = null;
    if (topic) {
      row = db.prepare(`
        SELECT * FROM daily_extracted_articles
        WHERE user_id IN (${userIds.map(() => '?').join(',')})
          AND quota_date = ?
          AND theme = ?
          AND genre = ?
          AND cefr_level = ?
          AND (duration = ? OR duration = ?)
          AND COALESCE(input_signature, '') = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(...userIds, today, topic, genre, cefrLevel, duration, Number(duration), inputSignature);
    }

    let cacheSource = 'daily_extracted_articles';

    if (!row && topic) {
      const listenHistory = dailyPackService.getHistoryExclude(db);
      const listenSig = dailyPackService.computeListenArticleInputSignature({
        theme: topic,
        genre,
        cefrLevel,
        duration,
        historyExclude: listenHistory,
        userFlaws: '',
        userCurrentProfile,
      });
      const sigCandidates = [...new Set([inputSignature, listenSig])];
      for (const sig of sigCandidates) {
        const listen = db.prepare(`
          SELECT * FROM daily_listen_articles
          WHERE user_id IN (${userIds.map(() => '?').join(',')})
            AND pack_date = ?
            AND theme = ?
            AND genre = ?
            AND cefr_level = ?
            AND (duration = ? OR duration = ?)
            AND COALESCE(input_signature, '') = ?
            AND status = 'ready'
          ORDER BY updated_at DESC LIMIT 1
        `).get(...userIds, today, topic, genre, cefrLevel, Number(duration), duration, sig);
        if (listen) {
          let words = [];
          let phrases = [];
          try {
            words = listen.vocab_json ? JSON.parse(listen.vocab_json) : [];
          } catch (_) {}
          try {
            phrases = listen.phrases_json ? JSON.parse(listen.phrases_json) : [];
          } catch (_) {}
          row = {
            article: listen.body_text || '',
            words_json: JSON.stringify(words),
            phrases_json: JSON.stringify(phrases),
            sentences_json: '[]',
            theme: listen.theme || topic,
            genre: listen.genre,
            cefr_level: listen.cefr_level,
            duration: listen.duration,
            input_signature: listen.input_signature || sig,
            updated_at: listen.updated_at,
          };
          cacheSource = 'daily_listen_articles';
          break;
        }
      }
    }

    if (!row) {
      return res.json({ success: true, found: false, cacheSource: null });
    }

    let words = [];
    let phrases = [];
    let sentences = [];
    try { words = row.words_json ? JSON.parse(row.words_json) : []; } catch {}
    try { phrases = row.phrases_json ? JSON.parse(row.phrases_json) : []; } catch {}
    try { sentences = row.sentences_json ? JSON.parse(row.sentences_json) : []; } catch {}

    const dataPayload = {
      article: row.article || '',
      words,
      phrases,
      sentences,
      theme: row.theme || topic || '',
      genre: row.genre,
      cefrLevel: row.cefr_level,
      duration: String(row.duration),
      inputSignature: row.input_signature,
      updatedAt: row.updated_at,
      cacheSource,
    };

    return res.json({
      success: true,
      found: true,
      data: dataPayload
    });
  } catch (error) {
    console.error('[Daily Extract Article Error]', error);
    res.status(500).json({ success: false, found: false, error: error.message });
  }
};

app.get('/api/english/daily-extract/article', handleGetDailyExtractArticle);
app.get('/api/english/daily-extract/article/exact', handleGetDailyExtractArticle);

// 鍓嶅彴鍙戣捣 daily-extract 鐢熸垚璇锋眰锛屽垱寤?taskId 鍚庡紓姝ュ悗鍙拌繍琛?app.post('/api/english/daily-extract', async (req, res) => {
  const { topic, materialText, userId = 'default-user', cefrLevel = 'B1', genre = 'meeting', duration = '25', user_current_profile } = req.body;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // Step 1: ????????????????????????
    let quotaRow = db.prepare(
      'SELECT * FROM daily_vocab_quota WHERE user_id = ? AND quota_date = ?'
    ).get(userId, today);

    if (!quotaRow) {
      const id = crypto.randomUUID();
      const now = Date.now();
      db.prepare(`
        INSERT INTO daily_vocab_quota (id, user_id, quota_date, words_added, phrases_added, created_at, updated_at)
        VALUES (?, ?, ?, 0, 0, ?, ?)
      `).run(id, userId, today, now, now);
      quotaRow = db.prepare(
        'SELECT * FROM daily_vocab_quota WHERE user_id = ? AND quota_date = ?'
      ).get(userId, today);
    }

    const wordsLeft = WORD_DAILY_LIMIT - (quotaRow.words_added || 0);
    const phrasesLeft = PHRASE_DAILY_LIMIT - (quotaRow.phrases_added || 0);

    // Step 2: ?????????
    if (wordsLeft <= 0 && phrasesLeft <= 0) {
      return res.json({
        success: false,
        quotaExceeded: true,
        message: 'Today\'s quota has been exhausted. Please try again tomorrow.',
        quota: {
          wordsLimit: WORD_DAILY_LIMIT,
          wordsUsed: quotaRow.words_added || 0,
          wordsLeft: 0,
          phrasesLimit: PHRASE_DAILY_LIMIT,
          phrasesUsed: quotaRow.phrases_added || 0,
          phrasesLeft: 0,
        }
      });
    }
    
    // ??????????????????????????
    const inputText = materialText?.trim() || topic || '';
    if (!inputText) {
      return res.json({
        success: true,
        message: 'No input text provided, returned current quota status.',
        quota: {
          wordsLimit: WORD_DAILY_LIMIT,
          wordsUsed: quotaRow.words_added || 0,
          wordsLeft,
          phrasesLimit: PHRASE_DAILY_LIMIT,
          phrasesUsed: quotaRow.phrases_added || 0,
          phrasesLeft,
        },
        words: [],
        phrases: [],
      });
    }

    // Step 3: ????????????????????
    const taskId = crypto.randomUUID();
    extractionTasks.set(taskId, {
      status: 'pending',
      createdAt: Date.now()
    });

    res.json({
      success: true,
      taskId,
      message: 'Extraction task started asynchronously.'
    });

    // ??????????????
    runDailyExtractAsync(taskId, req.body, wordsLeft, phrasesLeft, quotaRow, today).catch(e => {
      console.error('[Daily Extract Async] Unhandled error:', e);
      extractionTasks.set(taskId, { status: 'failed', error: e.message || 'Unknown error occurred in background task.', createdAt: Date.now() });
    });

  } catch (error) {
    console.error('[Daily Extract] Initial Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// ????????????????
async function runDailyExtractAsync(taskId, requestBody, wordsLeft, phrasesLeft, quotaRow, today) {
  const { topic, materialText, userId = 'default-user', cefrLevel = 'B1', genre = 'meeting', duration = '25', user_current_profile, _system_time, _system_timestamp_ms } = requestBody;
  
  try {
    // ????????????????? (history_exclude) ????????? (user_flaws)
    let historyExclude = '';
    try {
      const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const historyRows = db.prepare(`
        SELECT keywords FROM generation_history 
        WHERE user_id = ? AND theme = ? AND generated_at > ?
        ORDER BY generated_at DESC
      `).all(userId, topic, cutoff);
      
      const allKeywords = [];
      for (const row of historyRows) {
        try {
          const kw = JSON.parse(row.keywords || '[]');
          if (Array.isArray(kw)) {
            allKeywords.push(...kw);
          }
        } catch {}
      }
      historyExclude = [...new Set(allKeywords)].slice(0, 30).join(', ');
    } catch (e) {
      console.warn('[Daily Extract] 鏋勫缓鍘婚噸涓婁笅鏂囧け璐?', e.message);
    }

    let userFlaws = '';
    try {
      const session = db.prepare(`
        SELECT extra_json FROM training_sessions 
        WHERE user_id = ? 
        ORDER BY training_date DESC LIMIT 1
      `).get(userId);
      
      if (session?.extra_json) {
        const extra = JSON.parse(session.extra_json);
        const ef = extra.englishFoundation || {};
        const flaws = [];
        if (ef.pronunciationNotes) flaws.push(`鍙戦煶闂: ${ef.pronunciationNotes}`);
        if (ef.grammarNotes) flaws.push(`璇硶闂: ${ef.grammarNotes}`);
        userFlaws = flaws.join('; ');
      }
    } catch (e) {
      console.warn('[Daily Extract] 鏋勫缓钖勫急鐐逛笂涓嬫枃澶辫触:', e.message);
    }

    const difyApiKey = process.env.DIFY_ENGLISH_MASTERY_KEY || process.env.VITE_DIFY_ENGLISH_MASTERY_KEY || 'app-OShKY1EcVuLFkuxrpO28ZB0A';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    let wfResponse;
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 10 * 60 * 1000); // 10鍒嗛挓瓒呮椂

    try {
      wfResponse = await fetch(`${baseUrl}/chat-messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${difyApiKey}`,
          "Content-Type": "application/json",
        },
        signal: fetchController.signal,
        body: JSON.stringify({
          inputs: injectOralSystemTime({
            theme: topic || "General Business",
            cefr_level: cefrLevel,
            genre: genre,
            duration: String(duration),
            history_exclude: historyExclude,
            user_flaws: userFlaws,
            user_current_profile: user_current_profile || '',
            _system_time,
            _system_timestamp_ms,
          }),
          query: "generate",
          response_mode: "streaming",
          user: userId,
        }),
      });
      clearTimeout(fetchTimeout);
    } catch (fetchErr) {
      clearTimeout(fetchTimeout);
      console.error("[Daily Extract] Dify fetch 璇锋眰鍙戣捣澶辫触:", fetchErr);
      extractionTasks.set(taskId, { status: 'failed', error: `Dify 鏈嶅姟璇锋眰澶辫触: ${fetchErr.message}`, createdAt: Date.now() });
      return;
    }

    if (!wfResponse.ok) {
      const errText = await wfResponse.text();
      console.error("[Daily Extract] Dify HTTP error:", errText);
      extractionTasks.set(taskId, {
        status: 'failed',
        error: formatDifyModelError(errText || `HTTP ${wfResponse.status}`),
        createdAt: Date.now(),
      });
      return;
    }

    let answer = "";
    let streamError = "";
    const decoder = new TextDecoder();
    let sseBuffer = "";

    const parseSSELines = (text) => {
      sseBuffer += text;
      let lineEnd = sseBuffer.indexOf('\n');
      while (lineEnd !== -1) {
        const line = sseBuffer.substring(0, lineEnd).trim();
        sseBuffer = sseBuffer.substring(lineEnd + 1);
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.event === 'error' || parsed.status === 'error') {
              streamError = parsed.message || parsed.error || JSON.stringify(parsed);
            }
            if (parsed.message && /Server Unavailable|ConnectTimeout|\[models\]/i.test(String(parsed.message))) {
              streamError = String(parsed.message);
            }
            if (typeof parsed.answer === 'string' && parsed.answer) {
              answer = mergeStreamAnswer(answer, parsed.answer);
            }
          } catch (e) {}
        }
        lineEnd = sseBuffer.indexOf('\n');
      }
    };

    if (wfResponse.body) {
      if (typeof wfResponse.body.getReader === 'function') {
        const reader = wfResponse.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            parseSSELines(chunk);
          }
        } catch (readErr) {
          console.error("[Daily Extract] 寮鸿璇诲彇娴佸け璐?", readErr);
          extractionTasks.set(taskId, { status: 'failed', error: `鏁版嵁娴佽鍙栧紓甯? ${readErr.message}`, createdAt: Date.now() });
          return;
        }
      } else {
        try {
          for await (const chunk of wfResponse.body) {
            const chunkText = decoder.decode(chunk, { stream: true });
            parseSSELines(chunkText);
          }
        } catch (readErr) {
          console.error("[Daily Extract] 寮鸿璇诲彇娴佸け璐?", readErr);
          extractionTasks.set(taskId, { status: 'failed', error: `鏁版嵁娴佽鍙栧紓甯? ${readErr.message}`, createdAt: Date.now() });
          return;
        }
      }
      
      if (sseBuffer.trim().startsWith("data: ")) {
        const line = sseBuffer.trim();
        const dataStr = line.slice(6).trim();
        if (dataStr !== "[DONE]") {
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.event === 'error' || parsed.status === 'error') {
              streamError = parsed.message || parsed.error || JSON.stringify(parsed);
            }
            if (typeof parsed.answer === 'string' && parsed.answer) {
              answer = mergeStreamAnswer(answer, parsed.answer);
            }
          } catch (e) {}
        }
      }
    } else {
      extractionTasks.set(taskId, { status: 'failed', error: "Streaming not supported by Dify backend", createdAt: Date.now() });
      return;
    }

    if (streamError) {
      extractionTasks.set(taskId, {
        status: 'failed',
        error: formatDifyModelError(streamError),
        createdAt: Date.now(),
      });
      return;
    }

    let articleText = "";
    let rawVocabText = "";
    
    if (answer.includes("---VOCAB_JSON_START---")) {
      const parts = answer.split("---VOCAB_JSON_START---");
      articleText = parts[0].trim();
      rawVocabText = parts[1].trim();
    } else {
      articleText = answer;
      rawVocabText = "";
    }

    if (!articleText.trim()) {
      extractionTasks.set(taskId, {
        status: 'failed',
        error: formatDifyModelError(answer || 'Dify 娴佸紡鍝嶅簲涓虹┖锛屾湭鐢熸垚闀挎枃姝ｆ枃'),
        createdAt: Date.now(),
      });
      return;
    }
    
    let parsedVocab = [];
    let parsedPhrases = [];
    if (rawVocabText) {
      try {
        let cleanJson = rawVocabText.trim();
        if (cleanJson.toLowerCase().startsWith("```json")) {
          cleanJson = cleanJson.substring(7);
        } else if (cleanJson.startsWith("```")) {
          cleanJson = cleanJson.substring(3);
        }
        if (cleanJson.endsWith("```")) {
          cleanJson = cleanJson.substring(0, cleanJson.length - 3);
        }
        cleanJson = cleanJson.trim();
        
        const parsed = JSON.parse(cleanJson);
        if (parsed.words && Array.isArray(parsed.words)) {
          parsedVocab = parsed.words;
        } else if (Array.isArray(parsed)) {
          parsedVocab = parsed;
        }
        if (parsed.phrases && Array.isArray(parsed.phrases)) {
          parsedPhrases = parsed.phrases;
        }
        if (parsed.sentences && Array.isArray(parsed.sentences)) {
          parsedVocab.push(...parsed.sentences.map(s => {
            if (typeof s === 'string') return { word: s, is_sentence: true };
            if (typeof s === 'object' && s !== null) {
              if (s.sentence && !s.word) s.word = s.sentence;
              return { ...s, is_sentence: true };
            }
            return s;
          }));
        }
      } catch(e) {
        console.error("[Daily Extract] Failed to parse vocab JSON:", e);
      }
    }

    const vocabList = parsedVocab.map(item => {
      if (typeof item === 'string') return { word: item };
      if (typeof item === 'object' && item !== null) {
        const payload = item.payload || {};
        return {
          word: item.word || item.name || '',
          phonetic: payload.phonetic || item.phonetic || '',
          partOfSpeech: payload.partOfSpeech || payload.part_of_speech || item.partOfSpeech || item.part_of_speech || '',
          meaning: payload.meaning || payload.zh_meaning || item.meaning || item.zh_meaning || '',
          definition_en: payload.definition_en || payload.definitionEn || item.definition_en || item.definitionEn || '',
          business_note: payload.business_note || payload.businessNote || item.business_note || item.businessNote || '',
          examples: payload.examples || item.examples || [],
          is_sentence: item.is_sentence || false
        };
      }
      return { word: String(item) };
    }).filter(x => x.word);

    const sentenceList = [];
    for (const item of vocabList) {
      if (item && Array.isArray(item.examples)) {
        sentenceList.push(...item.examples);
      }
      const w = item.word ? item.word.trim() : '';
      const isSentenceHeuristic = w.length > 30 && (/[.!?銆傦紒锛焆$/.test(w) || w.split(' ').length >= 5);
      
      if (item.is_sentence || isSentenceHeuristic) {
        sentenceList.push(item.word);
        item.is_sentence = true; // Mark as sentence so it doesn't go to wordsToStore
      }
    }

    const rawPhrases = parsedPhrases || [];
    const phraseList = [];
    if (Array.isArray(rawPhrases)) {
      for (const p of rawPhrases) {
        const text = typeof p === 'string' ? p : (p.phrase || p.phrase_text || p.sentence || p.text || "");
        if (text) {
           const cleanText = text.trim();
           const isSentenceHeuristic = cleanText.length > 30 && (/[.!?銆傦紒锛焆$/.test(cleanText) || cleanText.split(' ').length >= 5);
           if (isSentenceHeuristic || p.is_sentence) {
             sentenceList.push(cleanText);
           } else {
             phraseList.push(cleanText);
           }
        }
      }
    }

    const uniquePhraseList = [...new Set(phraseList)].filter(s => s);
    const uniqueSentenceList = [...new Set(sentenceList)].filter(s => s);

    const wordsToStore = vocabList.filter(v => !v.is_sentence).slice(0, wordsLeft);
    const phrasesToStore = uniquePhraseList.slice(0, phrasesLeft);

    let wordsAddedCount = 0;
    const now = Date.now();
    const insertWord = db.transaction((words) => {
      for (const item of words) {
        const w = item.word.trim();
        if (!w || w.length > 100) continue;
        const existing = db.prepare('SELECT id FROM vocabulary WHERE word = ? COLLATE NOCASE').get(w);
        if (!existing) {
          const id = crypto.randomUUID();
          const payload = {
            phonetic: item.phonetic || '',
            partOfSpeech: item.partOfSpeech || '',
            meaning: item.meaning || '',
            definition_en: item.definition_en || '',
            business_note: item.business_note || '',
            examples: item.examples || [],
            source: 'Daily Extract',
            topic
          };
          db.prepare(`
            INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, w, 'ai_extracted', 'business', JSON.stringify(payload), now, now, '[]');
          wordsAddedCount++;
        }
      }
    });
    insertWord(wordsToStore);

    let phrasesAddedCount = 0;
    const insertPhrase = db.transaction((phrases) => {
      for (const phraseStr of phrases) {
        const p = typeof phraseStr === 'string' ? phraseStr.trim() : String(phraseStr);
        if (!p || p.length > 500) continue;
        const existingPhrase = db.prepare(
          "SELECT id FROM vocabulary WHERE dict_type = 'ai_phrase' AND payload LIKE ? COLLATE NOCASE"
        ).get(`%${p.substring(0, 50)}%`);
        if (!existingPhrase) {
          const id = crypto.randomUUID();
          db.prepare(`
            INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, p, 'ai_phrase', 'business', JSON.stringify({ source: 'Daily Extract', topic, type: 'phrase' }), now, now, '[]');
          phrasesAddedCount++;
        }
      }
    });
    insertPhrase(phrasesToStore);

    let sentencesAddedCount = 0;
    const insertSentence = db.transaction((sentences) => {
      for (const sentStr of sentences) {
        const s = typeof sentStr === 'string' ? sentStr.trim() : String(sentStr);
        if (!s || s.length > 500) continue;
        const probe = s.substring(0, 50).replace(/[%_]/g, '\\$&');
        const existingSent = db.prepare(
          "SELECT id FROM vocabulary WHERE dict_type = 'ai_sentence' AND word LIKE ? COLLATE NOCASE"
        ).get(`${probe}%`);

        if (!existingSent) {
          const id = crypto.randomUUID();
          db.prepare(`
            INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, s, 'ai_sentence', 'business', JSON.stringify({ source: 'Daily Extract', topic, type: 'sentence' }), now, now, '[]');
          sentencesAddedCount++;
        }
      }
    });
    insertSentence(uniqueSentenceList);

    db.prepare(`
      UPDATE daily_vocab_quota
      SET words_added = words_added + ?, phrases_added = phrases_added + ?, last_extraction_at = ?, updated_at = ?
      WHERE user_id = ? AND quota_date = ?
    `).run(wordsAddedCount, phrasesAddedCount, now, now, userId, today);

    const updatedWordsUsed = (quotaRow.words_added || 0) + wordsAddedCount;
    const updatedPhrasesUsed = (quotaRow.phrases_added || 0) + phrasesAddedCount;

    try {
      const genId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO generation_history (id, user_id, theme, generated_at, article_summary, keywords)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        genId,
        userId,
        topic || 'General Business',
        Date.now(),
        (articleText || '').substring(0, 100),
        JSON.stringify(wordsToStore.map(w => w.word))
      );
    } catch (e) {
      console.warn('[Daily Extract] 鏋勫缓鍘婚噸涓婁笅鏂囧け璐?', e.message);
    }

    console.log(`[Daily Extract Async] Completed ${taskId}. User ${userId} ${today} added ${wordsAddedCount} words.`);

    const finalPayload = {
      message: `Extraction complete: added ${wordsAddedCount} words, ${phrasesAddedCount} phrases, ${sentencesAddedCount} sentences.`,
      quota: {
        wordsLimit: WORD_DAILY_LIMIT,
        wordsUsed: updatedWordsUsed,
        wordsLeft: Math.max(0, WORD_DAILY_LIMIT - updatedWordsUsed),
        phrasesLimit: PHRASE_DAILY_LIMIT,
        phrasesUsed: updatedPhrasesUsed,
        phrasesLeft: Math.max(0, PHRASE_DAILY_LIMIT - updatedPhrasesUsed),
      },
      words: wordsToStore.map(w => w.word),
      phrases: phrasesToStore,
      sentences: uniqueSentenceList,
      article: articleText,
      wordCount: wordsToStore.length,
      phraseCount: phrasesToStore.length,
      sentenceCount: uniqueSentenceList.length,
      wordsAddedCount,
      phrasesAddedCount,
      sentencesAddedCount
    };

    // 淇濆瓨鑷?daily_extracted_articles 鐗╃悊鎸佷箙搴?    try {
      const artId = crypto.randomUUID();
      const durationVal = requestBody?.duration ? String(requestBody.duration) : (duration ? String(duration) : '25');
      const profileForSig = String(user_current_profile || dailyPackService.getUserCurrentProfile(db, userId) || '').trim();
      const sigVal = dailyPackService.computeListenArticleInputSignature({
        theme: topic || 'General Business',
        genre: genre || 'meeting',
        cefrLevel: cefrLevel || 'B1',
        duration: durationVal,
        historyExclude,
        userFlaws,
        userCurrentProfile: profileForSig,
      });
      
      const insertArtStmt = db.prepare(`
        INSERT OR REPLACE INTO daily_extracted_articles (id, user_id, quota_date, theme, genre, cefr_level, article, words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertArtStmt.run(
        artId,
        userId,
        today,
        topic || 'General Business',
        genre || 'meeting',
        cefrLevel || 'B1',
        articleText || '',
        JSON.stringify(wordsToStore),
        JSON.stringify(phrasesToStore),
        JSON.stringify(uniqueSentenceList),
        durationVal,
        sigVal,
        now,
        now
      );

      const savedArtRow = {
        id: artId,
        user_id: userId,
        quota_date: today,
        theme: topic || 'General Business',
        genre: genre || 'meeting',
        cefr_level: cefrLevel || 'B1',
        duration: durationVal,
        article_text: articleText || '',
        extracted_words_json: JSON.stringify(wordsToStore),
        extracted_phrases_json: JSON.stringify(phrasesToStore),
      };

      // 鍗虫椂鑱斿姩锛氬墠鍙伴噸鏂扮敓鎴愰暱鏂囨椂锛屽悗鍙板悓姝ユ洿鏂板苟閲嶆柊鍚堟垚璇ョ粍鍚堢殑绮惧惉 .mp3 闊抽 (Option A)
      (async () => {
        try {
          await dailyListenPreGenerateService.syncAudioFromLongArticleRow(db, savedArtRow, 'manual');
        } catch (syncAudioErr) {
          console.warn('[Daily Extract] 鍗虫椂鍚屾绮惧惉闊抽璀﹀憡:', syncAudioErr.message);
        }
      })().catch(e => console.error('[Daily Extract] 绮惧惉闊抽鍚屾寮傚父:', e));

    } catch (dbSaveErr) {
      console.warn('[Daily Extract] 淇濆瓨 daily_extracted_articles 澶辫触 (闈為樆濉?:', dbSaveErr.message);
    }

    extractionTasks.set(taskId, {
      status: 'completed',
      payload: finalPayload,
      createdAt: Date.now()
    });

  } catch (error) {
    console.error('[Daily Extract Async] Global Error:', error);
    extractionTasks.set(taskId, {
      status: 'failed',
      error: error.message || 'Unknown error',
      createdAt: Date.now()
    });
  }
}


// Daily pack: theme sync + cached wakeup/flaw vocab
app.put('/api/user/theme', (req, res) => {
  try {
    const { userId = 'default-user', theme } = req.body || {};
    if (!theme || !String(theme).trim()) {
      return res.status(400).json({ success: false, error: 'theme is required' });
    }
    const row = dailyPackService.upsertUserTheme(db, userId, theme);
    res.json({ success: true, ...row });
  } catch (error) {
    console.error('[User Theme Sync]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/user/login-ping', (req, res) => {
  try {
    const userId = req.body?.userId;
    const theme = req.body?.theme || '鍟嗗姟璋堝垽锛氳姝ヤ笌鏂藉帇';
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    // 1. 璁板綍鐧诲綍鏃ュ織
    const result = dailyListenPreGenerateService.recordUserLogin(db, userId);

    // 2. 鑷姩灏嗗墠鍙扮敤鎴疯緭鍏ョ殑鐢ㄦ埛鍚嶄笌鍏朵富棰樺啓鍏?user_theme_prefs 鐗╃悊琛?    dailyPackService.upsertUserTheme(db, userId, theme);

    // N1: 鐧诲綍涓嶅啀瑙﹀彂寮傛琛ヨ窇锛涚己鍖呯敱鎵嬪姩鐢熸垚鎴?02:00 cron 璐熻矗
    res.json({ success: true, catchupScheduled: false, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/daily-pack/today', (req, res) => {
  try {
    const rawUserId = req.query.userId || 'default-user';
    const theme = String(req.query.theme || '鍟嗗姟璋堝垽锛氳姝ヤ笌鏂藉帇').trim();
    const historyExclude = String(req.query.historyExclude || '').trim();
    const userCurrentProfile = String(req.query.userCurrentProfile || '').trim();

    // 鍏奸【璐﹀彿鍒悕
    const userIds = [rawUserId];
    if (rawUserId === 'lzhmy') userIds.push('lzhumy');
    if (rawUserId === 'lzhumy') userIds.push('lzhmy');

    // 鑷姩淇濋殰鍓嶅彴鐢ㄦ埛鍙婂叾閫夋嫨鐨勪富棰樺啓鍏?user_theme_prefs 鐗╃悊琛?    try {
      if (theme) {
        for (const u of userIds) dailyPackService.upsertUserTheme(db, u, theme);
      }
    } catch (e) {}

    const packDate = dailyPackService.getPackDate();
    const inputSignature = dailyPackService.computeInputSignature(theme, historyExclude, userCurrentProfile);
    let row = null;

    for (const u of userIds) {
      row = dailyPackService.getDailyPackRow(db, u, packDate, inputSignature);
      if (row) break;
    }

    // 浠呰繑鍥炲綋鍓嶇敤鎴凤紙鍚埆鍚嶏級缂撳瓨锛涗笉鍐嶅洖閫€ default-user
    res.json(dailyPackService.serializeDailyPack(row));
  } catch (error) {
    console.error('[Daily Pack Today]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/daily-pack/regenerate', async (req, res) => {
  try {
    const {
      userId = 'default-user',
      type = 'both',
      theme,
      historyExclude,
      userCurrentProfile,
    } = req.body || {};
    const uid = dailyPackService.normalizeUserId(userId);
    const packDate = dailyPackService.getPackDate();
    const pref = db.prepare('SELECT theme FROM user_theme_prefs WHERE user_id = ?').get(uid);
    const resolvedTheme = String(theme || pref?.theme || '').trim();
    if (!resolvedTheme) {
      return res.status(400).json({ success: false, error: '璇峰厛閫夋嫨骞跺悓姝ュ涔犱富棰? });
    }

    const resolvedHistoryExclude = String(historyExclude || dailyPackService.getHistoryExclude(db) || '').trim();
    const resolvedUserCurrentProfile = String(
      userCurrentProfile || dailyPackService.getUserCurrentProfile(db, uid) || ''
    ).trim();
    const inputSignature = dailyPackService.computeInputSignature(
      resolvedTheme,
      resolvedHistoryExclude,
      resolvedUserCurrentProfile,
    );

    const existing = dailyPackService.getDailyPackRow(db, uid, packDate, inputSignature);
    const existingWakeup = existing?.wakeup_json ? JSON.parse(existing.wakeup_json) : null;
    const existingFlaw = existing?.flaw_vocab_json ? JSON.parse(existing.flaw_vocab_json) : null;

    // 绔嬪埢钀?generating 骞惰繑鍥烇紝Dify 鍦ㄥ悗鍙拌窇锛岄伩鍏嶉暱杩炴帴鍗犳弧娴忚鍣?Nginx
    const pending = dailyPackService.upsertDailyPack(db, {
      userId: uid,
      packDate,
      theme: resolvedTheme,
      inputSignature,
      wakeup: type === 'flaw' ? existingWakeup : null,
      flawVocab: type === 'wakeup' ? existingFlaw : null,
      source: 'manual',
      status: 'generating',
      errorMessage: null,
    });
    res.json(dailyPackService.serializeDailyPack(pending));

    setImmediate(() => {
      (async () => {
        try {
          if (type === 'flaw') {
            const flawVocab = await dailyPackService.generateFlawVocabForUser(db, uid, resolvedTheme);
            dailyPackService.upsertDailyPack(db, {
              userId: uid,
              packDate,
              theme: resolvedTheme,
              inputSignature,
              wakeup: existingWakeup,
              flawVocab,
              source: 'manual',
              status: 'ready',
              errorMessage: null,
            });
            return;
          }
          if (type === 'wakeup') {
            const wakeup = await dailyPackService.callWakeupWorkflow({
              theme: resolvedTheme,
              userId: uid,
              historyExclude: resolvedHistoryExclude,
              userCurrentProfile: resolvedUserCurrentProfile,
            });
            dailyPackService.upsertDailyPack(db, {
              userId: uid,
              packDate,
              theme: resolvedTheme,
              inputSignature,
              wakeup,
              flawVocab: existingFlaw,
              source: 'manual',
              status: 'ready',
              errorMessage: null,
            });
            return;
          }

          const wakeup = await dailyPackService.callWakeupWorkflow({
            theme: resolvedTheme,
            userId: uid,
            historyExclude: resolvedHistoryExclude,
            userCurrentProfile: resolvedUserCurrentProfile,
          });
          const flawVocab = await dailyPackService.generateFlawVocabForUser(db, uid, resolvedTheme);
          dailyPackService.upsertDailyPack(db, {
            userId: uid,
            packDate,
            theme: resolvedTheme,
            inputSignature,
            wakeup,
            flawVocab,
            source: 'manual',
            status: 'ready',
            errorMessage: null,
          });
        } catch (err) {
          console.error('[Daily Pack Regenerate bg]', err);
          dailyPackService.upsertDailyPack(db, {
            userId: uid,
            packDate,
            theme: resolvedTheme,
            inputSignature,
            wakeup: type === 'flaw' ? existingWakeup : null,
            flawVocab: type === 'wakeup' ? existingFlaw : null,
            source: 'manual',
            status: 'failed',
            errorMessage: err.message || String(err),
          });
        }
      })();
    });
  } catch (error) {
    console.error('[Daily Pack Regenerate]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/daily-pack/cron-run', async (req, res) => {
  try {
    const secret = process.env.DAILY_PACK_CRON_SECRET || '';
    if (secret && req.headers['x-cron-secret'] !== secret) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }
    const result = await dailyPackCron.runDailyPackCronJob(db);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Daily Pack Cron Manual]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ?????????????????????????????
app.get('/api/daily-quota/status', (req, res) => {
  try {
    const { userId = 'default-user' } = req.query;
    const today = new Date().toISOString().split('T')[0];

    const quotaRow = db.prepare(
      'SELECT * FROM daily_vocab_quota WHERE user_id = ? AND quota_date = ?'
    ).get(userId, today);

    if (!quotaRow) {
      return res.json({
        success: true,
        quota: {
          wordsLimit: WORD_DAILY_LIMIT,
          wordsUsed: 0,
          wordsLeft: WORD_DAILY_LIMIT,
          phrasesLimit: PHRASE_DAILY_LIMIT,
          phrasesUsed: 0,
          phrasesLeft: PHRASE_DAILY_LIMIT,
        }
      });
    }

    res.json({
      success: true,
      quota: {
        wordsLimit: WORD_DAILY_LIMIT,
        wordsUsed: quotaRow.words_added || 0,
        wordsLeft: Math.max(0, WORD_DAILY_LIMIT - (quotaRow.words_added || 0)),
        phrasesLimit: PHRASE_DAILY_LIMIT,
        phrasesUsed: quotaRow.phrases_added || 0,
        phrasesLeft: Math.max(0, PHRASE_DAILY_LIMIT - (quotaRow.phrases_added || 0)),
      }
    });
  } catch (error) {
    console.error('[Daily Quota Status] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ????????????????????????????????????????????????????????????????????????????????Mock????
app.post('/api/dify/run-english-mastery', (req, res) => {
  const { topic, materialText } = req.body;
  res.json({
    success: true,
    message: "Successfully initiated training session (Mock).",
    topic: topic,
    result: { scene: "妯℃嫙娴嬭瘯灞€", content: "杩欐槸浠跨湡绯荤粺杩斿洖鐨勮缁冩暟鎹?.." }
  });
});

// ==========================================
// ??????? API (Pronunciation Assessment)
// ????? Dify ????????????????????????// ==========================================
app.post('/api/pronunciation-assessment', async (req, res) => {
  const { targetText, recognizedText, user_current_profile, userId = 'default-user' } = req.body;

  if (!targetText) {
    return res.status(400).json({ success: false, error: '缂哄皯鐩爣鏂囨湰 (targetText)' });
  }

  try {
    const difyApiKey = process.env.DIFY_PRONUNCIATION_API_KEY;
    if (!difyApiKey) {
      console.error('缂哄皯 DIFY_PRONUNCIATION_API_KEY 鐜鍙橀噺');
      return res.status(500).json({ success: false, error: '鏈嶅姟绔湭閰嶇疆鍙戦煶绾犳 API Key' });
    }

    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: injectOralSystemTime({
          target_text: targetText,
          recognized_text: recognizedText || '',
          user_current_profile: user_current_profile || ''
        }),
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Dify 鍙戦煶绾犳璇锋眰澶辫触:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify 璇锋眰澶辫触: ${response.status} - ${errText}` });
    }

    const data = await response.json();
    console.log('Dify 鍘熷杩斿洖:', JSON.stringify(data, null, 2));

    // ???????????? - ??????????????????????? JSON
    const outputs = data?.data?.outputs ?? {};

    const score = typeof outputs.score === 'number' ? outputs.score : 0;
    const phonetic = typeof outputs.phonetic === 'string' ? outputs.phonetic : '';
    const issueType = typeof outputs.issue_type === 'string' ? outputs.issue_type : 'other';
    const analysis = typeof outputs.analysis === 'string' ? outputs.analysis : '璇勬祴瀹屾垚';
    const suggestion = typeof outputs.suggestion === 'string' ? outputs.suggestion : '';

    res.json({
      success: true,
      score,
      phonetic,
      issueType,
      analysis,
      suggestion,
      correctionNote: `${analysis}閵?{suggestion}`,
      target_text: targetText,
      recognized_text: recognizedText || '',
    });
  } catch (err) {
    console.error('鍙戦煶绾犳 API 寮傚父:', err);
    res.status(500).json({ success: false, error: '鍙戦煶绾犳鏈嶅姟寮傚父' });
  }
});

// ==========================================
// ????????????? API (Grammar Polish)
// ????? Dify ?????????????????????
// ==========================================
app.post('/api/grammar-polish', async (req, res) => {
  const { originalText, user_current_profile, userId = 'default-user' } = req.body;

  if (!originalText) {
    return res.status(400).json({ success: false, error: '缂哄皯鍘熷鏂囨湰 (originalText)' });
  }

  try {
    // ???????????????????????????????????????????????????????????????????(????????????Key ?????)
    const difyApiKey = process.env.DIFY_GRAMMAR_API_KEY || 'app-547Sa5oIC3Qb9RUZdasJs1Ef';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: injectOralSystemTime({
          original_text: originalText,
          user_current_profile: user_current_profile || ''
        }),
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Dify 鍙戦煶绾犳璇锋眰澶辫触:', response.status, errText);
      let errorMsg = errText;
      try {
        const errObj = JSON.parse(errText);
        if (errObj.code === "not_chat_app") {
           errorMsg = "Dify 宸ヤ綔娴侀厤缃敊璇? 璇蜂娇鐢?workflow 妯″紡鐨?API 璺緞 (/workflows/run)";
        }
      } catch(e) {}

      return res.status(response.status).json({ success: false, error: `Dify 璇锋眰澶辫触: ${response.status} - ${errorMsg}` });
    }

    const data = await response.json();
    console.log('Dify 鍘熷杩斿洖:', JSON.stringify(data, null, 2));

    // ?? Grammar_Polish_Engine.yml ??????????????????????????????????????polished_result
    const polishedText = data?.data?.outputs?.polished_result || '鏈幏鍙栧埌娑﹁壊缁撴灉锛岃妫€鏌ュ伐浣滄祦閰嶇疆銆?;

    res.json({
      success: true,
      polishedText
    });
  } catch (err) {
    console.error('鍙戦煶绾犳 API 寮傚父:', err);
    res.status(500).json({ success: false, error: '鍙戦煶绾犳鏈嶅姟寮傚父' });
  }
});

// ==========================================
// 3. ????????????? API (Game Theory & Prototypes)
// ==========================================

// ????????????????????????????????????????????????????????????????????????????
app.post('/api/game-theory/analyze', async (req, res) => {
  const {
    scene_type,
    game_model,
    case_text,
    user_answer,
    applied_tactics,
    user_current_profile,
    userId = 'default-user',
    source_type = 'case_analysis',
    title = '',
  } = req.body;

  if (!case_text || !user_answer) {
    return res.status(400).json({ success: false, error: '鏈帴鏀跺埌鏈夋晥鏂囦欢鏁版嵁' });
  }

  const normalizedSource = source_type === 'simulation' ? 'simulation' : 'case_analysis';
  const titleBase = String(title || '').trim() || (normalizedSource === 'simulation' ? '浜烘満瀵规垬娌欑洏' : '鍗氬紙妗堜緥鐮斿垽');
  const taskTitle = normalizedSource === 'simulation'
    ? `浜烘満瀵规垬: ${titleBase.slice(0, 40)}`
    : `鍗氬紙鐮斿垽: ${titleBase.slice(0, 40)}`;

  const taskQueue = require('./services/taskQueue');
  const task = taskQueue.createTask('game_theory', taskTitle);
  taskQueue.updateTask(task.id, {
    status: 'running',
    progress: 10,
    logs: ['浠诲姟宸叉彁浜わ紝璇峰湪浠诲姟涓績鏌ョ湅杩涘害'],
  });

  // 绔嬪嵆杩斿洖 taskId锛屽悗鍙板紓姝ユ墽琛岋紙澶嶇敤鐜版湁 TaskContext 杞锛?  res.json({ success: true, taskId: task.id, status: task.status });

  (async () => {
    try {
      const difyApiKey = process.env.VITE_DIFY_GAME_THEORY_KEY || 'app-YysFumsmeSAeJaQMobMpW24r';
      const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

      taskQueue.updateTask(task.id, { progress: 40, logs: ['姝ｅ湪杩炴帴鍗氬紙妯″瀷 (Dify)...'] });

      const response = await fetch(`${baseUrl}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${difyApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: injectOralSystemTime({
            scene_type,
            game_model,
            case_text,
            user_answer,
            applied_tactics: applied_tactics || '',
            user_current_profile: user_current_profile || '',
          }),
          response_mode: 'blocking',
          user: userId,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Dify 鍗氬紙鍒嗘瀽璇锋眰澶辫触:', response.status, errText);
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: `Dify 璇锋眰澶辫触: ${response.status} - ${errText}`,
        });
        return;
      }

      const data = await response.json();
      taskQueue.updateTask(task.id, { progress: 80, logs: ['姝ｅ湪瑙ｆ瀽鐮斿垽缁撴灉...'] });

      const rawResult = data?.data?.outputs?.analysis_result ?? data?.data?.outputs?.result ?? data?.answer ?? data?.message ?? '';
      const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();

      let parsedResult;
      try {
        parsedResult = JSON.parse(cleanJson);
      } catch (e) {
        console.error('瑙ｆ瀽 Dify 杩斿洖鐨?JSON 澶辫触:', e, rawResult);
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: '鍗氬紙鐮斿垽缁撴灉鏍煎紡寮傚父锛屾棤娉曡В鏋?JSON',
        });
        return;
      }

      if (parsedResult.prototype_archive && parsedResult.prototype_archive.name) {
        const proto = parsedResult.prototype_archive;
        const protoName = proto.name.trim();
        const protoType = proto.type || '鏈垎绫?;
        const protoDesc = proto.description || '';

        const existing = db.prepare('SELECT id FROM personal_prototypes WHERE user_id = ? AND name = ?').get(userId, protoName);
        const now = Date.now();

        if (existing) {
          db.prepare(`
            UPDATE personal_prototypes
            SET type = ?, description = ?, added_at = ?
            WHERE id = ?
          `).run(protoType, protoDesc, now, existing.id);
        } else {
          const id = crypto.randomUUID();
          db.prepare(`
            INSERT INTO personal_prototypes (id, user_id, name, type, description, added_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(id, userId, protoName, protoType, protoDesc, now);
        }
      }

      const historyId = crypto.randomUUID();
      const causalChain = Array.isArray(parsedResult.causal_chain) ? parsedResult.causal_chain : [];
      db.prepare(`
        INSERT INTO game_theory_history (
          id, user_id, source_type, title, scene_type, game_model,
          score, is_success, suggestion, causal_chain_json, full_result_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        historyId,
        userId,
        normalizedSource,
        titleBase.slice(0, 120),
        scene_type || '',
        game_model || '',
        Number(parsedResult.score) || 0,
        parsedResult.is_success ? 1 : 0,
        String(parsedResult.suggestion || ''),
        JSON.stringify(causalChain),
        JSON.stringify(parsedResult),
        Date.now()
      );

      taskQueue.updateTask(task.id, {
        status: 'completed',
        progress: 100,
        logs: ['宸插啓鍏ュ灞€鍘嗗彶'],
        result: {
          historyId,
          sourceType: normalizedSource,
          name: taskTitle,
        },
      });
    } catch (err) {
      console.error('鍗氬紙寮曟搸鍒嗘瀽寮傚父:', err);
      taskQueue.updateTask(task.id, {
        status: 'failed',
        error: '鍗氬紙鍒嗘瀽寮曟搸寮傚父: ' + (err.message || String(err)),
      });
    }
  })();
});

// 瀵瑰眬鍘嗗彶鍒楄〃
app.get('/api/game-theory/history', (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const rows = db.prepare(`
      SELECT id, user_id, source_type, title, scene_type, game_model,
             score, is_success, suggestion, causal_chain_json, created_at
      FROM game_theory_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).all(userId);

    const items = rows.map((row) => {
      let causal_chain = [];
      try {
        causal_chain = JSON.parse(row.causal_chain_json || '[]');
      } catch (_) {
        causal_chain = [];
      }
      return {
        id: row.id,
        user_id: row.user_id,
        source_type: row.source_type,
        title: row.title,
        scene_type: row.scene_type,
        game_model: row.game_model,
        score: row.score,
        is_success: !!row.is_success,
        suggestion: row.suggestion || '',
        causal_chain,
        created_at: row.created_at,
      };
    });

    res.json({ success: true, items });
  } catch (err) {
    console.error('鑾峰彇瀵瑰眬鍘嗗彶澶辫触:', err);
    res.status(500).json({ success: false, error: '瀵瑰眬鍘嗗彶鏌ヨ澶辫触' });
  }
});

// 瀵瑰眬鍘嗗彶璇︽儏锛堝惈瀹屾暣缁撴灉锛?app.get('/api/game-theory/history/:id', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT * FROM game_theory_history WHERE id = ?
    `).get(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: '鍘嗗彶璁板綍涓嶅瓨鍦? });
    }
    let causal_chain = [];
    let full_result = null;
    try { causal_chain = JSON.parse(row.causal_chain_json || '[]'); } catch (_) {}
    try { full_result = JSON.parse(row.full_result_json || 'null'); } catch (_) {}
    res.json({
      success: true,
      item: {
        id: row.id,
        user_id: row.user_id,
        source_type: row.source_type,
        title: row.title,
        scene_type: row.scene_type,
        game_model: row.game_model,
        score: row.score,
        is_success: !!row.is_success,
        suggestion: row.suggestion || '',
        causal_chain,
        full_result,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    console.error('鑾峰彇瀵瑰眬鍘嗗彶璇︽儏澶辫触:', err);
    res.status(500).json({ success: false, error: '瀵瑰眬鍘嗗彶璇︽儏鏌ヨ澶辫触' });
  }
});

function parseBiweeklyReviewXml(rawText) {
  const text = String(rawText || '');
  const analysisMatch = text.match(/<analysis>([\s\S]*?)<\/analysis>/);
  const factorsMatch = text.match(/<factors>([\s\S]*?)<\/factors>/);

  const difficultyAdjustment = {};
  const diffBlock = text.match(/<difficulty_increase>([\s\S]*?)<\/difficulty_increase>/);
  if (diffBlock) {
    const inner = diffBlock[1];
    const oral = inner.match(/<oral_sandbox>(\d+)<\/oral_sandbox>/);
    const game = inner.match(/<game_theory>(\d+)<\/game_theory>/);
    const speech = inner.match(/<impromptu_speech>(\d+)<\/impromptu_speech>/);
    if (oral) difficultyAdjustment.oralSandbox = Number(oral[1]);
    if (game) difficultyAdjustment.gameTheory = Number(game[1]);
    if (speech) difficultyAdjustment.impromptuSpeech = Number(speech[1]);
  }

  const trainingAdjustment = {
    pauseModules: [],
    intensifyModules: [],
    newFocusAreas: [],
    difficultyIncrease: difficultyAdjustment,
  };
  const adjBlock = text.match(/<training_adjustment>([\s\S]*?)<\/training_adjustment>/);
  if (adjBlock) {
    const inner = adjBlock[1];
    const pause = inner.match(/<pause_modules>([\s\S]*?)<\/pause_modules>/);
    const intensify = inner.match(/<intensify_modules>([\s\S]*?)<\/intensify_modules>/);
    const focus = inner.match(/<new_focus_areas>([\s\S]*?)<\/new_focus_areas>/);
    if (pause?.[1]?.trim()) {
      trainingAdjustment.pauseModules = pause[1].split(/[,锛?锛沒/).map((s) => s.trim()).filter(Boolean);
    }
    if (intensify?.[1]?.trim()) {
      trainingAdjustment.intensifyModules = intensify[1].split(/[,锛?锛沒/).map((s) => s.trim()).filter(Boolean);
    }
    if (focus?.[1]?.trim()) {
      trainingAdjustment.newFocusAreas = focus[1].split(/[,锛?锛沒/).map((s) => s.trim()).filter(Boolean);
    }
  }

  return {
    analysis: (analysisMatch ? analysisMatch[1] : text).trim(),
    shortDebilitatingFactors: (factorsMatch ? factorsMatch[1] : '缂轰箯寮€鍒涘姏').trim(),
    difficultyAdjustment,
    trainingAdjustment,
  };
}

// 涓ゅ懆涓€搴︾殑涓撳睘澶嶇洏涓庡急鐐规壂鎻忥紙Biweekly Review Workflow锛?app.post('/api/biweekly-review/analyze', async (req, res) => {
  const {
    practicalTest,
    goalAlignment,
    weaknessScan,
    tacticalDispatch,
    user_current_profile,
    userId = 'default-user',
  } = req.body || {};

  if (!practicalTest || !goalAlignment || !weaknessScan || !tacticalDispatch) {
    return res.status(400).json({ success: false, error: '璇峰畬鏁村～鍐欏洓涓淮搴︾殑澶嶇洏琛ㄥ崟銆? });
  }

  try {
    const difyApiKey =
      process.env.VITE_DIFY_BIWEEKLY_REVIEW_API_KEY
      || process.env.DIFY_BIWEEKLY_REVIEW_API_KEY
      || 'app-p8u1qA8A6iWDB6FzEOtjectn';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    const memoryCtx = buildMemoryContextForUser(userId);

    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: injectOralSystemTime({
          practical_test: practicalTest,
          goal_alignment: goalAlignment,
          weakness_scan: weaknessScan,
          tactical_dispatch: tacticalDispatch,
          user_current_profile: user_current_profile || '',
          recent_episodes_summary: composeMemorySummaryForPrompt(memoryCtx),
          error_ledger_summary: memoryCtx.errorLedgerSummary,
        }),
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Dify biweekly review error:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify 澶嶇洏宸ヤ綔娴佸け璐? ${response.status}` });
    }

    const data = await response.json();
    const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
    const parsed = parseBiweeklyReviewXml(rawResult);

    res.json({ success: true, ...parsed });
  } catch (err) {
    console.error('Biweekly review proxy error:', err);
    res.status(500).json({ success: false, error: '澶嶇洏鍒嗘瀽浠ｇ悊澶辫触: ' + err.message });
  }
});

function parseWeeklyChatEnhancedXml(rawText) {
  const text = String(rawText || '');
  const pick = (tag) => {
    const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return m ? m[1].trim() : '';
  };

  const pushBlock = pick('next_week_push');
  const nextWeekPush = {};

  if (pushBlock) {
    const yuxin = pushBlock.match(/<yuxin_game_theory>([\s\S]*?)<\/yuxin_game_theory>/)?.[1]?.trim();
    const oralScenario = pushBlock.match(/<oral_scenario>([\s\S]*?)<\/oral_scenario>/)?.[1]?.trim();
    const oralRoles = pushBlock.match(/<oral_roles>([\s\S]*?)<\/oral_roles>/)?.[1]?.trim();
    const oralFocus = pushBlock.match(/<oral_focus>([\s\S]*?)<\/oral_focus>/)?.[1]?.trim();
    const oralDifficulty = pushBlock.match(/<oral_difficulty>([\s\S]*?)<\/oral_difficulty>/)?.[1]?.trim();
    const impromptuTopic = pushBlock.match(/<impromptu_topic>([\s\S]*?)<\/impromptu_topic>/)?.[1]?.trim();
    const impromptuLevels = pushBlock.match(/<impromptu_levels>([\s\S]*?)<\/impromptu_levels>/)?.[1]?.trim();
    const generalFocus = pushBlock.match(/<general_focus>([\s\S]*?)<\/general_focus>/)?.[1]?.trim();

    if (yuxin) {
      nextWeekPush.yuxinGameTheory = yuxin.split(/[,锛?锛沒/).map((s) => s.trim()).filter(Boolean);
    }
    if (oralScenario) {
      nextWeekPush.oralSandbox = {
        scenario: oralScenario,
        roles: oralRoles || '鎴?+ 涓氬姟鍔╂敾 + 鏂藉帇鏂?+ 鍏抽敭鍐崇瓥浜?,
        focus: oralFocus || oralScenario,
        difficulty: oralDifficulty ? Number(oralDifficulty) : 4,
      };
    }
    if (impromptuTopic) {
      nextWeekPush.impromptuSpeech = {
        topic: impromptuTopic,
        targetLevels: impromptuLevels
          ? impromptuLevels.split(/[,锛?锛沒/).map((s) => s.trim()).filter(Boolean)
          : [],
        format: '缁撴瀯鍖栧嵆鍏磋〃杈?,
      };
    }
    if (generalFocus) {
      nextWeekPush.generalFocus = generalFocus.split(/[,锛?锛沒/).map((s) => s.trim()).filter(Boolean);
    }
  }

  return {
    analysis: pick('analysis') || text.trim(),
    nextWeekPreview: pick('preview') || '宸蹭负鎮ㄩ噸缁勪笅鍛ㄨ缁冭琛?,
    nextWeekPush,
    coreThemes: pick('core_themes'),
    profileFactors: pick('profile_factors') || pick('factors') || '',
  };
}

// 姣忓懆澶滆瘽澧炲己宸ヤ綔娴侊紙Weekly Chat Enhanced Workflow锛?app.post('/api/weekly-chat/enhanced', async (req, res) => {
  const {
    userText,
    selectedDirections,
    user_current_profile,
    userId = 'default-user',
  } = req.body || {};

  if (!userText || typeof userText !== 'string') {
    return res.status(400).json({ success: false, error: '缂哄皯蹇冩櫤鎶曞杺鏂囨湰銆? });
  }

  try {
    const difyApiKey =
      process.env.VITE_DIFY_WEEKLY_CHAT_ENHANCED_API_KEY
      || process.env.DIFY_WEEKLY_CHAT_ENHANCED_API_KEY
      || 'app-1imBRwdxi4dxa1bSLbMLTvNu';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    const memoryCtx = buildMemoryContextForUser(userId);

    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: injectOralSystemTime({
          user_text: userText,
          selected_directions: Array.isArray(selectedDirections)
            ? selectedDirections.join(', ')
            : String(selectedDirections || ''),
          user_current_profile: user_current_profile || '',
          recent_episodes_summary: composeMemorySummaryForPrompt(memoryCtx),
          error_ledger_summary: memoryCtx.errorLedgerSummary,
        }),
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Dify weekly chat enhanced error:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify 澶滆瘽宸ヤ綔娴佸け璐? ${response.status}` });
    }

    const data = await response.json();
    const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
    const parsed = parseWeeklyChatEnhancedXml(rawResult);

    res.json({ success: true, ...parsed });
  } catch (err) {
    console.error('Weekly chat enhanced proxy error:', err);
    res.status(500).json({ success: false, error: '澶滆瘽澧炲己浠ｇ悊澶辫触: ' + err.message });
  }
});

// ??????????????? API ?????????? Cognitive Penetration Engine
app.post('/api/game-theory/ascension', async (req, res) => {
  const { event_text, layers, dimension, user_current_profile, userId = 'default-user' } = req.body;
  if (!event_text || !Array.isArray(layers) || layers.length < 5) {
    return res.status(400).json({ success: false, error: '璇峰畬鎴愯嚦灏?5 灞傚洜鏋滄帹婕斿悗鍐嶆彁浜? });
  }
  try {
    const difyApiKey = process.env.VITE_DIFY_COGNITIVE_KEY || process.env.VITE_DIFY_GAME_THEORY_KEY || 'app-YysFumsmeSAeJaQMobMpW24r';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
    
    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${difyApiKey}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        inputs: {
          event_text,
          layers_text: layers.map(l => `Why-${l.level}: ${l.why}`).join('\n'),
          dimension,
          user_current_profile: user_current_profile || ''
        },
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Dify 鍙戦煶绾犳璇锋眰澶辫触:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify 璇锋眰澶辫触: ${response.status} - ${errText}` });
    }

    const data = await response.json();
    const raw = data?.data?.outputs?.result ?? data?.data?.outputs?.analysis_result ?? data?.answer ?? data?.message ?? '';
    const cleanJson = String(raw).replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanJson);
    } catch (e) {
      console.error('瑙ｆ瀽 Dify 鍗囩淮寮曟搸杩斿洖鐨?JSON 澶辫触:', e, raw);
      return res.status(500).json({ success: false, error: '鍗囩淮鐮斿垽缁撴灉鏍煎紡寮傚父锛屾棤娉曡В鏋?JSON' });
    }

    res.json({ success: true, result: parsedResult });
  } catch (err) {
    console.error('鍗氬紙寮曟搸鍒嗘瀽寮傚父:', err);
    res.status(500).json({ success: false, error: '鍗氬紙鍒嗘瀽寮曟搸寮傚父: ' + err.message });
  }
});

// ????????????????????????????????
app.get('/api/game-theory/prototypes', (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const rows = db.prepare('SELECT * FROM personal_prototypes WHERE user_id = ? ORDER BY added_at DESC').all(userId);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ????/???????????????????????????????
app.post('/api/game-theory/prototypes', (req, res) => {
  try {
    const { userId, name, type, description } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    
    const existing = db.prepare('SELECT id FROM personal_prototypes WHERE user_id = ? AND name = ?').get(userId, name);
    const now = Date.now();
    
    if (existing) {
      db.prepare(`
        UPDATE personal_prototypes 
        SET type = ?, description = ?, added_at = ?
        WHERE id = ?
      `).run(type, description, now, existing.id);
      res.json({ success: true, id: existing.id, status: 'updated' });
    } else {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO personal_prototypes (id, user_id, name, type, description, added_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, userId, name, type, description, now);
      res.json({ success: true, id, status: 'created' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ??????????????????????????
app.delete('/api/game-theory/prototypes/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM personal_prototypes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ????? 404

/**
 * TTS 缃戝叧閿欒锛堝閮?TTS 鏈嶅姟涓嶅彲杈炬椂鎶涘嚭锛? */
class TtsGatewayError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TtsGatewayError';
    this.code = 'TTS_GATEWAY_ERROR';
  }
}

/**
 * 瑙ｆ瀽 edge-tts 鍙墽琛屽懡浠わ紙鏀寔 EDGE_TTS_BIN銆亊/.local/bin銆乸ython3 -m edge_tts锛? */
function getEdgeTtsCommand() {
  if (process.env.EDGE_TTS_BIN) {
    const parts = process.env.EDGE_TTS_BIN.trim().split(/\s+/);
    return { command: parts[0], prefixArgs: parts.slice(1) };
  }
  const localBin = path.join(process.env.HOME || '/home/ubuntu', '.local/bin/edge-tts');
  if (fs.existsSync(localBin)) {
    return { command: localBin, prefixArgs: [] };
  }
  return { command: 'python3', prefixArgs: ['-m', 'edge_tts'] };
}

/**
 * 鏈湴 Edge TTS锛氳皟鐢?edge-tts CLI 鎴?python3 -m edge_tts 鐢熸垚 MP3
 * @param {string} text 寰呭悎鎴愭枃鏈? * @param {string} voice 璇煶鍚? * @param {AbortSignal|null} signal
 * @returns {Promise<Buffer>} MP3 鏁版嵁
 */
async function synthesizeWithEdgeTTS(text, voice, signal = null) {
  const { execFile } = require('child_process');
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const { command, prefixArgs } = getEdgeTtsCommand();
  const tmpId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tmpMediaFile = path.join(os.tmpdir(), `edge_tts_${tmpId}.mp3`);
  const tmpTextFile = path.join(os.tmpdir(), `edge_tts_${tmpId}.txt`);
  
  // 灏嗘瀬闀跨殑鏂囨湰鍐欏叆涓存椂鏂囦欢锛岄槻姝㈠懡浠よ鍥犺繃闀挎垨鍖呭惈鐗规畩瀛楃鎶ラ敊
  fs.writeFileSync(tmpTextFile, text, 'utf8');

  return new Promise((resolve, reject) => {
    const args = [...prefixArgs, '--voice', voice, '--file', tmpTextFile, '--write-media', tmpMediaFile];
    // edge-tts 瓒呮椂榛樿 10 鍒嗛挓锛堢櫥褰曡ˉ璺戜粎 1 鍒嗛挓绋匡紱鍙敤 TTS_EDGE_TIMEOUT_MS 瑕嗙洊锛?    const edgeTimeoutMs = Number(process.env.TTS_EDGE_TIMEOUT_MS || 600000);
    const proc = execFile(command, args, { timeout: edgeTimeoutMs }, (err) => {
      if (fs.existsSync(tmpTextFile)) fs.unlinkSync(tmpTextFile);
      if (err) {
        if (fs.existsSync(tmpMediaFile)) fs.unlinkSync(tmpMediaFile);
        return reject(new Error(`edge-tts failed: ${err.message}`));
      }
      try {
        const data = fs.readFileSync(tmpMediaFile);
        fs.unlinkSync(tmpMediaFile);
        resolve(data);
      } catch (readErr) {
        reject(new Error(`闊抽璇诲彇澶辫触: ${readErr.message}`));
      }
    });
    // 澶勭悊澶栭儴 signal 鎵撴柇
    if (signal) {
      signal.addEventListener('abort', () => {
        proc.kill();
        reject(new Error('Edge TTS aborted'));
      }, { once: true });
    }
  });
}

const https = require('https');
const http = require('http');

function getTtsUpstreamUrls() {
  const primary = process.env.TTS_API_URL || 'https://9router.234124123.xyz/v1/audio/speech';
  const fallback = process.env.TTS_API_FALLBACK_URL || 'https://23.95.214.232/v1/audio/speech';
  return [...new Set([primary, fallback].filter(Boolean))];
}

function postTtsUpstream(apiUrl, apiKey, body, signal, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(apiUrl);
    } catch (err) {
      reject(err);
      return;
    }

    const payload = JSON.stringify(body);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const isIpHost = /^\d{1,3}(\.\d{1,3}){3}$/.test(parsedUrl.hostname);
    const insecureTls = process.env.TTS_INSECURE_TLS === '1'
      || process.env.TTS_INSECURE_TLS === 'true'
      || isIpHost;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      ...(isHttps && insecureTls ? { rejectUnauthorized: false } : {}),
    };

    const req = transport.request(reqOptions, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirectCount < 5) {
        const nextUrl = new URL(res.headers.location, apiUrl).href;
        if (nextUrl !== apiUrl) {
          res.resume();
          postTtsUpstream(nextUrl, apiKey, body, signal, redirectCount + 1).then(resolve, reject);
          return;
        }
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          buffer: Buffer.concat(chunks),
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('TTS upstream timeout')));

    if (signal) {
      if (signal.aborted) {
        req.destroy(new Error('aborted'));
        return;
      }
      signal.addEventListener('abort', () => req.destroy(new Error('aborted')), { once: true });
    }

    req.write(payload);
    req.end();
  });
}

function formatTtsFetchError(err) {
  const cause = err && err.cause;
  const code = (cause && cause.code) || (err && err.code);
  const msg = (cause && cause.message) || (err && err.message) || 'fetch failed';
  return code ? `${msg} (${code})` : msg;
}

/**
 * 鏍稿績锛氬垎鍧楀悎鎴愬苟鎸夊簭杩藉姞鍐欏叆纾佺洏锛堟祦寮忓啓鍏ワ紝閬垮厤澶у唴瀛樺嘲鍊硷級
 * @param {string} cleanInput 宸叉竻娲楁枃鏈? * @param {string} finalModel TTS 妯″瀷
 * @param {string} audioPath 鐩爣 mp3 鏂囦欢璺緞
 * @param {string|null} taskId 寮傛浠诲姟ID锛屼紶鍏ュ垯鏇存柊杩涘害
 * @param {AbortSignal|null} signal 鍙€夌殑 AbortSignal
 */
async function synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, taskId = null, signal = null) {
  const chunkCacheDir = audioPath + '.chunks';
  const maxAttempts = taskId ? 8 : 2;
  try {
  const taskQueue = taskId ? require('./services/taskQueue') : null;
  const ttsUpstreamUrls = getTtsUpstreamUrls();
  const apiKey = process.env.TTS_API_KEY || 'sk-899c9c34738f61b5-2u53op-6ed8a313';
  const ttsVoice = finalModel.includes('/') ? finalModel.split('/')[1] : '';
  const gatewayFailed = { value: false }; // 鏍囪鏄惁璧颁簡鏈湴 fallback
  const preferEdgeTts = finalModel.startsWith('edge-tts/');

  // ?????????????????????? 2000 ??????????????????????????????????
  const MAX_CHUNK = 2000;
  const finalChunks = [];
  let cur = '';
  for (const sentence of (cleanInput.match(/[^.!?\n]+[.!?\n]+/g) || [cleanInput])) {
    if ((cur + sentence).length > MAX_CHUNK) {
      if (cur.trim()) finalChunks.push(cur.trim());
      cur = sentence;
    } else {
      cur += sentence;
    }
  }
  if (cur.trim()) finalChunks.push(cur.trim());
  // ???????????????????????
  const chunks = [];
  for (const c of finalChunks) {
    let t = c;
    while (t.length > MAX_CHUNK) { chunks.push(t.slice(0, MAX_CHUNK)); t = t.slice(MAX_CHUNK); }
    if (t) chunks.push(t);
  }
  if (!chunks.length) throw new Error('No valid content to synthesize');

  const total = chunks.length;

  // ========== ??????????????????? ==========
  // 1. ?????????????????????????????????429?????
  // 2. ?????????????????????????????????????????????
  // 3. ??????????????? 120s
  // 4. ??????????? 5 ?????? 8 ?
  if (!fs.existsSync(chunkCacheDir)) {
    fs.mkdirSync(chunkCacheDir, { recursive: true });
  }

  const getChunkPath = (idx) => path.join(chunkCacheDir, `chunk_${idx}.mp3`);

  // ?????????????????????????????????????
  const completedChunks = [];
  for (let idx = 0; idx < total; idx++) {
    const chunkPath = getChunkPath(idx);
    if (fs.existsSync(chunkPath) && fs.statSync(chunkPath).size > 0) {
      completedChunks.push(idx);
    }
  }

  // ?????????????????????????????????????????????
  if (completedChunks.length === total) {
    fs.writeFileSync(audioPath, Buffer.alloc(0));
    for (let idx = 0; idx < total; idx++) {
      fs.appendFileSync(audioPath, fs.readFileSync(getChunkPath(idx)));
    }
    // ?????????????
    fs.rmSync(chunkCacheDir, { recursive: true, force: true });
    if (taskQueue && taskId) {
      taskQueue.updateTask(taskId, { progress: 100, logs: ['鍏ㄩ儴鐗囨宸插畬鎴愶紙浠庣紦瀛樻仮澶嶏級'] });
    }
    if (!isValidCachedAudio(audioPath)) {
      throw new Error('浠庣紦瀛樺悎骞跺悗闊抽鏂囦欢鏃犳晥锛? 瀛楄妭锛?);
    }
    return;
  }

  // ???????????????????????????????
  fs.writeFileSync(audioPath, Buffer.alloc(0));

  // ??????????????????????????? MP3 ???????
  const pendingMap = new Map();
  let nextWrite = 0;

  const flush = () => {
    while (pendingMap.has(nextWrite)) {
      const chunkData = pendingMap.get(nextWrite);
      // ???????????
      fs.appendFileSync(audioPath, chunkData);
      // ?????????????????????????????????
      fs.writeFileSync(getChunkPath(nextWrite), chunkData);
      pendingMap.delete(nextWrite);
      nextWrite++;
      if (taskQueue && taskId) {
        taskQueue.updateTask(taskId, {
          progress: Math.round((nextWrite / total) * 100),
          logs: [`鍒嗗潡 ${nextWrite}/${total} 宸插啓鍏]
        });
      }
    }
  };

  // ?????????
  for (let idx = 0; idx < total; idx++) {
    // ?????????
    if (completedChunks.includes(idx)) {
      if (fs.existsSync(getChunkPath(idx))) {
        pendingMap.set(idx, fs.readFileSync(getChunkPath(idx)));
        flush();
      }
      if (taskQueue && taskId) {
        taskQueue.updateTask(taskId, { logs: [`鍒嗗潡 ${idx + 1}/${total} 浠庣紦瀛樻仮澶峘] });
      }
      continue;
    }

    const chunkText = chunks[idx];
    let lastErr;

    // 8?????????????? TTS ????
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      try {
        if (preferEdgeTts) {
          try {
            const edgeResult = await synthesizeWithEdgeTTS(chunkText, ttsVoice || 'en-GB-LibbyNeural', signal);
            pendingMap.set(idx, edgeResult);
            flush();
            lastErr = null;
            break;
          } catch (edgeErr) {
            console.warn('[TTS] edge-tts primary failed, trying upstream:', edgeErr.message);
            if (taskQueue && taskId) {
              taskQueue.updateTask(taskId, { logs: [`绗?${attempt} 娆? 鏈湴 edge-tts 澶辫触锛屽皾璇曚笂娓哥綉鍏?..`] });
            }
          }
        }

        const body = { model: finalModel, input: chunkText };

        let r = null;
        let upstreamErr = null;
        for (const apiUrl of ttsUpstreamUrls) {
          try {
            const upstreamRes = await postTtsUpstream(apiUrl, apiKey, body, controller.signal);
            r = {
              ok: upstreamRes.ok,
              status: upstreamRes.status,
              arrayBuffer: async () => upstreamRes.buffer,
              text: async () => upstreamRes.buffer.toString('utf8'),
            };
            if (upstreamRes.ok || upstreamRes.status === 502 || upstreamRes.status === 504) {
              break;
            }
            upstreamErr = new Error(`HTTP ${upstreamRes.status}: ${upstreamRes.buffer.toString('utf8').slice(0, 200)}`);
          } catch (err) {
            upstreamErr = err;
            console.warn(`[TTS] Upstream failed (${apiUrl}):`, formatTtsFetchError(err));
          }
        }
        if (!r) {
          throw upstreamErr || new Error('All TTS upstream URLs failed');
        }

        clearTimeout(timeoutId);

        if (r.ok) {
          const chunkData = Buffer.from(await r.arrayBuffer());
          pendingMap.set(idx, chunkData);
          flush();
          lastErr = null;
          break; // 鍚堟垚鎴愬姛锛岃烦鍑洪噸璇?        }

        // 502/504 ????????? -> ??????? Edge TTS ???????????
        if (r.status === 502 || r.status === 504) {
          console.warn(`[TTS] Gateway error ${r.status}, trying fallback...`);
          if (taskQueue && taskId) {
            taskQueue.updateTask(taskId, { logs: [`绗?${attempt} 娆? 缃戝叧閿欒 ${r.status}锛屽皾璇曞鐢ㄥ悎鎴?..`] });
          }
          try {
            const fallbackResult = await synthesizeWithEdgeTTS(chunkText, ttsVoice || 'en-GB-LibbyNeural', signal);
            pendingMap.set(idx, fallbackResult);
            flush();
            lastErr = null;
            gatewayFailed.value = true;
            break;
          } catch (fallbackErr) {
            console.error('[TTS] Fallback failed:', fallbackErr.message);
            if (taskQueue && taskId) {
              taskQueue.updateTask(taskId, { logs: [`澶囩敤鍚堟垚澶辫触: ${fallbackErr.message}`] });
            }
            lastErr = new TtsGatewayError(`涓绘湇鍔?${r.status}锛屽鐢ㄥ悎鎴愪篃澶辫触: ${fallbackErr.message}`);
            continue;
          }
        }

        lastErr = new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`);
      } catch (e) {
        clearTimeout(timeoutId);
        console.error('[TTS] Upstream fetch failed:', formatTtsFetchError(e));
        lastErr = new Error(formatTtsFetchError(e));
      }

      // ???????????????????????
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
        if (taskQueue && taskId) {
          taskQueue.updateTask(taskId, {
            logs: [`鍒嗗潡 ${idx + 1}/${total} 绗?{attempt}娆″け璐ワ紝${Math.round(delay/1000)}绉掑悗閲嶈瘯...`]
          });
        }
        await new Promise(r => setTimeout(r, delay));
      }
    }

    if (lastErr) {
      // ????????????????????
      fs.rmSync(chunkCacheDir, { recursive: true, force: true });
      throw new Error(`鍒嗗潡 ${idx + 1}/${total} 鍚堟垚澶辫触: ${lastErr?.message}`);
    }
  }

  // ?????????????
  fs.rmSync(chunkCacheDir, { recursive: true, force: true });

  if (!isValidCachedAudio(audioPath)) {
    throw new Error('鍚堟垚瀹屾垚浣嗛煶棰戞枃浠舵棤鏁堬紙0 瀛楄妭锛?);
  }
  } catch (err) {
    removeInvalidCachedAudio(audioPath);
    try {
      if (fs.existsSync(chunkCacheDir)) {
        fs.rmSync(chunkCacheDir, { recursive: true, force: true });
      }
    } catch { /* ignore */ }
    throw err;
  }
}

global.synthesizeAndSaveAudio = synthesizeAndSaveAudio;

/** C1: 涓?daily-extract 鐩稿悓鐨?mastery 璋冪敤锛涘彧瑙ｆ瀽璇嶈〃锛屼笉瑕嗙洊 listen 姝ｆ枃 */
async function extractVocabFromListenArticle({
  body,
  theme,
  genre,
  cefr_level,
  duration,
  userId = 'default-user',
} = {}) {
  const apiKey = process.env.DIFY_ENGLISH_MASTERY_KEY
    || process.env.VITE_DIFY_ENGLISH_MASTERY_KEY
    || 'app-OShKY1EcVuLFkuxrpO28ZB0A';
  const baseUrl = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  // body 浠呯敤浜庢牎楠屾湁姝ｆ枃锛沵astery 涓?daily-extract 涓€鏍烽潬 theme/genre/cefr/duration 鐢熸垚骞跺甫 VOCAB_JSON
  if (!String(body || '').trim()) {
    console.warn('[DailyListen] extractVocab skip: empty body');
    return { vocab: [], phrases: [], sentences: [] };
  }

  const fetchController = new AbortController();
  const fetchTimeout = setTimeout(() => fetchController.abort(), 10 * 60 * 1000);
  let wfResponse;
  try {
    wfResponse = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: fetchController.signal,
      body: JSON.stringify({
        inputs: injectOralSystemTime({
          theme: theme || '鍟嗗姟璋堝垽锛氳姝ヤ笌鏂藉帇',
          cefr_level: cefr_level || 'B1',
          genre: genre || 'meeting',
          duration: String(duration || '1'),
          history_exclude: '',
          user_flaws: '',
          user_current_profile: '',
        }),
        query: 'generate',
        response_mode: 'streaming',
        user: userId,
      }),
    });
  } finally {
    clearTimeout(fetchTimeout);
  }

  if (!wfResponse.ok) {
    const errText = await wfResponse.text().catch(() => '');
    throw new Error(errText || `Dify vocab extract HTTP ${wfResponse.status}`);
  }

  const answer = await collectDifyStreamingAnswer(wfResponse, { sanitize: false });
  const parsed = dailyListenPreGenerateService.parseVocabFromRaw(answer || '');
  const vocabN = Array.isArray(parsed.vocab) ? parsed.vocab.length : 0;
  const phraseN = Array.isArray(parsed.phrases) ? parsed.phrases.length : 0;
  const sentN = Array.isArray(parsed.sentences) ? parsed.sentences.length : 0;
  // C2: 绌虹粨鏋滄槑纭墦鐐癸紝渚夸簬瀵圭収 mastery 鏄惁鍚愬嚭 VOCAB_JSON
  if (vocabN === 0 && phraseN === 0) {
    const hasMarker = /---VOCAB_JSON_START---/i.test(answer || '');
    console.warn(
      `[DailyListen] extractVocab empty user=${userId} ${genre}/${cefr_level}/${duration}m `
      + `answerLen=${(answer || '').length} hasVocabMarker=${hasMarker}`,
    );
  } else {
    console.log(
      `[DailyListen] extractVocab ok user=${userId} ${genre}/${cefr_level}/${duration}m `
      + `words=${vocabN} phrases=${phraseN} sentences=${sentN}`,
    );
  }
  return parsed;
}

dailyListenPreGenerateService.setGenerators({
  generateLongScript: async ({ theme, genre, cefr_level, duration, userId }) => {
    return generateListenLongScriptSync({
      theme,
      genre,
      cefr_level,
      duration: String(duration),
    }, userId);
  },
  extractVocabFromArticle: extractVocabFromListenArticle,
  synthesizeAudioFile: async (text, audioPath) => {
    const clean = sanitizeListenMaterialScript(text);
    const finalModel = process.env.TTS_DEFAULT_MODEL || 'edge-tts/en-US-EmmaNeural';
    await synthesizeAndSaveAudio(clean, finalModel, audioPath, null, null);
  },
});

// TTS ????????????????????????????????????????????? OOM ?????????
let ttsLongLock = false;

// TTS ??????????????????????????? / ?????????????????????
app.post('/api/tts/speech', async (req, res) => {
  try {
    const { input, model = 'edge-tts/en-US-EmmaNeural', isAsync } = req.body;
    if (!input) return res.status(400).json({ error: 'Missing input text' });

    const finalModel = model || 'edge-tts/en-US-EmmaNeural';
    // 绉婚櫎 Emoji
    let cleanInput = input.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{27BF}]/gu, '');
    cleanInput = sanitizeListenMaterialScript(cleanInput);
    
    // 閽堝绾嫳鏂?TTS 妯″瀷锛岃繃婊ゆ帀涓枃瀛楃鍙婂叏瑙掓爣鐐癸紝閬垮厤 edge-tts 閬囧埌鏃犳硶鍙戦煶鐨勫瓧绗﹀穿婧?(NoAudioReceived)
    if (finalModel.includes('/en-') || finalModel.startsWith('en-')) {
      cleanInput = cleanInput.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g, '').trim();
      
      // 鐔旀柇鏈哄埗锛氬鏋滆繃婊ゅ悗娌℃湁浠讳綍鏈夋晥瀛楁瘝鎴栨暟瀛楋紝鐩存帴杩斿洖绌洪煶棰戯紝闃叉 edge-tts 璇荤┖姘旀姤閿?500
      if (!/[a-zA-Z0-9]/.test(cleanInput)) {
        return res.json({ success: true, audioId: 'empty', audioUrl: null, duration: 0 });
      }
    }

    // ????????????????????? Key???????????????????????
    const md5 = crypto.createHash('md5').update(cleanInput + '_' + finalModel).digest('hex');
    const cacheFilename = `${md5}.mp3`;
    const audioPath = path.join(__dirname, 'public', 'temp_audio', cacheFilename);
    const audioUrl = '/api/temp_audio/' + cacheFilename;

    // ???????????????????????? 0 ??????????????????????????
    if (isValidCachedAudio(audioPath)) {
      const stat = fs.statSync(audioPath);
      const now = Date.now();
      // ???????????????? 24h?????????????????
      if (now - stat.mtimeMs > TEMP_AUDIO_MAX_AGE_MS) {
        fs.unlinkSync(audioPath);
      } else {
        return res.json({ success: true, audioId: md5, audioUrl, duration: 0 });
      }
    }
    removeInvalidCachedAudio(audioPath);

    // ?????????????????????????? OR ?????????3000????????????? taskId ???? HTTP ?????
    const isAsyncMode = isAsync === true || cleanInput.length >= 3000;
    if (isAsyncMode) {
      // ???????????????????????????????????????????
      if (ttsLongLock) {
        return res.status(429).json({
          success: false,
          code: 'TTS_LOCKED',
          message: '褰撳墠鏈夐煶棰戞鍦ㄥ悎鎴愪腑锛岃绋嶅悗鍐嶈瘯锛堥璁?3~10 鍒嗛挓锛?
        });
      }
      ttsLongLock = true;

      const taskQueue = require('./services/taskQueue');
      const task = taskQueue.createTask('tts', `楂樹繚鐪熼煶棰戝悎鎴?(${cleanInput.length}瀛楃)`);

      // ?????????????? try/catch ???? res.json??????????????????????????
      try {
        res.json({ success: true, taskId: task.id, status: 'pending', audioUrl: null });
      } catch (e) {
        ttsLongLock = false;
        return; // 瀹㈡埛绔凡鏂紑
      }

      // ?????????setImmediate ???????????????????? Express ????
      setImmediate(async () => {
        try {
          taskQueue.updateTask(task.id, { status: 'running', logs: [`寮€濮嬪紓姝ュ悎鎴愶紝鎬诲瓧绗? ${cleanInput.length}`] });
          await synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, task.id);
          taskQueue.updateTask(task.id, {
            status: 'completed', progress: 100,
            result: { audioId: md5, audioUrl },
          logs: ['闊抽鍚堟垚瀹屾垚']
          });
        } catch (err) {
          console.error('[TTS Async] Failed:', err);
          taskQueue.updateTask(task.id, { status: 'failed', error: err.message });
        } finally {
          ttsLongLock = false;
        }
      });
      return;
    } else {
      // ????????????????????????? 120 ?????????????
      // ?????????????????????????????????????????
      const ctrl = new AbortController();
      const tmo = setTimeout(() => { ctrl.abort(); }, 120000);
      try {
        await synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, null, ctrl.signal);
        clearTimeout(tmo);
        res.json({ success: true, audioId: md5, audioUrl, duration: 0 });
      } catch (e) {
        clearTimeout(tmo);
        throw e;
      }
    }

  } catch (error) {
    console.error('[TTS] Error:', error);
    // ??????????????????
    if (error instanceof TtsGatewayError) {
      return res.status(502).json({
        success: false,
        code: error.code,
        message: '璇煶鍚堟垚鏈嶅姟鏆備笉鍙敤锛岃绋嶅悗閲嶈瘯'
      });
    }
    if (error.message && error.message.includes('褰撳墠鏈夐煶棰戞鍦ㄥ悎鎴?)) {
      return res.status(429).json({
        success: false,
        code: 'TTS_LOCKED',
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      code: 'TTS_INTERNAL_ERROR',
      message: error.message || '璇煶鍚堟垚鍐呴儴閿欒'
    });
  }
});

// ==========================================
// TTS ????????????????????????????? /api/tasks/:id ?????????
// ==========================================
app.get('/api/tts/task/:id', (req, res) => {
  try {
    const taskQueue = require('./services/taskQueue');
    const task = taskQueue.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: '浠诲姟涓嶅瓨鍦ㄦ垨宸茶繃鏈? });
    }

    // ?????????????????? URL
    if (task.status === 'completed' && task.result?.audioUrl) {
      return res.json({
        success: true,
        status: 'completed',
        progress: 100,
        audioUrl: task.result.audioUrl,
        logs: task.logs
      });
    }

    // ???????????????
    if (task.status === 'failed') {
      return res.json({
        success: true,
        status: 'failed',
        error: task.error || '鏈煡閿欒',
        logs: task.logs
      });
    }

    // ???? / ????????????????
    res.json({
      success: true,
      status: task.status,
      progress: task.progress || 0,
      logs: task.logs
    });
  } catch (error) {
    console.error('[TTS Task Status] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ?????? API
// ==========================================
app.post('/api/materials/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: '缂哄皯蹇呰鍙傛暟: url' });
    }

    const { fetchUrlContent } = require('./services/webFetcher');
    const result = await fetchUrlContent(url);
    res.json(result);
  } catch (error) {
    console.error('[Fetch URL Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ???????? API (?????? URL ??? Multipart ???????????)
// ==========================================
const multer = require('multer');
const uploadDir = path.join(__dirname, 'public', 'temp_videos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const chunkDir = path.join(__dirname, 'public', 'temp_chunks');
if (!fs.existsSync(chunkDir)) {
  fs.mkdirSync(chunkDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// ??????????????? API
app.post('/api/materials/upload-chunk', upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;
    const file = req.file;

    if (!uploadId || chunkIndex === undefined || !file) {
      return res.status(400).json({ success: false, error: '缂哄皯蹇呰鍙傛暟: uploadId, chunkIndex 鎴?chunk' });
    }

    const sessionDir = path.join(chunkDir, uploadId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // ?????????????????????????????????????????????????????
    const targetPath = path.join(sessionDir, String(chunkIndex));
    fs.renameSync(file.path, targetPath);

    res.json({ success: true });
  } catch (error) {
    console.error('[Upload Chunk Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ??????????????????? API
app.post('/api/materials/merge-chunks', async (req, res) => {
  try {
    const { uploadId, fileName, language = 'auto', subtitle = '', totalChunks } = req.body;

    if (!uploadId || !fileName || !totalChunks) {
      return res.status(400).json({ success: false, error: '缂哄皯蹇呰鍙傛暟: uploadId, fileName 鎴?totalChunks' });
    }

    const sessionDir = path.join(chunkDir, uploadId);
    if (!fs.existsSync(sessionDir)) {
    return res.status(400).json({ success: false, error: '鏈帴鏀跺埌鏈夋晥鏂囦欢鏁版嵁' });
    }

    // ??????????????????????????????????????
    const safeFileName = fileName.replace(/[\\\/]/g, '_');
    const finalFileName = `${uploadId}_${safeFileName}`;
    const finalFilePath = path.join(uploadDir, finalFileName);

    // ??? appendFileSync ?????????
    fs.writeFileSync(finalFilePath, ''); // 鍒涘缓鎴栨竻绌烘枃浠?    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(sessionDir, String(i));
      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({ success: false, error: `鍚堝苟澶辫触: 缂哄皯绗?${i} 鍧楀垎鐗嘸 });
      }
      const data = fs.readFileSync(chunkPath);
      fs.appendFileSync(finalFilePath, data);
    }

    // ???????????????
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (rmErr) {
      console.warn('[Merge Chunks] Cleanup temp dir failed:', rmErr.message);
    }

    const taskQueue = require('./services/taskQueue');
    const { startTranscribeTask } = require('./services/videoTranscriber');

    // ??????????????
    const taskName = `涓婁紶瑙嗛(鍒嗙墖): ${fileName}`;
    const task = taskQueue.createTask('video', taskName);

    // ??????????????????? HTTP ?????
    startTranscribeTask(task.id, { 
      url: null, 
      filePath: finalFilePath, 
      fileName: fileName, 
      language, 
      subtitle 
    });

    res.json({
      success: true,
      taskId: task.id,
      status: task.status
    });
  } catch (error) {
    console.error('[Merge Chunks Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ?????????????????????????????
app.post('/api/materials/upload-direct', upload.single('video'), (req, res) => {
  try {
    const file = req.file;
    if (!file) {
    return res.status(400).json({ success: false, error: '鏈帴鏀跺埌鏈夋晥鏂囦欢鏁版嵁' });
    }

    // ????????????????????????????????????????????????
    const ext = path.extname(file.originalname) || '.mp4';
    const newFilename = `${file.filename}${ext}`;
    const newPath = path.join(uploadDir, newFilename);
    
    fs.renameSync(file.path, newPath);

    // ?????????????????????????????????????????? URL
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const directUrl = `${protocol}://${host}/api/temp_videos/${newFilename}`;

    res.json({
      success: true,
      url: directUrl,
      fileName: file.originalname
    });
  } catch (error) {
    console.error('[Upload Direct Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/materials/fetch-video', upload.single('video'), async (req, res) => {
  try {
    const { url, language = 'auto', subtitle = '' } = req.body;
    const file = req.file;
    
    if (!url && !file) {
      return res.status(400).json({ success: false, error: '缂哄皯蹇呰鍙傛暟: 蹇呴』鎻愪緵 url 鎴栦笂浼?video 鏂囦欢' });
    }

    const taskQueue = require('./services/taskQueue');
    const { startTranscribeTask } = require('./services/videoTranscriber');

    // ??????????????
    const taskName = url ? `缃戦〉瑙嗛: ${url}` : `涓婁紶瑙嗛: ${file.originalname || '鏈懡鍚嶈棰?}`;
    const task = taskQueue.createTask('video', taskName);

    // ??????????????????? HTTP ?????
    startTranscribeTask(task.id, { 
      url, 
      filePath: file ? file.path : null, 
      fileName: file ? file.originalname : null, 
      language, 
      subtitle 
    });

    res.json({
      success: true,
      taskId: task.id,
      status: task.status
    });
  } catch (error) {
    console.error('[Fetch Video Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ??????????????????????
app.get('/api/tasks', (req, res) => {
  try {
    const taskQueue = require('./services/taskQueue');
    res.json({ success: true, tasks: taskQueue.getAllTasks() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ??????????????/??
app.get('/api/tasks/:taskId', (req, res) => {
  try {
    const taskQueue = require('./services/taskQueue');
    const task = taskQueue.getTask(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: '浠诲姟涓嶅瓨鍦ㄦ垨宸茶繃鏈? });
    }
    res.json({ success: true, ...task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Whisper ????????????? API???????????????? 9router ??????? CORS ??????????
app.post('/api/audio/transcriptions', upload.any(), async (req, res) => {
  let fileObj = null;        // 声明在 try 外，finally 可访问
  let tempFilePath = null;   // 记录通过 URL 下载的临时文件路径

  try {
    console.log('[DEBUG STT] Files received:', req.files);
    console.log('[DEBUG STT] Body:', req.body);
    console.log('[DEBUG STT] Content-Type:', req.headers['content-type']);

    // ── 方案 A：JSON body 含 file_url（Dify 工作流传参方式）────────────────
    const bodyFileUrl = req.body && (req.body.file_url || req.body.fileUrl);
    if (bodyFileUrl) {
      const fileName = (req.body.file_name || req.body.fileName || 'audio.mp3');
      tempFilePath = require('path').join(os.tmpdir(), `stt-${Date.now()}-${fileName}`);

      // 将 Dify Docker 内部地址替换为公网可访问地址
      const difyBase = process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
      const difyOrigin = new URL(difyBase).origin;
      let targetUrl = bodyFileUrl
        .replace(/^http:\/\/api:\d+/, difyOrigin)   // api:5001 → 公网域名
        .replace(/^http:\/\/localhost:\d+/, difyOrigin); // localhost:xxx → 公网域名
      // 相对路径补全
      if (targetUrl.startsWith('/')) {
        targetUrl = difyOrigin + targetUrl;
      }

      console.log('[STT URL] 正在从 Dify 下载音频文件:', targetUrl);
      const dlRes = await fetch(targetUrl, {
        headers: { 'Authorization': req.headers.authorization || '' }
      });
      if (!dlRes.ok) {
        throw new Error(`Dify 文件下载失败: HTTP ${dlRes.status}`);
      }
      const buf = await dlRes.arrayBuffer();
      fs.writeFileSync(tempFilePath, Buffer.from(buf));
      fileObj = {
        path: tempFilePath,
        mimetype: dlRes.headers.get('content-type') || 'audio/mpeg',
        originalname: fileName
      };
      console.log('[STT URL] 文件下载完成，大小:', buf.byteLength, 'bytes');
    } else {
      // ── 方案 B：multipart form-data（前端直接上传）────────────────────────
      if (req.file) {
        fileObj = req.file;
      } else if (req.files && req.files.length > 0) {
        fileObj = req.files[0];
      }
    }

    if (!fileObj) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    if (typeof globalThis.FormData !== 'undefined') {
      const fileBuffer = fs.readFileSync(fileObj.path);
      const mimeType = fileObj.mimetype;
      const originalName = fileObj.originalname || 'audio.mp3';

      const modelsToTry = [
        { model: 'local/whisper-cpu', url: 'http://127.0.0.1:8080/inference' },
        { model: 'groq/whisper-large-v3', response_format: 'json' },
        { model: 'openai/whisper-1', response_format: 'json' },
        { model: 'aai/universal-3-pro' }
      ];

      let lastError = null;
      let successData = null;

      for (const config of modelsToTry) {
        try {
          console.log(`[STT Polling] 姝ｅ湪灏濊瘯璋冪敤鎺ュ彛锛屾ā鍨? ${config.model}`);
          let response;
          let data;

          if (config.model === 'local/whisper-cpu') {
            const formData = new globalThis.FormData();
            const blob = new globalThis.Blob([fileBuffer], { type: mimeType });
            formData.append('file', blob, originalName);

            response = await fetch(config.url, {
              method: 'POST',
              body: formData,
            });
            data = await response.json().catch(() => ({}));
          } else {
            const formData = new globalThis.FormData();
            const blob = new globalThis.Blob([fileBuffer], { type: mimeType });
            formData.append('file', blob, originalName);
            formData.append('model', config.model);
            if (config.response_format) {
              formData.append('response_format', config.response_format);
            }

            response = await fetch('https://9router.234124123.xyz/v1/audio/transcriptions', {
              method: 'POST',
              headers: {
                'Authorization': req.headers.authorization || 'Bearer sk-899c9c34738f61b5-2u53op-6ed8a313',
              },
              body: formData,
            });
            data = await response.json().catch(() => ({}));
          }  
          if (response.ok && data && (data.text || typeof data === 'object')) {
            successData = data;
            console.log(`[STT Polling] 妯″瀷 ${config.model} 璋冪敤鎴愬姛`);
            break;
          } else {
            const errStr = data?.error?.message || data?.error || JSON.stringify(data);
            console.warn(`[STT Polling] 妯″瀷 ${config.model} 澶辫触锛岀姸鎬佺爜: ${response.status}, 璇︽儏: ${errStr}`);
            lastError = new Error(`Model ${config.model} status ${response.status}: ${errStr}`);
          }
        } catch (err) {
          console.warn(`[STT Polling] 妯″瀷 ${config.model} 璇锋眰寮傚父:`, err.message);
          lastError = err;
        }
      }

      if (successData) {
        return res.json(successData);
      } else {
        console.error('[STT Polling] 鎵€鏈夎闊宠浆鏂囧瓧鎺ュ彛鍧囪皟鐢ㄥけ璐ャ€?);
        return res.status(500).json({ error: 'All transcription APIs failed.', details: lastError?.message });
      }
    } else {
      throw new Error('鏈嶅姟鍣?Node.js 鐗堟湰杈冧綆锛屼笉鏀寔鍘熺敓鐨?FormData锛岃鍗囩骇 Node.js 鑷?18.0 鎴栨洿楂樼増鏈€?);
    }
  } catch (error) {
    console.error('Whisper 中转失败:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    // 清理通过 URL 下载的临时文件
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
    // 清理 multipart 上传的临时文件
    if (req.files && Array.isArray(req.files)) {
      for (const f of req.files) {
        if (f.path && fs.existsSync(f.path)) {
          try { fs.unlinkSync(f.path); } catch (e) {}
        }
      }
    }
  }
});

app.use((req, res) => res.status(404).json({ error: "Endpoint not found" }));

// ==========================================
// ??????????????????? TTS ????????????????????
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]', reason);
  ttsLongLock = false;
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
  ttsLongLock = false;
});

app.listen(PORT, () => {
  console.log(`Real Vocab Server running on port ${PORT}`);
  console.log(`Database connected at: ${dbPath}`);

  const dreamingIntervalMs = Number(process.env.MEMORY_DREAMING_INTERVAL_MS || 30 * 60 * 1000);
  if (dreamingIntervalMs > 0) {
    setTimeout(() => {
      runMemoryDreamingJob().catch((e) => console.error('[Memory Dreaming] startup run failed:', e));
    }, 60 * 1000);
    setInterval(() => {
      runMemoryDreamingJob().catch((e) => console.error('[Memory Dreaming] periodic run failed:', e));
    }, dreamingIntervalMs);
    console.log(`[Memory Dreaming] scheduled every ${Math.round(dreamingIntervalMs / 60000)} min`);
    if (isLlmDreamingEnabled()) {
      console.log('[Memory Dreaming] LLM layer enabled (DIFY_MEMORY_DREAMING_API_KEY set)');
    }
    if (isProfileDedupeEnabled()) {
      console.log('[Profile Dedupe] LLM layer enabled (DIFY_PROFILE_DEDUPE_API_KEY set)');
    }
    if (isKbSyncEnabled()) {
      console.log('[Memory Dreaming] KB sync enabled (mychat dataset create-by-text)');
    }
    if (isDreamingClusterEnabled()) {
      console.log(`[Memory Dreaming] cluster enabled (pool=${getDreamClusterPoolSize()}, sim>=${getDreamClusterMinSimilarity()})`);
    }
  }
  dailyPackCron.scheduleDailyPackCron(db);
});
