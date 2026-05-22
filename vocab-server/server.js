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
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3001;

// ==========================================
// 数据库初始化
// 根据 SOP，线上统一路径为 /var/www/super-agent/vocab.db
// 本地开发则回落到 ./vocab.db
// ==========================================
const isProd = process.env.NODE_ENV === 'production' || __dirname.includes('/opt/vocab-server');
const dbPath = isProd ? '/var/www/super-agent/vocab.db' : path.join(__dirname, 'vocab.db');

// 确保线上目录存在（如果是生产环境）
if (isProd && !fs.existsSync('/var/www/super-agent')) {
  fs.mkdirSync('/var/www/super-agent', { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 初始化 vocabulary 表
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

// 自动迁移：如果旧表没有 category 字段，则添加之
try {
  db.prepare("ALTER TABLE vocabulary ADD COLUMN category TEXT DEFAULT 'business'").run();
  console.log('Migration: Added category column to vocabulary table.');
} catch (err) {
  // 字段已存在，忽略
}

// 初始化辅助表 (为了不让前端页面报错，提供基础结构)
db.prepare(`CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, title TEXT, created_at INTEGER)`).run();

// 初始化 training_sessions 和 training_attempts 表
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

// 批量添加词汇 (专供 Dify 工作流 HTTP 回调节点推送数据)
app.post('/api/vocab/batch-add', (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Expected a JSON array of vocabulary items' });
    }

    let addedCount = 0;
    const now = Date.now();

    // 开启 SQLite 事务，确保原子性和极速批量写入
    const insertMany = db.transaction((words) => {
      for (const item of words) {
        const word = item.word;
        if (!word) continue;
        
        const dictType = item.dictType || item.dict_type || 'ai_extracted';
        const category = item.category || 'business';
        const payload = item.payload || {};

        // 严格查重，无视大小写，防止污染用户现有词库
        const existing = db.prepare('SELECT id FROM vocabulary WHERE word = ? COLLATE NOCASE').get(word);
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

    console.log(`[Batch Add] 成功截获 Dify 回调，暴力入库 ${addedCount} 个硬核词汇`);
    res.json({ success: true, addedCount, message: `成功批量入库 ${addedCount} 个生词` });
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
// 2. 占位与兼容存根 (及核心训练业务 API)
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

// 获取某天的 Session 详情
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

// 检查主题是否达标 (口语与写作)
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
    
    const isMastered = oralCount >= 10 && maxWriteScore >= 8;
    
    res.json({
      success: true,
      theme,
      userId,
      oralCount,
      oralPassed: oralCount >= 10,
      maxWriteScore,
      isMastered
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error on check-mastery' });
  }
});

app.post('/api/theme/focus', (req, res) => res.json({ success: true, theme: req.body.theme || 'default' }));
app.post('/api/material/upload', (req, res) => res.json({ success: true, message: 'Material upload mocked' }));
app.get('/api/material/list', (req, res) => res.json([]));
app.get('/api/knowledge-node/list', (req, res) => res.json([]));
app.post('/api/dify/dict-query', (req, res) => res.status(200).json({ mocked: true }));

// 处理物料提纯解析请求（真实 Dify 联动：找库 -> 清空 -> 上传 -> 工作流抽提）
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
    // 动作一：获取知识库列表，精确定位 English_Pro_Scenarios
    // ---------------------------------------------------------
    const dsResponse = await fetch(`${BASE_URL}/datasets?page=1&limit=100`, {
      headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
    });
    const dsData = await dsResponse.json();
    const dataset = dsData.data?.find(d => d.name === 'English_Pro_Scenarios');
    
    if (!dataset) {
      throw new Error('在 Dify 平台未找到名为 English_Pro_Scenarios 的知识库');
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
    
    // 使用 Node 18+ 的全局 Blob 与 FormData 装配二进制大文件
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const formData = new FormData();
    formData.append('file', blob, fileObj.fileName || 'upload_material.pdf');
    // 关键修正：知识库使用了“父子文本分块”(Hierarchical)
    // 必须提供完整的 rules (包括 pre_processing_rules 和 subchunk_segmentation)
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
      throw new Error('文件已发送，但未从 Dify 拿到 batch ID 导致无法跟踪');
    }

    console.log(`[Material] 文档上传成功 (ID: ${documentId}, Batch: ${batchId})，正在锁定等待向量装弹...`);

    // ---------------------------------------------------------
    // 动作三点五：高频轮询查询文档嵌入状态 (获取流水线进度)
    // ---------------------------------------------------------
    let isIndexed = false;
    // 设定 40 次轮询，每次 3 秒，总计容忍等待 120 秒，绝不饿死大模型
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${batchId}/indexing-status`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
      });
      
      if (!statusRes.ok) continue; // 偶发网络抖动直接忽略，进入下一轮
      
      const statusData = await statusRes.json();
      // 获取流水线嵌入状态 (返回值为数组格式)
      const docInfo = statusData.data?.[0];
      
      if (docInfo) {
        console.log(`[Material] 第 ${i + 1} 次进度扫描: status = ${docInfo.indexing_status}`);
        if (docInfo.indexing_status === 'completed') {
          isIndexed = true;
          break;
        } else if (docInfo.indexing_status === 'error') {
          throw new Error('Dify 流水线切分报错，请前往后台查看原因');
        }
      }
    }

    if (!isIndexed) {
      throw new Error('Dify 向量化索引超时 (>120s)，为保护网关已主动熔断请求');
    }

    console.log(`[Material] 向量装弹完毕！准许放行唤醒大模型...`);

    // ---------------------------------------------------------
    // 动作四：终极抽提，唤醒大模型榨取核心词汇并入库
    // ---------------------------------------------------------
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
    if (!wfResponse.ok) throw new Error(`工作流执行失败: ${JSON.stringify(wfData)}`);
    
    // 解析工作流输出（由于具体工作流的输出变量名不明确，兼容常见字段结构）
    const outputs = wfData?.data?.outputs || {};
    // 假设大模型返回了一个以逗号分隔的字符串，或者 JSON 数组
    const rawExtracted = outputs.extracted_words || outputs.result || outputs.text || '';
    
    let extractedWords = [];
    if (Array.isArray(rawExtracted)) {
      extractedWords = rawExtracted;
    } else if (typeof rawExtracted === 'string') {
      // 暴力正则：切分并清理
      extractedWords = rawExtracted.split(/[,，\n]+/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 50);
    }
    
    // 静默写入 SQLite 生词本 (规避重复项)
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
          summary: `全链路闭环完成！已清空 ${docIds.length} 份旧档，新文件入库成功。大模型提炼出 ${extractedWords.length} 个术语，实际入库 ${addedCount} 个生词。`,
          key_points: extractedWords.slice(0, 5) // 向前端展示前5个核心词
        }
      ],
      logs: [
        "1. Dify 知识库定位并清空完成",
        "2. 内存级 Base64 转换与物理入库成功",
        `3. AI 萃取与 SQLite 固化完毕 (新增: ${addedCount})`
      ]
    });
  } catch (error) {
    console.error('Material Pipeline Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 处理自动发起英文练习局的请求
app.post('/api/dify/run-english-mastery', (req, res) => {
  const { topic, materialText } = req.body;
  res.json({
    success: true,
    message: "成功下发训练局（Mock）",
    topic: topic,
    result: { scene: "模拟测试局", content: "这是仿真系统返回的训练数据..." }
  });
});

// ==========================================
// 发音纠正 API (Pronunciation Assessment)
// 调用 Dify 工作流进行发音评估
// ==========================================
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

    const response = await fetch('https://dify.234124123.xyz/v1/workflows/run', {
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
      correctionNote: `${analysis}。${suggestion}`,
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
    // 优先读取环境变量，严格落实无状态容灾机制 (硬编码真实 Key 兜底)
    const difyApiKey = process.env.DIFY_GRAMMAR_API_KEY || 'app-547Sa5oIC3Qb9RUZdasJs1Ef';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    const response = await fetch(`${baseUrl}/workflows/run`, {
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

    // 根据 Grammar_Polish_Engine.yml 定义，输出节点的变量名称为 polished_result
    const polishedText = data?.data?.outputs?.polished_result || '未获取到润色结果，请检查工作流配置。';

    res.json({
      success: true,
      polishedText
    });
  } catch (err) {
    console.error('语法润色 API 异常:', err);
    res.status(500).json({ success: false, error: '语法润色服务异常' });
  }
});

// 兜底 404
app.use((req, res) => res.status(404).json({ error: "Endpoint not found" }));

app.listen(PORT, () => {
  console.log(`Real Vocab Server running on port ${PORT}`);
  console.log(`Database connected at: ${dbPath}`);
});
