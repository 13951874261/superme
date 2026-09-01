const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const {
  isSingleEnglishWord,
  fetchCambridgeEntry,
  mergeCambridgeWithDify,
  sanitizeExampleSentences,
  isInstantTemplateCollocation,
} = require('./services/cambridgeDictionary');
const { resolveDifyEmbedSession } = require('./services/difyEmbedSession');
const {
  dedupeProfileLocal,
  compressProfileLocal,
  parseProfileDedupeXml,
  extractDedupeRawFromWorkflowData,
} = require('./services/profileDedupe');

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

// ??????????????
require('dotenv').config({ path: path.join(__dirname, '.env') });

const KNOWLEAGE_PRO_SCENARIOS_DATASET_ID = 'c53857b1-f54f-42ef-a6e8-fe54e9333862';

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));

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
const tacticsMediaDir = path.join(__dirname, 'public', 'tactics_media');
if (!fs.existsSync(tacticsMediaDir)) {
  fs.mkdirSync(tacticsMediaDir, { recursive: true });
}
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));

app.get('/api/vocab/health', (_req, res) => {
  res.json({ success: true, ok: true, service: 'vocab-server' });
});

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
    user_id TEXT DEFAULT 'lzhmy',
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

// 生词本字段 Migration
try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN user_id TEXT DEFAULT 'lzhmy'").run();
  console.log('Migration: Added user_id column to vocabulary table.');
} catch (err) {}

try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN category TEXT DEFAULT 'business'").run();
  console.log('Migration: Added category column to vocabulary table.');
} catch (err) {
  // 已经存在该列
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

// 迁移历史 memory_aids 列
try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN memory_aids TEXT").run();
  console.log('Migration: Added memory_aids column to vocabulary table.');
} catch (err) {
  // 已经存在该列
}

// 归属存量历史数据至主账号 lzhmy
try {
  const normUserResult = db.prepare(`
    UPDATE vocabulary
    SET user_id = 'lzhmy'
    WHERE user_id IS NULL OR user_id = ''
  `).run();
  if (normUserResult.changes > 0) {
    console.log(`[Vocab] Backfilled ${normUserResult.changes} legacy vocabulary rows to user_id 'lzhmy'`);
  }
} catch (err) {
  console.warn('Migration: vocabulary user_id backfill skipped:', err?.message || err);
}

// 复习/列表查询索引（支持按账号多租户隔离与毫秒级查询）
try {
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_user_id ON vocabulary(user_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_user_category_added ON vocabulary(user_id, category, added_at DESC)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_user_review_opt ON vocabulary(user_id, category, next_review_date, repetitions)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_user_word ON vocabulary(user_id, word COLLATE NOCASE)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_review ON vocabulary(next_review_date, repetitions)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_review_optimized ON vocabulary(category, next_review_date, repetitions)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_added_at ON vocabulary(added_at)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_added_at_desc ON vocabulary(added_at DESC)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_vocab_category_added_at ON vocabulary(category, added_at DESC)').run();
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
    level TEXT,
    created_at INTEGER
  )
`).run();

try {
  db.prepare('ALTER TABLE dict_query_log ADD COLUMN level TEXT').run();
  console.log('Migration: Added level column to dict_query_log table.');
} catch (e) {}
try {
  db.prepare('ALTER TABLE dict_query_log ADD COLUMN user_id TEXT').run();
  console.log('Migration: Added user_id column to dict_query_log table.');
} catch (e) {}

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

// 性能加速索引
try {
  db.prepare('CREATE INDEX IF NOT EXISTS idx_dict_log_success ON dict_query_log(is_success)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_dict_log_level ON dict_query_log(is_success, level)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_dict_log_user_word ON dict_query_log(user_id, word, dict_type, is_success)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_training_attempt_session ON training_attempts(session_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_training_attempt_user_scene ON training_attempts(user_id, scene_type, module_type)').run();
  console.log('Migration: Created performance indexes successfully.');
} catch (err) {
  console.warn('Migration: training/dict indexes skipped:', err?.message || err);
}

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
// 创建 game_theory_tactics 表
db.prepare(`
  CREATE TABLE IF NOT EXISTS game_theory_tactics (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    is_custom INTEGER DEFAULT 0,
    source_file TEXT,
    created_at INTEGER
  )
`).run();

try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS game_theory_tactics_media (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      task_id TEXT,
      file_path TEXT,
      public_url TEXT,
      transcript TEXT,
      duration_sec REAL,
      source_name TEXT,
      created_at INTEGER
    )
  `).run();
} catch (e) {
  console.error('Failed to init game_theory_tactics_media:', e.message);
}

try {
  const cols = db.prepare('PRAGMA table_info(game_theory_tactics)').all();
  if (!cols.some((c) => c.name === 'media_id')) {
    db.prepare('ALTER TABLE game_theory_tactics ADD COLUMN media_id TEXT').run();
  }
} catch (e) {
  console.warn('ALTER game_theory_tactics.media_id skipped:', e.message);
}

// 插入默认手段（按名称补种，旧库非空时也会补上新手段）
try {
  const { seedGameTheoryTactics } = require('./services/gameTheoryTacticsSeed');
  seedGameTheoryTactics(db);
} catch (e) {
  console.error('Failed to initialize game_theory_tactics:', e.message);
}


// 博弈对局历史（案例研判 / 人机对战）
db.prepare(`
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

try {
  db.prepare('ALTER TABLE user_memories ADD COLUMN learning_ui_json TEXT').run();
  console.log('Migration: Added learning_ui_json column to user_memories.');
} catch (e) {
  /* column may already exist */
}

// 邀请制访问名单：空表即无人可登录，账号只能由 scripts/invite-account.js 手动写入
db.prepare(`
  CREATE TABLE IF NOT EXISTS invited_accounts (
    user_id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  )
`).run();

const dailyPackService = require('./services/dailyPackService');
const learningUiService = require('./services/learningUiService');
learningUiService.ensureLearningUiColumn(db);

/** 客户端未传完整画像时，从 SQLite 拼职业+短板+L3+账本+图谱 */
function resolveProfileForDify(userId, incoming, recallQuery) {
  return dailyPackService.resolveUserCurrentProfileForDify(db, userId, incoming, {
    recallQuery: recallQuery || undefined,
  });
}
const dailyPackCron = require('./services/dailyPackCron');
dailyPackService.initDailyPackTables(db);
const dailyCronRunService = require('./services/dailyCronRunService');
dailyCronRunService.initDailyCronRunTables(db);
try {
  const interrupted = dailyCronRunService.markInterruptedRunning(db);
  if (interrupted.runsInterrupted || interrupted.stepsInterrupted) {
    console.log('[DailyCronRun] startup interrupt', interrupted);
  }
  const cleaned = dailyCronRunService.cleanupOldCronRuns(db);
  if (cleaned.deletedRuns) {
    console.log('[DailyCronRun] retention cleanup', cleaned);
  }
} catch (e) {
  console.warn('[DailyCronRun] startup maintenance failed:', e.message);
}
const dailyListenPreGenerateService = require('./services/dailyListenPreGenerateService');
dailyListenPreGenerateService.initDailyListenTables(db);
const oralOpeningCacheService = require('./services/oralOpeningCacheService');
oralOpeningCacheService.initOralOpeningTables(db);
setImmediate(() => {
  dailyListenPreGenerateService.resumeInterruptedListenJobs(db)
    .then((result) => {
      if (result?.resumed) {
        console.log('[DailyListen Cron] resumed interrupted jobs', result);
      }
    })
    .catch((e) => {
      console.warn('[DailyListen Cron] resume interrupted failed:', e.message);
    });
});
const listenPrefsService = require('./services/listenPrefsService');
listenPrefsService.initListenPrefsTable(db);
const aestheticsPushService = require('./services/aestheticsPushService');
aestheticsPushService.initAestheticsPushTables(db);
const aestheticsPush = aestheticsPushService.createService({
  db,
  apiKey: process.env.DIFY_HIGH_AESTHETICS_GENERATOR_API_KEY,
  baseUrl: process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1'
});
const { createReadPenetrationAnalyzer } = require('./services/readPenetrationProxy');
const { createWorkflowRunner, createWorkflowUploader } = require('./services/englishWorkflowProxy');
const { analyzeListening } = require('./services/listenAnalysisService');
const { normalizePrototypeArchive, isTestFixturePrototypeName, filterVisiblePrototypes } = require('./services/prototypeArchiveGuard');
const { initGameTheorySessionTables, createGameTheorySessionService } = require('./services/gameTheorySessionService');
initGameTheorySessionTables(db);
const gameTheoryCasePushService = require('./services/gameTheoryCasePushService');
gameTheoryCasePushService.initGameTheoryCasePushTables(db);
const gameTheoryCasePush = gameTheoryCasePushService.createService({
  db,
  apiKey: process.env.DIFY_GAME_THEORY_CASE_GEN_KEY,
  baseUrl: process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1'
});
const { evaluateSentence } = require('./services/sentenceEvaluationService');
const { purifyVocabulary } = require('./services/vocabPurifyService');
const vocabMatrixEnricher = require('./services/vocabMatrixEnricher');
const { analyzeWriting, normalizeResult: normalizeWritingResult, isMeaningfulResult: isMeaningfulWritingResult } = require('./services/writeGovernanceFallback');
const difyWorkflowBaseUrl = process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
const analyzeReadPenetration = createReadPenetrationAnalyzer({
  apiKey: process.env.DIFY_READ_PENETRATION_KEY || process.env.VITE_DIFY_READ_PENETRATION_KEY,
  baseUrl: difyWorkflowBaseUrl
});
const englishWorkflowRunners = {
  wakeup: createWorkflowRunner({ apiKey: process.env.DIFY_WAKEUP_API_KEY, baseUrl: difyWorkflowBaseUrl }),
  speechEvaluation: createWorkflowRunner({ apiKey: process.env.DIFY_SPEECH_EVAL_API_KEY, baseUrl: difyWorkflowBaseUrl }),
  writeGovernance: createWorkflowRunner({ apiKey: process.env.DIFY_WRITE_GOVERNANCE_API_KEY, baseUrl: difyWorkflowBaseUrl }),
  speechPrompter: createWorkflowRunner({ apiKey: process.env.DIFY_SPEECH_PROMPTER_API_KEY, baseUrl: difyWorkflowBaseUrl }),
  speechExemplar: createWorkflowRunner({ apiKey: process.env.DIFY_SPEECH_EXEMPLAR_API_KEY, baseUrl: difyWorkflowBaseUrl }),
};
const uploadSpeechEvaluation = createWorkflowUploader({ apiKey: process.env.DIFY_SPEECH_EVAL_API_KEY, baseUrl: difyWorkflowBaseUrl });
const speechAudioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const gameTheorySession = createGameTheorySessionService({
  db,
  baseUrl: difyWorkflowBaseUrl,
  keys: {
    round: process.env.DIFY_GAME_THEORY_SESSION_ROUND_KEY,
    summary: process.env.DIFY_GAME_THEORY_SESSION_SUMMARY_KEY,
    review: process.env.DIFY_GAME_THEORY_SESSION_REVIEW_KEY,
  },
});

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
    const rawResult = extractDedupeRawFromWorkflowData(data);
    const parsed = parseProfileDedupeXml(rawResult);
    if (!parsed?.mergedProfile) {
      const preview = String(rawResult || '').replace(/\s+/g, ' ').slice(0, 240);
      console.warn('[Profile Dedupe] parse_failed raw preview:', preview || '(empty outputs)');
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

const MANUAL_PROFILE_COMPRESS_DELTA = '【手动压缩】对已有画像全文做语义去重与精炼，合并重复主题，保留最新信息；忽略本条提示本身。';

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

  // Local 精要兜底：按句/分号拆分去重，并限制长度（修复原先单段长文无法压缩的问题）
  return compressProfileLocal(text, 600);
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
  if (/澳式|澳大利亚|\(AU\)|\bAU\b|澳洲/i.test(raw)) {
    delta.accent = 'AU';
  } else if (/英音|英国|\(UK\)|\bUK\b|\[profile:\s*uk\]/i.test(raw)) {
    delta.accent = 'UK';
    delta.spelling_variant = 'UK';
  } else if (/美音|美国|\(US\)|\bUS\b|\[profile:\s*us\]/i.test(raw)) {
    delta.accent = 'US';
    delta.spelling_variant = 'US';
  }
  if (/即兴/.test(raw) && /表达|口语/.test(raw)) {
    delta.training_goal = '即兴表达';
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
  return `${index + 1}. [${source}${at ? `·${at}` : ''}] ${text}`;
}

function buildMemoryContextForUser(userId) {
  const uid = normalizeMemoryUserId(userId);
  const row = db.prepare('SELECT profile_content, memory_layers, error_ledger FROM user_memories WHERE user_id = ?').get(uid);
  const memoryLayers = parseJsonObject(row?.memory_layers, {});
  const ledger = parseJsonObject(row?.error_ledger, {});
  const profileSummary = String(row?.profile_content || '').trim().slice(0, 600)
    || '暂无用户画像摘要。';

  const episodeLines = (Array.isArray(memoryLayers.l2_episodes) ? memoryLayers.l2_episodes : [])
    .slice(0, 5)
    .map(formatEpisodeLine)
    .filter(Boolean);
  const recentEpisodesSummary = episodeLines.length
    ? episodeLines.join('\n')
    : '暂无近期情景记忆。';

  const errorParts = [];
  for (const cat of ['oral', 'listening', 'vocab']) {
    const items = ledger[cat];
    if (!Array.isArray(items) || !items.length) continue;
    const top = items.slice(0, 3).map((e) => {
      if (cat === 'oral') return e.flaw;
      if (cat === 'listening') return e.pattern || e.reason;
      return e.word;
    }).filter(Boolean);
    if (top.length) errorParts.push(`${cat}: ${top.join('、')}`);
  }
  const errorLedgerSummary = errorParts.length
    ? errorParts.join('; ')
    : '暂无结构化短板记录。';

  const graphSummary = formatGraphSummary(memoryLayers);

  return { profileSummary, recentEpisodesSummary, errorLedgerSummary, graphSummary, memoryLayers };
}

function normalizeGraphNodeName(name) {
  return String(name || '').trim().slice(0, 80);
}

function formatGraphSummary(memoryLayers) {
  const graph = memoryLayers?.l2_graph;
  if (!graph || typeof graph !== 'object') return '暂无关系记忆。';
  const relations = Array.isArray(graph.relations) ? graph.relations.slice(0, 8) : [];
  if (!relations.length) return '暂无关系记忆。';
  return relations.map((r, i) => {
    const ev = r.evidence ? ` (${String(r.evidence).slice(0, 60)})` : '';
    return `${i + 1}. ${r.from} —[${r.rel}]→ ${r.to}${ev}`;
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
    const rel = String(r.rel || r.relation || '关联').trim().slice(0, 40);
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

/** LLM 未输出 relations 时，从 episode/画像文本规则合成基础图谱 */
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
    pushEntity(from, from === '用户' ? 'person' : 'concept');
    pushEntity(to, 'concept');
    relations.push({ from, rel, to, evidence: String(evidence || corpus).slice(0, 120) });
  };

  pushEntity('用户', 'person');
  const evidence = texts[0] || corpus;
  if (/英音|英国|\(UK\)|\bUK\b/i.test(corpus)) {
    pushRel('用户', '偏好', '英音', evidence);
  }
  if (/美音|美国|\(US\)|\bUS\b/i.test(corpus)) {
    pushRel('用户', '偏好', '美音', evidence);
  }
  if (/即兴/.test(corpus) && /逻辑|表达/.test(corpus)) {
    pushRel('用户', '正在练习', '即兴表达逻辑链', evidence);
  }

  return { entities, relations };
}

/** 从 LLM 已输出的 semantics 合成关系（工作流未返回 relations 时的兜底） */
function graphFromSemantics(semantics) {
  const entities = [{ name: '用户', type: 'person' }];
  const relations = [];
  if (!Array.isArray(semantics)) return { entities, relations };

  for (const sem of semantics.slice(0, 5)) {
    if (!sem || typeof sem !== 'object') continue;
    const pattern = String(sem.pattern || sem.tag?.split(':').slice(1).join(':') || '').trim();
    if (!pattern) continue;
    const category = String(sem.category || 'general').trim();
    const rel = category === 'oral' ? '正在练习' : category === 'general' ? '特征' : '短板';
    if (!entities.some((e) => e.name === pattern)) {
      entities.push({ name: pattern, type: 'concept' });
    }
    relations.push({
      from: '用户',
      rel,
      to: pattern,
      evidence: String(sem.evidence || pattern).slice(0, 120),
    });
  }
  return { entities, relations };
}

function composeMemorySummaryForPrompt(memoryCtx) {
  const parts = [memoryCtx.recentEpisodesSummary];
  if (memoryCtx.graphSummary && memoryCtx.graphSummary !== '暂无关系记忆。') {
    parts.push(`关系记忆（Graph）：\n${memoryCtx.graphSummary}`);
  }
  return parts.join('\n\n');
}

const ACCENT_AUTHORITY_LABELS = {
  AU: '澳式口音',
  UK: '英音',
  US: '美式口音',
};

function resolveAuthoritativeAccent(profileText, l3Vars) {
  const p = String(profileText || '');
  const ausCount = (p.match(/澳式|澳大利亚/g) || []).length;
  const ukCount = (p.match(/英音|英式/g) || []).length;
  if (ausCount > 0 && ausCount >= ukCount) return 'AU';
  if (/美式/.test(p)) return 'US';
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
    if (/英音|英式|accent\s*=\s*UK/i.test(s) && !/澳式|澳大利亚/.test(s)) return '';
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
      `【口音偏好（权威）】用户练口语偏好${authLabel}。`
      + '若下文 graph/episode/向量库/旧侧写/L3 出现与此冲突的其他口音表述，一律以本行为准，视为过期记录。',
    );
  }
  if (recallContext) {
    sections.push(`【结构化即时召回】\n${recallContext}`);
  }
  const ctxParts = [];
  if (profileSummary && profileSummary !== '暂无用户画像摘要。') {
    ctxParts.push(`【用户画像】\n${profileSummary}`);
  }
  if (recentEpisodesSummary && recentEpisodesSummary !== '暂无近期情景记忆。') {
    ctxParts.push(`【近期情景】\n${recentEpisodesSummary}`);
  }
  if (errorLedgerSummary && errorLedgerSummary !== '暂无结构化短板记录。') {
    ctxParts.push(`【训练短板】\n${errorLedgerSummary}`);
  }
  if (graphSummary && graphSummary !== '暂无关系记忆。') {
    ctxParts.push(`【关系记忆】\n${graphSummary}`);
  }
  const l3 = ctx.memoryLayers?.l3_vars;
  if (l3 && typeof l3 === 'object') {
    const l3Copy = { ...l3 };
    if (authAccent === 'AU' && l3Copy.accent === 'UK') {
      l3Copy.accent = 'AU';
    }
    if (l3Copy.accent) {
      ctxParts.push(`【L3变量】\naccent=${l3Copy.accent}${l3Copy.training_goal ? `\ntraining_goal=${l3Copy.training_goal}` : ''}`);
    }
  }
  if (ctxParts.length) {
    sections.push(`【画像与关系上下文】\n${ctxParts.join('\n\n')}`);
  }
  return sections.join('\n\n').trim();
}

function buildRecallQueryFromUserQuery(query) {
  const q = String(query || '').trim();
  const keywords = ['口音', '英式', '英音', '澳式', '美式', '偏好', '习惯', '目标', '边界'];
  const found = keywords.filter((kw) => q.includes(kw));
  return found.length ? found.join(' ') : (q.slice(0, 80) || 'memory');
}

function normalizeRecallQuery(query) {
  return String(query || '').trim().toLowerCase();
}

function recallQueryTokens(query) {
  const q = normalizeRecallQuery(query);
  if (!q) return [];
  const parts = q.split(/[\s,，;；、。！？!?]+/).filter((t) => t.length >= 2);
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
        text: `${r.from} —[${r.rel}]→ ${r.to}`.slice(0, 180),
        at: Number(r.at || 0),
        key: `graph:${r.from}|${r.rel}|${r.to}`,
      });
    }
  }

  hits.sort((a, b) => (b.score - a.score) || (b.at - a.at));
  const items = hits.slice(0, limit);
  const context = items.length
    ? items.map((item, i) => {
      const src = item.source ? ` · ${item.source}` : '';
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
  return `${source}·${hint}·${batch.length}条`;
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
  const title = `Dreaming摘要·${userId}·${dreamDate}`.slice(0, 120);
  const text = `[用户 ${userId} · ${episode.source || 'unknown'}]\n${summary}\n\n画像上下文: ${String(profileContent || '').slice(0, 300)}`;

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
  const row = db.prepare('SELECT user_id, profile_content, error_ledger, memory_layers, updated_at FROM user_memories WHERE user_id = ?').get(uid);
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
  const row = db.prepare('SELECT user_id, profile_content, error_ledger, memory_layers, updated_at FROM user_memories WHERE user_id = ?').get(uid);
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

  const row = db.prepare('SELECT user_id, profile_content, error_ledger, memory_layers, updated_at FROM user_memories WHERE user_id = ?').get(uid);
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
  if (easeFactor < 1.3) easeFactor = 1.3; // 下限

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

  if (model === 'nb/nanobanana-flash' || model === 'nb/nanobanana-pro' || model === 'ag/gemini-3.1-flash-image') {
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
    return { ok: false, error: `无效的请求地址: ${requestUrl}` };
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
            error: `生图服务返回数据解析失败 (HTTP ${res.statusCode}): ${rawText.substring(0, 200) || '无法解析的响应内容'}`
          });
          return;
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          const errMsg = responseData?.error?.message || responseData?.error || responseData?.message || JSON.stringify(responseData).substring(0, 200);
          resolve({ ok: false, error: `生图服务返回错误状态码 (${res.statusCode}): ${errMsg}` });
          return;
        }

        const { imageUrl, downloadUrl, revisedPrompt } = extractGeneratedImageUrl(responseData);
        if (!imageUrl) {
          resolve({
            ok: false,
            error: `生图成功但未找到图片地址或 Base64 数据: ${JSON.stringify(responseData).substring(0, 200)}`
          });
          return;
        }

        resolve({ ok: true, imageUrl, downloadUrl, revisedPrompt });
      });
    });

    req.on('error', (error) => {
      resolve({ ok: false, error: `生图服务连接失败 (${model} @ ${baseUrl}): ${error.message || error}` });
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

// ==========================================
// ?????????????????????????????????????????
// ==========================================

/** 合并 Dify SSE 流式 answer：兼容增量 delta 与全量 cumulative 两种模式 */
const {
  mergeStreamAnswer,
  estimateEnglishWordCount,
  softWordLimitForDuration,
  isOverSoftWordLimit,
  stripThinkTags,
  prepareLongArticleBody,
  isUsableLongArticle,
} = require('./services/difyStreamMerge');

/** 将 Dify / 下游模型错误转为可操作的提示（daily-extract、completion 等共用） */
function formatDifyModelError(raw) {
  const text = String(raw || '').trim();
  if (!text) return 'Dify 模型调用失败，未返回错误详情';
  if (/Server Unavailable|ConnectTimeout|fusion panel|Max retries exceeded|503/i.test(text)) {
    return [
      'Dify 下游 LLM 推理服务不可用（融合面板所有模型均失败或连接超时）。',
      '长文生成应用：materail_generate_url_enhanced',
      '鉴权环境变量：DIFY_ENGLISH_MASTERY_KEY',
      `本地兜底网关：${process.env.LLM_URL || 'https://fetch.234124123.xyz/v1/chat/completions'}（模型 ${process.env.LLM_MODELS || 'mart-paid'}）。`,
      '请在 Dify → 设置 → 模型供应商 → OpenAI-API-compatible 检查 Base URL 与模型名，或在 aow 网关后台检查通道健康状态。',
    ].join(' ');
  }
  if (/^\[models\]/i.test(text)) return `Dify 模型调用失败: ${text}`;
  return text;
}

/** 清洗听力长文稿：去掉 Dify 模板头与词汇 JSON 段，仅保留可朗读正文 */
function sanitizeListenMaterialScript(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let script = raw.trim();
  script = script.replace(/^📝[^\n]*\n+/m, '');
  script = script.replace(/^[^\n]*(生成完毕|沉浸式听力|阅读长篇材料)[^\n]*\n+/m, '');
  script = script.split(/---VOCAB_JSON_START---/i)[0].trim();
  return script;
}

/** 从 Dify chat-messages SSE 流中收集完整 answer；sanitize=false 时保留 VOCAB_JSON 段 */
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

/** 同步 await Dify 长文流式生成，返回原始 answer（可含 VOCAB_JSON）；不走 taskQueue */
async function generateListenLongScriptSync(inputs, userId = 'default-user') {
  const apiKey = process.env.DIFY_LONG_AUDIO_API_KEY || process.env.DIFY_LISTEN_GEN_API_KEY;
  if (!apiKey) {
    throw new Error('缺少关键鉴权参数 (API KEY)');
  }

  const baseUrl = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  const duration = String((inputs && inputs.duration) || '1');
  const maxAttempts = 2; // ??????? 1 ????? D1????? + warning
  let lastAnswer = '';
  const safeInputs = {
    ...(inputs || {}),
    user_current_profile: resolveProfileForDify(
      userId,
      inputs?.user_current_profile,
      inputs?.theme || inputs?.topic,
    ),
  };

  try {
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
            inputs: injectOralSystemTime(safeInputs),
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
        throw new Error('\u63a5\u6536\u6210\u529f\u4f46\u7b54\u6848\u4e3a\u7a7a');
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
  } catch (err) {
    console.warn(`[DailyListen] Dify workflow failed: ${err.message}. Falling back to mock article generation.`);
    const mockArticles = {
      meeting: {
        A2: "In business meetings, talking carefully is important. Both teams need to listen and find simple solutions so everyone is happy with the result.",
        B1: "During modern business negotiations, making small concessions while keeping key requests is essential. Teams should discuss clear goals and compromise when necessary.",
        B2: "In modern business negotiations, making strategic concessions while maintaining firm pressure is essential. Parties must analyze core interests, identify flexible boundaries, and communicate with high emotional intelligence.",
        C1: "Navigating high-stakes commercial negotiations necessitates calculated concessions juxtaposed with unrelenting strategic leverage. Negotiators must scrupulously evaluate underlying motives and articulate nuanced counterproposals."
      },
      news: {
        A2: "Company sales are growing this month. Managers are hiring new workers and opening small stores in big cities to serve more customers.",
        B1: "Recent market reports show that tech supply chains are adapting to new trends. Companies are improving production plans and looking for reliable suppliers.",
        B2: "Industry analysis indicates that global tech supply chains are adapting to rapid market shifts. Executive teams are re-evaluating risk models and optimizing sourcing strategies.",
        C1: "Global macroeconomic volatility has impelled enterprise leaders to recalibrate operational frameworks, hedge foreign exchange exposure, and institute resilient supply networks."
      },
      podcast: {
        A2: "Welcome to our show. Today we talk about good teamwork. Small habits can make daily work much easier and faster for everyone.",
        B1: "Welcome back. Today we discuss effective team communication. Good leaders focus on active listening and giving clear feedback to team members.",
        B2: "Welcome back. Today we discuss leadership under high-pressure scenarios. Successful executives emphasize clarity, active listening, and decisive action in complex environments.",
        C1: "Welcome to executive insights. Today we dissect adaptive leadership paradigms. Prominent CEOs cultivate organizational agility, foster safety, and orchestrate transformative shifts."
      },
      reading: {
        A2: "Good planning helps companies save money. When employees work together nicely, projects finish on time and customers stay happy.",
        B1: "Strategic planning helps businesses navigate daily challenges. Aligning team efforts with company goals ensures steady growth and customer satisfaction.",
        B2: "Strategic flexibility enables organizations to navigate market turbulence. By aligning operational capabilities with strategic vision, enterprises sustain resilience.",
        C1: "Organizational longevity relies upon dynamic capabilities that assimilate nascent technologies. Disruption management requires preemptive resource reallocation."
      }
    };

    const genre = inputs.genre || 'meeting';
    const cefr = inputs.cefr_level || 'B1';
    const body = (mockArticles[genre] && mockArticles[genre][cefr]) || mockArticles.meeting.B1;
    const vocab = [
      { word: "strategy", phonetic: "[\u02c8str\u00e6t\u0259d\u0292i]", translation: "n. \u6218\u7565" },
      { word: "negotiation", phonetic: "[n\u026a\u02cc\u0261\u0259\u028as\u026a\u02c8e\u026a\u0283n]", translation: "n. \u8c08\u5224" }
    ];
    const phrases = ["strategic flexibility", "firm pressure"];
    const sentences = [body.split('.')[0] + '.'];

    return body + "\n\n---VOCAB_JSON_START---\n" + JSON.stringify({
      words: vocab,
      phrases: phrases,
      sentences: sentences
    }) + "\n---VOCAB_JSON_END---\n";
  }
}

app.post('/api/listen/analyze', async (req, res) => {
  const { userInput, standardText, theme = '' } = req.body || {};
  if (!String(standardText || '').trim()) {
    return res.status(400).json({ success: false, error: 'standardText is required' });
  }
  try {
    const result = await analyzeListening({ userInput: String(userInput || ''), standardText: String(standardText || ''), theme: String(theme || '') }, process.env.LISTEN_LLM_API_KEY || '');
    return res.json({ success: true, result });
  } catch (error) {
    console.error('[Listen Analyze] failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
app.post('/api/listen/generate-material', async (req, res) => {
  try {
    const { inputs, userId = 'default-user' } = req.body;
    const apiKey = process.env.DIFY_LISTEN_GEN_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: '后端未配置 DIFY_LISTEN_GEN_API_KEY' });
    }
    const difyUrl = `${process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1'}/completion-messages`;

    const { loadInjectedKnowledgeSafe, attachKnowledgeContext, appendKnowledgeTracesSafe } = require('./services/gameTheoryKnowledge');
    const { evaluateListenScriptHardness } = require('./services/moduleHardnessQuality');
    const injected = loadInjectedKnowledgeSafe(db, userId, 'listen');
    let effectiveInputs = inputs || {};
    if (injected.isDeepened) {
      effectiveInputs = attachKnowledgeContext(effectiveInputs, injected.context);
    }

    const response = await fetch(difyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: effectiveInputs,
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
      return res.status(500).json({ success: false, error: 'Dify 未返回听力材料正文，请检查 listen_material_generator 应用配置' });
    }

    if (injected.isDeepened) {
      const hardnessEval = evaluateListenScriptHardness(data.answer, { injectedKnowledge: injected.context });
      if (!hardnessEval.ok) {
        return res.status(422).json({
          success: false,
          error: `听力材料生成未通过加深难度硬卡门禁: ${hardnessEval.reason}，请重试生成`,
          rejected: true,
          qualityReason: hardnessEval.reason,
        });
      }
      appendKnowledgeTracesSafe(db, userId, injected.ids, { module: 'listen', action: 'generated' });
      afterKnowledgeInjected(userId, injected.ids);
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
    const apiKey = process.env.DIFY_LONG_AUDIO_API_KEY || process.env.DIFY_LISTEN_GEN_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: '缺少关键鉴权参数 (API KEY)' });
    }

    // 引入任务队列，创建任务
    const taskQueue = require('./services/taskQueue');
    const taskTitle = inputs.theme ? `播客文稿: ${inputs.theme}` : '深度播客生成';
    const task = taskQueue.createTask('material', taskTitle);

    // 立即响应给前端 taskId，由前端使用全局的 TaskContext 接管轮询
    res.json({ success: true, taskId: task.id, status: task.status });

    // ========= 以下进入异步后台执行，不会阻塞客户端连接 =========
    (async () => {
      try {
        taskQueue.updateTask(task.id, { progress: 10, logs: ['正在连接智库并初始化推演模型 (Dify API)…'] });
        taskQueue.updateTask(task.id, { progress: 30, logs: ['成功连接，模型正在流式下发剧本数据…'] });

        const rawAnswer = await generateListenLongScriptSync(inputs, userId);
        const answer = sanitizeListenMaterialScript(rawAnswer);
        if (!answer) {
          taskQueue.updateTask(task.id, { status: 'failed', error: '接收成功但答案为空' });
          return;
        }

        const { evaluateListenScriptHardness } = require('./services/moduleHardnessQuality');
        const { loadInjectedKnowledgeSafe, appendKnowledgeTracesSafe } = require('./services/gameTheoryKnowledge');
        const injected = loadInjectedKnowledgeSafe(db, userId, 'listen');
        if (injected.isDeepened) {
          const hardnessEval = evaluateListenScriptHardness(answer, { injectedKnowledge: injected.context });
          if (!hardnessEval.ok) {
            taskQueue.updateTask(task.id, {
              status: 'failed',
              error: `长音频剧本未达加深难度门禁 (${hardnessEval.reason})，拒绝录入主文案`,
              result: { rejected: true, qualityReason: hardnessEval.reason },
            });
            return;
          }
          appendKnowledgeTracesSafe(db, userId, injected.ids, { module: 'listen', action: 'generated', taskId: task.id });
          afterKnowledgeInjected(userId, injected.ids);
        }

        if (answer.length < 500) {
          console.warn(`[generate-material-long] suspiciously short script (${answer.length} chars) for task ${task.id}`);
        }

        // 保存生成的文稿内容给前端提取 (保存在 task.result.content)
        taskQueue.updateTask(task.id, {
          progress: 100,
          logs: [`长音频剧本生成圆满完成！（${answer.length} 字符）`],
          status: 'completed',
          result: { content: answer }
        });

      } catch (error) {
        console.error('generate-material-long background task error:', error);
        const msg = error.name === 'AbortError'
          ? '后台任务因超时被中止 (30分钟拦截机制)'
          : error.message;
        taskQueue.updateTask(task.id, { status: 'failed', error: `后台生成异常: ${msg}` });
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

app.get('/api/english/listen-prefs', (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim();
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const voiceId = listenPrefsService.getListenVoiceId(db, userId);
    const stored = db.prepare(
      'SELECT listen_voice_id FROM user_listen_prefs WHERE user_id = ?'
    ).get(userId);
    return res.json({
      success: true,
      voiceId: stored ? voiceId : null,
      effectiveVoiceId: voiceId,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/english/listen-prefs', (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    const voiceId = String(req.body?.voiceId || '').trim();
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const saved = listenPrefsService.upsertListenVoiceId(db, userId, voiceId);
    return res.json({ success: true, voiceId: saved });
  } catch (e) {
    const status = /invalid voice/i.test(e.message) ? 400 : 500;
    return res.status(status).json({ success: false, error: e.message });
  }
});

app.get('/api/listen/pregenerated', (req, res) => {
  try {
    const { userId, theme, genre, cefrLevel, cefr, duration, date } = req.query;
    if (!userId || !theme || !genre || !(cefrLevel || cefr) || !duration) {
      return res.status(400).json({ success: false, error: 'userId, theme, genre, cefrLevel, duration required' });
    }
    const historyExclude = String(req.query.historyExclude ?? dailyPackService.getHistoryExclude(db, userId) ?? '').trim();
    const userFlaws = String(req.query.userFlaws || '').trim();
    const userCurrentProfile = String(
      resolveProfileForDify(userId, req.query.userCurrentProfile),
    ).trim();
    const comboQuery = {
      userId,
      theme,
      genre,
      cefrLevel: cefrLevel || cefr,
      duration: Number(duration),
      date,
      historyExclude,
      userFlaws,
      userCurrentProfile,
    };
    const kick = dailyListenPreGenerateService.startListenSyncFromLongArticleIfNeeded(db, comboQuery);
    res.json(kick.combo);
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
      `定制听力训练素材生成: ${theme} / ${genre} / ${cefrLevel} / ${duration}分钟`,
    );
    console.log(`[听力生成] 收到定制听力素材生成请求: ${theme} / ${genre} / ${cefrLevel} / ${duration}分钟 (任务ID: ${task.id})`);
    res.json({ success: true, taskId: task.id, status: task.status });

    (async () => {
      try {
        taskQueue.updateTask(task.id, { status: 'running', progress: 5, logs: ['[听力生成] 正在组织专业听力对话脚本与语境…'] });
        const mode = only === 'audio' || only === 'article' ? only : 'both';
        const result = await dailyListenPreGenerateService.generateOneCombo(
          db,
          { userId, theme, genre, cefrLevel, duration },
          { source: 'backfill', only: mode },
        );
        console.log(`[听力生成] 定制听力素材生成完成 (任务ID: ${task.id})`);
        taskQueue.updateTask(task.id, {
          status: 'completed',
          progress: 100,
          logs: ['[听力生成] 定制听力训练素材已全部准备就绪'],
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
        console.warn(`[听力容灾] 定制听力素材生成异常 (任务ID: ${task.id}): ${e.message}`);
        taskQueue.updateTask(task.id, { status: 'failed', error: `听力生成服务异常: ${e.message}`, logs: [`[听力容灾] 素材生成中断: ${e.message}`] });
      }
    })();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** C3: 仅补词表，不重跑文章/TTS */
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

app.post('/api/listen/sync-long-article-to-listen', async (req, res) => {
  try {
    const { userId, theme, genre, cefrLevel, duration } = req.body || {};
    if (!userId || !theme || !genre || !cefrLevel || !duration) {
      return res.status(400).json({ success: false, error: 'missing fields: userId, theme, genre, cefrLevel, duration required' });
    }
    if (!dailyListenPreGenerateService.isCacheableDuration(duration)) {
      return res.status(400).json({ success: false, error: 'duration not cacheable' });
    }

    const today = dailyPackService.getPackDate();
    const uid = dailyPackService.normalizeUserId(userId);
    const articleRow = db.prepare(`
      SELECT * FROM daily_extracted_articles
      WHERE user_id = ? AND quota_date = ? AND theme = ? AND genre = ? AND cefr_level = ? AND duration = ?
      ORDER BY updated_at DESC LIMIT 1
    `).get(uid, today, theme, genre, cefrLevel, String(Number(duration)));
    const scriptText = String(articleRow?.article || articleRow?.article_text || articleRow?.body_text || '').trim();
    if (!articleRow || !scriptText) {
      return res.status(404).json({ success: false, error: '当天当前主题、题材、难度和时长下无可用长文，请先生成对应长文' });
    }

    const taskQueue = require('./services/taskQueue');
    const taskName = `盲听音频重生(今日长文): ${theme} / ${genre} / ${cefrLevel} / ${duration}m`;
    const task = taskQueue.createTask('listen_backfill', taskName);
    res.json({ success: true, taskId: task.id, status: task.status });

    (async () => {
      try {
        taskQueue.updateTask(task.id, { status: 'running', progress: 5, logs: ['[盲听生成] 正在使用当天长文重新合成音频…'] });
        const syncRes = await dailyListenPreGenerateService.syncAudioFromLongArticleRow(
          db,
          articleRow,
          'manual-sync',
          { force: true },
        );
        if (!syncRes?.success) throw new Error(syncRes?.error || '音频合成失败');
        taskQueue.updateTask(task.id, {
          status: 'completed',
          progress: 100,
          logs: ['[盲听生成] 当天长文音频已重新生成'],
          result: {
            audioUrl: `${syncRes.audioUrl}?v=${Date.now()}`,
            content: scriptText,
            articleId: articleRow.id,
          },
        });
      } catch (e) {
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: `音频合成异常: ${e.message}`,
          logs: [`[盲听生成] 中断: ${e.message}`],
        });
      }
    })();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==========================================
// 听力材料上传接口（保存文件并返回URL）
// ==========================================
app.post('/api/listen/upload-audio', upload.any(), async (req, res) => {
  try {
    const file = req.files?.[0];
    if (!file) {
      return res.status(400).json({ success: false, error: '未上传音频文件' });
    }

    // 生成唯一文件名避免冲突
    const uniqueName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(__dirname, 'public', 'long_audio', uniqueName);

    // 保存上传的文件
    fs.writeFileSync(filePath, fs.readFileSync(file.path));

    // 自动转写音频获取标准原文（必须用已保存路径，multer 临时文件稍后才删）
    let transcript = '';
    try {
      const { transcribeAudioFile } = require('./services/audioTranscriptionService');
      const userId = req.body ? (req.body.userId || 'default-user') : 'default-user';
      transcript = await transcribeAudioFile({ ...file, path: filePath }, userId);

      const transcriptDir = path.join(__dirname, 'public', 'long_audio_transcripts');
      if (!fs.existsSync(transcriptDir)) {
        fs.mkdirSync(transcriptDir, { recursive: true });
      }
      const transcriptPath = path.join(transcriptDir, `${uniqueName}.txt`);
      fs.writeFileSync(transcriptPath, transcript, 'utf8');

      console.log('[Upload Audio] 转写成功，文本长度: ' + transcript.length);
    } catch (transcribeErr) {
      console.error('[Upload Audio] 转写失败:', transcribeErr.message);
    } finally {
      if (file.path && file.path !== filePath && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    // 返回音频 URL 与转录文本
    res.json({
      success: true,
      audioUrl: `/api/long_audio/${encodeURIComponent(uniqueName)}`,
      fileName: file.originalname,
      uniqueName: uniqueName,
      transcript: transcript
    });
  } catch (error) {
    console.error('[Upload Audio] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 提供 long_audio 目录的静态访问
app.use('/api/long_audio', express.static(path.join(__dirname, 'public', 'long_audio')));


// ==========================================
// User profile & long-term memory API
// ==========================================

app.get('/api/user/profile/:userId', (req, res) => {
  try {
    const uid = normalizeMemoryUserId(req.params.userId);
    // 工作台可含 learning_ui；显式列，避免未来 SELECT * 把无关列打进其它读路径
    const row = db.prepare(`
      SELECT user_id, profile_content, error_ledger, memory_layers, updated_at, learning_ui_json
      FROM user_memories WHERE user_id = ?
    `).get(uid);
    const memoryCtx = buildMemoryContextForUser(uid);
    res.json({
      success: true,
      data: row
        ? {
            user_id: row.user_id,
            profile_content: row.profile_content,
            error_ledger: parseJsonObject(row.error_ledger, {}),
            memory_layers: parseJsonObject(row.memory_layers, {}),
            updated_at: row.updated_at,
            learning_ui: learningUiService.parseLearningUi(row.learning_ui_json),
            recent_episodes_summary: memoryCtx.recentEpisodesSummary,
            error_ledger_summary: memoryCtx.errorLedgerSummary,
            graph_summary: memoryCtx.graphSummary,
          }
        : {
            user_id: uid,
            profile_content: '',
            error_ledger: {},
            memory_layers: {},
            learning_ui: learningUiService.parseLearningUi(null),
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

app.get('/api/user/learning-ui/:userId', (req, res) => {
  try {
    const uid = normalizeMemoryUserId(req.params.userId);
    res.json({ success: true, data: { userId: uid, learning_ui: learningUiService.getLearningUi(db, uid) } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/user/learning-ui', (req, res) => {
  try {
    const userId = req.body?.userId;
    const learningUi = req.body?.learningUi ?? req.body?.learning_ui;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const result = learningUiService.persistLearningUi(db, normalizeMemoryUserId(userId), learningUi || {});
    res.json({ success: true, data: result });
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
      return res.status(400).json({ success: false, error: '缺少 userId。' });
    }
    if (!String(query).trim()) {
      return res.status(400).json({ success: false, error: '缺少 query。' });
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
      return res.status(400).json({ success: false, error: '缺少 userId。' });
    }
    const text = buildMemoryPackForLlm(userId, query);
    if (format === 'text') {
      return res.type('text/plain; charset=utf-8').send(text || '（本轮未检索到结构化记忆。）');
    }
    res.json({ success: true, data: { text: text || '（本轮未检索到结构化记忆。）' } });
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
  const { userId, profileContent, errorLedger, careerPath, memoryLayers: incomingLayers } = req.body || {};
  const uid = normalizeMemoryUserId(userId);
  const now = Date.now();
  try {
    const existing = db.prepare('SELECT profile_content, error_ledger, memory_layers FROM user_memories WHERE user_id = ?').get(uid);
    let layers = parseJsonObject(existing?.memory_layers, {});
    if (incomingLayers && typeof incomingLayers === 'object') {
      layers = { ...layers, ...incomingLayers };
    }
    if (careerPath && typeof careerPath === 'object') {
      layers.career_path = {
        history: String(careerPath.history || ''),
        current: String(careerPath.current || ''),
        target: String(careerPath.target || ''),
        progress: Math.min(100, Math.max(0, Math.round(Number(careerPath.progress) || 0))),
      };
    }
    upsertUserMemoryRow(uid, {
      profileContent: profileContent ?? existing?.profile_content ?? '',
      errorLedger: errorLedger || existing?.error_ledger || '{}',
      memoryLayers: JSON.stringify(layers),
      updatedAt: now,
    });
    res.json({ success: true, data: { updated_at: now, memory_layers: layers } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/profile/compress', async (req, res) => {
  const { userId, profileContent, save = true } = req.body || {};
  const uid = normalizeMemoryUserId(userId);
  const now = Date.now();

  try {
    const row = db.prepare('SELECT user_id, profile_content, error_ledger, memory_layers, updated_at FROM user_memories WHERE user_id = ?').get(uid);
    const input = String(profileContent ?? row?.profile_content ?? '').trim();
    if (!input) {
      return res.status(400).json({ success: false, error: '画像内容为空，无法压缩。' });
    }

    const beforeLen = input.length;
    const compressed = await compressProfileContent(input, uid);
    const mergedProfile = String(compressed.mergedProfile || '').trim();
    if (!mergedProfile) {
      return res.status(500).json({ success: false, error: '压缩结果为空，请稍后重试。' });
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
    res.status(500).json({ success: false, error: err.message || '画像压缩失败' });
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
    const row = db.prepare('SELECT user_id, profile_content, error_ledger, memory_layers, updated_at FROM user_memories WHERE user_id = ?').get(uid);
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
      return res.status(400).json({ success: false, error: '缺少 episodeId。' });
    }
    const row = db.prepare('SELECT memory_layers FROM user_memories WHERE user_id = ?').get(uid);
    const memoryLayers = parseJsonObject(row?.memory_layers, {});
    const episodes = Array.isArray(memoryLayers.l2_episodes) ? memoryLayers.l2_episodes : [];
    const episode = episodes.find((ep) => String(ep._id) === episodeId);
    if (!episode) {
      return res.status(404).json({ success: false, error: 'episode 未找到。' });
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
    return res.status(400).json({ success: false, error: '缺少 category 或 entries。' });
  }

  try {
    const row = db.prepare('SELECT user_id, profile_content, error_ledger, memory_layers, updated_at FROM user_memories WHERE user_id = ?').get(uid);
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
function parseVocabUserId(req) {
  const id = req.query?.userId || req.query?.user_id || req.body?.userId || req.body?.user_id || req.headers?.['x-user-id'];
  if (typeof id === 'string' && id.trim()) {
    return id.trim().slice(0, 64);
  }
  return null;
}

/** vocab 路由强制要求 userId；缺失则 400，不回落默认账号 */
function requireVocabUserId(req, res) {
  const userId = parseVocabUserId(req);
  if (!userId) {
    res.status(400).json({ error: 'userId required' });
    return null;
  }
  return userId;
}


// 统计：按当前登录账号隔离
app.get('/api/vocab/stats', (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
    const total = db.prepare('SELECT COUNT(*) as count FROM vocabulary WHERE user_id = ?').get(userId)?.count || 0;
    const now = Date.now();
    const dueToday = db.prepare('SELECT COUNT(*) as count FROM vocabulary WHERE user_id = ? AND next_review_date <= ? AND repetitions < 999').get(userId, now)?.count || 0;
    res.json({ total, dueToday });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

function mapLightVocabRow(r) {
  return {
    id: r.id,
    user_id: r.user_id,
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

// 轻量列表：只取标量列，禁止 json_extract（6000 行会打满事件循环导致全站超时）
const LIGHT_SELECT = `
  id, user_id, word, dict_type, category, scene_type, added_at, repetitions, ease_factor, interval_days, next_review_date, last_review_date
`;

function parseVocabCategory(value) {
  return value === 'business' || value === 'general' ? value : null;
}

// 生词本轻量分页列表（强制按账号 user_id 过滤 + 参数化分页）
app.get('/api/vocab/list', (req, res) => {
  try {
    if (String(req.query.light || '') === '0') {
      return res.status(400).json({ error: 'light=0 is deprecated. Please use pagination or /api/vocab/item/:id' });
    }
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
    const rawLimit = Number(req.query.limit);
    const pageSize = Math.min(Math.max(Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 50, 1), 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const category = parseVocabCategory(req.query.category);
    const word = typeof req.query.word === 'string' && req.query.word.trim() ? req.query.word.trim() : null;

    let rows;
    let total = 0;
    if (word && category) {
      rows = db.prepare(`
        SELECT ${LIGHT_SELECT}
        FROM vocabulary
        WHERE user_id = ? AND category = ? AND word = ? COLLATE NOCASE
        ORDER BY added_at DESC
        LIMIT ? OFFSET ?
      `).all(userId, category, word, pageSize + 1, offset);
      total = db.prepare('SELECT COUNT(*) as count FROM vocabulary WHERE user_id = ? AND category = ? AND word = ? COLLATE NOCASE').get(userId, category, word)?.count || 0;
    } else if (word) {
      rows = db.prepare(`
        SELECT ${LIGHT_SELECT}
        FROM vocabulary
        WHERE user_id = ? AND word = ? COLLATE NOCASE
        ORDER BY added_at DESC
        LIMIT ? OFFSET ?
      `).all(userId, word, pageSize + 1, offset);
      total = db.prepare('SELECT COUNT(*) as count FROM vocabulary WHERE user_id = ? AND word = ? COLLATE NOCASE').get(userId, word)?.count || 0;
    } else if (category) {
      rows = db.prepare(`
        SELECT ${LIGHT_SELECT}
        FROM vocabulary
        WHERE user_id = ? AND category = ?
        ORDER BY added_at DESC
        LIMIT ? OFFSET ?
      `).all(userId, category, pageSize + 1, offset);
      total = db.prepare('SELECT COUNT(*) as count FROM vocabulary WHERE user_id = ? AND category = ?').get(userId, category)?.count || 0;
    } else {
      rows = db.prepare(`
        SELECT ${LIGHT_SELECT}
        FROM vocabulary
        WHERE user_id = ?
        ORDER BY added_at DESC
        LIMIT ? OFFSET ?
      `).all(userId, pageSize + 1, offset);
      total = db.prepare('SELECT COUNT(*) as count FROM vocabulary WHERE user_id = ?').get(userId)?.count || 0;
    }

    return res.json({
      items: rows.slice(0, pageSize).map(mapLightVocabRow),
      hasMore: rows.length > pageSize,
      total,
    });
  } catch (error) {
    console.error('[vocab/list]', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 今日待复习列表（强制按账号 user_id 过滤 + 分页）
app.get('/api/vocab/review', (req, res) => {
  try {
    if (String(req.query.light || '') === '0') {
      return res.status(400).json({ error: 'light=0 is deprecated. Please use pagination or /api/vocab/item/:id' });
    }
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
    const now = Date.now();
    const rawLimit = Number(req.query.limit);
    const pageSize = Math.min(Math.max(Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 50, 1), 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const category = parseVocabCategory(req.query.category);

    const rows = category
      ? db.prepare(`
          SELECT ${LIGHT_SELECT}
          FROM vocabulary
          WHERE user_id = ? AND next_review_date <= ? AND repetitions < 999 AND category = ?
          ORDER BY next_review_date ASC
          LIMIT ? OFFSET ?
        `).all(userId, now, category, pageSize + 1, offset)
      : db.prepare(`
          SELECT ${LIGHT_SELECT}
          FROM vocabulary
          WHERE user_id = ? AND next_review_date <= ? AND repetitions < 999
          ORDER BY next_review_date ASC
          LIMIT ? OFFSET ?
        `).all(userId, now, pageSize + 1, offset);

    return res.json({
      items: rows.slice(0, pageSize).map(mapLightVocabRow),
      hasMore: rows.length > pageSize,
    });
  } catch (error) {
    console.error('[vocab/review]', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 批量点查生词条目（按账号 user_id 隔离）
app.post('/api/vocab/lookup', (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
    const rawWords = Array.isArray(req.body?.words) ? req.body.words : [];
    const words = Array.from(
      new Set(rawWords.map(w => (typeof w === 'string' ? w.trim() : '')).filter(Boolean))
    ).slice(0, 100);

    if (words.length === 0) {
      return res.json({ items: [] });
    }

    const placeholders = words.map(() => '?').join(', ');
    const rows = db.prepare(`
      SELECT ${LIGHT_SELECT}
      FROM vocabulary
      WHERE user_id = ? AND word IN (${placeholders}) COLLATE NOCASE
      ORDER BY added_at DESC
    `).all(userId, ...words);

    return res.json({
      items: rows.map(mapLightVocabRow),
    });
  } catch (error) {
    console.error('[vocab/lookup]', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 单条完整词条（轻量列表按需补全 payload）
app.get('/api/vocab/item/:id', (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
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

// 单条词汇存入生词本（绑定 userId）
app.post('/api/vocab/add', (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
    const { word, dictType, category, scene_type = 'business', payload } = req.body;

    const actualCategory = category || (scene_type === 'general' ? 'general' : 'business');

    // 针对当前账号查重
    const existing = db.prepare('SELECT id FROM vocabulary WHERE user_id = ? AND word = ? COLLATE NOCASE').get(userId, word);
    if (existing) {
      return res.json({ success: false, message: '词条已存在', id: existing.id });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO vocabulary (id, user_id, word, dict_type, category, scene_type, payload, added_at, next_review_date, review_history, repetitions, interval_days, ease_factor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, word, dictType, actualCategory, scene_type, JSON.stringify(payload || {}), now, now, '[]', 0, 1, 2.5);

    res.json({ success: true, id, message: '存入成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

function readVocabItemText(item) {
  const rawText = typeof item === 'string' ? item : (item?.word || item?.phrase || item?.sentence || '');
  return String(rawText || '').trim();
}

// 词条落库 + 词汇矩阵深度补齐（单词/短语/句式共用同一套补齐逻辑）
async function runVocabEntryEnrichment({ userId, item = {}, topic = '', source = '', userProfile = '' }) {
  const word = readVocabItemText(item);
  if (!word) throw new Error('word is required');

  const isSentence = !!item.is_sentence || item.dictType === 'ai_sentence' || item.dict_type === 'ai_sentence';
  const isPhrase = !!item.is_phrase;
  const kind = vocabMatrixEnricher.classifyKind({ isPhrase, isSentence, text: word });
  const dictType = item.dictType || item.dict_type
    || (kind === 'sentence' ? 'ai_sentence' : (kind === 'phrase' ? 'ai_phrase' : 'ai_extracted'));
  const category = item.category || (item.scene_type === 'general' ? 'general' : 'business');
  const sceneType = item.scene_type || category;
  const now = Date.now();

  // 1) 先落库并初始化 SM-2 基线，保证矩阵留存率仪表盘有数据来源
  let row = db.prepare('SELECT * FROM vocabulary WHERE user_id = ? AND word = ? COLLATE NOCASE').get(userId, word);
  let created = false;
  if (!row) {
    const id = crypto.randomUUID();
    const seedPayload = { ...(item.payload || {}), word, source: source || item.source || '', topic: topic || '' };
    db.prepare(`
      INSERT INTO vocabulary (id, user_id, word, dict_type, category, scene_type, payload, added_at, next_review_date, review_history, repetitions, interval_days, ease_factor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, word, dictType, category, sceneType, JSON.stringify(seedPayload), now, now, '[]', 0, 1, 2.5);
    row = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(id);
    created = true;
  }

  let payload = {};
  try { payload = row.payload ? JSON.parse(row.payload) : {}; } catch { payload = {}; }
  if (item.payload && typeof item.payload === 'object') payload = { ...payload, ...item.payload };

  // 2) 补齐矩阵正文（音标释义 / 同近义词 / 搭配 / 记忆钩子 / 高管 SOP；句式另含翻译、语法结构、替换表达、场景 SOP）
  let matrixError = null;
  if (!vocabMatrixEnricher.isMatrixComplete(payload, kind)) {
    try {
      const matrix = await vocabMatrixEnricher.generateVocabMatrix({
        text: word,
        kind,
        topic,
        apiKey: process.env.VOCAB_MATRIX_LLM_API_KEY || process.env.LISTEN_LLM_API_KEY || require('./services/openaiCompatLlm').DEFAULT_LLM_KEY,
      });
      const enrichedPayload = {
        ...payload,
        ...matrix,
        source: source || payload.source || '',
        topic: topic || payload.topic || '',
        matrix_pending_retry: false,
        matrix_error: '',
      };
      payload = payload.cambridge_raw
        ? mergeCambridgeWithDify(payload.cambridge_raw, enrichedPayload)
        : enrichedPayload;
    } catch (error) {
      // 软失败：优先用已有词典 payload 种子化矩阵；仍不足则标记可重试，不 DELETE
      matrixError = error?.message || String(error);
      console.warn(`[Vocab Matrix] 软保留词条，矩阵待重试: "${word}" -> ${matrixError}`);
      const seeded = vocabMatrixEnricher.seedMatrixFromDictPayload(payload, { text: word, kind });
      if (seeded) {
        console.warn(`[Vocab Matrix] 已用词典 payload 种子化矩阵: "${word}"`);
        payload = {
          ...payload,
          ...seeded,
          source: source || payload.source || '',
          topic: topic || payload.topic || '',
          matrix_pending_retry: false,
          matrix_error: '',
          matrix_seed_note: matrixError,
        };
        matrixError = null;
      } else {
        payload = {
          ...payload,
          source: source || payload.source || '',
          topic: topic || payload.topic || '',
          matrix_pending_retry: true,
          matrix_error: matrixError,
        };
      }
    }
  }

  db.prepare('UPDATE vocabulary SET dict_type = ?, category = ?, scene_type = ?, payload = ? WHERE id = ? AND user_id = ?')
    .run(dictType, category, sceneType, JSON.stringify(payload), row.id, userId);

  // 3) 补齐记忆辅助与记忆节点（沿用既有 Dify 记忆工作流，失败时用矩阵内置钩子兜底）
  let memoryAids = {};
  try { memoryAids = row.memory_aids ? JSON.parse(row.memory_aids) : {}; } catch { memoryAids = {}; }
  let memoryReady = !!(memoryAids.root_memory || memoryAids.association_memory || memoryAids.mnemonic_phrase);
  if (!memoryReady) {
    const definition = [payload.meaning, payload.definition_en, payload.grammar_structure].filter(Boolean).join('; ');
    const examples = Array.isArray(payload.examples) ? payload.examples.join('\n') : '';
    let generated = null;
    try {
      generated = await vocabMatrixEnricher.runMemoryAidWorkflow({
        word,
        phonetic: payload.phonetic || '',
        pos: payload.partOfSpeech || '',
        definition,
        examples,
        userProfile,
        apiKey: process.env.DIFY_MEMORY_AID_API_KEY,
        baseUrl: process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1',
      });
    } catch (error) {
      console.warn(`[Vocab Matrix] 记忆辅助工作流失败，改用矩阵内置钩子兜底: "${word}" -> ${error.message}`);
    }
    if (!generated || !(generated.root_memory || generated.association_memory || generated.mnemonic_phrase)) {
      generated = vocabMatrixEnricher.buildFallbackMemoryAids(payload);
    }
    memoryAids = { ...memoryAids, ...generated, generated_at: Date.now() };
    memoryReady = !!(memoryAids.root_memory || memoryAids.association_memory || memoryAids.mnemonic_phrase);
    db.prepare('UPDATE vocabulary SET memory_aids = ? WHERE id = ?').run(JSON.stringify(memoryAids), row.id);
  }

  const finalRow = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(row.id);

  return {
    id: row.id,
    word,
    kind,
    created,
    matrixReady: vocabMatrixEnricher.isMatrixComplete(payload, kind),
    memoryReady,
    matrixError: matrixError || undefined,
    entry: finalRow ? {
      ...finalRow,
      payload,
      memory_aids: memoryAids,
    } : undefined,
  };
}

// 3 秒竞速会让同一词条同时出现同步请求与后台任务，这里做进行中去重，避免重复生成矩阵
const inflightVocabEnrichment = new Map();

async function enrichAndPersistVocabEntry(args) {
  const word = readVocabItemText(args?.item);
  if (!word) throw new Error('word is required');

  const key = `${args?.userId || 'default'}::${word.toLowerCase()}`;
  const forceNew = !!args?.forceNew;

  if (forceNew) {
    // 后台路径：等同步 inflight 结束后再独立重试，避免复用已失败的 Promise
    const existing = inflightVocabEnrichment.get(key);
    if (existing) {
      try { await existing; } catch (_) { /* ignore prior failure */ }
    }
  } else {
    const existing = inflightVocabEnrichment.get(key);
    if (existing) return existing;
  }

  const promise = runVocabEntryEnrichment(args).finally(() => {
    if (inflightVocabEnrichment.get(key) === promise) {
      inflightVocabEnrichment.delete(key);
    }
  });
  inflightVocabEnrichment.set(key, promise);
  return promise;
}

// 单条收录并同步补齐词汇矩阵（前端 3 秒竞速，超时由任务中心接管）
app.post('/api/vocab/add-enriched', async (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
    const {
      word,
      dictType,
      category,
      scene_type,
      is_phrase,
      is_sentence,
      payload,
      topic = '',
      source = 'Manual Select',
      user_current_profile = '',
    } = req.body || {};

    if (!word || !String(word).trim()) {
      return res.status(400).json({ success: false, error: 'word is required' });
    }

    const result = await enrichAndPersistVocabEntry({
      userId,
      item: { word, dictType, category, scene_type, is_phrase, is_sentence, payload },
      topic,
      source,
      userProfile: resolveProfileForDify(userId, user_current_profile),
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[vocab/add-enriched]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 批量生成/推送词条存入（绑定 userId）
app.post('/api/vocab/batch-add', (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
    const rawBody = req.body;
    const items = Array.isArray(rawBody) ? rawBody : (Array.isArray(rawBody?.items) ? rawBody.items : []);
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Expected a JSON array of vocabulary items' });
    }

    let addedCount = 0;
    const now = Date.now();

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

        const existing = db.prepare('SELECT id, payload FROM vocabulary WHERE user_id = ? AND word = ? COLLATE NOCASE').get(userId, word);
        if (!existing) {
          const id = crypto.randomUUID();
          db.prepare(`
            INSERT INTO vocabulary (id, user_id, word, dict_type, category, scene_type, payload, added_at, next_review_date, review_history, repetitions, interval_days, ease_factor)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, userId, word, dictType, category, scene_type, JSON.stringify(payload), now, now, '[]', 0, 1, 2.5);
          addedCount++;
        } else {
          db.prepare('UPDATE vocabulary SET dict_type = ?, category = ?, scene_type = ?, payload = ? WHERE id = ? AND user_id = ?').run(
            dictType,
            category,
            scene_type,
            JSON.stringify(payload),
            existing.id,
            userId
          );
        }
      }
    });
    insertMany(items);

    console.log(`[Batch Add] Success: callback batch added ${addedCount} words for user ${userId}.`);
    res.json({ success: true, addedCount, message: `Successfully batch added ${addedCount} words.` });
  } catch (error) {
    console.error('Batch Add Error:', error);
    res.status(500).json({ success: false, error: 'Database error on batch add' });
  }
});
// 异步批量写入生词本（支持前端 3 秒超时解耦托管至 TaskQueue 任务中心）
app.post('/api/vocab/batch-add-async', async (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
    const { items = [], topic = '通用主题', source = 'User Manual Selection' } = req.body || {};
    const itemList = Array.isArray(items) ? items : [];

    if (itemList.length === 0) {
      return res.status(400).json({ success: false, error: 'items array is empty' });
    }

    const taskQueue = require('./services/taskQueue');
    const firstWord = readVocabItemText(itemList[0]);
    const firstLabel = firstWord.length > 20 ? `${firstWord.slice(0, 20)}…` : firstWord;
    const task = taskQueue.createTask(
      'vocab_add',
      itemList.length === 1
        ? `生词本收录: ${firstLabel}`
        : `生词本批量收录: ${itemList.length} 个词句 (${topic})`,
    );

    console.log(`[Vocab Async] 收到生词批量后台入库请求: ${itemList.length} 项 (任务ID: ${task.id})`);
    res.json({ success: true, taskId: task.id, status: task.status });

    (async () => {
      try {
        taskQueue.updateTask(task.id, {
          status: 'running',
          progress: 10,
          logs: [`[生词收录] 开始异步写入 ${itemList.length} 个词句并补齐词汇矩阵…`],
        });

        let addedCount = 0;
        let existCount = 0;
        let failedCount = 0;
        const failures = [];

        for (let i = 0; i < itemList.length; i++) {
          const item = itemList[i];
          const rawText = typeof item === 'string' ? item : (item.word || item.phrase || item.sentence || '');
          const word = String(rawText || '').trim();
          if (!word) continue;

          try {
            const result = await enrichAndPersistVocabEntry({
              userId,
              item: typeof item === 'string' ? { word } : item,
              topic,
              source,
              forceNew: true,
            });
            if (result.created) addedCount++;
            else existCount++;
            if (!result.matrixReady) {
              failures.push(`${word.slice(0, 24)}: matrix pending (${result.matrixError || 'incomplete'})`);
            }
          } catch (error) {
            failedCount++;
            failures.push(`${word.slice(0, 24)}: ${error.message}`);
            console.error(`[Vocab Async] 词条矩阵补齐失败 "${word}":`, error.message);
          }

          const progress = Math.min(95, Math.floor(((i + 1) / itemList.length) * 85) + 10);
          taskQueue.updateTask(task.id, { progress });
        }

        const pendingMatrix = failures.filter((f) => f.includes('matrix pending')).length;
        const summary = `[生词收录完成] 新增 ${addedCount} 个，已存在或更新 ${existCount} 个，硬失败 ${failedCount} 个，矩阵待续补 ${pendingMatrix} 个`;
        taskQueue.updateTask(task.id, {
          status: failedCount > 0 && addedCount === 0 && existCount === 0 ? 'failed' : 'completed',
          progress: 100,
          error: failedCount > 0 && addedCount === 0 && existCount === 0 ? failures.join('; ') : undefined,
          logs: failures.length > 0 ? [summary, `明细: ${failures.slice(0, 5).join('; ')}`] : [summary],
          result: { addedCount, existCount, failedCount, pendingMatrix, total: itemList.length },
        });
      } catch (e) {
        console.error('[Vocab Async Fail]:', e);
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: `生词入库异常: ${e.message}`,
          logs: [`[生词收录失败] ${e.message}`],
        });
      }
    })();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

async function queryDifyDictOnBackend(word, dictType) {
  const cleanDictType = ['zh_modern', 'en_en_business', 'en_zh_bidirectional'].includes(dictType) ? dictType : 'en_zh_bidirectional';
  const DIFY_DICT_API_KEY = process.env.DIFY_DICT_API_KEY || "";
  if (!DIFY_DICT_API_KEY) throw new Error("Server missing DIFY_DICT_API_KEY");
  const BASE_URL = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  const MAX_RETRY = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      let direction = 'auto';
      if (cleanDictType === 'en_zh_bidirectional') {
        const hasChinese = /[\u4e00-\u9fa5]/.test(word || '');
        direction = hasChinese ? 'zh_to_en' : 'en_to_zh';
      }
      const response = await fetch(`${BASE_URL}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_DICT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: injectOralSystemTime({
            word: word.trim(),
            dict_type: cleanDictType,
            direction: direction,
            user_context: '',
            locale: 'zh-CN',
            user_current_profile: ''
          }),
          response_mode: 'blocking',
          user: 'backend-export-worker'
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }
      const data = await response.json();
      const resultStr = data?.data?.outputs?.result;
      if (!resultStr) {
        throw new Error("Empty Dify output");
      }
      let parsedResult;
      try {
        parsedResult = typeof resultStr === 'string' ? JSON.parse(resultStr.trim()) : resultStr;
      } catch (e) {
        let cleanStr = resultStr.trim();
        if (cleanStr.startsWith('```')) {
          const lines = cleanStr.split('\n');
          if (lines[0].startsWith('```')) lines.shift();
          if (lines[lines.length - 1].startsWith('```')) lines.pop();
          cleanStr = lines.join('\n').trim();
        }
        parsedResult = JSON.parse(cleanStr);
      }
      try {
        const rawLevel = parsedResult?.payload?.level || parsedResult?.level || null;
        const level = typeof rawLevel === 'string' && rawLevel.trim() ? rawLevel.trim() : null;
        db.prepare(`
          INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, level, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `).run(crypto.randomUUID(), word.trim(), cleanDictType, direction, '', 'zh-CN', JSON.stringify(parsedResult), level, Date.now());
      } catch (logErr) {
        console.error('[Backend Export Worker] Cache Write Error:', logErr.message);
      }
      return parsedResult;
    } catch (err) {
      lastError = err;
      console.warn(`[Backend Export Worker] Dify workflow query failed for "${word}" (attempt ${attempt}/${MAX_RETRY}):`, err.message);
      if (attempt < MAX_RETRY) {
        const delay = attempt * 1500;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  console.error(`[Backend Export Worker] Dify query completely failed for "${word}" after ${MAX_RETRY} attempts:`, lastError?.message);
  return null;
}

app.post('/api/vocab/export-background', async (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
        const { scope = 'all', currentTab = 'business' } = req.body || {};
    const taskQueue = require('./services/taskQueue');
    let scopeLabel = '\u5168\u90e8\u8bcd\u6761';
    if (scope === 'current_tab') scopeLabel = `\u5f53\u524d\u5206\u533a (${currentTab})`;
    else if (scope === 'due_today') scopeLabel = '\u4eca\u65e5\u5f85\u590d\u4e60';
    else if (scope === 'words_only') scopeLabel = '\u4ec5\u5355\u8bcd';
    else if (scope === 'phrases_only') scopeLabel = '\u4ec5\u77ed\u8bed';
    else if (scope === 'sentences_only') scopeLabel = '\u4ec5\u53e5\u5b50';
    const taskName = `\u5bfc\u51fa\u8bcd\u6761: ${scopeLabel}`;
    const task = taskQueue.createTask('vocab_export', taskName);
    res.json({ success: true, taskId: task.id, status: task.status });
    setImmediate(async () => {
      try {
        taskQueue.updateTask(task.id, {
          status: 'running',
          progress: 5,
          logs: ['\u5f00\u59cb\u62c9\u53d6\u751f\u8bcd\u672c\u6570\u636e\u5e76\u51c6\u5907\u5bfc\u51fa…']
        });
        try {
          const testWord = 'strategy';
          const cachedLog = db.prepare('SELECT response_payload FROM dict_query_log WHERE word = ? AND is_success = 1 ORDER BY created_at DESC LIMIT 1').get(testWord);
          console.log('[Background Export Debug] test word strategy cache log found:', !!cachedLog);
          if (cachedLog) {
            const data = JSON.parse(cachedLog.response_payload);
            console.log('[Background Export Debug] test word strategy parsed successfully:', !!data && data.ok);
          }
        } catch (e) {
          console.error('[Background Export Debug] test word error:', e);
        }
        const words = db.prepare('SELECT * FROM vocabulary ORDER BY added_at DESC').all();
        const parsedWords = words.map(w => {
          let payload = {};
          try {
            payload = w.payload ? JSON.parse(w.payload) : {};
          } catch (e) {}
          return { ...w, payload };
        });
        const now = Date.now();
        const matchesVocabTab = (w, tab) => w.category === tab || (!w.category && tab === 'business');
        const isDueToday = (w, ts) => w.repetitions !== 999 && w.next_review_date <= ts;
        const getItemType = (w) => {
          const payload = w.payload || {};
          if (payload.is_sentence === true) return '\u53e5\u5b50 (Sentence)';
          if (payload.is_phrase === true) return '\u77ed\u8bed (Phrase)';
          const text = (w.word || '').trim();
          const wordCount = text.split(/\s+/).filter(Boolean).length;
          if (wordCount > 4) return '\u53e5\u5b50 (Sentence)';
          if (wordCount > 1) return '\u77ed\u8bed (Phrase)';
          return '\u5355\u8bcd (Word)';
        };
        let filtered = [];
        switch (scope) {
          case 'all':
            filtered = parsedWords;
            break;
          case 'current_tab':
            filtered = parsedWords.filter(w => matchesVocabTab(w, currentTab));
            break;
          case 'due_today':
            filtered = parsedWords.filter(w => isDueToday(w, now));
            break;
          case 'words_only':
            filtered = parsedWords.filter(w => getItemType(w) === '\u5355\u8bcd (Word)');
            break;
          case 'phrases_only':
            filtered = parsedWords.filter(w => getItemType(w) === '\u77ed\u8bed (Phrase)');
            break;
          case 'sentences_only':
            filtered = parsedWords.filter(w => getItemType(w) === '\u53e5\u5b50 (Sentence)');
            break;
          default:
            filtered = parsedWords;
        }

        // Clean up dirty JSON entries
        filtered = filtered.filter(w => {
          const text = (w.word || '').trim();
          return !text.startsWith('{') && !text.startsWith('[') && !text.includes('"') && text.length > 0;
        });

        taskQueue.updateTask(task.id, {
          progress: 10,
          logs: [`\u62c9\u53d6\u5b8c\u6210\uff0c\u5171\u8fc4\u6ee4\u5e76\u6e05\u7406\u51fa ${filtered.length} \u6761\u8bcd\u6761\u3002\u5f00\u59cb\u68c0\u6d4b\u5e76\u81ea\u52a8\u8865\u9f50\u7a7a\u767d\u5b57\u6bb5…`]
        });
        const getWordTranslation = (payload) => {
          if (typeof payload.translation_main === 'string' && payload.translation_main.trim()) return payload.translation_main;
          if (typeof payload.meaning === 'string' && payload.meaning.trim()) return payload.meaning;
          if (typeof payload.meaning_zh === 'string' && payload.meaning_zh.trim()) return payload.meaning_zh;
          if (typeof payload.translation === 'string' && payload.translation.trim()) return payload.translation;
          if (typeof payload.definition === 'string' && payload.definition.trim()) return payload.definition;
          if (Array.isArray(payload.definitions_en) && payload.definitions_en[0]) {
            return String(payload.definitions_en[0]);
          }
          if (typeof payload.explain === 'string' && payload.explain.trim()) return payload.explain;
          return '';
        };
        const normalizePayload = (w) => {
          const payload = { ...(w.payload || {}) };
          let pos = (payload.pos || '').trim();
          if (!pos) {
            pos = (payload.partOfSpeech || payload.part_of_speech || '').trim();
          }
          if (pos.includes('\u8bcd\u6027\uff08\u5982') || pos.includes('??') || pos.includes('\u5f85\u590d\u4e60') || pos.includes('\u5f85\u5904\u7406')) {
            pos = '';
          }
          let phonetic = (payload.phonetic || '').trim();
          if (!phonetic) {
            phonetic = (payload.phonetic_symbol || payload.symbol || payload.pronunciation || '').trim();
          }
          if (phonetic.includes('\u97f3\u6807\uff1a') || phonetic.includes('??') || phonetic.includes('\u5f85\u590d\u4e60') || phonetic.includes('\u5f85\u5904\u7406')) {
            phonetic = '';
          }
          let meaning = getWordTranslation(payload).trim();
          if (meaning.includes('\u5f85\u590d\u4e60\u8865\u5145') || meaning.includes('\u7b80\u660e\u8f6d\u8981') || meaning.includes('\u5f85\u5904\u7406') || meaning.includes('\u82f1\u82f1\u8bcd\u5178') || meaning.includes('\u7279\u5b9a\u753b\u50cf')) {
            meaning = '';
          }
          const type = getItemType(w);
          if (type === '\u53e5\u5b50 (Sentence)') {
            if (!pos) pos = 'sentence';
            if (!phonetic) phonetic = '/';
          } else if (type === '\u77ed\u8bed (Phrase)') {
            if (!pos) pos = 'phrase';
            if (!phonetic) phonetic = '/';
          }
          return { ...payload, pos, phonetic, meaning, translation_main: meaning };
        };
        const wordsToEnrich = [];
        const normalizedList = [];
        for (const w of filtered) {
          const normP = normalizePayload(w);
          normalizedList.push({ ...w, payload: normP });
          const type = getItemType(w);
          const isTranslationBlank = !normP.meaning || !normP.meaning.trim();
          const isPosBlank = !normP.pos || !normP.pos.trim();
          const isPhoneticBlank = type === '\u5355\u8bcd (Word)' && (!normP.phonetic || !normP.phonetic.trim());
          if (isTranslationBlank || isPosBlank || isPhoneticBlank) {
            wordsToEnrich.push({ ...w, payload: normP });
          }
        }
        taskQueue.updateTask(task.id, {
          logs: [`\u68c0\u6d4b\u5230 ${wordsToEnrich.length} \u4e2a\u8bcd\u6761\u6709\u7a9a\u767d\u6216\u5360\u4f4d\u7b26\u5217\uff0c\u6b63\u5728\u542f\u52a8\u672c\u5730\u7f13\u5b58\u67e5\u8be2\u4e0e\u5728\u7ebf Dify \u8865\u9f50…`]
        });
        let enrichedCount = 0;
        let cachedMatchCount = 0;
        let onlineQueryCount = 0;
        const maxOnlineQueries = 9999999; // ??????????
        const concurrencyLimit = 8;
        const chunks = [];
        for (let i = 0; i < wordsToEnrich.length; i += concurrencyLimit) {
          chunks.push(wordsToEnrich.slice(i, i + concurrencyLimit));
        }
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          await Promise.all(chunk.map(async (w) => {
            try {
              let dictType = w.dict_type || 'en_zh_bidirectional';
              if (!['zh_modern', 'en_en_business', 'en_zh_bidirectional'].includes(dictType)) {
                dictType = 'en_zh_bidirectional';
              }
              let parsedResult = null;
              try {
                const cleanWord = w.word.trim();
                let cachedLog = db.prepare('SELECT response_payload FROM dict_query_log WHERE word = ? AND is_success = 1 ORDER BY created_at DESC LIMIT 1').get(cleanWord);
                if (!cachedLog) {
                  cachedLog = db.prepare('SELECT response_payload FROM dict_query_log WHERE word = ? AND is_success = 1 ORDER BY created_at DESC LIMIT 1').get(cleanWord.toLowerCase());
                }
                if (cachedLog) {
                  const logData = JSON.parse(cachedLog.response_payload);
                  if (logData && logData.ok && logData.payload) {
                    parsedResult = logData;
                    cachedMatchCount++;
                  }
                }
              } catch (e) {
                console.error('[Cache Query Error for ' + w.word + ']:', e);
              }
              if (!parsedResult) {
                const wordText = w.word.trim();
                const type = getItemType(w);
                const isValidText = wordText.length > 0 &&
                                    !wordText.includes('{') &&
                                    !wordText.includes('[') &&
                                    !wordText.includes('"');
                if (isValidText && onlineQueryCount < maxOnlineQueries) {
                  onlineQueryCount++;
                  parsedResult = await queryDifyDictOnBackend(w.word, dictType);
                }
              }
              if (parsedResult && parsedResult.ok && parsedResult.payload) {
                const dp = parsedResult.payload;
                let meaning = dp.translation_main || '';
                if (!meaning && Array.isArray(dp.definitions_en)) {
                  meaning = dp.definitions_en.join('; ');
                }
                if (!meaning) {
                  meaning = dp.meaning || dp.definition || '';
                }
                let pos = dp.pos || dp.partOfSpeech || '';
                let phonetic = dp.phonetic || '';
                const type = getItemType(w);
                if (type === '\u5355\u8bcd (Word)') {
                  // Keep pos and phonetic as returned
                } else if (type === '\u53e5\u5b50 (Sentence)') {
                  if (!pos) pos = 'sentence';
                  if (!phonetic) phonetic = '/';
                } else if (type === '\u77ed\u8bed (Phrase)') {
                  if (!pos) pos = 'phrase';
                  if (!phonetic) phonetic = '/';
                }
                let examplesList = [];
                if (Array.isArray(dp.example_sentences)) examplesList = dp.example_sentences;
                else if (Array.isArray(dp.examples)) examplesList = dp.examples;
                const newPayload = {
                  ...w.payload,
                  word: w.word,
                  phonetic: phonetic.trim(),
                  pos: pos.trim(),
                  meaning: meaning.trim(),
                  translation_main: meaning.trim(),
                  example_sentences: examplesList,
                  source: '\u5bfc\u51fa\u540e\u53f0\u81ea\u52a8\u8865\u5168'
                };
                delete newPayload.definition;
                db.prepare('UPDATE vocabulary SET payload = ? WHERE id = ?').run(JSON.stringify(newPayload), w.id);
                const idx = normalizedList.findIndex(n => n.id === w.id);
                if (idx !== -1) {
                  normalizedList[idx].payload = normalizePayload({ ...w, payload: newPayload });
                }
                enrichedCount++;
              }
            } catch (err) {
              console.error(`[Backend Export Worker] Error enriching "${w.word}":`, err.message);
            }
          }));
          const progressPercent = Math.min(90, Math.round(((i * concurrencyLimit) / wordsToEnrich.length) * 80) + 10);
          taskQueue.updateTask(task.id, {
            progress: progressPercent,
            logs: [`\u5df2\u5904\u7406 ${Math.min(wordsToEnrich.length, (i + 1) * concurrencyLimit)}/${wordsToEnrich.length} \u4e2a\u8bcd\u6761 (\u672c\u5730\u7f13\u5b58\u5339\u914d: ${cachedMatchCount}, \u5728\u7ebf\u67e5\u8be2\u6570: ${onlineQueryCount}/${maxOnlineQueries})…`]
          });
        }
        taskQueue.updateTask(task.id, {
          logs: [`\u5728\u7ebf\u8865\u9f50\u5904\u7406\u5b8c\u6210\uff0c\u6210\u529f\u8865\u9f50 ${enrichedCount} \u4e2a\u8bcd\u6761\u3002\u6b63\u5728\u5bf9\u6240\u6709\u5269\u4e59\u7a7a\u767d\u5217\u5e94\u7528\u672c\u5730\u515c\u5e95\u5e76\u751f\u6210 CSV…`]
        });
        // ???????????????????? Dify ?????????????????? CSV
        const incompleteWords = normalizedList.filter(w => {
          const payload = w.payload || {};
          const type = getItemType(w);
          const translation = getWordTranslation(payload).trim();
          const pos = String(payload.pos || '').trim();
          const phonetic = String(payload.phonetic || '').trim();
          return !translation || !pos || (type === '\u5355\u8bcd (Word)' && !phonetic);
        });

        if (incompleteWords.length > 0) {
          const examples = incompleteWords.slice(0, 5).map(w => w.word).join(', ');
          throw new Error(`\u5bfc\u51fa\u4e2d\u65ad\uff1a\u6709 ${incompleteWords.length} \u4e2a\u8bcd\u6761\u7531\u4e8e\u7f51\u7edc\u6216\u5927\u6a21\u578b\u89e3\u6790\u5931\u8d25\u672a\u80fd\u6210\u529f\u8865\u9f50\uff08\u8be6\u60c5\uff1a${examples}${incompleteWords.length > 5 ? ', ...' : ''}\uff09\u3002\u4e3a\u4e86\u4fdd\u8bc1\u6570\u636e\u5b8c\u6574\uff0c\u8bf7\u91cd\u8bd5\u5bfc\u51fa\u3002`);
        }

        const finalExportList = normalizedList.map(w => {
          const payload = { ...(w.payload || {}) };
          const type = getItemType(w);
          if (!payload.pos || !payload.pos.trim()) {
            if (type === '\u53e5\u5b50 (Sentence)') payload.pos = 'sentence';
            else if (type === '\u77ed\u8bed (Phrase)') payload.pos = 'phrase';
            else payload.pos = 'word';
          }
          if (!payload.phonetic || !payload.phonetic.trim()) {
            payload.phonetic = '/';
          }

          return { ...w, payload };
        });
        const getExampleSentences = (w) => {
          const payload = w.payload || {};
          const sources = [
            payload.example_sentences,
            payload.scenarios,
            payload.business_examples,
            payload.examples,
            payload.example
          ];
          const examples = sources.find(s => Array.isArray(s) && s.length > 0) || [];
          if (!Array.isArray(examples)) return { en: '', zh: '' };
          const enList = [];
          const zhList = [];
          examples.forEach(ex => {
            if (typeof ex === 'string') {
              const en = ex.trim();
              if (!en || en.includes('\u4f8b\u53e51') || en.includes('\u4f8b\u53e52') || en.includes('\u4e2d\u6587\u7ffb\u8bd1') || en.includes('\u793a\u4f8b')) return;
              enList.push(en);
              zhList.push('');
              return;
            }
            if (typeof ex === 'object' && ex !== null) {
              const en = String(ex.en || ex.example_en || ex.sentence || ex.example || '').trim();
              const zh = String(ex.zh || ex.translation || ex.example_zh || '').trim();
              if (!en && !zh) return;
              if (en.includes('\u4f8b\u53e51') || en.includes('\u4f8b\u53e52') || zh.includes('\u4e2d\u6587\u7ffb\u8bd1') || en.includes('\u793a\u4f8b')) return;
              enList.push(en);
              zhList.push(zh);
            }
          });
          return { en: enList.join('\n'), zh: zhList.join('\n') };
        };
        const firstExampleLine = (s) => (String(s || '').split('\n').map((x) => x.trim()).find(Boolean) || '');
        const extractPrimaryPhrase = (w) => {
          const payload = w.payload || {};
          const sources = [payload.collocations, payload.phrases, payload.related_phrases];
          const list = sources.find((s) => Array.isArray(s) && s.length > 0) || [];
          const first = list[0];
          if (!first) return '';
          if (typeof first === 'string') return first.trim();
          return String(first.en || first.phrase || first.text || '').trim();
        };
        const escapeCsvCell = (val) => {
          const str = String(val || '');
          if (/[",\n\r]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        const headers = [
          'word',
          'type',
          'translation',
          'phonetic',
          'pos',
          'related_phrase',
          'example_sentences_en',
          'example_sentences_zh',
          'repetitions',
          'next_review_date',
          'due_today'
        ];
        const rows = finalExportList.map(w => {
          const payload = w.payload || {};
          const examples = getExampleSentences(w);
          const itemType = getItemType(w);
          const relatedPhrase = itemType === '\u5355\u8bcd (Word)' ? extractPrimaryPhrase(w) : '';
          const cells = [
            w.word || '',
            itemType,
            getWordTranslation(payload),
            payload.phonetic || '',
            payload.pos || '',
            relatedPhrase,
            firstExampleLine(examples.en),
            firstExampleLine(examples.zh),
            String(w.repetitions ?? ''),
            w.next_review_date ? new Date(w.next_review_date).toISOString() : '',
            (w.repetitions !== 999 && w.next_review_date <= now) ? 'yes' : 'no'
          ];
          return cells.map(c => escapeCsvCell(c)).join(',');
        });
        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const filename = `vocab-export-${scope}-${timestamp}.csv`;
        taskQueue.updateTask(task.id, {
          status: 'completed',
          progress: 100,
          logs: [`[\u6210\u529f] CSV \u5bfc\u51fa\u5c31\u7eea\uff01\u5171\u5bfc\u51fa ${finalExportList.length} \u6761\u8bcd\u6761\u3002`],
          result: {
            name: filename,
            content: csvContent,
            mimeType: 'text/csv;charset=utf-8;'
          }
        });
        console.log(`[Backend Export Worker] Successfully completed background export for task "${task.id}".`);
      } catch (err) {
        console.error('[Backend Export Worker] Background job crash:', err);
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: `\u540e\u53f0\u5bfc\u51fa\u53d1\u751f\u4e25\u91cd\u9519\u8bef: ${err.message}`
        });
      }
    });
  } catch (error) {
    console.error('[Export Background Error]:', error);
    res.status(500).json({ success: false, error: `\u540e\u53f0\u5bfc\u51fa\u53d1\u751f\u4e25\u91cd\u9519\u8bef: ${error.message}` });
  }
});

// ???????????
app.put('/api/vocab/move/:id', (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
        const id = req.params.id;
    const { category } = req.body;
    db.prepare('UPDATE vocabulary SET category = ? WHERE id = ?').run(category, id);
    res.json({ success: true, message: '迁移成功' });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ????????
app.patch('/api/vocab/update_payload/:id', (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
        db.prepare('UPDATE vocabulary SET payload = ? WHERE id = ?').run(JSON.stringify(req.body.payload), req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ????????????????????????????????????? payload????
app.put('/api/vocab/update/:id', (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
        const id = req.params.id;
    const { word, category, payload } = req.body;
    db.prepare('UPDATE vocabulary SET word = ?, category = ?, payload = ? WHERE id = ?')
      .run(word, category, JSON.stringify(payload || {}), id);
    res.json({ success: true, message: '迁移成功' });
  } catch (error) {
    console.error('Update vocab error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ?????????
app.put('/api/vocab/review/:id', (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
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
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
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
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
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
    const practicedThemes = [];

    // 2. ?????????????????
    for (const row of candidateThemesRows) {
      const themeName = row.theme;
      if (!themeName) continue;
      practicedThemes.push(themeName);

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
      masteredThemes,
      practicedThemes
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error on mastered-list' });
  }
});

app.post('/api/theme/focus', (req, res) => {
  try {
    const { theme, userId = 'default-user', difficulty = '' } = req.body || {};
    if (!theme || !String(theme).trim()) {
      return res.status(400).json({ success: false, error: 'theme is required' });
    }
    const row = dailyPackService.upsertUserTheme(db, userId, theme);
    res.json({ success: true, theme: row.theme, difficulty });
  } catch (error) {
    console.error('[Theme Focus]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    return res.status(400).json({ success: false, error: '缺少必要参数 themeName 或 file' });
  }

  const DATASET_KEY = 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
  const WORKFLOW_KEY = process.env.DIFY_KNOWLEDGE_IMPORT_API_KEY;
  const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

  try {
    // 1. 使用固定 ID 访问 Knowleage_Pro_Scenarios，并清空现有文档
    const datasetId = KNOWLEAGE_PRO_SCENARIOS_DATASET_ID;

    console.log('[Custom Theme] 正在清空 Knowleage_Pro_Scenarios 知识库...');
    const docsResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/documents?page=1&limit=100`, {
      headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
    });
    if (!docsResponse.ok) throw new Error(`获取知识库文档列表失败 (HTTP ${docsResponse.status})`);
    const docsData = await docsResponse.json();
    const docIds = docsData.data?.map(d => d.id) || [];

    if (docIds.length > 0) {
      console.log(`[Custom Theme] 发现 ${docIds.length} 个旧文档，正在删除...`);
      await Promise.all(docIds.map(async docId => {
        const delRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${docId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
        });
        if (!delRes.ok) console.warn(`[Custom Theme] 删除文档 ${docId} 失败 (HTTP ${delRes.status})`);
      }));
      console.log('[Custom Theme] 知识库已清空');
    } else {
      console.log('[Custom Theme] 知识库为空，无需清空');
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
      throw new Error(`Dify 文件入库失败: ${errText}`);
    }

    const uploadData = await uploadResponse.json();
    const documentId = uploadData.document?.id;
    const batchId = uploadData.batch;

    if (!documentId || !batchId) {
      throw new Error('文件已发送，但未从 Dify 拿到 batch ID 导致无法跟踪');
    }

    console.log(`[Custom Theme] 文档上传成功 (ID: ${documentId}, Batch: ${batchId})，正在轮询向量化进度...`);

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
        console.log(`[Custom Theme] 第 ${i + 1} 次进度扫描: status = ${docInfo.indexing_status}`);
        if (docInfo.indexing_status === 'completed') {
          isIndexed = true;
          break;
        } else if (docInfo.indexing_status === 'error') {
          throw new Error('Dify 向量化切分报错，请前往后台查看原因');
        }
      }
    }

    if (!isIndexed) {
      throw new Error('Dify 向量化索引超时 (>120s)。');
    }

    console.log(`[Custom Theme] 向量化装载完毕，调用主题萃取工作流...`);

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
          user_current_profile: resolveProfileForDify(userId, user_current_profile)
        },
        response_mode: 'blocking',
        user: userId
      })
    });

    const wfData = await wfResponse.json();
    if (!wfResponse.ok) throw new Error(`工作流执行失败: ${JSON.stringify(wfData)}`);

    const outputs = wfData?.data?.outputs || {};
    const extractedThemeName = outputs.theme_name || themeName;
    const extractedWordsRaw = outputs.extracted_words || '[]';
    const keyPhrasesRaw = outputs.key_phrases || '[]';

    let extractedWords = [];
    try {
      extractedWords = typeof extractedWordsRaw === 'string' ? JSON.parse(extractedWordsRaw) : extractedWordsRaw;
    } catch (e) {
      console.error("解析 extracted_words 失败", e);
    }

    let keyPhrases = [];
    try {
      keyPhrases = typeof keyPhrasesRaw === 'string' ? JSON.parse(keyPhrasesRaw) : keyPhrasesRaw;
    } catch (e) {
      console.error("解析 key_phrases 失败", e);
    }

    // 5. Upsert custom_themes by user + theme name; reuse legacy default-user records.
    const existingTheme = db.prepare(`
      SELECT * FROM custom_themes
      WHERE theme_name = ? AND user_id IN (?, 'default-user')
      ORDER BY CASE WHEN user_id = ? THEN 0 ELSE 1 END, created_at DESC
      LIMIT 1
    `).get(themeName, userId, userId);
    const themeId = existingTheme?.id || crypto.randomUUID();
    const nowForTheme = Date.now();

    if (existingTheme) {
      db.prepare(`
        UPDATE custom_themes
        SET user_id = ?, display_name = ?, associated_file = ?, dify_document_id = ?, dify_dataset_id = ?, extracted_keywords = ?, updated_at = ?
        WHERE id = ?
      `).run(
        userId,
        extractedThemeName,
        file.fileName || 'custom_material.pdf',
        documentId,
        datasetId,
        JSON.stringify(extractedWords),
        nowForTheme,
        themeId
      );
    } else {
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
        nowForTheme,
        nowForTheme
      );
    }

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
    let rows = db.prepare('SELECT * FROM custom_themes WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    if (rows.length === 0 && userId !== 'default-user') {
      rows = db.prepare('SELECT * FROM custom_themes WHERE user_id = ? ORDER BY created_at DESC').all('default-user');
    }
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
async function deleteCustomThemeDifyDocument({ documentId, datasetId }) {
  const DATASET_KEY = 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
  const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  console.log(`[Delete Theme] Deleting document ${documentId} from dataset ${datasetId}`);
  const delResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${documentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${DATASET_KEY}` },
  });
  if (!delResponse.ok) {
    const errText = await delResponse.text();
    console.warn(`[Delete Theme] Failed to delete Dify document: ${errText}`);
    return { ok: false, error: errText || `HTTP ${delResponse.status}` };
  }
  return { ok: true };
}

async function runCustomThemeCascadeDelete(id) {
  const { cascadeDeleteCustomTheme } = require('./services/customThemeCascadeDelete');
  return cascadeDeleteCustomTheme(db, {
    id,
    deleteDifyDocument: deleteCustomThemeDifyDocument,
  });
}

app.delete('/api/theme/custom/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await runCustomThemeCascadeDelete(id);
    if (!result.success) {
      const status = /not found/i.test(result.error || '') ? 404 : 400;
      return res.status(status).json({ success: false, error: result.error });
    }
    res.json({
      success: true,
      stats: result.stats,
      dify: result.dify,
      themeSnapshot: result.themeSnapshot,
      message: result.dify?.cloudCleanupIncomplete
        ? '场景本地资料已清理；云端资料清理未完成'
        : '场景及相关学习资料已清理',
    });
  } catch (error) {
    console.error('Failed to delete custom theme:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 异步级联删除自定义场景（前端 3 秒超时后托管至任务中心）
app.post('/api/theme/custom/:id/delete-async', async (req, res) => {
  const id = req.params.id;
  try {
    const row = db.prepare('SELECT * FROM custom_themes WHERE id = ?').get(id);
    if (!row) {
      // 同步竞速路径可能已完成级联；视为已清理，避免前端误恢复
      return res.json({
        success: true,
        alreadyDeleted: true,
        taskId: null,
        status: 'completed',
        message: '场景及相关学习资料已清理',
      });
    }

    const label = row.display_name || row.theme_name || '自定义场景';
    const themeSnapshotForTask = {
      id: row.id,
      themeName: row.theme_name,
      displayName: row.display_name,
      associatedFile: row.associated_file,
      difyDocumentId: row.dify_document_id,
      difyDatasetId: row.dify_dataset_id,
      extractedKeywords: row.extracted_keywords,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    const taskQueue = require('./services/taskQueue');
    const task = taskQueue.createTask('theme_delete', `清理练习场景：${String(label).slice(0, 40)}`);

    res.json({
      success: true,
      taskId: task.id,
      status: task.status,
      themeSnapshot: themeSnapshotForTask,
    });

    (async () => {
      try {
        taskQueue.updateTask(task.id, {
          status: 'running',
          progress: 15,
          logs: ['正在清理该场景下的学习资料与练习记录…'],
        });
        const result = await runCustomThemeCascadeDelete(id);
        if (!result.success) {
          // 同步路径抢先删完时也会 not found —— 按成功收口
          if (/not found/i.test(result.error || '')) {
            taskQueue.updateTask(task.id, {
              status: 'completed',
              progress: 100,
              logs: ['该场景及相关学习资料已清理完毕'],
              result: { message: '场景及相关学习资料已清理', alreadyDeleted: true },
            });
            return;
          }
          taskQueue.updateTask(task.id, {
            status: 'failed',
            error: result.error || '场景清理失败',
            logs: ['场景清理未能完成，可尝试恢复该场景选项'],
            result: { themeSnapshot: result.themeSnapshot || themeSnapshotForTask },
          });
          return;
        }
        const cloudNote = result.dify?.cloudCleanupIncomplete
          ? '；云端资料清理未完成'
          : '';
        taskQueue.updateTask(task.id, {
          status: 'completed',
          progress: 100,
          logs: [`该场景及相关学习资料已清理完毕${cloudNote}`],
          result: {
            stats: result.stats,
            dify: result.dify,
            themeSnapshot: result.themeSnapshot || themeSnapshotForTask,
            message: result.dify?.cloudCleanupIncomplete
              ? '场景本地资料已清理；云端资料清理未完成'
              : '场景及相关学习资料已清理',
          },
        });
      } catch (e) {
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: e.message || String(e),
          logs: ['场景清理过程中断，请稍后重试或恢复该场景选项'],
          result: { themeSnapshot: themeSnapshotForTask },
        });
      }
    })();
  } catch (error) {
    console.error('Failed to enqueue custom theme delete:', error);
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

    let weakPoints = { pronunciation: '暂无发音问题记录', grammar: '暂无语法问题记录' };
    let todaySuggestion = '建议：完成今日单词的英汉双向熟练度默写，并进行流式长文听力精听。';

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
          todaySuggestion = `今日针对性建议：重点纠正【${ef.pronunciationNotes || '无特殊发音问题'}】的发音习惯；在口语/写作练习中刻意运用【${ef.grammarNotes || '无语法偏差'}】的修正方案。`;
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
// Dify embed 会话：按登录账号找回最近有效历史；找不到则 3s 内新开（不走 LLM 创建）
app.get('/api/dify/embed-session', async (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  const conversationId = typeof req.query.conversationId === 'string'
    ? req.query.conversationId.trim()
    : '';
  const renew = req.query.renew === '1';

  if (!userId) {
    return res.status(400).json({ message: '缺少 userId 参数。' });
  }

  const webBaseUrl = process.env.DIFY_WEB_BASE_URL
    || String(process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz')
      .replace(/\/v1\/?$/, '');
  const appCode = process.env.DIFY_WEBAPP_CODE
    || process.env.VITE_DIFY_CHATBOT_TOKEN
    || 'Gz2zXRlfsAr5jYgC';

  try {
    const result = await resolveDifyEmbedSession({
      userId,
      conversationId,
      renew,
      webBaseUrl,
      appCode,
    });
    return res.json(result);
  } catch (err) {
    console.error('[embed-session] error:', err);
    const status = err.statusCode === 400 ? 400 : 500;
    return res.status(status).json({ message: err.message || 'embed 会话校验失败' });
  }
});

// mychat 对话代理：服务端拉取 memory_pack 注入 Dify inputs（规避工作流 HTTP 节点丢 body）
app.post('/api/dify/mychat/chat', async (req, res) => {
  const {
    query,
    conversationId = null,
    userId = 'default-user',
    inputs = {},
    responseMode = 'blocking',
  } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ message: '缺少 query 参数。' });
  }

  const apiKey = process.env.DIFY_CHATBOT_API_KEY;
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
  // 将 memory_pack 嵌入 sys.query，规避 Dify 工作流 paragraph/跨节点变量丢失
  const difyQuery = packText
    ? `[结构化记忆]\n${packText}\n\n[用户问题]\n${query}`
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
    return res.status(500).json({ message: err.message || 'mychat 对话代理失败' });
  }
});

// 辅助构建即时词典预览卡片数据（零等待秒级直出）
function hasDifyEnrichmentPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const list = (v) => Array.isArray(v) && v.length > 0;
  const text = (v) => typeof v === 'string' && v.trim().length > 0;
  return (
    list(payload.synonyms)
    || list(payload.antonyms)
    || list(payload.collocations)
    || list(payload.business_examples)
    || text(payload.etymology)
  );
}

/** 是否具备可展示的 Cambridge 主体（例句/义项），用于避免生词本瘦 payload 顶替前台 */
function hasCambridgeDisplayPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (Array.isArray(payload.senses) && payload.senses.length > 0) return true;
  if (Array.isArray(payload.example_sentences) && payload.example_sentences.length > 0) return true;
  if (payload.cambridge_raw && typeof payload.cambridge_raw === 'object') return true;
  return false;
}

/** 生词本种子是否足以秒开展示（释义/音标/例句/近反义等任一有内容） */
function hasVocabBookDisplayPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const text = (v) => typeof v === 'string' && v.trim().length > 0;
  const list = (v) => Array.isArray(v) && v.length > 0;
  return (
    text(payload.translation_main)
    || text(payload.meaning_zh)
    || text(payload.phonetic)
    || text(payload.definition)
    || list(payload.definitions_en)
    || list(payload.example_sentences)
    || list(payload.synonyms)
    || list(payload.antonyms)
    || list(payload.collocations)
    || list(payload.business_examples)
  );
}

/** 从生词本 payload 提取可并入的种子（仅作补缺，不作展示主数据） */
function buildVocabSeedPayload(cleanWord, vocabPayload) {
  const p = vocabPayload && typeof vocabPayload === 'object' ? vocabPayload : {};
  const meaningZh = p.meaning || p.meaning_zh || p.zh_meaning || p.translation_main || '';
  const definitionEn = p.definition_en || p.definitionEn || '';
  const examples = Array.isArray(p.examples) ? p.examples : (Array.isArray(p.example_sentences) ? p.example_sentences : []);
  const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
  return {
    headword: cleanWord,
    phonetic: p.phonetic || '',
    pos: p.partOfSpeech || p.pos || '',
    level: p.level || '',
    meaning_zh: meaningZh,
    translation_main: meaningZh,
    definitions_en: definitionEn ? [definitionEn] : [],
    definition: meaningZh || definitionEn,
    business_notes: p.business_note || p.businessNote || p.business_notes || '',
    example_sentences: examples.map((ex) => (typeof ex === 'string' ? { en: ex, zh: '' } : ex)),
    synonyms: list(p.synonyms),
    antonyms: list(p.antonyms),
    collocations: list(p.collocations),
    business_examples: list(p.business_examples),
    etymology: typeof p.etymology === 'string' ? p.etymology : '',
  };
}

/** 生词本增强字段若明显不属于当前词（如串写了上一词的商务例句），则丢弃避免污染展示 */
function scrubMismatchedVocabEnrichment(cleanWord, seed) {
  if (!seed || typeof seed !== 'object') return seed;
  const word = String(cleanWord || '').trim().toLowerCase();
  if (!word) return seed;
  const biz = Array.isArray(seed.business_examples) ? seed.business_examples : [];
  if (biz.length === 0) return seed;
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  const mentions = biz.some((item) => re.test(typeof item === 'string' ? item : JSON.stringify(item || {})));
  if (mentions) return seed;
  console.warn(`[Dict Query] 生词本增强字段与词条不符，已丢弃: "${cleanWord}"`);
  return {
    ...seed,
    synonyms: [],
    antonyms: [],
    collocations: [],
    business_examples: [],
    etymology: '',
  };
}

function resolveDictDirection(dictType, direction, cleanWord) {
  let resolvedDirection = direction || 'auto';
  if (dictType === 'en_zh_bidirectional' && (!direction || direction === 'auto')) {
    resolvedDirection = /[\u4e00-\u9fa5]/.test(cleanWord) ? 'zh_to_en' : 'en_to_zh';
  }
  return resolvedDirection;
}

function sanitizeDictPayloadForDisplay(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const headword = payload.headword || '';
  const next = { ...payload };
  if (Array.isArray(next.example_sentences)) {
    next.example_sentences = sanitizeExampleSentences(next.example_sentences);
  }
  if (Array.isArray(next.examples)) {
    next.examples = sanitizeExampleSentences(next.examples);
  }
  if (Array.isArray(next.business_examples)) {
    next.business_examples = sanitizeExampleSentences(next.business_examples);
  }
  if (Array.isArray(next.senses)) {
    next.senses = next.senses.map((sense) => ({
      ...sense,
      examples: sanitizeExampleSentences(sense?.examples || []),
    }));
  }
  if (Array.isArray(next.collocations)) {
    next.collocations = next.collocations.filter(
      (item) => !isInstantTemplateCollocation(item, headword)
    );
  }
  return next;
}

function buildInstantDictPayload(word, dictType = 'en_zh_bidirectional') {
  const clean = String(word || '').trim();
  const isChinese = /[\u4e00-\u9fa5]/.test(clean);

  // 秒开仅返回骨架：搭配/同反义/例句等 enrichment 等 Dify 或 Cambridge 真实数据，禁止模板假数据
  if (dictType === 'zh_modern' || isChinese) {
    return {
      headword: clean,
      phonetic: '',
      pos: '',
      level: '',
      definition: '',
      meaning_zh: '',
      translation_main: '',
      example_sentences: [],
      collocations: [],
      synonyms: [],
      antonyms: [],
      usage_notes: '',
    };
  }

  return {
    headword: clean,
    phonetic: '',
    pos: '',
    level: '',
    translation_main: '',
    meaning_zh: '',
    definitions_en: [],
    definition: '',
    business_notes: '',
    example_sentences: [],
    collocations: [],
    synonyms: [],
    antonyms: [],
    etymology: '',
  };
}

// 后台异步静默深度增强：同词去重 + 有限并发，避免轮询/划词风暴把 Dify 请求全部 abort
const dictEnrichmentInFlight = new Map();
const dictEnrichmentQueue = [];
let dictEnrichmentActive = 0;
const DICT_ENRICHMENT_MAX_CONCURRENT = 2;
const DICT_ENRICHMENT_TIMEOUT_MS = 180000;

function enqueueDictEnrichment(task) {
  return new Promise((resolve) => {
    const run = async () => {
      dictEnrichmentActive += 1;
      try {
        resolve(await task());
      } catch (_) {
        resolve(undefined);
      } finally {
        dictEnrichmentActive -= 1;
        const next = dictEnrichmentQueue.shift();
        if (next) next();
      }
    };
    if (dictEnrichmentActive < DICT_ENRICHMENT_MAX_CONCURRENT) run();
    else dictEnrichmentQueue.push(run);
  });
}

function shouldSkipDictEnrichmentInput(cleanWord) {
  const w = String(cleanWord || '').trim();
  if (!w) return true;
  // 划词整句会淹没词典增强队列；只增强单词或短词组
  if (w.length > 48) return true;
  if (w.split(/\s+/).filter(Boolean).length > 3) return true;
  return false;
}

function runBackgroundDifyDictEnrichment(args) {
  const DIFY_DICT_API_KEY = process.env.DIFY_DICT_API_KEY || "";
  if (!DIFY_DICT_API_KEY) return Promise.resolve(null);
  const cleanWord = String(args.cleanWord || '').trim();
  // forceSync：英汉双向短语/中文前台同步查询，不受后台增强的短词限制
  if (!args?.forceSync && shouldSkipDictEnrichmentInput(cleanWord)) {
    console.log(`[Dict Background] 跳过非词条输入: "${cleanWord.slice(0, 60)}"`);
    return Promise.resolve(null);
  }
  const dictType = args.dictType || 'en_zh_bidirectional';
  const userId = args.userId || '';
  const key = `${userId}::${dictType}::${cleanWord.toLowerCase()}`;
  if (dictEnrichmentInFlight.has(key)) {
    console.log(`[Dict Background] 已有进行中任务，跳过重复: "${cleanWord}"`);
    return dictEnrichmentInFlight.get(key);
  }
  const job = enqueueDictEnrichment(() => runBackgroundDifyDictEnrichmentJob({ ...args, cleanWord, dictType }))
    .finally(() => {
      dictEnrichmentInFlight.delete(key);
    });
  dictEnrichmentInFlight.set(key, job);
  return job;
}

async function runBackgroundDifyDictEnrichmentJob({ cleanWord, dictType, direction, userContext, locale, user_current_profile, userId, cambridgePromise = null }) {
  const DIFY_DICT_API_KEY = process.env.DIFY_DICT_API_KEY || "";
  const BASE_URL = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  let timeoutId = null;
  try {
      console.log(`[Dict Background] 开始静默深度分析: "${cleanWord}" (${dictType})...`);
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), DICT_ENRICHMENT_TIMEOUT_MS);

      const response = await fetch(`${BASE_URL}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_DICT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: injectOralSystemTime({
            word: cleanWord,
            dict_type: dictType || 'en_zh_bidirectional',
            direction: direction || 'auto',
            user_context: userContext || '',
            locale: locale || 'zh-CN',
            user_current_profile: resolveProfileForDify(userId, user_current_profile)
          }),
          response_mode: 'streaming',
          user: userId  // 强制使用传入的 userId，不允许降级到默认值
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        console.warn(`[Dict Background] Dify 工作流返回 HTTP ${response.status}`);
        return;
      }

      let workflowResult = null;
      const nodeOutputs = [];
      const decoder = new TextDecoder('utf-8');
      let sseBuffer = '';

      const processLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) return;
        try {
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') return;
          const data = JSON.parse(dataStr);
          if (data.event === 'node_finished') {
            const out = data.data?.outputs;
            if (out) nodeOutputs.push(out);
          } else if (data.event === 'workflow_finished') {
            workflowResult = data.data?.outputs;
          }
        } catch (_) {}
      };

      if (response.body) {
        if (typeof response.body.getReader === 'function') {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';
            for (const line of lines) processLine(line);
          }
        } else {
          for await (const chunk of response.body) {
            sseBuffer += decoder.decode(chunk, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';
            for (const line of lines) processLine(line);
          }
        }
        if (sseBuffer.trim()) processLine(sseBuffer);
      }
      clearTimeout(timeoutId);

      let rawResultStr = workflowResult?.result || workflowResult?.result_json || null;
      let parsedResult = null;

      if (rawResultStr) {
        try {
          const cleanJson = extractJsonFromString(rawResultStr);
          const obj = JSON.parse(cleanJson);
          if (obj && obj.ok !== false && (obj.payload || obj.translation_main || obj.meaning_zh || obj.definitions_en || obj.definition)) {
            parsedResult = obj;
          }
        } catch (_) {}
      }

      if (!parsedResult) {
        for (const nodeOut of nodeOutputs.reverse()) {
          const candidateText = nodeOut.text || nodeOut.result || nodeOut.result_json;
          if (candidateText && typeof candidateText === 'string') {
            try {
              const cleanJson = extractJsonFromString(candidateText);
              const obj = JSON.parse(cleanJson);
              if (obj && (obj.translation_main || obj.meaning_zh || obj.definitions_en || obj.definition || obj.pos || obj.phonetic)) {
                parsedResult = {
                  ok: true,
                  type: dictType,
                  payload: obj.payload || obj
                };
                break;
              }
            } catch (_) {}
          }
        }
      }

      if (parsedResult && parsedResult.payload) {
        if (!parsedResult.payload.headword) parsedResult.payload.headword = cleanWord;
        if (!parsedResult.payload.meaning_zh && parsedResult.payload.translation_main) {
          parsedResult.payload.meaning_zh = parsedResult.payload.translation_main;
        }
        if (!parsedResult.payload.translation_main && parsedResult.payload.meaning_zh) {
          parsedResult.payload.translation_main = parsedResult.payload.meaning_zh;
        }
        if (cambridgePromise) {
          try {
            const cambridge = await cambridgePromise;
            if (cambridge) {
              parsedResult.payload = mergeCambridgeWithDify(cambridge, parsedResult.payload, {
                mode: dictType === 'en_en_business' ? 'en_en' : 'en_zh',
              });
            }
          } catch (error) {
            console.warn(`[Dict Background] Cambridge 融合跳过 (${cleanWord}):`, error.message);
          }
        }
        parsedResult.ok = true;
        parsedResult.type = dictType;
        parsedResult.payload = sanitizeDictPayloadForDisplay(parsedResult.payload);

        const rawLevel = parsedResult?.payload?.level || parsedResult?.level || null;
        const level = typeof rawLevel === 'string' && rawLevel.trim() ? rawLevel.trim() : null;

        db.prepare(`
          INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, level, created_at, user_id)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), cleanWord, dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify(parsedResult), level, Date.now(), userId);

        console.log(`[Dict Background] 深度职场解析完成并沉淀入库: "${cleanWord}" (${dictType})`);
        return parsedResult;
      }
      return null;
  } catch (bgErr) {
    console.warn(`[Dict Background] 异步增强异常 (${cleanWord}):`, bgErr.message);
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function hasEnZhDifyDisplayPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (typeof payload.translation_main === 'string' && payload.translation_main.trim()) return true;
  if (typeof payload.meaning_zh === 'string' && payload.meaning_zh.trim()) return true;
  if (typeof payload.meaning === 'string' && payload.meaning.trim()) return true;
  if (Array.isArray(payload.example_sentences) && payload.example_sentences.length > 0) return true;
  if (Array.isArray(payload.definitions_en) && payload.definitions_en.length > 0) return true;
  if (Array.isArray(payload.senses) && payload.senses.length > 0) return true;
  return hasDifyEnrichmentPayload(payload);
}

function settleWithin(promise, timeoutMs) {
  return promise ? Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))]) : Promise.resolve(null);
}

function persistCambridgeWhenReady({ promise, cleanWord, dictType, direction, userContext, locale, userId, mergeMode = 'en_zh' }) {
  if (!promise) return;
  promise.then((cambridge) => {
    if (!cambridge) return;
    // 写入前再读最新缓存，避免慢速 Cambridge 覆盖已完成的 Dify 增强结果
    let difyPayload = buildInstantDictPayload(cleanWord, dictType);
    const latest = db.prepare(`
      SELECT response_payload FROM dict_query_log
      WHERE user_id = ? AND word = ? COLLATE NOCASE AND dict_type = ? AND is_success = 1
      ORDER BY created_at DESC LIMIT 1
    `).get(userId, cleanWord, dictType);
    try {
      const parsed = latest?.response_payload ? JSON.parse(latest.response_payload) : null;
      if (parsed?.payload) difyPayload = parsed.payload;
    } catch (_) {}
    const result = {
      ok: true,
      type: dictType,
      payload: sanitizeDictPayloadForDisplay(mergeCambridgeWithDify(cambridge, difyPayload, { mode: mergeMode })),
    };
    // 若最新已有 Dify 字段且本次合并后丢失，则放弃写入（防竞态覆盖）
    if (hasDifyEnrichmentPayload(difyPayload) && !hasDifyEnrichmentPayload(result.payload)) {
      console.warn(`[Dict Query] Cambridge 持久化跳过，避免覆盖 Dify 增强 (${cleanWord})`);
      return;
    }
    db.prepare(`
      INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, level, created_at, user_id)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), cleanWord, dictType, direction, userContext, locale, JSON.stringify(result), result.payload.level || null, Date.now(), userId);
  }).catch((error) => console.warn(`[Dict Query] Cambridge 后台持久化失败 (${cleanWord}):`, error.message));
}

// 词典查询：后端代理 Dify dict_tool_workflow，双轨架构（秒级即时直出 + 后台静默增强）
app.post('/api/dify/dict-query', async (req, res) => {
  req.setTimeout(0);
  res.setTimeout(0);
  const { word, dictType: rawDictType, direction = 'auto', userContext = '', locale = 'zh-CN', user_current_profile, userId } = req.body;
  
  // 强制校验：userId 必须存在且非空，防止缓存污染
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return res.status(400).json({ ok: false, message: 'userId is required for cache isolation' });
  }
  const cleanUserId = userId.trim().slice(0, 64);
  
  const dictType = ['zh_modern', 'en_en_business', 'en_zh_bidirectional'].includes(rawDictType) ? rawDictType : 'en_zh_bidirectional';

  if (!word || !String(word).trim()) {
    return res.status(400).json({ ok: false, message: 'Please input a word to query.' });
  }

  const cleanWord = String(word).trim();
  // 单个英文单词：英汉双向 → Cam 简中；英英词典 → Cam 英文；短语/句子不走 Cam
  const useCambridgeWordPath = isSingleEnglishWord(cleanWord) && (
    dictType === 'en_zh_bidirectional' || dictType === 'en_en_business'
  );
  const cambridgeEdition = dictType === 'en_en_business' ? 'english' : 'english-chinese-simplified';
  const cambridgeMergeMode = dictType === 'en_en_business' ? 'en_en' : 'en_zh';
  const useEnZhDifySyncPath = dictType === 'en_zh_bidirectional' && !useCambridgeWordPath;
  const cambridgePromise = useCambridgeWordPath
    ? fetchCambridgeEntry(cleanWord, { edition: cambridgeEdition }).catch((error) => {
        console.warn(`[Dict Query] Cambridge 抓取失败，回退 Dify (${cleanWord}):`, error.message);
        return null;
      })
    : null;
  if (useCambridgeWordPath) {
    persistCambridgeWhenReady({
      promise: cambridgePromise,
      cleanWord,
      dictType,
      direction,
      userContext,
      locale,
      userId: cleanUserId,
      mergeMode: cambridgeMergeMode,
    });
  }

  // 生词本：有可展示内容则构建种子（单词/短语/中文均可秒开）；单词路径还可补缺 Cam 缓存
  let vocabSeedPayload = null;
  let inVocabulary = false;
  try {
    const vocabRow = db.prepare(`
      SELECT payload FROM vocabulary
      WHERE user_id = ? AND word = ? COLLATE NOCASE AND payload IS NOT NULL
      ORDER BY added_at DESC LIMIT 1
    `).get(cleanUserId, cleanWord);
    if (vocabRow?.payload) {
      try {
        const parsedVocab = JSON.parse(vocabRow.payload);
        if (parsedVocab && (parsedVocab.meaning || parsedVocab.meaning_zh || parsedVocab.definition_en || parsedVocab.phonetic || parsedVocab.translation_main
          || (Array.isArray(parsedVocab.examples) && parsedVocab.examples.length)
          || (Array.isArray(parsedVocab.example_sentences) && parsedVocab.example_sentences.length)
          || (Array.isArray(parsedVocab.synonyms) && parsedVocab.synonyms.length))) {
          inVocabulary = true;
          vocabSeedPayload = scrubMismatchedVocabEnrichment(
            cleanWord,
            buildVocabSeedPayload(cleanWord, parsedVocab)
          );
        }
      } catch (_) {}
    }
  } catch (vocabErr) {
    console.warn('[Dict Query] 检索 vocabulary 库警告:', vocabErr.message);
  }

  const kickEnrichmentIfNeeded = (payload) => {
    const needsEnrichment = !hasDifyEnrichmentPayload(payload);
    if (needsEnrichment) {
      runBackgroundDifyDictEnrichment({
        cleanWord,
        dictType,
        direction: resolveDictDirection(dictType, direction, cleanWord),
        userContext,
        locale,
        user_current_profile,
        userId: cleanUserId,
        cambridgePromise,
      });
    }
    return needsEnrichment;
  };

  // —— 英汉双向：短语 / 句子 / 中文 → 缓存或同步等待 Dify（不走 Cambridge / 种子）——
  if (useEnZhDifySyncPath) {
    const resolvedDirection = resolveDictDirection(dictType, direction, cleanWord);
    try {
      const cached = db.prepare(`
        SELECT response_payload FROM dict_query_log
        WHERE word = ? COLLATE NOCASE
          AND dict_type = ?
          AND user_id = ?
          AND is_success = 1
          AND response_payload IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      `).get(cleanWord, dictType, cleanUserId);
      if (cached?.response_payload) {
        try {
          const cachedResult = JSON.parse(cached.response_payload);
          let basePayload = sanitizeDictPayloadForDisplay(cachedResult?.payload || {});
          if (!basePayload.direction_resolved) {
            basePayload.direction_resolved = resolvedDirection;
          }
          if (hasEnZhDifyDisplayPayload(basePayload)) {
            console.log(`[Dict Query] 英汉双向非单词命中缓存(Dify路径): "${cleanWord}"`);
            return res.json({
              ok: true,
              type: dictType,
              fromCache: true,
              backgroundEnriching: false,
              payload: basePayload,
              inVocabulary,
            });
          }
        } catch (_) {}
      }
    } catch (cacheErr) {
      console.warn('[Dict Query] 非单词路径读缓存警告:', cacheErr.message);
    }

    // C1：无可用缓存时，已收录 → 立刻展示生词本，后台异步拉 Dify 更新
    if (inVocabulary && hasVocabBookDisplayPayload(vocabSeedPayload)) {
      console.log(`[Dict Query] 生词本秒开（非单词路径）: "${cleanWord}"`);
      runBackgroundDifyDictEnrichment({
        cleanWord,
        dictType,
        direction: resolvedDirection,
        userContext,
        locale,
        user_current_profile,
        userId: cleanUserId,
        cambridgePromise: null,
      });
      const payload = sanitizeDictPayloadForDisplay({
        ...vocabSeedPayload,
        direction_resolved: resolvedDirection,
      });
      return res.json({
        ok: true,
        type: dictType,
        fromCache: false,
        fromVocabBook: true,
        backgroundEnriching: true,
        payload,
        inVocabulary: true,
      });
    }

    console.log(`[Dict Query] 英汉双向非单词，同步等待 Dify: "${cleanWord}" (${resolvedDirection})`);
    const difyParsed = await runBackgroundDifyDictEnrichment({
      cleanWord,
      dictType,
      direction: resolvedDirection,
      userContext,
      locale,
      user_current_profile,
      userId: cleanUserId,
      cambridgePromise: null,
      forceSync: true,
    });
    if (difyParsed?.payload) {
      const payload = sanitizeDictPayloadForDisplay({
        ...difyParsed.payload,
        direction_resolved: difyParsed.payload.direction_resolved || resolvedDirection,
      });
      return res.json({
        ok: true,
        type: dictType,
        fromCache: false,
        backgroundEnriching: false,
        payload,
        inVocabulary,
      });
    }
    return res.json({
      ok: false,
      type: dictType,
      message: '词典解析失败，请稍后重试',
      inVocabulary,
    });
  }

  // 1. 本地词典历史缓存：仅当已有 Cambridge 可展示主体时秒开；瘦缓存则继续走 Cambridge 路径
  try {
    const cached = db.prepare(`
      SELECT response_payload, level FROM dict_query_log
      WHERE word = ? COLLATE NOCASE
        AND dict_type = ?
        AND user_id = ?
        AND is_success = 1
        AND response_payload IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(cleanWord, dictType, cleanUserId);

    if (cached?.response_payload) {
      try {
        const cachedResult = JSON.parse(cached.response_payload);
        if (cachedResult && (cachedResult.ok || cachedResult.payload)) {
          if (!cachedResult.type) cachedResult.type = dictType;
          let basePayload = cachedResult.payload || {};
          // 生词本种子只补 Dify 类缺字段，不覆盖已有 Cambridge 主体（仅单词路径）
          if (vocabSeedPayload) {
            const fill = (key) => {
              const cur = basePayload[key];
              const seed = vocabSeedPayload[key];
              if (Array.isArray(cur) && cur.length > 0) return cur;
              if (Array.isArray(seed) && seed.length > 0) return seed;
              if (typeof cur === 'string' && cur.trim()) return cur;
              if (typeof seed === 'string' && seed.trim()) return seed;
              return cur ?? seed;
            };
            basePayload = {
              ...vocabSeedPayload,
              ...basePayload,
              synonyms: fill('synonyms'),
              antonyms: fill('antonyms'),
              collocations: fill('collocations'),
              business_examples: fill('business_examples'),
              etymology: fill('etymology'),
            };
          }

          if (cambridgePromise) {
            const cambridge = await settleWithin(cambridgePromise, hasCambridgeDisplayPayload(basePayload) ? 3000 : 8000);
            if (cambridge) basePayload = mergeCambridgeWithDify(cambridge, basePayload, { mode: cambridgeMergeMode });
          }

          basePayload = sanitizeDictPayloadForDisplay(basePayload);
          if (!basePayload.direction_resolved) {
            basePayload.direction_resolved = resolveDictDirection(dictType, direction, cleanWord);
          }
          // 仍无 Cambridge 主体且本可抓 Cambridge：不返回瘦缓存，落入首查路径
          if (useCambridgeWordPath && !hasCambridgeDisplayPayload(basePayload)) {
            console.log(`[Dict Query] 缓存过瘦，改走 Cambridge 秒开: "${cleanWord}"`);
          } else {
            console.log(`[Dict Query] 命中本地词典历史缓存: "${cleanWord}" (${dictType})`);
            const needsEnrichment = kickEnrichmentIfNeeded(basePayload);
            return res.json({
              ...cachedResult,
              ok: true,
              type: dictType,
              fromCache: true,
              backgroundEnriching: needsEnrichment,
              payload: basePayload,
              inVocabulary,
            });
          }
        }
      } catch (_) {}
    }
  } catch (cacheErr) {
    console.warn('[Dict Query] 读取本地历史缓存警告:', cacheErr.message);
  }

  // C1：缓存未命中/过瘦时，已收录则立刻用生词本秒开，再后台拉 Cam + Dify（勿阻塞在 8s）
  if (inVocabulary && hasVocabBookDisplayPayload(vocabSeedPayload)) {
    const resolvedDirection = resolveDictDirection(dictType, direction, cleanWord);
    console.log(`[Dict Query] 生词本秒开（单词路径）: "${cleanWord}" (${dictType})`);
    runBackgroundDifyDictEnrichment({
      cleanWord,
      dictType,
      direction: resolvedDirection,
      userContext,
      locale,
      user_current_profile,
      userId: cleanUserId,
      cambridgePromise,
    });
    const payload = sanitizeDictPayloadForDisplay({
      ...vocabSeedPayload,
      direction_resolved: resolvedDirection,
    });
    return res.json({
      ok: true,
      type: dictType,
      fromCache: false,
      fromVocabBook: true,
      backgroundEnriching: true,
      payload,
      inVocabulary: true,
    });
  }

  // 2. 单词首查 / 其它词典：Cambridge 秒开 + 生词本种子补缺（短语/中文不会进入此分支）
  const resolvedDirection = resolveDictDirection(dictType, direction, cleanWord);
  console.log(`[Dict Query] Cambridge 秒开（生词本仅作种子）: "${cleanWord}" (${dictType})`);
  runBackgroundDifyDictEnrichment({
    cleanWord,
    dictType,
    direction: resolvedDirection,
    userContext,
    locale,
    user_current_profile,
    userId: cleanUserId,
    cambridgePromise,
  });

  const cambridge = await settleWithin(cambridgePromise, 8000);
  let instantPayload = vocabSeedPayload
    ? { ...buildInstantDictPayload(cleanWord, dictType), ...vocabSeedPayload }
    : buildInstantDictPayload(cleanWord, dictType);
  if (!instantPayload.direction_resolved) {
    instantPayload.direction_resolved = resolvedDirection;
  }
  const payload = sanitizeDictPayloadForDisplay(
    cambridge ? mergeCambridgeWithDify(cambridge, instantPayload, { mode: cambridgeMergeMode }) : instantPayload
  );
  return res.json({
    ok: true,
    type: dictType,
    fromCache: false,
    backgroundEnriching: !hasDifyEnrichmentPayload(payload),
    payload,
    inVocabulary,
  });
});

// 辅助函数：从混杂文本中提取可 JSON.parse 的片段（剥离 <think> 标签，```json 块或最外侧 {}）
function extractJsonFromString(raw) {
  let rawStr = String(raw ?? '').trim();
  rawStr = rawStr.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const jsonBlockMatch = rawStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
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

  const apiKey = process.env.DIFY_WRITE_GOVERNANCE_API_KEY || process.env.DIFY_WRITE_GOVERNANCE_KEY;
  const baseUrl = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  const userId = req.body?.userId || req.body?.user || 'default-user';
  const {
    loadInjectedKnowledgeSafe,
    attachKnowledgeContext,
    appendKnowledgeTracesSafe,
  } = require('./services/gameTheoryKnowledge');
  const injected = loadInjectedKnowledgeSafe(db, userId, 'writing');

  try {
    console.log(`[Write Review] 开始进行书面批阅评估，主题: "${theme}"`);

    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: attachKnowledgeContext({
          user_text: user_text.trim(),
          mail_intent: mail_intent.trim(),
          theme: theme.trim(),
          user_current_profile: resolveProfileForDify(userId, user_current_profile)
        }, injected.context),
        response_mode: 'blocking',
        user: userId
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Write Review] Dify 服务器返回错误(${response.status}):`, errText);
      return res.status(response.status).json({ success: false, error: `Dify 接口异常: ${response.status}`, details: errText });
    }

    const data = await response.json();
    const resultStr = data?.data?.outputs?.result;

    if (!resultStr) {
      console.warn('[Write Review] 工作流未返回 result 字段:', data);
      return res.status(500).json({ success: false, error: 'Dify 工作流未返回正确的 result 字段' });
    }

    let parsedResult;
    try {
      parsedResult = typeof resultStr === 'object' && resultStr !== null
        ? resultStr
        : JSON.parse(extractJsonFromString(resultStr));
    } catch (e) {
      console.error('[Write Review] 解析 result JSON 失败:', e, resultStr);
      return res.status(500).json({ success: false, error: '工作流结果解析异常，返回数据非合法 JSON' });
    }

    const responseData = {
      L1: parsedResult.L1 || parsedResult.L1_Grammar || '',
      L2: parsedResult.L2 || parsedResult.L2_Business_Tone || '',
      L3: parsedResult.L3 || parsedResult.L3_Strategic_Position || '',
      optimized_version: parsedResult.optimized_version || ''
    };

    console.log(`[Write Review] 批阅成功，已清理并返回纯 JSON 数据`);
    appendKnowledgeTracesSafe(db, userId, injected.ids, { module: 'writing', action: 'analyzed' });
    return res.json({
      success: true,
      data: responseData,
      knowledgeReminder: injected.reminder,
      knowledgeSynced: injected.syncedCount,
      knowledgeUsed: injected.usedCount,
    });
  } catch (error) {
    console.error('[Write Review] 服务端请求异常', error);
    return res.status(500).json({ success: false, error: `服务器内部异常: ${error.message}` });
  }
});


// 词典覆盖率统计接口（COUNT + GROUP BY level，禁止 SELECT response_payload）
app.get('/api/dify/dict-coverage', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM dict_query_log').get().count;
    const success = db.prepare('SELECT COUNT(*) as count FROM dict_query_log WHERE is_success = 1').get().count;
    const successRate = total > 0 ? (success / total * 100).toFixed(2) : 0;

    const rows = db.prepare('SELECT level, COUNT(*) as count FROM dict_query_log WHERE is_success = 1 GROUP BY level').all();
    const levelCounts = {
      'CET-4': 0,
      'CET-6': 0,
      '考研': 0,
      'TOEFL': 0,
      'GRE': 0,
      'BUSINESS': 0,
      '其他': 0,
      '未分类': 0
    };

    rows.forEach(r => {
      const lvl = typeof r.level === 'string' ? r.level.trim() : '';
      const count = Number(r.count) || 0;
      if (lvl && Object.prototype.hasOwnProperty.call(levelCounts, lvl) && lvl !== '其他' && lvl !== '未分类') {
        levelCounts[lvl] += count;
      } else if (lvl) {
        levelCounts['其他'] += count;
      } else {
        levelCounts['未分类'] += count;
      }
    });

    res.json({
      success: true,
      total_queries: total,
      success_queries: success,
      success_rate: parseFloat(successRate),
      level_distribution: levelCounts
    });
  } catch (error) {
    console.error('[dify/dict-coverage]', error);
    res.status(500).json({ error: 'Database error on dict-coverage' });
  }
});

// ==========================================
// ???????????????????????????? API
// ==========================================

// ????????????????????????????
app.get('/api/vocab/memory/:id', (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
        const row = db.prepare('SELECT memory_aids FROM vocabulary WHERE id = ? AND user_id = ?').get(req.params.id, userId);
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
    payload.meaning === '待复习补充' ||
    payload.meaning === '待复习补充' ||
    (payload.phonetic && payload.phonetic.includes('??')) ||
    (payload.definition_en && payload.definition_en.includes('精准定义')) ||
    (payload.business_note && payload.business_note.includes('特定商环境')) ||
    (Array.isArray(payload.examples) && payload.examples.some(ex => typeof ex === 'string' && ex.includes('例句1')));

  if (hasPlaceholder) {
    console.log(`[Payload Enrich] 检测到词条 "${row.word}" (ID: ${row.id}) 使用了占位符 payload，正在启动静默字典查询纠正...`);
    const DIFY_DICT_API_KEY = process.env.DIFY_DICT_API_KEY || "";
  if (!DIFY_DICT_API_KEY) throw new Error("Server missing DIFY_DICT_API_KEY");
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

            let meaning = dp.translation_main || (Array.isArray(dp.definitions_en) ? dp.definitions_en[0] : '待复习补充');
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
              source: '自动纠正净化'
            };

            db.prepare('UPDATE vocabulary SET payload = ? WHERE id = ?').run(JSON.stringify(newPayload), row.id);
            console.log(`[Payload Enrich] 成功更新词条 "${row.word}" 数据库 payload`);
            return newPayload;
          }
        }
      }
    } catch (err) {
      console.error(`[Payload Enrich] 静默字典查询及更新失败 for "${row.word}":`, err);
    }
  }

  return payload;
}

// ????? Dify ?????????????????????????????????
app.post('/api/vocab/enrich-memory/:id', async (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
    const { user_current_profile } = req.body;
    const row = db.prepare('SELECT * FROM vocabulary WHERE id = ? AND user_id = ?').get(req.params.id, userId);
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

    const memoryApiKey = process.env.DIFY_MEMORY_AID_API_KEY;
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    console.log(`[Memory Aid] Generating memory aid for "${word}" (ID: ${row.id})`);

    let parsedResult = null;
    try {
      parsedResult = await vocabMatrixEnricher.runMemoryAidWorkflow({
        word,
        phonetic,
        pos,
        definition,
        examples,
        userProfile: resolveProfileForDify(userId, user_current_profile),
        apiKey: memoryApiKey,
        baseUrl,
      });
    } catch (wfErr) {
      console.warn(`[Memory Aid] workflow failed for "${word}":`, wfErr.message);
    }

    if (!parsedResult || !(parsedResult.root_memory || parsedResult.association_memory || parsedResult.image_prompt)) {
      const fallback = vocabMatrixEnricher.buildFallbackMemoryAids(payload, word);
      parsedResult = {
        root_memory: parsedResult?.root_memory || fallback.root_memory,
        association_memory: parsedResult?.association_memory || fallback.association_memory,
        mnemonic_phrase: parsedResult?.mnemonic_phrase || fallback.mnemonic_phrase,
        image_prompt: parsedResult?.image_prompt || fallback.image_prompt,
      };
    }

    if (!parsedResult.root_memory && !parsedResult.association_memory && !parsedResult.image_prompt) {
      return res.status(500).json({ error: '记忆辅助生成失败，请稍后重试' });
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

    db.prepare('UPDATE vocabulary SET memory_aids = ? WHERE id = ? AND user_id = ?').run(
      JSON.stringify(mergedMemoryAids),
      row.id,
      userId,
    );

    res.json(mergedMemoryAids);
  } catch (error) {
    console.error('[Memory Aid Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// ????????????????????????????????
app.get('/api/vocab/ebbinghaus/:id', (req, res) => {
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
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
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
        const { user_current_profile } = req.body;
    const row = db.prepare('SELECT id, word, memory_aids FROM vocabulary WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!row) {
      return res.status(404).json({ error: 'Word not found' });
    }

    let memoryAids = {};
    try { memoryAids = JSON.parse(row.memory_aids || '{}'); } catch {}

    if (!memoryAids.image_prompt) {
      return res.status(400).json({ error: 'No image_prompt found, please generate memory aids first' });
    }

    const taskQueue = require('./services/taskQueue');
    const taskName = `生成记忆图片: ${row.word}`;
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

        taskQueue.updateTask(task.id, { status: 'running', logs: ['开始调用 Agnes /v1/images/generations'] });
        console.log(`[generate-image] prompt: "${memoryAids.image_prompt}", models: [${models.join(', ')}]`);

        let imageUrl = '';
        let downloadUrl = '';
        let lastError = '';

        for (const model of models) {
          console.log(`[generate-image] try model=${model}`);
          taskQueue.updateTask(task.id, { logs: [`尝试模型: ${model}`] });

          const result = await tryGenerateImageOnce(baseUrl, apiKey, model, memoryAids.image_prompt);
          if (result.ok) {
            imageUrl = result.imageUrl;
            downloadUrl = result.downloadUrl;
            console.log(`[generate-image] success model=${model} url=${imageUrl}`);
            taskQueue.updateTask(task.id, { logs: [`模型 ${model} 成功`] });
            break;
          } else {
            lastError = result.error;
            console.log(`[generate-image] model ${model} failed: ${lastError}`);
            taskQueue.updateTask(task.id, { logs: [`模型 ${model} 失败: ${lastError}`] });
          }
        }

        if (!imageUrl) {
          const fallbackBase = process.env.IMAGE_GEN_FALLBACK_URL || 'https://9router.234124123.xyz/v1';
          const fallbackKey = process.env.IMAGE_GEN_FALLBACK_API_KEY || 'sk-d2c5fb65e9516bbc-rd1lv9-762292df';
          const fallbackModel = process.env.IMAGE_GEN_FALLBACK_MODEL || 'ag/gemini-3.1-flash-image';
          taskQueue.updateTask(task.id, { logs: [`Agnes 全部失败，尝试备用生图: ${fallbackModel}`] });
          const fallbackResult = await tryGenerateImageOnce(fallbackBase, fallbackKey, fallbackModel, memoryAids.image_prompt);
          if (fallbackResult.ok) {
            imageUrl = fallbackResult.imageUrl;
            downloadUrl = fallbackResult.downloadUrl;
            lastError = '';
            taskQueue.updateTask(task.id, { logs: [`备用模型 ${fallbackModel} 成功`] });
          } else {
            lastError = fallbackResult.error;
            taskQueue.updateTask(task.id, { logs: [`备用生图失败: ${lastError}`] });
          }
        }

        if (!imageUrl) {
          console.error('[generate-image] all models failed');
          taskQueue.updateTask(task.id, {
            status: 'failed',
            error: `所有生图模型均失败，最后错误: ${lastError}`
          });
          return;
        }

        // ????????????
        memoryAids.image_url = imageUrl;
        memoryAids.download_url = downloadUrl;
        memoryAids.image_generated_at = Date.now();

        db.prepare('UPDATE vocabulary SET memory_aids = ? WHERE id = ? AND user_id = ?')
          .run(JSON.stringify(memoryAids), row.id, userId);

        taskQueue.updateTask(task.id, {
          status: 'completed',
          result: {
            id: row.id,
            image_url: imageUrl,
            download_url: downloadUrl,
          },
          logs: ['图片生成与入库完成']
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

// 处理材料提纯解析请求（真实 Dify 联动：找库 -> 清空 -> 上传 -> 工作流抽提）
app.post('/api/material/process-and-extract', async (req, res) => {
  const { topic, userId, files, user_current_profile } = req.body;

  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: '未提供可处理的上传文件' });
  }

  const taskQueue = require('./services/taskQueue');
  const taskName = `材料提纯: ${files[0]?.fileName || '未知文件'}`;
  const task = taskQueue.createTask('material', taskName);

  // 立即返回 taskId，后续在后台异步执行
  res.json({ success: true, taskId: task.id, status: task.status });

  // 异步执行材料上传与知识库写入流程
  setImmediate(async () => {
    // 创建 Dify 知识库文档，轮询索引状态，触发提纯工作流，写入生词本
    const DATASET_KEY = 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
    const WORKFLOW_KEY = process.env.DIFY_VIDEO_WORKFLOW_KEY || 'app-cArGQg7bAnePU0ts63FoHrAG';
    const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    try {
      taskQueue.updateTask(task.id, {
        status: 'running',
        progress: 5,
        logs: ['[进度] 正在初始化提取任务…']
      });

      // ---------------------------------------------------------
      // 使用固定 ID 直接访问 Knowleage_Pro_Scenarios 知识库
      // ---------------------------------------------------------
      const datasetId = KNOWLEAGE_PRO_SCENARIOS_DATASET_ID;

      // ---------------------------------------------------------
      // 批量删除旧文档（如果存在）
      // ---------------------------------------------------------
      taskQueue.updateTask(task.id, {
        progress: 20,
        logs: ['[进度] 正在清空 Knowleage_Pro_Scenarios 知识库…']
      });
      const docsResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/documents?page=1&limit=100`, {
        headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
      });
      if (!docsResponse.ok) throw new Error(`获取知识库文档列表失败 (HTTP ${docsResponse.status})`);
      const docsData = await docsResponse.json();
      const docIds = docsData.data?.map(d => d.id) || [];

      // 异步并行删除所有旧文档
      if (docIds.length > 0) {
        taskQueue.updateTask(task.id, {
          progress: 30,
          logs: [`[进度] 发现已存在 ${docIds.length} 个旧文档，正在清空…`]
        });
        await Promise.all(docIds.map(async docId => {
          const delRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${docId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
          });
          if (!delRes.ok) console.warn(`[警告] 删除旧文档 ${docId} 失败 (HTTP ${delRes.status})`);
        }));
        taskQueue.updateTask(task.id, {
          progress: 40,
          logs: ['[进度] 旧文档清空完成']
        });
      } else {
        taskQueue.updateTask(task.id, {
          progress: 40,
          logs: ['[进度] 知识库为空，无需清空']
        });
      }

      // ---------------------------------------------------------
      // 准备上传文件到 Dify 知识库
      // ---------------------------------------------------------
      taskQueue.updateTask(task.id, {
        progress: 45,
        logs: ['[进度] 正在解析 Base64 格式的上传材料…']
      });
      const fileObj = files[0];
      const base64Data = fileObj.content || fileObj.base64 || '';
      const base64Content = base64Data.replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');

      // 校验文件大小限制（50MB）
      const MAX_FILE_SIZE = 50 * 1024 * 1024;
      if (buffer.length > MAX_FILE_SIZE) {
        throw new Error(`上传文件超过50MB限制（当前 ${Math.round(buffer.length / 1024 / 1024)}MB），请上传更小的文件！`);
      }

      // Node 18+ 使用全局 Blob 构造 FormData（兼容浏览器和 Node 环境）
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', blob, fileObj.fileName || 'upload_material.pdf');
      // 使用 Hierarchical 模式保留文档结构（段+子段）
      // 配置解析规则：预处理（去多余空格）、父段落模式、子段分割
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

      taskQueue.updateTask(task.id, {
        progress: 50,
        logs: ['[进度] 正在上传解析后的材料到 Dify 知识库…']
      });
      const uploadResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/document/create_by_file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DATASET_KEY}` },
        body: formData
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`Dify 文件上传失败: ${errText}`);
      }

      const uploadData = await uploadResponse.json();
      const documentId = uploadData.document?.id;
      const batchId = uploadData.batch;

      if (!documentId || !batchId) {
        throw new Error('未能从 Dify 响应中获取 document / batch ID');
      }

      taskQueue.updateTask(task.id, {
        progress: 55,
        logs: [`[进度] 导入文档成功 (ID: ${documentId}, Batch: ${batchId})，正在开始索引…`]
      });

      // ---------------------------------------------------------
      // 轮询 Dify 文档索引状态，等待向量化完成
      // ---------------------------------------------------------
      let isIndexed = false;
      // 动态计算超时轮数：根据文件大小调整（小文件快，大文件慢）
      const maxRetries = buffer.length < 10 * 1024 * 1024 ? 60 : (buffer.length < 30 * 1024 * 1024 ? 90 : 120); // 最多 6分钟
      for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const statusRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${batchId}/indexing-status`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
        });

        if (!statusRes.ok) continue; // 本轮状态查询失败则跳过，继续下一轮
        const statusData = await statusRes.json();
        // 获取单个文档的索引状态（pending / indexing / completed / error）
        const docInfo = statusData.data?.[0];

        if (docInfo) {
          taskQueue.updateTask(task.id, {
            progress: Math.min(68, 55 + i),
            logs: [`[进度] 第 ${i + 1} 轮获取 Dify 索引状态: ${docInfo.indexing_status}`]
          });
          if (docInfo.indexing_status === 'completed') {
            isIndexed = true;
            break;
          } else if (docInfo.indexing_status === 'error') {
            throw new Error('Dify 文档索引失败，请检查上传文件或知识库配置');
          }
        }
      }

      if (!isIndexed) {
        throw new Error('Dify indexing timeout (>300s).');
      }

      taskQueue.updateTask(task.id, {
        progress: 70,
        logs: ['[进度] 知识库文档向量化就绪，准备提纯…']
      });

      // --- 展示用正文：优先本地抽取原文；Dify 分段仅作回退（分段拼接会改段落结构）---
      // Dify knowledge create-by-file / hierarchical 用于检索提纯，不宜作为阅读器展示源。
      let articleText = "";
      let originalText = "";
      const uploadedFileName = fileObj.fileName || '';
      try {
        const isPlainText = /\.(txt|md|text|html|htm)$/i.test(uploadedFileName);
        const isPdf = /\.pdf$/i.test(uploadedFileName) || (!uploadedFileName && buffer.length > 4 && buffer.slice(0, 5).toString() === '%PDF-');

        if (isPlainText && buffer.length > 0) {
          originalText = buffer.toString('utf-8');
          taskQueue.updateTask(task.id, {
            logs: ['[进度] 纯文本材料，已直接解码为展示原文']
          });
        } else if (isPdf && buffer.length > 0) {
          const pdfParse = require('pdf-parse');
          const pdfData = await pdfParse(buffer);
          originalText = String(pdfData?.text || '').replace(/\r\n/g, '\n').trim();
          taskQueue.updateTask(task.id, {
            logs: [`[进度] PDF 本地抽文本完成（约 ${originalText.length} 字），用于沉浸式阅读展示`]
          });
        }
      } catch (e) {
        console.warn('[Material] 本地抽取原文失败，将回退 Dify 分段:', e.message);
        originalText = '';
        taskQueue.updateTask(task.id, {
          logs: [`[进度] 本地原文抽取失败（${e.message}），回退 Dify 分段拼接`]
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
            console.warn("[Material] 获取文档分段失败", segmentsRes.status);
          }
        } catch (e) {
          console.error("[Material] 获取文档分段异常:", e.message);
        }
      }

      // ---------------------------------------------------------
      // 运行 Dify 英文商业实战材料提纯工作流
      // ---------------------------------------------------------
      taskQueue.updateTask(task.id, {
        progress: 75,
        logs: ['[进度] 正在运行 Dify 提纯工作流提取核心词句…']
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
            // english_mastery_logic 声明字段为 material_text；缺此字段时 Dify 正文为空 → result=[]
            material_text: articleText || '',
            user_current_profile: resolveProfileForDify(userId, user_current_profile),
            article_text: articleText || '',
            content: articleText || '',
          },
          response_mode: 'blocking',
          user: userId || 'system'
        })
      });

      if (!wfResponse.ok) {
        const errText = await wfResponse.text().catch(() => '');
        throw new Error(`提纯工作流失败 (HTTP ${wfResponse.status}): ${errText.substring(0, 200)}`);
      }
      const wfData = await wfResponse.json();

      // 从工作流 outputs 中提取词汇和句型结果
      const outputs = wfData?.data?.outputs || {};
      const rawExtracted = outputs.extracted_words || outputs.vocabulary || outputs.terms || outputs.new_words || outputs.result || outputs.text || '';

      let extractedItems = [];
      if (Array.isArray(rawExtracted)) {
        extractedItems = rawExtracted;
      } else if (typeof rawExtracted === 'string') {
        // 尝试将字符串结果解析为 JSON 格式
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
          if (Array.isArray(parsed.vocabulary)) extractedItems.push(...parsed.vocabulary);
          if (Array.isArray(parsed.terms)) extractedItems.push(...parsed.terms);
          if (Array.isArray(parsed.new_words)) extractedItems.push(...parsed.new_words);
          if (Array.isArray(parsed)) extractedItems = parsed;
        } catch (e) {
          // 解析失败时按逗号/换行粗分
          extractedItems = rawExtracted.split(/[,，、\n]+/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 500);
        }
      }

      // 根据 extractedItems 中每项的 category 字段补充布尔标记
      for (const item of extractedItems) {
        if (typeof item === 'object' && item !== null) {
          // 若模型已给出 category，则同步到 is_phrase / is_sentence
          if (item.category === 'word') item.is_phrase = false;
          else if (item.category === 'phrase') item.is_phrase = true;
          else if (item.category === 'sentence') item.is_sentence = true;
        }
      }

      let wordsToReturn = [];
      let phrasesToReturn = [];
      let sentencesToReturn = [];

      // 按词数规则分类
      for (const item of extractedItems) {
        const isObject = typeof item === 'object' && item !== null;
        const wordStr = isObject ? (item.word || item.phrase || item.text || JSON.stringify(item)) : item;
        const cleanStr = String(wordStr).trim();
        if (!cleanStr) continue;

        // 统一走词数分类，决定写入词/词组/句型
        let dictType = classifyByWordCount(cleanStr);

        if (dictType === 'ai_sentence') {
          sentencesToReturn.push(isObject ? item : cleanStr);
        } else if (dictType === 'ai_phrase') {
          phrasesToReturn.push(isObject ? item : cleanStr);
        } else {
          wordsToReturn.push(isObject ? item : cleanStr);
        }
      }

      // 合并词汇和词组，准备写入数据库
      const vocabToInsert = [...wordsToReturn, ...phrasesToReturn];

      taskQueue.updateTask(task.id, {
        progress: 85,
        logs: [`[进度] 提取到 ${vocabToInsert.length} 个词汇和 ${sentencesToReturn.length} 个句子，不写入生词本，请逐条点「+ 政商务」或「+ 全场景」`]
      });

      /**
       * 计算字符串中的英文单词数（用于分类词汇/词组/句型）
       * @param {string} str - 输入字符串
       * @returns {number} 单词数量
       */
      function countWords(str) {
  const hasChinese = /[\u4e00-\u9fff]/.test(str);
  if (hasChinese) return Math.ceil(str.replace(/[.!?,;'":()[]{}.!?，、]/g, '').length / 2);
        return str
          .trim()
          .replace(/[.!?,;:'"()[\]{}]/g, '')   // 去掉常见标点
          .split(/\s+/)                           // 按空白分词
          .filter(w => w.length > 0)             // 去掉空段
          .length;
      }

      /**
       * 按英文单词数粗分类型
       * - ai_extracted：约 1 个词
       * - ai_phrase：至少 2 个词且不以句号结尾
       * - ai_sentence：以 . ! ? 结尾且至少 5 个词
       *
       * @param {string} wordStr - 待分类文本
       * @returns {'ai_extracted'|'ai_phrase'|'ai_sentence'}
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

      // 提纯只产出候选，不写入生词本（与长文一致，由用户逐条点「+ 收录」）
      const addedCount = 0;
      const addedSentenceCount = 0;

      // 组装思维导图与核心知识点框架
      taskQueue.updateTask(task.id, {
        progress: 90,
        logs: ['[进度] 正在生成材料思维导图与核心知识点框架…']
      });

      let mindmapAndTheory = null;
      try {
        mindmapAndTheory = await generateMindmapAndTheoryNodesFallback(articleText, topic);
      } catch (err) {
        console.error('[Material Process] Mindmap generation failed:', err.message);
      }

      let vaultImport = { createdCount: 0, skippedCount: 0 };
      if (mindmapAndTheory && Array.isArray(mindmapAndTheory.theoryNodes) && mindmapAndTheory.theoryNodes.length) {
        try {
          if (!userId) {
            console.warn('[Material Process] skip vault theory import: userId missing');
          } else {
            const { importTheoryNodeDrafts } = require('./services/knowledgeTheoryNodes');
            vaultImport = importTheoryNodeDrafts(db, {
              userId,
              fileName: fileObj.fileName || 'Document',
              mimeType: fileObj.mimeType || fileObj.type || '',
              theoryNodes: mindmapAndTheory.theoryNodes,
              mindmap: mindmapAndTheory.mindmap || null,
              topic: topic || fileObj.fileName || 'Document',
              taskId: task.id,
            });
          }
        } catch (err) {
          console.error('[Material Process] vault theory import failed:', err.message);
        }
      }

      // 组装完成结果并标记任务完成
      taskQueue.updateTask(task.id, {
        status: 'completed',
        progress: 100,
        result: {
          success: true,
          topic: topic || 'Unknown Topic',
          name: fileObj.fileName || "Document",
          total: files.length,
          words: wordsToReturn.map(i => typeof i === 'object' ? (i.word || i.text) : String(i)),
          phrases: phrasesToReturn.map(i => typeof i === 'object' ? (i.word || i.phrase || i.text) : String(i)),
          sentences: sentencesToReturn.map(i => typeof i === 'object' ? (i.word || i.sentence || i.text) : String(i)),
          addedSentenceCount,
          article: articleText,
          originalText: originalText || undefined,
          mindmap: mindmapAndTheory ? mindmapAndTheory.mindmap : undefined,
          theoryNodes: mindmapAndTheory ? mindmapAndTheory.theoryNodes : undefined,
          scenario: mindmapAndTheory ? mindmapAndTheory.scenario : undefined,
          vaultDraftCount: vaultImport.createdCount,
          vaultDraftSkipped: vaultImport.skippedCount,
          results: [
            {
              fileName: fileObj.fileName || "Document",
              summary: `Closed loop completed: cleared ${docIds.length} old documents, new file imported successfully. Model extracted ${vocabToInsert.length} terms. Vocab not auto-inserted; user must collect manually.`,
              key_points: wordsToReturn.slice(0, 5).map(i => typeof i === 'object' ? (i.word || i.text) : String(i))
            }
          ]
        },
        logs: [
          `[完成] Dify 提纯分析完成（不写入生词本，请逐条点「+ 政商务」或「+ 全场景」）。已写入资料抽屉理论草稿 ${vaultImport.createdCount} 条（未同步），跳过 ${vaultImport.skippedCount} 条。`
        ]
      });

    } catch (error) {
      console.error('[Material Process Worker Error]:', error);
      taskQueue.updateTask(task.id, {
        status: 'failed',
        progress: 100,
        logs: [`[错误] 提纯分析失败: ${error.message}`]
      });
    }
  });
});// ==========================================
// 清空今日配额与当日新增词条（生词本日清）
// 若传入 theme/genre/cefrLevel/duration：同步删除当前条件下的长文与对应音频
// ==========================================
app.post('/api/english/clear-today', (req, res) => {
  const { userId = 'default-user' } = req.body || {};
  const uid = dailyPackService.normalizeUserId(userId);
  const today = dailyPackService.getPackDate();
  const theme = String(req.body?.topic || req.body?.theme || '').trim();
  const genre = String(req.body?.genre || '').trim();
  const cefrLevel = String(req.body?.cefrLevel || req.body?.cefr_level || '').trim();
  const duration = String(req.body?.duration ?? '').trim();
  const clearCombo = Boolean(theme && genre && cefrLevel && duration);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  try {
    // 1. 删除今日入库生词/短语，并重置配额（原行为保留）
    const deleteWords = db.prepare(
      "DELETE FROM vocabulary WHERE added_at >= ? AND (dict_type = 'ai_extracted' OR dict_type = 'ai_phrase')",
    );
    const wordsResult = deleteWords.run(todayStartMs);

    const resetQuota = db.prepare(
      'UPDATE daily_vocab_quota SET words_added = 0, phrases_added = 0 WHERE user_id = ? AND quota_date = ?',
    );
    const quotaResult = resetQuota.run(uid, today);

    let deletedExtracted = 0;
    let deletedListenArticles = 0;
    let deletedListenAudios = 0;
    let unlinkedFiles = 0;

    // 2. 按当前条件删除长文缓存 + 听力正文/音频记录与磁盘文件
    if (clearCombo) {
      const durationNum = Number(duration);
      deletedExtracted = db.prepare(`
        DELETE FROM daily_extracted_articles
        WHERE user_id = ?
          AND quota_date = ?
          AND theme = ?
          AND genre = ?
          AND cefr_level = ?
          AND (duration = ? OR duration = ?)
      `).run(uid, today, theme, genre, cefrLevel, duration, durationNum).changes;

      const listenArts = db.prepare(`
        SELECT id, file_path FROM daily_listen_articles
        WHERE user_id = ?
          AND pack_date = ?
          AND theme = ?
          AND genre = ?
          AND cefr_level = ?
          AND (duration = ? OR duration = ?)
      `).all(uid, today, theme, genre, cefrLevel, duration, durationNum);
      for (const row of listenArts) {
        dailyListenPreGenerateService.unlinkQuiet(row.file_path);
        if (row.file_path) unlinkedFiles += 1;
      }
      deletedListenArticles = db.prepare(`
        DELETE FROM daily_listen_articles
        WHERE user_id = ?
          AND pack_date = ?
          AND theme = ?
          AND genre = ?
          AND cefr_level = ?
          AND (duration = ? OR duration = ?)
      `).run(uid, today, theme, genre, cefrLevel, duration, durationNum).changes;

      const listenAuds = db.prepare(`
        SELECT id, audio_path FROM daily_listen_audios
        WHERE user_id = ?
          AND pack_date = ?
          AND theme = ?
          AND genre = ?
          AND cefr_level = ?
          AND (duration = ? OR duration = ?)
      `).all(uid, today, theme, genre, cefrLevel, duration, durationNum);
      for (const row of listenAuds) {
        dailyListenPreGenerateService.unlinkQuiet(row.audio_path);
        if (row.audio_path) unlinkedFiles += 1;
      }
      deletedListenAudios = db.prepare(`
        DELETE FROM daily_listen_audios
        WHERE user_id = ?
          AND pack_date = ?
          AND theme = ?
          AND genre = ?
          AND cefr_level = ?
          AND (duration = ? OR duration = ?)
      `).run(uid, today, theme, genre, cefrLevel, duration, durationNum).changes;
    }

    console.log(
      `[Clear Today] User ${uid}: vocab=${wordsResult.changes}, quotaReset=${quotaResult.changes > 0}, ` +
        `combo=${clearCombo ? `${theme}/${genre}/${cefrLevel}/${duration}` : 'none'}, ` +
        `extracted=${deletedExtracted}, listenArt=${deletedListenArticles}, listenAud=${deletedListenAudios}, files=${unlinkedFiles}`,
    );

    return res.json({
      success: true,
      message: clearCombo
        ? '已清空今日配额/生词，并删除当前条件下的长文与对应音频。'
        : "Successfully cleared today's vocabulary entries and reset daily quota.",
      deletedCount: wordsResult.changes,
      quotaReset: quotaResult.changes > 0,
      clearedCombo: clearCombo
        ? {
            theme,
            genre,
            cefrLevel,
            duration,
            packDate: today,
            deletedExtracted,
            deletedListenArticles,
            deletedListenAudios,
            unlinkedFiles,
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to clear today's data:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 多角色沙盘：English_Oral_Sandbox v10 时间 inputs 注入（与前端 profileHelper 对齐）
// ==========================================
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
  const weekdayMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
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
  if (!base.theme) base.theme = '商务谈判：让步与施压';
  if (!base.genre) base.genre = 'meeting';
  if (!base.cefr_level) base.cefr_level = 'B1';
  if (!base.duration) base.duration = '15';
  return base;
}

// ==========================================
// 多角色沙盘：主对话代理（English_Oral_Sandbox Chatflow）
// API Key 仅保存在服务端 DIFY_ORAL_API_KEY
// 支持 response_mode: 'streaming' (SSE) 与 'blocking' (JSON)
// ==========================================
app.post('/api/english/oral/chat', async (req, res) => {
  const {
    query,
    conversationId = null,
    userId = 'default-user',
    inputs = {},
    stream = false,
  } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ message: '缺少 query 参数。' });
  }

  const isStream = Boolean(stream === true || stream === 'true');
  const apiKey = process.env.DIFY_ORAL_API_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL
    || process.env.VITE_DIFY_API_BASE_URL
    || 'https://dify.234124123.xyz/v1';

  console.log(`[沙盘推演] 正在启动多角色谈判沙盘对话推演 (${isStream ? '实时流式通道' : '标准响应通道'})...`);

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
        response_mode: isStream ? 'streaming' : 'blocking',
        user: userId,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const { mapOralUpstreamError } = require('./services/oralChatUpstreamError');
      const mapped = mapOralUpstreamError(response.status, errorData);
      console.warn('[沙盘推演] 远程推演服务响应异常 (' + response.status + ' → ' + mapped.status + '):', mapped.body);
      return res.status(mapped.status).json(mapped.body);
    }

    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      if (response.body) {
        const reader = typeof response.body.getReader === 'function' ? response.body.getReader() : null;
        if (reader) {
          let isFirstChunk = true;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (isFirstChunk) {
                console.log('[沙盘推演] 收到首段推演思维与发言，正在持续流式呈现...');
                isFirstChunk = false;
              }
              res.write(value);
              if (typeof res.flush === 'function') res.flush();
            }
          } finally {
            reader.releaseLock?.();
          }
          console.log('[沙盘推演] 本轮多角色沙盘推演流式输出完成');
          return res.end();
        } else if (typeof response.body.pipe === 'function') {
          response.body.pipe(res);
          return;
        }
      }
      return res.end();
    } else {
      const data = await response.json().catch(() => ({}));
      console.log('[沙盘推演] 本轮多角色沙盘推演完成 (标准报文)');
      return res.json(data);
    }
  } catch (err) {
    console.warn('[沙盘推演] 沙盘推演代理通道异常: ' + err.message);
    if (isStream && res.headersSent) {
      res.write(`data: ${JSON.stringify({ event: 'error', message: err.message || '推演中断' })}\n\n`);
      return res.end();
    }
    return res.status(500).json({ fallback: true, message: err.message || '口语沙盘对话代理失败' });
  }
});

app.get('/api/english/oral/opening', (req, res) => {
  try {
    const userId = req.query.userId || req.query.user || 'default-user';
    const payload = oralOpeningCacheService.getOpening(db, {
      userId,
      packDate: req.query.packDate || req.query.date,
      theme: req.query.theme,
      sceneId: req.query.sceneId,
    });
    res.json(payload);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/english/oral/opening/backfill', (req, res) => {
  try {
    const body = req.body || {};
    const userId = body.userId || body.user || 'default-user';
    const sceneId = body.sceneId;
    if (!sceneId) {
      return res.status(400).json({ success: false, error: 'sceneId required' });
    }
    const taskQueue = require('./services/taskQueue');
    const theme = body.theme || oralOpeningCacheService.DEFAULT_CRON_THEME;
    const task = taskQueue.createTask(
      'oral_opening_backfill',
      `口语开场后台生成 · ${sceneId}`,
    );
    taskQueue.updateTask(task.id, {
      status: 'running',
      progress: 5,
      logs: ['后台生成中，请稍后在任务中心查看'],
    });
    res.json({ success: true, taskId: task.id, status: task.status });

    oralOpeningCacheService.runBackfill(db, {
      userId,
      sceneId,
      theme,
      packDate: body.packDate,
      force: true,
    }).then((result) => {
      taskQueue.updateTask(task.id, {
        status: 'completed',
        progress: 100,
        logs: ['口语开场已写入当日缓存，可刷新场景查看'],
        result: {
          sceneId: result.opening?.sceneId || sceneId,
          packDate: result.opening?.packDate,
          ready: Boolean(result.opening),
        },
      });
    }).catch((e) => {
      taskQueue.updateTask(task.id, {
        status: 'failed',
        error: e.message,
        logs: [e.message],
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/english/oral/opening/cron-run', async (req, res) => {
  try {
    const secret = process.env.DAILY_PACK_CRON_SECRET || '';
    if (secret && req.headers['x-cron-secret'] !== secret) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }
    const result = await oralOpeningCacheService.runDailyOralOpeningCronJob(db, {
      userId: req.body?.userId,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[OralOpening Cron Manual]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 多角色沙盘：破绽识别判定（走 English_Oral_Sandbox Chatflow）
// API Key: DIFY_ORAL_API_KEY / VITE_DIFY_ORAL_API_KEY（与口语沙盘主对话相同）
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
    return res.status(400).json({ correct: false, feedback: '缺少划词内容或破绽类型。' });
  }

  const typeLabels = {
    logic: '逻辑破绽',
    fact: '事实矛盾',
    intent: '意图避重',
  };

  const apiKey = process.env.DIFY_ORAL_API_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL
    || process.env.VITE_DIFY_API_BASE_URL
    || 'https://dify.234124123.xyz/v1';

  const query = `[系统指令：破绽识别判定 — 仅输出 JSON，不要 Markdown]
场景：${sceneTitle || '多角色沙盘'}
消息ID：${messageId || 'unknown'}
用户划词：${String(selectedText).slice(0, 500)}
用户标记类型：${typeLabels[type] || type}
AI 埋设破绽（flaw_point）：${String(flawPoint).slice(0, 800)}

判定规则：
1. 用户划词是否覆盖或指向 flaw_point 中的关键矛盾片段；
2. 用户选择的破绽类型（logic/fact/intent）是否与 flaw_point 描述的谬误类型一致。

只输出一行合法 JSON：{"correct":true或false,"feedback":"不超过80字的中文说明"}`;

  try {
    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: injectOralSystemTime({
          scene_title: sceneTitle || '多角色沙盘',
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
        feedback: data.message || data.error || `Dify 判定失败 (${response.status})`,
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
        feedback: String(parsed.feedback || (parsed.correct ? '破绽标记正确。' : '破绽类型不匹配。')),
      });
    }

    // Dify 未返回 JSON 时做本地回退
    const flaw = String(flawPoint).toLowerCase();
    const selection = String(selectedText).toLowerCase();
    const typeKeywords = {
      logic: ['causal', 'fallacy', 'overgeneral', 'equivalence', 'logic', '因果', '以偏概全', '虚假'],
      fact: ['contradict', 'vague', 'data', 'fact', 'factual_vague', '矛盾', '模糊', '数据'],
      intent: ['evad', 'avoid', 'shift', 'intent', 'intent_evade', '避重', '推诿', '转移'],
    };
    const typeMatch = (typeKeywords[type] || []).some((kw) => flaw.includes(kw));
    const textOverlap = selection.length >= 3 && (
      flaw.includes(selection.slice(0, Math.min(20, selection.length)))
      || selection.split(/\s+/).some((w) => w.length > 4 && flaw.includes(w))
    );
    const correct = Boolean(flaw && flaw !== '未识别到破绽' && (typeMatch || textOverlap));

    return res.json({
      correct,
      feedback: correct
        ? '已识别破绽（本地回退判定），请用英语发起针对性提问。'
        : '标记与 AI 埋设破绽不匹配，请重新划词。',
    });
  } catch (err) {
    console.error('[breakthrough/submit] error:', err);
    return res.status(500).json({ correct: false, feedback: '破绽判定服务异常，请稍后重试。' });
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
    if (now - task.createdAt > 2 * 60 * 60 * 1000) { // 超过2小时清理
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
    const inUsers = userIds.map(() => '?').join(',');
    const comboArgs = [...userIds, today, genre, cefrLevel, duration, Number(duration)];
    const themedComboArgs = [...userIds, today, topic, genre, cefrLevel, duration, Number(duration)];

    // 查询只认：登录账号 + 题材 + 难度 + 时长 + 年月日。主题先精确，未命中再回退今日同组合。
    let row = null;
    let cacheSource = 'daily_extracted_articles';
    if (topic) {
      row = db.prepare(`
        SELECT * FROM daily_extracted_articles
        WHERE user_id IN (${inUsers})
          AND quota_date = ?
          AND theme = ?
          AND genre = ?
          AND cefr_level = ?
          AND (duration = ? OR duration = ?)
        ORDER BY created_at DESC LIMIT 1
      `).get(...themedComboArgs);
    }

    if (!row) {
      row = db.prepare(`
        SELECT * FROM daily_extracted_articles
        WHERE user_id IN (${inUsers})
          AND quota_date = ?
          AND genre = ?
          AND cefr_level = ?
          AND (duration = ? OR duration = ?)
        ORDER BY created_at DESC LIMIT 1
      `).get(...comboArgs);
    }

    if (!row && topic) {
      const listenRow = db.prepare(`
        SELECT * FROM daily_listen_articles
        WHERE user_id IN (${inUsers})
          AND pack_date = ?
          AND theme = ?
          AND genre = ?
          AND cefr_level = ?
          AND (duration = ? OR duration = ?)
          AND status = 'ready'
        ORDER BY created_at DESC LIMIT 1
      `).get(...themedComboArgs);
      if (listenRow?.body_text) {
        row = {
          id: listenRow.id,
          user_id: listenRow.user_id,
          quota_date: listenRow.pack_date,
          theme: listenRow.theme,
          genre: listenRow.genre,
          cefr_level: listenRow.cefr_level,
          article: listenRow.body_text,
          words_json: listenRow.vocab_json,
          phrases_json: listenRow.phrases_json,
          sentences_json: '[]',
          duration: listenRow.duration,
          input_signature: listenRow.input_signature,
          updated_at: listenRow.updated_at,
        };
        cacheSource = 'daily_listen_articles';
      }
    }

    if (!row) {
      const listenRow = db.prepare(`
        SELECT * FROM daily_listen_articles
        WHERE user_id IN (${inUsers})
          AND pack_date = ?
          AND genre = ?
          AND cefr_level = ?
          AND (duration = ? OR duration = ?)
          AND status = 'ready'
        ORDER BY created_at DESC LIMIT 1
      `).get(...comboArgs);
      if (listenRow?.body_text) {
        row = {
          id: listenRow.id,
          user_id: listenRow.user_id,
          quota_date: listenRow.pack_date,
          theme: listenRow.theme,
          genre: listenRow.genre,
          cefr_level: listenRow.cefr_level,
          article: listenRow.body_text,
          words_json: listenRow.vocab_json,
          phrases_json: listenRow.phrases_json,
          sentences_json: '[]',
          duration: listenRow.duration,
          input_signature: listenRow.input_signature,
          updated_at: listenRow.updated_at,
        };
        cacheSource = 'daily_listen_articles';
      }
    }

    if (!row) {
      return res.json({ success: true, found: false });
    }

    const audioTheme = row.theme || topic;
    const audioRow = audioTheme
      ? db.prepare(`
        SELECT * FROM daily_listen_audios
        WHERE user_id IN (${inUsers})
          AND pack_date = ?
          AND theme = ?
          AND genre = ?
          AND cefr_level = ?
          AND (duration = ? OR duration = ?)
          AND status = 'ready'
        ORDER BY created_at DESC LIMIT 1
      `).get(...userIds, today, audioTheme, genre, cefrLevel, duration, Number(duration))
      : db.prepare(`
        SELECT * FROM daily_listen_audios
        WHERE user_id IN (${inUsers})
          AND pack_date = ?
          AND genre = ?
          AND cefr_level = ?
          AND (duration = ? OR duration = ?)
          AND status = 'ready'
        ORDER BY created_at DESC LIMIT 1
      `).get(...comboArgs);

    const dataPayload = {
      id: row.id,
      userId: row.user_id,
      quotaDate: row.quota_date,
      theme: row.theme,
      genre: row.genre,
      cefrLevel: row.cefr_level,
      article: row.article,
      words: JSON.parse(row.words_json || '[]'),
      phrases: JSON.parse(row.phrases_json || '[]'),
      sentences: JSON.parse(row.sentences_json || '[]'),
      duration: String(row.duration),
      inputSignature: row.input_signature,
      updatedAt: row.updated_at,
      cacheSource,
      audioUrl: audioRow?.audio_url || null,
      audioPath: audioRow?.audio_path || null,
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

// 前台发起 daily-extract 生成请求，创建 taskId 后异步后台运行
app.post('/api/english/daily-extract', async (req, res) => {
  const { topic, materialText, userId = 'default-user', cefrLevel = 'B1', genre = 'meeting', duration = '25', user_current_profile } = req.body;
  const bizPackDate = String(req.body?.businessPackDate || '').trim();
  const today = /^\d{4}-\d{2}-\d{2}$/.test(bizPackDate)
    ? bizPackDate
    : dailyPackService.getPackDate();

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

    // SPEC: quota gate removed for generate
    // 提取结果只写 daily_extracted_articles 缓存，不再因入库配额耗尽拒绝长文生成

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

    // Step 3: 登记 taskQueue（任务中心）+ extractionTasks（status 轮询），共用同一 taskId
    const taskQueue = require('./services/taskQueue');
    const topicLabel = String(topic || materialText || '长文').slice(0, 40);
    const genreLabels = {
      meeting: '高管会议',
      email: '商务邮件',
      report: '行业研报',
      negotiation: '谈判拉扯',
      presentation: '路演汇报',
      reading: '沉浸阅读',
      news: '财经新闻',
    };
    const genreLabel = genreLabels[genre] || genre;
    const generationConditions = {
      topic: String(topic || materialText || '长文'),
      genre: String(genre),
      genreLabel,
      cefrLevel: String(cefrLevel),
      duration: String(duration),
    };
    const tq = taskQueue.createTask(
      'daily_extract',
      `长文生成｜${genreLabel}｜${cefrLevel}｜${duration}分钟`
    );
    const taskId = tq.id;
    taskQueue.updateTask(taskId, { generationConditions });
    extractionTasks.set(taskId, {
      status: 'pending',
      createdAt: Date.now()
    });
    taskQueue.updateTask(taskId, {
      status: 'running',
      progress: 5,
      logs: ['已受理，正在生成长文并提纯词表（仅写展示缓存，不写入生词本）…'],
    });

    res.json({
      success: true,
      taskId,
      message: 'Extraction task started asynchronously.'
    });

    // ??????????????
    runDailyExtractAsync(taskId, req.body, wordsLeft, phrasesLeft, quotaRow, today).catch(e => {
      console.error('[Daily Extract Async] Unhandled error:', e);
      const errMsg = e.message || 'Unknown error occurred in background task.';
      extractionTasks.set(taskId, { status: 'failed', error: errMsg, createdAt: Date.now() });
      try {
        require('./services/taskQueue').updateTask(taskId, { status: 'failed', error: errMsg, progress: 100 });
      } catch (_) {}
    });

  } catch (error) {
    console.error('[Daily Extract] Initial Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// ????????????????
async function runDailyExtractAsync(taskId, requestBody, wordsLeft, phrasesLeft, quotaRow, todayArg) {
  const { topic, materialText, userId = 'default-user', cefrLevel = 'B1', genre = 'meeting', duration = '25', user_current_profile, _system_time, _system_timestamp_ms } = requestBody;
  const bizPackDate = String(requestBody?.businessPackDate || '').trim();
  const today = /^\d{4}-\d{2}-\d{2}$/.test(bizPackDate)
    ? bizPackDate
    : dailyPackService.getPackDate();
  const taskQueue = require('./services/taskQueue');
  const syncFail = (error) => {
    const msg = String(error || 'Unknown error');
    extractionTasks.set(taskId, { status: 'failed', error: msg, createdAt: Date.now() });
    taskQueue.updateTask(taskId, { status: 'failed', error: msg, progress: 100 });
  };

  try {
    taskQueue.updateTask(taskId, {
      status: 'running',
      progress: 15,
      logs: ['开始调用模型生成长文…'],
    });

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
      console.warn('[Daily Extract] 构建去重上下文失败:', e.message);
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
        if (ef.pronunciationNotes) flaws.push(`发音问题: ${ef.pronunciationNotes}`);
        if (ef.grammarNotes) flaws.push(`语法问题: ${ef.grammarNotes}`);
        userFlaws = flaws.join('; ');
      }
    } catch (e) {
      console.warn('[Daily Extract] 构建薄弱点上下文失败:', e.message);
    }

    const difyApiKey = process.env.DIFY_ENGLISH_MASTERY_KEY;
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    const requestInputs = injectOralSystemTime({
      theme: topic || "General Business",
      cefr_level: cefrLevel,
      genre,
      duration: String(duration),
      history_exclude: historyExclude,
      user_flaws: userFlaws,
      user_current_profile: resolveProfileForDify(userId, user_current_profile),
      _system_time,
      _system_timestamp_ms,
    });
    const configuredAttempts = Number(process.env.DIFY_LONG_ARTICLE_MAX_ATTEMPTS || 2);
    const maxAttempts = Number.isInteger(configuredAttempts)
      ? Math.min(3, Math.max(1, configuredAttempts))
      : 2;
    let answer = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const fetchController = new AbortController();
      const fetchTimeout = setTimeout(() => fetchController.abort(), 10 * 60 * 1000);
      try {
        const wfResponse = await fetch(`${baseUrl}/chat-messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${difyApiKey}`,
            'Content-Type': 'application/json',
          },
          signal: fetchController.signal,
          body: JSON.stringify({
            inputs: requestInputs,
            query: 'generate',
            response_mode: 'streaming',
            user: userId,
          }),
        });
        clearTimeout(fetchTimeout);

        if (!wfResponse.ok) {
          const errText = await wfResponse.text().catch(() => '');
          const formatted = formatDifyModelError(errText || `HTTP ${wfResponse.status}`);
          const error = new Error(formatted);
          error.retryable = [408, 429, 502, 503, 504].includes(wfResponse.status);
          throw error;
        }
        answer = await collectDifyStreamingAnswer(wfResponse, { sanitize: false });
        break;
      } catch (error) {
        clearTimeout(fetchTimeout);
        const message = String(error?.message || error);
        const retryable = error?.retryable === true
          || /terminated|UND_ERR_BODY_TIMEOUT|Body Timeout|stream idle timeout|fetch failed|ECONNRESET|ETIMEDOUT/i.test(message);
        if (!retryable || attempt === maxAttempts) {
          console.error('[Daily Extract] Dify 生成失败:', error);
          syncFail(`Dify 服务请求失败: ${message}`);
          return;
        }
        console.warn(`[Daily Extract] Dify 流中断，重试 ${attempt}/${maxAttempts}: ${message}`);
        taskQueue.updateTask(taskId, {
          status: 'running',
          progress: 15,
          logs: [`Dify 数据流中断，正在重试（${attempt}/${maxAttempts}）…`],
        });
      }
    }

    // 正文与词表分离：先剥 <think>，思考链不得进入长文缓存
    const cleanedAnswer = stripThinkTags(answer || '');
    const articleText = prepareLongArticleBody(answer || '');

    if (!articleText.trim() || !isUsableLongArticle(answer || '')) {
      syncFail('长文仅含思考链或无合格正文，未写入缓存');
      return;
    }

    const parsedFromRaw = dailyListenPreGenerateService.parseVocabFromRaw(cleanedAnswer);
    let parsedVocab = Array.isArray(parsedFromRaw.vocab) ? [...parsedFromRaw.vocab] : [];
    let parsedPhrases = Array.isArray(parsedFromRaw.phrases) ? parsedFromRaw.phrases : [];
    if (Array.isArray(parsedFromRaw.sentences) && parsedFromRaw.sentences.length > 0) {
      parsedVocab.push(...parsedFromRaw.sentences.map(s => {
        if (typeof s === 'string') return { word: s, is_sentence: true };
        if (typeof s === 'object' && s !== null) {
          const cloned = { ...s };
          if (cloned.sentence && !cloned.word) cloned.word = cloned.sentence;
          return { ...cloned, is_sentence: true };
        }
        return s;
      }));
    }

    // dify=主流程解析成功；fallback=主流程空词后本地 LLM 兜底；empty=两者皆空
    let vocabSource = (parsedVocab.length > 0 || parsedPhrases.length > 0) ? 'dify' : 'empty';

    if (vocabSource === 'empty' && articleText.trim()) {
      console.log(`[Daily Extract] Dify vocab list is empty, calling local fallback LLM for user=${userId} topic=${topic}...`);
      try {
        const fallbackRes = await extractVocabFallback(articleText, cefrLevel, genre, duration, topic);
        if (fallbackRes.vocab.length > 0 || fallbackRes.phrases.length > 0 || (fallbackRes.sentences && fallbackRes.sentences.length > 0)) {
          parsedVocab = fallbackRes.vocab;
          parsedPhrases = fallbackRes.phrases;
          if (fallbackRes.sentences && fallbackRes.sentences.length > 0) {
            parsedVocab.push(...fallbackRes.sentences.map(s => {
              if (typeof s === 'string') return { word: s, is_sentence: true };
              if (typeof s === 'object' && s !== null) {
                if (s.sentence && !s.word) s.word = s.sentence;
                return { ...s, is_sentence: true };
              }
              return s;
            }));
          }
          vocabSource = 'fallback';
          console.log(`[Daily Extract] Fallback vocab ok: words=${fallbackRes.vocab.length} phrases=${fallbackRes.phrases.length} sentences=${(fallbackRes.sentences || []).length}`);
        } else {
          console.warn(`[Daily Extract] Fallback returned empty vocab for user=${userId} topic=${topic}`);
        }
      } catch (err) {
        console.error("[Daily Extract] Fallback vocab extraction failed:", err.message);
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
      const isSentenceHeuristic = w.length > 30 && (/[.!?。！？]$/.test(w) || w.split(' ').length >= 5);

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
           const isSentenceHeuristic = cleanText.length > 30 && (/[.!?。！？]$/.test(cleanText) || cleanText.split(' ').length >= 5);
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

    // 展示用完整词表（不受今日入库配额截断，避免「有长文但页面词表全空」）
    const displayWords = [...new Set(
      vocabList.filter(v => !v.is_sentence).map(v => (v.word || '').trim()).filter(Boolean)
    )];
    const displayPhrases = uniquePhraseList;
    const displaySentences = uniqueSentenceList;
    if (displayWords.length === 0 && displayPhrases.length === 0 && displaySentences.length === 0) {
      vocabSource = 'empty';
    }

    // 提取结果仅缓存展示，不自动写入生词本（手动 collect 路径不变）
    const wordsAddedCount = 0;
    const phrasesAddedCount = 0;
    const sentencesAddedCount = 0;
    const now = Date.now();

    const updatedWordsUsed = quotaRow.words_added || 0;
    const updatedPhrasesUsed = quotaRow.phrases_added || 0;

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
        JSON.stringify(displayWords)
      );
    } catch (e) {
      console.warn('[Daily Extract] 构建去重上下文失败:', e.message);
    }

    console.log(`[Daily Extract Async] Completed ${taskId}. User ${userId} ${today} cached for display (no vocab book auto-insert).`);

    const finalPayload = {
      message: 'Extraction complete: cached for display (no vocab book auto-insert).',
      quota: {
        wordsLimit: WORD_DAILY_LIMIT,
        wordsUsed: updatedWordsUsed,
        wordsLeft: Math.max(0, WORD_DAILY_LIMIT - updatedWordsUsed),
        phrasesLimit: PHRASE_DAILY_LIMIT,
        phrasesUsed: updatedPhrasesUsed,
        phrasesLeft: Math.max(0, PHRASE_DAILY_LIMIT - updatedPhrasesUsed),
      },
      words: displayWords,
      phrases: displayPhrases,
      sentences: displaySentences,
      article: articleText,
      wordCount: displayWords.length,
      phraseCount: displayPhrases.length,
      sentenceCount: displaySentences.length,
      wordsAddedCount,
      phrasesAddedCount,
      sentencesAddedCount,
      vocabSource,
    };

    // 保存至 daily_extracted_articles 物理持久库
    try {
      taskQueue.updateTask(taskId, {
        status: 'running',
        progress: 85,
        logs: ['正在写入展示缓存 daily_extracted_articles…'],
      });
      const artId = crypto.randomUUID();
      const durationVal = requestBody?.duration ? String(requestBody.duration) : (duration ? String(duration) : '25');
      const profileForSig = resolveProfileForDify(userId, user_current_profile);
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
        JSON.stringify(displayWords),
        JSON.stringify(displayPhrases),
        JSON.stringify(displaySentences),
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
        extracted_words_json: JSON.stringify(displayWords),
        extracted_phrases_json: JSON.stringify(displayPhrases),
      };

      // 即时联动：前台手动生成时同步精听音频；Cron/重跑路径禁用（Listen 模块为唯一 owner）
      if (!requestBody?.skipListenAudioSync) {
        (async () => {
          try {
            await dailyListenPreGenerateService.syncAudioFromLongArticleRow(db, savedArtRow, 'manual');
          } catch (syncAudioErr) {
            console.warn('[Daily Extract] 即时同步精听音频警告:', syncAudioErr.message);
          }
        })().catch(e => console.error('[Daily Extract] 精听音频同步异常:', e));
      }

    } catch (dbSaveErr) {
      console.warn('[Daily Extract] 保存 daily_extracted_articles 失败 (非阻塞):', dbSaveErr.message);
    }

    extractionTasks.set(taskId, {
      status: 'completed',
      payload: finalPayload,
      createdAt: Date.now()
    });
    taskQueue.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      logs: ['长文生成与提纯完成（仅写展示缓存，不写入生词本）'],
      result: {
        article: finalPayload.article,
        words: finalPayload.words,
        phrases: finalPayload.phrases,
        sentences: finalPayload.sentences,
        wordCount: finalPayload.wordCount,
        phraseCount: finalPayload.phraseCount,
        sentenceCount: finalPayload.sentenceCount,
        vocabSource: finalPayload.vocabSource,
      },
    });

  } catch (error) {
    console.error('[Daily Extract Async] Global Error:', error);
    syncFail(error.message || 'Unknown error');
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

app.get('/api/user/theme', (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const row = dailyPackService.getOrCreateUserTheme(db, userId);
    res.json({ success: true, ...row });
  } catch (error) {
    console.error('[User Theme Read]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/verify-invite', (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    if (!userId) {
      return res.json({ success: false, error: '该账号未被邀请' });
    }
    const row = db.prepare('SELECT user_id FROM invited_accounts WHERE user_id = ?').get(userId);
    // 不区分“从未邀请”与“已撤销”，也不回传名单，避免被枚举
    if (!row) {
      return res.json({ success: false, error: '该账号未被邀请' });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('[Auth VerifyInvite]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/user/login-ping', (req, res) => {
  try {
    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    // 登录只记 login log，不改写 user_theme_prefs
    const result = dailyListenPreGenerateService.recordUserLogin(db, userId);

    // N1: 登录不再触发异步补跑；缺包由手动生成或 02:00 cron 负责
    res.json({ success: true, catchupScheduled: false, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/system/date', (req, res) => {
  try {
    const shanghaiDate = dailyPackService.getPackDate();
    res.json({ success: true, date: shanghaiDate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const handleGetTodayDailyPack = (req, res) => {
  try {
    const rawUserId = req.body?.userId || req.query.userId || 'default-user';
    const currentTheme = dailyPackService.getOrCreateUserTheme(db, rawUserId).theme;

    // 兼顾账号别名
    const userIds = [rawUserId];

    const packDate = dailyPackService.getPackDate();
    let row = null;

    for (const u of userIds) {
      row = dailyPackService.getTodayPackForCurrentTheme(db, u, packDate, currentTheme);
      if (row) break;
    }

    if (row && row.status === 'ready') {
      console.log(`[每日唤醒] 成功命中学员专属晨间预生成训练包 (用户: ${rawUserId}, 主题: ${currentTheme})`);
    } else {
      console.log(`[每日唤醒] 今日训练包当前状态为 ${row ? row.status : '未生成'} (用户: ${rawUserId})`);
    }

    // 仅返回当前用户（含别名）缓存；不再回退 default-user
    res.json(dailyPackService.serializeDailyPack(row, currentTheme));
  } catch (error) {
    console.warn('[每日唤醒] 读取今日训练包发生异常:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

app.get('/api/daily-pack/today', handleGetTodayDailyPack);
app.post('/api/daily-pack/today', handleGetTodayDailyPack);

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
    const pref = dailyPackService.getOrCreateUserTheme(db, uid);
    const resolvedTheme = String(pref.theme || '').trim();
    if (!resolvedTheme) {
      return res.status(400).json({ success: false, error: '请先选择并同步学习主题' });
    }

    const resolvedHistoryExclude = String(historyExclude || dailyPackService.getHistoryExclude(db, uid) || '').trim();
    const resolvedUserCurrentProfile = String(
      resolveProfileForDify(uid, userCurrentProfile)
    ).trim();
    const inputSignature = dailyPackService.computeInputSignature(
      resolvedTheme,
      resolvedHistoryExclude,
      resolvedUserCurrentProfile,
    );

    const existing = dailyPackService.getDailyPackRow(db, uid, packDate, inputSignature, resolvedTheme);
    const existingWakeup = existing?.wakeup_json ? JSON.parse(existing.wakeup_json) : null;
    const existingFlaw = existing?.flaw_vocab_json ? JSON.parse(existing.flaw_vocab_json) : null;

    const taskQueue = require('./services/taskQueue');
    const typeLabel = type === 'flaw' ? '每日破绽词汇' : type === 'wakeup' ? '每日唤醒' : '今日训练包';
    const tq = taskQueue.createTask('daily_pack', `${typeLabel}｜${resolvedTheme}`);
    const taskId = tq.id;
    taskQueue.updateTask(taskId, {
      status: 'running',
      progress: 10,
      logs: ['已受理，正在后台生成今日包'],
    });

    // 立刻落 generating 并返回，Dify 在后台跑，避免长连接占满浏览器/Nginx
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
    res.json({ ...dailyPackService.serializeDailyPack(pending, resolvedTheme), taskId });

    const finishTask = (ok, errMsg) => {
      if (ok) {
        taskQueue.updateTask(taskId, {
          status: 'completed',
          progress: 100,
          logs: ['今日包已写入缓存，可刷新查看'],
        });
      } else {
        taskQueue.updateTask(taskId, {
          status: 'failed',
          progress: 100,
          error: errMsg || '生成失败',
          logs: [`生成失败: ${errMsg || '未知错误'}`],
        });
      }
    };

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
            finishTask(true);
            return;
          }
          if (type === 'wakeup') {
            const wakeup = await dailyPackService.generateWakeupVocabForUser(db, uid, {
              theme: resolvedTheme,
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
            finishTask(true);
            return;
          }

          const wakeup = await dailyPackService.generateWakeupVocabForUser(db, uid, {
            theme: resolvedTheme,
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
          finishTask(true);
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
            errorMessage: dailyPackService.formatWakeupDifyFetchError(err) || err.message || String(err),
          });
          finishTask(false, dailyPackService.formatWakeupDifyFetchError(err) || err.message || String(err));
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

// ==========================================
// 每日 Cron 运行日志（独立于 taskQueue）
// ==========================================
app.get('/api/daily-cron/runs', (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const days = Number(req.query.days || 7);
    const runs = dailyCronRunService.listRunsForUser(db, userId, { days });
    const hiddenCount = dailyCronRunService.countHiddenRunsForUser(db, userId, { days });
    const items = runs.map((run) => {
      const steps = db.prepare(
        'SELECT * FROM daily_cron_steps WHERE run_id = ?',
      ).all(run.id);
      return dailyCronRunService.serializeRunSummary(run, steps);
    });
    res.json({ success: true, runs: items, hiddenCount });
  } catch (error) {
    console.error('[DailyCron runs]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/daily-cron/runs/:runId', (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const detail = dailyCronRunService.getRunDetailForUser(db, req.params.runId, userId);
    if (!detail.ok) {
      return res.status(404).json({ success: false, error: 'not found' });
    }
    const steps = detail.steps.map((s) => ({
      id: s.id,
      module: s.module,
      comboKey: s.combo_key,
      status: s.status,
      progress: s.progress,
      error: s.error_message,
      inputs: dailyCronRunService.parseJsonSafe(s.inputs_json),
      inputSources: dailyCronRunService.parseJsonSafe(s.input_sources_json),
      resultSummary: dailyCronRunService.parseJsonSafe(s.result_summary_json),
      startedAt: s.started_at,
      finishedAt: s.finished_at,
    }));
    const events = detail.events.map((e) => ({
      id: e.id,
      stepId: e.step_id,
      level: e.level,
      message: e.message,
      context: dailyCronRunService.parseJsonSafe(e.context_json),
      createdAt: e.created_at,
    }));
    res.json({
      success: true,
      run: dailyCronRunService.serializeRunSummary(detail.run, detail.steps),
      steps,
      events,
    });
  } catch (error) {
    console.error('[DailyCron run detail]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/daily-cron/runs/:runId/rerun', async (req, res) => {
  const userId = req.body?.userId || 'default-user';
  const mode = req.body?.mode || 'all_current';
  const comboKey = req.body?.comboKey || null;
  const stepId = req.body?.stepId || null;
  let lockKey = null;
  try {
    const ownership = dailyCronRunService.assertRunOwner(db, req.params.runId, userId);
    if (!ownership.ok) {
      return res.status(404).json({ success: false, error: 'not found' });
    }
    if (mode !== 'all_current' && mode !== 'failed_snapshot') {
      return res.status(400).json({ success: false, error: 'invalid mode' });
    }

    const lock = dailyCronRunService.acquireRerunLock(userId, req.params.runId, mode);
    if (!lock.ok) {
      return res.status(409).json({ success: false, error: 'rerun already in progress' });
    }
    lockKey = lock.key;

    const parent = ownership.run;
    const parentSteps = db.prepare(
      'SELECT * FROM daily_cron_steps WHERE run_id = ?',
    ).all(parent.id);

    if (mode === 'failed_snapshot') {
      let failed = parentSteps.filter((s) => s.status === 'failed');
      if (stepId) failed = failed.filter((s) => s.id === stepId);
      if (comboKey) failed = failed.filter((s) => s.combo_key === comboKey);
      if (failed.length === 0) {
        dailyCronRunService.releaseRerunLock(lockKey);
        return res.status(400).json({ success: false, error: 'no failed steps to rerun' });
      }
    }

    const tick = dailyCronRunService.createCronTickId();
    const newRun = dailyCronRunService.createPerUserRun(db, {
      cronTickId: tick,
      userId,
      packDate: dailyCronRunService.getPackDate(),
      triggerSource: 'user_rerun',
      parentRunId: parent.id,
    });

    res.json({
      success: true,
      runId: newRun.id,
      parentRunId: parent.id,
      mode,
    });

    setImmediate(() => {
      (async () => {
        try {
          const themeRow = db.prepare(
            'SELECT theme FROM user_theme_prefs WHERE user_id = ?',
          ).get(dailyCronRunService.normalizeUserId(userId));
          const theme = themeRow?.theme || '商务谈判：让步与施压';

          if (mode === 'all_current') {
            // 仅当前用户四模块；重新解析入参 — 禁止调用全局 multi-user cron
            dailyCronRunService.upsertStep(db, {
              runId: newRun.id, userId, module: 'wakeup', status: 'running',
            });
            dailyCronRunService.upsertStep(db, {
              runId: newRun.id, userId, module: 'flaw', status: 'running',
            });
            try {
              await dailyPackService.generateDailyPackForUser(db, userId, theme, 'user_rerun');
              for (const mod of ['wakeup', 'flaw']) {
                dailyCronRunService.upsertStep(db, {
                  runId: newRun.id, userId, module: mod, status: 'completed', progress: 100, finishedAt: Date.now(),
                });
              }
            } catch (e) {
              for (const mod of ['wakeup', 'flaw']) {
                dailyCronRunService.upsertStep(db, {
                  runId: newRun.id, userId, module: mod, status: 'failed', progress: 100,
                  finishedAt: Date.now(), errorMessage: e.message,
                });
              }
            }

            for (const genre of dailyCronRunService.LONG_GENRES) {
              for (const cefr of dailyCronRunService.LONG_CEFR) {
                for (const duration of dailyCronRunService.LONG_DURATIONS) {
                  const ck = `${genre}|${cefr}|${duration}`;
                  dailyCronRunService.upsertStep(db, {
                    runId: newRun.id, userId, module: 'long_article', comboKey: ck, status: 'running',
                  });
                  try {
                    const result = await dailyPackService.generateLongArticleForUser(
                      db, userId, theme, 'user_rerun', genre, cefr, String(duration),
                    );
                    dailyCronRunService.upsertStep(db, {
                      runId: newRun.id, userId, module: 'long_article', comboKey: ck,
                      status: result?.status === 'skipped' ? 'skipped' : 'completed',
                      progress: 100, finishedAt: Date.now(), resultSummary: result,
                    });
                  } catch (e) {
                    dailyCronRunService.upsertStep(db, {
                      runId: newRun.id, userId, module: 'long_article', comboKey: ck,
                      status: 'failed', progress: 100, finishedAt: Date.now(), errorMessage: e.message,
                    });
                  }
                }
              }
            }

            dailyCronRunService.upsertStep(db, {
              runId: newRun.id, userId, module: 'listen', status: 'running',
            });
            try {
              const listenJob = await dailyListenPreGenerateService.runDailyListenCronJob(db, {
                cronTickId: tick,
              });
              const listenStep = dailyCronRunService.findStep(db, {
                runId: newRun.id, module: 'listen',
              });
              const listenStatus = dailyCronRunService.resolveListenTerminalStatus({
                combosFail: listenJob?.summary?.combosFail,
                existingStatus: listenStep?.status,
              });
              dailyCronRunService.upsertStep(db, {
                runId: newRun.id, userId, module: 'listen',
                status: listenStatus,
                progress: 100,
                finishedAt: Date.now(),
                errorMessage: listenStatus === 'failed'
                  ? (listenStep?.error_message || `combosFail=${listenJob?.summary?.combosFail || 0}`)
                  : null,
              });
            } catch (e) {
              dailyCronRunService.upsertStep(db, {
                runId: newRun.id, userId, module: 'listen', status: 'failed',
                progress: 100, finishedAt: Date.now(), errorMessage: e.message,
              });
            }
          } else {
            // failed_snapshot: reuse inputs_json; do not call resolvers for theme/history/profile
            let failed = parentSteps.filter((s) => s.status === 'failed');
            if (stepId) failed = failed.filter((s) => s.id === stepId);
            if (comboKey) failed = failed.filter((s) => s.combo_key === comboKey);

            for (const fs of failed) {
              const snap = dailyCronRunService.parseJsonSafe(fs.inputs_json, {}) || {};
              const sources = dailyCronRunService.parseJsonSafe(fs.input_sources_json, null);
              dailyCronRunService.upsertStep(db, {
                runId: newRun.id,
                userId,
                module: fs.module,
                comboKey: fs.combo_key,
                status: 'running',
                inputs: snap,
                inputSources: sources,
              });
              try {
                if (fs.module === 'wakeup' || fs.module === 'flaw') {
                  // 失败步骤重跑：唤醒也走与手动刷新同一套去重/写历史逻辑
                  if (fs.module === 'wakeup' && snap.theme != null) {
                    const wakeup = await dailyPackService.generateWakeupVocabForUser(db, userId, {
                      theme: snap.theme,
                      historyExclude: snap.history_exclude || '',
                      userCurrentProfile: snap.user_current_profile || '',
                    });
                    const packDate = dailyPackService.getPackDate();
                    const hist = String(snap.history_exclude || '');
                    const profile = String(snap.user_current_profile || '');
                    const inputSignature = dailyPackService.computeInputSignature(snap.theme, hist, profile);
                    const existing = dailyPackService.getDailyPackRow(db, userId, packDate, inputSignature, snap.theme);
                    const existingFlaw = existing?.flaw_vocab_json ? JSON.parse(existing.flaw_vocab_json) : null;
                    dailyPackService.upsertDailyPack(db, {
                      userId,
                      packDate,
                      theme: snap.theme,
                      inputSignature,
                      wakeup,
                      flawVocab: existingFlaw,
                      source: 'user_rerun',
                      status: 'ready',
                      errorMessage: null,
                    });
                  } else if (fs.module === 'flaw') {
                    await dailyPackService.generateFlawVocabForUser(db, userId, snap.theme || theme);
                  } else {
                    await dailyPackService.generateDailyPackForUser(db, userId, snap.theme || theme, 'user_rerun');
                  }
                } else if (fs.module === 'long_article') {
                  const [g, c, d] = String(fs.combo_key || 'meeting|B1|25').split('|');
                  await dailyPackService.generateLongArticleForUser(
                    db, userId, snap.theme || theme, 'user_rerun', g, c, d,
                  );
                } else if (fs.module === 'listen') {
                  const listenJob = await dailyListenPreGenerateService.runDailyListenCronJob(db, {
                    cronTickId: tick,
                  });
                  const listenStep = dailyCronRunService.findStep(db, {
                    runId: newRun.id, module: 'listen', comboKey: fs.combo_key,
                  });
                  const listenStatus = dailyCronRunService.resolveListenTerminalStatus({
                    combosFail: listenJob?.summary?.combosFail,
                    existingStatus: listenStep?.status,
                  });
                  dailyCronRunService.upsertStep(db, {
                    runId: newRun.id, userId, module: fs.module, comboKey: fs.combo_key,
                    status: listenStatus, progress: 100, finishedAt: Date.now(),
                    inputs: snap, inputSources: sources,
                    errorMessage: listenStatus === 'failed'
                      ? (listenStep?.error_message || `combosFail=${listenJob?.summary?.combosFail || 0}`)
                      : null,
                  });
                }
                if (fs.module !== 'listen') {
                  dailyCronRunService.upsertStep(db, {
                    runId: newRun.id, userId, module: fs.module, comboKey: fs.combo_key,
                    status: 'completed', progress: 100, finishedAt: Date.now(),
                    inputs: snap, inputSources: sources,
                  });
                }
              } catch (e) {
                dailyCronRunService.upsertStep(db, {
                  runId: newRun.id, userId, module: fs.module, comboKey: fs.combo_key,
                  status: 'failed', progress: 100, finishedAt: Date.now(),
                  errorMessage: e.message, inputs: snap, inputSources: sources,
                });
              }
            }
          }
          dailyCronRunService.refreshRunAggregation(db, newRun.id);
        } catch (e) {
          console.error('[DailyCron rerun bg]', e);
          dailyCronRunService.markAuditDegraded(db, newRun.id, e.message);
          db.prepare(`
            UPDATE daily_cron_runs SET status='failed', execution_status='failed',
              error_message=?, finished_at=?, updated_at=? WHERE id=?
          `).run(String(e.message || e), Date.now(), Date.now(), newRun.id);
        } finally {
          dailyCronRunService.releaseRerunLock(lockKey);
        }
      })();
    });
  } catch (error) {
    if (lockKey) dailyCronRunService.releaseRerunLock(lockKey);
    console.error('[DailyCron rerun]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/daily-cron/runs/:runId', (req, res) => {
  try {
    const userId = req.query.userId || req.body?.userId || 'default-user';
    const result = dailyCronRunService.deleteRunForUser(db, req.params.runId, userId);
    if (!result.ok) {
      return res.status(result.code).json({
        success: false,
        error: result.code === 409 ? '进行中的任务不能删除' : 'not found',
      });
    }
    res.json({ success: true, deletedRuns: result.deletedRuns });
  } catch (error) {
    console.error('[DailyCron delete run]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/daily-cron/runs/clear-finished', (req, res) => {
  try {
    const userId = req.body?.userId || req.query.userId || 'default-user';
    const result = dailyCronRunService.clearFinishedRunsForUser(db, userId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[DailyCron clear finished]', error);
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
    result: { scene: "模拟测试局", content: "这是仿真系统返回的训练数据..." }
  });
});

// ==========================================
// ??????? API (Pronunciation Assessment)
// ????? Dify ????????????????????????// ==========================================
app.post('/api/pronunciation-assessment', async (req, res) => {
  const { targetText, recognizedText, user_current_profile, userId = 'default-user' } = req.body;

  if (!targetText) {
    return res.status(400).json({ success: false, error: '缺少目标文本 (targetText)' });
  }

  try {
    const difyApiKey = process.env.DIFY_PRONUNCIATION_API_KEY;
    if (!difyApiKey) {
      console.error('缺少 DIFY_PRONUNCIATION_API_KEY 环境变量');
      return res.status(500).json({ success: false, error: '服务端未配置发音纠正 API Key' });
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
          user_current_profile: resolveProfileForDify(userId, user_current_profile)
        }),
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Dify 发音纠正请求失败:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify 请求失败: ${response.status} - ${errText}` });
    }

    const data = await response.json();
    console.log('Dify 原始返回:', JSON.stringify(data, null, 2));

    // ???????????? - ??????????????????????? JSON
    const outputs = data?.data?.outputs ?? {};

    const score = typeof outputs.score === 'number' ? outputs.score : 0;
    const phonetic = typeof outputs.phonetic === 'string' ? outputs.phonetic : '';
    const issueType = typeof outputs.issue_type === 'string' ? outputs.issue_type : 'other';
    const analysis = typeof outputs.analysis === 'string' ? outputs.analysis : '评测完成';
    const suggestion = typeof outputs.suggestion === 'string' ? outputs.suggestion : '';

    res.json({
      success: true,
      score,
      phonetic,
      issueType,
      analysis,
      suggestion,
      correctionNote: `${analysis}銆?{suggestion}`,
      target_text: targetText,
      recognized_text: recognizedText || '',
    });
  } catch (err) {
    console.error('发音纠正 API 异常:', err);
    res.status(500).json({ success: false, error: '发音纠正服务异常' });
  }
});

// ==========================================
// ????????????? API (Grammar Polish)
// ????? Dify ?????????????????????
// ==========================================
app.post('/api/grammar-polish', async (req, res) => {
  const { originalText, user_current_profile, userId = 'default-user' } = req.body;

  if (!originalText) {
    return res.status(400).json({ success: false, error: '缺少原始文本 (originalText)' });
  }

  try {
    // ???????????????????????????????????????????????????????????????????(????????????Key ?????)
    const difyApiKey = process.env.DIFY_GRAMMAR_API_KEY;
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
          user_current_profile: resolveProfileForDify(userId, user_current_profile)
        }),
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Dify 发音纠正请求失败:', response.status, errText);
      let errorMsg = errText;
      try {
        const errObj = JSON.parse(errText);
        if (errObj.code === "not_chat_app") {
           errorMsg = "Dify 工作流配置错误: 请使用 workflow 模式的 API 路径 (/workflows/run)";
        }
      } catch(e) {}

      return res.status(response.status).json({ success: false, error: `Dify 请求失败: ${response.status} - ${errorMsg}` });
    }

    const data = await response.json();
    console.log('Dify 原始返回:', JSON.stringify(data, null, 2));

    // ?? Grammar_Polish_Engine.yml ??????????????????????????????????????polished_result
    const polishedText = data?.data?.outputs?.polished_result || '未获取到润色结果，请检查工作流配置。';

    res.json({
      success: true,
      polishedText
    });
  } catch (err) {
    console.error('发音纠正 API 异常:', err);
    res.status(500).json({ success: false, error: '发音纠正服务异常' });
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
    return res.status(400).json({ success: false, error: '未接收到有效文件数据' });
  }

  const normalizedSource = source_type === 'simulation' ? 'simulation' : 'case_analysis';
  const titleBase = String(title || '').trim() || (normalizedSource === 'simulation' ? '人机对战沙盘' : '博弈案例研判');
  const taskTitle = normalizedSource === 'simulation'
    ? `人机对战: ${titleBase.slice(0, 40)}`
    : `博弈研判: ${titleBase.slice(0, 40)}`;

  const taskQueue = require('./services/taskQueue');
  const {
    loadInjectedKnowledgeSafe,
    attachKnowledgeContext,
    appendKnowledgeTracesSafe,
  } = require('./services/gameTheoryKnowledge');
  const injected = loadInjectedKnowledgeSafe(db, userId, 'game_theory');
  const task = taskQueue.createTask('game_theory', taskTitle);
  taskQueue.updateTask(task.id, {
    status: 'running',
    progress: 10,
    logs: [injected.reminder, '任务已提交，请在任务中心查看进度'],
  });

  // 立即返回 taskId，后台异步执行（复用现有 TaskContext 轮询）
  res.json({
    success: true,
    taskId: task.id,
    status: task.status,
    knowledgeReminder: injected.reminder,
    knowledgeSynced: injected.syncedCount,
    knowledgeUsed: injected.usedCount,
  });

  (async () => {
    try {
      const difyApiKey = process.env.DIFY_GAME_THEORY_API_KEY || process.env.VITE_DIFY_GAME_THEORY_KEY;
      const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

      taskQueue.updateTask(task.id, { progress: 40, logs: ['正在连接博弈模型 (Dify)…'] });

      const isSimulation = normalizedSource === 'simulation';
      const promptInstruction = isSimulation
        ? '\n\n【系统研判指令：请针对玩家在人机对战沙盘中的当句应对（user_answer）进行深度博弈研判，注入逼真尖锐的职场权斗情感与洞察，严禁假大空公文套话（禁止使用“高度重视、统筹兼顾、战略定力、深刻理解”等词）。你必须输出严格 JSON，除原有字段外，强制包含以下字段：\n1. interest_chain（利益链）：必须讲清多方谁赢谁输、利益交换与同盟裂痕。\n2. emotion_motives（情绪动机）：必须包含面子/恐惧/欲望/羞辱/难堪/失控等具体情绪锚点，结合现场人设。\n3. strategy_guidance（博弈策略示例）：必须为字符串数组（≥2条），针对玩家当句应对给出具体「先...再...」下一步策略动作，必须引用或紧贴该句。\n4. tone_corrections（语气修正对比表）：必须为数组（≥1），元素包含 original（必须为玩家当句应对原话）、problem（指出其过硬/失控的具体风险）、suggested（直接可说出口的针对性改写台词，严禁使用泛化套话）。\n另：可提供 suggestion 作一句话汇总。】'
        : '\n\n【系统研判指令：请针对玩家的应对进行深度博弈研判，注入逼真尖锐的职场权斗情感与洞察，严禁假大空公文套话（禁止使用“高度重视、统筹兼顾、战略定力、深刻理解”等词）。你必须输出严格 JSON，除原有字段外，强制包含以下四个独立字段（中文详写，四节去空白合计≥600字）：\n1. interest_chain（利益链）：必须讲清多方谁赢谁输、利益交换与同盟裂痕。\n2. emotion_motives（情绪动机）：必须包含面子/恐惧/欲望/羞辱/难堪/失控等具体情绪锚点，结合现场人设。\n3. actionable_strategy（可执行策略）：1-2个可落地行动步骤，必须包含明确先后次序（先...再.../会前...）。\n4. script_examples（话术示例）：可直接说出口的具体台词原话（如「...」）或「原话→修正」对照。\n另须强制包含 tone_corrections 数组（≥1），元素为 { original, problem, suggested } 三字段，用于独立「语气修正」对比表；不得只把语气修正写进 suggestion。\n另：suggestion 可作一句话汇总。四节字段与 tone_corrections 均不可省略。】';

      const response = await fetch(`${baseUrl}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${difyApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: attachKnowledgeContext(injectOralSystemTime({
            scene_type,
            game_model,
            case_text: case_text + promptInstruction,
            user_answer,
            applied_tactics: applied_tactics || '',
            user_current_profile: resolveProfileForDify(userId, user_current_profile),
          }), injected.context),
          response_mode: 'blocking',
          user: userId,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Dify 博弈分析请求失败:', response.status, errText);
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: `Dify 请求失败: ${response.status} - ${errText}`,
        });
        return;
      }

      const data = await response.json();
      taskQueue.updateTask(task.id, { progress: 80, logs: ['正在解析研判结果…'] });

      const rawResult = data?.data?.outputs?.analysis_result ?? data?.data?.outputs?.result ?? data?.answer ?? data?.message ?? '';
      const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();

      let parsedResult;
      try {
        parsedResult = JSON.parse(cleanJson);
      } catch (e) {
        console.error('解析 Dify 返回的 JSON 失败:', e, rawResult);
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: '博弈研判结果格式异常，无法解析 JSON',
        });
        return;
      }

      if (isSimulation) {
        // GT-SIM-02: 人机对战沙盘新硬卡门禁（贴当句博弈策略示例 + 贴当句语气表 + 利益情绪密度）
        const { evaluateSimAdviceQuality } = require('./services/gtCaseQuality');
        const { normalizeToneCorrections } = require('./services/toneCorrections');
        const toneNorm = normalizeToneCorrections(parsedResult.tone_corrections, user_answer);
        parsedResult.tone_corrections = toneNorm.items;
        if (toneNorm.repaired) {
          parsedResult.tone_corrections_repaired = true;
        }

        if (!Array.isArray(parsedResult.strategy_guidance) && typeof parsedResult.strategy_guidance === 'string') {
          parsedResult.strategy_guidance = [parsedResult.strategy_guidance];
        }

        const simQuality = evaluateSimAdviceQuality({
          user_answer,
          strategy_guidance: parsedResult.strategy_guidance,
          tone_corrections: parsedResult.tone_corrections,
          interest_chain: parsedResult.interest_chain,
          emotion_motives: parsedResult.emotion_motives,
          actionable_strategy: parsedResult.actionable_strategy,
          script_examples: parsedResult.script_examples,
        });

        parsedResult.quality = simQuality.quality;
        if (simQuality.quality === 'below_standard') {
          const failReason = simQuality.quality_note || '沙盘博弈给策未贴合当句应对或存在泛化套话（GT-SIM-02）';
          console.warn(`[GameTheory Analyze Simulation] 任务 ${task.id} 研判未达标，拒绝入库: ${failReason}`);
          taskQueue.updateTask(task.id, {
            status: 'failed',
            error: `沙盘给策未达标（可重新提交）：${failReason}`,
            logs: [`沙盘质量检查未通过: ${failReason}`],
          });
          return;
        }
      } else {
        // GT-CASE-02: 案例研判维持全四节质量门禁
        const { ensureGameTheoryVerdictSections } = require('./services/gameTheoryVerdictGuard');
        const { normalizeToneCorrections } = require('./services/toneCorrections');
        parsedResult = ensureGameTheoryVerdictSections(parsedResult, titleBase);
        const toneNorm = normalizeToneCorrections(parsedResult.tone_corrections, user_answer);
        parsedResult.tone_corrections = toneNorm.items;
        if (toneNorm.repaired) {
          parsedResult.tone_corrections_repaired = true;
          const note = String(parsedResult.quality_note || '').trim();
          parsedResult.quality_note = note
            ? `${note}；语气修正经系统补全`
            : '语气修正经系统补全（GT-SIM-02）';
        }

        if (parsedResult.quality === 'below_standard') {
          const failReason = parsedResult.quality_note || '研判内容未达尖锐与逻辑情感质量门槛（GT-CASE-02）';
          console.warn(`[GameTheory Analyze Case] 任务 ${task.id} 研判未达标，拒绝入库: ${failReason}`);
          taskQueue.updateTask(task.id, {
            status: 'failed',
            error: `博弈研判未达标（可重新提交）：${failReason}`,
            logs: [`研判质量检查未通过: ${failReason}`],
          });
          return;
        }
      }

      const normalizedPrototype = normalizePrototypeArchive(parsedResult.prototype_archive);
      if (normalizedPrototype) {
        const protoName = normalizedPrototype.name;
        const protoType = normalizedPrototype.type;
        const protoDesc = normalizedPrototype.description;

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

      appendKnowledgeTracesSafe(db, userId, injected.ids, {
        module: 'game_theory',
        action: 'analyzed',
        taskId: task.id,
      });
      afterKnowledgeInjected(userId, injected.ids);

      taskQueue.updateTask(task.id, {
        status: 'completed',
        progress: 100,
        logs: ['已写入对局历史'],
        result: {
          historyId,
          sourceType: normalizedSource,
          name: taskTitle,
        },
      });
    } catch (err) {
      console.error('博弈引擎分析异常:', err);
      taskQueue.updateTask(task.id, {
        status: 'failed',
        error: '博弈分析引擎异常: ' + (err.message || String(err)),
      });
    }
  })();
});

// 对局历史列表
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
    console.error('获取对局历史失败:', err);
    res.status(500).json({ success: false, error: '对局历史查询失败' });
  }
});

// 对局历史详情（含完整结果）
app.get('/api/game-theory/history/:id', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT * FROM game_theory_history WHERE id = ?
    `).get(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: '历史记录不存在' });
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
    console.error('获取对局历史详情失败:', err);
    res.status(500).json({ success: false, error: '对局历史详情查询失败' });
  }
});

function sendGameTheorySessionError(res, err) {
  const status = err.statusCode || 500;
  const body = { success: false, error: err.message || '多人博弈会话失败' };
  if (err.payload) body.session = err.payload;
  return res.status(status).json(body);
}

function withResolvedGameTheoryProfile(body = {}) {
  const next = { ...(body || {}) };
  const uid = next.userId || next.user || 'default-user';
  next.user_current_profile = resolveProfileForDify(
    uid,
    next.user_current_profile,
    next.theme || next.scenario || next.title,
  );
  return next;
}

app.post('/api/game-theory/session/start', async (req, res) => {
  try {
    const session = await gameTheorySession.startSession(withResolvedGameTheoryProfile(req.body || {}));
    res.json({ success: true, session, session_id: session.session_id });
  } catch (err) {
    console.error('启动多人博弈会话失败:', err);
    sendGameTheorySessionError(res, err);
  }
});

app.get('/api/game-theory/sessions', (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const items = gameTheorySession.listSessions(userId);
    res.json({ success: true, items });
  } catch (err) {
    console.error('列出多人博弈会话失败:', err);
    sendGameTheorySessionError(res, err);
  }
});

app.get('/api/game-theory/session/:sessionId', (req, res) => {
  try {
    const userId = req.query.userId || req.body?.userId || 'default-user';
    const session = gameTheorySession.getSession(req.params.sessionId, userId);
    res.json({ success: true, session });
  } catch (err) {
    console.error('读取多人博弈会话失败:', err);
    sendGameTheorySessionError(res, err);
  }
});

app.post('/api/game-theory/session/:sessionId/roles', (req, res) => {
  try {
    const userId = req.body?.userId || 'default-user';
    const session = gameTheorySession.updateRoles(req.params.sessionId, userId, req.body?.roles);
    res.json({ success: true, session });
  } catch (err) {
    console.error('更新博弈会话角色失败:', err);
    sendGameTheorySessionError(res, err);
  }
});

app.post('/api/game-theory/session/:sessionId/control', (req, res) => {
  try {
    const userId = req.body?.userId || 'default-user';
    const session = gameTheorySession.controlSession(
      req.params.sessionId,
      userId,
      req.body?.action,
      req.body?.reason
    );
    res.json({ success: true, session });
  } catch (err) {
    console.error('控制多人博弈会话失败:', err);
    sendGameTheorySessionError(res, err);
  }
});

app.post('/api/game-theory/session/:sessionId/round', async (req, res) => {
  const sessionId = req.params.sessionId;
  const userId = req.body?.userId || 'default-user';
  const isStream = Boolean(req.body?.stream === true || req.body?.stream === 'true');

  console.log(`[博弈推演] 正在启动博弈沙盘对抗推演 (会话ID: ${sessionId}, 通道: ${isStream ? '实时流式' : '标准报文'})...`);

  try {
    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const result = await gameTheorySession.submitRound(sessionId, userId, {
        ...withResolvedGameTheoryProfile(req.body || {}),
        stream: true,
        onChunk: (chunk) => {
          res.write(chunk);
          if (typeof res.flush === 'function') res.flush();
        },
      });

      console.log(`[博弈推演] 本轮博弈对抗推演流式输出完成 (会话ID: ${sessionId})`);
      res.write(`data: ${JSON.stringify({ event: 'round_finished', result })}\n\n`);
      return res.end();
    } else {
      const result = await gameTheorySession.submitRound(
        sessionId,
        userId,
        withResolvedGameTheoryProfile(req.body || {}),
      );
      console.log(`[博弈推演] 本轮博弈对抗推演完成 (会话ID: ${sessionId}, 标准报文)`);
      return res.json({ success: true, ...result });
    }
  } catch (err) {
    console.warn(`[博弈容灾] 博弈沙盘推演发生异常 (会话ID: ${sessionId}):`, err.message);
    if (isStream && res.headersSent) {
      res.write(`data: ${JSON.stringify({ event: 'error', message: err.message || '推演中断' })}\n\n`);
      return res.end();
    }
    sendGameTheorySessionError(res, err);
  }
});

app.post('/api/game-theory/session/:sessionId/summary', async (req, res) => {
  try {
    const userId = req.body?.userId || 'default-user';
    const result = await gameTheorySession.generateSummary(
      req.params.sessionId,
      userId,
      withResolvedGameTheoryProfile(req.body || {}),
    );
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('生成局势全景图失败:', err);
    sendGameTheorySessionError(res, err);
  }
});

app.post('/api/game-theory/session/:sessionId/personal-review', async (req, res) => {
  try {
    const userId = req.body?.userId || 'default-user';
    const result = await gameTheorySession.generatePersonalReview(
      req.params.sessionId,
      userId,
      withResolvedGameTheoryProfile(req.body || {}),
    );
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('生成个人复盘失败:', err);
    sendGameTheorySessionError(res, err);
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
      trainingAdjustment.pauseModules = pause[1].split(/[,，;；]/).map((s) => s.trim()).filter(Boolean);
    }
    if (intensify?.[1]?.trim()) {
      trainingAdjustment.intensifyModules = intensify[1].split(/[,，;；]/).map((s) => s.trim()).filter(Boolean);
    }
    if (focus?.[1]?.trim()) {
      trainingAdjustment.newFocusAreas = focus[1].split(/[,，;；]/).map((s) => s.trim()).filter(Boolean);
    }
  }

  return {
    analysis: (analysisMatch ? analysisMatch[1] : text).trim(),
    shortDebilitatingFactors: (factorsMatch ? factorsMatch[1] : '缺乏开创力').trim(),
    difficultyAdjustment,
    trainingAdjustment,
  };
}

// 两周一度的专属复盘与弱点扫描（Biweekly Review Workflow）
app.post('/api/biweekly-review/analyze', async (req, res) => {
  const {
    practicalTest,
    goalAlignment,
    weaknessScan,
    tacticalDispatch,
    user_current_profile,
    userId = 'default-user',
  } = req.body || {};

  if (!practicalTest || !goalAlignment || !weaknessScan || !tacticalDispatch) {
    return res.status(400).json({ success: false, error: '请完整填写四个维度的复盘表单。' });
  }

  try {
    const difyApiKey =
      process.env.DIFY_BIWEEKLY_REVIEW_API_KEY;
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
          user_current_profile: resolveProfileForDify(userId, user_current_profile),
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
      return res.status(response.status).json({ success: false, error: `Dify 复盘工作流失败: ${response.status}` });
    }

    const data = await response.json();
    const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
    const parsed = parseBiweeklyReviewXml(rawResult);

    res.json({ success: true, ...parsed });
  } catch (err) {
    console.error('Biweekly review proxy error:', err);
    res.status(500).json({ success: false, error: '复盘分析代理失败: ' + err.message });
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
      nextWeekPush.yuxinGameTheory = yuxin.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean);
    }
    if (oralScenario) {
      nextWeekPush.oralSandbox = {
        scenario: oralScenario,
        roles: oralRoles || '我 + 业务助攻 + 施压方 + 关键决策人',
        focus: oralFocus || oralScenario,
        difficulty: oralDifficulty ? Number(oralDifficulty) : 4,
      };
    }
    if (impromptuTopic) {
      nextWeekPush.impromptuSpeech = {
        topic: impromptuTopic,
        targetLevels: impromptuLevels
          ? impromptuLevels.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean)
          : [],
        format: '结构化即兴表达',
      };
    }
    if (generalFocus) {
      nextWeekPush.generalFocus = generalFocus.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean);
    }
  }

  return {
    analysis: pick('analysis') || text.trim(),
    nextWeekPreview: pick('preview') || '已为您重组下周训练课表',
    nextWeekPush,
    coreThemes: pick('core_themes'),
    profileFactors: pick('profile_factors') || pick('factors') || '',
  };
}

// 每周夜话增强工作流（Weekly Chat Enhanced Workflow）
app.post('/api/weekly-chat/enhanced', async (req, res) => {
  const {
    userText,
    selectedDirections,
    user_current_profile,
    userId = 'default-user',
  } = req.body || {};

  if (!userText || typeof userText !== 'string') {
    return res.status(400).json({ success: false, error: '缺少心智投喂文本。' });
  }

  try {
    const difyApiKey =
      process.env.DIFY_WEEKLY_CHAT_ENHANCED_API_KEY;
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
          user_current_profile: resolveProfileForDify(userId, user_current_profile),
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
      return res.status(response.status).json({ success: false, error: `Dify 夜话工作流失败: ${response.status}` });
    }

    const data = await response.json();
    const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
    const parsed = parseWeeklyChatEnhancedXml(rawResult);

    res.json({ success: true, ...parsed });
  } catch (err) {
    console.error('Weekly chat enhanced proxy error:', err);
    res.status(500).json({ success: false, error: '夜话增强代理失败: ' + err.message });
  }
});

// ??????????????? API ?????????? Cognitive Penetration Engine
app.post('/api/game-theory/ascension', async (req, res) => {
  const { event_text, layers, dimension, scene_type, game_model, user_current_profile, userId = 'default-user' } = req.body;
  if (!event_text || !Array.isArray(layers) || layers.length < 5) {
    return res.status(400).json({ success: false, error: '请完成至少 5 层因果推演后再提交' });
  }
  const hasEmptyWhy = layers.some(l => !String(l.why || '').trim());
  if (hasEmptyWhy) {
    return res.status(400).json({ success: false, error: '每一层因果均不能为空，请填写完整五层推演' });
  }
  try {
    const difyApiKey = process.env.DIFY_COGNITIVE_API_KEY || process.env.VITE_DIFY_COGNITIVE_KEY;
    if (!difyApiKey) {
      return res.status(503).json({ success: false, error: '后端未配置 DIFY_COGNITIVE_API_KEY，请检查环境变量' });
    }
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
    const {
      loadInjectedKnowledgeSafe,
      attachKnowledgeContext,
      appendKnowledgeTracesSafe,
    } = require('./services/gameTheoryKnowledge');
    const injected = loadInjectedKnowledgeSafe(db, userId, 'game_theory');

    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: attachKnowledgeContext({
          event_text,
          layers_text: layers.map(l => `Why-${l.level}: ${l.why}`).join('\n'),
          dimension,
          game_model: game_model || 'prisoner_dilemma',
          scene_type: scene_type || 'corp_clash',
          user_current_profile: resolveProfileForDify(userId, user_current_profile),
          _system_time: getOralSystemFormattedTime(),
          _system_timestamp_ms: Date.now()
        }, injected.context),
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Dify 发音纠正请求失败:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify 请求失败: ${response.status} - ${errText}` });
    }

    const data = await response.json();
    const raw = data?.data?.outputs?.result ?? data?.data?.outputs?.analysis_result ?? data?.answer ?? data?.message ?? '';
    const cleanJson = String(raw).replace(/```json/g, '').replace(/```/g, '').trim();
    if (/^internal server error$/i.test(cleanJson)) {
      console.error('Dify 升维工作流内部错误:', data);
      return res.status(502).json({ success: false, error: '升维工作流内部错误，请检查 Dify 工作流配置或模型服务' });
    }

    let parsedResult;
    let resultSource = 'dify';
    try {
      parsedResult = JSON.parse(cleanJson);
    } catch (e) {
      console.warn("[Ascension] Dify JSON parse failed, falling back to LLM:", e.message);
      try {
        const ascFallback = require("./services/ascensionFallback");
        parsedResult = await ascFallback.analyzeAscension({
          event_text, layers, dimension, scene_type, game_model, user_current_profile,
        }, process.env.ASCENSION_LLM_API_KEY || process.env.LISTEN_LLM_API_KEY || '');
        resultSource = 'llm_fallback';
      } catch (fallbackErr) {
        console.error("[Ascension] LLM fallback also failed:", fallbackErr.message);
        return res.status(500).json({ success: false, error: '???????????? LLM ??????: ' + fallbackErr.message });
      }
    }

    appendKnowledgeTracesSafe(db, userId, injected.ids, {
      module: 'game_theory',
      action: 'analyzed',
    });
    afterKnowledgeInjected(userId, injected.ids);
    res.json({
      success: true,
      result: parsedResult,
      source: resultSource,
      knowledgeReminder: injected.reminder,
      knowledgeSynced: injected.syncedCount,
      knowledgeUsed: injected.usedCount,
    });
  } catch (err) {
    console.error('博弈引擎分析异常:', err);
    res.status(500).json({ success: false, error: '博弈分析引擎异常: ' + err.message });
  }
});

// ????????????????????????????????
app.get('/api/game-theory/prototypes', (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const rows = db.prepare('SELECT * FROM personal_prototypes WHERE user_id = ? ORDER BY added_at DESC').all(userId);
    res.json(filterVisiblePrototypes(rows));
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
    if (isTestFixturePrototypeName(name)) {
      return res.status(400).json({ error: 'Invalid prototype name' });
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

// ==========================================
// 驭人术手段库 CRUD API
// ==========================================

// 获取所有手段（系统默认 + 用户自定义）
app.post('/api/read/penetration/analyze', async (req, res) => {
  try {
    const userId = req.body?.userId || req.body?.user || 'default-user';
    const result = await analyzeReadPenetration({
      sceneType: req.body?.scene_type,
      textInput: req.body?.text_input,
      userId,
      userProfile: resolveProfileForDify(userId, req.body?.user_current_profile),
      systemTime: req.body?._system_time || '',
    });
    res.json({ success: true, result });
  } catch (error) {
    console.error('[Read Penetration] analyze failed:', error);
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

async function handleEnglishWorkflow(req, res, runner, label) {
  try {
    const payload = await runner({
      inputs: req.body?.inputs || {},
      userId: req.body?.userId || req.body?.user || 'default-user',
    });
    return res.json(payload);
  } catch (error) {
    console.error(`[${label}] workflow failed:`, error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function handleWriteGovernanceWorkflow(req, res) {
  const inputs = req.body?.inputs || {};
  const taskType = String(inputs.task_type || 'document_correction');
  const originalText = String(inputs.original_text || '').trim();
  if (!originalText) {
    return res.status(400).json({ error: '缺少待批改的原文' });
  }
  const userId = req.body?.userId || req.body?.user || 'default-user';
  const isStream = Boolean(req.body?.stream === true || req.body?.stream === 'true');

  const {
    loadInjectedKnowledgeSafe,
    attachKnowledgeContext,
    appendKnowledgeTracesSafe,
  } = require('./services/gameTheoryKnowledge');
  const injected = loadInjectedKnowledgeSafe(db, userId, 'writing');
  const restInputs = { ...inputs };
  delete restInputs.knowledge_context;
  delete restInputs.knowledge_refs;

  console.log(`[公文批改] 正在启动深度公文批改与润色分析 (任务类型: ${taskType}, 通道: ${isStream ? '实时流式' : '标准报文'})...`);

  try {
    const finalInputs = attachKnowledgeContext({
      _system_time: new Date().toISOString(),
      _system_timestamp_ms: Date.now(),
      ...restInputs,
    }, injected.context);

    if (isStream) {
      const response = await englishWorkflowRunners.writeGovernance({
        inputs: finalInputs,
        userId,
        responseMode: 'streaming',
        rawResponse: true,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`[公文容灾] 远程批改服务响应异常 (${response.status}):`, errorData);
        return res.status(response.status).json({ error: errorData?.message || '公文批改服务响应异常' });
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      if (response.body) {
        const reader = typeof response.body.getReader === 'function' ? response.body.getReader() : null;
        if (reader) {
          let isFirstChunk = true;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (isFirstChunk) {
                console.log('[公文批改] 收到首批专家批改建议，正在持续流式呈现...');
                isFirstChunk = false;
              }
              res.write(value);
              if (typeof res.flush === 'function') res.flush();
            }
          } finally {
            reader.releaseLock?.();
          }
          appendKnowledgeTracesSafe(db, userId, injected.ids, { module: 'writing', action: 'analyzed' });
          console.log('[公文批改] 深度公文批改与润色分析流式输出完成');
          return res.end();
        } else if (typeof response.body.pipe === 'function') {
          response.body.pipe(res);
          return;
        }
      }
      return res.end();
    } else {
      const payload = await englishWorkflowRunners.writeGovernance({
        inputs: finalInputs,
        userId,
        responseMode: 'blocking',
      });
      const raw = payload?.data?.outputs?.analysis_result
        ?? payload?.data?.outputs?.result
        ?? payload?.data?.outputs?.text
        ?? payload?.answer
        ?? '';
      if (raw) {
        const text = typeof raw === 'string' ? raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim() : JSON.stringify(raw);
        let parsed = null;
        try {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) parsed = JSON.parse(m[0]);
        } catch { parsed = null; }
        if (parsed && isMeaningfulWritingResult(parsed, taskType)) {
          appendKnowledgeTracesSafe(db, userId, injected.ids, { module: 'writing', action: 'analyzed' });
          console.log('[公文批改] 深度公文批改与润色分析完成 (标准报文)');
          return res.json({
            data: { outputs: { analysis_result: JSON.stringify(normalizeWritingResult(parsed, taskType)) } },
            source: 'dify',
            knowledgeReminder: injected.reminder,
            knowledgeSynced: injected.syncedCount,
            knowledgeUsed: injected.usedCount,
          });
        }
      }
      throw new Error('公文批改服务返回了空或未符合规范的结果');
    }
  } catch (error) {
    console.warn('[公文容灾] 公文批改服务发生异常:', error.message);
    if (isStream && res.headersSent) {
      res.write(`data: ${JSON.stringify({ event: 'error', message: error.message || '批改中断' })}\n\n`);
      return res.end();
    }
    return res.status(502).json({ error: '公文批改专家服务暂不可用，请稍后重试' });
  }
}

app.post('/api/vocab/purify', async (req, res) => {
  const { articleText, article_text, topic = '' } = req.body || {};
  try {
    const userId = requireVocabUserId(req, res);
    if (!userId) return;
        const result = await purifyVocabulary(
      { articleText: String(articleText || article_text || ''), topic: String(topic || '') },
      process.env.VOCAB_PURIFY_LLM_API_KEY || process.env.LISTEN_LLM_API_KEY || '',
    );
    return res.json({ success: true, result });
  } catch (error) {
    const status = /required/.test(error.message || '') ? 400 : 500;
    console.error('[Vocab Purify] failed:', error);
    return res.status(status).json({ success: false, error: error.message });
  }
});
app.post('/api/english/sentence-evaluate', async (req, res) => {
  const { targetWord, userSentence, theme = '' } = req.body || {};
  try {
    const result = await evaluateSentence(
      { targetWord: String(targetWord || ''), userSentence: String(userSentence || ''), theme: String(theme || '') },
      process.env.EVALUATION_LLM_API_KEY || process.env.LISTEN_LLM_API_KEY || '',
    );
    return res.json({ success: true, result });
  } catch (error) {
    const status = /required/.test(error.message || '') ? 400 : 500;
    console.error('[Sentence Evaluation] failed:', error);
    return res.status(status).json({ success: false, error: error.message });
  }
});
app.post('/api/english/wakeup', (req, res) => handleEnglishWorkflow(req, res, englishWorkflowRunners.wakeup, 'English Wakeup'));
app.post('/api/english/speech/evaluate', (req, res) => handleEnglishWorkflow(req, res, englishWorkflowRunners.speechEvaluation, 'Speech Evaluation'));
app.post('/api/english/write-governance', (req, res) => handleWriteGovernanceWorkflow(req, res));
app.post('/api/english/speech/prompter', (req, res) => handleEnglishWorkflow(req, res, englishWorkflowRunners.speechPrompter, 'Speech Prompter'));
app.post('/api/english/speech/impromptu-exemplar', (req, res) => handleEnglishWorkflow(req, res, englishWorkflowRunners.speechPrompter, 'Impromptu Exemplar'));
app.post('/api/english/speech/exemplar', (req, res) => handleEnglishWorkflow(req, res, englishWorkflowRunners.speechExemplar, 'Speech Exemplar'));
app.post('/api/english/speech/evaluate-audio', speechAudioUpload.single('file'), async (req, res) => {
  try {
    const inputs = JSON.parse(req.body?.inputs || '{}');
    const payload = await uploadSpeechEvaluation({ inputs, userId: req.body?.userId || req.body?.user || 'default-user', file: req.file });
    return res.json(payload);
  } catch (error) {
    console.error('[Speech Evaluation Audio] workflow failed:', error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
});
app.get('/api/game-theory/cases/push', async (req, res) => {
  try {
    const excludeIds = String(req.query.excludeIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const result = await gameTheoryCasePush.getCasePush({
      userId: normalizeMemoryUserId(req.query.userId),
      env: req.query.env || 'corp_clash',
      excludeIds
    });
    res.json({ success: true, result });
  } catch (error) {
    console.error('[Game Theory Case Push] failed:', error);
    res.status(500).json({ success: false, error: '高管斗争案例推送失败，请稍后重试' });
  }
});

app.get('/api/game-theory/tactics', (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const rows = db.prepare(
      'SELECT * FROM game_theory_tactics WHERE user_id = ? OR user_id = ? ORDER BY created_at ASC'
    ).all('system', userId);
    res.json(rows);
  } catch (error) {
    console.error('[Tactics] GET error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 手动添加或更新手段
app.post('/api/game-theory/tactics', (req, res) => {
  try {
    const { userId, name, category, description } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    if (!name) return res.status(400).json({ error: 'Missing name' });
    const existing = db.prepare('SELECT id FROM game_theory_tactics WHERE user_id = ? AND name = ?').get(userId, name);
    const now = Date.now();
    if (existing) {
      db.prepare('UPDATE game_theory_tactics SET category = ?, description = ?, created_at = ? WHERE id = ?')
        .run(category || 'downward', description || '', now, existing.id);
      res.json({ success: true, id: existing.id, status: 'updated' });
    } else {
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO game_theory_tactics (id, user_id, name, category, description, is_custom, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, userId, name, category || 'downward', description || '', 1, now);
      res.json({ success: true, id, status: 'created' });
    }
  } catch (error) {
    console.error('[Tactics] POST error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 删除手段（仅允许删除用户自定义的）
app.delete('/api/game-theory/tactics/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM game_theory_tactics WHERE id = ? AND user_id != ?').run(req.params.id, 'system');
    res.json({ success: true });
  } catch (error) {
    console.error('[Tactics] DELETE error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/aesthetics/daily-push', async (req, res) => {
  try {
    const result = await aestheticsPush.getDailyPush({
      userId: normalizeMemoryUserId(req.query.userId),
      scope: req.query.scope,
      context: req.query.context,
      difficulty: req.query.difficulty,
      userProfile: req.query.userProfile
    });
    res.json({ success: true, result });
  } catch (error) {
    console.error('[Aesthetics Push] daily push failed:', error);
    res.status(500).json({ success: false, error: '高阶审美推送生成失败，请稍后重试' });
  }
});

app.post('/api/aesthetics/daily-push/regenerate', async (req, res) => {
  try {
    const result = await aestheticsPush.getDailyPush({
      userId: normalizeMemoryUserId(req.body?.userId),
      force: true,
      scope: req.body?.scope,
      context: req.body?.context,
      difficulty: req.body?.difficulty,
      userProfile: req.body?.userProfile
    });
    res.json({ success: true, result });
  } catch (error) {
    console.error('[Aesthetics Push] regenerate failed:', error);
    res.status(500).json({ success: false, error: '高阶审美推送重试失败，请稍后重试' });
  }
});

app.post('/api/aesthetics/analyze', async (req, res) => {
  const allowedCategories = new Set([
    '政商务饭局与敬酒',
    '茶席与茶礼社交',
    '红酒与雪茄品鉴',
    '高尔夫轻商务',
    '跨文化宴请(西方)',
    '跨文化宴请(中东东南亚)',
  ]);
  const sceneCategory = String(req.body?.scene_category || '').trim();
  const userResponse = String(req.body?.user_response || '').trim();
  const userId = req.body?.userId || 'default-user';
  const {
    loadInjectedKnowledgeSafe,
    attachKnowledgeContext,
    appendKnowledgeTracesSafe,
  } = require('./services/gameTheoryKnowledge');
  const injected = loadInjectedKnowledgeSafe(db, userId, 'aesthetic');
  if (!allowedCategories.has(sceneCategory)) {
    return res.status(400).json({ success: false, error: '无效的审美场景类型' });
  }
  if (!userResponse) {
    return res.status(400).json({ success: false, error: '请输入待研判的应对内容' });
  }
  const runFallback = async (reason) => {
    console.warn('[Aesthetics] Dify unavailable, falling back to LLM:', reason);
    const { analyze } = require('./services/aestheticsFallback');
    const result = await analyze(
      { scene_category: sceneCategory, user_response: userResponse },
      process.env.AESTHETICS_LLM_API_KEY || process.env.LISTEN_LLM_API_KEY || '',
    );
    return res.json({ success: true, result, source: 'llm_fallback' });
  };

  const apiKey = process.env.DIFY_HIGH_AESTHETICS_API_KEY || process.env.VITE_DIFY_HIGH_AESTHETICS_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  if (!apiKey) {
    try { return await runFallback('Dify API Key missing'); }
    catch { return res.status(503).json({ success: false, error: '高阶审美研判服务未配置' }); }
  }
  try {
    const response = await fetch(baseUrl.replace(/\/$/, '') + '/workflows/run', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: attachKnowledgeContext({
          scene_category: sceneCategory,
          user_response: userResponse,
          _system_time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }),
          _system_timestamp_ms: Date.now(),
        }, injected.context),
        response_mode: 'blocking',
        user: normalizeMemoryUserId(req.body?.userId || 'aesthetic-user'),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return await runFallback(`Dify HTTP ${response.status}`);
    }
    let rawResult = payload?.data?.outputs?.json_result;
    if (typeof rawResult === 'string') {
      rawResult = rawResult.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      try { rawResult = JSON.parse(rawResult); } catch { rawResult = null; }
    }
    const score = Number(rawResult?.score);
    const feedback = typeof rawResult?.feedback === 'string' ? rawResult.feedback.trim() : '';
    if (!rawResult || !feedback || !Number.isFinite(score) || score < 0 || score > 10
      || typeof rawResult.is_passed !== 'boolean') {
      return await runFallback('invalid Dify output');
    }
    const { ensureAestheticsResult } = require('./services/aestheticsResultGuard');
    const ensured = ensureAestheticsResult(
      { feedback, score, is_passed: rawResult.is_passed },
      sceneCategory
    );
    appendKnowledgeTracesSafe(db, userId, injected.ids, { module: 'aesthetic', action: 'analyzed' });
    return res.json({
      success: true,
      result: {
        feedback: ensured.feedback,
        score: ensured.score,
        is_passed: ensured.is_passed,
      },
      source: ensured.repaired ? 'dify_repaired' : 'dify',
      knowledgeReminder: injected.reminder,
      knowledgeSynced: injected.syncedCount,
      knowledgeUsed: injected.usedCount,
    });
  } catch (error) {
    try { return await runFallback(error.message); }
    catch (fallbackError) {
      console.error('[Aesthetics] LLM fallback also failed:', fallbackError.message);
      return res.status(502).json({ success: false, error: '高阶审美研判服务暂时不可用' });
    }
  }
});
// 上传书籍/材料并提取驭人术知识点（PDF/TXT）
app.post('/api/game-theory/upload-tactics-material', upload.single('file'), async (req, res) => {
  try {
    const userId = req.body.userId || 'default-user';
    const file = req.file || req.files?.[0];
    if (!file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ success: false, error: '文件超过50MB限制，请上传更小的文件' });
    }

    let textContent = '';
    const buffer = fs.readFileSync(file.path);
    const fileName = file.originalname || '';
    const {
      extractTextFromDocBuffer,
      callTacticsExtractLlm,
      planTacticInserts,
      insertPlannedTactics,
    } = require('./services/tacticsIngest');
    textContent = await extractTextFromDocBuffer(fileName, buffer);

    // Clean up temp file
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    if (!textContent || textContent.length < 50) {
      return res.status(400).json({ success: false, error: '文件内容为空或无法解析，请上传 PDF 或 TXT 格式的书籍材料' });
    }

    const excerpt = textContent.length > 6000 ? textContent.substring(0, 6000) + '...' : textContent;
    const tactics = await callTacticsExtractLlm(excerpt, userId);
    if (!tactics.length) {
      return res.status(422).json({ success: false, error: 'AI未能从该材料中提取出有效的驭人术知识点，请尝试上传内容更丰富的材料' });
    }
    const { planned } = planTacticInserts(db, userId, tactics, { sourceFile: fileName });
    const inserted = insertPlannedTactics(db, planned);
    res.json({ success: true, extracted: tactics, inserted: inserted.length, sourceFile: fileName });
  } catch (error) {
    console.error('[Tactics Upload] error:', error);
    res.status(500).json({ success: false, error: error.message || '提取失败，请稍后重试' });
  }
});

app.post('/api/game-theory/tactics/ingest-background', upload.single('file'), async (req, res) => {
  try {
    const userId = String(req.body.userId || 'default-user');
    const file = req.file || req.files?.[0];
    if (!file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }
    const {
      TACTICS_INGEST_MAX_BYTES,
      assertWithinLimits,
      isVideoFileName,
      isDocFileName,
      extractTextFromDocBuffer,
      probeDurationSeconds,
      callTacticsExtractLlm,
      planTacticInserts,
      insertPlannedTactics,
      ensureTacticsMediaDir,
    } = require('./services/tacticsIngest');

    const fileName = file.originalname || file.filename || 'upload.bin';
    const sizeCheck = assertWithinLimits({ sizeBytes: file.size });
    if (!sizeCheck.ok) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ success: false, error: sizeCheck.error });
    }
    if (!isVideoFileName(fileName) && !isDocFileName(fileName)) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ success: false, error: '仅支持 PDF/TXT/MD 或常见视频格式' });
    }

    const isVideo = isVideoFileName(fileName);
    let persistedPath = file.path;
    let mediaRelName = '';
    if (isVideo) {
      const mediaRoot = ensureTacticsMediaDir(tacticsMediaDir);
      const userDir = path.join(mediaRoot, userId.replace(/[^\w.-]/g, '_'));
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
      const ext = path.extname(fileName) || '.mp4';
      mediaRelName = `${crypto.randomUUID()}${ext}`;
      persistedPath = path.join(userDir, mediaRelName);
      fs.renameSync(file.path, persistedPath);
    }

    const task = taskQueue.createTask('tactics_ingest', `驭人术资料提炼 · ${String(fileName).slice(0, 40)}`);
    res.json({ success: true, taskId: task.id });

    setImmediate(async () => {
      try {
        taskQueue.updateTask(task.id, { status: 'running', progress: 8, logs: ['已接收文件，开始处理…'] });
        let textContent = '';
        let transcript = '';
        let durationSec = null;
        let mediaId = null;
        let videoUrl = null;

        if (isVideo) {
          durationSec = await probeDurationSeconds(persistedPath);
          const limit = assertWithinLimits({ sizeBytes: file.size, durationSec });
          if (!limit.ok) {
            throw new Error(limit.error);
          }
          taskQueue.updateTask(task.id, { progress: 25, logs: [`时长约 ${Math.round(durationSec)} 秒，开始转写…`] });
          const { extractTranscriptFromLocalVideo } = require('./services/videoTranscriber');
          const tr = await extractTranscriptFromLocalVideo({
            taskId: task.id,
            filePath: persistedPath,
            fileName,
            keepVideo: true,
          });
          transcript = tr.transcript || '';
          textContent = transcript;
          if (!textContent || textContent.length < 20) {
            throw new Error('转写结果过短，无法抽取手段');
          }
          mediaId = crypto.randomUUID();
          videoUrl = `/api/tactics_media/${mediaId}/file`;
          db.prepare(`
            INSERT INTO game_theory_tactics_media
              (id, user_id, task_id, file_path, public_url, transcript, duration_sec, source_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            mediaId,
            userId,
            task.id,
            persistedPath,
            videoUrl,
            transcript,
            durationSec,
            fileName,
            Date.now()
          );
        } else {
          const buffer = fs.readFileSync(persistedPath);
          textContent = await extractTextFromDocBuffer(fileName, buffer);
          if (fs.existsSync(persistedPath)) fs.unlinkSync(persistedPath);
          if (!textContent || textContent.length < 50) {
            throw new Error('文件内容为空或无法解析');
          }
        }

        taskQueue.updateTask(task.id, { progress: 78, logs: ['正在抽取驭人手段…'] });
        const excerpt = textContent.length > 6000 ? textContent.substring(0, 6000) + '...' : textContent;
        const tactics = await callTacticsExtractLlm(excerpt, userId);
        if (!tactics.length) {
          throw new Error('AI未能提取出有效手段');
        }
        const sourceFile = mediaId ? `video:${mediaId}` : fileName;
        const { planned } = planTacticInserts(db, userId, tactics, { sourceFile, mediaId });
        const insertedRows = insertPlannedTactics(db, planned);

        taskQueue.updateTask(task.id, {
          status: 'completed',
          progress: 100,
          logs: [`完成：新增 ${insertedRows.length} 条手段`],
          result: {
            inserted: insertedRows.length,
            tacticIds: insertedRows.map((r) => r.id),
            mediaId,
            videoUrl,
            transcript: transcript || undefined,
            sourceName: fileName,
          },
        });
      } catch (err) {
        console.error('[tactics_ingest] failed:', err);
        try {
          if (isVideo && persistedPath && fs.existsSync(persistedPath)) {
            // 失败时仍保留文件便于排查；也可删除。规格：失败不留半截媒体行。
          }
        } catch {}
        taskQueue.updateTask(task.id, {
          status: 'failed',
          progress: 100,
          error: err.message || String(err),
          logs: [`失败: ${err.message || String(err)}`],
        });
      }
    });
  } catch (error) {
    console.error('[tactics ingest] error:', error);
    res.status(500).json({ success: false, error: error.message || '提交失败' });
  }
});

app.get('/api/tactics_media/:id', (req, res) => {
  try {
    const userId = String(req.query.userId || '');
    const row = db.prepare('SELECT * FROM game_theory_tactics_media WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (userId && row.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    res.json({
      id: row.id,
      userId: row.user_id,
      taskId: row.task_id,
      publicUrl: row.public_url,
      transcript: row.transcript,
      durationSec: row.duration_sec,
      sourceName: row.source_name,
      createdAt: row.created_at,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tactics_media/:id/file', (req, res) => {
  try {
    const userId = String(req.query.userId || '');
    const row = db.prepare('SELECT * FROM game_theory_tactics_media WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (userId && row.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (!row.file_path || !fs.existsSync(row.file_path)) {
      return res.status(404).json({ error: 'File missing' });
    }
    res.sendFile(path.resolve(row.file_path));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ????? 404

/**
 * TTS 网关错误（外部 TTS 服务不可达时抛出）
 */
class TtsGatewayError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TtsGatewayError';
    this.code = 'TTS_GATEWAY_ERROR';
  }
}

/**
 * 解析 edge-tts 可执行命令（支持 EDGE_TTS_BIN、~/.local/bin、python3 -m edge_tts）
 */
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
 * 本地 Edge TTS：调用 edge-tts CLI 或 python3 -m edge_tts 生成 MP3
 * @param {string} text 待合成文本
 * @param {string} voice 语音名
 * @param {AbortSignal|null} signal
 * @returns {Promise<Buffer>} MP3 数据
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

  // 将极长的文本写入临时文件，防止命令行因过长或包含特殊字符报错
  fs.writeFileSync(tmpTextFile, text, 'utf8');

  return new Promise((resolve, reject) => {
    const args = [...prefixArgs, '--voice', voice, '--file', tmpTextFile, '--write-media', tmpMediaFile];
    // edge-tts 超时默认 10 分钟（登录补跑仅 1 分钟稿；可用 TTS_EDGE_TIMEOUT_MS 覆盖）
    const edgeTimeoutMs = Number(process.env.TTS_EDGE_TIMEOUT_MS || 600000);
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
        reject(new Error(`音频读取失败: ${readErr.message}`));
      }
    });
    // 处理外部 signal 打断
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
  const primary = process.env.TTS_API_URL || 'https://fetch.234124123.xyz/v1/audio/speech';
  const fallback = process.env.TTS_API_FALLBACK_URL || 'https://fetch.234124123.xyz/v1/audio/speech';
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
 * 核心：分块合成并按序追加写入磁盘（流式写入，避免大内存峰值）
 * @param {string} cleanInput 已清洗文本
 * @param {string} finalModel TTS 模型
 * @param {string} audioPath 目标 mp3 文件路径
 * @param {string|null} taskId 异步任务ID，传入则更新进度
 * @param {AbortSignal|null} signal 可选的 AbortSignal
 */
async function synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, taskId = null, signal = null, extra = null) {
  const chunkCacheDir = audioPath + '.chunks';
  const maxAttempts = taskId ? 8 : 2;
  try {
  const taskQueue = taskId ? require('./services/taskQueue') : null;
  const ttsUpstreamUrls = getTtsUpstreamUrls();
  const apiKey = process.env.TTS_API_KEY || 'sk-d2c5fb65e9516bbc-rd1lv9-762292df';
  const ttsVoice = finalModel.includes('/') ? finalModel.split('/')[1] : '';

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
      taskQueue.updateTask(taskId, { progress: 100, logs: ['全部片段已完成（从缓存恢复）'] });
    }
    if (!isValidCachedAudio(audioPath)) {
      throw new Error('从缓存合并后音频文件无效（0 字节）');
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
          logs: [`分块 ${nextWrite}/${total} 已写入`]
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
        taskQueue.updateTask(taskId, { logs: [`分块 ${idx + 1}/${total} 从缓存恢复`] });
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

        clearTimeout(timeoutId);

        if (r && r.ok) {
          const chunkData = Buffer.from(await r.arrayBuffer());
          pendingMap.set(idx, chunkData);
          flush();
          lastErr = null;
          break;
        }

        const upstreamStatus = r ? r.status : (upstreamErr ? formatTtsFetchError(upstreamErr) : 'unreachable');
        console.warn(`[TTS] Upstream failed (${upstreamStatus}), trying edge-tts fallback...`);
        if (taskQueue && taskId) {
          taskQueue.updateTask(taskId, { logs: [`第 ${attempt} 次: 上游失败 ${upstreamStatus}，尝试本地 edge-tts…`] });
        }
        try {
          const fallbackResult = await synthesizeWithEdgeTTS(chunkText, ttsVoice || 'en-GB-LibbyNeural', signal);
          pendingMap.set(idx, fallbackResult);
          flush();
          lastErr = null;
          break;
        } catch (fallbackErr) {
          console.error('[TTS] Fallback failed:', fallbackErr.message);
          if (taskQueue && taskId) {
            taskQueue.updateTask(taskId, { logs: [`本地 edge-tts 兜底失败: ${fallbackErr.message}`] });
          }
          lastErr = new TtsGatewayError(`主服务 ${upstreamStatus}，备用合成也失败: ${fallbackErr.message}`);
        }
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
            logs: [`分块 ${idx + 1}/${total} 第${attempt}次失败，${Math.round(delay/1000)}秒后重试…`]
          });
        }
        await new Promise(r => setTimeout(r, delay));
      }
    }

    if (lastErr) {
      // ????????????????????
      fs.rmSync(chunkCacheDir, { recursive: true, force: true });
      throw new Error(`分块 ${idx + 1}/${total} 合成失败: ${lastErr?.message}`);
    }
  }

  // ?????????????
  fs.rmSync(chunkCacheDir, { recursive: true, force: true });

  if (!isValidCachedAudio(audioPath)) {
    throw new Error('合成完成但音频文件无效（0 字节）');
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

  // 音频后处理：压力因素效果
  const effects = extra?.effects || null;
  if (effects && fs.existsSync(audioPath)) {
    try {
      await applyAudioEffects(audioPath, effects);
    } catch (effErr) {
      console.warn('[TTS] 音频后处理失败（非致命）:', effErr.message);
    }
  }
}

// 音频后处理函数：应用压力因素效果
// 音频后处理函数：应用压力因素效果（含真实音效混音）
async function applyAudioEffects(audioPath, effects) {
  const { execFile } = require('child_process');
  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  const tmpPath = audioPath + '.temp.mp3';

  // 确保音效文件存在
  ensureSoundEffectsExist();
  const soundEffectsDir = path.join(__dirname, 'public', 'sound_effects');
  const interruptionEffect = path.join(soundEffectsDir, 'interruption.mp3');
  const staticNoiseEffect = path.join(soundEffectsDir, 'static_noise.mp3');

  // 构建输入列表
  const inputs = ['-i', audioPath];
  const filterParts = [];

  // 口音由 Edge TTS Voice 决定；不再用 rubberband 变调伪装

  // 1. 卡顿效果：插入三个可感知、可复现的短暂静音区间
  if (effects.packet_loss) {
    filterParts.push("volume=eval=frame:volume='if(between(t\\,0.5\\,0.72)+between(t\\,2.0\\,2.18)+between(t\\,4.0\\,4.24)\\,0.001\\,1)'");
  }

  // 判断是否需要混音（打断或信息缺失）
  const hasInterruption = effects.interruptions && fs.existsSync(interruptionEffect);
  const hasNoise = effects.information_gap && fs.existsSync(staticNoiseEffect);

  // 添加额外输入
  if (hasInterruption) {
    inputs.push('-i', interruptionEffect);
  }
  if (hasNoise) {
    inputs.push('-stream_loop', '-1', '-i', staticNoiseEffect);
  }

  // 如果只有基础滤镜（口音/卡顿），使用简单 -af
  if (!hasInterruption && !hasNoise && filterParts.length > 0) {
    const filterChain = filterParts.join(',');
    const args = ['-i', audioPath, '-af', filterChain, '-y', tmpPath];

    await new Promise((resolve, reject) => {
      execFile(ffmpegPath, args, { timeout: 30000 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (fs.existsSync(tmpPath)) {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      fs.renameSync(tmpPath, audioPath);
    }
    return;
  }

  // 需要混音：使用 filter_complex
  if (hasInterruption || hasNoise || filterParts.length > 0) {
    let filterComplex = '';
    let currentLabel = '0:a';

    // 应用基础滤镜
    if (filterParts.length > 0) {
      filterComplex += `[0:a]${filterParts.join(',')}[base];`;
      currentLabel = 'base';
    }

    // 3. 打断效果：在第4秒混入打断音效，同时降低主音频音量
    if (hasInterruption) {
      const intIdx = 1;
      // 主音频在 4.0s-4.7s 降低音量
      filterComplex += `[${currentLabel}]volume=eval=frame:volume='if(between(t\,4\,4.7)\,0.1\,1)'[ducked];`;
      // 打断音效延迟4秒
      filterComplex += `[${intIdx}:a]adelay=4000|4000[int_del];`;
      // 混合
      filterComplex += `[ducked][int_del]amix=inputs=2:duration=first[mixed_int];`;
      currentLabel = 'mixed_int';
    }

    // 4. 信息缺失：混入背景噪音
    if (hasNoise) {
      const noiseIdx = hasInterruption ? 2 : 1;
      // 降低噪音音量
      filterComplex += `[${noiseIdx}:a]volume=0.08[noise_low];`;
      // 混合
      filterComplex += `[${currentLabel}][noise_low]amix=inputs=2:duration=first[mixed_all];`;
      currentLabel = 'mixed_all';
    }

    // 输出
    filterComplex += `[${currentLabel}]anull[out]`;

    const args = [...inputs, '-filter_complex', filterComplex, '-map', '[out]', '-y', tmpPath];

    await new Promise((resolve, reject) => {
      execFile(ffmpegPath, args, { timeout: 60000 }, (err, stdout, stderr) => {
        if (err) {
          console.error('[FFMPEG] 混音失败:', stderr);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    if (fs.existsSync(tmpPath)) {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      fs.renameSync(tmpPath, audioPath);
    }
  }
}

// 确保音效文件存在，不存在则自动生成
function ensureSoundEffectsExist() {
  const dir = path.join(__dirname, 'public', 'sound_effects');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  const interruptionPath = path.join(dir, 'interruption.mp3');
  const staticNoisePath = path.join(dir, 'static_noise.mp3');

  if (!fs.existsSync(interruptionPath)) {
    console.log('[SOUND] 生成 interruption.mp3...');
    try {
      const { execSync } = require('child_process');
      execSync(`"${ffmpegPath}" -f lavfi -i "sine=frequency=400:duration=0.2" -f lavfi -i "sine=frequency=400:duration=0.2" -filter_complex "[0:a]adelay=0|0[a1]; [1:a]adelay=500|500[a2]; [a1][a2]amix=inputs=2" -y "${interruptionPath}"`, { stdio: 'ignore' });
    } catch (e) {
      console.error('[SOUND] 生成 interruption.mp3 失败:', e.message);
    }
  }

  if (!fs.existsSync(staticNoisePath)) {
    console.log('[SOUND] 生成 static_noise.mp3...');
    try {
      const { execSync } = require('child_process');
      execSync(`"${ffmpegPath}" -f lavfi -i "anoisesrc=d=10:color=pink:amplitude=0.15" -y "${staticNoisePath}"`, { stdio: 'ignore' });
    } catch (e) {
      console.error('[SOUND] 生成 static_noise.mp3 失败:', e.message);
    }
  }
}

global.synthesizeAndSaveAudio = synthesizeAndSaveAudio;

/** C1: 与 daily-extract 相同的 mastery 调用；只解析词表，不覆盖 listen 正文 */
async function extractVocabFromListenArticle({
  body,
  theme,
  genre,
  cefr_level,
  duration,
  userId = 'default-user',
} = {}) {
  const apiKey = process.env.DIFY_ENGLISH_MASTERY_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  // body 仅用于校验有正文；mastery 与 daily-extract 一样靠 theme/genre/cefr/duration 生成并带 VOCAB_JSON
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
          theme: theme || '商务谈判：让步与施压',
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
  let parsed = dailyListenPreGenerateService.parseVocabFromRaw(answer || '');
  let vocabN = Array.isArray(parsed.vocab) ? parsed.vocab.length : 0;
  let phraseN = Array.isArray(parsed.phrases) ? parsed.phrases.length : 0;
  if (vocabN === 0 && phraseN === 0 && body.trim()) {
    console.log(`[DailyListen] extractVocab empty from Dify, calling local fallback LLM...`);
    try {
      const fallbackRes = await extractVocabFallback(body, cefr_level, genre, duration, theme);
      if (fallbackRes.vocab.length > 0 || fallbackRes.phrases.length > 0 || (fallbackRes.sentences && fallbackRes.sentences.length > 0)) {
        parsed = fallbackRes;
        vocabN = parsed.vocab.length;
        phraseN = parsed.phrases.length;
      }
    } catch (fallbackErr) {
      console.error("[DailyListen] Fallback vocab extraction failed:", fallbackErr.message);
    }
  }
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
  synthesizeAudioFile: async (text, audioPath, ctx = {}) => {
    const clean = sanitizeListenMaterialScript(text);
    const voiceId = ctx.voiceId || listenPrefsService.DEFAULT_LISTEN_VOICE_ID;
    const finalModel = `edge-tts/${voiceId}`;
    const effects = listenPrefsService.CRON_FORCE_LISTEN_EFFECTS;
    await synthesizeAndSaveAudio(clean, finalModel, audioPath, null, null, { effects });
  },
});

// TTS ????????????????????????????????????????????? OOM ?????????
let ttsLongLock = false;

// TTS ??????????????????????????? / ?????????????????????
app.post('/api/tts/speech', async (req, res) => {
  try {
    const { input, model = 'edge-tts/en-US-EmmaNeural', isAsync, effects } = req.body;
    if (!input) return res.status(400).json({ error: 'Missing input text' });

    const finalModel = model || 'edge-tts/en-US-EmmaNeural';
    // 移除 Emoji
    let cleanInput = input.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{27BF}]/gu, '');
    cleanInput = sanitizeListenMaterialScript(cleanInput);

    // 针对纯英文 TTS 模型，过滤掉中文字符及全角标点，避免 edge-tts 遇到无法发音的字符崩溃 (NoAudioReceived)
    if (finalModel.includes('/en-') || finalModel.startsWith('en-')) {
      cleanInput = cleanInput.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g, '').trim();

      // 熔断机制：如果过滤后没有任何有效字母或数字，直接返回空音频，防止 edge-tts 读空气报错 500
      if (!/[a-zA-Z0-9]/.test(cleanInput)) {
        return res.json({ success: true, audioId: 'empty', audioUrl: null, duration: 0 });
      }
    }

    // ????????????????????? Key???????????????????????
    const md5Input = cleanInput + '_' + finalModel + (effects ? '_' + JSON.stringify(effects) : '');
    const md5 = crypto.createHash('md5').update(md5Input).digest('hex');
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
          message: '当前有音频正在合成中，请稍后再试（预计 3~10 分钟）'
        });
      }
      ttsLongLock = true;

      const taskQueue = require('./services/taskQueue');
      const task = taskQueue.createTask('tts', `高保真音频合成 (${cleanInput.length}字符)`);

      // ?????????????? try/catch ???? res.json??????????????????????????
      try {
        res.json({ success: true, taskId: task.id, status: 'pending', audioUrl: null });
      } catch (e) {
        ttsLongLock = false;
        return; // 客户端已断开
      }

      // ?????????setImmediate ???????????????????? Express ????
      setImmediate(async () => {
        try {
          taskQueue.updateTask(task.id, { status: 'running', logs: [`开始异步合成，总字符: ${cleanInput.length}`] });
          await synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, task.id, null, { effects });
          taskQueue.updateTask(task.id, {
            status: 'completed', progress: 100,
            result: { audioId: md5, audioUrl },
          logs: ['音频合成完成']
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
        await synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, null, ctrl.signal, { effects });
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
        message: '语音合成服务暂不可用，请稍后重试'
      });
    }
    if (error.message && error.message.includes('当前有音频正在合成')) {
      return res.status(429).json({
        success: false,
        code: 'TTS_LOCKED',
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      code: 'TTS_INTERNAL_ERROR',
      message: error.message || '语音合成内部错误'
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
      return res.status(404).json({ success: false, error: '任务不存在或已过期' });
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
        error: task.error || '未知错误',
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
// YouTube 下载前提：检测与配置
// ==========================================
app.get('/api/materials/youtube-preflight', async (req, res) => {
  try {
    const { runYoutubePreflight } = require('./services/youtubePreflight');
    const probe = String(req.query.probe || '').trim() === '1';
    const result = runYoutubePreflight({ probe });
    res.json(result);
  } catch (error) {
    console.error('[YouTube Preflight Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const YOUTUBE_SETUP_KIT_FILES = [
  'setup-youtube.bat',
  'keep-youtube-tunnel.bat',
  'setup-youtube-oneclick.ps1',
  'export-chrome-cookies-cdp.py',
  'youtube-setup.config.example.json',
  'README.txt',
];

app.get('/api/materials/youtube-setup-kit.zip', (req, res) => {
  const { execFileSync } = require('child_process');
  const os = require('os');
  const kitDir = path.join(__dirname, 'scripts/windows');
  const missing = YOUTUBE_SETUP_KIT_FILES.filter((f) => !fs.existsSync(path.join(kitDir, f)));
  if (missing.length > 0) {
    return res.status(500).json({ success: false, error: `配置包缺少文件: ${missing.join(', ')}` });
  }
  const tmpZip = path.join(os.tmpdir(), `youtube-setup-kit-${Date.now()}.zip`);
  try {
    execFileSync('zip', ['-j', tmpZip, ...YOUTUBE_SETUP_KIT_FILES], { cwd: kitDir });
    res.download(tmpZip, 'SuperAgent-YouTube一键配置.zip', () => {
      try { fs.unlinkSync(tmpZip); } catch (_) {}
    });
  } catch (error) {
    console.error('[YouTube Setup Kit Error]:', error);
    res.status(500).json({ success: false, error: '打包配置包失败，请联系管理员' });
  }
});

app.post('/api/materials/youtube-config', upload.single('cookies'), async (req, res) => {
  try {
    const {
      saveConfig,
      ensureSecretsDir,
      DEFAULT_COOKIES_FILE,
      getYoutubeProxy,
      getYoutubeCookiesFile,
    } = require('./services/youtubeRuntimeConfig');
    const { runYoutubePreflight } = require('./services/youtubePreflight');

    const proxy = String(req.body?.proxy || '').trim();
    const partial = {};
    if (proxy) partial.proxy = proxy;

    if (req.file) {
      ensureSecretsDir();
      fs.copyFileSync(req.file.path, DEFAULT_COOKIES_FILE);
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      partial.cookiesFile = DEFAULT_COOKIES_FILE;
    }

    if (Object.keys(partial).length === 0) {
      return res.status(400).json({ success: false, error: '请提供 proxy 或上传 cookies 文件' });
    }

    saveConfig(partial);
    const preflight = runYoutubePreflight({ probe: false });
    res.json({
      success: true,
      configured: {
        proxy: getYoutubeProxy(),
        cookiesFile: getYoutubeCookiesFile(),
      },
      ...preflight,
    });
  } catch (error) {
    console.error('[YouTube Config Error]:', error);
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
      return res.status(400).json({ success: false, error: '缺少必要参数: url' });
    }

    const { fetchUrlContent } = require('./services/webFetcher');
    const { cleanWebArticleMarkdown } = require('./services/webArticleCleaner');
    const result = await fetchUrlContent(url);
    const cleaned = await cleanWebArticleMarkdown(result.markdown);
    res.json({ ...result, markdown: cleaned, rawLength: result.length, length: cleaned.length });
  } catch (error) {
    console.error('[Fetch URL Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ???????? API (?????? URL ??? Multipart ???????????)
// ==========================================


// ??????????????? API
app.post('/api/materials/upload-chunk', upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;
    const file = req.file || req.files?.[0];

    if (!uploadId || chunkIndex === undefined || !file) {
      return res.status(400).json({ success: false, error: '缺少必要参数: uploadId, chunkIndex 或 chunk' });
    }

    const sessionDir = path.join(chunkDir, uploadId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // ?????????????????????????????????????????????????????
    const targetPath = path.join(sessionDir, String(chunkIndex));
    try {
      fs.renameSync(file.path, targetPath);
    } catch (renameErr) {
      // 临时目录与分片目录可能不在同一挂载点，rename 会抛 EXDEV
      if (renameErr.code !== 'EXDEV') throw renameErr;
      fs.copyFileSync(file.path, targetPath);
      try { fs.unlinkSync(file.path); } catch (_) {}
    }

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
      return res.status(400).json({ success: false, error: '缺少必要参数: uploadId, fileName 或 totalChunks' });
    }

    const sessionDir = path.join(chunkDir, uploadId);
    if (!fs.existsSync(sessionDir)) {
    return res.status(400).json({ success: false, error: '未接收到有效文件数据' });
    }

    // ??????????????????????????????????????
    const safeFileName = fileName.replace(/[\\\/]/g, '_');
    const finalFileName = `${uploadId}_${safeFileName}`;
    const finalFilePath = path.join(uploadDir, finalFileName);

    // ??? appendFileSync ?????????
    fs.writeFileSync(finalFilePath, ''); // 创建或清空文件
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(sessionDir, String(i));
      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({ success: false, error: `合并失败: 缺少第 ${i} 块分片` });
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
    const taskName = `上传视频(分片): ${fileName}`;
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
    const file = req.file || req.files?.[0];
    if (!file) {
    return res.status(400).json({ success: false, error: '未接收到有效文件数据' });
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
    const file = req.file || req.files?.[0];

    if (!url && !file) {
      return res.status(400).json({ success: false, error: '缺少必要参数: 必须提供 url 或上传 video 文件' });
    }

    const taskQueue = require('./services/taskQueue');
    const { startTranscribeTask } = require('./services/videoTranscriber');

    // ??????????????
    const taskName = url ? `网页视频: ${url}` : `上传视频: ${file.originalname || '未命名视频'}`;
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
      return res.status(404).json({ success: false, error: '任务不存在或已过期' });
    }
    res.json({ success: true, ...task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/tasks/:taskId', (req, res) => {
  try {
    const taskQueue = require('./services/taskQueue');
    const result = taskQueue.deleteTask(req.params.taskId);
    if (!result.ok) {
      return res.status(result.code).json({
        success: false,
        error: result.code === 409 ? '进行中的任务不能删除' : '任务不存在或已过期',
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tasks/clear-finished', (req, res) => {
  try {
    const taskQueue = require('./services/taskQueue');
    const result = taskQueue.clearFinishedTasks();
    res.json({ success: true, deleted: result.deleted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Whisper ????????????? API???????????????? 9router ??????? CORS ??????????

// 当 Dify 工作流提取词汇为空时，调用本地 LLM 动态提取生词、短语与句型 (使用 dify 模型)
async function extractVocabFallback(body, cefrLevel = 'B1', genre = 'meeting', duration = '15', theme = '') {
  const { chatCompletions, getLlmModels, DEFAULT_LLM_KEY } = require('./services/openaiCompatLlm');
  const apiKey = process.env.LISTEN_LLM_API_KEY || DEFAULT_LLM_KEY;

  const systemPrompt = `You are a senior business English pedagogy expert. Read the English article provided below and extract key business vocabulary words, business phrases, and key business sentence structures.

【TARGET CEFR LEVEL】
${cefrLevel}

【EXTRACTION REQUIREMENTS】
Based on the length of the input article and the target CEFR level, dynamically determine the number of items to extract (e.g. for a short 1-minute article, extract around 5-8 words, 3-5 phrases, and 1-2 sentence structures; for longer articles, extract more but no more than 30 words, 20 phrases, and 8 sentence structures). All extracted items must be present in the input article.

For each word/phrase/sentence structure, provide:
- phonetic: IPA notation (American standard or British standard)
- partOfSpeech: part of speech (for words only, e.g. adj. / n. / v. / adv.)
- meaning: concise Chinese meaning
- definition_en: concise English definition/explanation
- examples: an array containing the exact original sentence from the article that contains the word/phrase/sentence structure.

【OUTPUT FORMAT】
Output ONLY a single valid JSON object. Do not wrap it in markdown code blocks like \`\`\`json ... \`\`\$, and do not include any extra text.
The JSON schema must be exactly:
{
  "words": [
    {
      "word": "word",
      "phonetic": "phonetic",
      "partOfSpeech": "partOfSpeech",
      "meaning": "concise Chinese translation",
      "definition_en": "English definition",
      "examples": ["exact original sentence from article"]
    }
  ],
  "phrases": [
    {
      "phrase": "phrase",
      "meaning": "concise Chinese translation",
      "definition_en": "English definition",
      "examples": ["exact original sentence from article"]
    }
  ],
  "sentences": [
    {
      "sentence": "the full sentence structure",
      "meaning": "concise Chinese translation and grammatical analysis",
      "definition_en": "English grammar/structure explanation",
      "examples": ["exact original sentence from article"]
    }
  ]
}`;

  const executeRequest = async (modelName) => {
    const data = await chatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Input Article:\n"""\n${body}\n"""` }
      ],
      temperature: 0.2,
      timeoutMs: 60000,
      apiKey,
      models: [modelName],
    });
    return { statusCode: 200, data: JSON.stringify(data) };
  };

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  const modelsToTry = getLlmModels();
  for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
    const selectedModel = modelsToTry[attempt];
    console.log(`[Vocab Fallback] Calling fallback LLM (attempt ${attempt + 1}/${modelsToTry.length}) using model=${selectedModel}...`);
    try {
      const response = await executeRequest(selectedModel);
      const json = JSON.parse(response.data);
      const content = (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content || '').trim();

      if (!content) {
        throw new Error('Received empty assistant content');
      }

      // Robust JSON extraction finding the first { and the last }
      let clean = content;
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      } else {
        // Fallback cleanup of markdown blocks if braces search failed
        if (clean.toLowerCase().startsWith('\`\`\`json')) clean = clean.slice(7);
        else if (clean.startsWith('\`\`\`')) clean = clean.slice(3);
        if (clean.endsWith('\`\`\`')) clean = clean.slice(0, -3);
        clean = clean.trim();
      }

      const parsed = JSON.parse(clean);
      console.log(`[Vocab Fallback] Successfully extracted vocab on attempt ${attempt + 1}`);
      return {
        vocab: parsed.words || parsed.vocab || [],
        phrases: parsed.phrases || [],
        sentences: parsed.sentences || []
      };
    } catch (err) {
      console.warn(`[Vocab Fallback] Attempt ${attempt + 1} failed:`, err.message);
      if (attempt < modelsToTry.length - 1) {
        await delay(1000);
      }
    }
  }

  console.error('[Vocab Fallback] All model attempts failed to extract vocab.');
  return { vocab: [], phrases: [], sentences: [] };
}

async function callPolishLLM(rawText) {
  const { chatCompletions, extractAssistantContent, DEFAULT_LLM_KEY } = require('./services/openaiCompatLlm');
  const apiKey = process.env.LISTEN_LLM_API_KEY || DEFAULT_LLM_KEY;
  const data = await chatCompletions({
    messages: [
      {
        role: 'system',
        content: '你是一个专业的中英文语音识别（STT）原始转录文本智能纠错与润色助手。\\n\\n你的核心任务是：纠正原始文本中由于语音识别错误导致的“同音错别字”和“近音词”，在不改变说话人原本意图和口语语气的准则下，使其成为符合生活常识、逻辑通顺的规范句子。\\n\\n请严格遵循以下规则处理：\\n1. **逻辑与常识纠错（最重要）**：STT 转写极易产生离谱的近音错字（例如把“盒子”误听为“核子/合同/和子”，把“生锈/成熟”误听为“伸熟/神树”）。你必须结合上下文，将这些逻辑不通的词汇纠正为符合常识的正常词汇，确保句子读起来通顺合理。\\n2. **标点与分句补全**：结合语气与停顿，合理添加标点符号（中文使用全角，英文使用半角）。\\n3. **保留口语语气**：保留说话人的第一人称、口语语气和口头表达习惯（如“啊/啦/吧”等语气词），绝对不要把通俗的口语强行改写为官僚、书面或过于正式的官腔。\\n4. **自适应语言**：自动处理纯中文、纯英文或中英混杂文本。\\n5. **严格的输出限制**：仅输出最终纠正、润色后的纯文本内容。绝对不能包含任何解释、旁白、前缀（如“纠正后：”）或双引号。\\n6. **无法润色时必须回退原文**：若输入已通顺无需修改、仅为单个单词/短词、你不确定如何纠正，或无法有效润色，必须原样输出输入文本，禁止输出空字符串。仅当输入本身为空，或仅为杂音标签（如 silence、BLANK_AUDIO）时，才输出空字符串。'
      },
      {
        role: 'user',
        content: `原始转录文本：\\n"""\\n${rawText}\\n"""`
      }
    ],
    temperature: 0.7,
    timeoutMs: 15000,
    apiKey,
  });
  const polishedText = extractAssistantContent(data).trim();
  return polishedText || String(rawText || '').trim();
}

app.post('/api/audio/transcriptions', upload.any(), async (req, res) => {
  let fileObj = null;
  let tempFilePath = null;

  try {
    const sttApiKey = process.env.DIFY_STT_API_KEY;
    if (!sttApiKey) {
      return res.status(500).json({ error: 'Server missing DIFY_STT_API_KEY' });
    }

    console.log('[DEBUG STT] Files received:', req.files);
    console.log('[DEBUG STT] Body:', req.body);

    const bodyFileUrl = req.body && (req.body.file_url || req.body.fileUrl);
    if (bodyFileUrl) {
      const fileName = req.body.file_name || req.body.fileName || 'audio.mp3';
      tempFilePath = require('path').join(require('os').tmpdir(), `stt-${Date.now()}-${fileName}`);

      // 将 Dify 内部主机名替换为公网可访问域名
      const difyBase = process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
      const difyOrigin = new URL(difyBase).origin;
      let targetUrl = bodyFileUrl
        .replace(/^http:\/\/api:\d+/, difyOrigin)
        .replace(/^http:\/\/localhost:\d+/, difyOrigin);
      if (targetUrl.startsWith('/')) {
        targetUrl = difyOrigin + targetUrl;
      }

      console.log('[STT URL] 正在从 Dify 下载音频文件:', targetUrl);
      const dlRes = await fetch(targetUrl, {
        headers: { 'Authorization': `Bearer ${sttApiKey}` }
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
      const mimeType = fileObj.mimetype || 'audio/mp3';
      const originalName = fileObj.originalname || 'audio.mp3';

// 2.1 仅通过本地 whisper-server 获取原始转译文本（不再降级 Dify STT）
      let rawText = '';
      let rawSuccess = false;
      let whisperFailReason = '';

      console.log(`[STT Local] 正在发送音频至本地 whisper-server 进行初步识别: ${originalName}`);
      try {
        const localFormData = new globalThis.FormData();
        const localBlob = new globalThis.Blob([fileBuffer], { type: mimeType });
        localFormData.append('file', localBlob, originalName);
        localFormData.append('language', 'auto');
        localFormData.append('initial_prompt', '简体中文, English, transcript, 录音.');

        const localResponse = await fetch('http://127.0.0.1:8080/inference', {
          method: 'POST',
          body: localFormData,
        });

        if (localResponse.ok) {
          const localData = await localResponse.json().catch(() => ({}));
          rawText = typeof localData.text === 'string' ? localData.text.trim() : '';

          // 对原始文本进行过滤降噪，洗掉 Whisper 幻觉噪声标签 (如 [Spanish], [silence], [BLANK_AUDIO], (laughter) 等)
          rawText = rawText
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\([^)]*\)/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          rawSuccess = true;
          console.log('[STT Local] 本地 whisper-server 原始识别并洗噪成功:', rawText);
        } else {
          whisperFailReason = `本地 whisper-server 返回状态码: ${localResponse.status}`;
          console.warn(`[STT Local] ${whisperFailReason}`);
        }
      } catch (localErr) {
        whisperFailReason = localErr.message || '本地 whisper-server 调用失败';
        console.warn('[STT Local] 本地 whisper-server 调用失败:', whisperFailReason);
      }

      if (!rawSuccess) {
        return res.status(502).json({
          error: `本地 Whisper 转写失败，请确认 whisper-server 是否可用: ${whisperFailReason || 'unknown'}`,
        });
      }

      // 2.2 调用 IP 级 OpenAI 接口进行大语言模型智能润色与纠错
      if (rawText) {
        console.log(`[STT Polish] 正在将原始文本发送至大模型进行润色: "${rawText}"`);
        try {
          const polishedText = await callPolishLLM(rawText);
          const finalText = (polishedText && String(polishedText).trim()) || rawText;
          if (!polishedText || !String(polishedText).trim()) {
            console.warn('[STT Polish] 润色结果为空，回退原始文本');
          } else {
            console.log(`[STT Polish] 润色成功: "${finalText}"`);
          }
          return res.json({ text: finalText });
        } catch (polishErr) {
          console.warn('[STT Polish] 大模型润色失败，将降级直接返回原始文本:', polishErr.message);
          return res.json({ text: rawText });
        }
      } else {
        console.log('[STT Result] 识别出的原始文本为空，直接返回');
        return res.json({ text: '' });
      }
    } else {
      throw new Error('服务器 Node.js 版本较低，不支持原生的 FormData，请升级 Node.js 至 18.0 或更高版本。');
    }
  } catch (error) {
    console.error('本地 Whisper 转写中转失败:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
    if (req.files && Array.isArray(req.files)) {
      for (const f of req.files) {
        if (f.path && fs.existsSync(f.path)) {
          try { fs.unlinkSync(f.path); } catch (e) {}
        }
      }
    }
  }
});


// ==========================================
// 提取思维导图与核心知识点 (fallback 本地 LLM)
// ==========================================
async function generateMindmapAndTheoryNodesFallback(body, topic = 'General Business') {
  const { chatCompletions, getLlmModels, DEFAULT_LLM_KEY } = require('./services/openaiCompatLlm');
  const apiKey = process.env.LISTEN_LLM_API_KEY || DEFAULT_LLM_KEY;

  const systemPrompt = `你是一位资深的职场博弈、逻辑学与商务英语教学专家。请阅读用户提供的文章/书本片段，为其提炼并输出一套系统的学习内容，包含思维导图、核心理论知识点、框架构成以及具体的解释与生活/工作应用举例。

【输出格式要求】
必须且只能输出一个合法的 JSON 对象，不要用 \`\`\`json ... \`\`\` 等 markdown 代码块包裹，也不要包含任何额外的解释文字。
JSON Schema 必须严格为：
{
  "mindmap": {
    "center": "核心主题（通常是文章或片段的书名或核心议题，限15字内）",
    "branches": [
      {
        "title": "分支名称（如核心逻辑、应用场景、博弈策略等，限10字内）",
        "keywords": ["关键词1", "关键词2", "关键词3"]
      }
    ]
  },
  "theoryNodes": [
    {
      "title": "知识点标题（如“滑坡谬误的应用”、“微表情识别”，限15字内）",
      "concept": "概念解读（用通俗易懂的语言进行解释，限60字内）",
      "framework": ["核心框架词1", "核心框架词2"],
      "points": [
        "具体知识点与解释/举例 1（结合文章或概念，给出一个具体的应用或沟通场景举例，限100字）",
        "具体知识点与解释/举例 2（限100字）"
      ]
    }
  ],
  "scenario": "根据上述提炼的博弈论或沟通技巧知识点，设计一个相关的模拟对话博弈练习场景（包含前因后果的完整案例），限250字，以供用户进行听力或口语表达练习。要求案例博弈激烈、背景清晰。"
}`;

  const executeRequest = async (modelName) => {
    const data = await chatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `输入文章内容:
"""
${body.substring(0, 8000)}
"""` }
      ],
      temperature: 0.3,
      timeoutMs: 35000,
      apiKey,
      models: [modelName],
    });
    return { statusCode: 200, data: JSON.stringify(data) };
  };

  const modelsToTry = getLlmModels();
  let lastErr = null;
  for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
    try {
      const res = await executeRequest(modelsToTry[attempt]);
      const jsonRes = JSON.parse(res.data);
      const rawText = jsonRes?.choices?.[0]?.message?.content || '';
      let cleanJson = rawText.trim();
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.substring(7);
      else if (cleanJson.startsWith('```')) cleanJson = cleanJson.substring(3);
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.substring(0, cleanJson.length - 3);
      cleanJson = cleanJson.trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.mindmap && parsed.theoryNodes) {
        return parsed;
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[Mindmap Generation] Attempt ${attempt + 1} failed:`, err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return {
    mindmap: {
      center: topic || '材料提纯主题',
      branches: [
        { title: '核心内容', keywords: ['博弈论', '心理侧写', '逻辑辩驳'] },
        { title: '实操要点', keywords: ['利益分析', '弦外之音', '表达重塑'] }
      ]
    },
    theoryNodes: [
      {
        title: '素材博弈知识提纯',
        concept: '根据您上传的材料提取的博弈与心理分析知识。',
        framework: ['利益驱动', '言语博弈'],
        points: [
          '上传材料成功：未能通过AI提取到深度结构，可能是文件过大或格式不相符。',
          '建议上传简明生动的博弈素材以获取最高质量 of 思维导图提取。'
        ]
      }
    ],
    scenario: `【根据导入文件自动转换的模拟案例】
在关于新项目分配的讨论会上，总监微微一笑说：“对于当前的进度落后，我们完全能够理解。不过相信只要各部门通力配合，下个月我们就能赶上来。”`
  };
}

// ==========================================
// 导出 Word 文档 (.docx)
// ==========================================
app.post('/api/material/export-docx', async (req, res) => {
  try {
    const { type, title, mindmap, theoryNodes, scenario } = req.body || {};
    const docx = require('docx');
    const { Document, Paragraph, TextRun, Packer, HeadingLevel } = docx;

    let docChildren = [];

    if (type === 'theory') {
      docChildren.push(
        new Paragraph({
          text: '博弈学、逻辑学与心理侧写核心理论框架',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 }
        })
      );

      const exportTheoryData = {
        '逻辑学与系统谬误': [
          {
            title: '非形式逻辑谬误',
            concept: '在论证过程中，论据与论题之间没有逻辑必然性，而通过修辞或情绪手段使人信服。',
            framework: ['滑坡谬误', '以偏概全', '诉诸权威', '偷换概念'],
            points: [
              '滑坡谬误：无限放大某种可能后果，形成恐吓。例如：“你今天迟到，明天就会旷工，最后就会被开除。”',
              '诉诸权威：利用某个领域的名气来证明另一个领域的正确性。',
              '偷换概念：在讨论中悄悄改变某个词语的内涵。'
            ]
          },
          {
            title: '因果关系误区',
            concept: '混淆相关性与因果性，或者将时间上的先后关系强行解释为因果关系。',
            framework: ['后此谬误', '单因谬误', '因果倒置'],
            points: [
              '后此谬误：因为 B 发生在 A 之后，就判定 A 导致了 B。',
              '单因谬误：复杂问题简单化，只归结于单一因素。'
            ]
          }
        ],
        '人性分析与心理侧写': [
          {
            title: '弦外之音解码机制',
            concept: '理解人际沟通中隐藏在表层话术之下的真实利益诉求、层级防卫或情绪宣泄。',
            framework: ['利益驱动判定', '阶层安全防卫', '同侪压力构建'],
            points: [
              '体制内话术：委婉、注重层级、避免直接冲突，常用“以退为进”或“虚晃”敲打。',
              '跨国企业话术：表面平等、重效率指标，常用高大上的行业术语（Jargon）进行自我防卫或施压。'
            ]
          },
          {
            title: '非语言信号暗示',
            concept: '肢体语言、面部表情、眼神方向、语速及停顿等生理与动作反馈。',
            framework: ['微表情检测', '肢体紧张度', '音调与停顿映射'],
            points: [
              '食指轻敲桌面：通常暗示潜在的控制欲、焦躁或内心催促。',
              '眼神偏离与斜睨：可能在临时寻找托词，或暗示对当前对比物的不屑。',
              '语速突然变慢且加重：表明正在进行高度蓄意的“表演式情绪施压”。'
            ]
          }
        ]
      };

      for (const [category, nodes] of Object.entries(exportTheoryData)) {
        docChildren.push(
          new Paragraph({
            text: category,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          })
        );

        for (const node of nodes) {
          docChildren.push(
            new Paragraph({
              text: `【主题】${node.title}`,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 100, after: 50 }
            })
          );
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: '概念解读：', bold: true }),
                new TextRun(node.concept)
              ],
              spacing: { after: 50 }
            })
          );
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: '框架要素：', bold: true }),
                new TextRun(node.framework.join(' | '))
              ],
              spacing: { after: 50 }
            })
          );
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: '核心知识点与举例：', bold: true })
              ],
              spacing: { after: 50 }
            })
          );
          for (const pt of node.points) {
            docChildren.push(
              new Paragraph({
                text: pt,
                bullet: { level: 0 },
                spacing: { after: 30 }
              })
            );
          }
        }
      }

    } else if (type === 'material') {
      const docTitle = title ? `《${title}》博弈学与心理学知识提纯报告` : '素材博弈学与心理学知识提纯报告';
      docChildren.push(
        new Paragraph({
          text: docTitle,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 }
        })
      );

      if (mindmap) {
        docChildren.push(
          new Paragraph({
            text: '一、 内容思维导图',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          })
        );
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: '核心议题：', bold: true }),
              new TextRun(mindmap.center || '')
            ],
            spacing: { after: 50 }
          })
        );
        if (Array.isArray(mindmap.branches)) {
          for (const br of mindmap.branches) {
            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `分支 [${br.title || ''}]：`, bold: true }),
                  new TextRun(Array.isArray(br.keywords) ? br.keywords.join(' | ') : '')
                ],
                bullet: { level: 0 },
                spacing: { after: 30 }
              })
            );
          }
        }
      }

      if (Array.isArray(theoryNodes)) {
        docChildren.push(
          new Paragraph({
            text: '二、 核心理论与具体知识点',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          })
        );

        for (const node of theoryNodes) {
          docChildren.push(
            new Paragraph({
              text: `【知识点】${node.title || ''}`,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 100, after: 50 }
            })
          );
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: '概念解读：', bold: true }),
                new TextRun(node.concept || '')
              ],
              spacing: { after: 50 }
            })
          );
          if (Array.isArray(node.framework)) {
            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: '框架构成：', bold: true }),
                  new TextRun(node.framework.join(' | '))
                ],
                spacing: { after: 50 }
              })
            );
          }
          if (Array.isArray(node.points)) {
            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: '详细解析与举例：', bold: true })
                ],
                spacing: { after: 50 }
              })
            );
            for (const pt of node.points) {
              docChildren.push(
                new Paragraph({
                  text: pt,
                  bullet: { level: 0 },
                  spacing: { after: 30 }
                })
              );
            }
          }
        }
      }

      if (scenario) {
        docChildren.push(
          new Paragraph({
            text: '三、 模拟实战对抗案例',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          })
        );
        docChildren.push(
          new Paragraph({
            text: scenario,
            spacing: { after: 100 }
          })
        );
      }
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const filename = type === 'theory' ? 'theory-framework.docx' : 'extracted-material-report.docx';
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (error) {
    console.error('[Export Docx Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 资料管理抽屉 CRUD API
// ==========================================
const {
  parseKnowledgeVaultTags,
  buildKnowledgeVaultExtra,
  collectKnowledgeVaultExtraPatch,
  formatKnowledgeVaultTrace,
  formatKnowledgeVaultRow,
  filterLinkedKnowledgeRows,
  sortLinkedKnowledgeRows,
  sanitizeModuleTargets,
  assertKnowledgeVaultOwner,
  readKnowledgeVaultUserId,
  buildKnowledgeVaultRevisionSnapshot,
  formatKnowledgeVaultRevision,
  KNOWLEDGE_MODULES,
  TRACE_ACTIONS
} = require('./services/knowledgeVaultExtra');

function afterKnowledgeInjected(userId, knowledgeIds) {
  try {
    const { maybeEnqueueVaultRefine } = require('./services/vaultRefine');
    maybeEnqueueVaultRefine(db, knowledgeIds, {
      userId,
      taskQueue,
      apiKey: process.env.LISTEN_LLM_API_KEY || process.env.WRITE_GOVERNANCE_LLM_KEY || '',
    });
  } catch (err) {
    console.warn('[vaultRefine] after inject enqueue failed:', err.message);
  }
}

function loadRecentKnowledgeVaultTracesMap(userId, ids, limitPer) {
  const map = {};
  if (!ids.length) return map;
  const placeholders = ids.map(() => '?').join(',');
  const traces = db.prepare(
    `SELECT * FROM knowledge_vault_traces WHERE user_id = ? AND knowledge_id IN (${placeholders}) ORDER BY used_at DESC`
  ).all(userId, ...ids);
  traces.forEach((t) => {
    if (!map[t.knowledge_id]) map[t.knowledge_id] = [];
    if (map[t.knowledge_id].length < limitPer) map[t.knowledge_id].push(t);
  });
  return map;
}

// 统一列表/新增
app.get('/api/knowledge-vault/notes', (req, res) => {
  try {
    const { userId, type } = req.query;
    if (!userId || !type) return res.status(400).json({ error: 'userId and type required' });
    const rows = db.prepare('SELECT * FROM knowledge_vault WHERE user_id = ? AND type = ? ORDER BY added_at DESC').all(userId, type);
    const includeTraces = req.query.includeTraces === '1' || req.query.includeTraces === 'true';
    if (!includeTraces) {
      return res.json(rows.map((row) => formatKnowledgeVaultRow(row)));
    }
    const tracesById = loadRecentKnowledgeVaultTracesMap(userId, rows.map((row) => row.id), 20);
    res.json(rows.map((row) => formatKnowledgeVaultRow(row, tracesById[row.id] || [])));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/knowledge-vault/notes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const row = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    const traces = db.prepare(
      'SELECT * FROM knowledge_vault_traces WHERE knowledge_id = ? AND user_id = ? ORDER BY used_at DESC LIMIT 20'
    ).all(id, userId);
    res.json(formatKnowledgeVaultRow(row, traces));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/knowledge-vault/notes', (req, res) => {
  try {
    const body = req.body || {};
    const { userId, type, word, meaning, example, title, category, summary, content, source, tags } = body;
    if (!userId || !type) return res.status(400).json({ error: 'userId and type required' });
    const id = crypto.randomUUID();
    const now = Date.now();
    const sourceValue = source || 'manual';
    const extra = buildKnowledgeVaultExtra('{}', collectKnowledgeVaultExtraPatch(body), sourceValue);
    const tagList = tags !== undefined ? parseKnowledgeVaultTags(tags) : [];
    db.prepare(`
      INSERT INTO knowledge_vault (id, user_id, type, word, meaning, example, title, category, summary, content, source, added_at, tags, extra_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, type, word || '', meaning || '', example || '', title || '', category || '', summary || '', content || '', sourceValue, now, JSON.stringify(tagList), JSON.stringify(extra));
    const row = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(id);
    res.status(201).json(formatKnowledgeVaultRow(row));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/knowledge-vault/notes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const userId = readKnowledgeVaultUserId(req);
    const existing = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(id);
    const denied = assertKnowledgeVaultOwner(existing, userId);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    const { word, meaning, example, title, category, summary, content, source, tags } = body;
    const fields = [];
    const values = [];
    if (word !== undefined) { fields.push('word = ?'); values.push(word); }
    if (meaning !== undefined) { fields.push('meaning = ?'); values.push(meaning); }
    if (example !== undefined) { fields.push('example = ?'); values.push(example); }
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (category !== undefined) { fields.push('category = ?'); values.push(category); }
    if (summary !== undefined) { fields.push('summary = ?'); values.push(summary); }
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }
    if (source !== undefined) { fields.push('source = ?'); values.push(source); }
    if (tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(parseKnowledgeVaultTags(tags))); }
    const extraPatch = collectKnowledgeVaultExtraPatch(body);
    if (Object.keys(extraPatch).length) {
      const nextExtra = buildKnowledgeVaultExtra(existing.extra_json, extraPatch, source !== undefined ? source : existing.source);
      fields.push('extra_json = ?');
      values.push(JSON.stringify(nextExtra));
    }
    if (!fields.length) return res.status(400).json({ error: 'no fields to update' });
    db.prepare(`
      INSERT INTO knowledge_vault_revisions (id, knowledge_id, user_id, snapshot_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      existing.id,
      existing.user_id,
      JSON.stringify(buildKnowledgeVaultRevisionSnapshot(existing)),
      Date.now()
    );
    values.push(id);
    const result = db.prepare(`UPDATE knowledge_vault SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    const row = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(id);
    res.json(formatKnowledgeVaultRow(row));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/knowledge-vault/notes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = readKnowledgeVaultUserId(req);
    const existing = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(id);
    const denied = assertKnowledgeVaultOwner(existing, userId);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    const result = db.prepare('DELETE FROM knowledge_vault WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/knowledge-vault/notes/:id/revisions', (req, res) => {
  try {
    const { id } = req.params;
    const userId = readKnowledgeVaultUserId(req);
    const existing = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(id);
    const denied = assertKnowledgeVaultOwner(existing, userId);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    const rows = db.prepare(
      'SELECT * FROM knowledge_vault_revisions WHERE knowledge_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(id, userId);
    res.json(rows.map(formatKnowledgeVaultRevision));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/knowledge-vault/linked', (req, res) => {
  try {
    const { userId, module } = req.query;
    if (!userId || !module) return res.status(400).json({ error: 'userId and module required' });
    if (!KNOWLEDGE_MODULES.includes(module)) return res.status(400).json({ error: 'invalid module' });
    const rows = db.prepare('SELECT * FROM knowledge_vault WHERE user_id = ?').all(userId);
    const filtered = sortLinkedKnowledgeRows(filterLinkedKnowledgeRows(rows, module));
    const tracesById = loadRecentKnowledgeVaultTracesMap(userId, filtered.map((row) => row.id), 20);
    res.json(filtered.map((row) => formatKnowledgeVaultRow(row, tracesById[row.id] || [])));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/knowledge-vault/notes/:id/sync', (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const userId = body.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!Array.isArray(body.moduleTargets)) return res.status(400).json({ error: 'moduleTargets array required' });
    const row = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    const moduleTargets = sanitizeModuleTargets(body.moduleTargets);
    const now = Date.now();
    const extraPatch = moduleTargets.length
      ? { moduleTargets, syncStatus: 'synced', confirmedAt: now }
      : { moduleTargets, syncStatus: 'approved' };
    const nextExtra = buildKnowledgeVaultExtra(row.extra_json, extraPatch, row.source);
    db.prepare('UPDATE knowledge_vault SET extra_json = ? WHERE id = ?').run(JSON.stringify(nextExtra), id);
    const updated = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(id);
    res.json(formatKnowledgeVaultRow(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/knowledge-vault/notes/:id/refine', (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const userId = body.userId || readKnowledgeVaultUserId(req);
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const row = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(id);
    const denied = assertKnowledgeVaultOwner(row, userId);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    const task = taskQueue.createTask('vault_refine', `知识点加深 · ${String(row.title || id).slice(0, 24)}`);
    const { markRefinePending, countTracesForNote, executeVaultRefine } = require('./services/vaultRefine');
    const usageCount = countTracesForNote(db, id);
    markRefinePending(db, row, usageCount);
    res.json({ success: true, taskId: task.id });
    setImmediate(() => {
      executeVaultRefine(db, {
        noteId: id,
        userId,
        taskId: task.id,
        apiKey: process.env.LISTEN_LLM_API_KEY || process.env.WRITE_GOVERNANCE_LLM_KEY || '',
      }, { taskQueue }).catch((err) => {
        console.error('[vaultRefine] manual refine failed:', err);
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/knowledge-vault/notes/:id/traces', (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const userId = body.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const row = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    const moduleName = body.module;
    if (!KNOWLEDGE_MODULES.includes(moduleName)) return res.status(400).json({ error: 'invalid module' });
    if (!TRACE_ACTIONS.includes(body.action)) return res.status(400).json({ error: 'invalid action' });
    const traceId = crypto.randomUUID();
    const usedAt = body.usedAt != null ? body.usedAt : (body.used_at != null ? body.used_at : Date.now());
    const taskId = body.taskId != null ? body.taskId : (body.task_id || '');
    const sessionId = body.sessionId != null ? body.sessionId : (body.session_id || '');
    const action = body.action;
    db.prepare(`
      INSERT INTO knowledge_vault_traces (id, knowledge_id, user_id, module, action, task_id, session_id, used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(traceId, id, userId, moduleName, action, taskId, sessionId, usedAt);
    const traces = db.prepare(
      'SELECT * FROM knowledge_vault_traces WHERE knowledge_id = ? AND user_id = ? ORDER BY used_at ASC'
    ).all(id, userId);
    res.status(201).json({
      success: true,
      id: traceId,
      traces: traces.map(formatKnowledgeVaultTrace)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/knowledge-vault/graph', (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const { loadAndPersistUserGraph } = require('./services/knowledgeGraph');
    const graph = loadAndPersistUserGraph(db, userId);
    res.json({ success: true, nodes: graph.nodes, edges: graph.edges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/knowledge-vault/extract-draft', async (req, res) => {
  try {
    const body = req.body || {};
    const { createListenUploadDraft } = require('./services/knowledgeDraftExtract');
    const result = await createListenUploadDraft(db, {
      userId: body.userId,
      fileName: body.fileName,
      mimeType: body.mimeType,
      base64Content: body.base64Content,
      sourceUrl: body.sourceUrl,
    });
    res.status(201).json({
      success: true,
      extracted: result.extracted,
      draft: result.row,
    });
  } catch (error) {
    const badRequest = error.message === 'userId required' || error.message === 'file or sourceUrl required';
    res.status(badRequest ? 400 : 500).json({ success: false, error: error.message });
  }
});

app.post('/api/knowledge-vault/import-mapped', (req, res) => {
  try {
    const body = req.body || {};
    const { importMappedDrafts } = require('./services/knowledgeMapImport');
    const result = importMappedDrafts(db, {
      userId: body.userId,
      source: body.source,
    });
    res.status(201).json({
      success: true,
      created: result.created,
      skipped: result.skipped,
      createdCount: result.createdCount,
      skippedCount: result.skippedCount,
    });
  } catch (error) {
    const badRequest = error.message === 'userId required'
      || error.message === 'source must be tactics, prototypes, or all';
    res.status(badRequest ? 400 : 500).json({ success: false, error: error.message });
  }
});

app.post('/api/insight/listen/pool/cron-run', async (req, res) => {
  try {
    const secret = process.env.DAILY_PACK_CRON_SECRET || '';
    if (secret && req.headers['x-cron-secret'] !== secret) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }
    const insightDailyCron = require('./services/insightDailyCron');
    const result = await insightDailyCron.runInsightDailyCronJob(db, {
      taskQueue: require('./services/taskQueue'),
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[InsightDaily Cron Manual]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/insight/listen/pool/backfill', (req, res) => {
  try {
    const body = req.body || {};
    const userId = body.userId || body.user || 'default-user';
    const category = body.category;
    if (!category) {
      return res.status(400).json({ success: false, error: 'category required' });
    }
    const taskQueue = require('./services/taskQueue');
    const insightDailyCron = require('./services/insightDailyCron');
    const task = taskQueue.createTask('insight_case_backfill', `洞察案例后台生成 · ${category}`);
    taskQueue.updateTask(task.id, {
      status: 'running',
      progress: 5,
      logs: ['后台生成中，请稍后在任务中心查看'],
    });
    res.json({ success: true, taskId: task.id, status: task.status });
    insightDailyCron.runBackfill(db, { userId, category }).then((result) => {
      const added = Array.isArray(result.added) ? result.added.length : 0;
      if (added === 0) {
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: '未能写入新案例',
          logs: ['补生成未入池，请稍后在任务中心查看'],
          result: { readyCount: result.ready?.length || 0, added: 0 },
        });
        return;
      }
      taskQueue.updateTask(task.id, {
        status: 'completed',
        progress: 100,
        logs: ['新案例已入当日池，可刷新查看'],
        result: { readyCount: result.ready.length, added },
      });
    }).catch((e) => {
      taskQueue.updateTask(task.id, { status: 'failed', error: e.message, logs: [e.message] });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/insight/listen/pool', (req, res) => {
  try {
    const insightDailyPoolService = require('./services/insightDailyPoolService');
    const userId = req.query.userId || req.query.user || 'default-user';
    const payload = insightDailyPoolService.getPool(db, {
      userId,
      category: req.query.category,
      packDate: req.query.packDate || req.query.date,
    });
    res.json(payload);
  } catch (error) {
    const badRequest = error.message === 'category required';
    res.status(badRequest ? 400 : 500).json({ success: false, error: error.message });
  }
});

app.post('/api/insight/listen/scenario', async (req, res) => {
  try {
    const body = req.body || {};
    const userId = body.userId || body.user || 'default-user';
    const { generateInsightScenario } = require('./services/insightScenarioGenerate');
    const payload = await generateInsightScenario({
      category: body.category,
      userId,
    });
    res.json(payload);
  } catch (error) {
    const badRequest = error.message === 'category required';
    res.status(badRequest ? 400 : 500).json({ success: false, error: error.message });
  }
});

app.post('/api/insight/listen/feedback', async (req, res) => {
  const {
    scenario_text,
    user_analysis,
    user_current_profile,
    userId = 'default-user',
  } = req.body || {};
  if (!scenario_text || !user_analysis) {
    return res.status(400).json({ success: false, error: '缺少场景或分析内容' });
  }

  const taskQueue = require('./services/taskQueue');
  const {
    loadInjectedKnowledgeSafe,
    attachKnowledgeContext,
    appendKnowledgeTracesSafe,
  } = require('./services/gameTheoryKnowledge');
  const {
    buildTimedInputs,
    parseListenFeedback,
    runDifyWorkflow,
  } = require('./services/insightSpeakProxy');

  const injected = loadInjectedKnowledgeSafe(db, userId, 'listen');
  const taskTitle = `听点评: ${String(scenario_text).trim().slice(0, 40) || '洞察场景'}`;
  const task = taskQueue.createTask('insight_listen', taskTitle);
  taskQueue.updateTask(task.id, {
    status: 'running',
    progress: 10,
    logs: [injected.reminder, '任务已提交，请在任务中心查看进度'],
  });
  res.json({
    success: true,
    taskId: task.id,
    status: task.status,
    knowledgeReminder: injected.reminder,
    knowledgeSynced: injected.syncedCount,
    knowledgeUsed: injected.usedCount,
  });

  (async () => {
    try {
      const apiKey = process.env.DIFY_INSIGHT_LISTEN_KEY || process.env.VITE_DIFY_INSIGHT_LISTEN_KEY;
      const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
      taskQueue.updateTask(task.id, { progress: 40, logs: ['正在连接听点评模型 (Dify)…'] });
      const data = await runDifyWorkflow({
        apiKey,
        baseUrl,
        userId,
        inputs: attachKnowledgeContext(buildTimedInputs({
          scenario_text,
          user_analysis,
        }, user_current_profile), injected.context),
      });
      const feedback = parseListenFeedback(data);
      if (!feedback) {
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: '听点评结果为空',
        });
        return;
      }
      appendKnowledgeTracesSafe(db, userId, injected.ids, {
        module: 'listen',
        action: 'analyzed',
        taskId: task.id,
      });
      afterKnowledgeInjected(userId, injected.ids);
      taskQueue.updateTask(task.id, {
        status: 'completed',
        progress: 100,
        logs: ['听点评已完成'],
        result: {
          feedback,
          scenarioText: String(scenario_text).slice(0, 4000),
          knowledgeReminder: injected.reminder,
        },
      });
    } catch (err) {
      console.error('听点评任务异常:', err);
      taskQueue.updateTask(task.id, {
        status: 'failed',
        error: err.message || String(err),
      });
    }
  })();
});

app.post('/api/speak/influence', async (req, res) => {
  const {
    training_mode,
    scenario,
    user_role,
    target_audience,
    user_input,
    user_current_profile,
    userId = 'default-user',
  } = req.body || {};
  if (!user_input || !scenario) {
    return res.status(400).json({ success: false, error: '缺少场景或表达内容' });
  }

  const taskQueue = require('./services/taskQueue');
  const {
    loadInjectedKnowledgeSafe,
    attachKnowledgeContext,
    appendKnowledgeTracesSafe,
  } = require('./services/gameTheoryKnowledge');
  const {
    buildTimedInputs,
    parseSpeakResult,
    runDifyWorkflow,
  } = require('./services/insightSpeakProxy');

  const injected = loadInjectedKnowledgeSafe(db, userId, 'speak');
  const taskTitle = `说评估: ${String(training_mode || scenario).trim().slice(0, 40) || '破局表达'}`;
  const task = taskQueue.createTask('speak', taskTitle);
  taskQueue.updateTask(task.id, {
    status: 'running',
    progress: 10,
    logs: [injected.reminder, '任务已提交，请在任务中心查看进度'],
  });
  res.json({
    success: true,
    taskId: task.id,
    status: task.status,
    knowledgeReminder: injected.reminder,
    knowledgeSynced: injected.syncedCount,
    knowledgeUsed: injected.usedCount,
  });

  (async () => {
    try {
      const apiKey = process.env.DIFY_SPEAK_INFLUENCE_KEY || process.env.VITE_DIFY_SPEAK_INFLUENCE_KEY;
      const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
      taskQueue.updateTask(task.id, { progress: 40, logs: ['正在连接说评估模型 (Dify)…'] });
      const data = await runDifyWorkflow({
        apiKey,
        baseUrl,
        userId,
        inputs: attachKnowledgeContext(buildTimedInputs({
          training_mode: training_mode || '',
          scenario,
          user_role: user_role || '',
          target_audience: target_audience || '',
          user_input,
        }, user_current_profile), injected.context),
      });
      const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
      let parsed;
      try {
        parsed = parseSpeakResult(rawResult);
      } catch (parseErr) {
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: '说评估结果格式异常，无法解析 JSON',
        });
        return;
      }
      appendKnowledgeTracesSafe(db, userId, injected.ids, {
        module: 'speak',
        action: 'analyzed',
        taskId: task.id,
      });
      afterKnowledgeInjected(userId, injected.ids);

      const { evaluateSpeakScenarioHardness } = require('./services/moduleHardnessQuality');
      const hardnessQuality = injected.isDeepened
        ? evaluateSpeakScenarioHardness(scenario, { injectedKnowledge: injected.context })
        : null;

      taskQueue.updateTask(task.id, {
        status: 'completed',
        progress: 100,
        logs: [
          '说评估已完成',
          ...(hardnessQuality && !hardnessQuality.ok ? [`[提示] 场景未完全达到加深硬度标准 (${hardnessQuality.reason})`] : []),
        ],
        result: {
          ...parsed,
          knowledgeReminder: injected.reminder,
          hardnessQuality,
        },
      });
    } catch (err) {
      console.error('说评估任务异常:', err);
      taskQueue.updateTask(task.id, {
        status: 'failed',
        error: err.message || String(err),
      });
    }
  })();
});

const critiqueChatRateLimiter = new Map();
function checkCritiqueChatRateLimit(key) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 10;
  const record = critiqueChatRateLimiter.get(key) || [];
  const valid = record.filter(ts => now - ts < windowMs);
  if (valid.length >= max) {
    return false;
  }
  valid.push(now);
  critiqueChatRateLimiter.set(key, valid);
  if (critiqueChatRateLimiter.size > 2000) {
    for (const [k, timestamps] of critiqueChatRateLimiter.entries()) {
      if (!timestamps.some(ts => now - ts < windowMs)) {
        critiqueChatRateLimiter.delete(k);
      }
    }
  }
  return true;
}

app.post('/api/speak/critique-chat', async (req, res) => {
  try {
    const {
      userId = 'default-user',
      query,
      evalSnapshot = {},
      messages = [],
      mock = false
    } = req.body || {};

    const trimmedQuery = String(query || '').trim();
    if (!trimmedQuery) {
      return res.status(400).json({ success: false, error: '追问内容不能为空' });
    }
    if (trimmedQuery.length > 500) {
      return res.status(400).json({ success: false, error: '追问内容不能超过500字' });
    }

    const rateKey = `${userId}:${req.ip || 'ip'}`;
    if (!checkCritiqueChatRateLimit(rateKey)) {
      return res.status(429).json({ success: false, error: '追问过于频繁，请稍候再试（限制 10 次/分钟）' });
    }

    const {
      buildCritiqueChatPrompt,
      generateMockCritiqueReply,
      runDifyCompletion,
      parseInsightGenAnswer
    } = require('./services/insightSpeakProxy');

    if (mock) {
      const mockReply = generateMockCritiqueReply({ query: trimmedQuery, evalSnapshot });
      return res.json({ success: true, reply: mockReply });
    }

    const apiKey = process.env.DIFY_SPEAK_CHAT_KEY
      || process.env.DIFY_SPEAK_COACH_KEY
      || process.env.DIFY_SPEAK_INFLUENCE_KEY
      || process.env.VITE_DIFY_SPEAK_INFLUENCE_KEY;
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    if (!apiKey) {
      const mockReply = generateMockCritiqueReply({ query: trimmedQuery, evalSnapshot });
      return res.json({ success: true, reply: mockReply });
    }

    const promptContext = buildCritiqueChatPrompt({
      query: trimmedQuery,
      evalSnapshot,
      messages: Array.isArray(messages) ? messages.slice(-8) : []
    });

    const completionPromise = runDifyCompletion({
      apiKey,
      baseUrl,
      userId,
      inputs: {
        eval_context: promptContext
      },
      query: `${promptContext}\n\n请针对以上评估上下文与学员追问进行针对性教练指导：`
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('追问请求超时（上限25秒）')), 25000);
    });

    const data = await Promise.race([completionPromise, timeoutPromise]);
    let answerText = parseInsightGenAnswer(data);
    if (!answerText) {
      answerText = String(data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.text ?? '').trim();
    }

    if (answerText.startsWith('{') && answerText.includes('"score"')) {
      console.warn('[critique-chat] Detected score JSON from Dify completion, falling back to mock reply');
      answerText = generateMockCritiqueReply({ query: trimmedQuery, evalSnapshot });
    }

    if (!answerText) {
      answerText = generateMockCritiqueReply({ query: trimmedQuery, evalSnapshot });
    }

    if (answerText.length > 800) {
      answerText = answerText.slice(0, 800) + '...';
    }

    return res.json({ success: true, reply: answerText });
  } catch (err) {
    console.error('追问接口异常:', err);
    return res.status(500).json({ success: false, error: err.message || '追问服务暂时不可用' });
  }
});

// 资料管理抽屉导出 Word (.docx)
app.post('/api/knowledge-vault/export-docx', async (req, res) => {
  try {
    const { title, sections } = req.body || {};
    const docx = require('docx');
    const { Document, Paragraph, TextRun, HeadingLevel, Packer, PageBreak } = docx;

    const docChildren = [];

    docChildren.push(new Paragraph({
      text: title || '资料管理总汇',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 400 }
    }));

    (Array.isArray(sections) ? sections : []).forEach((section, index) => {
      if (index > 0) {
        docChildren.push(new Paragraph({ children: [new PageBreak()] }));
      }
      docChildren.push(new Paragraph({
        children: [new TextRun({
          text: String(section?.heading || ''),
          bold: true,
          size: 28,
          color: 'FF5722'
        })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
      }));
      (Array.isArray(section?.items) ? section.items : []).forEach((item) => {
        docChildren.push(new Paragraph({
          text: String(item || ''),
          spacing: { after: 100, before: 50 },
          indent: { left: 360 }
        }));
      });
    });

    docChildren.push(new Paragraph({
      children: [new TextRun({
        text: `生成时间: ${new Date().toLocaleString('zh-CN')}`,
        size: 20,
        color: '888888'
      })],
      spacing: { before: 200 }
    }));

    const doc = new Document({ sections: [{ children: docChildren }] });
    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=knowledge-vault.docx');
    res.send(buffer);
  } catch (error) {
    console.error('[KnowledgeVault DOCX Export] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PERF：驭人术手段库后台导出 CSV
app.post('/api/game-theory/tactics/export-background', async (req, res) => {
  try {
    const taskQueue = require('./services/taskQueue');
    const tactics = Array.isArray(req.body?.tactics) ? req.body.tactics : [];
    const task = taskQueue.createTask('tactics_export', `导出驭人术手段库 (${tactics.length} 条)`);
    res.json({ success: true, taskId: task.id, status: task.status });
    setImmediate(() => {
      try {
        taskQueue.updateTask(task.id, {
          status: 'running',
          progress: 20,
          logs: ['正在生成手段库 CSV…'],
        });
        const escape = (value) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
        const rows = [
          ['手段名称', '分类', '描述', '来源'],
          ...tactics.map((t) => [
            t?.name,
            t?.category === 'downward' ? '上级对下' : '以下克上',
            t?.description,
            t?.source_file || (t?.is_custom ? '手动录入' : '系统内置'),
          ]),
        ];
        const content = '\uFEFF' + rows.map((row) => row.map(escape).join(',')).join('\r\n');
        const name = `驭人术手段库_${new Date().toISOString().slice(0, 10)}.csv`;
        taskQueue.updateTask(task.id, {
          status: 'completed',
          progress: 100,
          logs: ['CSV 已生成，可在任务中心下载'],
          result: {
            name,
            content,
            mimeType: 'text/csv;charset=utf-8',
          },
        });
      } catch (err) {
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: err?.message || String(err),
        });
      }
    });
  } catch (error) {
    console.error('[Tactics Export Background] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PERF：资料抽屉后台导出 CSV / DOCX
app.post('/api/knowledge-vault/export-background', async (req, res) => {
  try {
    const taskQueue = require('./services/taskQueue');
    const format = String(req.body?.format || 'csv').toLowerCase() === 'docx' ? 'docx' : 'csv';
    const title = String(req.body?.title || '资料管理总汇');
    const taskName = format === 'docx' ? `导出资料抽屉 Word: ${title}` : `导出资料抽屉 CSV: ${title}`;
    const task = taskQueue.createTask('vault_export', taskName);
    res.json({ success: true, taskId: task.id, status: task.status });
    setImmediate(async () => {
      try {
        taskQueue.updateTask(task.id, {
          status: 'running',
          progress: 15,
          logs: [`正在生成 ${format.toUpperCase()}…`],
        });
        if (format === 'csv') {
          const csvContent = String(req.body?.csvContent || '');
          const name = String(req.body?.filename || '资料管理总汇.csv');
          taskQueue.updateTask(task.id, {
            status: 'completed',
            progress: 100,
            logs: ['CSV 已生成，可在任务中心下载'],
            result: {
              name,
              content: csvContent.startsWith('\uFEFF') ? csvContent : `\uFEFF${csvContent}`,
              mimeType: 'text/csv;charset=utf-8',
            },
          });
          return;
        }
        const docx = require('docx');
        const { Document, Paragraph, TextRun, HeadingLevel, Packer, PageBreak } = docx;
        const sections = Array.isArray(req.body?.sections) ? req.body.sections : [];
        const docChildren = [];
        docChildren.push(new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 400 },
        }));
        sections.forEach((section, index) => {
          if (index > 0) {
            docChildren.push(new Paragraph({ children: [new PageBreak()] }));
          }
          docChildren.push(new Paragraph({
            children: [new TextRun({
              text: String(section?.heading || ''),
              bold: true,
              size: 28,
              color: 'FF5722',
            })],
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }));
          (Array.isArray(section?.items) ? section.items : []).forEach((item) => {
            docChildren.push(new Paragraph({
              text: String(item || ''),
              spacing: { after: 100, before: 50 },
              indent: { left: 360 },
            }));
          });
        });
        docChildren.push(new Paragraph({
          children: [new TextRun({
            text: `生成时间: ${new Date().toLocaleString('zh-CN')}`,
            size: 20,
            color: '888888',
          })],
          spacing: { before: 200 },
        }));
        const doc = new Document({ sections: [{ children: docChildren }] });
        const buffer = await Packer.toBuffer(doc);
        const name = String(req.body?.filename || '资料管理总汇.docx');
        taskQueue.updateTask(task.id, {
          status: 'completed',
          progress: 100,
          logs: ['Word 已生成，可在任务中心下载'],
          result: {
            name,
            content: Buffer.from(buffer).toString('base64'),
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            encoding: 'base64',
          },
        });
      } catch (err) {
        taskQueue.updateTask(task.id, {
          status: 'failed',
          error: err?.message || String(err),
        });
      }
    });
  } catch (error) {
    console.error('[Vault Export Background] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ==========================================
// 口语沙盘：场景启动与多轮对话（English_Oral_Sandbox Chatflow）
// 复用 DIFY_ORAL_API_KEY，与 /api/english/oral/chat 共享同一 Chatflow
// 前端 callOralSandbox() 传 { inputs, conversationId, userId }
// 返回 { reply: OralSandboxReply, conversationId }
// ==========================================
app.post('/api/english/oral-sandbox', async (req, res) => {
  const {
    inputs = {},
    conversationId = null,
    userId = 'default-user',
    stream = false,
  } = req.body || {};

  if (!inputs || typeof inputs !== 'object' || Object.keys(inputs).length === 0) {
    return res.status(400).json({ error: '缺少场景输入参数 (inputs)' });
  }

  const isStream = Boolean(stream === true || stream === 'true');
  const apiKey = process.env.DIFY_ORAL_API_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL
    || process.env.VITE_DIFY_API_BASE_URL
    || 'https://dify.234124123.xyz/v1';

  if (!apiKey) {
    console.warn('[口语沙盘] DIFY_ORAL_API_KEY 未配置');
    return res.status(500).json({ error: '口语沙盘服务未配置 API Key' });
  }

  // 构造首轮启动 query：当无 conversationId 时，用场景描述作为首轮 query
  const isFirstTurn = !conversationId;
  const query = isFirstTurn
    ? `场景启动：${inputs.scene_type || '通用商务场景'} | 角色：${inputs.roles || '未指定'} | 文化背景：${inputs.cultural_context || '通用'}${inputs.user_reply ? ' | 用户回应：' + inputs.user_reply : ''}`
    : (inputs.user_reply || '继续推演');

  console.log(`[口语沙盘] 正在启动场景推演 (${isFirstTurn ? '首轮启动' : '多轮对话'} | ${isStream ? '流式' : '标准'})...`);

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
        response_mode: isStream ? 'streaming' : 'blocking',
        user: userId,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const { mapOralUpstreamError } = require('./services/oralChatUpstreamError');
      const mapped = mapOralUpstreamError(response.status, errorData);
      console.warn('[口语沙盘] 远程推演服务响应异常 (' + response.status + ' → ' + mapped.status + '):', mapped.body);
      return res.status(mapped.status).json(mapped.body);
    }

    if (isStream && response.body) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = typeof response.body.getReader === 'function' ? response.body.getReader() : null;
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
            if (typeof res.flush === 'function') res.flush();
          }
        } finally {
          reader.releaseLock?.();
        }
        console.log('[口语沙盘] 流式输出完成');
        return res.end();
      } else if (typeof response.body.pipe === 'function') {
        response.body.pipe(res);
        return;
      }
      return res.end();
    }

    const data = await response.json().catch(() => ({}));
    console.log('[口语沙盘] 推演完成 (标准报文)');

    // 从 Dify Chatflow 响应中提取结构化 reply
    const rawAnswer = data?.answer || '';
    let reply;
    try {
      // 尝试解析 JSON 格式的 answer
      const cleanAnswer = rawAnswer.replace(/```json/g, '').replace(/```/g, '').trim();
      reply = JSON.parse(cleanAnswer);
    } catch {
      // 解析失败时构造最小 reply
      reply = {
        current_speaker: '系统',
        dialogue: rawAnswer || '场景推演已启动，请继续对话',
        hidden_intent: '',
        has_flaw: false,
        flaw_analysis: '',
        evaluation: '',
      };
    }

    return res.json({
      reply,
      conversationId: data?.conversation_id || conversationId || '',
    });
  } catch (err) {
    console.warn('[口语沙盘] 代理通道异常: ' + err.message);
    if (isStream && res.headersSent) {
      res.write(`data: ${JSON.stringify({ event: 'error', message: err.message || '推演中断' })}\n\n`);
      return res.end();
    }
    return res.status(500).json({ fallback: true, message: err.message || '口语沙盘代理失败' });
  }
});

// ==========================================
// 洞察听力：动态场景生成（Insight Listen Engine Workflow）
// 前端 fetchDynamicInsightScenario() 传 { category, userId }
// 返回 InsightScenarioResult 结构


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

// ==========================================
// 资料管理抽屉 表
// ==========================================
db.prepare(`
  CREATE TABLE IF NOT EXISTS knowledge_vault (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    word TEXT,
    meaning TEXT,
    example TEXT,
    title TEXT,
    category TEXT,
    summary TEXT,
    content TEXT,
    source TEXT,
    added_at INTEGER
  )
`).run();

try {
  db.prepare("ALTER TABLE knowledge_vault ADD COLUMN tags TEXT DEFAULT '[]'").run();
} catch (err) {}
try {
  db.prepare("ALTER TABLE knowledge_vault ADD COLUMN extra_json TEXT DEFAULT '{}'").run();
} catch (err) {}

db.prepare(`
  CREATE TABLE IF NOT EXISTS knowledge_vault_revisions (
    id TEXT PRIMARY KEY,
    knowledge_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS knowledge_vault_traces (
    id TEXT PRIMARY KEY,
    knowledge_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    task_id TEXT,
    session_id TEXT,
    used_at INTEGER
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    title TEXT,
    extra_json TEXT,
    created_at INTEGER
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    rel TEXT NOT NULL,
    created_at INTEGER
  )
`).run();

// 索引
try {
  db.prepare('CREATE INDEX IF NOT EXISTS idx_kv_user_type ON knowledge_vault(user_id, type)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_kv_added_at ON knowledge_vault(added_at)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_kv_revisions_knowledge ON knowledge_vault_revisions(knowledge_id, created_at)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_kv_traces_knowledge ON knowledge_vault_traces(knowledge_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_kv_traces_user_module ON knowledge_vault_traces(user_id, module)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_kg_nodes_user ON knowledge_graph_nodes(user_id, kind)').run();
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_kg_nodes_user_ref ON knowledge_graph_nodes(user_id, kind, ref_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_kg_edges_user ON knowledge_graph_edges(user_id)').run();
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_kg_edges_unique ON knowledge_graph_edges(user_id, from_id, to_id, rel)').run();
} catch (err) {
  console.warn('Migration: knowledge_vault indexes skipped:', err?.message || err);
}



if (require.main === module) {
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
  require('./services/insightDailyCron').scheduleInsightDailyCron(db, {
    taskQueue: require('./services/taskQueue'),
  });
});
}

