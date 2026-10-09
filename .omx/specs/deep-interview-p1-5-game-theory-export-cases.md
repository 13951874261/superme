# Deep Interview Spec: P1-5 博弈板块导出慢 + 案例/对局沉淀

## Metadata

| Field | Value |
|-------|--------|
| Profile | standard |
| Rounds | 12 |
| Final ambiguity | ~0.10 (threshold 0.20) |
| Context type | brownfield |
| Context snapshot | `.omx/context/p1-5-game-theory-export-cases-20260723T081325Z.md` |
| Transcript | `.omx/interviews/p1-5-game-theory-export-cases-20260723T085216Z.md` |
| Prompt-safe summary | not_needed |

## Clarity breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.90 | 双目标：异步体验 + 对局历史沉淀 |
| Outcome | 0.92 | 历史 Tab 为结果权威面 |
| Scope | 0.90 | 异步复用 taskQueue；预设保留 |
| Constraints | 0.85 | 不造轮子；窄自治需拍板处已问完关键项 |
| Success | 0.88 | 见验收标准 |
| Context | 0.92 | 对齐现有 analyze / prototypes / taskQueue |

## Intent

消除两件事的失败感：（1）研判/对战长时间停在假「导出…」像卡死；（2）训练没有可回看的对局沉淀（刷新后仍只有教学预设）。

## Desired Outcome

1. 提交后明确引导去**任务中心**；后台用现有 `taskQueue` 跑 Dify（仍可 blocking 调现有工作流）。
2. 完成后：若用户仍在博弈模块 → **自动切到「对局历史」Tab 并高亮新条目**；提交页不再内嵌完整报告。
3. 若用户已离开 → 在任务中心点任务 → **直达「对局历史」Tab 并高亮**；任务中心不渲染完整报告。
4. 保留前端 5 个 `PRESET_CASES`；新增独立 Tab 展示历史。
5. 「案例研判」与「人机对战」成功均入库，用 `source_type` 区分。

## In-Scope

- 去掉两处假进度条（案例研判 `handleStartSimulation`、人机对战 `handleSimBattle` 同类逻辑）
- `/api/game-theory/analyze` 改为先返回 `taskId`，后台执行（复用 `taskQueue`），完成后写历史表 + 更新任务 result（供跳转用的 historyId）
- 扩展 `TaskContext`/`TaskItem.type` 支持博弈任务类型（如 `game_theory`）
- 新 Tab「对局历史」+ `GET` 历史列表 API
- 列表项：时间、类型标签、标题、分数、成败、`suggestion` 前 40 字、`causal_chain` 前 2 步；可点开看完整结果
- 提交瞬间 UI 文案明确「请到任务中心查看进度」
- 完成后模块内自动切 Tab + 高亮；任务中心 completed 点击跳转历史

## Out-of-Scope / Non-goals

- 不改 Dify Workflow / Prompt
- 不把 5 个预设迁数据库
- 不做案例/历史完整后台 CRUD 管理页
- 不做 UI 大改版（仅加 Tab、异步提示、高亮）
- 不做 Dify streaming 真实节点进度（仅粗粒度 progress/logs）
- 不新建与现有冲突的 `async_tasks` 表或重复 `/api/tasks/:id` 实现

## Decision Boundaries

**用户已声明：表结构命名、任务文案、落点、摘要均需拍板。** 访谈中已拍板：

| 项 | 决议 |
|----|------|
| 历史落点 | 独立 Tab「对局历史」 |
| 列表信息密度 | 完整预览（含因果链前 2 步） |
| 完成后停留用户 | 自动切历史 Tab + 高亮；本页不内嵌完整报告 |
| 任务中心点击 | 直达历史 Tab + 高亮；中心不渲染完整报告 |
| 异步方案 | taskQueue + 明确告知任务中心 |

**执行前仍建议一次确认的「拟定默认」（若不同意再改）：**

| 项 | 拟定默认 |
|----|----------|
| 表名 | `game_theory_history` |
| 关键字段 | `id, user_id, source_type ('case_analysis'\|'simulation'), title, scene_type, game_model, score, is_success, suggestion, causal_chain_json, full_result_json, created_at` |
| task.type | `game_theory` |
| 任务名 | `博弈研判: {title截断}` / `人机对战: {对手名}` |
| progress/logs | 10 已提交 → 40 连接模型 → 80 解析结果 → 100 已写入历史 |
| 高亮方式 | URL/state 带 `historyId`，目标行边框/背景强调 3–5s |

## Constraints

- 优先复用 `vocab-server/services/taskQueue.js`、`GET /api/tasks/:taskId`、`TaskContext`
- 最小 diff；不改无关模块
- 中文 UI 文案
- 后端仍对 Dify 使用 `response_mode: 'blocking'`（在异步任务内）

## Testable acceptance criteria

1. 点击案例研判或人机对战提交后：假五步进度消失；出现明确文案引导任务中心；立即返回可交互（可切 Tab）。
2. 任务中心出现 `game_theory` 类任务，状态 pending→running→completed/failed。
3. 成功后刷新页面：「对局历史」Tab 仍可见该条；预设案例 Tab 仍为原 5 条。
4. 停留模块直至完成：自动进入「对局历史」并高亮新条；原提交 Tab 无完整报告内嵌。
5. 离开后再点任务中心该任务：进入博弈模块「对局历史」并高亮；任务中心无完整报告体。
6. 历史列表每条可见：时间、类型、标题、分数、成败、建议截断、因果链前 2 步。
7. 案例研判与人机对战各成功一次 → 历史至少 2 条且类型标签不同。

## Assumptions exposed + resolutions

| Assumption | Resolution |
|------------|------------|
| 「案例不变」= 缺动态案例库 | 否 → 要的是独立对局历史，预设保留 |
| 假进度拖慢墙钟时间 | 否 → 仅感知问题；真耗时在 Dify |
| 需新建 async_tasks | 否 → 复用 taskQueue |
| Round 5 本页出报告 | 被 Round 11 覆盖 → 历史 Tab 为权威面 |

## Pressure-pass findings

- 回访 Round 5 + Round 9：用户选择完成后**跳历史 Tab**，放弃「提交页内嵌完整报告」。
- 任务中心定位为**跳转器**，不是第二报告阅读器。

## Brownfield evidence vs inference

- **Evidence:** blocking analyze；`PRESET_CASES`；`personal_prototypes` 动态；`taskQueue`/`TaskContext` 已有；设计文档案例库=预设。
- **Inference:** 扩展 `TaskItem.type` 为执行所必需；历史表为新持久化面（现库无对局历史表）。

## Docs / Terminology Ledger

| Term | Canonical meaning |
|------|-------------------|
| 案例库 | 教学预设（`PRESET_CASES`），本轮不迁库 |
| 对局历史 | 用户研判/对战成功记录，新独立 Tab |
| 人性原型档案 | 已有动态实体，本轮不改其主流程 |
| 导出… | UI 假进度文案，实际为 Dify 研判 |
| 任务中心 | GlobalTaskCenter / TaskContext |

Inspected: `AGENTS.md`, `docs/superpowers/specs/2026-06-12-game-theory-redesign-design.md`, prior P0-2 context.

## Scenario / edge-case

- 停留完成 → 切历史高亮（Round 11 C）
- 离开后点任务 → 直达历史高亮（Round 12 B）
- 失败任务：不写历史；任务中心显示 failed + error（拟定，执行时可确认）

## Optional durable-doc updates (opt-in)

- 可将本 spec 摘要补进博弈设计文档「对局历史」小节——**仅当用户明确要求时**再写公开 docs。

## Technical context

- Frontend: `GameTheoryModule.tsx`, `difyAPI.ts`, `TaskContext.tsx`, `GlobalTaskCenter.tsx`
- Backend: `vocab-server/server.js` analyze 路由；`services/taskQueue.js`
- 需路由/状态：从任务中心深链到模块 Tab + `historyId`

## Handoff notes / residual risk

- 低：`TaskItem.type` 联合类型扩展波及 GlobalTaskCenter 展示图标/文案。
- 中：深链「打开博弈模块并切 Tab」依赖现有 App 模块切换机制，实现时需对齐现有导航。
- Round 8 E 下表结构/文案拟定默认已写入 Decision Boundaries，执行开工前请口头确认拟定默认即可。
