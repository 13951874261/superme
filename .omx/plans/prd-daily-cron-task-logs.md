# PRD：后台任务中心 — 每日定时任务执行日志（修订版）

> Requirements: `.omx/specs/deep-interview-daily-cron-task-logs.md`  
> Context: `.omx/context/daily-cron-task-logs-20260808T105600Z.md`  
> Mode: `$ralplan --consensus` **DELIBERATE** (PII + secrets)  
> Architect Round 1: **ITERATE** → this revision absorbs §6 required changes

## 1. Goal

当前登录声明用户（见 §5 身份 ADR）可在「后台任务：查看队列」中查看**自己**最近 7 个上海日历日的每日生成运行状态、进度、入参与获取方式，并支持「整次当前入参重跑 / 失败项快照重跑」。不改变 02:00 调度；不延长 `taskQueue` TTL；不改 Dify Prompt/业务生成规则。

## 2. RALPLAN-DR (Deliberate)

### Principles

1. 观察性优先：不改 02:00 / TZ 策略。  
2. 租户过滤在服务端按 `user_id` 强制执行（声明式身份，见 §5）。  
3. 不污染 `taskQueue`：Cron 独立 SQLite；`/api/tasks*` 与 `taskQueue.js` **零 diff**。  
4. 密钥永不入账/出站。  
5. 最小侵入：不修既有 pack `continue` 跳过长文缺陷（仅暴露）；必要接线（await extract、Listen stitch）标为 **necessary related change**。

### Drivers

1. 7 天可查（taskQueue 30min 不足）  
2. 入参值 + 获取方式 + 双语义重跑  
3. 跨用户 PII 不返回

### Options

| Opt | Pros | Cons | Verdict |
|-----|------|------|---------|
| **A** 独立 SQLite + 任务中心合并 | 满足 7 天；不碰 taskQueue TTL；可结构化入参来源；per-user 过滤清晰 | 双列表合并；需 await extract / Listen stitch | **Chosen** |
| **B** 延长 taskQueue TTL | UI 改动最小 | 破坏无关任务 30min 清理；JSON 膨胀；64 组合难建模 | Invalidated |
| **C** 独立运维页 | 后端最简单 | 违背「在队列中查看」入口 | Invalidated |

### Pre-mortem（扩展）

1. 长文假完成（HTTP accept）→ await terminal(taskId)  
2. 跨用户泄漏 → write-time per-user run + owner checks  
3. 密钥进日志 → sanitize 递归 + 单测  
4. Pack short-circuit 导致进度永不收敛 → 64 leaves 标 skipped  
5. Pack/Listen 两 job 拆成两张卡 → `cron_tick_id` stitch  
6. 多实例 restart 误杀他机 running → 单实例约束或 lease  
7. 审计写失败导致 UI 假 completed → `audit_health`  
8. snapshot 重跑仍重解析随机 Focus → snapshot executor 禁 resolver

## 3. Architecture

```text
scheduleDailyPackCron tick
  → cron_tick_id = uuid
  → for each target user:
       INSERT daily_cron_runs (user_id, pack_date, cron_tick_id, ...)  // write-time
       modules: wakeup, flaw, long_article(64 leaves), (listen later)
  → runDailyListenCronJob(same cron_tick_id)
       OPEN run by (cron_tick_id, user_id)
       write listen module on SAME run
  → APIs filter by userId
  → FE merges /api/daily-cron/runs with /api/tasks (display only; no TaskItem side-effects)
```

### 3.1 Run identity（冻结）

1. 每个 cron tick 分配 **`cron_tick_id`**。  
2. **v1 不创建** `scope=global` 父行；只物化 **per-user runs**。  
3. 在 `listCronTargetUsers` 循环**入口立即 INSERT** 该用户 run（非读时投影）。  
4. Pack + LongArticle 写入该 run；随后 `runDailyListenCronJob` 用 `(cron_tick_id, user_id)` **打开同一行**写 Listen。  
5. 用户重跑：新 run，`trigger_source=user_rerun`，`parent_run_id` 指向来源；**永不**调用全局多用户 Cron。  
6. API **只查询** `user_id = 请求用户` 的物化行。

### 3.2 Tables

**`daily_cron_runs`**: id, cron_tick_id, pack_date, user_id, trigger_source, parent_run_id,  
status (`pending|running|completed|partial_failed|failed`), progress,  
execution_status (业务聚合；对外 `status` 与其相等), audit_health (`ok|degraded`), summary_json, error_message,  
started_at, finished_at, created_at, updated_at, lease_owner (nullable), lease_until (nullable),  
**UNIQUE(cron_tick_id, user_id)**  

Progress 分母（冻结）：  
- 标准四模块 run：wakeup(1)+flaw(1)+long_article(64)+listen(1)=**67**（含 skipped）。  
- **listen-only** 手动 run：分母=**1**（仅 listen）；不创建 66 个假 skipped。

**`daily_cron_steps`**: id, run_id, user_id, module (`wakeup|flaw|long_article|listen`),  
combo_key (nullable `genre|cefr|duration`), status (`pending|running|completed|failed|skipped`),  
progress, error_message, inputs_json, input_sources_json, result_summary_json,  
attempt, started_at, finished_at

**`daily_cron_log_events`**: id, run_id, step_id?, level, message, context_json, created_at  
（UTF-8；sanitize；单 step 可设硬上限，超额折叠为 summary event）

Retention: Shanghai `pack_date` > 7 天删除；`status=running` 且 lease 未过期不删。

### 3.3 Module instrumentation

#### Wakeup / Flaw

- Wrap `generateDailyPackForUser`（及 regenerate 路径若走同一服务）。  
- Terminal: daily_packs status ready/failed for that input_signature.  
- Record full input source contract（含 flaw dynamicTheme / focus / salt / slice(-50) 真相）。

#### Long article — Async extract completion contract（冻结）

| Item | Rule |
|------|------|
| Adapter | **Cron/rerun-only adapter**：不改变前台 `POST /daily-extract` 对浏览器的 202 合同 |
| Submit | 调用现有 extract 取得 `taskId` |
| Await | 轮询 `extractionTasks.get(taskId)` 直至 `completed|failed`，或超时 |
| Timeout | 可配置，默认 10 分钟/组合；超时 → step `failed` reason=timeout |
| Map miss | taskId 丢失且无 exact row → `failed` reason=task_lost |
| Date freeze | Cron 路径传入冻结的 Shanghai `packDate`；**禁止**依赖 extract 内部 UTC `today` 作为日志 businessDate（日志用 pack_date；业务表 UTC 错位仅记录为 known risk / O-date） |
| Success criterion | terminal status completed **且**（若可得）exact article row 存在；落库 non-blocking 失败 → step failed/degraded，不得标 completed |
| Detached TTS | Cron 长文路径：**禁用** `runDailyExtractAsync` 末尾 detached TTS 或标记 owner=`listen` 且本模块不 await TTS；Listen 为音频唯一 owner |

#### Pack short-circuit（`ready && source==='cron' → continue`）

- **禁止删除**该 continue（业务非目标）。  
- 仍创建 per-user run。  
- wakeup/flaw steps → `skipped` reason=`daily_pack_ready_cron_cache`。  
- **全部 64** long_article leaves → `skipped` same reason。  
- Listen **仍真实执行**并写入同 run。  
- progress 分母含 skipped 为已结束单元。

#### Listen

- Owner：同一 run 的 `listen` 模块（及 audio sync）。  
- 禁止与 long_article 双写 audio 终态；Cron 长文路径 **禁用** detached TTS（二选一写死为禁用，不用 owner 标记旁路）。  
- Stitch（冻结）：  
  1. Pack 阶段生成并向下传递 `cron_tick_id`。  
  2. 签名改为 `runDailyListenCronJob(db, { cron_tick_id })`。  
  3. 用户迭代 = `SELECT user_id FROM daily_cron_runs WHERE cron_tick_id=?`（冻结集），**禁止**再调 `listCronTargetUsers` 作为 Listen 用户源。  
  4. OPEN miss（无对应 run）：**禁止 INSERT** 新 run；写 error event 并 skip 该用户 listen。  
  5. Schema：`UNIQUE(cron_tick_id, user_id)`。  
- 手动 `POST /api/listen/pregenerated/cron-run`（无 tick）：自建新 `cron_tick_id` + listen-only run；**不**回填/拼接当日已有 pack run。

### 3.4 Status / audit

- `execution_status`：纯业务聚合（completed / partial_failed / failed / running）。  
- `audit_health`：`ok` | `degraded`（SQLite 写失败、事件截断等）。  
- **规则**：审计写失败时，`execution_status` 仍可按业务更新，但 UI 必须显示 degraded；**禁止**在未知业务终态时因缺审计而标 completed。  
- 父 `status` 字段对外可等于 `execution_status`；详情同时返回 `audit_health`。

### 3.5 Snapshot / current executors（冻结）

| Mode | Resolver | Random Focus/Salt | history/profile/flaws |
|------|----------|-------------------|------------------------|
| `failed_snapshot` | **禁止**调用 getHistoryExclude / getUserCurrentProfile / 新 random | 使用 inputs_json 快照 | 使用快照 |
| `all_current` | 必须重新解析当前数据 | 允许新 random（flaw） | 当前值 |

实现：抽出 `executeWakeupFromInputs(inputs)` / `executeLongArticleFromInputs(inputs)` 等；snapshot 路径只喂快照。

### 3.6 Restart / multi-instance

- **v1 部署假设：单 Node 实例**（与现有内存 cron 标记一致）。  
- **Startup（v1 冻结）**：将**所有** `status=running` 的 run/step 标为 `failed`，`error_message`/`reason` 含 `interrupted`（可同时清空/作废 lease）。  
- 多实例上线前必须先加 lease；上线后改为仅 interrupt `lease_owner != 本实例 OR lease_until 过期/NULL`。  
- **禁止**用 `lease_owner=本实例` 判定 orphan；**禁止**在无 lease 的多实例部署上盲目全量 interrupt。

### 3.7 API

```
GET  /api/daily-cron/runs?userId&days=7
GET  /api/daily-cron/runs/:runId?userId
POST /api/daily-cron/runs/:runId/rerun
     body: { userId, mode: 'all_current'|'failed_snapshot', stepId?, comboKey? }
```

- Owner mismatch → 404（不暴露存在性）或 403；测试两者择一并写死为 **404**。  
- Idempotency lock：`(userId, parent_run_id, mode)` 15s。  
- Response sanitize 全树。  
- **`/api/tasks` 与 `taskQueue.js`：零 diff。**

### 3.8 Frontend

- `Header.tsx`：文案「后台任务」；pendingCount = tasks pending/running **+** cron runs running（当前 user）。  
- `GlobalTaskCenter.tsx`：标题「后台任务中心」；DailyCron 专用卡/详情；**禁止**把 cron 结果塞进现有 `TaskItem` 的 materials/video 完成副作用分支。  
- `TaskContext.tsx`：并行拉取 cron list；独立轮询 `/api/daily-cron/runs/:id`；合并排序仅用于展示数组。  
- 入参：friendly 默认 + technical 展开；sensitive 默认折叠。  
- 重跑确认文案区分「当前入参」vs「原始快照」。  
- GSAP：`@gsap/react` useGSAP + scope；prefers-reduced-motion。

### 3.9 Input source fields

name, value, valuePreview, sensitive, friendlyDescription,  
technicalDetails{ sourceType, sourceRef, queryRule, transform, fallback }

如实记录代码真相（含 vocabulary 无 user_id 过滤、flaw slice(-50)）。

## 4. Identity ADR（§5）

- **Decision:** v1 使用与现网 daily-pack 一致的 **client-declared `userId` 租户过滤**（非抗伪造认证）。  
- **Wording:** 规格中的「当前登录用户」= 前端声明并经服务端按该 id 过滤的用户；**不宣称**强身份认证。  
- **Why:** 升 G-ID/session 超出本需求范围。  
- **Consequence:** 能读 localStorage 的攻击者可冒充；与现有 `/api/daily-pack/*` 同级风险；不新增跨用户默认列表。  
- **Follow-up:** 未来可信 principal 可替换过滤源，表结构保留 `user_id`。

## 5. Implementation Steps

1. DB + dailyCronRunService（sanitize, retention, interrupt, audit_health）  
2. cron_tick_id + per-user run 物化；instrument pack/flaw；short-circuit skipped 树  
3. Long-article Cron adapter（await extract；禁 detached TTS）  
4. Listen stitch + single owner  
5. APIs + snapshot/current executors + idempotency  
6. Frontend merge UI（零 taskQueue diff）  
7. Tests（test-spec）+ docs sync（旧 non-goal、用户手册命名）

## 6. Non-goals

- 不改 02:00；无自动重试；无导出；无管理员跨用户；不修 continue-skip-long-article；不加 G-ID。

## 7. ADR

- **Decision:** Option A — independent SQLite cron-run ledger + write-time per-user runs + `cron_tick_id` Pack/Listen stitch + Cron-only extract await + declared-userId tenant filter + `audit_health`.  
- **Drivers:** (1) 7-day visibility; (2) input value + provenance + dual rerun semantics; (3) no cross-user PII in API.  
- **Alternatives considered:** B extend taskQueue TTL; C separate ops page; full durable-execution-core rewrite (deferred — out of scope / too invasive).  
- **Why chosen:** Only A meets Drivers without changing unrelated task TTL or abandoning the queue entrypoint.  
- **Consequences:** Necessary related changes on Cron extract/Listen paths; v1 single-instance; soft identity same as daily-pack; two FE list sources.  
- **Follow-ups:** Multi-instance lease; optional G-ID principal; optional global tick metadata row; separate story to fix pack-continue skipping long articles.

## 8. Staffing / Goal-Mode

### Available agent types

implementer/executor, explorer, shell, code-reviewer, verifier, ultragoal-leader, team-worker

### Recommended lanes

| Lane | Focus | Reasoning |
|------|-------|-----------|
| BE | dailyCronRunService, instrument, APIs, snapshot executors | high |
| FE | Header, TaskContext, GlobalTaskCenter, cards | medium |
| QA | test-spec automation + written E2E | medium |

- **Default:** `$ultragoal` sequential goals = Implementation Steps 1–7  
- **Parallel:** `$ultragoal` + `$team` (BE/FE/QA); Ultragoal owns ledger  
- **Ralph:** explicit single-owner fallback only  

### Team launch hint

```text
$team implement .omx/plans/prd-daily-cron-task-logs.md
  BE: service+instrument+API
  FE: Header/TaskContext/GlobalTaskCenter
  QA: test-spec
```

### Team verification path（关闭前必证）

1. **I-reg**：`taskQueue.js` / `/api/tasks*` 行为零回归  
2. **E-H / I2–I3**：跨用户不可见/不可重跑  
3. **E-E / U1**：无 Key/Bearer  
4. Ultragoal checkpoints Steps 1–7 with QA evidence  

### Goal-Mode Follow-up Suggestions

- `$ultragoal` — **default** durable execution  
- `$team` — parallel BE/FE/QA under Ultragoal  
- `$ralph` — only if user insists on persistent single-owner loop  
- Not applicable: `$autoresearch-goal`, `$performance-goal`

## 9. AC → Test map (1–17)

| AC | Tests |
|----|-------|
| 1 | E-A |
| 2 | E-A, I-stitch |
| 3 | E-A, E-B |
| 4 | E-B, I9 |
| 5 | U1, E-E, Security |
| 6 | Security, E-E |
| 7 | U5, I7, E-F |
| 8 | I8, E-F |
| 9 | I4, E-C, U-snap |
| 10 | I5, E-D |
| 11 | I4, I6 |
| 12 | I-reg, E-G |
| 13 | E-J |
| 14 | E-K, E-GSAP |
| 15 | I2, I3, E-H, U6 |
| 16 | U4, E-I |
| 17 | I-rerun-scope, E-D |

## 10. Changelog

- R1 Planner draft  
- **R2** Architect ITERATE absorption  
- **R3** Architect R2 remaining contracts  
- **R4** Critic APPROVE merge: Options pros/cons, ADR 六字段, AC map, staffing/verification, listen-only denominator already in R3+
*** End Patch
