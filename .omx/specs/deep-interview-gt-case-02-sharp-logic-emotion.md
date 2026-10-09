# Deep Interview Spec: GT-CASE-02 案例详实尖锐、研判有逻辑情感

## Metadata

| Field | Value |
|-------|--------|
| Profile | standard |
| Rounds | 6 |
| Final ambiguity | 0.11（threshold 0.20） |
| Context type | brownfield |
| Context snapshot | `.omx/context/gt-case-02-sharp-logic-emotion-20260817T134500Z.md` |
| Transcript | `.omx/interviews/gt-case-02-sharp-logic-emotion-20260817T141200Z.md` |
| PRD | `.omx/plans/prd-gt-case-02-sharp-logic-emotion.md` |
| Prompt-safe summary | not_needed |

## Clarity breakdown

| Dimension | Score | Notes |
|-----------|-------|--------|
| Intent | 0.92 | 字数不够；要密度，凑字空话不算过 |
| Outcome | 0.90 | 案例四信号 + 研判四硬卡；双边都进本 PRD |
| Scope | 0.92 | 只打高管斗争案例研判；不扩其他 Tab |
| Constraints | 0.85 | 不改 Dify YML；不合格拒收；无合格稿不展示短 PRESET |
| Success | 0.78 | 夹具锁行为；词表 OMX 可微调 |
| Context | 0.88 | 复用 push/analyze/`gtCaseQuality`；覆盖旧「标红仍展示」 |

## Intent

消除「驭心博弈 → 高管斗争案例研判」里两类失败感：（1）推送案例过简、角色两标签、不像可借鉴的真实局；（2）提交后的 AI 研判机械单薄，没有利益输赢与情绪。已落地的 400 字 / 四节 ≥600 **只是下限**，不能当成功定义。

## Desired Outcome

1. **案例：** 成功进入右侧主文案的必须同时满足字数下限 **与** 密度四信号（具名多方张力、具体场合/时限、不完整信息、选边即伤的决策点）。
2. **研判：** 成功写入对局历史的必须同时满足四节非空且合计 ≥600 **与** 密度四硬卡（输赢、情绪锚点、可执行下一步、可出口话术）。
3. **不合格：** 不进主文案、不写历史。主文案保留上一篇合格稿；没有则只显示推送中/请再推，永不 5 条短 `PRESET_CASES`。

## In-Scope

- 仅「高管斗争案例研判」Tab 的 **push 案例** 与 **analyze 研判**。
- 扩展现有 `gtCaseQuality` / `evaluateCasePushQuality` / `evaluateVerdictSectionsQuality` 为 **双硬卡**（字数 ∧ 密度）。
- 服务端 prompt 注入（不改 Dify YML）要求尖锐/情绪/可执行，禁止套话凑字。
- 前端：合格前锁定提交；不合格推送不覆盖合格稿；无合格稿不渲染短 PRESET 正文。
- 后端：密度失败的 analyze **不 INSERT** `game_theory_history`，任务 `failed`，可重试。
- 黄金夹具单测锁过/不过。
- 对齐并更新 `GT-CASE-02` 验收口径。

## Out-of-Scope / Non-goals

- 不改 **GT-CASE-01**（换一条/硬刷新新鲜度）。但本 PRD **覆盖** CASE-01「可先闪短预设」：短 PRESET 不得作为主文案（含占位）。
- 不在本项做 **GT-SIM-02**「原话 \| 问题 \| 建议说法」对比表。
- 不改线上 Dify 工作流 YML。
- 不改四维拆解表单字段名。
- 不改驭人术 / 人机沙盘 / 会话 / 升维。
- 不做二次 LLM 评审打分。
- 不自动静默重试 Dify（用户选拒收 + 手动再推/再提交）。
- 不把密度失败稿标红后仍当作可读成功态（覆盖旧 design「不足降级标红仍展示」）。

## Decision Boundaries（OMX 可不经再确认自行决定）

| 项 | 决议 |
|----|------|
| 密度启发式词表/正则/阈值 | 自定，**验收锁夹具**，不得把空话夹具判 `ok` |
| 提示文案 | 「推送中…」「未达尖锐标准，请再推」等措辞自定 |
| 任务失败错误文案 | 自定，须能区分字数失败 vs 密度失败 |
| 上一篇合格稿的存储 | 会话内存即可；硬刷新后按「无合格稿」走 loading/请再推 |
| 现有 FALLBACK | 若已过新双硬卡，Dify 失败时可用作合格稿；不过则允许 **改写至合格**，不新增大规模种子库 |
| `ensureGameTheoryVerdictSections` 系统垫字 | 可保留作解析补洞，但 **不能** 把 `quality` 改成 `ok`，也不能因此写入历史 |
| 前端是否同步再跑一遍密度 | 建议双端一致；实现自定 |
| 与 CASE-01 自动进 Tab 再推 | 保留自动推送；成功才替换主文案；失败保留上一篇合格稿 |

**仍禁止擅自做的：** 改 Dify YML、二次打分、短 PRESET 进主文案、失败稿入历史、扩到其他 Tab、做 SIM-02 对比表、改四维字段名。

## Constraints

- 优先复用 `pushGameTheoryCase`、`gtCaseQuality`、`gameTheoryVerdictGuard`、任务中心 analyze。
- 不新增依赖。
- 字数下限保持冻结表：`background` 去空白 ≥400；四节去空白合计 ≥600；`incomplete_info` / `decision_point` ≥20。
- 密度是 **额外硬卡**，不是替代字数。

## Testable acceptance criteria

1. 夹具「≥400 字套话 + 董事长/CEO/VP」→ 案例 `below_standard`，主文案 **不变**（有合格稿则保留；无则非 PRESET）。
2. 夹具「合格尖锐局 ≥400」→ `ok`，主文案替换为该稿，可提交。
3. 夹具「四节合计 ≥600 但全是高度重视/统筹兼顾」→ 研判密度失败，任务失败，**不出现**新历史行。
4. 夹具「四节有输赢+面子/恐惧+两步动作+可出口台词且 ≥600」→ 写入历史，展开可见四节。
5. 菜单路径 E2E：驭心博弈 → 高管斗争案例研判 → 换一条 → 填四维 → 提交：成功路径背景详实尖锐、角色不止上司/下属、研判含利益与情绪；失败路径不进框/不入史。

## Assumptions exposed + resolutions

| 假设 | 决议 |
|------|------|
| 400/四节/600 已等于 7.22 质量 | 否；只是下限 |
| 不足标红仍展示可过验收 | 否；本轮改为拒收 |
| 可先闪 5 条短 PRESET | 否；与 CASE-01 闪预设冲突时以本 PRD 为准 |
| 二次模型打分才能判情感 | 否；纯函数密度 + 夹具 |
| 只改案例或只改研判 | 否；两边都做 |

## Pressure-pass findings

Round 2 把「加严」收成双边硬卡；Round 6 把「拒收」收成占位 UX。未把「从库水合列表」或「自动重试」纳入范围。

## Brownfield evidence vs inference

- `[from-code][auto-confirmed]` 现门禁只有字数+职衔计数；`PRESET_CASES` 约 100–150 字；`applyLocalRotate` 失败会回到预设；analyze 在 `ensureGameTheoryVerdictSections` 后仍 INSERT 历史（含 `below_standard`）。
- `[from-code]` 冻结表/旧 design 写「不足降级标红仍展示」；本访谈 **覆盖** 该条。
- `[from-user]` 密度双边硬卡 + 拒收 + 无合格稿不展示短 PRESET。

## Docs / Terminology Ledger

| 用户用语 | 仓内对应 |
|----------|----------|
| 驭心博弈 / 高管斗争案例 | `gametheory` / Tab `cases` |
| 原文背景介绍 | push `background` + 右侧 `caseText` |
| 角色太简单 | 密度「具名多方张力」，不是只数职衔词 |
| 研判机械单薄 | analyze 四节 + 密度四硬卡 |
| 可借鉴 | 尖锐决策点 + 可执行策略 + 可出口话术 |

**Inspected:** `AGENTS.md`、`7.22日反馈.md`、`test_cases_7.21_7.22_feedback.md` GT-CASE-02、冻结表、CASE-02 design/plan、`gtCaseQuality.ts`、`GameTheoryModule.tsx`、`gameTheoryCasePushService.js`、`gameTheoryVerdictGuard.js`、`prd-rd-len-01-read-push-depth.md`、CASE-01 访谈（排除 CASE-02）。

## Optional durable-doc follow-ups（opt-in，未自动写入）

- 更新冻结表 GT-CASE-02：双硬卡 + 拒收，不再写「标红仍展示」。
- 更新测试用例状态说明。仅在用户明确要求时改 `docs/`。

## Technical context findings

- 改 `evaluateCasePushQuality` / `evaluateVerdictSectionsQuality` 与两端副本。
- `refreshPushedCase`：仅 `ok` 才 `setCaseText`；失败不 `applyLocalRotate` 到 PRESET。
- 初始 `caseText` 不得再用 `PRESET_CASES.find(...).description` 作为可提交正文。
- `handleStartSimulation`：当前案例 `quality !== 'ok'` 则禁止提交。
- `server.js` analyze：密度失败则 `taskQueue.updateTask(..., failed)` 且 **跳过** history INSERT。
