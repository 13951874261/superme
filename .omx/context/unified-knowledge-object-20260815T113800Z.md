# Context Snapshot: 听-说-博弈统一知识对象

## Task Statement
对「听 / 说 / 博弈没有共享统一知识对象」做 Standard deep-interview，在规划或改代码前把意图、范围、非目标和决策边界问清楚。

## Desired Outcome
同一份知识只录入一次；用户确认后可同步到听、说、博弈；训练时 AI 真正读到该知识；结果可追溯引用了哪些知识。

## Stated Solution (User Proposal)
用户在方案评估后选择 **B**：仍做三模块统一 `KnowledgeItem`，但必须先改 SQLite、Dify 输入变量和后端转发，不能只改前端。

B 修订要点（尚未经 deep-interview 锁定为执行规格）：
- `knowledge_vault` 增加 `tags` + `extra_json`
- 独立表 `knowledge_vault_traces` 追加引用
- Dify 工作流新增可选 `knowledge_context`；`knowledge_refs` 只给后端
- `/api/game-theory/analyze` 与 `/ascension` 显式转发
- 四类抽屉资料经转换函数映射为 `KnowledgeItem`，不可直接 `as` 断言
- 三模块只走 `GET /linked`；抽屉走现有 `/notes`
- 引用在训练成功后写入，不在创建 taskId 时写入

## Probable Intent Hypothesis
减少跨模块重复录入，并让用户能解释「这次 AI 为什么用了这条理论」。次要可能是版本一致性和撤回后的影响面可见。

## Known Facts [from-code][auto-confirmed]
- `src/components/KnowledgeVault/useKnowledgeVault.ts`：四类独立结构 `EnglishNote` / `TheoryFrame` / `WritingSkill` / `AestheticTip`；`VaultType` 仅为 english|theory|writing|aesthetic
- `vocab-server/server.js:10794-10807`：`knowledge_vault` 固定列，无 extra_json / moduleTargets / traces
- `vocab-server/server.js:10653-10713`：GET/POST/PUT/DELETE `/api/knowledge-vault/notes`，PUT 只更新 word/meaning/example/title/category/summary/content/source
- `vocab-server/server.js:7676-7730`：`/api/game-theory/analyze` 只解构旧字段再发给 Dify，额外字段会被丢弃
- `yml/Game_Theory_Engine.yml`：变量为 scene_type, game_model, case_text, user_answer, applied_tactics
- `yml/Insight_Listen_Engine.yml`：scenario_text, user_analysis
- `yml/speak_engine.yml`：training_mode, scenario, user_role, target_audience, user_input
- `yml/Cognitive_Ascension_Engine.yml`：event_text, layers_text, dimension
- `ListenModule.tsx:350`：上传走 `uploadMaterialToKB`，不写入 knowledge_vault
- `SpeakModule.tsx`：无资料抽屉知识入口
- `GameTheoryModule.tsx:577-595`：人性档案已有成熟模式——拼进 `case_text`，不新增 Dify 变量
- `trainingAPI.ts`：`KnowledgeNode` / `/api/knowledge-node/list` 在 `server.js:4584` 固定返回 `[]`，表示掌握度节点而非资料内容
- 听、说当前浏览器直连 Dify；博弈经后端代理

## Known Facts [from-research]
- Dify Run Workflow：`inputs` 必须匹配应用已声明变量；未声明变量会导致校验失败或无法进入提示词

## Constraints
- AGENTS.md：中文、确认后才改代码、最小范围、一次一步
- 原方案声明不改：词汇本、写作训练、审美训练、演讲、登录、用户画像保存
- 一期不做知识图谱、不做全量 AI 自动联动
- 默认同步策略：仅用户确认后同步

## Unknowns / Open Questions
- 四个现象里哪一个才是必须先成立的成功标准（重复录入 / 引用可追溯 / 修改影响面 / 版本一致）
- 写作/审美抽屉是否显示同步控件
- 听模块上传是否要沉淀为抽屉草稿
- 线上 Dify 发布由谁导入
- 动态出题（`VITE_DIFY_INSIGHT_GEN_KEY`）是否纳入一期
- 博弈人机沙盘若走 Session Round 工作流，是否也要加变量
- OMX/代理可自行决定的实现细节边界未显式授权

## Decision Boundaries (Unresolved)
- 未确认哪些实现细节可在不打扰用户的情况下由 AIM 自决（例如 extra_json vs 多列、截断长度、状态机是否四态）

## Likely Codebase Touchpoints
- `src/types/knowledge.ts`（拟新增）
- `src/components/KnowledgeVault/useKnowledgeVault.ts`
- `src/components/KnowledgeVault/KnowledgeVaultDrawer.tsx`
- `src/components/KnowledgeVault/vaultExport.ts`
- `src/services/difyAPI.ts`
- `src/components/modules/{Listen,Speak,GameTheory}Module.tsx`
- `vocab-server/server.js` knowledge_vault + game-theory analyze/ascension
- `yml/{Insight_Listen_Engine,speak_engine,Game_Theory_Engine,Cognitive_Ascension_Engine}.yml`

## Docs/Rules Inspected
- `AGENTS.md` — 中文、确认后修改、成熟方案优先、单步确认
- `docs/superpowers/specs/2026-06-12-game-theory-redesign-design.md` — 博弈四 Tab 与 `runGameTheoryAnalysis` 契约；未定义跨模块知识对象
- `.omx/context/` — 无本主题既有快照
- 无 `CONTEXT.md` / `CONTEXT-MAP.md`
- 无仓库内 knowledge-vault 设计文档

## Terminology / Conflicts
- 用户「统一知识对象」≠ 代码里的 `KnowledgeNode`（掌握度节点，后端空实现）
- 用户「资料抽屉」= `knowledge_vault` / `KnowledgeVaultDrawer`，按 type 四分类，不是模块同步目标
- 用户「博弈知识库」可能混指：抽屉 theoryFrames、`game_theory_tactics`、`personal_prototypes`、Dify 知识检索
- 「同步」在方案中=用户确认后允许某模块读取；不是自动复制三份数据
- 文档与代码：设计稿要求博弈走 `runGameTheoryAnalysis`；代码已照做。跨模块知识在文档中不存在

## Prompt-Safe Initial-Context Summary Status
`recorded` — 本快照即为 prompt-safe 摘要；完整对话过长，下游只应引用本文件，不要回放第 1–10 部分原文。

### Prompt-Safe Summary
目标：听/说/博弈共享一份经用户确认的知识，训练可追溯引用。用户选 B：统一对象 + 先改库/Dify/后端。现状是四类抽屉资料、固定列表、博弈丢弃未知字段、Dify 无 knowledge_context。非目标（暂定）：图谱、自动全量联动、词汇本/写作训练/画像。待访：主成功标准、非目标闸门、决策边界。
