# Deep Interview Spec: EN-ORAL-03 1VS1日常+指出疏漏并给样例

## Metadata

| 项 | 值 |
|---|---|
| Profile | standard |
| Rounds | 7 |
| Final ambiguity | ~0.16 |
| Threshold | 0.20 |
| Context type | brownfield |
| Context snapshot | `.omx/context/en-oral-03-1vs1-daily-20260817T075353Z.md` |
| Transcript | `.omx/interviews/en-oral-03-1vs1-daily-20260817T080527Z.md` |
| Prompt-safe summary | not_needed |
| Residual risk | 低；0 发言/无疏漏空态未强制验收，实现可自定降级文案 |

## Clarity breakdown

| Dimension | Score |
|-----------|-------|
| Intent | 0.92 |
| Outcome | 0.90 |
| Scope | 0.88 |
| Constraints | 0.60 |
| Success | 0.88 |
| Context | 0.78 |

## Intent

日常演练入口已存在，但「指出表达疏漏 + 给出更好样例」未达验收；需要补齐能力并用 PRD 指导实现，而非重做谈判沙盘或新开模块。

## Desired Outcome

用户在「日常演练」完成多轮 1VS1 对话并结束后，能看到本场**结构化**表达复盘：语法/形态与地道表达两类疏漏，每条含更好样例；对话进行中仍可使用现有四维反馈。

## In-Scope

- 复用英语引擎 → 多角色沙盘 → **日常演练**
- 会话结束后生成复盘汇总
- 疏漏类型：语法/形态 + 地道表达
- 结构化条目：`原句片段` + `问题类型(语法|地道)` + `问题说明` + `更好样例`
- 与进行中「AI 四维反馈」并存

## Out-of-Scope / Non-goals

1. 不改谈判沙盘破绽/博弈逻辑  
2. 不做进行中逐轮纠错气泡  
3. 不把语用/得体性纳入本轮主验收  
4. 不重做 Dify 工作流/场景剧本生成  
5. 不做独立新模块入口  

## Decision Boundaries

实现方可自行决定：触发时机细节（挂在现有停止/结束流）、LLM/解析路径、字段命名、UI 样式；**不得突破** In-Scope 验收结构与 Non-goals。

## Constraints

- 优先复用 OralWarRoom / 日常模式现有会话与停止路径  
- 日常模式继续禁止谈判 `flaw_point` 植入（与表达复盘语义分离）  
- 技术路径在 Decision Boundaries 内可自定  

## Testable acceptance criteria

1. 菜单：英语引擎 → 多角色沙盘 → 日常演练；有 1VS1 日常提示且不植入谈判破绽。  
2. 自定义背景可用；进行多轮后结束会话，出现复盘汇总。  
3. 测试句 `I think maybe we can talking about the contract tomorrow?` → 至少 1 条类型=语法，原句片段覆盖 `can talking`（或等价），并含更好样例（如 `we can talk about the contract tomorrow`）。  
4. 若存在不地道但语法尚可的表达，可另出类型=地道的条目（有则加分，无则不挡语法条通过）。  
5. 进行中四维反馈仍可展示（不作为本条主失败条件）。  
6. 谈判沙盘破绽逻辑回归不受影响。  

## Assumptions + resolutions

| 假设 | 决议 |
|------|------|
| 「疏漏」=谈判 flaw | 否；独立表达复盘 |
| 需逐轮打断纠错 | 否；结束后汇总 |
| 四维与复盘冲突 | 否；并存 |
| 需新页面 | 否；日常演练 Tab |

## Pressure-pass findings

回访「未达标」→ 明确结束后汇总；加压后确认与四维并存；「疏漏」钉为语法+地道，排除语用主验收。

## Brownfield evidence

- `[from-code][auto-confirmed]` `sandboxMode.ts` daily 1VS1 / 清空 flaw_point  
- `[from-code][auto-confirmed]` SceneSelector 谈判/日常 Tab  
- `[from-code][auto-confirmed]` OralWarRoomChat 四维反馈 UI  
- `[from-code]` 缺独立「原句→类型→样例」结构化复盘（本 PRD 要补）  
- 验收原文：`test_cases_7.21_7.22_feedback.md` EN-ORAL-03  

## Docs / Terminology Ledger

见 transcript；关键裁定已写入 Intent/Non-goals。

## Optional durable docs (opt-in)

可将本 PRD 同步到 `docs/superpowers/specs/`（需用户明确同意后才写入公开 docs）。

---

# PRD: EN-ORAL-03 1VS1日常表达复盘

### 1. Executive Summary

- **Problem Statement：** 日常演练已支持 1VS1 轻松对话，但结束后缺少稳定、可验收的「表达疏漏 + 更好样例」结构化复盘，难以对齐 7.21 英语-6 / EN-ORAL-03。  
- **Proposed Solution：** 在现有「日常演练」会话结束后增加表达复盘汇总；进行中保留四维反馈；不改谈判沙盘。  
- **Success Criteria：**  
  1. 结束后出现结构化疏漏列表（语法|地道）。  
  2. 对 `can talking` 类错误至少给出 1 条语法疏漏 + 更好样例。  
  3. 日常模式仍无谈判破绽植入。  
  4. 谈判沙盘回归通过。  
  5. 不新增独立模块入口即可完成验收路径。  

### 2. User Experience & Functionality

#### User Personas

- 英语学习者：希望在轻松日常对话后看到自己的表达问题与改写样例。  
- 验收/产品：需要可重复的 EN-ORAL-03 菜单路径与测试数据。  

#### User Stories

1. **As a** 学习者，**I want to** 在日常演练结束后看到本场表达疏漏与更好样例，**so that** 我能针对性纠正语法与地道表达。  
   - **AC：**  
     - 结束后展示复盘面板/区块。  
     - 每条含：原句片段、类型(语法|地道)、问题说明、更好样例。  
     - 测试句触发至少 1 条语法类。  
2. **As a** 学习者，**I want to** 对话过程不被纠错打断，**so that** 我能保持 1VS1 流畅练习。  
   - **AC：** 进行中无强制逐轮纠错气泡；四维反馈可按现状展开。  
3. **As a** 学习者，**I want to** 在同一沙盘里切换谈判/日常，**so that** 商务与日常分区清晰。  
   - **AC：** 仍用现有 Tab；日常提示 1VS1、不植入谈判破绽。  

#### Non-Goals

见上文 Out-of-Scope 1–5。

### 3. AI System Requirements

- **Tool Requirements：** 复用现有口语沙盘对话记录；结束后一次（或等价）分析调用——路径可自定（扩展现有 Dify JSON、独立复盘调用、或本地后处理均可）。  
- **Evaluation Strategy：**  
  - 固定用例：`can talking` → 语法条命中率人工/契约可检。  
  - 回归：daily `flaw_point` 仍空；谈判模式破绽逻辑不变。  
  - 质量下限：样例须可替换原问题片段，且英语可读（不做 BLEU 硬阈值，除非后续加评测集）。  

### 4. Technical Specifications

- **Architecture Overview（示意）：**  
  `日常演练多轮对话` → `用户结束/停止` → `收集用户发言转录` → `表达复盘生成` → `UI 渲染结构化条目`；并行保留回合内四维反馈。  
- **Integration Points：** OralWarRoom 会话状态、现有停止/结束控件、可选 Dify/后端 API；存储若需要可落会话级结果（实现自定）。  
- **Security & Privacy：** 复盘仅基于本场用户已产生的对话内容；不新增对外暴露密钥；遵循现有用户会话隔离。  

### 5. Risks & Roadmap

- **Phased Rollout：**  
  - **MVP：** 结束后结构化复盘（语法+地道）+ EN-ORAL-03 手工/契约验收。  
  - **v1.1：** 空态文案、无疏漏提示、历史复盘回看（可选）。  
  - **v2.0：** 语用/得体性、逐轮轻提示（明确新需求后再做）。  
- **Technical Risks：** LLM 漏检语法；与四维反馈文案重复造成噪音；误把谈判 flaw 字段复用导致语义污染——须保持字段/产品语义分离。  

## Condensed transcript

见 `.omx/interviews/en-oral-03-1vs1-daily-20260817T080527Z.md`
