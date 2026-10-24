# 每日包预生成 + 顶栏解耦 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 UTC+8 02:00 按用户预生成「今日唤醒 + 破绽词」并缓存到服务端；前端进站只读当天包，解除 blocking Dify 对顶栏 Tab 的拖慢；保留手动重新生成。

**Architecture:** 新建 `user_theme_prefs` 与 `daily_packs` 表；`vocab-server` 新增 daily-pack API 与 cron；Dify wakeup workflow 调用移至服务端；前端 `DailyWakeupModule` / `DailyErrorVocabularyModule` 改读 API，主题在登录/换主题时同步。

**Tech Stack:** Node.js 20 + Express + better-sqlite3（vocab-server）；React + Vite（前端）；Dify workflow `english_wakeup_routine`

**Design spec:** `docs/superpowers/specs/2026-07-23-daily-pack-cron-design.md`

---

## File Structure

| 文件 | 职责 |
|------|------|
| `vocab-server/services/dailyPackService.js` | 日期工具、DB CRUD、Dify 调用、flaw fallback 补足 |
| `vocab-server/services/dailyPackCron.js` | 02:00 UTC+8 调度与批量生成 |
| `vocab-server/server.js` | 建表、挂载 4 个 API、启动 cron |
| `vocab-server/scripts/smoke-daily-pack.mjs` | 无 Dify 的 API/日期 smoke 测试 |
| `src/services/dailyPackAPI.ts` | 前端 daily-pack 客户端 |
| `src/components/modules/english/context/EnglishContext.tsx` | theme 同步到服务端 |
| `src/components/modules/DailyErrorVocabularyModule.tsx` | 读缓存 + regenerate |
| `src/components/modules/DailyWakeupModule.tsx` | 读缓存 + regenerate |

---

### Task 1: 服务端 dailyPackService 基础（日期 + 建表 + theme sync）

**Files:**
- Create: `vocab-server/services/dailyPackService.js`
- Modify: `vocab-server/server.js`（建表 + require service）

- [ ] **Step 1: 创建 `dailyPackService.js` 骨架**

```javascript
// vocab-server/services/dailyPackService.js
const crypto = require('crypto');

const PACK_TZ = process.env.DAILY_PACK_CRON_TZ || 'Asia/Shanghai';
const FLAW_SUB_THEMES = [
  'shifting the burden of proof and defensive responses',
  'ambiguous definitions and play on words',
  'false dilemmas and oversimplification',
];

function normalizeUserId(raw) {
  if (!raw) return 'default-user';
  const base = String(raw).split('@')[0].trim();
  return base || 'default-user';
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
      wakeup_json TEXT,
      flaw_vocab_json TEXT,
      source TEXT NOT NULL DEFAULT 'cron',
      status TEXT NOT NULL DEFAULT 'generating',
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, pack_date)
    )
  `).run();
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

function listUsersWithSyncedTheme(db) {
  return db.prepare(`
    SELECT user_id, theme FROM user_theme_prefs
    WHERE theme IS NOT NULL AND TRIM(theme) != ''
  `).all();
}

function getDailyPackRow(db, userId, packDate) {
  const uid = normalizeUserId(userId);
  return db.prepare(`
    SELECT * FROM daily_packs WHERE user_id = ? AND pack_date = ?
  `).get(uid, packDate);
}

module.exports = {
  PACK_TZ,
  FLAW_SUB_THEMES,
  normalizeUserId,
  getPackDate,
  getShanghaiHourMinute,
  initDailyPackTables,
  upsertUserTheme,
  listUsersWithSyncedTheme,
  getDailyPackRow,
};
```

- [ ] **Step 2: 在 `server.js` 建表区注册**

在 `user_memories` 建表之后、`function normalizeMemoryUserId` 之前插入：

```javascript
const dailyPackService = require('./services/dailyPackService');
dailyPackService.initDailyPackTables(db);
```

- [ ] **Step 3: 运行 smoke 日期函数（临时 inline 验证）**

Run:
```bash
cd vocab-server
node -e "const s=require('./services/dailyPackService'); console.log(s.getPackDate(), s.getShanghaiHourMinute());"
```
Expected: 输出 `YYYY-MM-DD` 与 `{ hour: N, minute: M }`

- [ ] **Step 4: Commit**

```bash
git add vocab-server/services/dailyPackService.js vocab-server/server.js
git commit -m "feat(server): add daily pack tables and date helpers"
```

---

### Task 2: Dify 调用 + flaw fallback + pack 写入

**Files:**
- Modify: `vocab-server/services/dailyPackService.js`
- Reference: `src/services/difyAPI.ts`（`getFallbackFlawVocab` 词表与 exclude 逻辑）

- [ ] **Step 1: 在 `dailyPackService.js` 追加 Dify 与 pack 写入**

在文件末尾、`module.exports` 之前追加（完整函数）：

```javascript
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
  const uid = normalizeUserId(userId);
  const rows = db.prepare(`
    SELECT word FROM vocabulary WHERE user_id = ? OR user_id IS NULL OR user_id = ''
  `).all(uid);
  return rows.map((r) => String(r.word || '').toLowerCase().trim()).filter(Boolean);
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

async function callWakeupWorkflow({ theme, userId, historyExclude = '' }) {
  const apiKey = process.env.DIFY_WAKEUP_API_KEY || process.env.VITE_DIFY_WAKEUP_API_KEY;
  if (!apiKey) throw new Error('DIFY_WAKEUP_API_KEY not configured');
  const baseUrl = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  const res = await fetch(`${baseUrl}/workflows/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: { theme, history_exclude: historyExclude },
      response_mode: 'blocking',
      user: normalizeUserId(userId),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `Dify HTTP ${res.status}`);
  const raw = data?.data?.outputs?.wakeup_json ?? data?.data?.outputs?.result ?? data?.answer ?? '';
  const clean = String(raw).replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
}

async function generateFlawVocabForUser(db, userId, themeOverride) {
  const dbWords = getUserVocabWords(db, userId);
  const apiExclude = dbWords.slice(-50).join(', ');
  const todayStr = getPackDate();
  const randomSalt = Math.floor(Math.random() * 10000);
  const randomFocus = FLAW_SUB_THEMES[Math.floor(Math.random() * FLAW_SUB_THEMES.length)];
  const dynamicTheme = themeOverride || `identifying logical flaws and business counterattack (Focus: ${randomFocus}, Date: ${todayStr}, Salt: ${randomSalt})`;
  try {
    const parsed = await callWakeupWorkflow({ theme: dynamicTheme, userId, historyExclude: apiExclude });
    return buildFlawDisplayWords(parsed.vocab || [], dbWords);
  } catch {
    return buildFlawDisplayWords([], dbWords);
  }
}

function upsertDailyPack(db, { userId, packDate, theme, wakeup, flawVocab, source, status, errorMessage }) {
  const uid = normalizeUserId(userId);
  const now = Date.now();
  const existing = getDailyPackRow(db, uid, packDate);
  const id = existing?.id || crypto.randomUUID();
  db.prepare(`
    INSERT INTO daily_packs (
      id, user_id, pack_date, theme, wakeup_json, flaw_vocab_json,
      source, status, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, pack_date) DO UPDATE SET
      theme = excluded.theme,
      wakeup_json = excluded.wakeup_json,
      flaw_vocab_json = excluded.flaw_vocab_json,
      source = excluded.source,
      status = excluded.status,
      error_message = excluded.error_message,
      updated_at = excluded.updated_at
  `).run(
    id,
    uid,
    packDate,
    theme,
    wakeup ? JSON.stringify(wakeup) : null,
    flawVocab ? JSON.stringify(flawVocab) : null,
    source,
    status,
    errorMessage || null,
    existing?.created_at || now,
    now,
  );
  return getDailyPackRow(db, uid, packDate);
}

async function generateDailyPackForUser(db, userId, theme, source = 'cron') {
  const packDate = getPackDate();
  const uid = normalizeUserId(userId);
  upsertDailyPack(db, {
    userId: uid,
    packDate,
    theme,
    wakeup: null,
    flawVocab: null,
    source,
    status: 'generating',
    errorMessage: null,
  });
  try {
    const wakeup = await callWakeupWorkflow({ theme, userId: uid });
    const flawVocab = await generateFlawVocabForUser(db, uid, null);
    return upsertDailyPack(db, {
      userId: uid,
      packDate,
      theme: wakeup.theme || theme,
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
      wakeup: null,
      flawVocab: null,
      source,
      status: 'failed',
      errorMessage: err.message || String(err),
    });
    throw err;
  }
}

function serializeDailyPack(row) {
  if (!row) return { success: true, status: 'missing' };
  return {
    success: true,
    packDate: row.pack_date,
    theme: row.theme,
    status: row.status,
    source: row.source,
    errorMessage: row.error_message || null,
    wakeup: row.wakeup_json ? JSON.parse(row.wakeup_json) : null,
    flawVocab: row.flaw_vocab_json ? JSON.parse(row.flaw_vocab_json) : null,
  };
}
```

更新 `module.exports`，追加：
`getFallbackFlawVocab`, `generateFlawVocabForUser`, `generateDailyPackForUser`, `serializeDailyPack`, `upsertDailyPack`, `callWakeupWorkflow`

- [ ] **Step 2: 本地验证 fallback（无需 Dify）**

Run:
```bash
cd vocab-server
node -e "const Database=require('better-sqlite3'); const os=require('os'); const path=require('path'); const db=new Database(':memory:'); const s=require('./services/dailyPackService'); s.initDailyPackTables(db); const words=s.buildFlawDisplayWords([],[]); console.log(words.length, words[0].word);"
```
Expected: `6 fallacy`（若 `buildFlawDisplayWords` 未 export，先在 Step 1 加入 exports）

- [ ] **Step 3: Commit**

```bash
git add vocab-server/services/dailyPackService.js
git commit -m "feat(server): add Dify wakeup generation and flaw vocab fallback"
```

---

### Task 3: REST API 路由

**Files:**
- Modify: `vocab-server/server.js`（在 `/api/daily-quota/status` 附近追加）

- [ ] **Step 1: 添加 4 个路由**

```javascript
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

app.get('/api/daily-pack/today', (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const packDate = dailyPackService.getPackDate();
    const row = dailyPackService.getDailyPackRow(db, userId, packDate);
    res.json(dailyPackService.serializeDailyPack(row));
  } catch (error) {
    console.error('[Daily Pack Today]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/daily-pack/regenerate', async (req, res) => {
  try {
    const { userId = 'default-user', type = 'both', theme } = req.body || {};
    const uid = dailyPackService.normalizeUserId(userId);
    const packDate = dailyPackService.getPackDate();
    const pref = db.prepare('SELECT theme FROM user_theme_prefs WHERE user_id = ?').get(uid);
    const resolvedTheme = String(theme || pref?.theme || '').trim();
    if (!resolvedTheme) {
      return res.status(400).json({ success: false, error: '请先选择并同步学习主题' });
    }
    if (type === 'flaw') {
      const flawVocab = await dailyPackService.generateFlawVocabForUser(db, uid, null);
      const existing = dailyPackService.getDailyPackRow(db, uid, packDate);
      const row = dailyPackService.upsertDailyPack(db, {
        userId: uid,
        packDate,
        theme: existing?.theme || resolvedTheme,
        wakeup: existing?.wakeup_json ? JSON.parse(existing.wakeup_json) : null,
        flawVocab,
        source: 'manual',
        status: 'ready',
        errorMessage: null,
      });
      return res.json(dailyPackService.serializeDailyPack(row));
    }
    const row = await dailyPackService.generateDailyPackForUser(db, uid, resolvedTheme, 'manual');
    res.json(dailyPackService.serializeDailyPack(row));
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
```

注意：Task 4 会创建 `dailyPackCron.js`；此处先 `const dailyPackCron = require('./services/dailyPackCron');` 或在 Task 4 完成后一并提交。

- [ ] **Step 2: 手动 curl 验证 theme + today**

Run（需 server 已启动）:
```bash
curl -s -X PUT http://127.0.0.1:3001/api/user/theme -H "Content-Type: application/json" -d "{\"userId\":\"test-user\",\"theme\":\"商务谈判：让步与施压\"}"
curl -s "http://127.0.0.1:3001/api/daily-pack/today?userId=test-user"
```
Expected: 第一条 `success:true`；第二条 `status:"missing"`

- [ ] **Step 3: Commit**

```bash
git add vocab-server/server.js
git commit -m "feat(server): add daily-pack and user theme REST APIs"
```

---

### Task 4: Cron 调度器

**Files:**
- Create: `vocab-server/services/dailyPackCron.js`
- Modify: `vocab-server/server.js`（`app.listen` 内注册）

- [ ] **Step 1: 创建 `dailyPackCron.js`**

```javascript
// vocab-server/services/dailyPackCron.js
const dailyPackService = require('./dailyPackService');

let lastCronPackDate = null;

async function runDailyPackCronJob(db) {
  const packDate = dailyPackService.getPackDate();
  const users = dailyPackService.listUsersWithSyncedTheme(db);
  const summary = { packDate, total: users.length, ok: 0, skipped: 0, failed: 0, errors: [] };

  for (const row of users) {
    const existing = dailyPackService.getDailyPackRow(db, row.user_id, packDate);
    if (existing?.status === 'ready' && existing?.source === 'cron') {
      summary.skipped += 1;
      continue;
    }
    try {
      await dailyPackService.generateDailyPackForUser(db, row.user_id, row.theme, 'cron');
      summary.ok += 1;
    } catch (err) {
      summary.failed += 1;
      summary.errors.push({ userId: row.user_id, error: err.message || String(err) });
      console.error('[DailyPack Cron] user=%s fail: %s', row.user_id, err.message);
    }
  }
  console.log('[DailyPack Cron] done', summary);
  return summary;
}

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
      runDailyPackCronJob(db).catch((e) => console.error('[DailyPack Cron] failed:', e));
    }
  }, 60 * 1000);
  console.log('[DailyPack Cron] scheduled for 02:00', dailyPackService.PACK_TZ);
}

module.exports = { runDailyPackCronJob, scheduleDailyPackCron };
```

- [ ] **Step 2: 在 `app.listen` 回调注册**

```javascript
const dailyPackCron = require('./services/dailyPackCron');
// inside app.listen callback, after Memory Dreaming block:
dailyPackCron.scheduleDailyPackCron(db);
```

- [ ] **Step 3: 手动触发 cron（需 DIFY_WAKEUP_API_KEY）**

Run:
```bash
curl -s -X POST http://127.0.0.1:3001/api/daily-pack/cron-run -H "Content-Type: application/json"
```
Expected: `{ success:true, packDate:"...", ok:N, ... }`

- [ ] **Step 4: Commit**

```bash
git add vocab-server/services/dailyPackCron.js vocab-server/server.js
git commit -m "feat(server): schedule daily pack cron at 02:00 Asia/Shanghai"
```

---

### Task 5: 前端 dailyPackAPI + 主题同步

**Files:**
- Create: `src/services/dailyPackAPI.ts`
- Modify: `src/components/modules/english/context/EnglishContext.tsx`

- [ ] **Step 1: 创建 `dailyPackAPI.ts`**

```typescript
import { getAppUserId } from '../utils/profileHelper';

export interface WakeupWord {
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
}

export interface WakeupPayload {
  theme: string;
  vocab: WakeupWord[];
  grammar: {
    point: string;
    explanation: string;
    examples: Array<{ correct: string; incorrect: string }>;
  };
}

export interface FlawVocabWord extends WakeupWord {}

export interface DailyPackResponse {
  success: boolean;
  status: 'missing' | 'ready' | 'failed' | 'generating';
  packDate?: string;
  theme?: string;
  source?: string;
  errorMessage?: string | null;
  wakeup?: WakeupPayload | null;
  flawVocab?: FlawVocabWord[] | null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data as T;
}

export async function syncUserTheme(theme: string, userId = getAppUserId()) {
  return request<{ success: boolean; userId: string; theme: string }>('/api/user/theme', {
    method: 'PUT',
    body: JSON.stringify({ userId, theme }),
  });
}

export async function getTodayDailyPack(userId = getAppUserId()) {
  return request<DailyPackResponse>(`/api/daily-pack/today?userId=${encodeURIComponent(userId)}`);
}

export async function regenerateDailyPack(
  type: 'wakeup' | 'flaw' | 'both' = 'both',
  theme?: string,
  userId = getAppUserId(),
) {
  return request<DailyPackResponse>('/api/daily-pack/regenerate', {
    method: 'POST',
    body: JSON.stringify({ userId, type, theme }),
  });
}
```

- [ ] **Step 2: 在 `EnglishContext.tsx` 同步 theme**

在现有 `useEffect` 写 `localStorage.setItem('english_theme', theme)` 之后追加：

```typescript
import { syncUserTheme } from '../../../services/dailyPackAPI';

// debounce ref near other refs
const themeSyncTimerRef = useRef<number | null>(null);

useEffect(() => {
  localStorage.setItem('english_theme', theme);
  if (themeSyncTimerRef.current) window.clearTimeout(themeSyncTimerRef.current);
  themeSyncTimerRef.current = window.setTimeout(() => {
    void syncUserTheme(theme).catch((err) => {
      console.warn('[EnglishContext] theme sync failed:', err);
    });
  }, 300);
  return () => {
    if (themeSyncTimerRef.current) window.clearTimeout(themeSyncTimerRef.current);
  };
}, [theme]);
```

- [ ] **Step 3: 验证 Network**

启动前后端 → 换主题 → DevTools 应见 `PUT /api/user/theme` 200

- [ ] **Step 4: Commit**

```bash
git add src/services/dailyPackAPI.ts src/components/modules/english/context/EnglishContext.tsx
git commit -m "feat(frontend): sync theme and add daily pack API client"
```

---

### Task 6: 重构 DailyErrorVocabularyModule（解耦 blocking Dify）

**Files:**
- Modify: `src/components/modules/DailyErrorVocabularyModule.tsx`

- [ ] **Step 1: 替换 mount 逻辑**

删除：
```typescript
import { generateDailyFlawVocabulary, getFallbackFlawVocab } from '../../services/difyAPI';
```

改为：
```typescript
import { getTodayDailyPack, regenerateDailyPack } from '../../services/dailyPackAPI';
```

重写 `fetchFlawVocab`：

```typescript
const fetchFlawVocab = async (regenerate = false) => {
  setIsLoading(true);
  setError(null);
  try {
    const pack = regenerate
      ? await regenerateDailyPack('flaw')
      : await getTodayDailyPack();

    if (pack.status === 'ready' && Array.isArray(pack.flawVocab) && pack.flawVocab.length > 0) {
      setWords(pack.flawVocab.slice(0, 6));
      return;
    }

    if (pack.status === 'missing' || pack.status === 'failed') {
      setWords([]);
      setError(pack.status === 'failed'
        ? (pack.errorMessage || '今日破绽词生成失败，请点击刷新重试')
        : '今日内容准备中，可点击刷新立即生成');
      return;
    }

    setWords([]);
    setError('今日内容准备中…');
  } catch (e: any) {
    setError(e.message || '获取每日破绽词汇失败，请重试');
  } finally {
    setIsLoading(false);
  }
};

useEffect(() => {
  void fetchFlawVocab(false);
}, []);
```

刷新按钮 handler 改为 `void fetchFlawVocab(true)`。

副标题文案改为：`今日预生成 · 可刷新`

- [ ] **Step 2: 验证 — 进站无 `/dify/workflows/run`**

DevTools Network：进入英语引擎时不应出现前端直连 Dify wakeup 请求。

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/DailyErrorVocabularyModule.tsx
git commit -m "fix(frontend): load flaw vocab from daily pack cache, not blocking Dify"
```

---

### Task 7: 重构 DailyWakeupModule（读缓存 + regenerate）

**Files:**
- Modify: `src/components/modules/DailyWakeupModule.tsx`

- [ ] **Step 1: 进站读当天 wakeup**

删除 `import { runEnglishWakeupRoutine } from '../../services/difyAPI';`

添加：
```typescript
import { getTodayDailyPack, regenerateDailyPack, WakeupPayload } from '../../services/dailyPackAPI';
```

添加 mount effect：

```typescript
useEffect(() => {
  let cancelled = false;
  void (async () => {
    try {
      const pack = await getTodayDailyPack();
      if (cancelled) return;
      if (pack.status === 'ready' && pack.wakeup) {
        setResult(pack.wakeup as WakeupPayload);
        setNotice(`已加载今日唤醒：${pack.wakeup.theme || theme}`);
      }
    } catch {
      /* 非阻塞 */
    }
  })();
  return () => { cancelled = true; };
}, []);
```

重写 `handleStart`：

```typescript
const handleStart = async () => {
  setLoading(true);
  setNotice(result ? '正在重新生成今日唤醒…' : '正在生成今日唤醒内容…');
  try {
    void refreshStayStats(true);
    void refreshTodaySession();
    const pack = await regenerateDailyPack('both', theme);
    if (pack.status !== 'ready' || !pack.wakeup) {
      throw new Error(pack.errorMessage || '生成失败');
    }
    setResult(pack.wakeup as WakeupPayload);
    setNotice(`已生成主题：${pack.wakeup.theme || theme}`);
    startTimer();
  } catch (error) {
    setNotice(error instanceof Error ? error.message : '生成失败');
  } finally {
    setLoading(false);
  }
};
```

按钮文案：有 `result` 时显示「重新开始今日唤醒」，否则「开始今日唤醒」。

- [ ] **Step 2: Commit**

```bash
git add src/components/modules/DailyWakeupModule.tsx
git commit -m "feat(frontend): load wakeup from daily pack with manual regenerate"
```

---

### Task 8: Smoke 测试脚本 + 端到端验证

**Files:**
- Create: `vocab-server/scripts/smoke-daily-pack.mjs`

- [ ] **Step 1: 创建 smoke 脚本**

```javascript
#!/usr/bin/env node
const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001';
const USER = `smoke-${Date.now()}`;

async function main() {
  const put = await fetch(`${BASE}/api/user/theme`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: USER, theme: 'smoke-test-theme' }),
  });
  const putJson = await put.json();
  if (!put.ok || !putJson.success) throw new Error('theme sync failed');

  const get = await fetch(`${BASE}/api/daily-pack/today?userId=${encodeURIComponent(USER)}`);
  const getJson = await get.json();
  if (!get.ok || getJson.status !== 'missing') throw new Error(`expected missing, got ${getJson.status}`);

  console.log('smoke-daily-pack: PASS');
}

main().catch((e) => {
  console.error('smoke-daily-pack: FAIL', e.message);
  process.exit(1);
});
```

- [ ] **Step 2: 运行 smoke**

Run:
```bash
node vocab-server/scripts/smoke-daily-pack.mjs
```
Expected: `smoke-daily-pack: PASS`

- [ ] **Step 3: 手动 E2E（对应设计文档 T1–T4）**

| 用例 | 菜单路径 | 测试数据 | 预期 |
|------|----------|----------|------|
| T1 顶栏解耦 | 登录 → 英语引擎 → 立刻点「洞察(听)」 | 有/无当天包均可 | 数秒内出内容，非分钟级 skeleton |
| T2 无缓存 | 新用户未 cron | GET today=missing | 破绽区提示「准备中」，顶栏仍可切换 |
| T3 主题同步 | 英语引擎换主题 | 任意主题 | Network: PUT /api/user/theme 200 |
| T4 手动重生 | 破绽区点「刷新词汇」 | — | POST regenerate flaw，UI 更新 6 词 |
| T5 唤醒 | 点「开始今日唤醒」 | 已同步主题 | 展示 vocab+grammar，可打卡 |

- [ ] **Step 4: Commit**

```bash
git add vocab-server/scripts/smoke-daily-pack.mjs
git commit -m "test: add daily pack API smoke script"
```

---

### Task 9: 部署环境变量（生产）

**Files:**
- Modify: 服务器 `.env` 或 systemd unit（文档说明，不提交 secret）

- [ ] **Step 1: 在 vocab-server 环境追加**

```bash
DIFY_WAKEUP_API_KEY=<与现网 wakeup workflow 相同>
DAILY_PACK_CRON_ENABLED=true
DAILY_PACK_CRON_TZ=Asia/Shanghai
# 可选：手动触发 cron 保护
DAILY_PACK_CRON_SECRET=<random>
```

- [ ] **Step 2: 重启并验证**

```bash
sudo systemctl restart super-agent-vocab
curl -s http://127.0.0.1:3001/api/vocab/health
curl -s -X PUT http://127.0.0.1/api/user/theme -H "Content-Type: application/json" -d '{"userId":"default-user","theme":"商务谈判：让步与施压"}'
```

Expected: health OK；theme sync 经 nginx 反代成功

---

## Self-Review

| Spec 要求 | 对应 Task |
|-----------|-----------|
| user_theme_prefs + daily_packs | Task 1 |
| PUT/GET/POST API | Task 3 |
| 02:00 cron UTC+8 | Task 4 |
| 按用户个性化 + exclude | Task 2 |
| 仅已同步主题用户 | Task 4 cron 筛选 |
| 前端读缓存不 blocking Dify | Task 6, 7 |
| 保留重新生成 | Task 6, 7 |
| 顶栏解耦 | Task 6（移除 mount Dify） |
| Dify Key 服务端 | Task 2 |
| 测试 | Task 8 |

**Placeholder scan:** 无 TBD/TODO  
**Type consistency:** `DailyPackResponse.status`、`regenerateDailyPack(type)` 前后一致

---

## 执行选项

Plan 已保存至 `docs/superpowers/plans/2026-07-23-daily-pack-cron.md`。

**1. Subagent-Driven（推荐）** — 每个 Task 派独立 subagent，任务间 review，迭代快  

**2. Inline Execution** — 本会话按 Task 顺序直接实现，checkpoint 处请您确认  

请回复 **1** 或 **2**，我即开始执行。
