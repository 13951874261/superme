# Deep Interview Spec: GT-SIM-02 沙盘研判给策

## Metadata

| Field | Value |
|-------|--------|
| Profile | standard |
| Rounds | 7 |
| Final ambiguity | 0.10（threshold 0.20） |
| Context type | brownfield |
| Context snapshot | `.omx/context/gt-sim-02-strategy-tone-20260817T143400Z.md` |
| Transcript | `.omx/interviews/gt-sim-02-strategy-tone-20260817T144600Z.md` |
| PRD | `.omx/plans/prd-gt-sim-02-strategy-tone.md` |
| Prompt-safe summary | not_needed |

## Clarity breakdown

| Dimension | Score | Notes |
|-----------|-------|--------|
| Intent | 0.94 | 给策必须对着用户当句，不是有表即可 |
| Outcome | 0.90 | 沙盘：利益/情绪 + 独立策略列 + 语气表；会话同硬卡 |
| Scope | 0.92 | 贴当句 = 沙盘+会话；案例复用 CASE-02，不新增策略列 |
| Constraints | 0.88 | 沙盘新入史硬卡；隐藏两节不挡入库；两边拒收 |
| Success | 0.78 | 夹具锁「编制」句必过、泛化兜底必不过 |
| Context | 0.92 | 复用 analyze / `toneCorrections` / 会话 `strategy_guidance` |

## Intent

消除「驭心博弈 → 人机对战沙盘」里「有研判但用不上」：输出机械单薄，没有针对用户当句反应的博弈策略，语气修正停留在泛化兜底。已有独立三列表 **不等于** 合格；必须引用并改写用户原话。多人会话复盘走同一套贴当句硬卡。案例历史不在本项新开给策区块。

## Desired Outcome

1. **沙盘对局历史（`source_type: simulation`）成功态露出：** 利益链、情绪动机、独立「博弈策略示例」列表（`strategy_guidance[]`）、独立语气修正表。隐藏「可执行策略 / 话术示例」。
2. **贴当句：** 策略列与语气表的原话/建议说法必须引用并改写用户当句应对（验收句：`你没资格过问我的编制。`）。
3. **会话个人复盘：** 已有 `strategy_guidance` + 语气表必须同样贴当句；不合格不进入完成态。
4. **案例历史：** 维持 CASE-02 四节 + 已有语气表；不新增策略列；不强制贴对白。
5. **不合格：** 沙盘不入库、任务失败可重试；会话不展示完成复盘、可重新生成。泛化兜底不算过。

## In-Scope

- 人机对战沙盘的 analyze 入史硬卡、历史展开 UI（新列表 + 隐藏两节）。
- 多人/场景会话 `generatePersonalReview` 的贴当句硬卡与失败态。
- 扩展现有 `gtCaseQuality` / `toneCorrections`（前后端镜像），按 `source_type` 分支；不新质量引擎。
- analyze / 会话 prompt **注入**（不改 Dify YML）：策略列与语气表必须引用用户当句。
- 黄金夹具单测锁过/不过。
- 对齐 `GT-SIM-02` 验收口径。

## Out-of-Scope / Non-goals

- 不改线上 Dify 工作流 YML。
- 不改 GT-CASE-02 案例侧四节密度 / 拒收口径。
- 不改四维表单字段名。
- 不做 GT-SIM-01（沙盘从档案库选对手）。
- 不改驭人术 / 顶层认知升维。
- 不做二次 LLM 质量打分。
- 不把泛化语气兜底当沙盘（或会话）合格。
- 不在案例历史新增策略列。
- 不回改 CASE-01 新鲜度策略。

## Decision Boundaries（OMX 可不经再确认自行决定）

| 项 | 决议 |
|----|------|
| 贴当句启发式 | 自定（子串/去前缀/最短跨度），**验收锁夹具**，不得把泛化兜底判 `ok` |
| `strategy_guidance` 条数下限 | 自定，夹具须体现「至少能看出可执行给策」 |
| 失败文案 | 自定，须能区分「未贴当句」与 CASE-02 四节失败 |
| 会话引用哪一句 | 默认最近一条非空 `user_input` |
| original 是否用用户原话补位 | 允许补 `original`，但 **suggested / guidance 仍须改写该句**，否则拒收 |
| 利益链/情绪动机在沙盘的字数 | 可低于四节合计 600；须非空且过输赢/情绪密度，词表可微调 |
| 沙盘 `full_result.strategy_guidance` 字段名 | 与会话对齐 `strategy_guidance`；不要另起第三套名字 |
| 前端隐藏两节 | 仅 `source_type === 'simulation'` 的历史展开 |

**仍禁止擅自做的：** 改 Dify YML、改 CASE-02 案例口径、二次打分、案例历史新策略列、把泛化兜底当合格、扩到驭人术/升维/SIM-01。

## Constraints

- 优先复用 analyze、任务中心、`toneCorrections`、`ToneCorrectionTable`、会话 `strategy_guidance`。
- 不新增依赖。
- 案例 analyze 继续走 CASE-02 `evaluateVerdictSectionsQuality` 全四节硬卡。
- 沙盘 analyze **不再**用「可执行策略 / 话术示例」作为入史条件。
- 不自动静默重试 Dify；用户手动再提交 / 再生成复盘。

## Testable acceptance criteria

1. 夹具：用户应对 `你没资格过问我的编制。` + 策略列与语气表引用并改写该句 + 利益/情绪有密度 → 沙盘 `ok`，历史展开可见新列表与语气表，**看不见**可执行策略/话术示例两节。
2. 夹具：同上应对，但语气表/策略列为「先确认对方关切…」泛化兜底 → 任务失败，**0** 条新沙盘历史。
3. 夹具：给策贴当句合格，但被隐藏两节是套话 → 仍入库（沙盘新硬卡，不走四节全过）。
4. 会话最后一句同为该编制句，复盘未改写 → 不进入复盘完成态，可再点生成。
5. 案例研判历史：仍四节全显 + 已有语气表；无新策略列；CASE-02 夹具行为不变。
6. 菜单 E2E：驭心博弈 → 人机对战沙盘 → 提交偏硬应对 → 任务完成 → 对局历史：有针对该反应的策略示例与语气修正。

## Assumptions exposed + resolutions

| 假设 | 决议 |
|------|------|
| 语气表已存在即 GT-SIM-02 过关 | 否；必须贴当句改写 |
| 三处都要贴对白原话 | 否；案例无对白，不新开策略列 |
| 沙盘继续用 CASE-02 四节入史 | 否；隐藏两节不再挡入库 |
| 新列表与「可执行策略」同时展示 | 否；沙盘历史隐藏后两节 |
| 会话可展示未贴当句的完成复盘 | 否；拒收 |

## Pressure-pass findings

Round 2 把「三处贴原话」收成案例复用 CASE-02；Round 4 把新列表收成「只加一块、藏两节」。未把自动重试或改 YML 纳入范围。

## Brownfield evidence vs inference

- `[from-code][auto-confirmed]` 沙盘与案例共用 analyze；CASE-02 四节密度当前对 simulation 也拒收入库。
- `[from-code][auto-confirmed]` `ToneCorrectionTable` 已挂历史与会话；`buildFallbackToneCorrection` 为泛化句。
- `[from-code][auto-confirmed]` 会话已有 `strategy_guidance[]`；沙盘 `full_result` 尚无同名字段。
- `[from-code][auto-confirmed]` 案例 `user_answer` 是四维拼段，不是对白。
- `[from-user]` 沙盘新硬卡 + 新列表 + 隐藏两节 + 会话同样拒收 + 案例不新开策略列。

## Docs / Terminology Ledger

| 用户用语 | 仓内对应 |
|----------|----------|
| 驭心博弈 / 研判给策 | 验收 ID **GT-SIM-02**；菜单「人机对战沙盘」 |
| 沙盘中 AI 研判 | Tab `simulation` → analyze → 对局历史 |
| 博弈策略示例 | 会话/沙盘 `strategy_guidance[]`（本项沙盘新写入） |
| 语言/语气表达修正 | 独立 `tone_corrections` 三列表，不得并入 guidance |
| 贴当句 | 引用并改写用户当句应对/最近一条 `user_input` |

**Inspected:** `AGENTS.md`、`7.22日反馈.md` 博弈-3、`test_cases_7.21_7.22_feedback.md` GT-SIM-02、冻结表、SIM-02 design/plan、CASE-02 访谈/PRD、`GameTheoryModule.tsx`、`GameTheorySessionPanel.tsx`、`toneCorrections.ts`、`server.js` analyze、`gameTheorySessionService.js`。

## Optional durable-doc follow-ups（opt-in，未自动写入）

- 更新冻结表 GT-SIM-02：贴当句硬卡 + 沙盘新入史规则，不再写「有表即可」。
- 将 `test_cases_7.21_7.22_feedback.md` GT-SIM-02 从「待功能落地后再测」改为可测口径。仅在用户明确要求时改 `docs/`。

## Technical context findings

- `server.js` analyze：按 `normalizedSource` 分支质量函数；simulation 写 `strategy_guidance` 后再判定。
- 禁止 `normalizeToneCorrections` 泛化兜底把沙盘/会话 `quality` 洗成 `ok`。
- `GameTheoryModule` 历史展开：simulation 渲染 guidance + 语气表，跳过 actionable/script。
- `generatePersonalReview`：贴当句失败则不 `phase = review_done`、不成功 `upsertHistory`。
