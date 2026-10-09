# PRD：驭心博弈研判给策（策略示例 + 语气修正）— GT-SIM-02

> **验收锚点：** `GT-SIM-02`（`test_cases_7.21_7.22_feedback.md`）  
> **模块路径：** 顶栏 → **驭心博弈** → **人机对战沙盘**（会话复盘为同硬卡第二入口）  
> **状态：** 终稿 · 已形成（deep-interview 7 轮，ambiguity 0.10）  
> **日期：** 2026-08-17  
> **原始反馈：** 7.22 博弈-3「AI 的研判太机械、单薄、逻辑与情感性都不强，同时 AI 应当针对我的反应给出博弈的策略示例或者语言语气表达上的修正」  
> **访谈规格：** `.omx/specs/deep-interview-gt-sim-02-strategy-tone.md`  
> **关联规格：** `docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`（本 PRD **加严**：独立三列表仍必要，但泛化兜底不再算过）  
> **已确认决策：** 必须贴当句改写 · 沙盘新增 `strategy_guidance` 并隐藏可执行策略/话术示例 · 沙盘改走新入史硬卡 · 会话同样拒收 · 案例历史不新增策略列、不强制贴对白 · 不改 Dify YML · 不做二次打分 · 不改 CASE-02 案例口径

---

## 1. Executive Summary

### Problem Statement

用户在人机对战沙盘提交应对后，研判仍像套话：仓内虽已有独立「原话｜问题｜建议说法」表，但系统可用泛化句补全（如「先确认对方关切…」），并不针对 `你没资格过问我的编制。` 这类当句反应给出可执行博弈策略。会话复盘同样可以把未改写的 guidance 当成完成态。案例研判走另一套四维输入，不能用「对白原话」硬套。

### Proposed Solution

在现有 analyze / 会话复盘 / `toneCorrections` 上，为人机沙盘与多人会话增加 **贴当句硬卡**：独立 `strategy_guidance[]` 与独立语气表都必须引用并改写用户当句。沙盘历史成功态只露出利益链、情绪动机、策略列、语气表；「可执行策略 / 话术示例」仅沙盘历史隐藏，且不再作为入库条件。案例侧维持 GT-CASE-02。不合格拒收，不改 Dify YML。

### Success Criteria

| # | KPI | 度量方式 | 目标值 |
|---|-----|----------|--------|
| 1 | 沙盘贴当句入史 | `evaluateSimAdviceQuality`（名称 OMX 可定） | `ok` 当且仅当利益/情绪密度过 **且** guidance+语气表贴当句 |
| 2 | 泛化兜底拦截 | 黄金夹具 F2 | **100%** 任务失败，**0** 条新沙盘历史 |
| 3 | 编制句合格稿 | 黄金夹具 F1 | **100%** 入库；展开可见策略列+语气表，不可见后两节 |
| 4 | 会话拒收 | 复盘夹具 F4 | 未贴当句时 **不** 进入 `review_done` |
| 5 | 验收用例 | `GT-SIM-02` | **通过**：不机械；针对该反应有策略示例；有可执行语气修正 |

---

## 2. User Experience & Functionality

### User Personas

| 角色 | 描述 | 核心诉求 |
|------|------|----------|
| **主用户·沙盘训练者** | 在人机对战里写下当句应对 | 看到针对这句话的下一步策略，以及可改口的说法 |
| **次用户·会话训练者** | 场景博弈多轮后点个人复盘 | 复盘必须改写自己刚说的话，而不是通用建议 |
| **对照用户·案例研判** | 填四维、无对白 | 本项不改变其四节历史；不突然多一块策略列 |

### User Stories

#### Story 1 — 沙盘给策必须对着我刚说的话

As a 沙盘训练者, I want 提交应对后在对局历史里看到针对该句的博弈策略列和语气修正表, so that 我能改口再练，而不是读「加强沟通」。

**Acceptance Criteria：**

- 菜单：驭心博弈 → 人机对战沙盘 → 填写应对 → 启动推演 → 任务中心完成 → 对局历史展开。
- 测试数据：应对 `你没资格过问我的编制。`
- 成功 `full_result` 含：`interest_chain`、`emotion_motives`、`strategy_guidance[]`（≥ OMX 下限）、`tone_corrections[]`。
- `strategy_guidance` 与 `tone_corrections.original` 能对上该句（或去前缀后的连续子串）；`suggested` 是可出口的改写，不得等于泛化兜底。
- 展开 UI **不渲染** `actionable_strategy` / `script_examples`。
- 夹具 F1 必须入库；F2 不得入库。

#### Story 2 — 不合格看不见、不入史

As a 沙盘训练者, I want 没改写我原话的稿不要进对局历史, so that 「任务完成」等于「给策可用」。

**Acceptance Criteria：**

- 沙盘新硬卡失败：任务 `failed`，可再提交；`game_theory_history` 无新 `source_type=simulation` 行。
- 被隐藏两节即使是套话，**只要** 新硬卡过，仍可入库。
- 不自动静默重试 Dify。
- `tone_corrections_repaired === true` 且 suggested 仍为泛化兜底 → 视为失败，不得洗成 `ok`。

#### Story 3 — 会话复盘同样拒收未贴当句

As a 会话训练者, I want 个人复盘必须改写我最近一句发言, so that 策略列和语气表不是两套空话。

**Acceptance Criteria：**

- 路径：驭心博弈 → 场景博弈会话 → 对局 → 全景 → 生成个人复盘。
- 引用源：最近一条非空 `user_input`（OMX 默认可用此条）。
- 未贴当句：不进入复盘完成态（`review_done`），不写成功历史；可再次生成。
- 语气表仍为独立区块，不得只并入 `strategy_guidance`。

#### Story 4 — 案例历史不被本项改形态

As a 案例训练者, I want 对局历史仍是 CASE-02 四节 + 已有语气表, so that 本项不把四维分析硬当成对白。

**Acceptance Criteria：**

- `source_type=case_analysis`：四节全显；**无** 新策略列；入史仍走 CASE-02 全四节密度。
- 不强制案例语气表贴对白；案例侧泛化补全不在本项当缺陷（本项非目标已锁）。

### Non-Goals

- 不改线上 Dify YML。
- 不改 GT-CASE-02 案例侧四节密度 / 拒收。
- 不改四维表单字段名。
- 不做 GT-SIM-01。
- 不改驭人术 / 顶层认知升维。
- 不做二次 LLM 打分。
- 不把泛化语气兜底当沙盘或会话合格。
- 不在案例历史新增策略列。

### User Flow

```text
人机对战沙盘提交应对
        │
        ▼
同一 analyze（source_type=simulation）
        │
        ▼
沙盘新硬卡？──否──► 任务失败，不入库，可重试
        │
        是
        ▼
写入对局历史
展开：利益链 + 情绪动机 + 策略列 + 语气表
      （隐藏 可执行策略 / 话术示例）

场景会话 → 生成个人复盘
        │
        ▼
贴当句硬卡？──否──► 不进入完成态，可再生成
        │
        是
        ▼
ReviewView：独立语气表 + strategy_guidance
```

---

## 3. AI System Requirements

### Tool Requirements

| 能力 | 用法 |
|------|------|
| 现有 Dify 博弈研判工作流 | analyze 已封装；**不改 YML**，按 source 加长 `case_text` 系统指令，要求输出 `strategy_guidance` + 贴当句的 `tone_corrections` |
| 现有会话 personal-review 工作流 | **不改 YML**，注入「必须引用最近用户发言」 |
| 本地质量函数 | 沙盘新函数 + 案例沿用 `evaluateVerdictSectionsQuality`；前后端镜像 |
| `toneCorrections` | 可补 `original`，**不得**用泛化 `suggested` 把结果洗白 |
| 任务中心 | 沙盘异步失败可感知、可重试 |

不新增模型、不新增 Dify 应用、不二次评审调用。

### Evaluation Strategy

黄金夹具锁行为（词表可微调，夹具不可破）。用户应对统一：`你没资格过问我的编制。`

| ID | 夹具 | 期望 |
|----|------|------|
| F1 | 利益/情绪有输赢与面子或恐惧；`strategy_guidance` ≥2 条且含「编制」并给出先/再动作；语气表 original 含该句，suggested 为可出口改写（非兜底句） | 沙盘 `ok`；入库；UI 见策略列+表，不见后两节 |
| F2 | 利益/情绪合格，但 guidance 与 suggested 均为「先确认对方关切，再说明边界与可协商空间的下一句」 | `below_standard`；不入库 |
| F3 | F1 的给策合格，但 `actionable_strategy`/`script_examples` 为高度重视套话 | 沙盘仍 `ok` 且入库 |
| F4 | 会话最近 `user_input` 为该编制句，review 未引用未改写 | 不进入 `review_done`；无成功历史 |
| F5 | `source_type=case_analysis` 的 CASE-02 套话四节 | 仍按 CASE-02 失败，行为与本 PRD 前一致 |
| F6 | 沙盘 `user_answer` 带 `【玩家应对策略】` 前缀，正文仍为该编制句 | 贴当句须剥前缀后仍能判 F1 为 `ok` |

**Pass rate：** 上表单测 **100%**。E2E 手工对齐 `GT-SIM-02` 三条预期。

Prompt 约束（注入，非改 YML）：

- 必须针对 `user_answer` / 最近用户发言给策，禁止只写通用权斗讲义。
- 必须输出 `strategy_guidance` 字符串数组。
- `tone_corrections[].original` 必须是用户当句（可轻微截取），`suggested` 必须是改写后可出口的下一句。
- 禁止用「高度重视 / 统筹兼顾」及现网泛化兜底句交差。

---

## 4. Technical Specifications

### Architecture Overview

```text
[沙盘提交]
  POST analyze  source_type=simulation
        │
        ▼
  Dify（prompt 注入：guidance + 贴当句语气表）
        │
        ▼
  ensureGameTheoryVerdictSections（可补四节，不可洗白沙盘新硬卡）
  normalizeToneCorrections（可补 original；泛化 suggested 不得变 ok）
        │
        ▼
  evaluateSimAdviceQuality(user_answer, guidance, tone, interest, emotion)
        │
        ├─ ok → INSERT game_theory_history
        └─ 非 ok → task failed，不 INSERT

[案例提交]
  仍 evaluateVerdictSectionsQuality 全四节
  不要求 strategy_guidance，不因本项拒收语气泛化

[会话 generatePersonalReview]
  lastUserInput = 最近非空 user_input
  同贴当句硬卡
        ├─ ok → review_done + 可写历史
        └─ 非 ok → 保持可再生成；不进入完成态
```

### 沙盘新硬卡（实现可微调，验收锁夹具）

扩展 `src/utils/gtCaseQuality.ts` 与 `vocab-server/services/gtCaseQuality.js`，**不要**新引擎、不要新依赖。建议函数与会话共用「贴当句」纯函数，避免两套规则。

**通过条件（须全过才可能 `ok`）：**

| 分项 | 默认通过条件（OMX 可微调） |
|------|---------------------------|
| `interestOk` | `interest_chain` 非空且命中输赢/阵营类信号（复用 CASE-02 `GT_WIN_LOSE_RE`） |
| `emotionOk` | `emotion_motives` 非空且命中情绪锚点（复用 `GT_EMOTION_RE`） |
| `clicheFail` | 利益+情绪合计套话命中 ≥3 → 失败 |
| `guidanceOk` | `strategy_guidance` 为数组，条数 ≥2（下限 OMX 可调），拼接文本含用户当句子串，且含次序/动作信号 |
| `toneQuoteOk` | ≥1 条语气修正；`original` 含当句子串 |
| `toneRewriteOk` | `suggested` 非空、≠ original、≠ 现网泛化兜底句，且宜可出口（引号或「说」类信号 OMX 可定） |

剥前缀：`【玩家应对策略】` 等标签不计入「当句」。短句（如整句「你没资格过问我的编制。」）应用整句或「没资格过问我的编制」作为必须命中的子串。

`quality === 'ok'` 当且仅当上表全过。`quality_note` 拼接失败分项。

**明确不再用于沙盘入史的：** `actionable_strategy` / `script_examples` 字数与 CASE-02 话术密度。

### Integration Points

| 点 | 行为 |
|----|------|
| `vocab-server/server.js` analyze | `normalizedSource === 'simulation'` 走新硬卡；否则 CASE-02 |
| `full_result.strategy_guidance` | 沙盘成功稿必须带数组；写入历史 JSON |
| `GameTheoryModule` 历史展开 | `item.source_type === 'simulation'` 时渲染策略列+语气表，跳过后两节 |
| `difyAPI.ts` / 类型 | `full_result` 增加可选 `strategy_guidance?: string[]` |
| `generatePersonalReview` | 硬卡失败：不设 `review_done`、不以成功态 `upsertHistory` |
| `normalizeToneCorrections` | 沙盘/会话路径：repaired 泛化 suggested → 硬卡失败 |
| Auth / DB | 沿用 `game_theory_history`；无新表要求 |
| CASE-02 | 案例路径零口径回退；不要把新硬卡套到 `case_analysis` |

### Security & Privacy

- 给策针对用户输入的训练虚构应对；启发式只做子串匹配，不外传。
- 失败稿不入库，减少泛化教材污染。
- 无新增 PII；沿用现 `userId` / 任务中心。

---

## 5. Risks & Roadmap

### Phased Rollout

| 阶段 | 内容 |
|------|------|
| **MVP（本 PRD）** | 沙盘新硬卡 + 历史 UI 分支 + 会话拒收 + 夹具单测 + prompt 注入 |
| **v1.1** | 若合格率过低：评估自动重试 1 次（本轮明确不做） |
| **v2.0** | 改 Dify YML 或二次 LLM 评审（本轮明确不做） |

### Technical Risks

| 风险 | 表现 | 缓解 |
|------|------|------|
| 子串误杀 | 用户短应对被标点/前缀拆掉 | F1/F6 必须 `ok`；剥前缀 |
| 子串漏放 | 泛化句里碰巧含「编制」 | F2 不得 `ok`；兜底句整句否决 |
| 与 CASE-02 抢同一 analyze | 实施者继续用四节挡沙盘入库 | 按 `source_type` 分支；F3 必须入库 |
| 会话失败无反馈 | 用户以为按钮坏了 | 失败文案须可见；保持可再生成 |
| 旧 design「有表即可」 | 实施者只保留兜底表 | 本 PRD 为 GT-SIM-02 新权威 |

### Residual risk

低。启发式可能漏判/误判，用黄金夹具锁验收。拒收会导致沙盘任务失败、会话停在复盘前，已用可重试明示。不回退泛化兜底当成功。

---

## 6. 测试用例（实现后逐条验收）

一次只验一个功能；通过后再进下一条。

### 用例 A — 编制句给策可入史

| 项 | 内容 |
|----|------|
| 编号 | GT-SIM-02-A |
| 菜单路径 | 驭心博弈 → 人机对战沙盘 → 提交应对 → 对局历史展开 |
| 测试数据 | 应对 `你没资格过问我的编制。`（可沿用 GT-SIM-01 对手） |
| 预期结果 | 任务成功；可见策略列（针对编制/过硬关死谈判）+ 语气表三列；原话能对应该句；不见「可执行策略/话术示例」两节 |
| 对应需求 | 7.22 博弈-3 策略示例 + 语气修正 |

### 用例 B — 泛化兜底不入史

| 项 | 内容 |
|----|------|
| 编号 | GT-SIM-02-B |
| 菜单路径 | 同上 |
| 测试数据 | 夹具 F2 或 mock 任务结果为泛化 suggested/guidance |
| 预期结果 | 任务失败；对局历史无新「人机对战」行 |
| 对应需求 | 有表不等于合格 |

### 用例 C — 隐藏两节套话不挡入库

| 项 | 内容 |
|----|------|
| 编号 | GT-SIM-02-C |
| 菜单路径 | 同上（或单测） |
| 测试数据 | 夹具 F3 |
| 预期结果 | 仍入库；展开仍不显示后两节 |
| 对应需求 | 沙盘新硬卡，覆盖「四节全过才入史」对 simulation 的旧套用 |

### 用例 D — 会话未贴当句不完成

| 项 | 内容 |
|----|------|
| 编号 | GT-SIM-02-D |
| 菜单路径 | 驭心博弈 → 场景博弈会话 → 生成个人复盘 |
| 测试数据 | 最后用户发言为该编制句；复盘未改写 |
| 预期结果 | 无「本局复盘完成」；可再次生成；不出现仅泛化兜底的完成态语气表 |
| 对应需求 | 冻结规格：会话同样要独立语气修正且须可用 |

### 用例 E — 案例历史形态不被带偏

| 项 | 内容 |
|----|------|
| 编号 | GT-SIM-02-E |
| 菜单路径 | 驭心博弈 → 高管斗争案例研判 → 对局历史 |
| 测试数据 | 任意合格 CASE-02 案例研判 |
| 预期结果 | 仍四节全显；无新增「博弈策略示例」列；CASE-02 拒收口径不变 |
| 对应需求 | Round 2/6 非目标 |
