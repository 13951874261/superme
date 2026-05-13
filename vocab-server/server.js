/**
 * Super-Agent 生词本 API 服务
 * 技术栈：Express + better-sqlite3
 * 算法：SM-2（艾宾浩斯间隔重复）
 * 端口：3001
 */

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const { runDailyFeeder } = require('./cron/dailyFeeder');

const app = express();
const PORT = 3001;
const DB_PATH = path.join('/var/www/super-agent', 'vocab.db');
const AUDIO_DIR = process.env.LISTENING_AUDIO_DIR || path.join('/var/www/super-agent', 'public', 'audio', 'listening');
const AUDIO_PUBLIC_PREFIX = process.env.LISTENING_AUDIO_PUBLIC_PREFIX || '/audio/listening';
const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://dify.234124123.xyz';
const ENGLISH_PRO_SCENARIOS_DATASET_ID = 'f36f5681-86ed-483d-abc4-0f2376ec20e8';
const DIFY_KB_DATASET_ID = ENGLISH_PRO_SCENARIOS_DATASET_ID;
const DIFY_KB_API_KEY = process.env.DIFY_KB_API_KEY || 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
const DIFY_CHAT_API_KEY = process.env.DIFY_CHAT_API_KEY || '';
const DIFY_DICT_API_KEY = process.env.DIFY_DICT_API_KEY || '';
const DIFY_MATERIAL_SUMMARY_API_KEY = process.env.DIFY_MATERIAL_SUMMARY_API_KEY || '';
const DIFY_ENGLISH_MASTERY_API_KEY = process.env.DIFY_ENGLISH_MASTERY_API_KEY || 'app-cArGQg7bAnePU0ts63FoHrAG';
const CRON_DAILY_FEEDER = process.env.CRON_DAILY_FEEDER || '0 0 * * *';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ── 初始化数据库 ──────────────────────────────────────────────
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    nickname        TEXT,
    created_at      INTEGER
  );

  CREATE TABLE IF NOT EXISTS vocabulary (
    id              TEXT PRIMARY KEY,
    word            TEXT NOT NULL,
    user_id         TEXT    DEFAULT 'default-user',
    dict_type       TEXT,
    category        TEXT    DEFAULT 'business', /* 新增：business(政商务) 或 general(全场景) */
    payload         TEXT,
    added_at        INTEGER,
    repetitions     INTEGER DEFAULT 0,
    ease_factor     REAL    DEFAULT 2.5,
    interval_days   INTEGER DEFAULT 1,
    next_review_date INTEGER,
    last_review_date INTEGER,
    review_history  TEXT    DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS training_sessions (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL,
    training_date     TEXT NOT NULL,
    total_minutes     INTEGER DEFAULT 60,
    listen_minutes    INTEGER DEFAULT 30,
    logic_minutes     INTEGER DEFAULT 30,
    status            TEXT    DEFAULT 'in_progress',
    created_at        INTEGER,
    updated_at        INTEGER
  );

  CREATE TABLE IF NOT EXISTS training_attempts (
    id                   TEXT PRIMARY KEY,
    session_id           TEXT NOT NULL,
    user_id              TEXT NOT NULL,
    module_type          TEXT,
    scene_type           TEXT,
    case_text            TEXT,
    role_judgement       TEXT,
    ability_judgement    TEXT,
    intent_judgement     TEXT,
    fallacy_choice       TEXT,
    counter_question     TEXT,
    logic_point          TEXT,
    user_answer_json     TEXT    DEFAULT '{}',
    duration_seconds     INTEGER DEFAULT 0,
    score                REAL,
    created_at           INTEGER
  );

  CREATE TABLE IF NOT EXISTS ai_feedback (
    id                    TEXT PRIMARY KEY,
    attempt_id            TEXT NOT NULL,
    user_id               TEXT NOT NULL,
    decomposition_json    TEXT DEFAULT '{}',
    logic_analysis_json   TEXT DEFAULT '{}',
    strengths             TEXT,
    weaknesses            TEXT,
    next_focus            TEXT,
    score_1_10            REAL,
    raw_response          TEXT,
    created_at            INTEGER
  );

  CREATE TABLE IF NOT EXISTS daily_reviews (
    id                     TEXT PRIMARY KEY,
    session_id             TEXT NOT NULL,
    user_id                TEXT NOT NULL,
    training_date          TEXT NOT NULL,
    summary                TEXT,
    accuracy_by_tag_json   TEXT DEFAULT '{}',
    next_day_focus         TEXT,
    efficiency_score       REAL,
    created_at             INTEGER,
    updated_at             INTEGER
  );

  CREATE TABLE IF NOT EXISTS material_ingest_jobs (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    source_type           TEXT,
    source_name           TEXT,
    source_text           TEXT,
    status                TEXT DEFAULT 'pending',
    topic                 TEXT,
    kb_dataset_id         TEXT,
    summary_record_id     TEXT,
    summary_json          TEXT DEFAULT '{}',
    error_message         TEXT,
    archived              INTEGER DEFAULT 0,
    created_at            INTEGER,
    updated_at            INTEGER
  );

  CREATE TABLE IF NOT EXISTS knowledge_nodes (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    module_name           TEXT,
    topic                 TEXT,
    node_name             TEXT,
    mastery_level         INTEGER DEFAULT 0,
    review_due_at         INTEGER,
    last_practiced_at     INTEGER,
    source_material_id    TEXT,
    source_document_id    TEXT,
    source_dataset_id     TEXT,
    source_summary_json   TEXT DEFAULT '{}',
    extra_json            TEXT DEFAULT '{}',
    created_at            INTEGER,
    updated_at            INTEGER
  );

  CREATE TABLE IF NOT EXISTS dify_call_logs (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    workflow_name         TEXT,
    request_hash          TEXT,
    status                TEXT,
    latency_ms            INTEGER,
    error_message         TEXT,
    created_at            INTEGER
  );

  CREATE TABLE IF NOT EXISTS listening_materials (
    id                    TEXT PRIMARY KEY,
    title                 TEXT NOT NULL,
    content_text          TEXT NOT NULL,
    audio_url             TEXT DEFAULT '',
    difficulty            TEXT NOT NULL CHECK(difficulty IN ('A2', 'B1', 'B2', 'C1')),
    category              TEXT DEFAULT '',
    duration              INTEGER DEFAULT 0,
    has_subtext           INTEGER DEFAULT 0,
    subtext_analysis      TEXT DEFAULT '',
    source_type           TEXT DEFAULT 'tts',
    source_topic          TEXT DEFAULT '',
    source_url            TEXT DEFAULT '',
    source_json           TEXT DEFAULT '{}',
    created_at            INTEGER,
    updated_at            INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_next_review ON vocabulary(next_review_date);
  CREATE INDEX IF NOT EXISTS idx_word ON vocabulary(word);
  CREATE INDEX IF NOT EXISTS idx_vocab_user ON vocabulary(user_id);
  CREATE INDEX IF NOT EXISTS idx_session_user_date ON training_sessions(user_id, training_date);
  CREATE INDEX IF NOT EXISTS idx_attempt_session ON training_attempts(session_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_attempt ON ai_feedback(attempt_id);
  CREATE INDEX IF NOT EXISTS idx_daily_review_session ON daily_reviews(session_id);
  CREATE INDEX IF NOT EXISTS idx_material_user_status ON material_ingest_jobs(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_knowledge_user_topic ON knowledge_nodes(user_id, topic);
  CREATE INDEX IF NOT EXISTS idx_knowledge_source_doc ON knowledge_nodes(source_document_id);
  CREATE INDEX IF NOT EXISTS idx_dify_logs_user_time ON dify_call_logs(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_listening_difficulty ON listening_materials(difficulty);
  CREATE INDEX IF NOT EXISTS idx_listening_category ON listening_materials(category);
  CREATE INDEX IF NOT EXISTS idx_listening_created_at ON listening_materials(created_at);
`);

// 补丁：如果旧表没有 category 列，自动添加 (静默执行)
try {
  db.exec(`ALTER TABLE vocabulary ADD COLUMN category TEXT DEFAULT 'business';`);
} catch (e) {}

try {
  db.exec(`ALTER TABLE training_sessions ADD COLUMN extra_json TEXT DEFAULT '{}';`);
} catch (e) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS theme_focus (
      user_id     TEXT PRIMARY KEY,
      theme       TEXT NOT NULL,
      difficulty  TEXT DEFAULT 'B2',
      updated_at  INTEGER
    );
  `);
} catch (e) {}

try {
  db.prepare(
    `INSERT OR IGNORE INTO theme_focus (user_id, theme, difficulty, updated_at) VALUES (?, ?, ?, ?)`
  ).run('default-user', '商务谈判：让步与施压', 'B2', Date.now());
} catch (e) {}

function mergeSessionExtraJson(existingStr, patch) {
  let base = {};
  try {
    base = JSON.parse(existingStr || '{}');
    if (typeof base !== 'object' || base === null) base = {};
  } catch {
    base = {};
  }
  const p = patch && typeof patch === 'object' ? patch : {};
  const next = { ...base, ...p };
  if (p.englishFoundation && typeof p.englishFoundation === 'object') {
    next.englishFoundation = {
      ...(typeof base.englishFoundation === 'object' && base.englishFoundation ? base.englishFoundation : {}),
      ...p.englishFoundation,
    };
  }
  return JSON.stringify(next);
}

db.prepare(
  `INSERT OR IGNORE INTO users (id, nickname, created_at) VALUES (?, ?, ?)`
).run('default-user', '默认用户', Date.now());

// ── 艾宾浩斯定点算法 ──────────────────────────────────────────────
// 经典节点间隔 (单位: 毫秒)
const EBBINGHAUS_INTERVALS = [
  5 * 60 * 1000,           // 0 -> 1: 5分钟
  30 * 60 * 1000,          // 1 -> 2: 30分钟
  12 * 60 * 60 * 1000,     // 2 -> 3: 12小时
  24 * 60 * 60 * 1000,     // 3 -> 4: 1天
  2 * 24 * 60 * 60 * 1000, // 4 -> 5: 2天
  4 * 24 * 60 * 60 * 1000, // 5 -> 6: 4天
  7 * 24 * 60 * 60 * 1000, // 6 -> 7: 7天
  15 * 24 * 60 * 60 * 1000,// 7 -> 8: 15天
  30 * 24 * 60 * 60 * 1000 // 8+: 30天
];

// quality: 0=完全忘记 2=朦胧记得 4=记住了 5=非常熟练
function calculateEbbinghaus(repetitions, quality) {
  let newRepetitions = repetitions;

  if (quality === 0) {
    // 打回原形
    newRepetitions = 0;
  } else if (quality === 2) {
    // 留级，不推进也不后退
    // newRepetitions 保持不变
  } else if (quality === 5) {
    // 跳级（如果还没到最后阶段）
    newRepetitions = Math.min(repetitions + 2, EBBINGHAUS_INTERVALS.length);
  } else {
    // 正常推进
    newRepetitions = Math.min(repetitions + 1, EBBINGHAUS_INTERVALS.length);
  }

  // 计算下一次间隔时间
  const intervalMs = newRepetitions >= EBBINGHAUS_INTERVALS.length 
    ? EBBINGHAUS_INTERVALS[EBBINGHAUS_INTERVALS.length - 1] 
    : EBBINGHAUS_INTERVALS[newRepetitions];

  const nextDate = Date.now() + intervalMs;

  return {
    repetitions: newRepetitions,
    intervalMs: intervalMs,
    nextDate: nextDate,
  };
}

// ── 工具函数 ──────────────────────────────────────────────────
function parseWord(row) {
  if (!row) return null;
  return {
    ...row,
    payload: row.payload ? JSON.parse(row.payload) : null,
    review_history: row.review_history ? JSON.parse(row.review_history) : [],
  };
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extractSummaryFields(summaryJson) {
  const parseMaybeJson = (value) => {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    if (!text) return value;
    if (!/^[\[{]/.test(text)) return value;
    try {
      return JSON.parse(text);
    } catch {
      return value;
    }
  };

  const rawValue = parseMaybeJson(summaryJson);
  const raw = rawValue && typeof rawValue === 'object' ? rawValue : {};
  const pickString = (...keys) => keys.map((k) => parseMaybeJson(raw[k])).find((v) => typeof v === 'string' && String(v).trim()) || '';
  const pickArray = (...keys) => keys.map((k) => parseMaybeJson(raw[k])).find(Array.isArray) || [];
  const normalizeItem = (value) => String(value || '').replace(/^[\s"']+|[\s"',，]+$/g, '').trim();
  const coerceTextArray = (items) => items.map(normalizeItem).filter(Boolean);

  return {
    overview: pickString('overview', 'summary', 'abstract', 'result', 'text'),
    keyPoints: coerceTextArray(pickArray('key_points', 'points', 'highlights')),
    mistakes: coerceTextArray(pickArray('common_mistakes', 'mistakes', 'pitfalls')),
    actions: coerceTextArray(pickArray('suggested_actions', 'actions', 'next_steps')),
    title: pickString('title', 'doc_title', 'name') || 'Dify 消化结果',
  };
}

function upsertKnowledgeNodeFromMaterial(job, summaryJson, difyMeta = {}) {
  if (!job || !job.id) return null;
  const structured = extractSummaryFields(summaryJson || job.summary_json || {});
  const moduleName = job.topic || 'material';
  const nodeName = structured.title || job.source_name || '未命名知识点';
  const existed = db.prepare(
    `SELECT * FROM knowledge_nodes WHERE user_id = ? AND module_name = ? AND node_name = ?`
  ).get(job.user_id, moduleName, nodeName);

  const ts = nowTs();
  const payload = {
    title: structured.title,
    overview: structured.overview,
    keyPoints: structured.keyPoints,
    mistakes: structured.mistakes,
    actions: structured.actions,
    source_name: job.source_name,
    topic: job.topic,
    training_history: existed ? parseJson(existed.extra_json, {}).training_history || [] : [],
  };

  if (existed) {
    db.prepare(
      `UPDATE knowledge_nodes
       SET topic = ?, mastery_level = ?, source_material_id = ?, source_document_id = ?, source_dataset_id = ?, source_summary_json = ?, extra_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      job.topic || existed.topic,
      Math.max(Number(existed.mastery_level || 0), String(job.status) === 'processed' ? 1 : 0),
      job.id,
      job.dify_document_id || existed.source_document_id,
      job.kb_dataset_id || existed.source_dataset_id,
      JSON.stringify(payload),
      JSON.stringify({
        source_name: job.source_name,
        source_status: job.status,
        dify_display_status: job.dify_display_status,
        dify_document_status: job.dify_document_status,
        dify_download_url: job.dify_download_url,
        dify_segment_count: Number(difyMeta.segment_count ?? job.dify_segment_count ?? 0),
        dify_word_count: Number(difyMeta.word_count ?? job.dify_word_count ?? 0),
        dify_doc_language: String(difyMeta.doc_language ?? job.dify_doc_language ?? ''),
        dify_batch_id: String(job.dify_batch_id || ''),
        dify_document_name: String(difyMeta.name ?? job.source_name ?? ''),
        dify_data_source_type: String(difyMeta.data_source_type || ''),
        dify_created_by: String(difyMeta.created_by || ''),
        dify_created_at: Number(difyMeta.created_at || 0),
        error_message: String(job.error_message || ''),
        training_history: payload.training_history,
      }),
      ts,
      existed.id,
    );
    return existed.id;
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO knowledge_nodes
      (id, user_id, module_name, topic, node_name, mastery_level, review_due_at, last_practiced_at, source_material_id, source_document_id, source_dataset_id, source_summary_json, extra_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    job.user_id,
    moduleName,
    job.topic || '',
    nodeName,
    String(job.status) === 'processed' ? 1 : 0,
    null,
    null,
    job.id,
    job.dify_document_id || '',
    job.kb_dataset_id || '',
    JSON.stringify(payload),
    JSON.stringify({
      source_name: job.source_name,
      source_status: job.status,
      dify_display_status: job.dify_display_status,
      dify_document_status: job.dify_document_status,
      dify_download_url: job.dify_download_url,
      dify_segment_count: Number(difyMeta.segment_count ?? job.dify_segment_count ?? 0),
      dify_word_count: Number(difyMeta.word_count ?? job.dify_word_count ?? 0),
      dify_doc_language: String(difyMeta.doc_language ?? job.dify_doc_language ?? ''),
      dify_batch_id: String(job.dify_batch_id || ''),
      dify_document_name: String(difyMeta.name ?? job.source_name ?? ''),
      dify_data_source_type: String(difyMeta.data_source_type || ''),
      dify_created_by: String(difyMeta.created_by || ''),
      dify_created_at: Number(difyMeta.created_at || 0),
      error_message: String(job.error_message || ''),
      training_history: [],
    }),
    ts,
    ts,
  );
  return id;
}

function appendKnowledgeTrainingHistory({ knowledgeNodeId, attemptId, score, sceneType, caseText, createdAt }) {
  const row = db.prepare(`SELECT * FROM knowledge_nodes WHERE id = ?`).get(knowledgeNodeId);
  if (!row) return null;
  const extra = parseJson(row.extra_json, {});
  const history = Array.isArray(extra.training_history) ? extra.training_history : [];
  history.unshift({ attemptId, score, sceneType, caseText, createdAt });
  const trimmed = history.slice(0, 10);
  db.prepare(
    `UPDATE knowledge_nodes SET extra_json = ?, updated_at = ? WHERE id = ?`
  ).run(JSON.stringify({ ...extra, training_history: trimmed }), createdAt || nowTs(), knowledgeNodeId);
  return trimmed;
}

function nowTs() {
  return Date.now();
}

function estimateWordCount(text) {
  const raw = String(text || '').trim();
  if (!raw) return 0;
  const hasCjk = /[\u4e00-\u9fff]/.test(raw);
  if (hasCjk) return Math.max(1, Math.ceil(raw.replace(/\s+/g, '').length / 2));
  return raw.split(/\s+/).filter(Boolean).length;
}

function detectDirection(query) {
  const hasChinese = /[\u4e00-\u9fa5]/.test(query || '');
  return hasChinese ? '中文 → 英文' : '英文 → 中文';
}

const CEFR_LEVELS = new Set(['A2', 'B1', 'B2', 'C1']);

function normalizeListeningMaterial(input = {}) {
  const source = input.source && typeof input.source === 'object' ? input.source : {};
  const title = String(input.title || '').trim();
  const contentText = String(input.content_text || input.contentText || '').trim();
  const difficulty = String(input.difficulty || '').trim().toUpperCase();

  if (!title) throw new Error('缺少 title 字段');
  if (!contentText) throw new Error('缺少 content_text 字段');
  if (!CEFR_LEVELS.has(difficulty)) throw new Error('difficulty 必须为 A2/B1/B2/C1');

  return {
    title,
    contentText,
    audioUrl: String(input.audio_url || input.audioUrl || '').trim(),
    difficulty,
    category: String(input.category || '').trim(),
    duration: Number(input.duration || Math.max(30, Math.round(contentText.split(/\s+/).filter(Boolean).length / 2.4))),
    hasSubtext: input.has_subtext || input.hasSubtext ? 1 : 0,
    subtextAnalysis: String(input.subtext_analysis || input.subtextAnalysis || '').trim(),
    sourceType: String(source.type || input.source_type || input.sourceType || 'tts').trim(),
    sourceTopic: String(source.topic || input.source_topic || input.sourceTopic || '').trim(),
    sourceUrl: String(source.url || input.source_url || input.sourceUrl || '').trim(),
    sourceJson: JSON.stringify(source || {}),
  };
}

function parseListeningMaterial(row) {
  if (!row) return null;
  return {
    ...row,
    has_subtext: Boolean(row.has_subtext),
    source: parseJson(row.source_json, {}),
  };
}

function buildListeningAudioUrl(fileName) {
  return `${AUDIO_PUBLIC_PREFIX.replace(/\/$/, '')}/${fileName}`;
}

function ensureAudioDir() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

async function downloadAudioToListeningDir(sourceUrl, fileName) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`音频抓取失败：HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  ensureAudioDir();
  fs.writeFileSync(path.join(AUDIO_DIR, fileName), Buffer.from(arrayBuffer));
  return buildListeningAudioUrl(fileName);
}

// ── API 路由 ──────────────────────────────────────────────────

// 健康检查
app.get('/api/vocab/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 获取统计（总数 + 今日待复习）
app.get('/api/vocab/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM vocabulary').get();
  const dueToday = db.prepare(
    'SELECT COUNT(*) as count FROM vocabulary WHERE next_review_date <= ?'
  ).get(Date.now());
  res.json({ total: total.count, dueToday: dueToday.count });
});

// 获取所有词条
app.get('/api/vocab/list', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM vocabulary ORDER BY added_at DESC')
    .all();
  res.json(rows.map(parseWord));
});

// 获取今日待复习词条
app.get('/api/vocab/review', (req, res) => {
  const rows = db
    .prepare(
      'SELECT * FROM vocabulary WHERE next_review_date <= ? ORDER BY next_review_date ASC'
    )
    .all(Date.now());
  res.json(rows.map(parseWord));
});

// 收录词条
app.post('/api/vocab/add', (req, res) => {
  const { word, dictType, category = 'business', payload, userId = 'default-user' } = req.body;
  if (!word) return res.status(400).json({ error: '缺少 word 字段' });

  const existing = db.prepare('SELECT id FROM vocabulary WHERE word = ? AND user_id = ?').get(word, userId);
  if (existing) {
    return res.json({ success: false, message: '该词条已在生词本中', id: existing.id });
  }

  const id = uuidv4();
  const now = Date.now();
  const nextReview = now + 5 * 60 * 1000;

  db.prepare(
    `INSERT INTO vocabulary
      (id, word, user_id, dict_type, category, payload, added_at, repetitions, ease_factor, interval_days, next_review_date, last_review_date, review_history)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 2.5, 0, ?, null, '[]')`
  ).run(id, word, userId, dictType || '', category, JSON.stringify(payload || {}), now, nextReview);

  res.json({ success: true, id, message: '收录成功，5 分钟后开始强化复习' });
});

// 批量收录词条
app.post('/api/vocab/batch-add', (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: '请求体必须是词条数组' });
  }

  const now = Date.now();
  const nextReview = now + 5 * 60 * 1000;
  const selectExisting = db.prepare('SELECT id FROM vocabulary WHERE word = ? AND user_id = ?');
  const insertWord = db.prepare(
    `INSERT INTO vocabulary
      (id, word, user_id, dict_type, category, payload, added_at, repetitions, ease_factor, interval_days, next_review_date, last_review_date, review_history)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 2.5, 0, ?, null, '[]')`
  );

  const results = [];
  let inserted = 0;
  let duplicated = 0;
  let failed = 0;

  const addMany = db.transaction((items) => {
    items.forEach((item, index) => {
      try {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          failed += 1;
          results.push({ index, success: false, status: 'failed', error: '词条必须是对象' });
          return;
        }

        const { word, dictType, category = 'business', payload, userId = 'default-user' } = item;
        const normalizedWord = typeof word === 'string' ? word.trim() : '';

        if (!normalizedWord) {
          failed += 1;
          results.push({ index, success: false, status: 'failed', error: '缺少 word 字段' });
          return;
        }

        const existing = selectExisting.get(normalizedWord, userId || 'default-user');
        if (existing) {
          duplicated += 1;
          results.push({
            index,
            success: false,
            status: 'duplicated',
            word: normalizedWord,
            id: existing.id,
            message: '该词条已在生词本中',
          });
          return;
        }

        const id = uuidv4();
        insertWord.run(
          id,
          normalizedWord,
          userId || 'default-user',
          dictType || '',
          category || 'business',
          JSON.stringify(payload || {}),
          now,
          nextReview
        );

        inserted += 1;
        results.push({
          index,
          success: true,
          status: 'inserted',
          word: normalizedWord,
          id,
          message: '收录成功，5 分钟后开始强化复习',
        });
      } catch (error) {
        failed += 1;
        results.push({
          index,
          success: false,
          status: 'failed',
          word: item?.word,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  });

  addMany(req.body);

  res.json({
    success: failed === 0,
    total: req.body.length,
    inserted,
    duplicated,
    failed,
    results,
  });
});

// 更新词条 payload
app.patch('/api/vocab/update_payload/:id', (req, res) => {
  const { payload } = req.body || {};
  if (!payload) return res.status(400).json({ error: '缺少 payload 字段' });

  const row = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '词条不存在' });

  db.prepare(
    `UPDATE vocabulary
     SET payload = ?
     WHERE id = ?`
  ).run(JSON.stringify(payload), req.params.id);

  res.json({ success: true, message: 'payload 更新成功' });
});

// 提交复习结果（SM-2 更新）
app.put('/api/vocab/review/:id', (req, res) => {
  const { quality } = req.body; // 0-5
  if (quality === undefined || quality < 0 || quality > 5) {
    return res.status(400).json({ error: 'quality 必须为 0-5 的整数' });
  }

  const row = db
    .prepare('SELECT * FROM vocabulary WHERE id = ?')
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: '词条不存在' });

  const ebb = calculateEbbinghaus(
    row.repetitions,
    quality
  );

  const history = JSON.parse(row.review_history || '[]');
  history.push({ date: Date.now(), quality });

  db.prepare(
    `UPDATE vocabulary
     SET repetitions=?, interval_days=?, next_review_date=?, last_review_date=?, review_history=?
     WHERE id=?`
  ).run(
    ebb.repetitions,
    Math.round(ebb.intervalMs / 86400000), // 为兼容旧有字段名
    ebb.nextDate,
    Date.now(),
    JSON.stringify(history),
    req.params.id
  );

  const formatInterval = (ms) => {
    if (ms < 3600000) return `${Math.round(ms / 60000)} 分钟后`;
    if (ms < 86400000) return `${Math.round(ms / 3600000)} 小时后`;
    return `${Math.round(ms / 86400000)} 天后`;
  };

  res.json({
    success: true,
    nextReviewDate: ebb.nextDate,
    interval: ebb.intervalMs,
    message: `下次复习：${formatInterval(ebb.intervalMs)}`,
  });
});
// 人工干预复习频率
app.put('/api/vocab/manual-intervention/:id', (req, res) => {
  const { action } = req.body; // 'restart', 'step-back', 'step-forward', 'master'
  const validActions = ['restart', 'step-back', 'step-forward', 'master'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: '无效的行动操作' });
  }

  const row = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '词条不存在' });

  let newRepetitions = row.repetitions;
  let nextDate = Date.now();
  let intervalMs = 0;

  if (action === 'master') {
    newRepetitions = 999; // 极大值代表已归档
    nextDate = Date.now() + 3650 * 24 * 60 * 60 * 1000; // 10年以后，等于不再提醒
    intervalMs = 3650 * 24 * 60 * 60 * 1000;
  } else if (action === 'restart') {
    newRepetitions = 0;
    intervalMs = EBBINGHAUS_INTERVALS[0];
    nextDate = Date.now() + intervalMs;
  } else if (action === 'step-back') {
    newRepetitions = Math.max(0, row.repetitions - 1);
    intervalMs = EBBINGHAUS_INTERVALS[newRepetitions] || EBBINGHAUS_INTERVALS[EBBINGHAUS_INTERVALS.length - 1];
    nextDate = Date.now() + intervalMs;
  } else if (action === 'step-forward') {
    newRepetitions = Math.min(row.repetitions + 1, EBBINGHAUS_INTERVALS.length);
    const index = newRepetitions >= EBBINGHAUS_INTERVALS.length ? EBBINGHAUS_INTERVALS.length - 1 : newRepetitions;
    intervalMs = EBBINGHAUS_INTERVALS[index];
    nextDate = Date.now() + intervalMs;
  }

  const history = JSON.parse(row.review_history || '[]');
  history.push({ date: Date.now(), quality: action }); // 记录干预动作

  db.prepare(
    `UPDATE vocabulary
     SET repetitions=?, interval_days=?, next_review_date=?, last_review_date=?, review_history=?
     WHERE id=?`
  ).run(
    newRepetitions,
    Math.round(intervalMs / 86400000), // 为兼容旧有字段名
    nextDate,
    Date.now(),
    JSON.stringify(history),
    req.params.id
  );

  const formatInterval = (ms) => {
    if (ms >= 365 * 24 * 60 * 60 * 1000) return '已归档';
    if (ms < 3600000) return `${Math.round(ms / 60000)} 分钟后`;
    if (ms < 86400000) return `${Math.round(ms / 3600000)} 小时后`;
    return `${Math.round(ms / 86400000)} 天后`;
  };

  res.json({
    success: true,
    nextReviewDate: nextDate,
    interval: intervalMs,
    message: action === 'master' ? '词条已归档' : `已调频，下次复习：${formatInterval(intervalMs)}`,
  });
});

// 删除词条
app.delete('/api/vocab/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM vocabulary WHERE id = ?')
    .run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: '词条不存在' });
  }
  res.json({ success: true });
});

// 统一创建/获取当日训练会话
app.post('/api/training/session/upsert', (req, res) => {
  const {
    userId = 'default-user',
    trainingDate,
    totalMinutes = 60,
    listenMinutes = 30,
    logicMinutes = 30,
  } = req.body;

  if (!trainingDate) {
    return res.status(400).json({ error: '缺少 trainingDate' });
  }

  const existing = db.prepare(
    `SELECT * FROM training_sessions WHERE user_id = ? AND training_date = ?`
  ).get(userId, trainingDate);

  const { extraJson } = req.body || {};

  if (existing) {
    const updatedAt = nowTs();
    const extraStr =
      extraJson && typeof extraJson === 'object'
        ? mergeSessionExtraJson(existing.extra_json, extraJson)
        : existing.extra_json || '{}';
    db.prepare(
      `UPDATE training_sessions
       SET total_minutes=?, listen_minutes=?, logic_minutes=?, updated_at=?, extra_json=?
       WHERE id=?`
    ).run(totalMinutes, listenMinutes, logicMinutes, updatedAt, extraStr, existing.id);
    return res.json({ success: true, sessionId: existing.id, status: 'updated' });
  }

  const id = uuidv4();
  const ts = nowTs();
  const initialExtra =
    extraJson && typeof extraJson === 'object' ? JSON.stringify(extraJson) : '{}';
  db.prepare(
    `INSERT INTO training_sessions
      (id, user_id, training_date, total_minutes, listen_minutes, logic_minutes, status, created_at, updated_at, extra_json)
     VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)`
  ).run(id, userId, trainingDate, totalMinutes, listenMinutes, logicMinutes, ts, ts, initialExtra);

  res.json({ success: true, sessionId: id, status: 'created' });
});

// 写入训练作答
app.post('/api/training/attempt', (req, res) => {
  const {
    sessionId,
    userId = 'default-user',
    moduleType = 'listen',
    sceneType = '',
    caseText = '',
    roleJudgement = '',
    abilityJudgement = '',
    intentJudgement = '',
    fallacyChoice = '',
    counterQuestion = '',
    logicPoint = '',
    userAnswer = {},
    durationSeconds = 0,
    score = null,
  } = req.body;

  if (!sessionId) return res.status(400).json({ error: '缺少 sessionId' });

  const session = db.prepare(`SELECT id FROM training_sessions WHERE id = ?`).get(sessionId);
  if (!session) return res.status(404).json({ error: 'session 不存在' });

  const id = uuidv4();
  db.prepare(
    `INSERT INTO training_attempts
      (id, session_id, user_id, module_type, scene_type, case_text, role_judgement, ability_judgement, intent_judgement, fallacy_choice, counter_question, logic_point, user_answer_json, duration_seconds, score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    sessionId,
    userId,
    moduleType,
    sceneType,
    caseText,
    roleJudgement,
    abilityJudgement,
    intentJudgement,
    fallacyChoice,
    counterQuestion,
    logicPoint,
    JSON.stringify(userAnswer || {}),
    durationSeconds,
    score,
    nowTs()
  );

  res.json({ success: true, attemptId: id });
});

// 写入 AI 反馈
app.post('/api/training/feedback', (req, res) => {
  const {
    attemptId,
    userId = 'default-user',
    decomposition = {},
    logicAnalysis = {},
    strengths = '',
    weaknesses = '',
    nextFocus = '',
    score = null,
    rawResponse = '',
    knowledgeNodeId = '',
    sceneType = '',
    caseText = '',
  } = req.body;

  if (!attemptId) return res.status(400).json({ error: '缺少 attemptId' });

  const attempt = db.prepare(`SELECT id FROM training_attempts WHERE id = ?`).get(attemptId);
  if (!attempt) return res.status(404).json({ error: 'attempt 不存在' });

  const existed = db.prepare(`SELECT id FROM ai_feedback WHERE attempt_id = ?`).get(attemptId);
  const ts = nowTs();
  if (existed) {
    db.prepare(
      `UPDATE ai_feedback
       SET decomposition_json=?, logic_analysis_json=?, strengths=?, weaknesses=?, next_focus=?, score_1_10=?, raw_response=?, created_at=?
       WHERE attempt_id=?`
    ).run(
      JSON.stringify(decomposition || {}),
      JSON.stringify(logicAnalysis || {}),
      strengths,
      weaknesses,
      nextFocus,
      score,
      rawResponse,
      ts,
      attemptId
    );
    if (knowledgeNodeId) appendKnowledgeTrainingHistory({ knowledgeNodeId, attemptId, score, sceneType, caseText, createdAt: ts });
    return res.json({ success: true, feedbackId: existed.id, status: 'updated' });
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO ai_feedback
      (id, attempt_id, user_id, decomposition_json, logic_analysis_json, strengths, weaknesses, next_focus, score_1_10, raw_response, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    attemptId,
    userId,
    JSON.stringify(decomposition || {}),
    JSON.stringify(logicAnalysis || {}),
    strengths,
    weaknesses,
    nextFocus,
    score,
    rawResponse,
    ts
  );

  if (knowledgeNodeId) appendKnowledgeTrainingHistory({ knowledgeNodeId, attemptId, score, sceneType, caseText, createdAt: ts });

  res.json({ success: true, feedbackId: id, status: 'created' });
});

// 当日复盘 upsert
app.post('/api/review/daily/upsert', (req, res) => {
  const {
    sessionId,
    userId = 'default-user',
    trainingDate,
    summary = '',
    accuracyByTag = {},
    nextDayFocus = '',
    efficiencyScore = null,
  } = req.body;

  if (!sessionId || !trainingDate) {
    return res.status(400).json({ error: '缺少 sessionId 或 trainingDate' });
  }

  const existed = db.prepare(
    `SELECT id FROM daily_reviews WHERE session_id = ?`
  ).get(sessionId);
  const ts = nowTs();

  if (existed) {
    db.prepare(
      `UPDATE daily_reviews
       SET summary=?, accuracy_by_tag_json=?, next_day_focus=?, efficiency_score=?, updated_at=?
       WHERE session_id=?`
    ).run(
      summary,
      JSON.stringify(accuracyByTag || {}),
      nextDayFocus,
      efficiencyScore,
      ts,
      sessionId
    );
    return res.json({ success: true, reviewId: existed.id, status: 'updated' });
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO daily_reviews
      (id, session_id, user_id, training_date, summary, accuracy_by_tag_json, next_day_focus, efficiency_score, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    sessionId,
    userId,
    trainingDate,
    summary,
    JSON.stringify(accuracyByTag || {}),
    nextDayFocus,
    efficiencyScore,
    ts,
    ts
  );

  res.json({ success: true, reviewId: id, status: 'created' });
});

// 会话详情（含 attempt + feedback + daily review）
app.get('/api/training/session/:id', (req, res) => {
  const session = db.prepare(
    `SELECT * FROM training_sessions WHERE id = ?`
  ).get(req.params.id);
  if (!session) return res.status(404).json({ error: 'session 不存在' });

  const attempts = db.prepare(
    `SELECT * FROM training_attempts WHERE session_id = ? ORDER BY created_at ASC`
  ).all(session.id);

  const attemptIds = attempts.map(a => a.id);
  let feedbackMap = {};
  if (attemptIds.length > 0) {
    const placeholders = attemptIds.map(() => '?').join(',');
    const feedbacks = db.prepare(
      `SELECT * FROM ai_feedback WHERE attempt_id IN (${placeholders})`
    ).all(...attemptIds);
    feedbackMap = feedbacks.reduce((acc, row) => {
      acc[row.attempt_id] = {
        ...row,
        decomposition_json: parseJson(row.decomposition_json, {}),
        logic_analysis_json: parseJson(row.logic_analysis_json, {}),
      };
      return acc;
    }, {});
  }

  const parsedAttempts = attempts.map(row => ({
    ...row,
    user_answer_json: parseJson(row.user_answer_json, {}),
    feedback: feedbackMap[row.id] || null,
  }));

  const review = db.prepare(
    `SELECT * FROM daily_reviews WHERE session_id = ?`
  ).get(session.id);

  res.json({
    session,
    attempts: parsedAttempts,
    review: review
      ? {
          ...review,
          accuracy_by_tag_json: parseJson(review.accuracy_by_tag_json, {}),
        }
      : null,
  });
});

// 按日期获取会话详情（用于历史回放）
app.get('/api/training/session-by-date', (req, res) => {
  const userId = String(req.query.userId || 'default-user');
  const trainingDate = String(req.query.trainingDate || '');
  if (!trainingDate) {
    return res.status(400).json({ error: '缺少 trainingDate' });
  }

  const session = db.prepare(
    `SELECT * FROM training_sessions WHERE user_id = ? AND training_date = ? LIMIT 1`
  ).get(userId, trainingDate);

  if (!session) {
    return res.json({ session: null, attempts: [], review: null });
  }

  const attempts = db.prepare(
    `SELECT * FROM training_attempts WHERE session_id = ? ORDER BY created_at ASC`
  ).all(session.id);

  const attemptIds = attempts.map(a => a.id);
  let feedbackMap = {};
  if (attemptIds.length > 0) {
    const placeholders = attemptIds.map(() => '?').join(',');
    const feedbacks = db.prepare(
      `SELECT * FROM ai_feedback WHERE attempt_id IN (${placeholders})`
    ).all(...attemptIds);
    feedbackMap = feedbacks.reduce((acc, row) => {
      acc[row.attempt_id] = {
        ...row,
        decomposition_json: parseJson(row.decomposition_json, {}),
        logic_analysis_json: parseJson(row.logic_analysis_json, {}),
      };
      return acc;
    }, {});
  }

  const parsedAttempts = attempts.map(row => ({
    ...row,
    user_answer_json: parseJson(row.user_answer_json, {}),
    feedback: feedbackMap[row.id] || null,
  }));

  const review = db.prepare(
    `SELECT * FROM daily_reviews WHERE session_id = ?`
  ).get(session.id);

  return res.json({
    session,
    attempts: parsedAttempts,
    review: review
      ? {
          ...review,
          accuracy_by_tag_json: parseJson(review.accuracy_by_tag_json, {}),
        }
      : null,
  });
});

// 听力盲听舱：Dify Webhook 入库，支持 A2-C1 分级
app.post('/api/listening/materials', (req, res) => {
  try {
    const material = normalizeListeningMaterial(req.body || {});
    const id = uuidv4();
    const ts = nowTs();

    db.prepare(
      `INSERT INTO listening_materials
        (id, title, content_text, audio_url, difficulty, category, duration, has_subtext, subtext_analysis, source_type, source_topic, source_url, source_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      material.title,
      material.contentText,
      material.audioUrl,
      material.difficulty,
      material.category,
      material.duration,
      material.hasSubtext,
      material.subtextAnalysis,
      material.sourceType,
      material.sourceTopic,
      material.sourceUrl,
      material.sourceJson,
      ts,
      ts,
    );

    const row = db.prepare(`SELECT * FROM listening_materials WHERE id = ?`).get(id);
    res.status(201).json({ success: true, id, data: parseListeningMaterial(row) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '听力材料入库失败';
    res.status(400).json({ success: false, error: message });
  }
});

app.get('/api/listening/materials', (req, res) => {
  const difficulty = String(req.query.difficulty || '').trim().toUpperCase();
  const category = String(req.query.category || '').trim();
  const sourceType = String(req.query.sourceType || req.query.source_type || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  const params = [];
  let sql = `SELECT * FROM listening_materials WHERE 1=1`;

  if (difficulty) {
    if (!CEFR_LEVELS.has(difficulty)) return res.status(400).json({ success: false, error: 'difficulty 必须为 A2/B1/B2/C1' });
    sql += ` AND difficulty = ?`;
    params.push(difficulty);
  }
  if (category) {
    sql += ` AND category = ?`;
    params.push(category);
  }
  if (sourceType) {
    sql += ` AND source_type = ?`;
    params.push(sourceType);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows.map(parseListeningMaterial) });
});

app.get('/api/listening/materials/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM listening_materials WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: '听力材料不存在' });
  res.json({ success: true, data: parseListeningMaterial(row) });
});

app.patch('/api/listening/materials/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM listening_materials WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: '听力材料不存在' });

  const next = normalizeListeningMaterial({
    title: req.body.title ?? row.title,
    content_text: req.body.content_text ?? row.content_text,
    audio_url: req.body.audio_url ?? row.audio_url,
    difficulty: req.body.difficulty ?? row.difficulty,
    category: req.body.category ?? row.category,
    duration: req.body.duration ?? row.duration,
    has_subtext: req.body.has_subtext ?? Boolean(row.has_subtext),
    subtext_analysis: req.body.subtext_analysis ?? row.subtext_analysis,
    source: req.body.source ?? parseJson(row.source_json, {}),
    source_type: req.body.source_type ?? row.source_type,
    source_topic: req.body.source_topic ?? row.source_topic,
    source_url: req.body.source_url ?? row.source_url,
  });

  db.prepare(
    `UPDATE listening_materials
     SET title=?, content_text=?, audio_url=?, difficulty=?, category=?, duration=?, has_subtext=?, subtext_analysis=?, source_type=?, source_topic=?, source_url=?, source_json=?, updated_at=?
     WHERE id=?`
  ).run(
    next.title,
    next.contentText,
    next.audioUrl,
    next.difficulty,
    next.category,
    next.duration,
    next.hasSubtext,
    next.subtextAnalysis,
    next.sourceType,
    next.sourceTopic,
    next.sourceUrl,
    next.sourceJson,
    nowTs(),
    req.params.id,
  );

  const updated = db.prepare(`SELECT * FROM listening_materials WHERE id = ?`).get(req.params.id);
  res.json({ success: true, data: parseListeningMaterial(updated) });
});

app.delete('/api/listening/materials/:id', (req, res) => {
  const result = db.prepare(`DELETE FROM listening_materials WHERE id = ?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, error: '听力材料不存在' });
  res.json({ success: true });
});

// 听力盲听舱：接入 TTS 生成结果或爬虫抓取音频
app.post('/api/listening/materials/:id/audio', async (req, res) => {
  const row = db.prepare(`SELECT * FROM listening_materials WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: '听力材料不存在' });

  try {
    const mode = String(req.body.mode || req.body.sourceType || 'url').trim();
    const ts = nowTs();
    let audioUrl = String(req.body.audioUrl || req.body.audio_url || '').trim();

    if (mode === 'base64') {
      const audioBase64 = String(req.body.audioBase64 || req.body.audio_base64 || '').trim();
      if (!audioBase64) return res.status(400).json({ success: false, error: '缺少 audioBase64' });
      const format = String(req.body.format || 'mp3').replace(/[^a-zA-Z0-9]/g, '') || 'mp3';
      const fileName = `${row.id}-${ts}.${format}`;
      ensureAudioDir();
      fs.writeFileSync(path.join(AUDIO_DIR, fileName), Buffer.from(audioBase64, 'base64'));
      audioUrl = buildListeningAudioUrl(fileName);
    } else if (mode === 'crawler' || mode === 'url') {
      const sourceUrl = String(req.body.sourceUrl || req.body.source_url || audioUrl || '').trim();
      if (!sourceUrl) return res.status(400).json({ success: false, error: '缺少 sourceUrl 或 audioUrl' });
      const shouldDownload = req.body.download !== false;
      if (shouldDownload) {
        const ext = path.extname(new URL(sourceUrl).pathname).replace('.', '') || 'mp3';
        audioUrl = await downloadAudioToListeningDir(sourceUrl, `${row.id}-${ts}.${ext}`);
      } else {
        audioUrl = sourceUrl;
      }
    } else if (mode === 'tts') {
      if (!audioUrl) return res.status(202).json({ success: true, pending: true, message: '请由外部 TTS 服务生成音频后，用 base64 或 audioUrl 回写。' });
    } else {
      return res.status(400).json({ success: false, error: 'mode 必须为 base64/url/crawler/tts' });
    }

    db.prepare(
      `UPDATE listening_materials SET audio_url = ?, source_type = ?, source_url = ?, updated_at = ? WHERE id = ?`
    ).run(audioUrl, mode, String(req.body.sourceUrl || req.body.source_url || ''), ts, row.id);

    const updated = db.prepare(`SELECT * FROM listening_materials WHERE id = ?`).get(row.id);
    return res.json({ success: true, audioUrl, data: parseListeningMaterial(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '音频接入失败';
    return res.status(500).json({ success: false, error: message });
  }
});

// 兼容 mt.md 中的 TTS 预留地址
app.post('/api/listening/tts/:id', async (req, res) => {
  const row = db.prepare(`SELECT * FROM listening_materials WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: '听力材料不存在' });

  try {
    const ttsEndpoint = process.env.TTS_ENDPOINT || '';
    if (!ttsEndpoint) {
      return res.status(202).json({
        success: true,
        pending: true,
        id: row.id,
        text: row.content_text,
        message: '未配置 TTS_ENDPOINT。请调用 /api/listening/materials/:id/audio 回写 base64 或 audioUrl。',
      });
    }

    const response = await fetch(ttsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.TTS_API_KEY ? { Authorization: `Bearer ${process.env.TTS_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        text: row.content_text,
        voice: req.body.voice || 'alloy',
        format: req.body.format || 'mp3',
        title: row.title,
        difficulty: row.difficulty,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`TTS 服务失败：HTTP ${response.status} ${detail}`.trim());
    }

    let audioUrl = '';
    const ts = nowTs();
    if (contentType.includes('application/json')) {
      const data = await response.json();
      audioUrl = String(data.audioUrl || data.audio_url || '').trim();
      const audioBase64 = String(data.audioBase64 || data.audio_base64 || '').trim();
      if (!audioUrl && audioBase64) {
        const format = String(data.format || req.body.format || 'mp3').replace(/[^a-zA-Z0-9]/g, '') || 'mp3';
        const fileName = `${row.id}-${ts}.${format}`;
        ensureAudioDir();
        fs.writeFileSync(path.join(AUDIO_DIR, fileName), Buffer.from(audioBase64, 'base64'));
        audioUrl = buildListeningAudioUrl(fileName);
      }
    } else {
      const ext = contentType.includes('wav') ? 'wav' : contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'audio';
      const fileName = `${row.id}-${ts}.${ext}`;
      const arrayBuffer = await response.arrayBuffer();
      ensureAudioDir();
      fs.writeFileSync(path.join(AUDIO_DIR, fileName), Buffer.from(arrayBuffer));
      audioUrl = buildListeningAudioUrl(fileName);
    }

    if (!audioUrl) throw new Error('TTS 服务未返回 audioUrl 或音频内容');

    db.prepare(`UPDATE listening_materials SET audio_url = ?, source_type = 'tts', updated_at = ? WHERE id = ?`).run(audioUrl, ts, row.id);
    const updated = db.prepare(`SELECT * FROM listening_materials WHERE id = ?`).get(row.id);
    res.json({ success: true, audioUrl, data: parseListeningMaterial(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TTS 生成失败';
    res.status(500).json({ success: false, error: message });
  }
});

// Dify 调用日志（用于后续统一追踪）
app.post('/api/dify/log', (req, res) => {
  const {
    userId = 'default-user',
    workflowName = '',
    requestHash = '',
    status = 'ok',
    latencyMs = 0,
    errorMessage = '',
  } = req.body;

  const id = uuidv4();
  db.prepare(
    `INSERT INTO dify_call_logs
      (id, user_id, workflow_name, request_hash, status, latency_ms, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, workflowName, requestHash, status, latencyMs, errorMessage, nowTs());

  res.json({ success: true, id });
});

app.post('/api/material/ingest', (req, res) => {
  const {
    userId = 'default-user',
    sourceType = 'text',
    sourceName = '',
    sourceText = '',
    topic = '',
    kbDatasetId = '',
    summaryJson = {},
  } = req.body || {};

  const id = uuidv4();
  const ts = nowTs();
  db.prepare(
    `INSERT INTO material_ingest_jobs
      (id, user_id, source_type, source_name, source_text, status, topic, kb_dataset_id, summary_record_id, summary_json, error_message, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, '', ?, '', ?, ?)`
  ).run(
    id,
    userId,
    sourceType,
    sourceName,
    sourceText,
    topic,
    kbDatasetId,
    JSON.stringify(summaryJson || {}),
    ts,
    ts,
  );

  res.json({ success: true, materialId: id, status: 'pending' });
});

async function listDifyDatasetDocuments() {
  const response = await fetch(`${DIFY_BASE_URL.replace(/\/$/, '')}/v1/datasets/${DIFY_KB_DATASET_ID}/documents?limit=100`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${DIFY_KB_API_KEY}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `获取知识库文档列表失败 (HTTP ${response.status})`);
  }
  return Array.isArray(data?.data) ? data.data : Array.isArray(data?.documents) ? data.documents : [];
}

async function deleteDifyDatasetDocument(documentId) {
  const response = await fetch(`${DIFY_BASE_URL.replace(/\/$/, '')}/v1/datasets/${DIFY_KB_DATASET_ID}/documents/${documentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${DIFY_KB_API_KEY}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `删除知识库文档失败 (HTTP ${response.status})`);
  }
  return data;
}

async function clearDifyDatasetDocuments() {
  const documents = await listDifyDatasetDocuments();
  for (const document of documents) {
    const documentId = document?.id;
    if (documentId) {
      await deleteDifyDatasetDocument(documentId);
    }
  }
  return documents.length;
}

async function uploadFileToDifyKnowledgeBase({ userId = 'default-user', sourceName = '', topic = '', fileName = '', mimeType = '', base64Content = '' }) {
  if (!fileName || !base64Content) {
    throw new Error('缺少文件内容');
  }
  if (!DIFY_KB_DATASET_ID) {
    throw new Error('未配置 DIFY_KB_DATASET_ID');
  }
  if (!DIFY_KB_API_KEY) {
    throw new Error('未配置 DIFY_KB_API_KEY');
  }

  const id = uuidv4();
  const ts = nowTs();
  const sourceText = `【文件名】${fileName}\n【类型】${mimeType || 'unknown'}`;

  db.prepare(
    `INSERT INTO material_ingest_jobs
      (id, user_id, source_type, source_name, source_text, status, topic, kb_dataset_id, dify_document_id, dify_batch_id, dify_document_status, dify_display_status, dify_segment_count, dify_word_count, dify_doc_language, dify_download_url, summary_record_id, summary_json, error_message, created_at, updated_at)
     VALUES (?, ?, 'file', ?, ?, 'pending', ?, ?, '', '', '', '', 0, 0, '', '', '', '{}', '', ?, ?)`
  ).run(id, userId, sourceName || fileName, sourceText, topic, DIFY_KB_DATASET_ID, ts, ts);

  try {
    const boundary = `----superagent-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const fileBuffer = Buffer.from(base64Content, 'base64');
    const data = JSON.stringify({
      indexing_technique: 'high_quality',
      doc_form: 'hierarchical_model',
      doc_language: 'Chinese',
      process_rule: { mode: 'automatic' },
    });

    const formParts = [];
    formParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="data"\r\nContent-Type: application/json\r\n\r\n${data}\r\n`));
    formParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`));
    formParts.push(fileBuffer);
    formParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const createRes = await fetch(`${DIFY_BASE_URL.replace(/\/$/, '')}/v1/datasets/${DIFY_KB_DATASET_ID}/document/create-by-file`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DIFY_KB_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: Buffer.concat(formParts),
    });
    const createData = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      const message = createData?.message || createData?.error || `Dify HTTP ${createRes.status}`;
      db.prepare(`UPDATE material_ingest_jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?`).run('failed', message, nowTs(), id);
      throw new Error(message);
    }

    const documentId = createData?.document?.id || '';
    const batchId = createData?.batch || '';
    const docStatus = createData?.document?.indexing_status || 'indexing';
    const displayStatus = createData?.document?.display_status || docStatus;
    const segmentCount = Number(createData?.document?.segment_count || 0);
    const wordCount = Number(createData?.document?.word_count ?? estimateWordCount(sourceText || fileName || ''));
    const docLanguage = String(createData?.document?.doc_language || '');

    db.prepare(
      `UPDATE material_ingest_jobs
       SET status = ?, dify_document_id = ?, dify_batch_id = ?, dify_document_status = ?, dify_display_status = ?, dify_segment_count = ?, dify_word_count = ?, dify_doc_language = ?, updated_at = ?
       WHERE id = ?`
    ).run('processing', documentId, batchId, docStatus, displayStatus, segmentCount, wordCount, docLanguage, nowTs(), id);

    return { success: true, materialId: id, status: 'processing', datasetId: DIFY_KB_DATASET_ID, dify: createData };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dify 上传失败';
    db.prepare(`UPDATE material_ingest_jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?`).run('failed', message, nowTs(), id);
    throw error;
  }
}

async function getDifyDocumentStatus(batchId) {
  const response = await fetch(`${DIFY_BASE_URL.replace(/\/$/, '')}/v1/datasets/${DIFY_KB_DATASET_ID}/documents/${batchId}/indexing-status`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${DIFY_KB_API_KEY}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `获取文档嵌入状态失败 (HTTP ${response.status})`);
  }

  const candidate = Array.isArray(data?.data) ? data.data[0] : data?.data;
  const status = candidate?.indexing_status || candidate?.status || data?.indexing_status || data?.status || 'unknown';
  return { status, data };
}

function isCompletedDifyStatus(status) {
  return ['completed', 'available', 'ready', 'success'].includes(String(status).toLowerCase());
}

function isFailedDifyStatus(status) {
  return ['error', 'failed', 'paused'].includes(String(status).toLowerCase());
}

async function waitForDifyDocumentCompleted(batchId, addLog, timeoutMs = 180000, intervalMs = 5000) {
  const startedAt = Date.now();
  let lastStatus = 'unknown';

  while (Date.now() - startedAt < timeoutMs) {
    const result = await getDifyDocumentStatus(batchId);
    lastStatus = result.status;
    addLog(`当前状态：${lastStatus}`);

    if (isCompletedDifyStatus(lastStatus)) {
      return result;
    }
    if (isFailedDifyStatus(lastStatus)) {
      throw new Error(`文档嵌入失败：${lastStatus}`);
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`等待文档嵌入 completed 超时，最后状态：${lastStatus}`);
}

async function runEnglishMasteryWorkflow({ topic = '', materialText = '', userId = 'default-user' }) {
  if (!DIFY_ENGLISH_MASTERY_API_KEY) {
    throw new Error('未配置 DIFY_ENGLISH_MASTERY_API_KEY');
  }

  const url = `${DIFY_BASE_URL.replace(/\/$/, '')}/v1/workflows/run`;
  const payload = {
    inputs: {
      topic,
      material_text: materialText || '',
    },
    response_mode: 'blocking',
    user: userId,
  };

  const attempts = [
    { timeoutMs: 80000, retryDelayMs: 5000 },
    { timeoutMs: 90000, retryDelayMs: 10000 },
    { timeoutMs: 120000, retryDelayMs: 0 },
  ];

  let lastError = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const { timeoutMs, retryDelayMs } = attempts[index];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`Dify 工作流超时 ${timeoutMs / 1000} 秒`)), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DIFY_ENGLISH_MASTERY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        clearTimeout(timer);
        return data;
      }

      const message = data?.message || data?.error || `Dify 请求失败 (HTTP ${response.status})`;
      lastError = new Error(message);

      if (response.status === 504 && index < attempts.length - 1) {
        clearTimeout(timer);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        continue;
      }

      clearTimeout(timer);
      throw lastError;
    } catch (error) {
      clearTimeout(timer);
      const isAbort = error?.name === 'AbortError' || String(error?.message || '').includes('超时');
      lastError = error instanceof Error ? error : new Error('Dify 工作流执行失败');

      if (isAbort && index < attempts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Dify 工作流执行失败');
}

app.post('/api/material/upload', async (req, res) => {
  try {
    const result = await uploadFileToDifyKnowledgeBase(req.body || {});
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dify 上传失败';
    res.status(500).json({ success: false, error: message });
  }
});

app.post('/api/dify/run-english-mastery', async (req, res) => {
  const { topic = '', materialText = '', userId = 'default-user' } = req.body || {};

  try {
    const data = await runEnglishMasteryWorkflow({ topic, materialText, userId });
    res.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dify 工作流执行失败';
    console.error('[Dify Workflow Error]', error);
    res.status(500).json({ success: false, error: message });
  }
});

app.post('/api/material/process-and-extract', async (req, res) => {
  const { topic = '', userId = 'default-user', files = [] } = req.body || {};
  const logs = [];
  const results = [];
  const addLog = (message) => logs.push(`${new Date().toLocaleTimeString('zh-CN', { hour12: false })} ${message}`);

  if (!topic) {
    return res.status(400).json({ success: false, error: '缺少 topic 字段' });
  }
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ success: false, error: '缺少 files 文件数组' });
  }

  try {
    addLog(`已选择主题：${topic}`);
    addLog(`已选择 ${files.length} 个文件`);

    for (const [index, file] of files.entries()) {
      const fileName = file?.fileName || `未命名文件-${index + 1}`;
      addLog(`开始处理：${fileName}`);
      addLog('正在检查知识库现有文档...');

      const deletedCount = await clearDifyDatasetDocuments();
      if (deletedCount > 0) {
        addLog(`发现 ${deletedCount} 个旧文档，正在删除...`);
        addLog('旧文档删除完成');
      } else {
        addLog('知识库内无旧文档，跳过删除');
      }

      addLog(`正在上传：${fileName}`);
      const uploadResult = await uploadFileToDifyKnowledgeBase({
        ...file,
        userId,
        topic,
        sourceName: file?.sourceName || fileName,
      });
      const documentId = uploadResult?.dify?.document?.id || '';
      const batchId = uploadResult?.dify?.batch || uploadResult?.dify?.batch_id || '';
      addLog(`上传成功，Dify 文档 ID：${documentId || '未知'}`);
      addLog(`上传批次 Batch ID：${batchId || '未知'}`);

      if (!documentId) {
        throw new Error(`未获取到 Dify 文档 ID：${fileName}`);
      }
      if (!batchId) {
        throw new Error(`未获取到 Dify 上传批次 Batch ID：${fileName}`);
      }

      addLog('正在等待向量化完成...');
      const statusResult = await waitForDifyDocumentCompleted(batchId, addLog);
      addLog('当前状态：completed');

      addLog('正在触发 Dify 提纯工作流...');
      const workflowData = await runEnglishMasteryWorkflow({ topic, materialText: '', userId });
      addLog('提纯完成，已写入生词本');

      results.push({
        fileName,
        materialId: uploadResult.materialId,
        documentId,
        batchId,
        status: statusResult.status,
        workflowRunId: workflowData?.workflow_run_id || workflowData?.data?.workflow_run_id || '',
      });

      if (index < files.length - 1) {
        addLog('开始处理下一个文件...');
      }
    }

    addLog('全部处理完成');
    res.json({ success: true, topic, total: files.length, results, logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : '材料提纯流程失败';
    addLog(`处理失败：${message}`);
    console.error('[Material Process Error]', error);
    res.status(500).json({ success: false, error: message, topic, results, logs });
  }
});

app.post('/api/material/ingest/:id/trigger', async (req, res) => {
  const row = db.prepare(`SELECT * FROM material_ingest_jobs WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'material 不存在' });
  if (!row.dify_document_id || !row.kb_dataset_id) {
    return res.status(400).json({ error: '缺少 Dify 文档信息' });
  }
  if (!DIFY_KB_API_KEY) {
    return res.status(500).json({ error: '未配置 DIFY_KB_API_KEY' });
  }

  try {
    const detailRes = await fetch(`${DIFY_BASE_URL.replace(/\/$/, '')}/v1/datasets/${row.kb_dataset_id}/documents/${row.dify_document_id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${DIFY_KB_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    const detail = await detailRes.json().catch(() => ({}));
    if (!detailRes.ok) {
      const message = detail?.message || detail?.error || `Dify HTTP ${detailRes.status}`;
      db.prepare(`UPDATE material_ingest_jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?`).run('failed', message, nowTs(), row.id);
      return res.status(500).json({ success: false, error: message });
    }

    const doc = detail || {};
    const indexingStatus = String(doc.indexing_status || row.dify_document_status || 'indexing');
    const displayStatus = String(doc.display_status || row.dify_display_status || indexingStatus);
    const segmentCount = Number(doc.segment_count ?? row.dify_segment_count ?? 0);
    const docLanguage = String(doc.doc_language || row.dify_doc_language || '');
    let downloadUrl = row.dify_download_url || '';

    const downloadRes = await fetch(`${DIFY_BASE_URL.replace(/\/$/, '')}/v1/datasets/${row.kb_dataset_id}/documents/${row.dify_document_id}/download`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${DIFY_KB_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }).catch(() => null);
    if (downloadRes) {
      const downloadJson = await downloadRes.json().catch(() => ({}));
      if (downloadRes.ok && downloadJson?.url) {
        downloadUrl = downloadJson.url;
      }
    }

    const nextStatus = indexingStatus === 'completed' ? 'processed' : indexingStatus === 'error' ? 'failed' : 'processing';
    db.prepare(
      `UPDATE material_ingest_jobs
       SET status = ?, dify_document_status = ?, dify_display_status = ?, dify_segment_count = ?, dify_word_count = ?, dify_doc_language = ?, dify_download_url = ?, updated_at = ?
       WHERE id = ?`
    ).run(nextStatus, indexingStatus, displayStatus, segmentCount, estimateWordCount(doc?.name || row.source_name || ''), docLanguage, downloadUrl, nowTs(), row.id);

    const updatedJob = db.prepare(`SELECT * FROM material_ingest_jobs WHERE id = ?`).get(row.id);
    upsertKnowledgeNodeFromMaterial(updatedJob, updatedJob.summary_json ? parseJson(updatedJob.summary_json, {}) : {}, doc);

    res.json({
      success: true,
      materialId: row.id,
      status: nextStatus,
      dify: {
        document: doc,
        downloadUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '同步 Dify 状态失败';
    db.prepare(`UPDATE material_ingest_jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?`).run('failed', message, nowTs(), row.id);
    res.status(500).json({ success: false, error: message });
  }
});

app.post('/api/material/ingest/:id/complete', (req, res) => {
  const { summaryJson = {}, summaryRecordId = '', kbDatasetId = '', errorMessage = '' } = req.body || {};
  const row = db.prepare(`SELECT * FROM material_ingest_jobs WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'material 不存在' });

  db.prepare(
    `UPDATE material_ingest_jobs
     SET status = ?, summary_json = ?, summary_record_id = ?, kb_dataset_id = ?, error_message = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    errorMessage ? 'failed' : 'processed',
    JSON.stringify(summaryJson || {}),
    summaryRecordId,
    kbDatasetId || row.kb_dataset_id,
    errorMessage,
    nowTs(),
    req.params.id,
  );

  const updatedJob = db.prepare(`SELECT * FROM material_ingest_jobs WHERE id = ?`).get(req.params.id);
  upsertKnowledgeNodeFromMaterial(updatedJob, parseJson(updatedJob.summary_json, {}));

  res.json({ success: true });
});

app.post('/api/material/:id/sync-dify-status', async (req, res) => {
  const row = db.prepare(`SELECT * FROM material_ingest_jobs WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'material 不存在' });
  if (!row.dify_document_id || !row.kb_dataset_id) {
    return res.status(400).json({ error: '缺少 Dify 文档信息' });
  }
  if (!DIFY_KB_API_KEY) {
    return res.status(500).json({ error: '未配置 DIFY_KB_API_KEY' });
  }

  try {
    const detailRes = await fetch(`${DIFY_BASE_URL.replace(/\/$/, '')}/v1/datasets/${row.kb_dataset_id}/documents/${row.dify_document_id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${DIFY_KB_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    const detail = await detailRes.json().catch(() => ({}));
    if (!detailRes.ok) {
      const message = detail?.message || detail?.error || `Dify HTTP ${detailRes.status}`;
      db.prepare(`UPDATE material_ingest_jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?`).run('failed', message, nowTs(), row.id);
      return res.status(500).json({ success: false, error: message });
    }

    const doc = detail || {};
    const indexingStatus = String(doc.indexing_status || row.dify_document_status || 'indexing');
    const displayStatus = String(doc.display_status || row.dify_display_status || indexingStatus);
    const segmentCount = Number(doc.segment_count ?? row.dify_segment_count ?? 0);
    const wordCount = Number(doc.word_count ?? row.dify_word_count ?? estimateWordCount(doc?.name || row.source_name || row.source_text || ''));
    const docLanguage = String(doc.doc_language || row.dify_doc_language || '');
    const downloadRes = await fetch(`${DIFY_BASE_URL.replace(/\/$/, '')}/v1/datasets/${row.kb_dataset_id}/documents/${row.dify_document_id}/download`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${DIFY_KB_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }).catch(() => null);
    let downloadUrl = row.dify_download_url || '';
    if (downloadRes) {
      const downloadJson = await downloadRes.json().catch(() => ({}));
      if (downloadRes.ok && downloadJson?.url) {
        downloadUrl = downloadJson.url;
      }
    }

    const nextStatus = indexingStatus === 'completed' ? 'processed' : indexingStatus === 'error' ? 'failed' : 'processing';
    db.prepare(
      `UPDATE material_ingest_jobs
       SET status = ?, dify_document_status = ?, dify_display_status = ?, dify_segment_count = ?, dify_word_count = ?, dify_doc_language = ?, dify_download_url = ?, updated_at = ?
       WHERE id = ?`
    ).run(nextStatus, indexingStatus, displayStatus, segmentCount, wordCount, docLanguage, downloadUrl, nowTs(), row.id);

    const updatedJob = db.prepare(`SELECT * FROM material_ingest_jobs WHERE id = ?`).get(row.id);
    upsertKnowledgeNodeFromMaterial(updatedJob, updatedJob.summary_json ? parseJson(updatedJob.summary_json, {}) : {}, doc);

    res.json({
      success: true,
      materialId: row.id,
      status: nextStatus,
      dify: {
        document: doc,
        downloadUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '同步 Dify 状态失败';
    db.prepare(`UPDATE material_ingest_jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?`).run('failed', message, nowTs(), row.id);
    res.status(500).json({ success: false, error: message });
  }
});

app.post('/api/material/:id/update', async (req, res) => {
  const row = db.prepare(`SELECT * FROM material_ingest_jobs WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'material 不存在' });
  if (!DIFY_KB_API_KEY) return res.status(500).json({ error: '未配置 DIFY_KB_API_KEY' });
  if (!row.kb_dataset_id || !row.dify_document_id) return res.status(400).json({ error: '缺少 Dify 文档信息' });

  const { mode = 'text', sourceText = '', sourceName = '', topic = '', fileName = '', mimeType = '', base64Content = '' } = req.body || {};

  try {
    let updateRes = null;
    let updateData = {};

    if (mode === 'file') {
      if (!fileName || !base64Content) {
        return res.status(400).json({ error: '缺少文件内容' });
      }
      const boundary = `----superagent-update-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const fileBuffer = Buffer.from(base64Content, 'base64');
      const data = JSON.stringify({
        indexing_technique: 'high_quality',
        doc_form: 'text_model',
        doc_language: row.dify_doc_language || 'Chinese',
        process_rule: { mode: 'automatic' },
      });
      const formParts = [];
      formParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="data"\r\nContent-Type: application/json\r\n\r\n${data}\r\n`));
      formParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`));
      formParts.push(fileBuffer);
      formParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      updateRes = await fetch(`${DIFY_BASE_URL.replace(/\/$/, '')}/v1/datasets/${row.kb_dataset_id}/documents/${row.dify_document_id}/update-by-file`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DIFY_KB_API_KEY}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: Buffer.concat(formParts),
      });
      updateData = await updateRes.json().catch(() => ({}));
    } else {
      updateRes = await fetch(`${DIFY_BASE_URL.replace(/\/$/, '')}/v1/datasets/${row.kb_dataset_id}/documents/${row.dify_document_id}/update-by-text`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DIFY_KB_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sourceName || row.source_name || '未命名资料',
          text: String(sourceText || row.source_text || ''),
          indexing_technique: 'high_quality',
          process_rule: { mode: 'automatic' },
          metadata: { topic: topic || row.topic || '' },
        }),
      });
      updateData = await updateRes.json().catch(() => ({}));
    }

    if (!updateRes || !updateRes.ok) {
      const message = updateData?.message || updateData?.error || `Dify HTTP ${updateRes?.status || 500}`;
      return res.status(500).json({ success: false, error: message });
    }

    const documentId = updateData?.document?.id || row.dify_document_id;
    const batchId = updateData?.batch || updateData?.batch_id || row.dify_batch_id || '';
    const docStatus = updateData?.document?.indexing_status || updateData?.indexing_status || 'indexing';
    const displayStatus = updateData?.document?.display_status || updateData?.display_status || docStatus;
    const segmentCount = Number(updateData?.document?.segment_count ?? row.dify_segment_count ?? 0);
    const wordCount = Number(updateData?.document?.word_count ?? row.dify_word_count ?? estimateWordCount(String(sourceText || row.source_text || sourceName || '')));
    const docLanguage = String(updateData?.document?.doc_language || row.dify_doc_language || '');
    const downloadUrl = String(updateData?.document?.download_url || row.dify_download_url || '');
    const nextStatus = String(docStatus) === 'completed' ? 'processed' : String(docStatus) === 'error' ? 'failed' : 'processing';

    db.prepare(
      `UPDATE material_ingest_jobs
       SET source_name = ?, source_text = ?, topic = ?, status = ?, dify_document_id = ?, dify_batch_id = ?, dify_document_status = ?, dify_display_status = ?, dify_segment_count = ?, dify_word_count = ?, dify_doc_language = ?, dify_download_url = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      sourceName || row.source_name || '',
      mode === 'text' ? String(sourceText || '') : row.source_text,
      topic || row.topic || '',
      nextStatus,
      documentId,
      batchId,
      docStatus,
      displayStatus,
      segmentCount,
      wordCount,
      docLanguage,
      downloadUrl,
      nowTs(),
      row.id,
    );

    const updatedJob = db.prepare(`SELECT * FROM material_ingest_jobs WHERE id = ?`).get(row.id);
    upsertKnowledgeNodeFromMaterial(updatedJob, updatedJob.summary_json ? parseJson(updatedJob.summary_json, {}) : {}, updateData.document || updateData);

    res.json({ success: true, materialId: row.id, status: 'processing', dify: updateData });
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新资料失败';
    return res.status(500).json({ success: false, error: message });
  }
});

app.delete('/api/material/:id', async (req, res) => {
  const row = db.prepare(`SELECT * FROM material_ingest_jobs WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'material 不存在' });
  try {
    db.prepare(`DELETE FROM knowledge_nodes WHERE source_material_id = ?`).run(row.id);
    db.prepare(`DELETE FROM material_ingest_jobs WHERE id = ?`).run(row.id);
    res.json({ success: true, materialId: row.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除资料失败';
    return res.status(500).json({ success: false, error: message });
  }
});

app.get('/api/material/:id/preview-document', async (req, res) => {
  return res.status(410).json({ error: 'preview disabled' });
});

app.post('/api/material/:id/generate-summary', async (req, res) => {
  const row = db.prepare(`SELECT * FROM material_ingest_jobs WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'material 不存在' });
  if (!DIFY_MATERIAL_SUMMARY_API_KEY) return res.status(500).json({ error: '未配置 DIFY_MATERIAL_SUMMARY_API_KEY' });

  try {
    const topic = String(row.topic || '').trim();
    const sourceName = String(row.source_name || '未命名资料');
    const docLanguage = String(row.dify_doc_language || '');

    let downloadUrl = String(row.dify_download_url || '');
    if (!downloadUrl && row.kb_dataset_id && row.dify_document_id) {
      const downloadRes = await fetch(`${DIFY_BASE_URL.replace(/\/$/, '')}/v1/datasets/${row.kb_dataset_id}/documents/${row.dify_document_id}/download`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${DIFY_KB_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }).catch(() => null);
      if (downloadRes) {
        const downloadJson = await downloadRes.json().catch(() => ({}));
        if (downloadRes.ok && downloadJson?.url) {
          downloadUrl = String(downloadJson.url);
          db.prepare(`UPDATE material_ingest_jobs SET dify_download_url = ?, updated_at = ? WHERE id = ?`).run(downloadUrl, nowTs(), row.id);
        }
      }
    }

    let documentText = String(row.source_text || '').trim();
    if (downloadUrl) {
      const absoluteUrl = downloadUrl.startsWith('http')
        ? downloadUrl
        : `${DIFY_BASE_URL.replace(/\/$/, '')}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
      const fileRes = await fetch(absoluteUrl, { method: 'GET' }).catch(() => null);
      if (fileRes && fileRes.ok) {
        const fetchedText = (await fileRes.text().catch(() => '')).trim();
        if (fetchedText) documentText = fetchedText;
      }
    }

    const MAX_DOC_TEXT_LENGTH = 100000;
    if (documentText.length > MAX_DOC_TEXT_LENGTH) {
      documentText = `${documentText.slice(0, MAX_DOC_TEXT_LENGTH)}\n\n...（内容已截断，超过工作流输入上限）`;
    }

    const workflowUrl = `${DIFY_BASE_URL.replace(/\/$/, '')}/v1/workflows/run`;
    const workflowInputs = {
      material_id: row.id,
      dataset_id: row.kb_dataset_id || '',
      document_id: row.dify_document_id || '',
      source_name: sourceName,
      topic,
      doc_language: docLanguage,
      document_text: documentText,
    };

    const workflowRes = await fetch(workflowUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DIFY_MATERIAL_SUMMARY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: workflowInputs,
        response_mode: 'blocking',
        user: row.user_id,
      }),
    });

    const workflowData = await workflowRes.json().catch(() => ({}));
    if (!workflowRes.ok) {
      const message = workflowData?.message || workflowData?.error || `Dify HTTP ${workflowRes.status}`;
      db.prepare(`UPDATE material_ingest_jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?`).run('failed', message, nowTs(), row.id);
      return res.status(500).json({ success: false, error: message });
    }

    const resultValue = workflowData?.data?.outputs?.result
      ?? workflowData?.data?.outputs?.result_json
      ?? workflowData?.outputs?.result
      ?? workflowData?.outputs?.result_json
      ?? workflowData?.result
      ?? workflowData?.answer
      ?? '';

    const normalizeSummaryText = (value) => String(value || '')
      .replace(/[；;]+\s*/g, '。')
      .replace(/[。．.]+\s*/g, '。')
      .replace(/\s*。\s*/g, '。')
      .replace(/。+/g, '。')
      .replace(/[。．.]+$/g, '')
      .trim();
    const cleanSummaryValue = (value) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '';
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            return cleanSummaryValue(JSON.parse(trimmed));
          } catch {
            return normalizeSummaryText(trimmed);
          }
        }
        return normalizeSummaryText(trimmed);
      }
      if (Array.isArray(value)) return value.map((item) => cleanSummaryValue(item));
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, cleanSummaryValue(val)]));
      }
      return value;
    };

    let summaryJson;
    if (typeof resultValue === 'string') {
      const resultStr = resultValue.trim();
      if (!resultStr) {
        return res.status(502).json({ success: false, error: 'Dify 未返回 result 字段' });
      }
      try {
        summaryJson = cleanSummaryValue(JSON.parse(resultStr));
      } catch (e) {
        summaryJson = cleanSummaryValue(resultStr);
      }
    } else if (resultValue && typeof resultValue === 'object') {
      summaryJson = cleanSummaryValue(resultValue);
    } else {
      return res.status(502).json({ success: false, error: 'Dify 未返回可用的摘要内容' });
    }

    db.prepare(
      `UPDATE material_ingest_jobs
       SET summary_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(JSON.stringify(summaryJson), nowTs(), row.id);

    const updatedJob = db.prepare(`SELECT * FROM material_ingest_jobs WHERE id = ?`).get(row.id);
    upsertKnowledgeNodeFromMaterial(updatedJob, summaryJson, {
      name: updatedJob.source_name,
      data_source_type: 'upload_file',
      created_at: Math.floor(Number(updatedJob.created_at || nowTs()) / 1000),
      doc_language: docLanguage,
      segment_count: updatedJob.dify_segment_count,
      word_count: updatedJob.dify_word_count,
      batch_id: updatedJob.dify_batch_id,
      download_url: downloadUrl,
      created_by: '',
    });

    return res.json({ success: true, materialId: row.id, summaryJson, workflowRun: workflowData });
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成摘要失败';
    return res.status(500).json({ success: false, error: message });
  }
});

app.get('/api/material/list', (req, res) => {
  const userId = String(req.query.userId || 'default-user');
  const includeArchived = String(req.query.includeArchived || '') === '1';
  const rows = db.prepare(
    `SELECT * FROM material_ingest_jobs WHERE user_id = ? ${includeArchived ? '' : 'AND archived = 0'} ORDER BY created_at DESC`
  ).all(userId);
  res.json(rows.map((row) => ({ ...row, summary_json: parseJson(row.summary_json, {}) })));
});

app.post('/api/knowledge-node/upsert', (req, res) => {
  const {
    userId = 'default-user',
    moduleName = '',
    topic = '',
    nodeName = '',
    masteryLevel = 0,
    reviewDueAt = null,
    lastPracticedAt = null,
    sourceMaterialId = '',
    extraJson = {},
  } = req.body || {};

  const existed = db.prepare(
    `SELECT * FROM knowledge_nodes WHERE user_id = ? AND module_name = ? AND topic = ? AND node_name = ?`
  ).get(userId, moduleName, topic, nodeName);

  const ts = nowTs();
  if (existed) {
    db.prepare(
      `UPDATE knowledge_nodes
       SET mastery_level = ?, review_due_at = ?, last_practiced_at = ?, source_material_id = ?, extra_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      masteryLevel,
      reviewDueAt,
      lastPracticedAt,
      sourceMaterialId,
      JSON.stringify(extraJson || {}),
      ts,
      existed.id,
    );
    return res.json({ success: true, nodeId: existed.id, status: 'updated' });
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO knowledge_nodes
      (id, user_id, module_name, topic, node_name, mastery_level, review_due_at, last_practiced_at, source_material_id, extra_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    moduleName,
    topic,
    nodeName,
    masteryLevel,
    reviewDueAt,
    lastPracticedAt,
    sourceMaterialId,
    JSON.stringify(extraJson || {}),
    ts,
    ts,
  );

  res.json({ success: true, nodeId: id, status: 'created' });
});

app.get('/api/knowledge-node/list', (req, res) => {
  const userId = String(req.query.userId || 'default-user');
  const sourceMaterialId = String(req.query.sourceMaterialId || '').trim();
  const params = [userId];
  let sql = `SELECT * FROM knowledge_nodes WHERE user_id = ?`;
  if (sourceMaterialId) {
    sql += ` AND source_material_id = ?`;
    params.push(sourceMaterialId);
  }
  sql += ` ORDER BY updated_at DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((row) => ({ ...row, extra_json: parseJson(row.extra_json, {}) })));
});

// 词典查询代理：前端不再直连 Dify（隐藏 token）
app.post('/api/dify/dict-query', async (req, res) => {
  const startedAt = nowTs();
  const {
    word = '',
    dictType = 'en_zh_bidirectional',
    direction = 'auto',
    userContext = '',
    locale = 'zh-CN',
    userId = 'default-user',
  } = req.body || {};

  if (!word || !String(word).trim()) {
    return res.status(400).json({ ok: false, message: '缺少 word' });
  }
  if (!DIFY_DICT_API_KEY) {
    return res.status(500).json({ ok: false, message: '服务端未配置 DIFY_DICT_API_KEY' });
  }

  const workflowUrl = `${DIFY_BASE_URL.replace(/\/$/, '')}/v1/workflows/run`;
  try {
    const response = await fetch(workflowUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DIFY_DICT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          word: String(word).trim(),
          dict_type: dictType,
          direction,
          user_context: userContext,
          locale,
        },
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const msg = await response.text().catch(() => '');
      db.prepare(
        `INSERT INTO dify_call_logs
          (id, user_id, workflow_name, request_hash, status, latency_ms, error_message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        uuidv4(),
        userId,
        'dict-query',
        `${dictType}:${word}`,
        'error',
        nowTs() - startedAt,
        `HTTP ${response.status} ${msg}`.slice(0, 1000),
        nowTs()
      );
      return res.status(response.status).json({ ok: false, message: `Dify 请求失败：HTTP ${response.status}` });
    }

    const data = await response.json();
    const resultStr = data?.data?.outputs?.result;
    if (!resultStr) {
      return res.status(502).json({ ok: false, message: 'Dify 未返回 result 字段' });
    }

    const parsed = JSON.parse(resultStr);
    if (parsed?.payload) {
      ['direction', 'direction_resolved'].forEach((k) => {
        if (k in parsed.payload) parsed.payload[k] = detectDirection(String(word).trim());
      });
    }

    db.prepare(
      `INSERT INTO dify_call_logs
        (id, user_id, workflow_name, request_hash, status, latency_ms, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(uuidv4(), userId, 'dict-query', `${dictType}:${word}`, 'ok', nowTs() - startedAt, '', nowTs());

    return res.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知异常';
    db.prepare(
      `INSERT INTO dify_call_logs
        (id, user_id, workflow_name, request_hash, status, latency_ms, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuidv4(),
      userId,
      'dict-query',
      `${dictType}:${word}`,
      'error',
      nowTs() - startedAt,
      message.slice(0, 1000),
      nowTs()
    );
    return res.status(500).json({ ok: false, message });
  }
});

// ── 主题闭环：防作弊校验 / 定时投喂 / 当前主题 ─────────────────────
app.get('/api/theme/check-mastery', (req, res) => {
  const theme = String(req.query.theme || '').trim();
  const userId = String(req.query.userId || 'default-user');
  if (!theme) {
    return res.status(400).json({ success: false, error: '缺少 theme' });
  }
  try {
    const oralRow = db
      .prepare(
        `SELECT COUNT(*) AS c FROM training_attempts
         WHERE user_id = ? AND scene_type = ? AND module_type = 'oral'`
      )
      .get(userId, theme);
    const oralCount = oralRow && typeof oralRow.c === 'number' ? oralRow.c : 0;

    const writeRow = db
      .prepare(
        `SELECT MAX(score) AS s FROM training_attempts
         WHERE user_id = ? AND scene_type = ? AND module_type = 'write'
           AND json_extract(user_answer_json, '$.writeLevel') = 'L3'`
      )
      .get(userId, theme);
    const maxWriteScore =
      writeRow && writeRow.s != null && !Number.isNaN(Number(writeRow.s)) ? Number(writeRow.s) : 0;

    const isMastered = oralCount >= 10 && maxWriteScore >= 8;

    res.json({
      success: true,
      theme,
      userId,
      oralCount,
      maxWriteScore,
      isMastered,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/api/theme/focus', (req, res) => {
  const userId = String(req.body?.userId || 'default-user');
  const theme = String(req.body?.theme || '').trim();
  const difficulty = String(req.body?.difficulty || 'B2').trim() || 'B2';
  if (!theme) {
    return res.status(400).json({ success: false, error: '缺少 theme' });
  }
  try {
    db.prepare(
      `INSERT INTO theme_focus (user_id, theme, difficulty, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         theme = excluded.theme,
         difficulty = excluded.difficulty,
         updated_at = excluded.updated_at`
    ).run(userId, theme, difficulty, Date.now());
    res.json({ success: true, theme, difficulty });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/api/theme/trigger-feed', async (req, res) => {
  const theme = String(req.body?.theme || '').trim();
  const difficulty = String(req.body?.difficulty || 'B2');
  const userId = String(req.body?.userId || 'default-user');
  try {
    const row = theme
      ? { theme, difficulty }
      : db.prepare(`SELECT theme, difficulty FROM theme_focus WHERE user_id = ?`).get(userId);
    const t = row?.theme || process.env.CRON_DAILY_THEME || '商务谈判：让步与施压';
    const d = row?.difficulty || difficulty || 'B2';
    await runDailyFeeder(db, { theme: theme || t, difficulty: d, userId });
    res.json({ success: true, message: '全自动投喂指令已执行', theme: theme || t, difficulty: d });
  } catch (err) {
    console.error('[trigger-feed]', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

cron.schedule(
  CRON_DAILY_FEEDER,
  () => {
    try {
      const row = db.prepare(`SELECT theme, difficulty FROM theme_focus WHERE user_id = ?`).get('default-user');
      const theme = row?.theme || process.env.CRON_DAILY_THEME || '商务谈判：让步与施压';
      const difficulty = row?.difficulty || 'B2';
      runDailyFeeder(db, { theme, difficulty, userId: 'default-user' }).catch((e) =>
        console.error('[cron daily-feeder]', e)
      );
    } catch (e) {
      console.error('[cron daily-feeder]', e);
    }
  },
  { timezone: process.env.CRON_TZ || 'Asia/Shanghai' }
);
console.log(`[vocab-server] Daily feeder cron: ${CRON_DAILY_FEEDER} (${process.env.CRON_TZ || 'Asia/Shanghai'})`);

// ── 启动 ─────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[vocab-server] 生词本 API 已启动，端口 ${PORT}`);
  console.log(`[vocab-server] 数据库路径：${DB_PATH}`);
});
