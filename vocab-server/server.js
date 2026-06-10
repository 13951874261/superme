const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// 静态文件服务：临时音频文件
const tempAudioDir = path.join(__dirname, 'public', 'temp_audio');
if (!fs.existsSync(tempAudioDir)) {
  fs.mkdirSync(tempAudioDir, { recursive: true });
}
app.use('/api/temp_audio', express.static(tempAudioDir));

// 静态文件服务：长音频文件
const longAudioDir = path.join(__dirname, 'public', 'long_audio');
if (!fs.existsSync(longAudioDir)) {
  fs.mkdirSync(longAudioDir, { recursive: true });
}
app.use('/api/long_audio', express.static(longAudioDir));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3001;

// ==========================================
// 数据库初始化
// 根据 SOP锛岀嚎涓婄粺涓€璺緞涓?/var/www/super-agent/vocab.db
// 鏈湴寮€鍙戝垯鍥炶惤鍒?./vocab.db
// ==========================================
const isProd = process.env.NODE_ENV === 'production' || __dirname.includes('/opt/vocab-server');
const dbPath = isProd ? '/var/www/super-agent/vocab.db' : path.join(__dirname, 'vocab.db');

// 纭繚绾夸笂鐩綍瀛樺湪锛堝鏋滄槸鐢熶骇鐜锛?
if (isProd && !fs.existsSync('/var/www/super-agent')) {
  fs.mkdirSync('/var/www/super-agent', { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 鍒濆鍖?vocabulary 琛?
db.prepare(`
  CREATE TABLE IF NOT EXISTS vocabulary (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    dict_type TEXT,
    category TEXT DEFAULT 'business',
    payload TEXT,
    added_at INTEGER,
    repetitions INTEGER DEFAULT 0,
    ease_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    next_review_date INTEGER,
    last_review_date INTEGER,
    review_history TEXT DEFAULT '[]'
  )
`).run();

// 鑷姩杩佺Щ锛氬鏋滄棫琛ㄦ病鏈?category 瀛楁锛屽垯娣诲姞涔?
try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN category TEXT DEFAULT 'business'").run();
  console.log('Migration: Added category column to vocabulary table.');
} catch (err) {
  // 字段已存在，忽略
}

// 自动迁移：新增 memory_aids 字段
try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN memory_aids TEXT").run();
  console.log('Migration: Added memory_aids column to vocabulary table.');
} catch (err) {
  // 字段已存在，忽略
}

// 初始化字典查询日志表，支持覆盖率统计
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

// 初始化辅助表 (为了不让前端页面报错，提供基础结构)
db.prepare(`CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, title TEXT, created_at INTEGER)`).run();

// 鍒濆鍖?training_sessions 鍜?training_attempts 琛?
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

// 鍒濆鍖?theme_progress 表（邮件通关指标持久化）
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

// 鍒濆鍖?personal_prototypes 琛?
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

// 初始化 custom_themes 表 (自定义主题)
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

// 初始化 generation_history 表 (每日生成历史)
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

// 创建生成历史索引
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_gen_history_theme 
  ON generation_history(user_id, theme, generated_at)
`).run();

// ==========================================
// SM-2 间隔重复算法
// ==========================================
function calculateNextReview(quality, repetitions, easeFactor, interval) {
  let newRepetitions = repetitions;
  let newInterval = interval;
  let newEaseFactor = easeFactor;

  if (quality >= 3) {
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newRepetitions += 1;
  } else {
    newRepetitions = 0;
    newInterval = 1;
  }
  
  newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;
  
  return { repetitions: newRepetitions, easeFactor: newEaseFactor, interval: newInterval };
}

// ==========================================
// 长音频 API
// ==========================================

const longAudiosConfig = require('./config/longAudios.json');

// 获取长音频列表
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

// 获取长音频详情（包含分段）
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

// ==========================================
// 1. 核心业务 API (Vocab)
// ==========================================

// 获取统计信息
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

// 获取全量列表
app.get('/api/vocab/list', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM vocabulary ORDER BY added_at DESC').all();
    const formatted = rows.map(r => ({
      ...r,
      payload: r.payload ? JSON.parse(r.payload) : {},
      review_history: r.review_history ? JSON.parse(r.review_history) : []
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 获取今日复习
app.get('/api/vocab/review', (req, res) => {
  try {
    const now = Date.now();
    const rows = db.prepare('SELECT * FROM vocabulary WHERE next_review_date <= ? AND repetitions < 999 ORDER BY next_review_date ASC').all(now);
    res.json(rows.map(r => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : {} })));
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 添加词汇
app.post('/api/vocab/add', (req, res) => {
  try {
    const { word, dictType, category = 'business', payload } = req.body;
    
    // 查重
    const existing = db.prepare('SELECT id FROM vocabulary WHERE word = ? COLLATE NOCASE').get(word);
    if (existing) {
      return res.json({ success: false, message: '词条已存在', id: existing.id });
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, word, dictType, category, JSON.stringify(payload || {}), now, now, '[]');
    
    res.json({ success: true, id, message: '存入成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// 批量添加词汇 (专供 Dify 宸ヤ綔娴?HTTP 鍥炶皟鑺傜偣鎺ㄩ€佹暟鎹?
app.post('/api/vocab/batch-add', (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Expected a JSON array of vocabulary items' });
    }

    let addedCount = 0;
    const now = Date.now();

    // 寮€鍚?SQLite 浜嬪姟锛岀‘淇濆師瀛愭€у拰鏋侀€熸壒閲忓啓鍏?
    const insertMany = db.transaction((words) => {
      for (const item of words) {
        const word = item.word;
        if (!word) continue;
        
        const dictType = item.dictType || item.dict_type || 'ai_extracted';
        const category = item.category || 'business';
        const payload = item.payload || {};

        // 涓ユ牸鏌ラ噸锛屾棤瑙嗗ぇ灏忓啓锛岄槻姝㈡薄鏌撶敤鎴风幇鏈夎瘝搴?        const existing = db.prepare('SELECT id FROM vocabulary WHERE word = ? COLLATE NOCASE').get(word);
        if (!existing) {
          const id = crypto.randomUUID();
          db.prepare(`
            INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, word, dictType, category, JSON.stringify(payload), now, now, '[]');
          addedCount++;
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

// 更新词条
app.patch('/api/vocab/update_payload/:id', (req, res) => {
  try {
    db.prepare('UPDATE vocabulary SET payload = ? WHERE id = ?').run(JSON.stringify(req.body.payload), req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 全面更新词条（支持修改单词、分区弰 payload锛?
app.put('/api/vocab/update/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { word, category, payload } = req.body;
    db.prepare('UPDATE vocabulary SET word = ?, category = ?, payload = ? WHERE id = ?')
      .run(word, category, JSON.stringify(payload || {}), id);
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('Update vocab error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 提交复习结果
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

// 人工干预
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

// 删除词条
app.delete('/api/vocab/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM vocabulary WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ==========================================
// 姣忔棩閰嶉琛紙鐢ㄤ簬鑻辫寮曟搸璇嶆眹鎺ㄩ€侀噺鎺у埗锛?// ==========================================
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
// 2. 鍗犱綅涓庡吋瀹瑰瓨鏍?(鍙婃牳蹇冭缁冧笟鍔?API)
// ==========================================

// Upsert 训练 Session
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

// 鑾峰彇鏌愬ぉ鐨?Session 详情
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

// 创建训练 Attempt
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

// 提交 Feedback
app.post('/api/training/feedback', (req, res) => {
  res.json({ success: true, feedbackId: crypto.randomBytes(16).toString('hex'), status: 'archived' });
});

// 妫€鏌ヤ富棰樻槸鍚﹁揪鏍?(口语 + 写作 + 邮件)
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

app.post('/api/theme/focus', (req, res) => res.json({ success: true, theme: req.body.theme || 'default' }));

// 标记某主题邮件通关
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
// 自定义场景与主题管理 API
// ==========================================

// 创建自定义主题
app.post('/api/theme/custom-add', async (req, res) => {
  const { themeName, file, userId = 'default-user' } = req.body;

  if (!themeName || !file) {
    return res.status(400).json({ success: false, error: '缺少必要参数 themeName 或 file' });
  }

  const DATASET_KEY = 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
  const WORKFLOW_KEY = 'app-F6daqhSXH942sBrnGki4kzZq';
  const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

  try {
    // 1. 获取知识库列表，定位 English_Pro_Scenarios
    const dsResponse = await fetch(`${BASE_URL}/datasets?page=1&limit=100`, {
      headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
    });
    const dsData = await dsResponse.json();
    const dataset = dsData.data?.find(d => d.name === 'English_Pro_Scenarios');
    
    if (!dataset) {
      throw new Error('在 Dify 平台未找到名为 English_Pro_Scenarios 的知识库');
    }
    const datasetId = dataset.id;

    // 2. 上传文件到知识库（注意：不执行清空操作，以保留其他自定义主题文档）
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

    // 3. 轮询向量化索引状态
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

    // 4. 调用工作流 A 运行主题萃取
    const wfResponse = await fetch(`${BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKFLOW_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: { 
          custom_theme_name: themeName,
          topic: themeName
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

    // 5. 写入 custom_themes 表
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

    // 6. 词汇与短语同步静默入库，以便用户立刻可用
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

// 获取所有自定义主题
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

// 删除自定义主题 (精确删除知识库对应文档)
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

// 获取停留天数和薄弱点分析数据
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
// 处理字典查询请求（对接真实的 Dify 字典工作流）
app.post('/api/dify/dict-query', async (req, res) => {
  const { word, dictType, direction = 'auto', userContext = '', locale = 'zh-CN', userId = 'frontend-panel' } = req.body;

  if (!word) {
    return res.status(400).json({ ok: false, message: 'Please input a word to query.' });
  }

  const DIFY_DICT_API_KEY = 'app-zGyrsyvvzHAIO5yx11OcYdpa';
  const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

  try {
    console.log(`[Dict Query] 开始查询词条: "${word}", 字典类型: "${dictType}"`);

    const response = await fetch(`${BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_DICT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          word: word.trim(),
          dict_type: dictType || 'en_zh_bidirectional',
          direction: direction || 'auto',
          user_context: userContext || '',
          locale: locale || 'zh-CN'
        },
        response_mode: 'blocking',
        user: userId || 'frontend-panel'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Dict Query] Dify 服务器返回错误(${response.status}):`, errText);
      
      // 记录失败日志
      try {
        db.prepare(`
          INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(crypto.randomUUID(), word.trim(), dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify({ error: errText }), Date.now());
      } catch (logErr) {}

      return res.status(response.status).json({ ok: false, message: `Dify 服务器异常: ${response.status}` });
    }

    const data = await response.json();
    const resultStr = data?.data?.outputs?.result;

    if (!resultStr) {
      console.warn('[Dict Query] 工作流未返回 result 字段:', data);
      
      // 记录失败日志
      try {
        db.prepare(`
          INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(crypto.randomUUID(), word.trim(), dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify({ error: 'Missing result in outputs', raw: data }), Date.now());
      } catch (logErr) {}

      return res.status(500).json({ ok: false, message: 'Dify 工作流未返回正确的 result 字段' });
    }

    // 解析工作流输出结果
    let parsedResult;
    try {
      parsedResult = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr;
    } catch (e) {
      console.error('[Dict Query] 解析 result JSON 失败:', e, resultStr);
      
      // 记录解析错误日志
      try {
        db.prepare(`
          INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(crypto.randomUUID(), word.trim(), dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify({ error: 'JSON parse error', raw: resultStr }), Date.now());
      } catch (logErr) {}

      return res.status(500).json({ ok: false, message: '工作流结果解析异常，返回数据非合法 JSON' });
    }

    // 记录成功日志
    try {
      db.prepare(`
        INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(crypto.randomUUID(), word.trim(), dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify(parsedResult), Date.now());
    } catch (logErr) {}

    console.log(`[Dict Query] 查询 "${word}" 成功，返回结果`, Object.keys(parsedResult?.payload || {}));
    return res.json(parsedResult);
  } catch (error) {
    console.error('[Dict Query] 服务端请求异常', error);
    return res.status(500).json({ ok: false, message: `词典服务器异常: ${error.message}` });
  }
});

// 英语公文纵深批阅代理接口 (对接 Dify 写作批阅工作流)
app.post('/api/dify/write-review', async (req, res) => {
  const { user_text, mail_intent, theme } = req.body;
  if (!user_text || !mail_intent || !theme) {
    return res.status(400).json({ success: false, error: 'Missing required parameters: user_text, mail_intent, or theme.' });
  }

  const apiKey = process.env.DIFY_WRITE_GOVERNANCE_KEY || 'app-l4RcdCyDTzUPnY0GHlsgrUcs';
  const baseUrl = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

  try {
    console.log(`[Write Review] 开始进行书面批阅评估，主题: "${theme}"`);

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
          theme: theme.trim()
        },
        response_mode: 'blocking',
        user: 'system-agent'
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
      const cleanJson = String(resultStr).replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
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
    return res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('[Write Review] 服务端请求异常', error);
    return res.status(500).json({ success: false, error: `服务器内部异常: ${error.message}` });
  }
});


// 获取词典查询覆盖率统计
app.get('/api/dify/dict-coverage', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM dict_query_log').get().count;
    const success = db.prepare('SELECT COUNT(*) as count FROM dict_query_log WHERE is_success = 1').get().count;
    const successRate = total > 0 ? (success / total * 100).toFixed(2) : 0;

    const rows = db.prepare('SELECT response_payload FROM dict_query_log WHERE is_success = 1').all();
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
      try {
        const parsed = JSON.parse(r.response_payload);
        const level = parsed?.payload?.level || parsed?.level;
        if (level && levelCounts[level] !== undefined) {
          levelCounts[level]++;
        } else if (level) {
          levelCounts['其他']++;
        } else {
          levelCounts['未分类']++;
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
// 记忆辅助与艾宾浩斯曲线相关 API
// ==========================================

// 获取生词本已缓存的记忆辅助
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

// 调用 Dify 记忆辅助生成引擎生成联想记忆
app.post('/api/vocab/enrich-memory/:id', async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Word not found' });
    }

    const payload = row.payload ? JSON.parse(row.payload) : {};
    const word = row.word;
    
    let phonetic = payload.phonetic || '';
    let pos = payload.pos || '';
    let definition = payload.definition || payload.translation_main || '';
    if (Array.isArray(payload.definitions_en)) {
      definition += (definition ? '; ' : '') + payload.definitions_en.join('; ');
    }
    let examples = '';
    if (Array.isArray(payload.example_sentences)) {
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
          examples: examples || ''
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

// 获取艾宾浩斯复习历史及理论曲线数据
app.get('/api/vocab/ebbinghaus/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT id, word, repetitions, interval_days, next_review_date, added_at, review_history FROM vocabulary WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Word not found' });
    }

    const history = row.review_history ? JSON.parse(row.review_history) : [];
    const addedAt = row.added_at;

    // 生成标准的艾宾浩斯理论遗忘曲线点(Day 0 到 Day 30)
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

    // 映射真实的复习历史点（初次收录为 Day 0）
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

// 生成记忆图片（调用 text2image 工作流）
app.post('/api/vocab/generate-image/:id', async (req, res) => {
  try {
    const row = db.prepare('SELECT id, word, memory_aids FROM vocabulary WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Word not found' });
    }

    let memoryAids = {};
    try { memoryAids = JSON.parse(row.memory_aids || '{}'); } catch {}

    if (!memoryAids.image_prompt) {
      return res.status(400).json({ error: 'No image_prompt found, please generate memory aids first' });
    }

    const text2imageApiKey = process.env.DIFY_TEXT2IMAGE_API_KEY || 'app-P3RxMjvtrhr2rFAXqKcfGSFA';
    const difyBaseUrl = process.env.DIFY_TEXT2IMAGE_BASE_URL || 'https://dify.234124123.xyz/v1';

    console.log(`[generate-image] Calling text2image workflow for prompt: "${memoryAids.image_prompt}"`);

    const chatResp = await fetch(`${difyBaseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${text2imageApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: memoryAids.image_prompt,
        response_mode: 'blocking',
        user: 'default-user',
      }),
    });

    const chatData = await chatResp.json().catch(() => ({}));
    if (!chatResp.ok) {
      console.error('[generate-image] Dify error:', chatData);
      return res.status(502).json({ error: 'Image generation failed', detail: chatData.message });
    }

    // 解析返回的图片 URL
    let imageUrl = '';
    let downloadUrl = '';

    if (chatData.preview) {
      imageUrl = chatData.preview;
    } else if (chatData.previews && chatData.previews.length > 0) {
      imageUrl = chatData.previews[0].url;
    }

    // 尝试从 answer 中提取 URL
    if (!imageUrl && chatData.answer) {
      let parsed = null;
      let cleanAnswer = chatData.answer.trim();
      if (cleanAnswer.startsWith('```')) {
        cleanAnswer = cleanAnswer.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1').trim();
      }
      try {
        parsed = JSON.parse(cleanAnswer);
      } catch (e) {
        const jsonMatch = cleanAnswer.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[0]); } catch (e2) {}
        }
      }

      if (parsed) {
        imageUrl = parsed.url || parsed.image_url || parsed.imageUrl || '';
        downloadUrl = parsed.download_url || parsed.downloadUrl || imageUrl || '';
      }

      if (!imageUrl) {
        const urlMatches = [...chatData.answer.matchAll(/(https?:\/\/[^\s"'`<>\{\}\[\]]+\.(jpg|jpeg|png|webp))/gi)];
        if (urlMatches.length > 0) {
          imageUrl = urlMatches[0][1];
          downloadUrl = urlMatches.length > 1 ? urlMatches[1][1] : imageUrl;
        }
      }
    }

    if (!imageUrl) {
      return res.status(502).json({ error: 'No image URL in response', raw: JSON.stringify(chatData).substring(0, 500) });
    }

    if (!downloadUrl) {
      downloadUrl = imageUrl;
    }

    // 更新数据库
    memoryAids.image_url = imageUrl;
    memoryAids.download_url = downloadUrl;
    memoryAids.image_generated_at = Date.now();

    db.prepare('UPDATE vocabulary SET memory_aids = ? WHERE id = ?')
      .run(JSON.stringify(memoryAids), row.id);

    res.json({
      success: true,
      id: row.id,
      image_url: imageUrl,
      download_url: downloadUrl,
    });
  } catch (error) {
    console.error('[generate-image] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 澶勭悊鐗╂枡鎻愮函瑙ｆ瀽璇锋眰锛堢湡瀹?Dify 鑱斿姩锛氭壘搴?-> 清空 -> 上传 -> 工作流抽提）
app.post('/api/material/process-and-extract', async (req, res) => {
  const { topic, userId, files } = req.body;
  
  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: '未接收到有效文件数据' });
  }

  // 严格实施双密钥隔离机制
  const DATASET_KEY = 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
  const WORKFLOW_KEY = 'app-cArGQg7bAnePU0ts63FoHrAG';
  const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

  try {
    // ---------------------------------------------------------
    // 鍔ㄤ綔涓€锛氳幏鍙栫煡璇嗗簱鍒楄〃锛岀簿纭畾浣?English_Pro_Scenarios
    // ---------------------------------------------------------
    const dsResponse = await fetch(`${BASE_URL}/datasets?page=1&limit=100`, {
      headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
    });
    const dsData = await dsResponse.json();
    const dataset = dsData.data?.find(d => d.name === 'English_Pro_Scenarios');
    
    if (!dataset) {
      throw new Error('鍦?Dify 骞冲彴鏈壘鍒板悕涓?English_Pro_Scenarios 的知识库');
    }
    const datasetId = dataset.id;

    // ---------------------------------------------------------
    // 动作二：暴力清场，无情删除旧文件
    // ---------------------------------------------------------
    const docsResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/documents?page=1&limit=100`, {
      headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
    });
    const docsData = await docsResponse.json();
    const docIds = docsData.data?.map(d => d.id) || [];
    
    // 开启并发屠杀，清空知识库
    if (docIds.length > 0) {
      await Promise.all(docIds.map(docId => 
        fetch(`${BASE_URL}/datasets/${datasetId}/documents/${docId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
        })
      ));
    }

    // ---------------------------------------------------------
    // 动作三：物理重铸，组装上传新弹药
    // ---------------------------------------------------------
    const fileObj = files[0];
    const base64Data = fileObj.content || fileObj.base64 || '';
    const base64Content = base64Data.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');
    
    // 使用 Node 18+ 的全局 Blob 涓?FormData 装配二进制大文件
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const formData = new FormData();
    formData.append('file', blob, fileObj.fileName || 'upload_material.pdf');
    // 鍏抽敭淇锛氱煡璇嗗簱浣跨敤浜嗏€滅埗瀛愭枃鏈垎鍧椻€?Hierarchical)
    // 蹇呴』鎻愪緵瀹屾暣鐨?rules (包括 pre_processing_rules 鍜?subchunk_segmentation)
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
      throw new Error(`Dify 文件入库遭拒: ${errText}`);
    }

    const uploadData = await uploadResponse.json();
    const documentId = uploadData.document?.id;
    const batchId = uploadData.batch; 

    if (!documentId || !batchId) {
      throw new Error('鏂囦欢宸插彂閫侊紝浣嗘湭浠?Dify 拿到 batch ID 导致无法跟踪');
    }

    console.log(`[Material] 文档上传成功 (ID: ${documentId}, Batch: ${batchId})锛屾鍦ㄩ攣瀹氱瓑寰呭悜閲忚寮?..`);

    // ---------------------------------------------------------
    // 鍔ㄤ綔涓夌偣浜旓細楂橀杞鏌ヨ鏂囨。宓屽叆鐘舵€?(鑾峰彇娴佹按绾胯繘搴?
    // ---------------------------------------------------------
    let isIndexed = false;
    // 设定 40 次轮询，每次 3 秒，总计容忍等待 120 绉掞紝缁濅笉楗挎澶фā鍨?
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${batchId}/indexing-status`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
      });
      
      if (!statusRes.ok) continue; // 鍋跺彂缃戠粶鎶栧姩鐩存帴蹇界暐锛岃繘鍏ヤ笅涓€杞?      
      const statusData = await statusRes.json();
      // 鑾峰彇娴佹按绾垮祵鍏ョ姸鎬?(返回值为数组格式)
      const docInfo = statusData.data?.[0];
      
      if (docInfo) {
        console.log(`[Material] 绗?${i + 1} 娆¤繘搴︽壂鎻? status = ${docInfo.indexing_status}`);
        if (docInfo.indexing_status === 'completed') {
          isIndexed = true;
          break;
        } else if (docInfo.indexing_status === 'error') {
          throw new Error('Dify 流水线切分报错，请前往后台查看原因');
        }
      }
    }

    if (!isIndexed) {
      throw new Error('Dify indexing timeout (>120s).');
    }

    console.log(`[Material] 向量装弹完毕！准许放行唤醒大模型...`);

    // ---------------------------------------------------------
    // 鍔ㄤ綔鍥涳細缁堟瀬鎶芥彁锛屽敜閱掑ぇ妯″瀷姒ㄥ彇鏍稿績璇嶆眹骞跺叆搴?    // ---------------------------------------------------------
    const wfResponse = await fetch(`${BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKFLOW_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: { topic: topic || 'General Business' },
        response_mode: 'blocking',
        user: userId || 'system'
      })
    });
    
    const wfData = await wfResponse.json();
    if (!wfResponse.ok) throw new Error(`宸ヤ綔娴佹墽琛屽け璐? ${JSON.stringify(wfData)}`);
    
    // 解析工作流输出（由于具体工作流的输出变量名不明确，兼容常见字段结构）
    const outputs = wfData?.data?.outputs || {};
    // 鍋囪澶фā鍨嬭繑鍥炰簡涓€涓互閫楀彿鍒嗛殧鐨勫瓧绗︿覆锛屾屾垨鑰?JSON 数组
    const rawExtracted = outputs.extracted_words || outputs.result || outputs.text || '';
    
    let extractedWords = [];
    if (Array.isArray(rawExtracted)) {
      extractedWords = rawExtracted;
    } else if (typeof rawExtracted === 'string') {
      // 暴力正则：切分并清理
      extractedWords = rawExtracted.split(/[,，\n]+/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 50);
    }
    
    // 静默写入 SQLite 鐢熻瘝鏈?(瑙勯伩閲嶅椤?
    let addedCount = 0;
    const now = Date.now();
    for (const item of extractedWords) {
      const wordStr = typeof item === 'object' ? (item.word || JSON.stringify(item)) : item;
      const existing = db.prepare('SELECT id FROM vocabulary WHERE word = ? COLLATE NOCASE').get(wordStr);
      if (!existing) {
        const id = crypto.randomUUID();
        db.prepare(`
          INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, wordStr, 'ai_extracted', topic || 'material_extraction', JSON.stringify({ source: 'Material Upload' }), now, now, '[]');
        addedCount++;
      }
    }

    res.json({
      success: true,
      topic: topic || 'Unknown Topic',
      total: files.length,
      results: [
        {
          fileName: fileObj.fileName || "Document",
          summary: `Closed loop completed: cleared ${docIds.length} old documents, new file imported successfully. Model extracted ${extractedWords.length} terms, actual added ${addedCount} words.`,
          key_points: extractedWords.slice(0, 5) // 向前端展示前5个核心词
        }
      ],
      logs: [
        "1. Dify 知识库定位并清空完成",
        "2. Memory Base64 conversion and physical storage success.",
        `3. AI 钀冨彇涓?SQLite 固化完毕 (新增: ${addedCount})`
      ]
    });
  } catch (error) {
    console.error('Material Pipeline Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 英语引擎每日词汇+鐭鎻愮函锛堝甫姣忔棩閰嶉鎺у埗锛?// 纭寚鏍囷細姣忔棩鏈€澶?50 词汇 + 30 短语
// ==========================================
app.post('/api/english/clear-today', (req, res) => {
  const { userId = 'default-user' } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  // 计算今日当地时间的 00:00:00 毫秒数
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  try {
    // 1. 删除今日生成的单词与短语
    const deleteWords = db.prepare("DELETE FROM vocabulary WHERE added_at >= ? AND (dict_type = 'ai_extracted' OR dict_type = 'ai_phrase')");
    const wordsResult = deleteWords.run(todayStartMs);

    // 2. 重置今日配额记录
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

const WORD_DAILY_LIMIT = 50;
const PHRASE_DAILY_LIMIT = 30;

app.post('/api/english/daily-extract', async (req, res) => {
  const { topic, materialText, userId = 'default-user', cefrLevel = 'B1', genre = 'meeting' } = req.body;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // Step 1: 鑾峰彇鎴栧垱寤轰粖鏃ラ厤棰濊褰?
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

    // Step 2.5: 构建去重上下文 (history_exclude) 与薄弱点 (user_flaws)
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

    // Step 2: 妫€鏌ラ厤棰?
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

    // Step 3: 调用 Dify 宸ヤ綔娴佹彁绾瘝姹?
    const difyApiKey = process.env.VITE_DIFY_ENGLISH_MASTERY_KEY || 'app-OShKY1EcVuLFkuxrpO28ZB0A';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    // 鏋勯€犺緭鍏ヨ鏂欙細浼樺厛鐢?materialText，否则用 topic 鑷韩鐢熸垚鎻愮ず璇?
    const inputText = materialText?.trim() || topic || '';

    let vocabList = [];
    let phraseList = [];

    if (inputText) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲区
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }
      // 写入 SSE 注释行，强制 Nginx/Cloudflare 立即冲刷 Response Header 给客户端，防止超时
      res.write(":\n\n");

      // 启动心跳定时器，每 15 秒向客户端发送一次空注释行，维持 TCP 活跃以绕过 Cloudflare 100秒超时机制
      const heartbeatInterval = setInterval(() => {
        if (!res.writableEnded) {
          res.write(":\n\n");
        }
      }, 15000);

      // 无论响应正常结束还是连接异常关闭，均清除定时器防止内存泄漏
      res.on('finish', () => clearInterval(heartbeatInterval));
      res.on('close', () => clearInterval(heartbeatInterval));

      // 流式获取 Chatflow 响应并直通给前端
      let wfResponse;
      try {
        wfResponse = await fetch(`${baseUrl}/chat-messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${difyApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: { 
              theme: topic || "General Business", 
              cefr_level: cefrLevel, 
              genre: genre,
              history_exclude: historyExclude,
              user_flaws: userFlaws
            },
            query: "generate",
            response_mode: "streaming",
            user: userId,
          }),
        });
      } catch (fetchErr) {
        console.error("[Daily Extract] Dify fetch 请求发起失败:", fetchErr);
        res.write(`data: ${JSON.stringify({ success: false, error: `Dify 服务请求发起失败: ${fetchErr.message}` })}\n\n`);
        res.end();
        return;
      }

      if (!wfResponse.ok) {
        const errText = await wfResponse.text();
        console.error("[Daily Extract] Dify 工作流失败", errText);
        res.write(`data: ${JSON.stringify({ success: false, error: `Dify 工作流异常: ${wfResponse.status} - ${errText}` })}\n\n`);
        res.end();
        return;
      }

      let answer = "";
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
              if (parsed.answer) {
                answer += parsed.answer;
              }
            } catch (e) {
              // 容错：忽略数据块被截断产生的临时解析失败
            }
          }
          lineEnd = sseBuffer.indexOf('\n');
        }
      };

      if (wfResponse.body) {
        if (typeof wfResponse.body.getReader === 'function') {
          const reader = wfResponse.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            
            // 瀹炴椂灏?Dify 鍘熷鏁版嵁鍧楄浆鍙戠粰鍓嶇娴忚鍣?            res.write(chunk);
            parseSSELines(chunk);
          }
        } else {
          for await (const chunk of wfResponse.body) {
            res.write(chunk);
            const chunkText = decoder.decode(chunk, { stream: true });
            parseSSELines(chunkText);
          }
        }
        
        // 鎵熬宸ヤ綔锛氳В鏋愭渶鍚庢畫瀛樼殑缂撳啿鍖烘暟鎹?
        if (sseBuffer.trim().startsWith("data: ")) {
          const line = sseBuffer.trim();
          const dataStr = line.slice(6).trim();
          if (dataStr !== "[DONE]") {
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.answer) {
                answer += parsed.answer;
              }
            } catch (e) {}
          }
        }
      } else {
        throw new Error("Streaming not supported, please use blocking mode");
      }

      // 鎺ユ敹瀹屾瘯鍚庯紝鍦ㄥ悗鍙拌繘琛岃瘝姹囧拰鐭鎻愬彇涓?SQLite 入库
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
        } catch(e) {
          console.error("[Daily Extract] Failed to parse vocab JSON:", e);
        }
      }

      // 閲嶆槧灏勬暟鎹牸寮忎负鏍囧噯搴撶粨鏋?
      vocabList = parsedVocab.map(item => {
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
            examples: payload.examples || item.examples || []
          };
        }
        return { word: String(item) };
      }).filter(x => x.word);

      const allExamples = [];
      for (const item of vocabList) {
        if (item && Array.isArray(item.examples)) {
          allExamples.push(...item.examples);
        }
      }

      const rawPhrases = parsedPhrases || [];
      if (Array.isArray(rawPhrases)) {
        for (const p of rawPhrases) {
          if (typeof p === 'string') {
            allExamples.push(p);
          } else if (typeof p === 'object' && p !== null) {
            allExamples.push(p.phrase || p.phrase_text || p.sentence || p.text || JSON.stringify(p));
          }
        }
      }
      phraseList = [...new Set(allExamples)].map(s => s.trim()).filter(s => s && s.length < 500);

      // 后期配额存库逻辑
      const wordsToStore = vocabList.slice(0, wordsLeft);
      const phrasesToStore = phraseList.slice(0, phrasesLeft);

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
            `).run(id, w, 'ai_extracted', topic || 'daily_extraction', JSON.stringify(payload), now, now, '[]');
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
            `).run(id, p, 'ai_phrase', topic || 'daily_extraction', JSON.stringify({ source: 'Daily Extract', topic, type: 'phrase' }), now, now, '[]');
            phrasesAddedCount++;
          }
        }
      });
      insertPhrase(phrasesToStore);

      db.prepare(`
        UPDATE daily_vocab_quota
        SET words_added = words_added + ?, phrases_added = phrases_added + ?, last_extraction_at = ?, updated_at = ?
        WHERE user_id = ? AND quota_date = ?
      `).run(wordsAddedCount, phrasesAddedCount, now, now, userId, today);

      const updatedWordsUsed = (quotaRow.words_added || 0) + wordsAddedCount;
      const updatedPhrasesUsed = (quotaRow.phrases_added || 0) + phrasesAddedCount;

      // 写入生成历史
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
        console.warn('[Daily Extract] 流式写入生成历史失败:', e.message);
      }

      console.log(`[Daily Extract] Completed. User ${userId} ${today} added ${wordsAddedCount} words, ${phrasesAddedCount} phrases.`);

      // 鍙戦€佹祦缁撴潫鏍囪锛屽苟闄勫甫鏈€缁堢殑鍏ュ簱鍜岀粺璁?JSON 数据作为最后一部分事件
      const finalPayload = {
        success: true,
        message: `Extraction complete: added ${wordsAddedCount} words, ${phrasesAddedCount} phrases.`,
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
        article: articleText,
        wordCount: wordsToStore.length,
        phraseCount: phrasesToStore.length,
        wordsAddedCount,
        phrasesAddedCount,
      };

      res.write(`\ndata: ${JSON.stringify(finalPayload)}\n\n`);
      setTimeout(() => {
        res.end();
      }, 100);
      return;
    } else {
      // 鏃犺緭鍏ヨ鏂欐椂锛屼粎杩斿洖褰撳墠閰嶉鐘舵€?
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

    // Step 4: 严格配额截取——只取剩余配额量
    const wordsToStore = vocabList.slice(0, wordsLeft);
    const phrasesToStore = phraseList.slice(0, phrasesLeft);

    // Step 5: 鎵归噺鍐欏叆璇嶆眹锛堝甫鏌ラ噸涓庝赴瀵?Payload锛?
    
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
          `).run(id, w, 'ai_extracted', topic || 'daily_extraction', JSON.stringify(payload), now, now, '[]');
          wordsAddedCount++;
        }
      }
    });
    insertWord(wordsToStore);

    // Step 6: 批量写入短语（存储在 extra_json 涓紝鎴栫嫭绔嬭〃锛?
    let phrasesAddedCount = 0;
    const insertPhrase = db.transaction((phrases) => {
      for (const phraseStr of phrases) {
        const p = typeof phraseStr === 'string' ? phraseStr.trim() : String(phraseStr);
        if (!p || p.length > 500) continue;
        // 短语用查重逻辑
        const existingPhrase = db.prepare(
          "SELECT id FROM vocabulary WHERE dict_type = 'ai_phrase' AND payload LIKE ? COLLATE NOCASE"
        ).get(`%${p.substring(0, 50)}%`);
        if (!existingPhrase) {
          const id = crypto.randomUUID();
          db.prepare(`
            INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, p, 'ai_phrase', topic || 'daily_extraction', JSON.stringify({ source: 'Daily Extract', topic, type: 'phrase' }), now, now, '[]');
          phrasesAddedCount++;
        }
      }
    });
    insertPhrase(phrasesToStore);

    // Step 7: 更新配额记录
    db.prepare(`
      UPDATE daily_vocab_quota
      SET words_added = words_added + ?, phrases_added = phrases_added + ?, last_extraction_at = ?, updated_at = ?
      WHERE user_id = ? AND quota_date = ?
    `).run(wordsAddedCount, phrasesAddedCount, now, now, userId, today);

    const updatedWordsUsed = (quotaRow.words_added || 0) + wordsAddedCount;
    const updatedPhrasesUsed = (quotaRow.phrases_added || 0) + phrasesAddedCount;

    // 写入生成历史
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
        "",
        JSON.stringify(wordsToStore.map(w => w.word))
      );
    } catch (e) {
      console.warn('[Daily Extract] 非流式写入生成历史失败:', e.message);
    }

    console.log(`[Daily Extract] User ${userId} ${today} added words: ${wordsAddedCount}, phrases: ${phrasesAddedCount}`);

    res.json({
      success: true,
      message: `Extraction complete: added ${wordsAddedCount} words, ${phrasesAddedCount} phrases.`,
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
      wordCount: wordsToStore.length,
      phraseCount: phrasesToStore.length,
      wordsAddedCount,
      phrasesAddedCount,
    });
  } catch (error) {
    console.error('[Daily Extract] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      try {
        res.write(`data: ${JSON.stringify({ success: false, error: error.message })}\n\n`);
        res.end();
      } catch (writeErr) {
        console.error('[Daily Extract] Failed to write error to stream:', writeErr);
      }
    }
  }
});

// 鏌ヨ姣忔棩閰嶉鐘舵€?
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

// 澶勭悊鑷姩鍙戣捣鑻辨枃缁冧範灞€鐨勮姹傦紙淇濇寔鍚戝悗鍏煎锛屼粛涓?Mock锛?
app.post('/api/dify/run-english-mastery', (req, res) => {
  const { topic, materialText } = req.body;
  res.json({
    success: true,
    message: "Successfully initiated training session (Mock).",
    topic: topic,
    result: { scene: "模拟测试局", content: "杩欐槸浠跨湡绯荤粺杩斿洖鐨勮缁冩暟鎹?.." }
  });
});

// ==========================================
// 发音纠正 API (Pronunciation Assessment)
// 调用 Dify 宸ヤ綔娴佽繘琛屽彂闊宠瘎浼?// ==========================================
app.post('/api/pronunciation-assessment', async (req, res) => {
  const { targetText, recognizedText, userId = 'default-user' } = req.body;

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
        inputs: {
          target_text: targetText,
          recognized_text: recognizedText || '',
        },
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Dify 发音纠正请求失败:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify 请求失败: ${response.status}` });
    }

    const data = await response.json();
    console.log('Dify 原始返回:', JSON.stringify(data, null, 2));

    // 提取评测结果 - 工作流现在返回结构化 JSON
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
// 商务语法润色 API (Grammar Polish)
// 调用 Dify 工作流进行高管级语法重构
// ==========================================
app.post('/api/grammar-polish', async (req, res) => {
  const { originalText, userId = 'default-user' } = req.body;

  if (!originalText) {
    return res.status(400).json({ success: false, error: '缺少原始文本 (originalText)' });
  }

  try {
    // 浼樺厛璇诲彇鐜鍙橀噺锛屼弗鏍艰惤瀹炴棤鐘舵€佸鐏炬満鍒?(纭紪鐮佺湡瀹?Key 兜底)
    const difyApiKey = process.env.DIFY_GRAMMAR_API_KEY || 'app-547Sa5oIC3Qb9RUZdasJs1Ef';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          original_text: originalText, // 对应 yml 里的 start 节点变量
        },
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Dify 语法润色请求失败:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify 请求失败: ${response.status}` });
    }

    const data = await response.json();
    console.log('Dify 语法润色原始返回:', JSON.stringify(data, null, 2));

    // 根据 Grammar_Polish_Engine.yml 瀹氫箟锛岃緭鍑鸿妭鐐圭殑鍙橀噺鍚嶇О涓?polished_result
    const polishedText = data?.data?.outputs?.polished_result || '鏈幏鍙栧埌娑﹁壊缁撴灉锛岃妫€鏌ュ伐浣滄祦閰嶇疆銆';

    res.json({
      success: true,
      polishedText
    });
  } catch (err) {
    console.error('语法润色 API 异常:', err);
    res.status(500).json({ success: false, error: '语法润色服务异常' });
  }
});

// ==========================================
// 3. 驭心博弈相关 API (Game Theory & Prototypes)
// ==========================================

// 杩愯椹績鍗氬紙宸ヤ綔娴侊紝骞惰嚜鍔ㄦ寔涔呭寲鎻愬彇鍑烘潵鐨勪汉鎬у師鍨?
app.post('/api/game-theory/analyze', async (req, res) => {
  const { scene_type, game_model, case_text, user_answer, applied_tactics, userId = 'default-user' } = req.body;

  if (!case_text || !user_answer) {
    return res.status(400).json({ success: false, error: '缂哄皯鍗辨満鍦烘櫙鎴栧绛栧唴瀹?' });
  }

  try {
    const difyApiKey = process.env.VITE_DIFY_GAME_THEORY_KEY || 'app-YysFumsmeSAeJaQMobMpW24r';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          scene_type,
          game_model,
          case_text,
          user_answer,
          applied_tactics: applied_tactics || ''
        },
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Dify 博弈引擎请求失败:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify 请求失败: ${response.status}` });
    }

    const data = await response.json();
    
    // 瑙ｆ瀽宸ヤ綔娴佽緭鍑?    const rawResult = data?.data?.outputs?.analysis_result ?? data?.data?.outputs?.result ?? data?.answer ?? data?.message ?? '';
    const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanJson);
    } catch (e) {
      console.error('解析 Dify 杩斿洖鐨?JSON 失败:', e, rawResult);
      return res.status(500).json({ success: false, error: '鍗氬紙鍒嗘瀽缁撴灉鏍煎紡寮傚父锛屾棤娉曡В鏋?JSON' });
    }

    // 鑷姩鎶撳彇骞跺綊妗ｄ汉鎬у師鍨?
    if (parsedResult.prototype_archive && parsedResult.prototype_archive.name) {
      const proto = parsedResult.prototype_archive;
      const protoName = proto.name.trim();
      const protoType = proto.type || '鏈垎绫';
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

    res.json({
      success: true,
      result: parsedResult
    });
  } catch (err) {
    console.error('博弈引擎分析异常:', err);
    res.status(500).json({ success: false, error: '博弈分析引擎异常' });
  }
});

// 鑾峰彇鎵€鏈変汉鎬у師鍨嬫。妗?
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

// 添加/鎵嬪姩鏇存柊浜烘€у師鍨嬫。妗?
app.post('/api/game-theory/prototypes', (req, res) => {
  try {
    const { userId = 'default-user', name, type, description } = req.body;
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

// 鍒犻櫎浜烘€у師鍨嬫。妗?
app.delete('/api/game-theory/prototypes/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM personal_prototypes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 兜底 404
// TTS 语音合成接口
app.post('/api/tts/speech', async (req, res) => {
  try {
    const { input, model = 'edge-tts/en-US-EmmaNeural' } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Missing input text' });
    }

    // 动态使用客户端传入的模型参数
    const finalModel = model || 'edge-tts/en-US-EmmaNeural';

    // MD5 缓存逻辑
    const md5 = crypto.createHash('md5').update(input + '_' + finalModel).digest('hex');
    const cacheFilename = `${md5}.mp3`;
    const audioPath = path.join(__dirname, 'public', 'temp_audio', cacheFilename);
    const audioUrl = '/api/temp_audio/' + cacheFilename;

    if (fs.existsSync(audioPath)) {
      return res.json({
        success: true,
        audioId: md5,
        audioUrl: audioUrl,
        duration: 0
      });
    }

    let ttsResponse;
    let retries = 3;
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        ttsResponse = await fetch('https://9router.234124123.xyz/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sk-899c9c34738f61b5-2u53op-6ed8a313'
          },
          body: JSON.stringify({
            model: finalModel,
            input: input
          })
        });

        if (ttsResponse.ok) {
          break; // 成功获取响应，跳出重试循环
        } else {
          const errText = await ttsResponse.text().catch(() => '');
          lastError = new Error(`TTS status ${ttsResponse.status} - ${errText}`);
        }
      } catch (err) {
        lastError = err;
      }
      
      if (attempt < retries) {
        console.warn(`[TTS] Attempt ${attempt} failed: ${lastError.message}. Retrying in 500ms...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (!ttsResponse || !ttsResponse.ok) {
      const errMsg = lastError ? lastError.message : 'Unknown error';
      console.error('[TTS] All attempts failed:', errMsg);
      return res.status(500).json({ error: `TTS synthesis failed: ${errMsg}` });
    }

    // 保存到 MD5 缓存路径
    const arrayBuffer = await ttsResponse.arrayBuffer();
    fs.writeFileSync(audioPath, Buffer.from(arrayBuffer));

    // 返回音频文件的访问 URL
    res.json({
      success: true,
      audioId: md5,
      audioUrl: audioUrl,
      duration: 0
    });
  } catch (error) {
    console.error('[TTS] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 网页提取 API
// ==========================================
app.post('/api/materials/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: '缺少必要参数: url' });
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
// 视频转写 API (支持 URL 和 Multipart 二进制流上传)
// ==========================================
const multer = require('multer');
const uploadDir = path.join(__dirname, 'public', 'temp_videos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

app.post('/api/materials/fetch-video', upload.single('video'), async (req, res) => {
  try {
    const { url, language = 'auto', subtitle = '' } = req.body;
    const file = req.file;
    
    if (!url && !file) {
      return res.status(400).json({ success: false, error: '缺少必要参数: 必须提供 url 或上传 video 文件' });
    }

    const taskQueue = require('./services/taskQueue');
    const { startTranscribeTask } = require('./services/videoTranscriber');

    // 创建后台异步任务
    const taskName = url ? `网页视频: ${url}` : `上传视频: ${file.originalname || '未命名视频'}`;
    const task = taskQueue.createTask('video', taskName);

    // 异步启动任务，不阻塞 HTTP 响应
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

// 获取所有后台任务列表
app.get('/api/tasks', (req, res) => {
  try {
    const taskQueue = require('./services/taskQueue');
    res.json({ success: true, tasks: taskQueue.getAllTasks() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 查询单任务详情/轮询
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

app.use((req, res) => res.status(404).json({ error: "Endpoint not found" }));

app.listen(PORT, () => {
  console.log(`Real Vocab Server running on port ${PORT}`);
  console.log(`Database connected at: ${dbPath}`);
});
