# Deep Interview Spec: 洞察(听) 日池预生成（ls-case-daily-pool）

## Metadata

| 项 | 值 |
|----|-----|
| Profile | standard |
| Rounds | 10 |
| Final ambiguity | 0.12 |
| Threshold | 0.20 |
| Context type | brownfield |
| Pressure pass | 完成（R2 Contrarian） |
| Context snapshot | `.omx/context/ls-case-daily-pool-20260823T111200Z.md` |
| Transcript | `.omx/interviews/ls-case-daily-pool-20260823T123000Z.md` |
| Prompt-safe summary | not_needed |

## Clarity Breakdown

| Dimension | Score | 说明 |
|-----------|------:|------|
| Intent | 0.95 | 先消灭进页/刷新的现场 Dify 等待 |
| Outcome | 0.88 | 缓存优先；部分就绪可练；池空只走任务中心补生成 |
| Scope | 0.92 | 洞察(听) 三类日池；4:00 新 cron；每用户每类 10 套；30 天去重 |
| Constraints | 0.82 | 全 cron 用户；可并行；不改 YML / 02:00 包 |
| Success | 0.70 | 见下方可测验收 |
| Context | 0.88 | 现网每次 `POST /api/insight/listen/scenario` 实时打 Dify，无日池 |

**加权歧义（brownfield）:** 0.12

## Intent

洞察(听) 进页和「刷新案例」现在每次现场调用 Dify，用户要等。目标是把英语长文那套「凌晨预生成 → 进页只读缓存 → 未命中才进任务中心」搬过来，当天能秒开、刷新只走已生成池。

## Desired Outcome

1. 每日 **04:00（UTC+8）** 独立 cron，对所有现有 cron 目标用户预生成洞察案例。
2. 每用户 × 三类 × 每天至少 10 套；近 **30 天** 按用户不重复。
3. 当天进页优先展示已生成缓存；刷新只在已生成池内轮换。
4. 池未满也能练（有几套用几套）；刷尽后提交后台补生成，页上保留最后一套，提示「后台生成中，请稍后在任务中心查看」。
5. 进页与刷新 **不** 再同步 blocking 打 Dify。

## In-Scope

- 模块：顶栏 **洞察(听)** 三类 Tab +「刷新案例」。
- 分类：`体制内职场` / `外企职场` / `通用社交`（现网文案是 `体制内` / `外企` / `通用社交`，本轮按原话改 Tab）。
- 新开 **04:00** cron（不并进 02:00）。
- 每用户每类每天 ≥10 套；可并行生成。
- 按用户 30 天去重。
- 进页 / 切 Tab / 刷新：只读当日已就绪缓存。
- 池空或刷尽：`taskQueue` 异步补生成 + 就近/Toast 提醒 + 任务中心可查。
- 生成仍走现有 `insight/listen/scenario` 能力（剧本体裁不变）。

## Out-of-Scope / Non-goals

- 不改驭心博弈案例与 `game_theory_cases`。
- 不改英语长文 / 精听 / 02:00 DailyPack 任务本身。
- 不改 Dify 工作流 YML。
- 不做 LS-CASE-02 的 8–10 分钟时长/博弈门禁升级。
- 不改侧写表单、点评引擎、导图导出。
- 不把洞察案例改成英语 Dashboard 叙事长文。
- 不新造第二套任务队列（复用 `taskQueue` + `GlobalTaskCenter` + `notifyBackgroundHandoff`）。

## Decision Boundaries（可不经再确认）

- 并行度、批次、超时与失败重试次数。
- SQLite 表结构、索引、保留策略（与 30 天窗口对齐即可）。
- 去重指纹算法（须按用户、按分类、30 天；具体 hash/标题/摘要由实现自定）。
- 任务类型名、任务中心文案细节（须含「后台生成中 / 请稍后 / 任务中心」语义）。
- 空池（0/10）UI：空态 + 任务中心进行中，不现场打 Dify。
- 是否把 4:00 跑批本身登记为一条 cron 任务（建议登记，便于任务中心看到预生成进度）。

**仍须确认才可改的：** 把 cron 改回 02:00、把每类 10 套降到更少、取消 30 天去重、改回同步打 Dify、改 Dify YML、动博弈/英语包。

## Constraints

- 复用现有 cron 选人（`listCronTargetUsers` 一类）、`insightScenarioScript`、`taskQueue`、任务中心 handoff。
- 4:00 与 02:00 错开，避免抢同一批 Dify。
- 全 cron 用户 × 30 套/天：必须可并行，且进页不堵。
- 最小改动：只动洞察案例供给链路。

## Testable Acceptance Criteria

| ID | 菜单路径 | 数据 | 预期 | 对应需求 |
|----|----------|------|------|----------|
| LS-POOL-01 | 洞察(听) → 体制内职场（当日 4:00 已跑完） | 该用户该类 ≥10 套 ready | 进页 ≤1s 出第 1 套，无 Dify 等待 | 缓存优先 |
| LS-POOL-02 | 同一 Tab 连点「刷新案例」10 次 | 当日 10 套缓存 | 10 套互不相同，且只来自当日池 | 刷新只走缓存 |
| LS-POOL-03 | 连续 2 天同一用户同一类 | 昨日 + 今日各 10 套 | 标题/指纹与近 30 天已用集合不重复 | 30 天去重 |
| LS-POOL-04 | 8:00 进页，该类仅 4/10 ready | 部分缓存 | 立刻显示已就绪套；刷新只在 4 套内；任务中心仍见预生成/补齐 | 部分就绪可练 |
| LS-POOL-05 | 4 套刷尽后再点刷新 | 池空 | 页留第 4 套；提示后台生成中、可去任务中心；不出现同步 Dify 等待；任务完成后刷新能取到新套 | 刷尽补生成 |
| LS-POOL-06 | 4:00 未开始或 0/10 | 空池 | 空态 + 任务中心可查；进页不现场打 Dify | 空池不堵 |
| LS-POOL-07 | 顶栏任务中心 | 4:00 跑批或补生成任务 | 能看到进度/日志；文案含稍后查看语义 | 任务中心可追 |
| LS-POOL-08 | 外企职场 / 通用社交 | 与体制内相同条件 | 三类独立池，互不串套 | 三类各 ≥10 |

**对抗：** 狂点刷新不得并行打出多个同步 Dify；补生成失败须在任务中心可见且页上不白屏；02:00 英语包不受影响。

## Assumptions + Resolutions

| 假设 | 决议 |
|------|------|
| 「长文」= 改成英语阅读文章 | **否**。只借供给模型 |
| 每类 3 套即可 | **否**。硬性 ≥10 |
| 全站共享 10 套 | **否**。按用户各 10 |
| 挂 02:00 即可 | **否**。独立 4:00 |
| 刷尽就现场打 Dify | **否**。只异步进任务中心 |
| Tab 保持旧文案 | 未列入非目标，按原话改为「体制内职场 / 外企职场」 |

## Pressure-pass Findings

R2 压测「只修慢、每类 3 套、挂 02:00」被否。本轮不能把 10 套当成软指标。

## Brownfield Evidence vs Inference

- **[from-code][auto-confirmed]** `ListenModule.loadNewScenario` → `POST /api/insight/listen/scenario` 每次实时 Dify；无日池、无 exclude。
- **[from-code][auto-confirmed]** 现网 cron 窗口 02:00–02:15，不含洞察案例。
- **[from-code][auto-confirmed]** 英语长文/精听已有预生成 + `listen_backfill` + 任务中心。
- **[from-user]** 供给模型对齐长文，体裁不改剧本。
- **[inference]** 4:00 跑批应在任务中心可见（用户原话要求可在任务中心查看）。

## Docs / Terminology Ledger

| 用户用语 | 仓库用语 | 本轮含义 |
|----------|----------|----------|
| 长文 | 英语 Dashboard 长文 | **只指供给模型**，不是阅读文章 |
| 案例 | 洞察 scenario / 四幕剧本 | 保持现有剧本 |
| 体制内职场 / 外企职场 | Tab `体制内` / `外企` | 改 Tab 文案对齐用户原话 |
| 任务中心 | `GlobalTaskCenter` / `taskQueue` | 复用，不新建 |
| 4:00 | 现网 02:00 cron | **新开** 4:00，不合并 |

已读：`AGENTS.md`、daily-pack / listen-pregenerate 设计、LS-CASE-02 PRD（本轮不实施其时长门禁）。

## Scenario / Edge Findings

- 4/10 部分就绪：可练，刷新不越出已就绪集合。
- 刷尽：异步补 1 套（或一批），页不换、不阻塞。
- 全 cron 用户 × 30 套：必须并行，允许上班后仍在补，进页不堵。

## Optional Durable Docs（opt-in，不自动写）

若后续要落设计文档，可新增 `docs/superpowers/specs/` 下洞察日池一篇。需你明确点头才写。

## Technical Context

优先复用：

- 生成：`insightScenarioScript` + `POST /api/insight/listen/scenario`（改为内部调用，供 cron/backfill，不给进页同步用）。
- 定时：仿 `dailyPackCron`，**新窗口 04:00**。
- 选人：现有 cron 目标用户。
- 未命中：仿 `listen_backfill` → `taskQueue`。
- 前端：`ListenModule` 改为 GET 当日池 + 游标刷新；handoff 用 `notifyBackgroundHandoff`。

建议最小新表（实现可调）：`insight_daily_cases(user_id, pack_date, category, case_id, fingerprint, draft_json, status, created_at)` + 30 天指纹查询。

## Residual Risk

无（阈值下收敛，非提前退出）。规模风险：用户数上升时 4:00 可能跑不完 30 套/人——已用「部分就绪可练 + 任务中心补」兜住。

## Handoff

本文件是需求源。deep-interview **不实施**。下游须守住：10 套/类/用户、4:00、30 天去重、进页不同步 Dify、非目标列表。
