# Deep Interview Spec: GT-CASE-01 驭心博弈刷新后案例多样性

## Metadata

| Field | Value |
|-------|--------|
| Profile | standard |
| Rounds | 8 |
| Final ambiguity | 0.103（threshold 0.20） |
| Context type | brownfield |
| Context snapshot | `.omx/context/gt-case-01-refresh-diversity-20260817T130200Z.md` |
| Transcript | `.omx/interviews/gt-case-01-refresh-diversity-20260817T133500Z.md` |
| PRD | `.omx/plans/prd-gt-case-01-refresh-diversity.md` |
| Prompt-safe summary | not_needed |

## Clarity breakdown

| Dimension | Score | Notes |
|-----------|-------|--------|
| Intent | 0.92 | 训练重复感：刷新/换一条后不要总停在那几个固定案例 |
| Outcome | 0.92 | 成功路径主文案不是 5 条 `PRESET_CASES`；换一条也要新 |
| Scope | 0.93 | 仅 GT-CASE-01；列表不重做；不碰 CASE-02 / YML / 任务中心 / FALLBACK 扩池 |
| Constraints | 0.82 | 可先闪预设再后台替换；每次点开该 Tab 都推；草稿默认静默覆盖 |
| Success | 0.82 | 成功路径硬卡；失败路径 OMX 自定 |
| Context | 0.92 | 对齐现有 `push` / `extraCases` / 5 预设 / 库表不水合 |

## Intent

消除「驭心博弈 → 高管斗争案例研判」里案例不新鲜的失败感：用户点「换一条」或重新刷新清除后，主案例仍是那几个写死预设，无法持续练到不同局。

## Desired Outcome

1. **换一条：** 连续更换后，主案例与进入时那批不完全相同。
2. **硬刷新 / 清缓存后再进：** 允许先闪 5 条预设，但成功推送后主文案必须不是那 5 条之一。
3. **每次点开该 Tab：** 自动再推并替换主文案（默认同「换一条」：静默清空四维）。
4. **列表形态本轮不作为验收面**（不强制从 `game_theory_cases` 水合、不重做左侧卡片）。

## In-Scope

- 复用 `GET /api/game-theory/cases/push` 与现有 `refreshPushedCase` / exclude / 本地轮换。
- 「高管斗争案例研判」Tab 每次变为可见时触发一次自动推送（含模块首次进入、硬刷新后首次点开、从其他博弈 Tab 切回来）。
- 成功路径：主文案 `caseText` 不得等于 5 条 `PRESET_CASES` 的 `description`。
- 保留现有「换一条」按钮行为，并满足连续 5 次与初始集合不完全相同。
- 更新/对齐 `GT-CASE-01` 验收口径。

## Out-of-Scope / Non-goals

- 不改 **GT-CASE-02**（400 字 / 多方角色 / 研判四节）。
- 不改案例列表 UI：不强制从库水合、不重做左侧卡片。
- 不改线上 Dify 工作流 YML，只复用现有 push。
- 「换一条」/进页替换 **不** 改走任务中心异步。
- 不扩大 `FALLBACK_CASES` 种子库。
- 不改驭人术 / 沙盘 / 会话 / 升维（Round 1）。
- 不把历史推送列表做成跨会话权威面（列表可后定）。

## Decision Boundaries（OMX 可不经再确认自行决定）

| 项 | 决议 |
|----|------|
| 自动推送触发 | 每次点开「高管斗争案例研判」Tab |
| 脏数据 | 默认静默替换并清空四维（与现「换一条」成功后一致） |
| 首屏 | 允许先闪预设，再后台替换；loading 文案/时长自定 |
| 失败路径 | 执行侧自定（可保留本地轮换/提示）；**不**因此扩大 FALLBACK |
| 环境切换是否自动推 | 自定；建议随当前 `activeEnv` 再推，避免正文与环境不一致 |
| exclude 集合 | 自定；须保证成功路径不是那 5 条预设 description |
| 是否把自动推送结果写入 `extraCases` | 自定；不得变成列表重设计 |

**仍禁止擅自做的：** 改 Dify YML、扩 FALLBACK、改 CASE-02、列表水合/重做卡片、改走任务中心。

## Constraints

- 优先复用 `pushGameTheoryCase`、`gameTheoryCasePushService`、`refreshPushedCase`。
- 前端 5 条 `PRESET_CASES` 可保留作瞬间占位，但不能作为成功路径的停留态。
- `extraCases` 仍是会话内存；硬刷新丢失可接受，靠进 Tab 再推补新鲜度。
- 不新增依赖。

## Testable acceptance criteria

1. 顶栏 → 驭心博弈 → 高管斗争案例研判：推送成功后，右侧主文案 **不是**「被稀释权力的常务副局长 / 派系夹缝中的合规审查 / 甩锅大区VP的会场狙击 / 核心资产重组被夺功 / 直属总监的压制与边缘化」任一条原文。
2. 记录进入时 3 个可见标题；连续点「换一条」5 次（成功）；新主文案与初始集合不完全相同。
3. Ctrl+Shift+R 后再进该 Tab，等待推送结束（成功）：主文案仍不是上述 5 条预设原文。
4. 在该 Tab 填一点四维 → 切到「驭人术」→ 再切回：成功路径下主文案被替换、四维被清空（默认静默）。
5. 失败路径不作为本轮否决项；成功路径不得用「仍显示那 5 条」交差。

## Assumptions exposed + resolutions

| 假设 | 决议 |
|------|------|
| 痛点主要是列表永远那 5 条 | 否；验收面是 **主文案**，列表可后定 |
| 硬刷新必须恢复历史推送 | 否；再推一条即可 |
| 每次进页都同步挡在 Dify | 否；可先闪预设 |
| 切 Tab 回来应保护草稿 | 否；默认静默覆盖 |
| 冻结表「exclude+轮换已修」已满足 7.22 | 否；那只改善会话内换一条，不满足硬刷新后主文案 |

## Pressure-pass findings

Round 2 的「硬刷新也要新」被 Round 3 收成「自动再推主文案」；Round 4 接受闪预设。未把「从库水合列表」纳入范围。

## Brownfield evidence vs inference

- `[from-code][auto-confirmed]` 5 条 `PRESET_CASES`；`extraCases` 不持久化；push 已存在；FALLBACK 仅 2 条 `corp_clash`；进页不读 `game_theory_cases`。
- `[from-code]` 冻结表称 GT-CASE-01 本地已修：与「清缓存后不是永远那几个预设」不完全等价（已由用户裁定要修硬刷新主文案）。

## Docs / Terminology Ledger

| 用户用语 | 仓内对应 |
|----------|----------|
| 驭心博弈 | 顶栏 `gametheory` / `GameTheoryModule` |
| 刷新 / 换一条 | 按钮「换一条」→ `refreshPushedCase` → `GET /api/game-theory/cases/push` |
| 重新刷新清除 | 浏览器硬刷新 / 清缓存；`extraCases` 丢失 |
| 那几个 | 前端 5 条 `PRESET_CASES` |
| 推送案例 | 右侧主文案 `caseText`，不是对局历史 |

**Inspected:** `AGENTS.md`、`7.22日反馈.md`、`test_cases_7.21_7.22_feedback.md` GT-CASE-01、`test_report.md`、`docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`、`docs/superpowers/specs/2026-08-16-gt-case-02-case-quality-design.md`、`.omx/specs/deep-interview-p1-5-game-theory-export-cases.md`。

## Optional durable-doc follow-ups（opt-in，未自动写入）

- 更新冻结表：GT-CASE-01 从「本地已修待部署」改为「主文案进 Tab 必推，成功路径离开 5 预设」。
- 仅在用户明确要求时改 `docs/`。

## Technical context findings

- 自动推送应挂在 `activeTab === 'cases'` 变为可见时，复用现有 push，避免并行重复请求（`casePushLoading`）。
- 成功判定建议：`PRESET_CASES.every(c => c.description !== caseText)`。
- 失败时现码 `applyLocalRotate()` 会回到预设池；本轮允许，因失败路径 OMX 自定。
