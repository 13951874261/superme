# 后台任务中心展示优化 + 可删除日志 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化后台任务中心展示（不改现有业务能力），并支持硬删已结束的 cron/普通任务日志；合并列表按时间倒序。

**Architecture:** 服务层先加删除与状态守卫（taskQueue + dailyCronRunService），再挂 HTTP 路由；前端 API/Context 暴露删除与清空；GlobalTaskCenter 只做展示分层、合并倒序、删除入口。删除仅清日志记录，不碰业务产物。

**Tech Stack:** React + TypeScript（前端）、Node.js + Express（vocab-server）、SQLite（daily_cron_*）、InMemoryTaskQueue + tasks.json、Node assert 单测。

**Spec:** `docs/superpowers/specs/2026-08-20-task-center-ui-delete-design.md`

**Commit 约定：** 本仓库用户规则要求「仅在用户明确要求时 commit」。下列 Commit 步骤默认跳过，除非用户当轮明确说「提交/commit」。

---

## File Structure

| 文件 | 职责 |
|------|------|
| `vocab-server/services/taskQueue.js` | `deleteTask` / `clearFinishedTasks` |
| `vocab-server/services/dailyCronRunService.js` | `deleteRunForUser` / `clearFinishedRunsForUser` |
| `vocab-server/server.js` | DELETE/POST 路由 |
| `vocab-server/tests/taskQueueDelete.test.js` | 普通任务删除单测 |
| `vocab-server/tests/dailyCronRunDelete.test.js` | cron 删除级联单测 |
| `src/services/dailyCronAPI.ts` | 客户端删除 API |
| `src/components/TaskContext.tsx` | 删除/清空/createdAt 类型 |
| `src/components/GlobalTaskCenter.tsx` | UI 优化、倒序、删除入口 |

---

### Task 1: taskQueue 删除 API（TDD）

**Files:**
- Create: `vocab-server/tests/taskQueueDelete.test.js`
- Modify: `vocab-server/services/taskQueue.js`

- [ ] **Step 1: 写失败测试**

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 通过临时目录隔离 tasks.json：在 require 前设置 cwd 不可靠（单例已绑定路径）。
// 策略：直接 require 单例后，用 createTask 造数据，测完 clear；或动态 mock queuePath。
// 本项目 taskQueue 为单例，测试用 create/update/delete 后清理，避免污染。

const taskQueue = require('../services/taskQueue');

function wipeAll() {
  for (const t of taskQueue.getAllTasks()) {
    taskQueue.tasks.delete(t.id);
  }
  taskQueue._save();
}

function testDeleteFinishedOk() {
  wipeAll();
  const t = taskQueue.createTask('url', 't1');
  taskQueue.updateTask(t.id, { status: 'completed', progress: 100 });
  const r = taskQueue.deleteTask(t.id);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(taskQueue.getTask(t.id), undefined);
}

function testDeleteRunningConflict() {
  wipeAll();
  const t = taskQueue.createTask('url', 't2');
  taskQueue.updateTask(t.id, { status: 'running', progress: 10 });
  const r = taskQueue.deleteTask(t.id);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 409);
  assert.ok(taskQueue.getTask(t.id));
}

function testDeleteMissing404() {
  wipeAll();
  const r = taskQueue.deleteTask('task_missing');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 404);
}

function testClearFinishedKeepsRunning() {
  wipeAll();
  const a = taskQueue.createTask('url', 'done');
  taskQueue.updateTask(a.id, { status: 'failed', error: 'x' });
  const b = taskQueue.createTask('url', 'run');
  taskQueue.updateTask(b.id, { status: 'running', progress: 1 });
  const r = taskQueue.clearFinishedTasks();
  assert.strictEqual(r.deleted, 1);
  assert.strictEqual(taskQueue.getTask(a.id), undefined);
  assert.ok(taskQueue.getTask(b.id));
}

try {
  testDeleteFinishedOk();
  testDeleteRunningConflict();
  testDeleteMissing404();
  testClearFinishedKeepsRunning();
  wipeAll();
  console.log('✅ taskQueueDelete.test.js 通过');
} catch (e) {
  console.error('❌', e);
  process.exit(1);
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node vocab-server/tests/taskQueueDelete.test.js`  
Expected: FAIL（`deleteTask` / `clearFinishedTasks` 未定义）

- [ ] **Step 3: 最小实现**

在 `taskQueue.js` 的 `getAllTasks` 之前增加：

```js
isFinishedStatus(status) {
  return status === 'completed' || status === 'failed';
}

deleteTask(id) {
  const task = this.tasks.get(id);
  if (!task) return { ok: false, code: 404 };
  if (!this.isFinishedStatus(task.status)) return { ok: false, code: 409, task };
  this.tasks.delete(id);
  this._save();
  return { ok: true, code: 200 };
}

clearFinishedTasks() {
  let deleted = 0;
  for (const [id, task] of this.tasks.entries()) {
    if (this.isFinishedStatus(task.status)) {
      this.tasks.delete(id);
      deleted += 1;
    }
  }
  if (deleted > 0) this._save();
  return { deleted };
}
```

说明：普通任务无 `partial_failed`；终态仅 `completed`/`failed`。

- [ ] **Step 4: 跑测试确认通过**

Run: `node vocab-server/tests/taskQueueDelete.test.js`  
Expected: `✅ taskQueueDelete.test.js 通过`

- [ ] **Step 5: Commit（仅用户要求时）**

```bash
git add vocab-server/services/taskQueue.js vocab-server/tests/taskQueueDelete.test.js
git commit -m "$(cat <<'EOF'
feat: add task queue delete and clear-finished APIs

EOF
)"
```

---

### Task 2: dailyCronRunService 删除 API（TDD）

**Files:**
- Create: `vocab-server/tests/dailyCronRunDelete.test.js`
- Modify: `vocab-server/services/dailyCronRunService.js`

- [ ] **Step 1: 写失败测试**

```js
const assert = require('assert');

function openDatabase() {
  try {
    const Database = require('better-sqlite3');
    return new Database(':memory:');
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.transaction = (fn) => (...args) => {
      db.exec('BEGIN');
      try {
        const result = fn(...args);
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    };
    return db;
  }
}

const svc = require('../services/dailyCronRunService');

function seedFinishedRun(db, { userId = 'u1', status = 'completed' } = {}) {
  const run = svc.createPerUserRun(db, {
    cronTickId: svc.createCronTickId(),
    userId,
    packDate: '2026-08-20',
    triggerSource: 'cron',
  });
  db.prepare(`
    UPDATE daily_cron_runs
    SET status = ?, execution_status = ?, progress = 100, finished_at = ?
    WHERE id = ?
  `).run(status, status, Date.now(), run.id);
  svc.upsertStep(db, {
    runId: run.id,
    module: 'wakeup',
    comboKey: 'wakeup',
    status: status === 'failed' ? 'failed' : 'completed',
    progress: 100,
  });
  svc.appendLogEvent(db, { runId: run.id, level: 'info', message: 'seed' });
  return run.id;
}

function testDeleteCascades() {
  const db = openDatabase();
  svc.initDailyCronRunTables(db);
  const id = seedFinishedRun(db, { status: 'partial_failed' });
  const r = svc.deleteRunForUser(db, id, 'u1');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_runs WHERE id = ?').get(id).n, 0);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_steps WHERE run_id = ?').get(id).n, 0);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_log_events WHERE run_id = ?').get(id).n, 0);
}

function testDeleteRunning409() {
  const db = openDatabase();
  svc.initDailyCronRunTables(db);
  const run = svc.createPerUserRun(db, {
    cronTickId: svc.createCronTickId(),
    userId: 'u1',
    packDate: '2026-08-20',
  });
  const r = svc.deleteRunForUser(db, run.id, 'u1');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 409);
}

function testDeleteWrongUser404() {
  const db = openDatabase();
  svc.initDailyCronRunTables(db);
  const id = seedFinishedRun(db, { userId: 'u1' });
  const r = svc.deleteRunForUser(db, id, 'other');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 404);
}

function testClearFinished() {
  const db = openDatabase();
  svc.initDailyCronRunTables(db);
  const done = seedFinishedRun(db, { status: 'failed' });
  const run = svc.createPerUserRun(db, {
    cronTickId: svc.createCronTickId(),
    userId: 'u1',
    packDate: '2026-08-21',
  });
  const r = svc.clearFinishedRunsForUser(db, 'u1');
  assert.ok(r.deletedRuns >= 1);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_runs WHERE id = ?').get(done).n, 0);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM daily_cron_runs WHERE id = ?').get(run.id).n, 1);
}

try {
  testDeleteCascades();
  testDeleteRunning409();
  testDeleteWrongUser404();
  testClearFinished();
  console.log('✅ dailyCronRunDelete.test.js 通过');
} catch (e) {
  console.error('❌', e);
  process.exit(1);
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node vocab-server/tests/dailyCronRunDelete.test.js`  
Expected: FAIL（函数未导出）

- [ ] **Step 3: 最小实现**

在 `dailyCronRunService.js` 增加（放在 `cleanupOldCronRuns` 附近），并加入 `module.exports`：

```js
function isFinishedRunStatus(status) {
  return status === 'completed' || status === 'failed' || status === 'partial_failed';
}

function deleteRunRows(db, runIds) {
  if (!runIds.length) {
    return { deletedRuns: 0, deletedSteps: 0, deletedEvents: 0 };
  }
  const placeholders = runIds.map(() => '?').join(',');
  const delEvents = db.prepare(
    `DELETE FROM daily_cron_log_events WHERE run_id IN (${placeholders})`,
  ).run(...runIds);
  const delSteps = db.prepare(
    `DELETE FROM daily_cron_steps WHERE run_id IN (${placeholders})`,
  ).run(...runIds);
  const delRuns = db.prepare(
    `DELETE FROM daily_cron_runs WHERE id IN (${placeholders})`,
  ).run(...runIds);
  return {
    deletedRuns: delRuns.changes,
    deletedSteps: delSteps.changes,
    deletedEvents: delEvents.changes,
  };
}

function deleteRunForUser(db, runId, userId) {
  const ownership = assertRunOwner(db, runId, userId);
  if (!ownership.ok) return { ok: false, code: ownership.code || 404 };
  const status = ownership.run.status;
  if (!isFinishedRunStatus(status)) {
    return { ok: false, code: 409 };
  }
  const stats = deleteRunRows(db, [runId]);
  return { ok: true, code: 200, ...stats };
}

function clearFinishedRunsForUser(db, userId) {
  const uid = normalizeUserId(userId);
  const rows = db.prepare(`
    SELECT id FROM daily_cron_runs
    WHERE user_id = ?
      AND status IN ('completed', 'failed', 'partial_failed')
  `).all(uid);
  const ids = rows.map((r) => r.id);
  return deleteRunRows(db, ids);
}
```

注意：可把 `cleanupOldCronRuns` 内部删除改为复用 `deleteRunRows`，但 **非必须**；若改动，保持行为不变。

- [ ] **Step 4: 跑测试确认通过**

Run: `node vocab-server/tests/dailyCronRunDelete.test.js`  
Expected: `✅ dailyCronRunDelete.test.js 通过`

- [ ] **Step 5: Commit（仅用户要求时）** — 跳过默认

---

### Task 3: HTTP 路由

**Files:**
- Modify: `vocab-server/server.js`（在现有 `/api/tasks` 与 `/api/daily-cron/runs` 附近）
- Create（可选契约测）: `vocab-server/tests/taskCenterDeleteRoutesContract.test.js`

- [ ] **Step 1: 契约测试（路由字符串存在）**

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
assert.match(src, /app\.delete\(\s*['"]\/api\/tasks\/:taskId['"]/);
assert.match(src, /app\.post\(\s*['"]\/api\/tasks\/clear-finished['"]/);
assert.match(src, /app\.delete\(\s*['"]\/api\/daily-cron\/runs\/:runId['"]/);
assert.match(src, /app\.post\(\s*['"]\/api\/daily-cron\/runs\/clear-finished['"]/);
console.log('✅ taskCenterDeleteRoutesContract.test.js 通过');
```

- [ ] **Step 2: 跑测应失败 → 实现路由**

普通任务（紧挨 `GET /api/tasks/:taskId`）：

```js
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
```

Cron（紧挨现有 GET runs）：

```js
app.delete('/api/daily-cron/runs/:runId', (req, res) => {
  try {
    const userId = req.query.userId || req.body?.userId;
    const result = dailyCronRunService.deleteRunForUser(db, req.params.runId, userId);
    if (!result.ok) {
      return res.status(result.code).json({
        success: false,
        error: result.code === 409 ? '进行中的任务不能删除' : 'not found',
      });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/daily-cron/runs/clear-finished', (req, res) => {
  try {
    const userId = req.body?.userId || req.query.userId;
    const result = dailyCronRunService.clearFinishedRunsForUser(db, userId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

注意：Express 中 `app.post('/api/tasks/clear-finished')` 必须注册在 `app.get('/api/tasks/:taskId')` **之前**，或确保 path 不冲突（DELETE 用 `:taskId` 不影响 POST clear-finished，但若未来有 `GET :taskId` 抢占则无影响）。`POST /api/tasks/clear-finished` 与 `GET /api/tasks/:taskId` 方法不同，无冲突。

- [ ] **Step 3: 跑契约测通过**

Run: `node vocab-server/tests/taskCenterDeleteRoutesContract.test.js`

- [ ] **Step 4: Commit（仅用户要求时）**

---

### Task 4: 前端 dailyCronAPI + 任务删除 fetch 辅助

**Files:**
- Modify: `src/services/dailyCronAPI.ts`
- （任务删除可直接写在 TaskContext，或同文件旁新增薄封装；推荐 TaskContext 内 inline fetch，减少文件）

- [ ] **Step 1: 在 `dailyCronAPI.ts` 末尾追加**

```ts
export async function deleteDailyCronRun(runId: string, userId = getAppUserId()): Promise<void> {
  const res = await fetch(
    `/api/daily-cron/runs/${encodeURIComponent(runId)}?userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
  if (res.status === 404) return;
  const data = await res.json().catch(() => ({}));
  if (res.status === 409) throw new Error(data.error || '进行中的任务不能删除');
  if (!res.ok || !data.success) throw new Error(data.error || `delete run HTTP ${res.status}`);
}

export async function clearFinishedDailyCronRuns(userId = getAppUserId()): Promise<{ deletedRuns: number }> {
  const res = await fetch('/api/daily-cron/runs/clear-finished', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || `clear cron HTTP ${res.status}`);
  return { deletedRuns: Number(data.deletedRuns || 0) };
}
```

- [ ] **Step 2: 目视确认无 TS 报错（IDE / `npx tsc --noEmit` 若项目已有脚本）**

- [ ] **Step 3: Commit（仅用户要求时）**

---

### Task 5: TaskContext 删除能力

**Files:**
- Modify: `src/components/TaskContext.tsx`

- [ ] **Step 1: 扩展类型**

```ts
export interface TaskItem {
  // ...existing fields
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number;
}

interface TaskContextType {
  // ...existing
  deleteTask: (id: string) => Promise<void>;
  deleteCronRun: (id: string) => Promise<void>;
  clearFinished: () => Promise<{ deletedTasks: number; deletedCronRuns: number }>;
}
```

- [ ] **Step 2: 实现方法**

```ts
const deleteTask = useCallback(async (id: string) => {
  const res = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (res.status === 404) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 409) {
    await fetchTasks();
    throw new Error(data.error || '进行中的任务不能删除');
  }
  if (!res.ok || !data.success) throw new Error(data.error || `delete task HTTP ${res.status}`);
  setTasks((prev) => prev.filter((t) => t.id !== id));
  activePolls.current.delete(id);
}, []);

const deleteCronRun = useCallback(async (id: string) => {
  const { deleteDailyCronRun } = await import('../services/dailyCronAPI');
  // 或顶部静态 import deleteDailyCronRun / clearFinishedDailyCronRuns
  try {
    await deleteDailyCronRun(id);
  } catch (e: any) {
    if (String(e?.message || '').includes('进行中')) {
      await fetchCronRuns();
    }
    throw e;
  }
  setCronRuns((prev) => prev.filter((r) => r.id !== id));
}, [fetchCronRuns]);

const clearFinished = useCallback(async () => {
  const res = await fetch(`${API_BASE}/api/tasks/clear-finished`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  let deletedTasks = 0;
  if (res.ok && data.success) deletedTasks = Number(data.deleted || 0);
  else throw new Error(data.error || '清空普通任务失败');

  const { clearFinishedDailyCronRuns } = await import('../services/dailyCronAPI');
  let deletedCronRuns = 0;
  try {
    const r = await clearFinishedDailyCronRuns();
    deletedCronRuns = r.deletedRuns;
  } catch (e) {
    await Promise.all([fetchTasks(), fetchCronRuns()]);
    throw e;
  }
  await Promise.all([fetchTasks(), fetchCronRuns()]);
  return { deletedTasks, deletedCronRuns };
}, [fetchCronRuns]);
```

推荐：顶部静态 import，避免动态 import。Provider value 挂上三方法。

- [ ] **Step 3: Commit（仅用户要求时）**

---

### Task 6: GlobalTaskCenter UI（展示 + 删除 + 倒序）

**Files:**
- Modify: `src/components/GlobalTaskCenter.tsx`

- [ ] **Step 1: 合并倒序辅助**

```ts
type FeedItem =
  | { kind: 'cron'; sortAt: number; run: DailyCronRunSummary }
  | { kind: 'task'; sortAt: number; task: TaskItem };

function sortKey(createdAt?: number, updatedAt?: number, completedAt?: number) {
  return Number(createdAt || updatedAt || completedAt || 0);
}

// 在组件内：
const feed: FeedItem[] = [
  ...cronRuns.map((run) => ({ kind: 'cron' as const, sortAt: sortKey(run.createdAt, run.updatedAt), run })),
  ...tasks.map((task) => ({ kind: 'task' as const, sortAt: sortKey(task.createdAt, task.updatedAt, task.completedAt), task })),
].sort((a, b) => b.sortAt - a.sortAt);
```

渲染：`feed.map` 分支渲染 `DailyCronCard` / 普通卡片，替代原先「先 cron 再 tasks」。

- [ ] **Step 2: 顶栏「清空已结束」**

```tsx
const finishedCount =
  cronRuns.filter((r) => ['completed', 'failed', 'partial_failed'].includes(r.status)).length +
  tasks.filter((t) => t.status === 'completed' || t.status === 'failed').length;

// 顶栏按钮：finishedCount > 0 时显示
// onClick:
const n = finishedCount;
if (!window.confirm(`将删除 ${n} 条已结束记录，不可恢复。确定？`)) return;
await clearFinished();
```

- [ ] **Step 3: DailyCronCard 展示优化 + 删除**

- 四模块改为 `grid grid-cols-4 gap-2` 小格：上模块名、中 `completed/total`、下失败数（失败>0 用琥珀色）
- 状态徽章保持现有逻辑，可略增对比
- 标题行右侧：`StatusBadge` + Trash2 按钮
- props 增加：`onDelete: () => void`、`deleting?: boolean`
- `canDelete = ['completed','failed','partial_failed'].includes(run.status)`
- 🗑：`disabled={!canDelete || deleting}`；可删时 `onClick={onDelete}`（无 confirm）

- [ ] **Step 4: 普通任务卡片同样加 🗑**

- `canDelete = status === 'completed' || status === 'failed'`
- 调用 `deleteTask(task.id)`；错误写入卡片局部 `err` state 或顶栏提示

- [ ] **Step 5: 确认未改动的能力仍在**

核对仍存在：查看详情、整次重新执行、重跑失败项、导入/下载/跳转、运行日志展开。

- [ ] **Step 6: Commit（仅用户要求时）**

---

### Task 7: 验收

- [ ] **Step 1: 跑服务端测试**

```bash
node vocab-server/tests/taskQueueDelete.test.js
node vocab-server/tests/dailyCronRunDelete.test.js
node vocab-server/tests/taskCenterDeleteRoutesContract.test.js
```

Expected: 全部通过

- [ ] **Step 2: 手工验收（对照 spec §7）**

| # | 路径 | 数据 | 预期 |
|---|------|------|------|
| 1 | 打开后台任务中心 | 多条不同时间记录 | 最新在最上方 |
| 2 | 已结束卡片点 🗑 | 任意 completed/failed/partial_failed | 直接消失；刷新仍无 |
| 3 | 处理中卡片 🗑 | pending/running | 按钮禁用 |
| 4 | 顶栏清空已结束 | confirm 取消/确认 | 取消不变；确认后已结束清空，进行中保留 |
| 5 | 详情/重跑/导入 | 与改前相同操作 | 行为不变 |
| 6 | 删 cron 日志后 | 查业务产物（长文/音频等） | 产物仍在 |

- [ ] **Step 3: 向用户提交本步结果，询问是否符合预期**（符合 AGENTS 单步确认）

---

## Spec Coverage Self-Review

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 展示降密度 + 视觉分层 | Task 6 |
| 不改现有按钮能力 | Task 6 Step 5 |
| 单条直接删 / 清空 confirm | Task 6 |
| 仅已结束可删 | Task 1–3, 6 |
| cron + 普通任务都可删 | Task 1–6 |
| 硬删级联 steps/events | Task 2 |
| 时间倒序 | Task 6 |
| 404/409/错误处理 | Task 3–5 |
| 不删业务产物 | Task 2 仅删 cron 表；验收 Task 7 |

**Placeholder scan:** 无 TBD。  
**类型一致:** `deleteRunForUser` / `clearFinishedRunsForUser` / `deleteTask` / `clearFinishedTasks` 前后命名一致。
