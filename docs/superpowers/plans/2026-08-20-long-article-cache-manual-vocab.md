# 长文缓存命中 + 3 秒转后台 + 提取不自动进生词本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前台查询按用户+主题等条件命中 `daily_extracted_articles`（含长文与词/短语/句式）；未命中生成时超过 3 秒关遮罩转入【任务中心】；提取结果不写生词本；手动与 cron 共用同一套逻辑。

**Architecture:** 在现有 `daily_extracted_articles` 上修正 UNIQUE（含 theme/duration）并加索引；`runDailyExtractAsync` 只写缓存、去掉 vocabulary 批量 INSERT 与生成路径配额拦截；daily-extract 创建时同步 `taskQueue`；前端用 3 秒竞速释放 UI，超时 `addTask`；cron 的 skip 判断对齐含 theme 的维度。

**Tech Stack:** React + TypeScript、Node.js + Express、better-sqlite3、InMemoryTaskQueue（`taskQueue`）、Node `assert` 契约/单测。

**Spec:** `docs/superpowers/specs/2026-08-20-long-article-cache-manual-vocab-design.md`

**Commit 约定：** 本仓库用户规则要求「仅在用户明确要求时 commit」。下列 Commit 步骤默认跳过，除非用户当轮明确说「提交/commit」。

---

## File Structure

| 文件 | 职责 |
|------|------|
| `vocab-server/services/dailyListenPreGenerateService.js` | `daily_extracted_articles` 表重建 UNIQUE + 索引 |
| `vocab-server/services/dailyPackService.js` | cron skip 判断含 `theme` |
| `vocab-server/server.js` | 去掉自动入库与生成配额拦截；daily-extract ↔ taskQueue |
| `src/services/difyAPI.ts` | `DAILY_EXTRACT_RACE_MS`、竞速轮询 API |
| `src/components/modules/english/tabs/DashboardTab.tsx` | 3 秒关遮罩、任务中心、文案 |
| `vocab-server/tests/dailyExtractedArticlesSchema.test.js` | UNIQUE/索引契约 |
| `vocab-server/tests/dailyExtractNoAutoVocab.test.js` | 不写生词本 + 无生成配额拦截契约 |
| `vocab-server/tests/dailyExtractTaskQueueContract.test.js` | taskQueue 挂钩契约 |
| `vocab-server/tests/dailyExtractFrontendRaceContract.test.js` | 前端 3 秒竞速契约 |

---

### Task 1: `daily_extracted_articles` UNIQUE（含 theme/duration）+ 索引

**Files:**
- Create: `vocab-server/tests/dailyExtractedArticlesSchema.test.js`
- Modify: `vocab-server/services/dailyListenPreGenerateService.js`（`initDailyListenTables` / 新增 `ensureDailyExtractedArticlesSchema`）

- [ ] **Step 1: 写失败测试**

```js
const assert = require('assert');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { initDailyListenTables } = require('../services/dailyListenPreGenerateService');

function openTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dea-schema-'));
  const dbPath = path.join(dir, 't.db');
  const db = new Database(dbPath);
  return { db, dir };
}

function testNewUniqueIncludesThemeDuration() {
  const { db, dir } = openTempDb();
  try {
    initDailyListenTables(db);
    const sql = String(
      db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_extracted_articles'`).get()?.sql || ''
    );
    assert.match(
      sql,
      /UNIQUE\s*\(\s*user_id\s*,\s*quota_date\s*,\s*theme\s*,\s*genre\s*,\s*cefr_level\s*,\s*duration\s*\)/i,
      'UNIQUE 必须含 theme 与 duration'
    );
    const indexes = db.prepare(`SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='daily_extracted_articles'`).all();
    const names = indexes.map((r) => r.name);
    assert.ok(names.includes('idx_dea_user_date_dims'), '缺少维度索引');
    assert.ok(names.includes('idx_dea_user_date_sig'), '缺少 signature 索引');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testMigrationDedupesKeepLatest() {
  const { db, dir } = openTempDb();
  try {
    // 模拟旧表：UNIQUE 不含 theme
    db.exec(`
      CREATE TABLE daily_extracted_articles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quota_date TEXT NOT NULL,
        theme TEXT NOT NULL,
        genre TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        article TEXT NOT NULL,
        words_json TEXT NOT NULL,
        phrases_json TEXT NOT NULL,
        sentences_json TEXT NOT NULL,
        duration TEXT DEFAULT '25',
        input_signature TEXT DEFAULT '',
        created_at INTEGER,
        updated_at INTEGER,
        UNIQUE(user_id, quota_date, genre, cefr_level)
      );
    `);
    const ins = db.prepare(`
      INSERT INTO daily_extracted_articles
      (id,user_id,quota_date,theme,genre,cefr_level,article,words_json,phrases_json,sentences_json,duration,input_signature,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    ins.run('old1', 'u1', '2026-08-20', 'ThemeA', 'reading', 'B1', 'a1', '[]', '[]', '[]', '35', 'sigA', 1, 100);
    // 无法在旧 UNIQUE 下插入同 genre/cefr 不同 theme；用手工破坏再迁移：先删 UNIQUE 场景用两行同 dims 不同 updated_at
    db.exec('DROP TABLE daily_extracted_articles');
    db.exec(`
      CREATE TABLE daily_extracted_articles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quota_date TEXT NOT NULL,
        theme TEXT NOT NULL,
        genre TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        article TEXT NOT NULL,
        words_json TEXT NOT NULL,
        phrases_json TEXT NOT NULL,
        sentences_json TEXT NOT NULL,
        duration TEXT DEFAULT '25',
        input_signature TEXT DEFAULT '',
        created_at INTEGER,
        updated_at INTEGER
      );
    `);
    ins.run('dup1', 'u1', '2026-08-20', 'ThemeA', 'reading', 'B1', 'old', '[]', '[]', '[]', '35', 'sig', 1, 100);
    ins.run('dup2', 'u1', '2026-08-20', 'ThemeA', 'reading', 'B1', 'new', '[]', '[]', '[]', '35', 'sig', 2, 200);

    initDailyListenTables(db);
    const rows = db.prepare(`
      SELECT id, article FROM daily_extracted_articles
      WHERE user_id='u1' AND quota_date='2026-08-20' AND theme='ThemeA' AND genre='reading' AND cefr_level='B1' AND duration='35'
    `).all();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].article, 'new');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

testNewUniqueIncludesThemeDuration();
testMigrationDedupesKeepLatest();
console.log('✅ dailyExtractedArticlesSchema.test.js 通过');
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd vocab-server && node tests/dailyExtractedArticlesSchema.test.js
```

Expected: FAIL（旧 UNIQUE 不含 theme，或缺索引）

- [ ] **Step 3: 实现 schema 保障**

在 `dailyListenPreGenerateService.js` 增加并在 `initDailyListenTables` 末尾调用：

```js
function ensureDailyExtractedArticlesSchema(db) {
  const tableSql = String(
    db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_extracted_articles'`).get()?.sql || ''
  );
  const needsRebuild =
    !tableSql ||
    !/UNIQUE\s*\(\s*user_id\s*,\s*quota_date\s*,\s*theme\s*,\s*genre\s*,\s*cefr_level\s*,\s*duration\s*\)/i.test(tableSql);

  if (needsRebuild && tableSql) {
    db.exec(`
      CREATE TABLE daily_extracted_articles_v2 (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quota_date TEXT NOT NULL,
        theme TEXT NOT NULL,
        genre TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        article TEXT NOT NULL,
        words_json TEXT NOT NULL,
        phrases_json TEXT NOT NULL,
        sentences_json TEXT NOT NULL,
        duration TEXT DEFAULT '25',
        input_signature TEXT DEFAULT '',
        created_at INTEGER,
        updated_at INTEGER,
        UNIQUE(user_id, quota_date, theme, genre, cefr_level, duration)
      );

      INSERT INTO daily_extracted_articles_v2
        (id,user_id,quota_date,theme,genre,cefr_level,article,words_json,phrases_json,sentences_json,duration,input_signature,created_at,updated_at)
      SELECT id,user_id,quota_date,theme,genre,cefr_level,article,words_json,phrases_json,sentences_json,
             COALESCE(duration,'25'), COALESCE(input_signature,''), created_at, updated_at
      FROM daily_extracted_articles
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY user_id, quota_date, theme, genre, cefr_level, COALESCE(duration,'25')
                   ORDER BY COALESCE(updated_at,0) DESC, COALESCE(created_at,0) DESC
                 ) AS rn
          FROM daily_extracted_articles
        ) WHERE rn = 1
      );

      DROP TABLE daily_extracted_articles;
      ALTER TABLE daily_extracted_articles_v2 RENAME TO daily_extracted_articles;
    `);
  } else if (!tableSql) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS daily_extracted_articles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quota_date TEXT NOT NULL,
        theme TEXT NOT NULL,
        genre TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        article TEXT NOT NULL,
        words_json TEXT NOT NULL,
        phrases_json TEXT NOT NULL,
        sentences_json TEXT NOT NULL,
        duration TEXT DEFAULT '25',
        input_signature TEXT DEFAULT '',
        created_at INTEGER,
        updated_at INTEGER,
        UNIQUE(user_id, quota_date, theme, genre, cefr_level, duration)
      )
    `).run();
  }

  // 同步修正 CREATE TABLE IF NOT EXISTS 初始 DDL（init 顶部那份）为含 theme/duration 的 UNIQUE

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dea_user_date_dims
      ON daily_extracted_articles(user_id, quota_date, theme, genre, cefr_level, duration);
    CREATE INDEX IF NOT EXISTS idx_dea_user_date_sig
      ON daily_extracted_articles(user_id, quota_date, input_signature);
  `);
}
```

注意：若运行时 SQLite 无窗口函数，改用「按维度 GROUP / 取 max(updated_at) 再 join」去重，勿留半成品。

同步把 `initDailyListenTables` 里现有 `CREATE TABLE IF NOT EXISTS daily_extracted_articles` 的 UNIQUE 改成含 `theme, duration`。

- [ ] **Step 4: 跑测试确认通过**

```bash
cd vocab-server && node tests/dailyExtractedArticlesSchema.test.js
```

Expected: `✅ dailyExtractedArticlesSchema.test.js 通过`

- [ ] **Step 5: Commit**（仅当用户要求时）

```bash
git add vocab-server/services/dailyListenPreGenerateService.js vocab-server/tests/dailyExtractedArticlesSchema.test.js
git commit -m "$(cat <<'EOF'
fix: align daily_extracted_articles unique key with theme and add lookup indexes

EOF
)"
```

---

### Task 2: cron skip 判断对齐 theme

**Files:**
- Modify: `vocab-server/services/dailyPackService.js`（`generateLongArticleForUser` 内 existing 查询）
- Create: `vocab-server/tests/dailyPackLongArticleSkipThemeContract.test.js`

- [ ] **Step 1: 写失败契约测试**

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'dailyPackService.js'), 'utf8');
const fn = src.slice(src.indexOf('async function generateLongArticleForUser'), src.indexOf('module.exports'));
assert.match(fn, /theme/, 'skip 查询必须包含 theme');
assert.match(
  fn,
  /SELECT id FROM daily_extracted_articles WHERE user_id = \? AND quota_date = \? AND theme = \? AND genre = \? AND cefr_level = \? AND duration = \?/,
  'skip 维度必须是 user+date+theme+genre+cefr+duration'
);
console.log('✅ dailyPackLongArticleSkipThemeContract.test.js 通过');
```

- [ ] **Step 2: 跑测确认失败**

```bash
cd vocab-server && node tests/dailyPackLongArticleSkipThemeContract.test.js
```

- [ ] **Step 3: 改 skip 查询**

```js
existing = db.prepare(
  'SELECT id FROM daily_extracted_articles WHERE user_id = ? AND quota_date = ? AND theme = ? AND genre = ? AND cefr_level = ? AND duration = ?'
).get(uid, packDate, theme, genre, cefrLevel, String(duration));
```

删除仅按 genre/cefr 的旧 fallback（或保留仅作日志，但不得再作为 skip 依据）。

- [ ] **Step 4: 跑测通过**

```bash
cd vocab-server && node tests/dailyPackLongArticleSkipThemeContract.test.js
```

- [ ] **Step 5: Commit**（仅当用户要求时）

---

### Task 3: 去掉自动写生词本 + 去掉生成路径配额拦截

**Files:**
- Modify: `vocab-server/server.js`（`POST /api/english/daily-extract` 配额拦截块；`runDailyExtractAsync` 入库块）
- Create: `vocab-server/tests/dailyExtractNoAutoVocab.test.js`
- Modify（若断言冲突）: `vocab-server/tests/vocabMatrixCollectContract.test.js`（仅确认前端仍无自动入库；不必改）

- [ ] **Step 1: 写失败契约测试**

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

const runAsyncStart = server.indexOf('async function runDailyExtractAsync');
const runAsyncEnd = server.indexOf('\napp.', runAsyncStart); // 粗切；若不准则切到下一明显边界
const runAsync = server.slice(runAsyncStart, runAsyncStart + 80000);

assert.ok(
  !/INSERT INTO vocabulary[\s\S]{0,200}?ai_extracted/.test(runAsync) ||
    !/source: 'Daily Extract'/.test(runAsync),
  'runDailyExtractAsync 不得再以 Daily Extract 写入 vocabulary'
);
// 更硬：在 runDailyExtractAsync 函数体内禁止出现对 vocabulary 的 INSERT
const insertVocabInFn = (runAsync.match(/INSERT INTO vocabulary/g) || []).length;
assert.strictEqual(insertVocabInFn, 0, 'runDailyExtractAsync 内不得 INSERT vocabulary');

const postExtract = server.slice(
  server.indexOf("app.post('/api/english/daily-extract'"),
  server.indexOf('async function runDailyExtractAsync')
);
assert.ok(
  !/wordsLeft <= 0 && phrasesLeft <= 0/.test(postExtract) ||
    /\/\/ SPEC: quota gate removed for generate/.test(postExtract),
  '生成入口不得因入库配额耗尽直接拒绝长文生成'
);

assert.match(runAsync, /wordsAddedCount\s*=\s*0/, '自动路径 wordsAddedCount 应为 0');
assert.match(runAsync, /phrasesAddedCount\s*=\s*0/, '自动路径 phrasesAddedCount 应为 0');
assert.match(runAsync, /sentencesAddedCount\s*=\s*0/, '自动路径 sentencesAddedCount 应为 0');

console.log('✅ dailyExtractNoAutoVocab.test.js 通过');
```

（实现时按真实函数边界微调切片；断言语义不变。）

- [ ] **Step 2: 跑测确认失败**

```bash
cd vocab-server && node tests/dailyExtractNoAutoVocab.test.js
```

- [ ] **Step 3: 最小实现**

1. 删除或注释 `POST /api/english/daily-extract` 中「`wordsLeft <= 0 && phrasesLeft <= 0` → `quotaExceeded`」提前返回（可保留配额读取仅用于响应展示）。
2. 在 `runDailyExtractAsync` 中：
   - 删除 `insertWord` / `insertPhrase` / `insertSentence` 整段及对 `daily_vocab_quota` 的 `words_added/phrases_added` 累加更新；
   - 保留 `displayWords` / `displayPhrases` / `displaySentences` 与写入 `daily_extracted_articles`；
   - `finalPayload` 中：

```js
wordsAddedCount: 0,
phrasesAddedCount: 0,
sentencesAddedCount: 0,
```

3. `message` 改为类似：`Extraction complete: cached for display (no vocab book auto-insert).`

- [ ] **Step 4: 跑测通过**

```bash
cd vocab-server && node tests/dailyExtractNoAutoVocab.test.js
cd vocab-server && node tests/vocabMatrixCollectContract.test.js
```

Expected: 两测均通过。

- [ ] **Step 5: Commit**（仅当用户要求时）

---

### Task 4: daily-extract 挂接 taskQueue（任务中心可见）

**Files:**
- Modify: `vocab-server/server.js`（创建 task、更新进度/完成/失败；返回 `taskId` 使用 **taskQueue id** 或双写映射）
- Create: `vocab-server/tests/dailyExtractTaskQueueContract.test.js`

**约定（锁定）：**

- `taskQueue.createTask('daily_extract', name)` 的 `task.id` 作为对外 `taskId`。
- 同时 `extractionTasks.set(taskId, …)` 保持 status 轮询兼容，**同一 id**。
- 完成/失败时：`taskQueue.updateTask` + `extractionTasks` 同步。

- [ ] **Step 1: 写失败契约测试**

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const post = server.slice(
  server.indexOf("app.post('/api/english/daily-extract'"),
  server.indexOf('async function runDailyExtractAsync')
);
assert.match(post, /taskQueue\.createTask\(\s*['"]daily_extract['"]/, '创建时必须登记 taskQueue');
assert.match(post, /res\.json\(\{[\s\S]*taskId/, '必须返回 taskId');

const runAsync = server.slice(
  server.indexOf('async function runDailyExtractAsync'),
  server.indexOf('async function runDailyExtractAsync') + 90000
);
assert.match(runAsync, /taskQueue\.updateTask/, 'worker 必须更新 taskQueue');
assert.match(runAsync, /status:\s*['"]completed['"]/, '完成态必须回写');
assert.match(runAsync, /status:\s*['"]failed['"]/, '失败态必须回写');
console.log('✅ dailyExtractTaskQueueContract.test.js 通过');
```

- [ ] **Step 2: 跑测失败**

```bash
cd vocab-server && node tests/dailyExtractTaskQueueContract.test.js
```

- [ ] **Step 3: 实现挂钩**

创建处（配额/空输入检查之后）：

```js
const taskQueue = require('./services/taskQueue');
const topicLabel = String(topic || materialText || '长文').slice(0, 40);
const tq = taskQueue.createTask(
  'daily_extract',
  `长文生成与提纯: ${topicLabel} (${genre}/${cefrLevel}/${duration}m)`
);
const taskId = tq.id;
extractionTasks.set(taskId, { status: 'pending', createdAt: Date.now() });
taskQueue.updateTask(taskId, {
  status: 'running',
  progress: 5,
  logs: ['已受理，正在生成长文并提纯词表（仅写展示缓存，不写入生词本）…'],
});
res.json({ success: true, taskId, message: 'Extraction task started asynchronously.' });
```

在 `runDailyExtractAsync` 关键进度点（开始 / 落库前 / 完成 / catch）调用 `taskQueue.updateTask`；完成时 `progress: 100, status: 'completed'`，并把原 `finalPayload` 挂到 `extractionTasks` 供 status API。

**注意：** 删除原先 `crypto.randomUUID()` 作为 taskId 的路径，避免前端任务中心 id 对不上。

- [ ] **Step 4: 跑测通过**

```bash
cd vocab-server && node tests/dailyExtractTaskQueueContract.test.js
```

- [ ] **Step 5: Commit**（仅当用户要求时）

---

### Task 5: 前端 3 秒竞速 API

**Files:**
- Modify: `src/services/difyAPI.ts`
- Create: `vocab-server/tests/dailyExtractFrontendRaceContract.test.js`（读前端源做契约）

- [ ] **Step 1: 写失败契约测试**

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dify = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'services', 'difyAPI.ts'), 'utf8');
assert.match(dify, /export const DAILY_EXTRACT_RACE_MS = 3000/);
assert.match(dify, /withDailyExtractTimeout/);
assert.match(dify, /triggerEnglishMasteryExtraction/);
assert.ok(!/while \(true\) \{\s*await new Promise\(resolve => setTimeout\(resolve, 3000\)\)/.test(dify.replace(/\s+/g, ' ')),
  '不得再无限 while+每3秒轮询阻塞调用方');
console.log('✅ dailyExtractFrontendRaceContract.test.js 通过');
```

（正则可按格式化微调；核心是：导出 3000、有 timeout 包装、无限阻塞循环移除或仅在「显式 waitUntilDone」内部可选。）

- [ ] **Step 2: 跑测失败**

```bash
cd vocab-server && node tests/dailyExtractFrontendRaceContract.test.js
```

- [ ] **Step 3: 实现**

在 `difyAPI.ts`：

```ts
export const DAILY_EXTRACT_RACE_MS = 3000;

export async function withDailyExtractTimeout<T>(
  actionPromise: Promise<T>,
  timeoutMs: number = DAILY_EXTRACT_RACE_MS
): Promise<{ isTimeout: false; result: T } | { isTimeout: true }> {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) => {
    timerId = setTimeout(() => resolve({ isTimeout: true }), timeoutMs);
  });
  try {
    return await Promise.race([
      actionPromise.then((result) => ({ isTimeout: false as const, result })),
      timeoutPromise,
    ]);
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

/** 仅启动任务，立即返回 taskId（不轮询） */
export async function startEnglishMasteryExtraction(
  topic: string,
  materialText = '',
  userId = getAppUserId(),
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1' = 'B1',
  genre: 'news' | 'meeting' | 'podcast' | 'reading' | 'email' | 'report' | 'negotiation' | 'presentation' = 'meeting',
  duration: '15' | '25' | '35' = '25'
): Promise<{ taskId: string } & Partial<DailyExtractResult>> {
  const response = await fetch('/api/english/daily-extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic,
      materialText,
      userId,
      cefrLevel,
      genre,
      duration,
      user_current_profile: getUserCurrentProfile(),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    if (data?.quotaExceeded) return data;
    throw new Error(data?.error || data?.message || '提取词汇操作失败，请检查后端状态');
  }
  if (!data.taskId) {
    interceptOutputText(data);
    return data;
  }
  return data;
}

export async function pollEnglishMasteryExtractionOnce(taskId: string): Promise<DailyExtractResult | { status: 'pending' }> {
  const statusRes = await fetch(`/api/english/daily-extract/status/${taskId}`);
  const statusData = await statusRes.json().catch(() => ({}));
  if (!statusRes.ok || !statusData.success) {
    throw new Error(statusData?.error || '状态轮询失败');
  }
  if (statusData.status === 'completed') {
    interceptOutputText(statusData);
    return statusData as DailyExtractResult;
  }
  if (statusData.status === 'failed') {
    throw new Error(statusData.error || '后台生成失败');
  }
  return { status: 'pending' };
}

/** 轮询直到完成（供竞速 Promise 使用；超时后仍可在后台继续） */
export async function waitEnglishMasteryExtraction(taskId: string, intervalMs = 1000): Promise<DailyExtractResult> {
  while (true) {
    const once = await pollEnglishMasteryExtractionOnce(taskId);
    if (!('status' in once && once.status === 'pending')) {
      return once as DailyExtractResult;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export async function triggerEnglishMasteryExtraction(...args: Parameters<typeof startEnglishMasteryExtraction>) {
  const started = await startEnglishMasteryExtraction(...args);
  if (!started.taskId) return started as DailyExtractResult;
  return waitEnglishMasteryExtraction(started.taskId);
}
```

- [ ] **Step 4: 跑测通过**

```bash
cd vocab-server && node tests/dailyExtractFrontendRaceContract.test.js
```

- [ ] **Step 5: Commit**（仅当用户要求时）

---

### Task 6: DashboardTab 竞速 UI + 文案

**Files:**
- Modify: `src/components/modules/english/tabs/DashboardTab.tsx`
- Modify: `vocab-server/tests/dailyExtractFrontendRaceContract.test.js`（追加 Dashboard 断言）

- [ ] **Step 1: 扩展契约断言（先失败）**

```js
const dash = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'modules', 'english', 'tabs', 'DashboardTab.tsx'), 'utf8');
assert.match(dash, /withDailyExtractTimeout|DAILY_EXTRACT_RACE_MS/);
assert.match(dash, /已转入后台/);
assert.match(dash, /addTask\(/);
assert.match(dash, /type:\s*['"]daily_extract['"]/);
assert.ok(!dash.includes('预计需 15~30 秒'), '阻塞文案应移除或改为短时反馈');
assert.ok(!/入库 \$\{wordsAddedCount\}/.test(dash), '不得再提示自动入库词数');
```

- [ ] **Step 2: 跑测失败后改 `handleAutoGenerate`**

要点：

1. `import { useTask } from '../../../TaskContext'`（按相对路径修正）。
2. `const { addTask, startPolling } = useTask();`
3. 命中缓存分支不变。
4. 未命中：

```ts
setIsAutoGenerating(true);
const started = await startEnglishMasteryExtraction(theme, '', getAppUserId(), cefrLevel, genre, duration);
if (!started.taskId) {
  // 无 task 的同步结果（极少）——直接渲染
  // ...套用展示逻辑
  setIsAutoGenerating(false);
  return;
}

const waitPromise = waitEnglishMasteryExtraction(started.taskId);
waitPromise.catch(() => {}); // 超时后仍在跑，避免未处理 rejection

const race = await withDailyExtractTimeout(waitPromise, DAILY_EXTRACT_RACE_MS);
if (race.isTimeout) {
  addTask({
    id: started.taskId,
    type: 'daily_extract',
    name: `长文生成: ${String(theme).slice(0, 24)} (${genre}/${cefrLevel}/${duration}m)`,
    status: 'running',
    progress: 20,
    logs: ['超过 3 秒未完成，已转入后台继续生成；完成后可再次查询命中缓存'],
  });
  startPolling?.(started.taskId); // 若 Context 有此方法则调用
  showNotice('dashboard', '生成较久，已转入后台，稍后可在【任务中心】查看', 'info');
  setIsAutoGenerating(false);
  return;
}

const result = race.result;
// 原有 setGeneratedArticle / words / phrases / sentences
showNotice(
  'dashboard',
  `长文与词表已缓存展示（${displayWordCount} 词 / ${displayPhraseCount} 短语 / ${displaySentenceCount} 句型），请逐条「+ 收录」写入生词本`,
  'success'
);
setIsAutoGenerating(false);
```

5. 遮罩文案改为短句，例如「正在生成…（超过 3 秒将自动转入后台）」；删除「预计需 15~30 秒」。
6. 删除依赖 `wordsAddedCount` 的「入库 X 词」成功分支。

- [ ] **Step 3: 跑测通过**

```bash
cd vocab-server && node tests/dailyExtractFrontendRaceContract.test.js
```

- [ ] **Step 4: Commit**（仅当用户要求时）

---

### Task 7: 对抗式回归与设计状态

**Files:**
- Modify: `docs/superpowers/specs/2026-08-20-long-article-cache-manual-vocab-design.md`（状态 → 已批准/实现中）
- Run: 全部相关测试

- [ ] **Step 1: 跑全套相关测试**

```bash
cd vocab-server && node tests/dailyExtractedArticlesSchema.test.js
cd vocab-server && node tests/dailyPackLongArticleSkipThemeContract.test.js
cd vocab-server && node tests/dailyExtractNoAutoVocab.test.js
cd vocab-server && node tests/dailyExtractTaskQueueContract.test.js
cd vocab-server && node tests/dailyExtractFrontendRaceContract.test.js
cd vocab-server && node tests/vocabMatrixCollectContract.test.js
```

Expected: 全部 `✅` / pass。

- [ ] **Step 2: 手工验收清单（实现者勾选）**

| # | 步骤 | 预期 |
|---|------|------|
| 1 | 预置缓存行（同 user/theme/genre/cefr/duration）后点查询 | 立即命中长文+三列词表，生词本不变 |
| 2 | 清缓存后点生成，人为拖慢后端 >3s | 遮罩关闭、提示转入后台、可点其他 Tab；任务中心有 `daily_extract` |
| 3 | 任务完成后再次查询 | 命中缓存 |
| 4 | 查 vocabulary 无新的 `source: Daily Extract` 批量行 | 通过 |
| 5 | 对一词点「+ 收录」 | 该词进生词本并可补矩阵 |

- [ ] **Step 3: 更新 spec 状态为「已批准；实现按 plan」**

- [ ] **Step 4: Commit**（仅当用户要求时）

---

## Spec coverage（自检）

| Spec 项 | Task |
|---------|------|
| 增强 `daily_extracted_articles` + UNIQUE 含 theme/duration + 索引 | Task 1 |
| 查询命中长文+词表 | 现有 GET + Task 1/6（前端已查 theme） |
| 未命中 3 秒转后台 + 轻提示 + 不挡页 | Task 5–6 |
| 任务中心可见 | Task 4–6 |
| 不自动写生词本（手动=cron） | Task 3（共用 `runDailyExtractAsync`） |
| 生成路径不受入库配额拦截 | Task 3 |
| cron skip 含 theme | Task 2 |
| 文案不再「自动入库」 | Task 6 |
| 验收 | Task 7 |

## Placeholder scan

无 TBD / 「稍后实现」步骤；契约测试给出可运行骨架；SQLite 无窗口函数时 Task 1 已注明替代去重写法。
