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
  if (easeFactor < 1.3) easeFactor = 1.3; // ?????

  return { repetitions, easeFactor, interval };
}

const DEFAULT_IMAGE_GEN_MODELS = [
  'nb/nanobanana-flash',
  'nb/nanobanana-pro'
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
    n: 1,
    size: 'auto',
    quality: 'auto',
    background: 'auto',
    image_detail: 'high',
    output_format: 'png',
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

/** ?? Dify chat-messages SSE ????????????? answer */
async function collectDifyStreamingAnswer(wfResponse) {
  let finalAnswer = '';
  const decoder = new TextDecoder();
  let buffer = '';

  const processLine = (line) => {
    if (!line.startsWith('data: ')) return;
    const dataStr = line.slice(6).trim();
    if (dataStr === '[DONE]') return;
    try {
      const parsed = JSON.parse(dataStr);
      if (parsed.answer && typeof parsed.answer === 'string' && parsed.answer.trim()) {
        finalAnswer = parsed.answer;
      }
      if (parsed.event === 'message' && parsed.answer) {
        finalAnswer = parsed.answer;
      }
      if (parsed.event === 'message_end' && parsed.data?.outputs?.answer) {
        finalAnswer = parsed.data.outputs.answer;
      }
      if (parsed.event === 'workflow_finished' && parsed.data?.outputs) {
        const out = parsed.data.outputs;
        finalAnswer = out.answer ?? out.result ?? out.text ?? out.content ?? out.listening_material_preview ?? finalAnswer;
      }
      if (parsed.event === 'text_chunk' && parsed.data?.text) {
        finalAnswer += parsed.data.text;
      }
      if (!finalAnswer && parsed.data?.outputs) {
        for (const key of Object.keys(parsed.data.outputs)) {
          const val = parsed.data.outputs[key];
          if (typeof val === 'string' && val.trim()) {
            finalAnswer = val;
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

  if (!wfResponse.body) return finalAnswer.trim();

  if (typeof wfResponse.body.getReader === 'function') {
    const reader = wfResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parseChunk(decoder.decode(value, { stream: true }));
    }
  } else {
    for await (const chunk of wfResponse.body) {
      parseChunk(decoder.decode(chunk, { stream: true }));
    }
  }

  return finalAnswer.trim();
}

app.post('/api/listen/generate-material', async (req, res) => {
  try {
    const { inputs, userId = 'default-user' } = req.body;
    const apiKey = process.env.DIFY_LISTEN_GEN_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: '?????????? DIFY_LISTEN_GEN_API_KEY' });
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
      return res.status(response.status).json({ success: false, error: data.message || data.error || 'Dify API Error' });
    }
    
    if (!data.answer) {
      return res.status(500).json({ success: false, error: '??????????????????????????????????? Dify ????????????' });
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
      || process.env.DIFY_LISTEN_GEN_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: '缺少关键鉴权参数 (API KEY)' });
    }

    const baseUrl = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    // 引入任务队列，创建任务
    const taskQueue = require('./services/taskQueue');
    const taskTitle = inputs.theme ? `播客文稿: ${inputs.theme}` : '深度播客生成';
    const task = taskQueue.createTask('material', taskTitle);

    // 立即响应给前端 taskId，由前端使用全局的 TaskContext 接管轮询
    res.json({ success: true, taskId: task.id, status: task.status });

    // ========= 以下进入异步后台执行，不会阻塞客户端连接 =========
    (async () => {
      try {
        taskQueue.updateTask(task.id, { progress: 10, logs: ['正在连接智库并初始化推演模型 (Dify API)...'] });

        const fetchController = new AbortController();
        // 放宽到 30 分钟，后台不受 Nginx 超时限制
        const fetchTimeout = setTimeout(() => fetchController.abort(), 30 * 60 * 1000);

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
              inputs: injectOralSystemTime(inputs),
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
          let errMsg = errText || `Dify HTTP ${wfResponse.status}`;
          try {
            const parsed = JSON.parse(errText);
            errMsg = parsed.message || parsed.error || errMsg;
          } catch (_) {}
          taskQueue.updateTask(task.id, { status: 'failed', error: `模型接口出错: ${errMsg}` });
          return;
        }

        taskQueue.updateTask(task.id, { progress: 30, logs: ['成功连接，模型正在流式下发剧本数据...'] });

        // 原本收集流式答案的函数
        const answer = await collectDifyStreamingAnswer(wfResponse);
        if (!answer) {
          taskQueue.updateTask(task.id, { status: 'failed', error: '接收成功但答案为空' });
          return;
        }

        // 保存生成的文稿内容给前端提取 (保存在 task.result.content)
        taskQueue.updateTask(task.id, { 
          progress: 100, 
          logs: ['长音频剧本生成圆满完成！'], 
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

// ==========================================
// User profile & long-term memory API
// ==========================================

app.get('/api/user/profile/:userId', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM user_memories WHERE user_id = ?').get(req.params.userId);
    res.json({
      success: true,
      data: row || { user_id: req.params.userId, profile_content: '', error_ledger: '{}' },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/profile/save', (req, res) => {
  const { userId, profileContent, errorLedger } = req.body;
  const now = Date.now();
  try {
    db.prepare(`
      INSERT INTO user_memories (user_id, profile_content, error_ledger, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        profile_content = excluded.profile_content,
        error_ledger = COALESCE(excluded.error_ledger, error_ledger),
        updated_at = excluded.updated_at
    `).run(userId || 'default-user', profileContent, errorLedger || '{}', now);
    res.json({ success: true });
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

// ???????????????
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

// ????????????
app.get('/api/vocab/review', (req, res) => {
  try {
    const now = Date.now();
    const rows = db.prepare('SELECT * FROM vocabulary WHERE next_review_date <= ? AND repetitions < 999 ORDER BY next_review_date ASC').all(now);
    res.json(rows.map(r => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : {} })));
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
      return res.json({ success: false, message: '????????', id: existing.id });
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO vocabulary (id, word, dict_type, category, scene_type, payload, added_at, next_review_date, review_history, repetitions, interval_days, ease_factor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, word, dictType, actualCategory, scene_type, JSON.stringify(payload || {}), now, now, '[]', 0, 1, 2.5);
    
    res.json({ success: true, id, message: '???????????' });
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
    res.json({ success: true, message: '????????' });
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
    res.json({ success: true, message: '????????????' });
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
    return res.status(400).json({ success: false, error: '??????????? themeName ??? file' });
  }

  const DATASET_KEY = 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
  const WORKFLOW_KEY = 'app-F6daqhSXH942sBrnGki4kzZq';
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
      throw new Error(`Dify ???????????: ${errText}`);
    }

    const uploadData = await uploadResponse.json();
    const documentId = uploadData.document?.id;
    const batchId = uploadData.batch; 

    if (!documentId || !batchId) {
      throw new Error('??????????????????? Dify ?????? batch ID ????????????');
    }

    console.log(`[Custom Theme] ????????????? (ID: ${documentId}, Batch: ${batchId})???????????????????...`);

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
        console.log(`[Custom Theme] ? ${i + 1} ????????: status = ${docInfo.indexing_status}`);
        if (docInfo.indexing_status === 'completed') {
          isIndexed = true;
          break;
        } else if (docInfo.indexing_status === 'error') {
          throw new Error('Dify ???????????????????????????????????????????');
        }
      }
    }

    if (!isIndexed) {
      throw new Error('Dify ???????????????? (>120s)???');
    }

    console.log(`[Custom Theme] ?????????????????????????????????...`);

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
    if (!wfResponse.ok) throw new Error(`???????????: ${JSON.stringify(wfData)}`);
    
    const outputs = wfData?.data?.outputs || {};
    const extractedThemeName = outputs.theme_name || themeName;
    const extractedWordsRaw = outputs.extracted_words || '[]';
    const keyPhrasesRaw = outputs.key_phrases || '[]';

    let extractedWords = [];
    try {
      extractedWords = typeof extractedWordsRaw === 'string' ? JSON.parse(extractedWordsRaw) : extractedWordsRaw;
    } catch (e) {
      console.error("???? extracted_words ??", e);
    }
    
    let keyPhrases = [];
    try {
      keyPhrases = typeof keyPhrasesRaw === 'string' ? JSON.parse(keyPhrasesRaw) : keyPhrasesRaw;
    } catch (e) {
      console.error("???? key_phrases ??", e);
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
// Dify embed 会话校验：有效则返回 conversation_id 供 iframe URL 覆盖过期 localStorage
app.get('/api/dify/embed-session', async (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  const conversationId = typeof req.query.conversationId === 'string'
    ? req.query.conversationId.trim()
    : '';

  if (!userId) {
    return res.status(400).json({ message: '缺少 userId 参数。' });
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

  try {
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
    // 服务端无会话，但 Dify iframe localStorage 可能仍有过期 id → 用空 conversation_id 覆盖
    return res.json({ conversationId: null, stale: false, forceNew: true, reason: 'no_conversation' });
  } catch (err) {
    console.error('[embed-session] error:', err);
    return res.status(500).json({ message: err.message || 'embed 会话校验失败' });
  }
});

// 词典查询：后端代理 Dify dict_tool_workflow，避免前端暴露 API Key
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
    console.log(`[Dict Query] 发起查询: "${word}", 词典类型: "${dictType}"`);

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
      console.warn(`[Dict Query] Dify 工作流返回错误 (${response.status}):`, errText);

      try {
        db.prepare(`
          INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(crypto.randomUUID(), word.trim(), dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify({ error: errText }), Date.now());
      } catch (logErr) {}

      return res.json({ ok: false, fallback: true, message: `Dify 工作流调用失败: HTTP ${response.status}` });
    }

    const data = await response.json();
    const resultStr = data?.data?.outputs?.result;

    if (!resultStr) {
      console.warn('[Dict Query] 工作流输出缺少 result 字段:', data);

      try {
        db.prepare(`
          INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(crypto.randomUUID(), word.trim(), dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify({ error: 'Missing result in outputs', raw: data }), Date.now());
      } catch (logErr) {}

      return res.json({ ok: false, fallback: true, message: 'Dify 工作流未返回有效结果，请稍后重试' });
    }

    let parsedResult;
    try {
      parsedResult = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr;
    } catch (e) {
      console.warn('[Dict Query] 解析 result JSON 失败:', e.message);

      try {
        db.prepare(`
          INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(crypto.randomUUID(), word.trim(), dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify({ error: 'JSON parse error', raw: resultStr }), Date.now());
      } catch (logErr) {}

      return res.json({ ok: false, fallback: true, message: '词典结果格式异常，无法解析' });
    }

    try {
      db.prepare(`
        INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(crypto.randomUUID(), word.trim(), dictType || 'en_zh_bidirectional', direction, userContext, locale, JSON.stringify(parsedResult), Date.now());
    } catch (logErr) {}

    console.log(`[Dict Query] 词条 "${word}" 查询成功，字段:`, Object.keys(parsedResult?.payload || {}));
    return res.json(parsedResult);
  } catch (error) {
    const isTimeout = error.name === 'AbortError' || /aborted/i.test(error.message || '');
    console.warn('[Dict Query] 查询失败:', error.message);
    const message = isTimeout
      ? `词典查询超时（${DICT_QUERY_TIMEOUT_MS / 1000} 秒），工作流仍在运行中，请稍后重试`
      : `词典查询失败: ${error.message}`;
    return res.json({ ok: false, fallback: true, message });
  } finally {
    clearTimeout(timeoutId);
  }
});

// ????????????????????????? (???? Dify ???????????????)
app.post('/api/dify/write-review', async (req, res) => {
  const { user_text, mail_intent, theme, user_current_profile } = req.body;
  if (!user_text || !mail_intent || !theme) {
    return res.status(400).json({ success: false, error: 'Missing required parameters: user_text, mail_intent, or theme.' });
  }

  const apiKey = process.env.DIFY_WRITE_GOVERNANCE_KEY || 'app-l4RcdCyDTzUPnY0GHlsgrUcs';
  const baseUrl = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

  try {
    console.log(`[Write Review] ????????????????????????: "${theme}"`);

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
      console.error(`[Write Review] Dify ??????????????????(${response.status}):`, errText);
      return res.status(response.status).json({ success: false, error: `Dify ???????: ${response.status}`, details: errText });
    }

    const data = await response.json();
    const resultStr = data?.data?.outputs?.result;

    if (!resultStr) {
      console.warn('[Write Review] ???????????? result ???:', data);
      return res.status(500).json({ success: false, error: 'Dify ????????????????? result ???' });
    }

    let parsedResult;
    try {
      const cleanJson = String(resultStr).replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
    } catch (e) {
      console.error('[Write Review] ???? result JSON ??:', e, resultStr);
      return res.status(500).json({ success: false, error: '????????????????????????????????? JSON' });
    }

    const responseData = {
      L1: parsedResult.L1 || parsedResult.L1_Grammar || '',
      L2: parsedResult.L2 || parsedResult.L2_Business_Tone || '',
      L3: parsedResult.L3 || parsedResult.L3_Strategic_Position || '',
      optimized_version: parsedResult.optimized_version || ''
    };

    console.log(`[Write Review] ?????????????????????????? JSON ????`);
    return res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('[Write Review] ?????????????', error);
    return res.status(500).json({ success: false, error: `??????????????????: ${error.message}` });
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
      '?????': 0,
      'TOEFL': 0,
      'GRE': 0,
      'BUSINESS': 0,
      '?????': 0,
      '???????': 0
    };
    
    rows.forEach(r => {
      try {
        const parsed = JSON.parse(r.response_payload);
        const level = parsed?.payload?.level || parsed?.level;
        if (level && levelCounts[level] !== undefined) {
          levelCounts[level]++;
        } else if (level) {
          levelCounts['?????']++;
        } else {
          levelCounts['???????']++;
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
    payload.meaning === '????????' || 
    payload.meaning === '????????' ||
    (payload.phonetic && payload.phonetic.includes('??')) ||
    (payload.definition_en && payload.definition_en.includes('????????')) ||
    (payload.business_note && payload.business_note.includes('?????????????')) ||
    (Array.isArray(payload.examples) && payload.examples.some(ex => typeof ex === 'string' && ex.includes('???1')));

  if (hasPlaceholder) {
    console.log(`[Payload Enrich] ????????? "${row.word}" (ID: ${row.id}) ????????? payload?????????????????????????...`);
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
            
            let meaning = dp.translation_main || (Array.isArray(dp.definitions_en) ? dp.definitions_en[0] : '????????');
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
              source: '??????????????'
            };

            db.prepare('UPDATE vocabulary SET payload = ? WHERE id = ?').run(JSON.stringify(newPayload), row.id);
            console.log(`[Payload Enrich] ?????????????? "${row.word}" ?????? payload`);
            return newPayload;
          }
        }
      }
    } catch (err) {
      console.error(`[Payload Enrich] ??????????????????????? for "${row.word}":`, err);
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
    const taskName = `???????????????: ${row.word}`;
    const task = taskQueue.createTask('image-gen', taskName);

    // ???????? task ID ??????
    res.json({ success: true, taskId: task.id, status: task.status });

    // ??????????????????
    setImmediate(async () => {
      try {
        const baseUrl = process.env.IMAGE_GEN_BASE_URL || 'https://23.95.214.232/v1';
        const apiKey = process.env.IMAGE_GEN_API_KEY || 'sk-899c9c34738f61b5-2u53op-6ed8a313';
        const models = (process.env.IMAGE_GEN_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
        if (models.length === 0) models.push(...DEFAULT_IMAGE_GEN_MODELS);

        taskQueue.updateTask(task.id, { status: 'running', logs: ['????????? 9router /v1/images/generations'] });
        console.log(`[generate-image] prompt: "${memoryAids.image_prompt}", models: [${models.join(', ')}]`);

        let imageUrl = '';
        let downloadUrl = '';
        let lastError = '';

        for (const model of models) {
          console.log(`[generate-image] try model=${model}`);
          taskQueue.updateTask(task.id, { logs: [`???????: ${model}`] });

          const result = await tryGenerateImageOnce(baseUrl, apiKey, model, memoryAids.image_prompt);
          if (result.ok) {
            imageUrl = result.imageUrl;
            downloadUrl = result.downloadUrl;
            console.log(`[generate-image] success model=${model} url=${imageUrl}`);
            taskQueue.updateTask(task.id, { logs: [`???? ${model} ??????`] });
            break;
          } else {
            lastError = result.error;
            console.log(`[generate-image] model ${model} failed: ${lastError}`);
            taskQueue.updateTask(task.id, { logs: [`???? ${model} ??: ${lastError}`] });
          }
        }

        if (!imageUrl) {
          console.error('[generate-image] all models failed');
          taskQueue.updateTask(task.id, {
            status: 'failed',
            error: `???????????????????????????????: ${lastError}`
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
          logs: ['????????????????????????']
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

// ???????????????????????? Dify ???????????? -> ??? -> ??? -> ??????????
app.post('/api/material/process-and-extract', async (req, res) => {
  const { topic, userId, files, user_current_profile } = req.body;

  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: '??????????????????????????' });
  }

  const taskQueue = require('./services/taskQueue');
  const taskName = `??????: ${files[0]?.fileName || '??????????'}`;
  const task = taskQueue.createTask('material', taskName);

  // ???????? taskId ???????????????????
  res.json({ success: true, taskId: task.id, status: task.status });

  // ??????????????????
  setImmediate(async () => {
    // ????????????????????????
    const DATASET_KEY = 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
    const WORKFLOW_KEY = 'app-cArGQg7bAnePU0ts63FoHrAG';
    const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    try {
      taskQueue.updateTask(task.id, {
        status: 'running',
        progress: 5,
        logs: ['[???] ?????????????????...']
      });

      // ---------------------------------------------------------
      // 使用固定 ID 直接访问 Knowleage_Pro_Scenarios 知识库
      // ---------------------------------------------------------
      const datasetId = KNOWLEAGE_PRO_SCENARIOS_DATASET_ID;

      // ---------------------------------------------------------
      // ?????????????????????????????????????????
      // ---------------------------------------------------------
      taskQueue.updateTask(task.id, {
        progress: 20,
        logs: ['[进度] 正在清空 Knowleage_Pro_Scenarios 知识库...']
      });
      const docsResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/documents?page=1&limit=100`, {
        headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
      });
      if (!docsResponse.ok) throw new Error(`????????????????????? (HTTP ${docsResponse.status})`);
      const docsData = await docsResponse.json();
      const docIds = docsData.data?.map(d => d.id) || [];

      // ????????????????????????
      if (docIds.length > 0) {
        taskQueue.updateTask(task.id, {
          progress: 30,
          logs: [`[???] ??????? ${docIds.length} ????????????????????????...`]
        });
        await Promise.all(docIds.map(async docId => {
          const delRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${docId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
          });
          if (!delRes.ok) console.warn(`[???] ????????????? ${docId} ?? (HTTP ${delRes.status})`);
        }));
        taskQueue.updateTask(task.id, {
          progress: 40,
          logs: ['[???] ??????????????????']
        });
      } else {
        taskQueue.updateTask(task.id, {
          progress: 40,
          logs: ['[???] ????????????????????????']
        });
      }

      // ---------------------------------------------------------
      // ??????????????????????????????????
      // ---------------------------------------------------------
      taskQueue.updateTask(task.id, {
        progress: 45,
        logs: ['[???] ???????????????? Base64 ??????????????...']
      });
      const fileObj = files[0];
      const base64Data = fileObj.content || fileObj.base64 || '';
      const base64Content = base64Data.replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');

      // ???? Node 18+ ???????? Blob ??? FormData ?????????????????
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', blob, fileObj.fileName || 'upload_material.pdf');
      // ???????????????????????????????????????????? (Hierarchical)
      // ?????????????? rules (?????? pre_processing_rules ??? subchunk_segmentation)
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
        logs: ['[???] ??????????????????????? Dify ??????????????????...']
      });
      const uploadResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/document/create_by_file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DATASET_KEY}` },
        body: formData
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`Dify ?????????????: ${errText}`);
      }

      const uploadData = await uploadResponse.json();
      const documentId = uploadData.document?.id;
      const batchId = uploadData.batch;

      if (!documentId || !batchId) {
        throw new Error('??????????????????? Dify ?????? batch ID ????????????');
      }

      taskQueue.updateTask(task.id, {
        progress: 55,
        logs: [`[???] ????????????? (ID: ${documentId}, Batch: ${batchId})?????????????????????????...`]
      });

      // ---------------------------------------------------------
      // ??????????????????????????????????????????????????????
      // ---------------------------------------------------------
      let isIndexed = false;
      // ??? 40 ??????? 3 ?????????????? 120 ?????????????
      for (let i = 0; i < 40; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const statusRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${batchId}/indexing-status`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
        });

        if (!statusRes.ok) continue; // ???????????????????????????????????
        const statusData = await statusRes.json();
        // ??????????????????? (????????????????)
        const docInfo = statusData.data?.[0];

        if (docInfo) {
          taskQueue.updateTask(task.id, {
            progress: Math.min(68, 55 + i),
            logs: [`[???] ? ${i + 1} ????? Dify ?????????: ${docInfo.indexing_status}`]
          });
          if (docInfo.indexing_status === 'completed') {
            isIndexed = true;
            break;
          } else if (docInfo.indexing_status === 'error') {
            throw new Error('Dify ??????????????????????????????????????');
          }
        }
      }

      if (!isIndexed) {
        throw new Error('Dify indexing timeout (>120s).');
      }

      taskQueue.updateTask(task.id, {
        progress: 70,
        logs: ['[???] ????????????????????????????????? Dify ????????????...']
      });

      // --- ??????????????? Dify ?????????????????? ---
      let articleText = "";
      try {
        const segmentsRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${documentId}/segments`, {
          headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
        });
        if (segmentsRes.ok) {
          const segmentsData = await segmentsRes.json();
          const segments = segmentsData.data || [];
          articleText = segments.map(s => s.content || '').join('\n\n');
        } else {
          console.warn("[Material] ??????????????????????????", segmentsRes.status);
        }
      } catch (e) {
        console.error("[Material] ????????????????????:", e.message);
      }

      // ---------------------------------------------------------
      // ???????????????????????????????????????????????
      // ---------------------------------------------------------
      taskQueue.updateTask(task.id, {
        progress: 75,
        logs: ['[???] ??????????????????????????????????????????????????????...']
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
        throw new Error(`??????????? (HTTP ${wfResponse.status}): ${errText.substring(0, 200)}`);
      }
      const wfData = await wfResponse.json();

      // ??????????????????????????????????????????????????????????????????
      const outputs = wfData?.data?.outputs || {};
      const rawExtracted = outputs.extracted_words || outputs.result || outputs.text || '';

      let extractedItems = [];
      if (Array.isArray(rawExtracted)) {
        extractedItems = rawExtracted;
      } else if (typeof rawExtracted === 'string') {
        // ???????????? JSON ????
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
          // ???????????????????????
          extractedItems = rawExtracted.split(/[,??\n]+/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 500);
        }
      }

      // ??????? extractedItems ?????????? item ??? category ???????????????
      for (const item of extractedItems) {
        if (typeof item === 'object' && item !== null) {
          // ??? ??????????????????? category???????????????????
          if (item.category === 'word') item.is_phrase = false;
          else if (item.category === 'phrase') item.is_phrase = true;
          else if (item.category === 'sentence') item.is_sentence = true;
        }
      }

      let wordsToReturn = [];
      let phrasesToReturn = [];
      let sentencesToReturn = [];

      // ??????????
      for (const item of extractedItems) {
        const isObject = typeof item === 'object' && item !== null;
        const wordStr = isObject ? (item.word || item.phrase || item.text || JSON.stringify(item)) : item;
        const cleanStr = String(wordStr).trim();
        if (!cleanStr) continue;

        // ??? ????????????????????????????????????????
        let dictType = classifyByWordCount(cleanStr);

        if (dictType === 'ai_sentence') {
          sentencesToReturn.push(isObject ? item : cleanStr);
        } else if (dictType === 'ai_phrase') {
          phrasesToReturn.push(isObject ? item : cleanStr);
        } else {
          wordsToReturn.push(isObject ? item : cleanStr);
        }
      }

      // ?????????????????????
      const vocabToInsert = [...wordsToReturn, ...phrasesToReturn];

      taskQueue.updateTask(task.id, {
        progress: 85,
        logs: [`[???] ????????????? ${vocabToInsert.length} ??????????????? ${sentencesToReturn.length} ????????????????????? SQLite ?????????????...`]
      });

      /**
       * ??????????????????????????????????????????????
       * @param {string} str - ?????????
       * @returns {number} ?????????
       */
      function countWords(str) {
        if (!str || typeof str !== 'string') return 0;
        return str
          .trim()
          .replace(/[.!?,;:'"()[\]{}]/g, '')   // ?????????????
          .split(/\s+/)                           // ????????????????
          .filter(w => w.length > 0)             // ????????
          .length;
      }

      /**
       * ??????????????????????????
       * - ??????ai_extracted?????? 1 ??????????
       * - ??????ai_phrase???????2 ??????????????????
       * - ??????ai_sentence????? . ! ? ???????? ???5 ????????????
       *
       * @param {string} wordStr - ???????????
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

      // ?????? SQLite
      let addedCount = 0;
      const now = Date.now();
      for (const item of vocabToInsert) {
        const isObject = typeof item === 'object' && item !== null;
        const wordStr = isObject ? (item.word || item.phrase || item.text || JSON.stringify(item)) : String(item);
        if (!wordStr) continue;

        // ??? ????????????????????????????????????????????
        const dictType = classifyByWordCount(wordStr);

        // ??? payload
        let payload = { source: 'Material Upload' };
        if (isObject && item.payload) {
          payload = item.payload;
          if (!payload.source) payload.source = 'Material Upload';
        }

        const existing = db.prepare('SELECT id, payload FROM vocabulary WHERE word = ? COLLATE NOCASE').get(wordStr);
        if (!existing) {
          const id = crypto.randomUUID();
          db.prepare(`
            INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, wordStr, dictType, topic || 'material_extraction', JSON.stringify(payload), now, now, '[]');
          addedCount++;
        } else {
          // ???????????? payload ??????????????????????????
          let oldPayload = {};
          try { oldPayload = JSON.parse(existing.payload || '{}'); } catch(e) {}
          if (!oldPayload.meaning || Object.keys(oldPayload).length <= 2) {
            db.prepare('UPDATE vocabulary SET dict_type = ?, category = ?, payload = ? WHERE id = ?').run(
              dictType,
              topic || 'material_extraction',
              JSON.stringify(payload),
              existing.id
            );
          }
        }
      }

      // ===== ???????????????dict_type = 'ai_sentence'?? =====
      let addedSentenceCount = 0;
      for (const item of sentencesToReturn) {
        const isObject = typeof item === 'object' && item !== null;
        const sentenceStr = isObject
          ? (item.word || item.sentence || item.text || '')
          : String(item);
        const cleanSent = String(sentenceStr).trim();
        if (!cleanSent || cleanSent.length > 500) continue;

        // ???????????????? 50 ?????? LIKE ???????????????????
        const probe = cleanSent.substring(0, 50).replace(/[%_]/g, '\\$&');
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
        `).run(id, cleanSent, 'ai_sentence', topic || 'material_extraction', JSON.stringify(sentPayload), now, now, '[]');
        addedSentenceCount++;
      }

      // ??????????????????????????
      taskQueue.updateTask(task.id, {
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
          results: [
            {
              fileName: fileObj.fileName || "Document",
              summary: `Closed loop completed: cleared ${docIds.length} old documents, new file imported successfully. Model extracted ${vocabToInsert.length} terms, actual added ${addedCount} words.`,
              key_points: wordsToReturn.slice(0, 5).map(i => typeof i === 'object' ? (i.word || i.text) : String(i))
            }
          ]
        },
        logs: ['[???] ???????????????????????????????????????????????']
      });

    } catch (error) {
      console.error('[Material Process Worker Error]:', error);
      taskQueue.updateTask(task.id, {
        status: 'failed',
        progress: 100,
        logs: [`[???] ??????????????${error.message}`]
      });
    }
  });
});// ==========================================
// ????????????????+???????????????????????????????????????????????// ??????????????????????50 ??? + 30 ????
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
  return base;
}

// ==========================================
// 多角色沙盘：主对话代理（English_Oral_Sandbox Chatflow）
// API Key 仅保存在服务端 DIFY_ORAL_API_KEY
// ==========================================
app.post('/api/english/oral/chat', async (req, res) => {
  const {
    query,
    conversationId = null,
    userId = 'default-user',
    inputs = {},
  } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ message: '缺少 query 参数。' });
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
    return res.status(500).json({ message: err.message || '口语沙盘对话代理失败' });
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

  const apiKey = process.env.DIFY_ORAL_API_KEY
    || process.env.VITE_DIFY_ORAL_API_KEY
    || 'app-LfCGgdQrwlGTfegQNYeEzpB9';
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
    if (now - task.createdAt > 2 * 60 * 60 * 1000) { // ????2????????
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

// ????????? daily-extract??????? taskId ????????
app.post('/api/english/daily-extract', async (req, res) => {
  const { topic, materialText, userId = 'default-user', cefrLevel = 'B1', genre = 'meeting', user_current_profile } = req.body;
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
  const { topic, materialText, userId = 'default-user', cefrLevel = 'B1', genre = 'meeting', user_current_profile, _system_time, _system_timestamp_ms } = requestBody;
  
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
      console.warn('[Daily Extract] ???????????????????:', e.message);
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

    const difyApiKey = process.env.VITE_DIFY_ENGLISH_MASTERY_KEY || 'app-OShKY1EcVuLFkuxrpO28ZB0A';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    let wfResponse;
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 10 * 60 * 1000); // 10???????????

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
      console.error("[Daily Extract] Dify fetch ????????:", fetchErr);
      extractionTasks.set(taskId, { status: 'failed', error: `Dify ???????????: ${fetchErr.message}`, createdAt: Date.now() });
      return;
    }

    if (!wfResponse.ok) {
      const errText = await wfResponse.text();
      console.error("[Daily Extract] Dify ??????", errText);
      extractionTasks.set(taskId, { status: 'failed', error: `Dify ???????: ${wfResponse.status} - ${errText}`, createdAt: Date.now() });
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
          console.error("[Daily Extract] ?????????:", readErr);
          extractionTasks.set(taskId, { status: 'failed', error: `???????????: ${readErr.message}`, createdAt: Date.now() });
          return;
        }
      } else {
        try {
          for await (const chunk of wfResponse.body) {
            const chunkText = decoder.decode(chunk, { stream: true });
            parseSSELines(chunkText);
          }
        } catch (readErr) {
          console.error("[Daily Extract] ????????:", readErr);
          extractionTasks.set(taskId, { status: 'failed', error: `???????????: ${readErr.message}`, createdAt: Date.now() });
          return;
        }
      }
      
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
      extractionTasks.set(taskId, { status: 'failed', error: "Streaming not supported by Dify backend", createdAt: Date.now() });
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
      const isSentenceHeuristic = w.length > 30 && (/[.!???????]$/.test(w) || w.split(' ').length >= 5);
      
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
           const isSentenceHeuristic = cleanText.length > 30 && (/[.!???????]$/.test(cleanText) || cleanText.split(' ').length >= 5);
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
          `).run(id, s, 'ai_sentence', topic || 'daily_extraction', JSON.stringify({ source: 'Daily Extract', topic, type: 'sentence' }), now, now, '[]');
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
      console.warn('[Daily Extract] ??????????????????:', e.message);
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
    result: { scene: "??????????", content: "?????????????????????????????????.." }
  });
});

// ==========================================
// ??????? API (Pronunciation Assessment)
// ????? Dify ????????????????????????// ==========================================
app.post('/api/pronunciation-assessment', async (req, res) => {
  const { targetText, recognizedText, user_current_profile, userId = 'default-user' } = req.body;

  if (!targetText) {
    return res.status(400).json({ success: false, error: '?????????????? (targetText)' });
  }

  try {
    const difyApiKey = process.env.DIFY_PRONUNCIATION_API_KEY;
    if (!difyApiKey) {
      console.error('??? DIFY_PRONUNCIATION_API_KEY ??????????');
      return res.status(500).json({ success: false, error: '????????????????????? API Key' });
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
      console.error('Dify ????????????:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify ?????: ${response.status} - ${errText}` });
    }

    const data = await response.json();
    console.log('Dify ??????????:', JSON.stringify(data, null, 2));

    // ???????????? - ??????????????????????? JSON
    const outputs = data?.data?.outputs ?? {};

    const score = typeof outputs.score === 'number' ? outputs.score : 0;
    const phonetic = typeof outputs.phonetic === 'string' ? outputs.phonetic : '';
    const issueType = typeof outputs.issue_type === 'string' ? outputs.issue_type : 'other';
    const analysis = typeof outputs.analysis === 'string' ? outputs.analysis : '?????????';
    const suggestion = typeof outputs.suggestion === 'string' ? outputs.suggestion : '';

    res.json({
      success: true,
      score,
      phonetic,
      issueType,
      analysis,
      suggestion,
      correctionNote: `${analysis}????{suggestion}`,
      target_text: targetText,
      recognized_text: recognizedText || '',
    });
  } catch (err) {
    console.error('??????? API ???:', err);
    res.status(500).json({ success: false, error: '????????????????' });
  }
});

// ==========================================
// ????????????? API (Grammar Polish)
// ????? Dify ?????????????????????
// ==========================================
app.post('/api/grammar-polish', async (req, res) => {
  const { originalText, user_current_profile, userId = 'default-user' } = req.body;

  if (!originalText) {
    return res.status(400).json({ success: false, error: '?????????????? (originalText)' });
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
      console.error('Dify ????????????:', response.status, errText);
      let errorMsg = errText;
      try {
        const errObj = JSON.parse(errText);
        if (errObj.code === "not_chat_app") {
           errorMsg = "Dify ????????????: ????? workflow ????? API ??? (/workflows/run)";
        }
      } catch(e) {}

      return res.status(response.status).json({ success: false, error: `Dify ?????: ${response.status} - ${errorMsg}` });
    }

    const data = await response.json();
    console.log('Dify ?????????????????:', JSON.stringify(data, null, 2));

    // ?? Grammar_Polish_Engine.yml ??????????????????????????????????????polished_result
    const polishedText = data?.data?.outputs?.polished_result || '???????????????????????????????????????????????????????';

    res.json({
      success: true,
      polishedText
    });
  } catch (err) {
    console.error('??????? API ???:', err);
    res.status(500).json({ success: false, error: '????????????????' });
  }
});

// ==========================================
// 3. ????????????? API (Game Theory & Prototypes)
// ==========================================

// ????????????????????????????????????????????????????????????????????????????
app.post('/api/game-theory/analyze', async (req, res) => {
  const { scene_type, game_model, case_text, user_answer, applied_tactics, user_current_profile, userId = 'default-user' } = req.body;

  if (!case_text || !user_answer) {
    return res.status(400).json({ success: false, error: '????????????????????????????????????' });
  }

  try {
    const difyApiKey = process.env.VITE_DIFY_GAME_THEORY_KEY || 'app-YysFumsmeSAeJaQMobMpW24r';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

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
      console.error('Dify ??????????????:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify ?????: ${response.status} - ${errText}` });
    }

    const data = await response.json();
    
    const rawResult = data?.data?.outputs?.analysis_result ?? data?.data?.outputs?.result ?? data?.answer ?? data?.message ?? '';
    const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanJson);
    } catch (e) {
      console.error('???? Dify ????????JSON ??:', e, rawResult);
      return res.status(500).json({ success: false, error: '?????????????????????????????????????????? JSON' });
    }

    // ?????????????????????????????????
    if (parsedResult.prototype_archive && parsedResult.prototype_archive.name) {
      const proto = parsedResult.prototype_archive;
      const protoName = proto.name.trim();
      const protoType = proto.type || '????????';
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
    console.error('??????????????????:', err);
    res.status(500).json({ success: false, error: '??????????????????: ' + err.message });
  }
});

function parseBiweeklyReviewXml(rawText) {
  const text = String(rawText || '');
  const analysisMatch = text.match(/<analysis>([\s\S]*?)<\/analysis>/);
  const factorsMatch = text.match(/<factors>([\s\S]*?)<\/factors>/);
  return {
    analysis: (analysisMatch ? analysisMatch[1] : text).trim(),
    shortDebilitatingFactors: (factorsMatch ? factorsMatch[1] : '缺乏开创力').trim(),
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
      process.env.VITE_DIFY_BIWEEKLY_REVIEW_API_KEY
      || process.env.DIFY_BIWEEKLY_REVIEW_API_KEY
      || 'app-p8u1qA8A6iWDB6FzEOtjectn';
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

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

// ??????????????? API ?????????? Cognitive Penetration Engine
app.post('/api/game-theory/ascension', async (req, res) => {
  const { event_text, layers, dimension, user_current_profile, userId = 'default-user' } = req.body;
  if (!event_text || !Array.isArray(layers) || layers.length < 5) {
    return res.status(400).json({ success: false, error: '??????????? 5 ????????????????????' });
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
      console.error('Dify ?????????????:', response.status, errText);
      return res.status(response.status).json({ success: false, error: `Dify ?????: ${response.status} - ${errText}` });
    }

    const data = await response.json();
    const raw = data?.data?.outputs?.result ?? data?.data?.outputs?.analysis_result ?? data?.answer ?? data?.message ?? '';
    const cleanJson = String(raw).replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanJson);
    } catch (e) {
      console.error('???? Dify ???????????????? JSON ??:', e, raw);
      return res.status(500).json({ success: false, error: '????????????????????????????? JSON' });
    }

    res.json({ success: true, result: parsedResult });
  } catch (err) {
    console.error('???????????:', err);
    res.status(500).json({ success: false, error: '???????????: ' + err.message });
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
 * TTS ???????????????? TTS ????????????????????
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
    // 放宽超时到 5 分钟 (300000 ms)
    const proc = execFile(command, args, { timeout: 300000 }, (err) => {
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
 * ??????????????????????????????????????????????????????????????
 * @param {string} cleanInput ???????????
 * @param {string} finalModel TTS ????
 * @param {string} audioPath ????? mp3 ???????
 * @param {string|null} taskId ???????ID??????????????????
 * @param {AbortSignal|null} signal ??????? AbortSignal
 */
async function synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, taskId = null, signal = null) {
  const chunkCacheDir = audioPath + '.chunks';
  const maxAttempts = taskId ? 8 : 2;
  try {
  const taskQueue = taskId ? require('./services/taskQueue') : null;
  const ttsUpstreamUrls = getTtsUpstreamUrls();
  const apiKey = process.env.TTS_API_KEY || 'sk-899c9c34738f61b5-2u53op-6ed8a313';
  const ttsVoice = finalModel.includes('/') ? finalModel.split('/')[1] : '';
  const gatewayFailed = { value: false }; // 标记是否走了本地 fallback
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
      taskQueue.updateTask(taskId, { progress: 100, logs: ['????????????????????????????'] });
    }
    if (!isValidCachedAudio(audioPath)) {
      throw new Error('????????????????????????????0 ???????');
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
          logs: [`????? ${nextWrite}/${total} ???????`]
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
        taskQueue.updateTask(taskId, { logs: [`????? ${idx + 1}/${total} ????????`] });
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
              taskQueue.updateTask(taskId, { logs: [`第 ${attempt} 次: 本地 edge-tts 失败，尝试上游网关...`] });
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
          break; // ??????????????????????
        }

        // 502/504 ????????? -> ??????? Edge TTS ???????????
        if (r.status === 502 || r.status === 504) {
          console.warn(`[TTS] Gateway error ${r.status}, trying fallback...`);
          if (taskQueue && taskId) {
            taskQueue.updateTask(taskId, { logs: [`? ${attempt} ?: ????????? ${r.status}???????????????...`] });
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
              taskQueue.updateTask(taskId, { logs: [`????????????: ${fallbackErr.message}`] });
            }
            lastErr = new TtsGatewayError(`??????? ${r.status}????????????????: ${fallbackErr.message}`);
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
            logs: [`????? ${idx + 1}/${total} ?${attempt}?????${Math.round(delay/1000)}?????????...`]
          });
        }
        await new Promise(r => setTimeout(r, delay));
      }
    }

    if (lastErr) {
      // ????????????????????
      fs.rmSync(chunkCacheDir, { recursive: true, force: true });
      throw new Error(`????? ${idx + 1}/${total} ???????: ${lastErr?.message}`);
    }
  }

  // ?????????????
  fs.rmSync(chunkCacheDir, { recursive: true, force: true });

  if (!isValidCachedAudio(audioPath)) {
    throw new Error('?????????????????????????????0 ???????');
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

// TTS ????????????????????????????????????????????? OOM ?????????
let ttsLongLock = false;

// TTS ??????????????????????????? / ?????????????????????
app.post('/api/tts/speech', async (req, res) => {
  try {
    const { input, model = 'edge-tts/en-US-EmmaNeural', isAsync } = req.body;
    if (!input) return res.status(400).json({ error: 'Missing input text' });

    const finalModel = model || 'edge-tts/en-US-EmmaNeural';
    // 移除 Emoji
    let cleanInput = input.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{27BF}]/gu, '');
    
    // 针对纯英文 TTS 模型，过滤掉中文字符及全角标点，避免 edge-tts 遇到无法发音的字符崩溃 (NoAudioReceived)
    if (finalModel.includes('/en-') || finalModel.startsWith('en-')) {
      cleanInput = cleanInput.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g, '').trim();
      
      // 熔断机制：如果过滤后没有任何有效字母或数字，直接返回空音频，防止 edge-tts 读空气报错 500
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
          message: '??????????????????????????????????????? 3~10 ????????'
        });
      }
      ttsLongLock = true;

      const taskQueue = require('./services/taskQueue');
      const task = taskQueue.createTask('tts', `???????????????? (${cleanInput.length}???)`);

      // ?????????????? try/catch ???? res.json??????????????????????????
      try {
        res.json({ success: true, taskId: task.id, status: 'pending', audioUrl: null });
      } catch (e) {
        ttsLongLock = false;
        return; // ???????????
      }

      // ?????????setImmediate ???????????????????? Express ????
      setImmediate(async () => {
        try {
          taskQueue.updateTask(task.id, { status: 'running', logs: [`????????????????????: ${cleanInput.length}`] });
          await synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, task.id);
          taskQueue.updateTask(task.id, {
            status: 'completed', progress: 100,
            result: { audioId: md5, audioUrl },
            logs: ['???????????????']
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
        message: '??????????????????????????????????'
      });
    }
    if (error.message && error.message.includes('??????????????????????')) {
      return res.status(429).json({
        success: false,
        code: 'TTS_LOCKED',
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      code: 'TTS_INTERNAL_ERROR',
      message: error.message || '???????????????????'
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
      return res.status(404).json({ success: false, error: '???????????????????' });
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
        error: task.error || '??????????',
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
      return res.status(400).json({ success: false, error: '???????????: url' });
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
      return res.status(400).json({ success: false, error: '???????????: uploadId, chunkIndex ??? chunk' });
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
      return res.status(400).json({ success: false, error: '???????????: uploadId, fileName ??? totalChunks' });
    }

    const sessionDir = path.join(chunkDir, uploadId);
    if (!fs.existsSync(sessionDir)) {
      return res.status(400).json({ success: false, error: '????????????????????????????????' });
    }

    // ??????????????????????????????????????
    const safeFileName = fileName.replace(/[\\\/]/g, '_');
    const finalFileName = `${uploadId}_${safeFileName}`;
    const finalFilePath = path.join(uploadDir, finalFileName);

    // ??? appendFileSync ?????????
    fs.writeFileSync(finalFilePath, ''); // ??????????????
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(sessionDir, String(i));
      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({ success: false, error: `?????: ???? ${i} ????????` });
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
    const taskName = `???????(??????): ${fileName}`;
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
      return res.status(400).json({ success: false, error: '??????????????' });
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
      return res.status(400).json({ success: false, error: '???????????: ?????? url ?????? video ????' });
    }

    const taskQueue = require('./services/taskQueue');
    const { startTranscribeTask } = require('./services/videoTranscriber');

    // ??????????????
    const taskName = url ? `???????: ${url}` : `???????: ${file.originalname || '???????????'}`;
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
      return res.status(404).json({ success: false, error: '???????????????????' });
    }
    res.json({ success: true, ...task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Whisper ????????????? API???????????????? 9router ??????? CORS ??????????
app.post('/api/audio/transcriptions', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    if (typeof globalThis.FormData !== 'undefined') {
      const fileBuffer = fs.readFileSync(req.file.path);
      const mimeType = req.file.mimetype;
      const originalName = req.file.originalname || 'audio.mp3';

      const modelsToTry = [
        { model: 'groq/whisper-large-v3', response_format: 'json' },
        { model: 'openai/whisper-1', response_format: 'json' },
        { model: 'aai/universal-3-pro' }
      ];

      let lastError = null;
      let successData = null;

      for (const config of modelsToTry) {
        try {
          console.log(`[STT Polling] ??????????????????????: ${config.model}`);
          const formData = new globalThis.FormData();
          const blob = new globalThis.Blob([fileBuffer], { type: mimeType });
          
          formData.append('file', blob, originalName);
          formData.append('model', config.model);
          if (config.response_format) {
            formData.append('response_format', config.response_format);
          }

          const response = await fetch('https://9router.234124123.xyz/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': req.headers.authorization || 'Bearer sk-899c9c34738f61b5-2u53op-6ed8a313',
            },
            body: formData,
          });

          const data = await response.json().catch(() => ({}));
          if (response.ok && data && (data.text || typeof data === 'object')) {
            successData = data;
            console.log(`[STT Polling] ???? ${config.model} ???????????`);
            break;
          } else {
            const errStr = data?.error?.message || data?.error || JSON.stringify(data);
            console.warn(`[STT Polling] ???? ${config.model} ???????????: ${response.status}, ????: ${errStr}`);
            lastError = new Error(`Model ${config.model} status ${response.status}: ${errStr}`);
          }
        } catch (err) {
          console.warn(`[STT Polling] ???? ${config.model} ??????:`, err.message);
          lastError = err;
        }
      }

      if (successData) {
        return res.json(successData);
      } else {
        console.error('[STT Polling] ????????????????????????????????');
        return res.status(500).json({ error: 'All transcription APIs failed.', details: lastError?.message });
      }
    } else {
      throw new Error('????????? Node.js ???????????????????????????? FormData?????? Node.js ??? 18.0 ?????????????????');
    }
  } catch (error) {
    console.error('Whisper ????:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.warn('???????????????????:', unlinkErr.message);
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
});
