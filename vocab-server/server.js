const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

// 鍔犺浇鐜鍙橀噺
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
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3001;

// ==========================================
// 鏁版嵁搴撳垵濮嬪寲
// 鏍规嵁 SOP锛岀嚎涓婄粺涓€璺緞涓?/var/www/super-agent/vocab.db
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
  // 瀛楁宸插瓨鍦紝蹇界暐
}

// 鍒濆鍖栬緟鍔╄〃 (涓轰簡涓嶈鍓嶇椤甸潰鎶ラ敊锛屾彁渚涘熀纭€缁撴瀯)
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

// 鍒濆鍖?theme_progress 琛紙閭欢閫氬叧鎸囨爣鎸佷箙鍖栵級
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

// ==========================================
// SM-2 闂撮殧閲嶅绠楁硶
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
// 1. 鏍稿績涓氬姟 API (Vocab)
// ==========================================

// 鑾峰彇缁熻淇℃伅
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

// 鑾峰彇鍏ㄩ噺鍒楄〃
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

// 鑾峰彇浠婃棩澶嶄範
app.get('/api/vocab/review', (req, res) => {
  try {
    const now = Date.now();
    const rows = db.prepare('SELECT * FROM vocabulary WHERE next_review_date <= ? AND repetitions < 999 ORDER BY next_review_date ASC').all(now);
    res.json(rows.map(r => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : {} })));
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 娣诲姞璇嶆眹
app.post('/api/vocab/add', (req, res) => {
  try {
    const { word, dictType, category = 'business', payload } = req.body;
    
    // 鏌ラ噸
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
    
    res.json({ success: true, id, message: '瀛樺叆鎴愬姛' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// 鎵归噺娣诲姞璇嶆眹 (涓撲緵 Dify 宸ヤ綔娴?HTTP 鍥炶皟鑺傜偣鎺ㄩ€佹暟鎹?
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

// 鏇存柊璇嶆潯
app.patch('/api/vocab/update_payload/:id', (req, res) => {
  try {
    db.prepare('UPDATE vocabulary SET payload = ? WHERE id = ?').run(JSON.stringify(req.body.payload), req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 鍏ㄩ潰鏇存柊璇嶆潯锛堟敮鎸佷慨鏀瑰崟璇嶃€佸垎鍖哄及 payload锛?
app.put('/api/vocab/update/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { word, category, payload } = req.body;
    db.prepare('UPDATE vocabulary SET word = ?, category = ?, payload = ? WHERE id = ?')
      .run(word, category, JSON.stringify(payload || {}), id);
    res.json({ success: true, message: '鏇存柊鎴愬姛' });
  } catch (error) {
    console.error('Update vocab error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 鎻愪氦澶嶄範缁撴灉
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

// 浜哄伐骞查
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

// 鍒犻櫎璇嶆潯
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

// Upsert 璁粌 Session
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

// 鑾峰彇鏌愬ぉ鐨?Session 璇︽儏
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

// 鍒涘缓璁粌 Attempt
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

// 鎻愪氦 Feedback
app.post('/api/training/feedback', (req, res) => {
  res.json({ success: true, feedbackId: crypto.randomBytes(16).toString('hex'), status: 'archived' });
});

// 妫€鏌ヤ富棰樻槸鍚﹁揪鏍?(鍙ｈ + 鍐欎綔 + 閭欢)
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

// 鏍囪鏌愪富棰橀偖浠堕€氬叧
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
app.post('/api/material/upload', (req, res) => res.json({ success: true, message: 'Material upload mocked' }));
app.get('/api/material/list', (req, res) => res.json([]));
app.get('/api/knowledge-node/list', (req, res) => res.json([]));
// 澶勭悊瀛楀吀鏌ヨ璇锋眰锛堝鎺ョ湡瀹炵殑 Dify 瀛楀吀宸ヤ綔娴侊級
app.post('/api/dify/dict-query', async (req, res) => {
  const { word, dictType, direction = 'auto', userContext = '', locale = 'zh-CN', userId = 'frontend-panel' } = req.body;

  if (!word) {
    return res.status(400).json({ ok: false, message: 'Please input a word to query.' });
  }

  const DIFY_DICT_API_KEY = 'app-zGyrsyvvzHAIO5yx11OcYdpa';
  const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

  try {
    console.log(`[Dict Query] 寮€濮嬫煡璇㈣瘝鏉? "${word}", 瀛楀吀绫诲瀷: "${dictType}"`);

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
      console.error(`[Dict Query] Dify 鏈嶅姟鍣ㄨ繑鍥為敊璇?(${response.status}):`, errText);
      return res.status(response.status).json({ ok: false, message: `Dify 鏈嶅姟鍣ㄥ紓甯? ${response.status}` });
    }

    const data = await response.json();
    const resultStr = data?.data?.outputs?.result;

    if (!resultStr) {
      console.warn('[Dict Query] 宸ヤ綔娴佹湭杩斿洖 result 瀛楁:', data);
      return res.status(500).json({ ok: false, message: 'Dify 宸ヤ綔娴佹湭杩斿洖姝ｇ‘鐨?result 瀛楁' });
    }

    // 瑙ｆ瀽宸ヤ綔娴佽緭鍑虹粨鏋?    let parsedResult;
    try {
      parsedResult = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr;
    } catch (e) {
      console.error('[Dict Query] 瑙ｆ瀽 result JSON 澶辫触:', e, resultStr);
      return res.status(500).json({ ok: false, message: '宸ヤ綔娴佺粨鏋滆В鏋愬紓甯革紝杩斿洖鏁版嵁闈炲悎娉?JSON' });
    }

    console.log(`[Dict Query] 鏌ヨ "${word}" 鎴愬姛锛岃繑鍥炵粨鏋?`, Object.keys(parsedResult?.payload || {}));
    return res.json(parsedResult);
  } catch (error) {
    console.error('[Dict Query] 鏈嶅姟绔姹傚紓甯?', error);
    return res.status(500).json({ ok: false, message: `璇嶅吀鏈嶅姟鍣ㄥ紓甯? ${error.message}` });
  }
});

// 澶勭悊鐗╂枡鎻愮函瑙ｆ瀽璇锋眰锛堢湡瀹?Dify 鑱斿姩锛氭壘搴?-> 娓呯┖ -> 涓婁紶 -> 宸ヤ綔娴佹娊鎻愶級
app.post('/api/material/process-and-extract', async (req, res) => {
  const { topic, userId, files } = req.body;
  
  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: '鏈帴鏀跺埌鏈夋晥鏂囦欢鏁版嵁' });
  }

  // 涓ユ牸瀹炴柦鍙屽瘑閽ラ殧绂绘満鍒?  const DATASET_KEY = 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
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
      throw new Error('鍦?Dify 骞冲彴鏈壘鍒板悕涓?English_Pro_Scenarios 鐨勭煡璇嗗簱');
    }
    const datasetId = dataset.id;

    // ---------------------------------------------------------
    // 鍔ㄤ綔浜岋細鏆村姏娓呭満锛屾棤鎯呭垹闄ゆ棫鏂囦欢
    // ---------------------------------------------------------
    const docsResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/documents?page=1&limit=100`, {
      headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
    });
    const docsData = await docsResponse.json();
    const docIds = docsData.data?.map(d => d.id) || [];
    
    // 寮€鍚苟鍙戝睜鏉€锛屾竻绌虹煡璇嗗簱
    if (docIds.length > 0) {
      await Promise.all(docIds.map(docId => 
        fetch(`${BASE_URL}/datasets/${datasetId}/documents/${docId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
        })
      ));
    }

    // ---------------------------------------------------------
    // 鍔ㄤ綔涓夛細鐗╃悊閲嶉摳锛岀粍瑁呬笂浼犳柊寮硅嵂
    // ---------------------------------------------------------
    const fileObj = files[0];
    const base64Data = fileObj.content || fileObj.base64 || '';
    const base64Content = base64Data.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');
    
    // 浣跨敤 Node 18+ 鐨勫叏灞€ Blob 涓?FormData 瑁呴厤浜岃繘鍒跺ぇ鏂囦欢
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const formData = new FormData();
    formData.append('file', blob, fileObj.fileName || 'upload_material.pdf');
    // 鍏抽敭淇锛氱煡璇嗗簱浣跨敤浜嗏€滅埗瀛愭枃鏈垎鍧椻€?Hierarchical)
    // 蹇呴』鎻愪緵瀹屾暣鐨?rules (鍖呮嫭 pre_processing_rules 鍜?subchunk_segmentation)
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
      throw new Error(`Dify 鏂囦欢鍏ュ簱閬嫆: ${errText}`);
    }

    const uploadData = await uploadResponse.json();
    const documentId = uploadData.document?.id;
    const batchId = uploadData.batch; 

    if (!documentId || !batchId) {
      throw new Error('鏂囦欢宸插彂閫侊紝浣嗘湭浠?Dify 鎷垮埌 batch ID 瀵艰嚧鏃犳硶璺熻釜');
    }

    console.log(`[Material] 鏂囨。涓婁紶鎴愬姛 (ID: ${documentId}, Batch: ${batchId})锛屾鍦ㄩ攣瀹氱瓑寰呭悜閲忚寮?..`);

    // ---------------------------------------------------------
    // 鍔ㄤ綔涓夌偣浜旓細楂橀杞鏌ヨ鏂囨。宓屽叆鐘舵€?(鑾峰彇娴佹按绾胯繘搴?
    // ---------------------------------------------------------
    let isIndexed = false;
    // 璁惧畾 40 娆¤疆璇紝姣忔 3 绉掞紝鎬昏瀹瑰繊绛夊緟 120 绉掞紝缁濅笉楗挎澶фā鍨?
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${batchId}/indexing-status`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
      });
      
      if (!statusRes.ok) continue; // 鍋跺彂缃戠粶鎶栧姩鐩存帴蹇界暐锛岃繘鍏ヤ笅涓€杞?      
      const statusData = await statusRes.json();
      // 鑾峰彇娴佹按绾垮祵鍏ョ姸鎬?(杩斿洖鍊间负鏁扮粍鏍煎紡)
      const docInfo = statusData.data?.[0];
      
      if (docInfo) {
        console.log(`[Material] 绗?${i + 1} 娆¤繘搴︽壂鎻? status = ${docInfo.indexing_status}`);
        if (docInfo.indexing_status === 'completed') {
          isIndexed = true;
          break;
        } else if (docInfo.indexing_status === 'error') {
          throw new Error('Dify 娴佹按绾垮垏鍒嗘姤閿欙紝璇峰墠寰€鍚庡彴鏌ョ湅鍘熷洜');
        }
      }
    }

    if (!isIndexed) {
      throw new Error('Dify indexing timeout (>120s).');
    }

    console.log(`[Material] 鍚戦噺瑁呭脊瀹屾瘯锛佸噯璁告斁琛屽敜閱掑ぇ妯″瀷...`);

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
    
    // 瑙ｆ瀽宸ヤ綔娴佽緭鍑猴紙鐢变簬鍏蜂綋宸ヤ綔娴佺殑杈撳嚭鍙橀噺鍚嶄笉鏄庣‘锛屽吋瀹瑰父瑙佸瓧娈电粨鏋勶級
    const outputs = wfData?.data?.outputs || {};
    // 鍋囪澶фā鍨嬭繑鍥炰簡涓€涓互閫楀彿鍒嗛殧鐨勫瓧绗︿覆锛屾垨鑰?JSON 鏁扮粍
    const rawExtracted = outputs.extracted_words || outputs.result || outputs.text || '';
    
    let extractedWords = [];
    if (Array.isArray(rawExtracted)) {
      extractedWords = rawExtracted;
    } else if (typeof rawExtracted === 'string') {
      // 鏆村姏姝ｅ垯锛氬垏鍒嗗苟娓呯悊
      extractedWords = rawExtracted.split(/[,锛孿n]+/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 50);
    }
    
    // 闈欓粯鍐欏叆 SQLite 鐢熻瘝鏈?(瑙勯伩閲嶅椤?
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
          key_points: extractedWords.slice(0, 5) // 鍚戝墠绔睍绀哄墠5涓牳蹇冭瘝
        }
      ],
      logs: [
        "1. Dify 鐭ヨ瘑搴撳畾浣嶅苟娓呯┖瀹屾垚",
        "2. Memory Base64 conversion and physical storage success.",
        `3. AI 钀冨彇涓?SQLite 鍥哄寲瀹屾瘯 (鏂板: ${addedCount})`
      ]
    });
  } catch (error) {
    console.error('Material Pipeline Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 鑻辫寮曟搸姣忔棩璇嶆眹+鐭鎻愮函锛堝甫姣忔棩閰嶉鎺у埗锛?// 纭寚鏍囷細姣忔棩鏈€澶?50 璇嶆眹 + 30 鐭
// ==========================================
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

    // Step 3: 璋冪敤 Dify 宸ヤ綔娴佹彁绾瘝姹?
    const difyApiKey = process.env.VITE_DIFY_ENGLISH_MASTERY_KEY || 'app-Eygg39qoniWss17wjWvLUvDb';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    // 鏋勯€犺緭鍏ヨ鏂欙細浼樺厛鐢?materialText锛屽惁鍒欑敤 topic 鑷韩鐢熸垚鎻愮ず璇?
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
            inputs: { theme: topic || "General Business", cefr_level: cefrLevel, genre: genre },
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
              // 瀹归敊锛氬拷鐣ユ暟鎹潡琚埅鏂骇鐢熺殑涓存椂瑙ｆ瀽澶辫触
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

      // 鎺ユ敹瀹屾瘯鍚庯紝鍦ㄥ悗鍙拌繘琛岃瘝姹囧拰鐭鎻愬彇涓?SQLite 鍏ュ簱
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

      // 鍚庢湡閰嶉瀛樺簱閫昏緫
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

      console.log(`[Daily Extract] Completed. User ${userId} ${today} added ${wordsAddedCount} words, ${phrasesAddedCount} phrases.`);

      // 鍙戦€佹祦缁撴潫鏍囪锛屽苟闄勫甫鏈€缁堢殑鍏ュ簱鍜岀粺璁?JSON 鏁版嵁浣滀负鏈€鍚庝竴閮ㄥ垎浜嬩欢
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

    // Step 4: 涓ユ牸閰嶉鎴彇鈥斺€斿彧鍙栧墿浣欓厤棰濋噺
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

    // Step 6: 鎵归噺鍐欏叆鐭锛堝瓨鍌ㄥ湪 extra_json 涓紝鎴栫嫭绔嬭〃锛?
    let phrasesAddedCount = 0;
    const insertPhrase = db.transaction((phrases) => {
      for (const phraseStr of phrases) {
        const p = typeof phraseStr === 'string' ? phraseStr.trim() : String(phraseStr);
        if (!p || p.length > 500) continue;
        // 鐭鐢ㄦ煡閲嶉€昏緫
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

    // Step 7: 鏇存柊閰嶉璁板綍
    db.prepare(`
      UPDATE daily_vocab_quota
      SET words_added = words_added + ?, phrases_added = phrases_added + ?, last_extraction_at = ?, updated_at = ?
      WHERE user_id = ? AND quota_date = ?
    `).run(wordsAddedCount, phrasesAddedCount, now, now, userId, today);

    const updatedWordsUsed = (quotaRow.words_added || 0) + wordsAddedCount;
    const updatedPhrasesUsed = (quotaRow.phrases_added || 0) + phrasesAddedCount;

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
    result: { scene: "妯℃嫙娴嬭瘯灞€", content: "杩欐槸浠跨湡绯荤粺杩斿洖鐨勮缁冩暟鎹?.." }
  });
});

// ==========================================
// 鍙戦煶绾犳 API (Pronunciation Assessment)
// 璋冪敤 Dify 宸ヤ綔娴佽繘琛屽彂闊宠瘎浼?// ==========================================
app.post('/api/pronunciation-assessment', async (req, res) => {
  const { targetText, recognizedText, userId = 'default-user' } = req.body;

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
      console.error('Dify 鍙戦煶绾犳璇锋眰澶辫触:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify 璇锋眰澶辫触: ${response.status}` });
    }

    const data = await response.json();
    console.log('Dify 鍘熷杩斿洖:', JSON.stringify(data, null, 2));

    // 鎻愬彇璇勬祴缁撴灉 - 宸ヤ綔娴佺幇鍦ㄨ繑鍥炵粨鏋勫寲 JSON
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
      correctionNote: `${analysis}銆?{suggestion}`,
      target_text: targetText,
      recognized_text: recognizedText || '',
    });
  } catch (err) {
    console.error('鍙戦煶绾犳 API 寮傚父:', err);
    res.status(500).json({ success: false, error: '鍙戦煶绾犳鏈嶅姟寮傚父' });
  }
});

// ==========================================
// 鍟嗗姟璇硶娑﹁壊 API (Grammar Polish)
// 璋冪敤 Dify 宸ヤ綔娴佽繘琛岄珮绠＄骇璇硶閲嶆瀯
// ==========================================
app.post('/api/grammar-polish', async (req, res) => {
  const { originalText, userId = 'default-user' } = req.body;

  if (!originalText) {
    return res.status(400).json({ success: false, error: '缂哄皯鍘熷鏂囨湰 (originalText)' });
  }

  try {
    // 浼樺厛璇诲彇鐜鍙橀噺锛屼弗鏍艰惤瀹炴棤鐘舵€佸鐏炬満鍒?(纭紪鐮佺湡瀹?Key 鍏滃簳)
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
          original_text: originalText, // 瀵瑰簲 yml 閲岀殑 start 鑺傜偣鍙橀噺
        },
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Dify 璇硶娑﹁壊璇锋眰澶辫触:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify 璇锋眰澶辫触: ${response.status}` });
    }

    const data = await response.json();
    console.log('Dify 璇硶娑﹁壊鍘熷杩斿洖:', JSON.stringify(data, null, 2));

    // 鏍规嵁 Grammar_Polish_Engine.yml 瀹氫箟锛岃緭鍑鸿妭鐐圭殑鍙橀噺鍚嶇О涓?polished_result
    const polishedText = data?.data?.outputs?.polished_result || '鏈幏鍙栧埌娑﹁壊缁撴灉锛岃妫€鏌ュ伐浣滄祦閰嶇疆銆';

    res.json({
      success: true,
      polishedText
    });
  } catch (err) {
    console.error('璇硶娑﹁壊 API 寮傚父:', err);
    res.status(500).json({ success: false, error: '璇硶娑﹁壊鏈嶅姟寮傚父' });
  }
});

// ==========================================
// 3. 椹績鍗氬紙鐩稿叧 API (Game Theory & Prototypes)
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
      console.error('Dify 鍗氬紙寮曟搸璇锋眰澶辫触:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify 璇锋眰澶辫触: ${response.status}` });
    }

    const data = await response.json();
    
    // 瑙ｆ瀽宸ヤ綔娴佽緭鍑?    const rawResult = data?.data?.outputs?.analysis_result ?? data?.data?.outputs?.result ?? data?.answer ?? data?.message ?? '';
    const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanJson);
    } catch (e) {
      console.error('瑙ｆ瀽 Dify 杩斿洖鐨?JSON 澶辫触:', e, rawResult);
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
    console.error('鍗氬紙寮曟搸鍒嗘瀽寮傚父:', err);
    res.status(500).json({ success: false, error: '鍗氬紙鍒嗘瀽寮曟搸寮傚父' });
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

// 娣诲姞/鎵嬪姩鏇存柊浜烘€у師鍨嬫。妗?
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

// 鍏滃簳 404
// TTS 语音合成接口（全局统一使用 edge-tts/en-US-EmmaNeural）
app.post('/api/tts/speech', async (req, res) => {
  try {
    const { input, model = 'edge-tts/en-US-EmmaNeural' } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Missing input text' });
    }

    // 强制使用 EmmaNeural 模型（忽略客户端传入的模型参数）
    const finalModel = 'edge-tts/en-US-EmmaNeural';

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

app.use((req, res) => res.status(404).json({ error: "Endpoint not found" }));

app.listen(PORT, () => {
  console.log(`Real Vocab Server running on port ${PORT}`);
  console.log(`Database connected at: ${dbPath}`);
});
