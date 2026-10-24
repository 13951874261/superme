# PRD：驭心博弈案例详实尖锐、研判有逻辑情感 — GT-CASE-02

> **验收锚点：** `GT-CASE-02`（`test_cases_7.21_7.22_feedback.md`）  
> **模块路径：** 顶栏 → **驭心博弈** → **高管斗争案例研判**  
> **状态：** 终稿 · 已形成（deep-interview 6 轮，ambiguity 0.11）  
> **日期：** 2026-08-17  
> **原始反馈：** 7.22 博弈-1「真实高管斗争案例库：要求原文背景介绍清晰、内容详实、斗争尖锐、可借鉴。现在推送的内容过于简略，角色设置太过于简单，且 AI 的研判机械、单薄、逻辑与情感性都不强」  
> **访谈规格：** `.omx/specs/deep-interview-gt-case-02-sharp-logic-emotion.md`  
> **关联规格：** `docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`（本 PRD **覆盖**其中「不足则降级标红仍展示」）  
> **已确认决策：** 字数只是下限 · 案例+研判双边密度硬卡 · 不合格不进主文案/不写历史 · 无合格稿不展示 5 条短 PRESET · 不改 Dify YML · 不做二次 LLM 打分 · 不改 CASE-01/SIM-02 表/四维字段名/其他 Tab

---

## 1. Executive Summary

### Problem Statement

用户在「高管斗争案例研判」里拿到的推送仍像短摘要（前端 5 条 `PRESET_CASES` 约 100–150 字，角色常停在上司/下属），提交后的 AI 研判像套话，缺少输赢结构与面子/恐惧等情绪，无法当真实局来练。现网 GT-CASE-02 已有 `background`≥400 与四节≥600 的字数门禁，但职衔词堆砌 + 高度重视腔仍可过关，且不足稿会标红后照样进框、进历史。

### Proposed Solution

在现有 push / analyze / `gtCaseQuality` 上升级为 **双硬卡**（字数下限 **且** 密度启发式）。案例必须具备多方张力、具体场合/时限、信息缺口、选边即伤的决策点；研判必须具备输赢、情绪锚点、可执行下一步、可出口话术。不合格 **拒绝进入** 主文案与对局历史；主文案保留上一篇合格稿，没有则只显示推送中/请再推，永不短预设。不改 Dify YML，用服务端 prompt 注入 + 本地夹具。

### Success Criteria

| # | KPI | 度量方式 | 目标值 |
|---|-----|----------|--------|
| 1 | 案例双硬卡 | `evaluateCasePushQuality` | `ok` 当且仅当字数下限 **且** 案例密度四项全过 |
| 2 | 案例空话拦截 | 黄金夹具 F1（≥400 字套话+三职衔） | **100%** `below_standard`，主文案不替换 |
| 3 | 研判双硬卡 | `evaluateVerdictSectionsQuality` | `ok` 当且仅当四节非空、合计≥600 **且** 研判密度四项全过 |
| 4 | 研判空话拦截 | 黄金夹具 F3（≥600 字套话四节） | **100%** 任务失败，**0** 条新历史 |
| 5 | 验收用例 | `GT-CASE-02` | **通过**：背景详实尖锐、角色复杂、研判有利益与情绪 |

---

## 2. User Experience & Functionality

### User Personas

| 角色 | 描述 | 核心诉求 |
|------|------|----------|
| **主用户·训练者** | 用真实感高管局做研判训练 | 看到可借鉴的尖锐局；拿到有逻辑、有情绪、能照着说的研判 |
| **次用户·刚进页者** | 硬刷新后第一次点开该 Tab | 宁可等/再推，也不要再看到那 5 条短预设当正文 |

### User Stories

#### Story 1 — 推送案例必须像一局可练的真事

As a 训练者, I want 换一条之后看到背景清晰、多方拉扯、信息不全、必须当场做痛选择的案例, so that 我能借鉴而不是读摘要。

**Acceptance Criteria：**

- 菜单：驭心博弈 → 高管斗争案例研判 → 「换一条」。
- 成功写入右侧主文案的 `caseText` 必须 `quality === 'ok'`（字数 ∧ 案例密度）。
- 密度四信号全过：≥3 具名角色张力；具体场合或时限；不完整信息；尖锐决策点（选边即伤）。
- 夹具 F1 不得进入主文案。夹具 F2 必须进入主文案。
- 提交按钮在当前主文案非 `ok` 时不可用。

#### Story 2 — AI 研判必须有逻辑与情感

As a 训练者, I want 提交四维之后的研判能讲清谁赢谁输、谁要面子/谁恐惧，并给出可执行步骤和可出口的话, so that 我不是在读正确的废话。

**Acceptance Criteria：**

- 路径：填四维 → 提交研判 → 任务中心完成 → 对局历史展开。
- 成功写入历史的 `full_result` 必须四节（利益链 / 情绪动机 / 可执行策略 / 话术示例）非空、合计去空白 ≥600，且研判密度四项全过。
- 夹具 F3 不得 INSERT 历史。夹具 F4 必须写入并可展开阅读。
- 不做本项的 GT-SIM-02 三列表（即使话术节里可以出现「原话→修正」句子）。

#### Story 3 — 不合格看不见、不入史

As a 训练者, I want 套话稿不要占掉我正在看的合格局、也不要污染对局历史, so that 「有输出」不等于「过关」。

**Acceptance Criteria：**

- 推送返回非 `ok`：不 `setCaseText`；保留上一篇合格稿。
- 没有上一篇合格稿：不渲染 5 条 `PRESET_CASES.description`；只显示推送中或「未达尖锐标准，请再推」。
- 研判非 `ok`：任务 `failed`，可再提交；`game_theory_history` 无新行。
- 不自动静默重试 Dify；用户手动再推 / 再提交。
- API 失败时 **禁止** `applyLocalRotate()` 落到短预设。

### Non-Goals

- 不改 GT-CASE-01 的新鲜度策略（进 Tab 自动推送可保留，但 **成功才替换**）。
- 本 PRD **覆盖** CASE-01「可先闪短预设」：短预设不得当主文案或占位正文。
- 不做 GT-SIM-02 对比表。
- 不改 Dify YML、四维字段名、驭人术/沙盘/会话/升维。
- 不做二次 LLM 打分。
- 不把失败稿标红后仍算可读成功态。

### User Flow

```text
进入「高管斗争案例研判」
        │
        ▼
自动/手动 push
        │
        ▼
   双硬卡？──否──► 保留上一篇合格稿
        │            无合格稿 → 仅提示，禁止提交
        │            用户可再点「换一条」
        是
        ▼
 主文案替换为合格稿，可填四维并提交
        │
        ▼
 任务中心 analyze
        │
        ▼
   双硬卡？──否──► 任务失败，历史不写，可重试
        是
        ▼
 写入对局历史，展开四节
```

---

## 3. AI System Requirements

### Tool Requirements

| 能力 | 用法 |
|------|------|
| 现有 Dify 案例生成工作流 | `GET /api/game-theory/cases/push` 已封装；**不改 YML**，只加长 `generation_request` |
| 现有 Dify 研判工作流 | `runGameTheoryAnalysis` / 任务中心；**不改 YML**，只加长 `case_text` 系统研判指令 |
| 本地 `gtCaseQuality` | 唯一质量裁判；前后端共用规则 |
| 任务中心 | 研判异步；失败可感知、可重试 |

不新增模型、不新增 Dify 应用、不二次评审调用。

### Evaluation Strategy

用黄金夹具锁行为（与 RD-LEN-01 同构：词表可微调，夹具不可破）。

| ID | 夹具 | 期望 |
|----|------|------|
| F1 | `background` 去空白 ≥400，含董事长/CEO/VP，正文以「高度重视、统筹兼顾、综上所述、战略定力、深刻理解」铺陈，无会议时限、无信息缺口、无选边即伤 | 案例 `below_standard`；主文案不替换 |
| F2 | ≥400 字尖锐局：具名 ≥3 方、周一董事会/十分钟发言、缺供应链证据、揭发则失同盟/隐忍则背超支 | 案例 `ok` |
| F3 | 四节各一段套话，合计 ≥600，无输赢、无面子/恐惧、无可执行次序、无可出口台词 | 研判 `below_standard`；不写历史 |
| F4 | 四节合计 ≥600：点名谁赢谁输、写明面子/恐惧、两步会前动作、一句可直接说的话 | 研判 `ok`；可写历史 |
| F5 | `background` 380 字但密度合格 | 案例 `below_standard`（字数失败） |
| F6 | 四节合计 500 字但密度合格 | 研判 `below_standard`（字数失败） |

**Pass rate：** 上表 6 条单测 **100%**。E2E 手工：成功路径满足 `test_cases_7.21_7.22_feedback.md` GT-CASE-02 三条预期。

Prompt 约束（注入，非改 YML）：

- 案例：禁止摘要腔与开场白；必须停在决策点；必须有未知信息；斗争尖锐；至少三方具名角色。
- 研判：禁止高度重视/统筹兼顾腔；每节须有本场锚点（人名/场合/时限）；策略须有先后次序；话术须能说出口。

---

## 4. Technical Specifications

### Architecture Overview

```text
[换一条 / 进 Tab 自动推]
        │
        ▼
GET /api/game-theory/cases/push
  Dify generation_request（加密度要求）
        │
        ▼
evaluateCasePushQuality  ──字数 ∧ 案例密度──► quality
        │
        ├─ ok → 前端 setCaseText + 记 lastGoodCase
        └─ 非 ok / 抛错 → 不改主文案；无 lastGoodCase 则提示；禁止落到 PRESET

[提交四维]
        │
        ▼
POST analyze（任务中心）
  研判指令（加密度要求）
        │
        ▼
ensureGameTheoryVerdictSections（可补洞，不可洗白）
evaluateVerdictSectionsQuality ──字数 ∧ 研判密度──► quality
        │
        ├─ ok → INSERT game_theory_history
        └─ 非 ok → task failed，不 INSERT
```

### 密度启发式（实现可微调词表，验收锁夹具）

扩展 `src/utils/gtCaseQuality.ts` 与 `vocab-server/services/gtCaseQuality.js`，**不要**新质量引擎、不要新依赖。

**案例密度（须全过才可能 `ok`）：**

| 分项 | 通过条件（默认，OMX 可在不破坏夹具下微调） |
|------|------------------------------------------|
| `tensionOk` | 角色线索去重 ≥3（沿用并扩展现职衔词表），**且** 套话命中 <3（`高度重视\|统筹兼顾\|综上所述\|战略定力\|深刻理解`） |
| `occasionOk` | 背景或决策点命中场合/时限（如 `周一\|周五\|今晚\|会议\|董事会\|十分钟\|截止\|会前`） |
| `incompleteOk` | `incomplete_info` 去空白 ≥20（维持现下限） |
| `sharpOk` | `decision_point` 去空白 ≥20，且出现两难/代价信号（如 `若\|否则\|还是\|签还是\|站队\|反噬\|选边`） |

另须：`background` 去空白 ≥400。现「职衔 ≥3」并入 `tensionOk`，单独堆词不够。

**研判密度（须全过才可能 `ok`）：**

| 分项 | 通过条件 |
|------|----------|
| `winLoseOk` | `interest_chain` 含输赢/同盟/裂痕类信号（如 `赢\|输\|同盟\|裂痕\|利益`） |
| `emotionOk` | `emotion_motives` 含情绪锚点（如 `面子\|恐惧\|欲望\|羞辱\|难堪\|怕`） |
| `actionOk` | `actionable_strategy` 含次序/动作（如 `先\|再\|第.+步\|会前\|今晚`） |
| `scriptOk` | `script_examples` 含可出口形态（如 `「」` / `说` / `原话`） |
| 套话否决 | 四节合计套话命中 ≥3 → 密度失败（即使 ≥600） |

`quality === 'ok'` 当且仅当字数门槛与密度分项全过。`quality_note` 拼接失败分项。

### Integration Points

| 点 | 行为 |
|----|------|
| `GET /api/game-theory/cases/push` | 返回 `quality`；前端只在 `ok` 时采用 |
| `refreshPushedCase` | 删除/短路 `applyLocalRotate` 到短预设的失败回落 |
| 初始 state | 不得用短 `PRESET_CASES.description` 作为可提交 `caseText` |
| `handleStartSimulation` | `casePushQuality !== 'ok'` 或无合格稿 → 直接 return |
| `vocab-server/server.js` analyze | 密度失败：`failed` + 跳过 history INSERT |
| `ensureGameTheoryVerdictSections` | 可补空节，但补后仍须过密度；不过则失败不入库 |
| FALLBACK | 允许改写至通过 F2 同类密度；不新增大规模种子；Dify 失败且 FALLBACK 已 `ok` 时可用 |
| Auth / DB | 沿用现 `game_theory_history` / `game_theory_cases`；无新表要求 |
| 左侧列表 | 本轮不重做（与 CASE-01 一致）；列表仍可出现预设标题，但右侧主文案规则以本 PRD 为准 |

### Security & Privacy

- 案例/研判为训练虚构局；启发式不引入真实机关文号校验（那是 RD-LEN 的红线，本模块不套用）。
- 不把失败模型原文写入历史，减少套话污染与误当教材。
- 无新增 PII；沿用现 `userId` / 任务中心。

---

## 5. Risks & Roadmap

### Phased Rollout

| 阶段 | 内容 |
|------|------|
| **MVP（本 PRD）** | 双硬卡 + prompt 注入 + 拒收 UX + 夹具单测 + 禁止短 PRESET 主文案 |
| **v1.1** | 若合格率过低：再评估自动重试 1 次（本轮明确不做，需新确认） |
| **v2.0** | 二次 LLM 质量评审或改 Dify YML（本轮明确不做） |

### Technical Risks

| 风险 | 表现 | 缓解 |
|------|------|------|
| 启发式误杀合格稿 | 黄条/请再推过多 | 夹具 F2/F4 必须 `ok`；只调词表不改双硬卡定义 |
| 启发式漏放套话 | F1/F3 被判 `ok` | 夹具 100% 失败；禁止用垫字洗白 |
| Dify 合格率低 | 进页长时间无主文案 | 提示「请再推」；FALLBACK 改写至合格可作 qualified 来源 |
| 与 CASE-01 闪预设冲突 | 实施者按旧 PRD 先闪 5 条 | 本 PRD 覆盖占位规则；进 Tab 自动推送仍可保留 |
| 旧 design「标红仍展示」 | 实施者只加黄条不拒收 | 本 PRD 为 GT-CASE-02 新权威；docs 更新为 opt-in |
| gov/upward 无合格 FALLBACK | 那两环境 Dify 失败即空屏 | OMX 可将现有两条 FALLBACK 扩到三环境 **各至少 1 条合格稿**（仍不算大规模种子库） |

### Residual risk

低。启发式可能漏判/误判，用黄金夹具锁验收，不引入二次 LLM。拒收会导致无合格稿时空态，已用「请再推」明示，不回退短预设。

---

## 6. 测试用例（实现后逐条验收）

一次只验一个功能；通过后再进下一条。

### 用例 A — 案例空话不进框

| 项 | 内容 |
|----|------|
| 编号 | GT-CASE-02-A |
| 菜单路径 | 驭心博弈 → 高管斗争案例研判 |
| 测试数据 | 注入/单测夹具 F1 |
| 预期结果 | `below_standard`；右侧不是 F1 正文；也不是 5 条短预设原文 |
| 对应需求 | 7.22 博弈-1 过简/凑字不算过 |

### 用例 B — 案例尖锐局可提交

| 项 | 内容 |
|----|------|
| 编号 | GT-CASE-02-B |
| 菜单路径 | 同上 → 换一条（成功） |
| 测试数据 | 夹具 F2 或真实成功推送 |
| 预期结果 | 主文案详实；≥3 方；有时限/未知/决策点；提交可用 |
| 对应需求 | 背景清晰、斗争尖锐、可借鉴 |

### 用例 C — 研判套话不入史

| 项 | 内容 |
|----|------|
| 编号 | GT-CASE-02-C |
| 菜单路径 | 合格案例上填四维 → 提交 |
| 测试数据 | 夹具 F3（或 mock 任务结果） |
| 预期结果 | 任务失败；对局历史无新行 |
| 对应需求 | 研判机械单薄不得交差 |

### 用例 D — 研判有逻辑情感可回看

| 项 | 内容 |
|----|------|
| 编号 | GT-CASE-02-D |
| 菜单路径 | 提交 → 任务完成 → 对局历史展开 |
| 测试数据 | 夹具 F4 或真实成功研判 |
| 预期结果 | 四节可见：输赢、情绪锚点、步骤、可出口话术；无「未达门槛」失败态 |
| 对应需求 | 研判有逻辑与情感 |

### 用例 E — 无合格稿不闪短预设

| 项 | 内容 |
|----|------|
| 编号 | GT-CASE-02-E |
| 菜单路径 | Ctrl+Shift+R → 驭心博弈 → 高管斗争案例研判 |
| 测试数据 | 推送失败或 F1 |
| 预期结果 | 主文案不是「被稀释权力的常务副局长」等 5 条预设原文；可见推送中或请再推 |
| 对应需求 | 当前过简的预设不得当成功/占位正文 |
