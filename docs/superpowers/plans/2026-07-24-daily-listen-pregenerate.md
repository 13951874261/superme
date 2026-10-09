# Daily Listen Pregenerate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每日凌晨在 daily-pack 之后为有效用户预生成当前主题下 36 组听写长文+音频；前台优先读缓存；未命中/部分就绪可提交 `listen_backfill` 进任务中心；清理超 7 天并限制总量 ≤1024MB。

**Architecture:** 复用 `dailyPackService` 日期工具与 `user_theme_prefs`；新增登录打点表；`daily_listen_articles` / `daily_listen_audios` 分表存元数据；文件落在 `vocab-server/public/daily_*`；生成逻辑封装为 `dailyListenPreGenerateService`（内部调用现有 Dify 长文流式生成 + Edge TTS）；`dailyPackCron` 在同一 02:00 tick 内先 pack 后 listen；API `GET/POST /api/listen/pregenerated*`；`ListenTab` 对 5/15/25 优先缓存，其它时长仍实时。

**Tech Stack:** Node.js + Express + better-sqlite3（vocab-server）；React + Vite；既有 `taskQueue`；Dify listen material + Edge TTS

**Design contract:** 仓库根目录 `DESIGN.md`（2026-07-24 Listen pregenerate 段）

**Locked product decisions:** C1 / A2 / B3(1024MB) / B4(partial) / A5(regen writeback) / A6(after daily-pack) / A7(`listen_backfill`)

**Git:** 未获用户明确要求前 **不要 git commit**；完成实现与验证即可。

---

## File Structure

| 文件 | 职责 |
|------|------|
| `vocab-server/services/dailyListenPreGenerateService.js` | 建表、有效用户、单组合生成、查询状态、写库写盘、清理 |
| `vocab-server/services/dailyPackCron.js` | 02:00 tick：先 daily-pack，再 listen 预生成+清理 |
| `vocab-server/server.js` | 挂载 login ping、GET pregenerated、POST backfill、init 表、静态目录 |
| `vocab-server/scripts/smoke-daily-listen.mjs` | 无 Dify 的表/查询/清理 smoke |
| `src/services/listenPregeneratedAPI.ts` | 前端客户端 |
| `src/services/userSessionAPI.ts` 或扩 `profileHelper` | 登录打点 `POST /api/user/login-ping` |
| `src/components/TaskContext.tsx` | `TaskItem.type` 增加 `listen_backfill` |
| `src/components/GlobalTaskCenter.tsx` | 图标/完成态（勿用「导入并提纯」） |
| `src/components/modules/english/tabs/ListenTab.tsx` | 缓存优先、partial、backfill CTA、regen writeback |
| `src/components/LoginPage.tsx` / `App.tsx` / `profileHelper.ts` | 会话初始化后 login-ping |
| `DESIGN.md` | 已刷新（本任务勿再改除非矛盾） |

---

### Task 1: 建表 + 静态目录 + 日期/用户工具

**Files:**
- Create: `vocab-server/services/dailyListenPreGenerateService.js`
- Modify: `vocab-server/server.js`（require + `initDailyListenTables(db)` + static mounts）

- [ ] **Step 1: 创建 service 骨架（建表与常量）**

```javascript
// vocab-server/services/dailyListenPreGenerateService.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dailyPackService = require('./dailyPackService');

const GENRES = ['meeting', 'news', 'podcast'];
const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1'];
const DURATIONS = [5, 15, 25]; // minutes; A2
const CAPACITY_BYTES = 1024 * 1024 * 1024; // 1024MB (B3)
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

module.exports = {
  GENRES,
  CEFR_LEVELS,
  DURATIONS,
  CAPACITY_BYTES,
  RETENTION_DAYS,
  AUDIO_ROOT,
  ARTICLE_ROOT,
  initDailyListenTables,
  ensureDirs,
  recordUserLogin,
  listEligibleUsers,
  isCacheableDuration,
  comboKeyParts,
};
```

- [ ] **Step 2: 在 `server.js` 注册**

在 `dailyPackService.initDailyPackTables(db);` 之后：

```javascript
const dailyListenPreGenerateService = require('./services/dailyListenPreGenerateService');
dailyListenPreGenerateService.initDailyListenTables(db);
```

在现有 `app.use('/api/temp_audio', ...)` 附近增加：

```javascript
const dailyListenAudioDir = path.join(__dirname, 'public', 'daily_listen_audio');
const dailyLongArticlesDir = path.join(__dirname, 'public', 'daily_long_articles');
app.use('/api/daily_listen_audio', express.static(dailyListenAudioDir));
app.use('/api/daily_long_articles', express.static(dailyLongArticlesDir));
```

- [ ] **Step 3: 验证建表**

Run（在 `vocab-server`，使用项目 Node）：

```bash
node -e "const Database=require('better-sqlite3'); const db=new Database('vocab.db'); const s=require('./services/dailyListenPreGenerateService'); s.initDailyListenTables(db); console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'daily_listen%' OR name='user_login_logs'\").all());"
```

Expected: 三张表名打印出来。

---

### Task 2: 登录打点 API + 前端调用

**Files:**
- Modify: `vocab-server/server.js`
- Modify: `src/utils/profileHelper.ts`（或新建小 API 模块）
- Modify: `src/components/LoginPage.tsx` 和/或 `initializeUserSession`

- [ ] **Step 1: 后端 `POST /api/user/login-ping`**

```javascript
app.post('/api/user/login-ping', (req, res) => {
  try {
    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const result = dailyListenPreGenerateService.recordUserLogin(db, userId);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
```

- [ ] **Step 2: 前端在 `initializeUserSession` 成功后 fire-and-forget**

在 `profileHelper.ts` 的 `initializeUserSession` 末尾：

```typescript
export async function initializeUserSession(customUserId?: string): Promise<string> {
  const userId = ensureAppUserId(customUserId);
  await loadUserProfileFromServer(userId);
  void fetch('/api/user/login-ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  }).catch(() => {});
  return userId;
}
```

同时在 `App.tsx` 已认证启动路径（若跳过 LoginPage）也调用一次 ping（例如已有 session 时 `ensureAppUserId` 后 ping），避免「长期 keep-alive 从不登录页」漏记。最小做法：在 `App.tsx` 认证成功后的 `useEffect` 里对当前 `getAppUserId()` 调一次 login-ping。

- [ ] **Step 3: 手动验证**

```bash
curl -X POST http://127.0.0.1:3001/api/user/login-ping -H "Content-Type: application/json" -d "{\"userId\":\"u001\"}"
```

Expected: `{"success":true,"userId":"u001",...}`

---

### Task 3: 查询组合状态 + GET `/api/listen/pregenerated`

**Files:**
- Modify: `vocab-server/services/dailyListenPreGenerateService.js`
- Modify: `vocab-server/server.js`

- [ ] **Step 1: 实现 `getPregeneratedCombo`（含 partial / 文件缺失校验）**

```javascript
function getArticleRow(db, parts) {
  return db.prepare(`
    SELECT * FROM daily_listen_articles
    WHERE user_id=? AND pack_date=? AND theme=? AND genre=? AND cefr_level=? AND duration=?
  `).get(parts.userId, parts.packDate, parts.theme, parts.genre, parts.cefrLevel, parts.duration);
}

function getAudioRow(db, parts) {
  return db.prepare(`
    SELECT * FROM daily_listen_audios
    WHERE user_id=? AND pack_date=? AND theme=? AND genre=? AND cefr_level=? AND duration=?
  `).get(parts.userId, parts.packDate, parts.theme, parts.genre, parts.cefrLevel, parts.duration);
}

function fileOk(p) {
  return p && fs.existsSync(p) && fs.statSync(p).size > 0;
}

function resolveArticleStatus(row) {
  if (!row) return 'missing';
  if (row.status === 'generating') return 'generating';
  if (row.status === 'failed') return 'failed';
  if (row.status === 'ready') {
    if (row.body_text || fileOk(row.file_path)) return 'ready';
    return 'missing'; // DB ready but file gone
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
```

Export `getPregeneratedCombo`.

- [ ] **Step 2: 路由**

```javascript
app.get('/api/listen/pregenerated', (req, res) => {
  try {
    const { userId, theme, genre, cefrLevel, cefr, duration, date } = req.query;
    if (!userId || !theme || !genre || !(cefrLevel || cefr) || !duration) {
      return res.status(400).json({ success: false, error: 'userId, theme, genre, cefrLevel, duration required' });
    }
    const result = dailyListenPreGenerateService.getPregeneratedCombo(db, {
      userId, theme, genre, cefrLevel: cefrLevel || cefr, duration: Number(duration), date,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
```

- [ ] **Step 3: smoke 插入 ready 行后 GET 返回 ready**

在 smoke 脚本或 node -e 中插入假数据后 curl GET，期望 `status:"ready"`。

---

### Task 4: 单组合生成（长文 + TTS）写库写盘

**Files:**
- Modify: `vocab-server/services/dailyListenPreGenerateService.js`
- Note: 复用 `server.js` 内逻辑时，将可调用的合成函数通过 **注入依赖** 传入，避免循环 require。推荐在 service 导出 `setGenerators({ generateLongScript, synthesizeAudioFile })`，由 `server.js` 在启动时注入。

- [ ] **Step 1: upsert helpers + `generateOneCombo`**

```javascript
let generators = {
  generateLongScript: async () => { throw new Error('generateLongScript not injected'); },
  synthesizeAudioFile: async () => { throw new Error('synthesizeAudioFile not injected'); },
};

function setGenerators( partial ) {
  generators = { ...generators, ...partial };
}

function newId() {
  return crypto.randomUUID();
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
      fields.body_text ?? existing.body_text,
      fields.vocab_json ?? existing.vocab_json,
      fields.phrases_json ?? existing.phrases_json,
      fields.file_path ?? existing.file_path,
      fields.status,
      fields.source ?? existing.source,
      fields.error_message ?? null,
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

function upsertAudio(db, parts, fields) { /* mirror of upsertArticle for daily_listen_audios */ }

function parseVocabFromRaw(raw) {
  // Prefer ---VOCAB_JSON_START--- ... JSON ... ; fallback []
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
      // body already sanitized by generator if injected from server sanitizeListenMaterialScript
      script = typeof rawScript === 'string' ? rawScript : String(rawScript || '');
      // If generator returns already-sanitized body, use it; else strip vocab block for body_text
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
```

- [ ] **Step 2: 在 `server.js` 注入 generators**

在 listen/TTS 相关函数定义之后：

```javascript
dailyListenPreGenerateService.setGenerators({
  generateLongScript: async ({ theme, genre, cefr_level, duration, userId }) => {
    // 内联复用 generate-material-long 的 Dify streaming 调用（同步 await 完整 answer）
    // 返回 raw answer（可含 VOCAB_JSON）；service 会拆分
    // 实现时复制 generate-material-long 的 fetch+collectDifyStreamingAnswer 逻辑为可 await 函数
    // 不要走 taskQueue（cron/backfill 自己管进度）
  },
  synthesizeAudioFile: async (text, audioPath) => {
    // 调用现有 synthesizeAndSaveAudio(clean, model, audioPath)
    // model 与 /api/tts/speech 默认一致
  },
});
```

抽出 `async function generateListenLongScriptSync(inputs, userId)` 供路由与注入共用，避免复制粘贴两份 SSE 逻辑。

- [ ] **Step 3: 单元级 smoke（mock generators）**

```javascript
dailyListenPreGenerateService.setGenerators({
  generateLongScript: async () => 'Hello world script.\n---VOCAB_JSON_START---\n{"vocab":[],"phrases":[]}\n',
  synthesizeAudioFile: async (_t, p) => { fs.writeFileSync(p, Buffer.from('ID3')); },
});
```

调用 `generateOneCombo` 后 DB 两行 status=ready，文件存在。

---

### Task 5: 清理（7 天 + 1024MB）

**Files:**
- Modify: `vocab-server/services/dailyListenPreGenerateService.js`

- [ ] **Step 1: `cleanupDailyListenStorage(db)`**

```javascript
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

function cleanupDailyListenStorage(db) {
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
  while (total > CAPACITY_BYTES) {
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
```

- [ ] **Step 2: 用临时大文件 + 低 CAPACITY 常量的测试分支验证 while 循环（可在 smoke 里临时传入 limit）**

为可测性，让 `cleanupDailyListenStorage(db, { capacityBytes = CAPACITY_BYTES })` 接受覆盖。

---

### Task 6: Cron — 02:00 先 pack 后 listen

**Files:**
- Modify: `vocab-server/services/dailyPackCron.js`
- Modify: `vocab-server/services/dailyListenPreGenerateService.js`（`runDailyListenCronJob`）

- [ ] **Step 1: `runDailyListenCronJob(db)`**

```javascript
async function runDailyListenCronJob(db) {
  const packDate = dailyPackService.getPackDate();
  const users = listEligibleUsers(db);
  const summary = { packDate, users: users.length, combosOk: 0, combosFail: 0, errors: [] };
  for (const u of users) {
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
```

- [ ] **Step 2: 改 `dailyPackCron.js`**

```javascript
const dailyListenPreGenerateService = require('./dailyListenPreGenerateService');

function scheduleDailyPackCron(db) {
  if (process.env.DAILY_PACK_CRON_ENABLED === 'false') {
    console.log('[DailyPack Cron] disabled via DAILY_PACK_CRON_ENABLED=false');
    return;
  }
  setInterval(() => {
    const { hour, minute } = dailyPackService.getShanghaiHourMinute();
    const packDate = dailyPackService.getPackDate();
    if (hour === 2 && minute === 0 && lastCronPackDate !== packDate) {
      lastCronPackDate = packDate;
      (async () => {
        await runDailyPackCronJob(db);
        if (process.env.DAILY_LISTEN_CRON_ENABLED !== 'false') {
          await dailyListenPreGenerateService.runDailyListenCronJob(db);
        }
      })().catch((e) => console.error('[DailyPack/Listen Cron] failed:', e));
    }
  }, 60 * 1000);
  console.log('[DailyPack Cron] scheduled for 02:00 then DailyListen', dailyPackService.PACK_TZ);
}
```

保留手动 `POST /api/daily-pack/cron-run`；新增可选 `POST /api/listen/pregenerated/cron-run`（同样可选 `x-cron-secret`）仅跑 listen cron，便于运维。

---

### Task 7: POST backfill → `listen_backfill` 任务

**Files:**
- Modify: `vocab-server/server.js`
- Modify: `vocab-server/services/dailyListenPreGenerateService.js`（可选 `only` 参数已有）

- [ ] **Step 1: 路由**

```javascript
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
      `听写预生成补跑: ${theme} / ${genre} / ${cefrLevel} / ${duration}m`,
    );
    res.json({ success: true, taskId: task.id, status: task.status });

    (async () => {
      try {
        taskQueue.updateTask(task.id, { status: 'running', progress: 5, logs: ['开始后台补生成...'] });
        const mode = only === 'audio' || only === 'article' ? only : 'both';
        const result = await dailyListenPreGenerateService.generateOneCombo(
          db,
          { userId, theme, genre, cefrLevel, duration },
          { source: 'backfill', only: mode },
        );
        taskQueue.updateTask(task.id, {
          status: 'completed',
          progress: 100,
          logs: ['补生成完成'],
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
```

- [ ] **Step 2: curl 验证立即返回 taskId，随后 `/api/tasks/:id` 终态**

---

### Task 8: 前端 API + Task 类型 + TaskCenter UI

**Files:**
- Create: `src/services/listenPregeneratedAPI.ts`
- Modify: `src/components/TaskContext.tsx`
- Modify: `src/components/GlobalTaskCenter.tsx`

- [ ] **Step 1: API 客户端**

```typescript
import { getAppUserId } from '../utils/profileHelper';

export type PregenStatus = 'ready' | 'partial' | 'missing' | 'failed' | 'generating' | 'uncached_duration';

export interface PregeneratedResponse {
  success: boolean;
  status: PregenStatus;
  canBackfill?: boolean;
  packDate?: string;
  articleStatus?: string;
  audioStatus?: string;
  article?: { body: string; vocab: unknown[]; phrases: unknown[]; fileUrl?: string | null } | null;
  audio?: { script: string; audioUrl: string } | null;
}

export async function fetchPregenerated(params: {
  theme: string;
  genre: string;
  cefrLevel: string;
  duration: number;
  date?: string;
  userId?: string;
}): Promise<PregeneratedResponse> {
  const userId = params.userId || getAppUserId();
  const q = new URLSearchParams({
    userId,
    theme: params.theme,
    genre: params.genre,
    cefrLevel: params.cefrLevel,
    duration: String(params.duration),
  });
  if (params.date) q.set('date', params.date);
  const res = await fetch(`/api/listen/pregenerated?${q}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function submitPregeneratedBackfill(body: {
  theme: string;
  genre: string;
  cefrLevel: string;
  duration: number;
  only?: 'both' | 'article' | 'audio';
  userId?: string;
}) {
  const res = await fetch('/api/listen/pregenerated/backfill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, userId: body.userId || getAppUserId() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as { success: boolean; taskId: string };
}
```

- [ ] **Step 2: `TaskItem.type` 增加 `'listen_backfill'`**

- [ ] **Step 3: `GlobalTaskCenter`**

- 图标：可用 `Headphones`（lucide，已在 ListenTab 使用）
- 完成态：若 `task.type === 'listen_backfill'`，显示「已完成」文案按钮「在听力页查看」→ `setIsOpen(false)` + `window.dispatchEvent(new CustomEvent('listen-pregenerated-ready', { detail: task.result }))`；**不要**走「导入并提纯」

---

### Task 9: ListenTab 缓存优先 + partial + backfill（redesign 约束）

**Files:**
- Modify: `src/components/modules/english/tabs/ListenTab.tsx`
- Cite: `DESIGN.md` Interaction states / Components

- [ ] **Step 1: 抽出 `loadFromPregenerateOrRealtime(targetTheme)`**

逻辑：

1. 若 `listenDuration` ∈ {5,15,25}：
   - `fetchPregenerated({ theme, genre: listenGenre, cefrLevel: listenCefr, duration: listenDuration })`
   - `ready` → `setListenMaterial(article.body)` + `setListenAudioUrl(audio.audioUrl)` + 结束 loading
   - `partial` 且 article ready → 展示正文；音频区显示紧凑条「音频尚未准备好」+ accent 按钮「后台生成音频」→ `submitPregeneratedBackfill({ only:'audio', ... })` + `addTask({ type:'listen_backfill', ... })` + notice「已提交后台生成，请稍后在任务中心查看。」
   - `missing`/`failed` → 紧凑 banner「今日该组合内容尚未准备好，可提交后台生成。」+「后台生成」→ backfill `only:'both'`；**不要**自动立刻跑实时生成（避免与 cron 意图冲突）。用户仍可用「重新生成」走实时。
   - `generating` → 保持 inline loading
   - `uncached_duration` 不应出现在 5/15/25
2. 若 duration 不在集合：保持现有 `generateListenMaterial` 实时路径。
3. 替换「进 listen tab 且 theme 变了就实时 generate」的 effect：改为调用 `loadFromPregenerateOrRealtime`。
4. genre/cefr/duration 变更时（仅 5/15/25）重新 `fetchPregenerated`（debounce 200ms）。

Banner 样式（redesign / DESIGN）：
- 单行/双行 compact，`border` + `bg-zinc-50` 或现有 Listen 面板内联，**禁止** indigo/purple stripe card
- 唯一 accent CTA：`bg-[#FF5722] text-white rounded-xl`

- [ ] **Step 2: 「重新生成」保留实时，并 writeback（A5）**

`generateListenMaterial` 成功拿到 script（同步或 task 完成）且 duration∈{5,15,25} 时：

```typescript
void fetch('/api/listen/pregenerated/writeback', { ... }) // 见 Task 10
```

或复用 backfill 内部路径的同步 write：优先实现专用 `POST /api/listen/pregenerated/writeback` 接收已有 script + 可选 audioUrl，避免重复 Dify。

- [ ] **Step 3: 监听 `listen-pregenerated-ready`**

若 detail 的 genre/cefr/duration 与当前筛选一致 → 再调 `fetchPregenerated` 刷新。

---

### Task 10: 手动 regen writeback API

**Files:**
- Modify: `vocab-server/server.js`
- Modify: `dailyListenPreGenerateService.js`（`writebackCombo`）

- [ ] **Step 1:**

```javascript
function writebackCombo(db, raw, { body, vocab, phrases, audioPath, audioUrl, script }) {
  const packDate = raw.date || dailyPackService.getPackDate();
  const parts = comboKeyParts({ ...raw, packDate, cefrLevel: raw.cefrLevel });
  if (!isCacheableDuration(parts.duration)) return { success: false, error: 'uncached_duration' };
  // write article file + upsert ready source=manual
  // if audioPath/audioUrl provided, upsert audio ready; else leave audio as-is
  return getPregeneratedCombo(db, { ...parts, date: packDate });
}

app.post('/api/listen/pregenerated/writeback', (req, res) => {
  // body: userId, theme, genre, cefrLevel, duration, body, vocab?, phrases?, audioUrl?, audioPath?
});
```

前端：实时生成完成后，若有音频 URL，一并 writeback；若 TTS 仍在任务中，材料先 writeback article-only，TTS 完成后再 writeback audio 字段。

---

### Task 11: Smoke 脚本 + 验收对照 T1–T8

**Files:**
- Create: `vocab-server/scripts/smoke-daily-listen.mjs`

- [ ] **Step 1: smoke 覆盖**

1. init tables  
2. login ping → eligible  
3. mock generateOneCombo → GET ready  
4. delete audio file → GET partial/missing + canBackfill  
5. cleanup retention（改 pack_date 为 8 天前）  
6. cleanup capacity（小 capacityBytes）

- [ ] **Step 2: 对照需求用例**

| 用例 | 验证方式 |
|------|----------|
| T1 | `listEligibleUsers` + cron 循环 36（可用 mock generators） |
| T2 | 无 login / 过期 login → 不在 eligible |
| T3 | GET meeting/B1/15 → ready |
| T4 | failed 行 → canBackfill + UI banner |
| T5 | POST backfill → task type listen_backfill |
| T6 | 删音频文件 → missing/partial |
| T7 | pack_date 旧 → cleanup 删除 |
| T8 | 总量超 1024MB 模拟 → 删最旧 |

Run: `node vocab-server/scripts/smoke-daily-listen.mjs`  
Expected: 全部 PASS。

---

## Self-Review

1. **Spec coverage:** 有效用户 C1、36 组、分表、GET/backfill、partial B4、5/15/25 A2、1024MB B3、regen writeback A5、cron after pack A6、listen_backfill A7、清理、ListenTab、T1–T8 — 均有对应 Task。  
2. **Placeholders:** 无 TBD；generators 注入点写明由 server 抽出 sync 函数。  
3. **Types:** `listen_backfill` / `PregenStatus` / `only: both|article|audio` 前后端一致。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-24-daily-listen-pregenerate.md`.

按你已选 **A8 / Subagent-Driven**：将逐任务派发 implementer → spec review → quality review（**不自动 commit**）。
