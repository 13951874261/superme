# Deep Interview Spec: 全产品知识中台（听-说-博弈统一知识）

## Metadata
- **Profile:** standard
- **Rounds:** 11
- **Final Ambiguity:** 0.13（threshold 0.20）
- **Context Type:** brownfield
- **Context Snapshot:** `.omx/context/unified-knowledge-object-20260815T113800Z.md`
- **Transcript:** `.omx/interviews/unified-knowledge-platform-20260815T120800Z.md`
- **Prompt-safe summary status:** recorded in snapshot
- **Feasibility Verdict:** 可行，但是大型棕地改造；不得在 deep-interview 内直接实施。原「方案 B 外科手术」已被用户升级为知识中台，规划阶段必须按中台范围拆交付，不能假装只改抽屉字段。

## Clarity Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.90 | 做成全产品知识中台，而不只是少打一遍字 |
| Outcome | 0.84 | 确认后自动注入；任务中心执行；图谱可见模块边 |
| Scope | 0.88 | 听/说/博弈 + 上传沉淀 + 战术/档案映射 + 图谱；抽屉四分页保留 |
| Constraints | 0.82 | 不动词汇本/登录画像/德州；YAML 只改仓库；密钥后端化 |
| Success Criteria | 0.88 | 完整故事为上线卡点，见验收 |
| Context (brownfield) | 0.88 | 抽屉四类、固定列表、博弈已异步、听/说直连 Dify |

## Prompt-Safe Initial-Context Summary
目标从「三模块共享抽屉知识」升级为知识中台。成功故事：上传或录入 → AI 提炼草稿 → 用户确认同步 → 听/说/博弈均走任务中心并自动带上该知识（最多 5 条）→ 使用记录 → 图谱显示节点连到三模块。不改词汇本、登录画像、德州扑克、抽屉四分页、不跨用户。AIM 可自决存储、SQL 图谱、草稿确认流、密钥后端化、仓库 YAML。线上 Dify 由用户发布。

## Intent
用户要的不是三套训练材料各写一份，而是一个以资料抽屉为确认闸门的知识中台：知识进入系统后（上传或手录均可），经 AI 提炼和用户确认，听、说、博弈的训练都能用同一条对象，并且能在图谱和使用记录里看见它被哪些模块用过。

第 1 轮的「不再重复录入」仍然成立，但第 8 轮把它收成更大本质：**没有图谱、自动提炼、全模块任务化，就不算做成。**

## Desired Outcome
1. 资料抽屉仍是唯一「确认后才能进入训练」的闸门。
2. 听模块上传会沉淀：触发 AI 提炼，结果以**草稿**进入抽屉对应分页，不自动同步。
3. 用户确认并勾选模块后，目标模块之后每次训练**自动注入**这些知识，直到撤回同步。
4. 注入条数硬上限 5（最近确认优先）；任务中心明确提醒实际带了几条、同步了几条。
5. 听、说、博弈训练提交都进入异步任务中心，可看进度。
6. 成功任务回写使用记录；图谱能看到该知识节点连到 `listen` / `speak` / `game_theory`。

## In-Scope
1. 统一 `KnowledgeItem` 与四类抽屉资料的转换层（抽屉四分页 UI 保留）。
2. `knowledge_vault` 增加 `tags`、`extra_json`；新建 `knowledge_vault_traces`；新建图谱节点/边表（SQLite）。
3. API：现有 notes CRUD 透传扩展字段；`GET /linked`；`PUT /notes/:id/sync`；`POST /notes/:id/traces`；图谱查询。
4. 资料抽屉：同步勾选、状态、来源、使用记录；图谱入口（不替换四分页）。
5. 听上传 → AI 提炼草稿；博弈战术库/人性档案可**导入/映射**为抽屉条目（不删除原表）。
6. 听、说改为走后端任务队列（Dify 密钥移出浏览器）；博弈分析/升维转发 `knowledge_context`。
7. 仓库 YAML 增加可选 `knowledge_context`：`Insight_Listen_Engine.yml`、`speak_engine.yml`、`Game_Theory_Engine.yml`、`Cognitive_Ascension_Engine.yml`；听动态出题应用一并纳入中台范围（第 7 轮全要），但验收卡点以点评/训练任务为准。
8. 写作/审美**训练模块**接入同一套引用（第 6–7 轮要求），但不是第 11 轮上线卡点。
9. 导出追加同步模块、来源、状态、最近使用。

## Out-of-Scope / Non-goals
- 不改词汇本、艾宾浩斯、词汇导出
- 不改登录、用户画像保存和压缩
- 不改德州扑克
- 不把资料抽屉改成单一列表（四个分页必须保留）
- 知识不跨用户共享
- 不上 Neo4j 等独立图数据库
- AIM 不连接生产 Dify 做导入发布
- 不在未确认的情况下把 AI 提炼结果自动同步进训练
- 本规格不授权直接改代码；需用户选择后续执行通道

## Decision Boundaries（AIM 可自决、不必再问）
- 存储用 `extra_json` + 独立 `knowledge_vault_traces`
- 图谱用 SQLite 节点表 + 边表，不做图数据库
- AI 提炼一律先草稿，确认后才 `synced` 并自动注入
- 自动注入硬上限 5 条（最近 `confirmedAt`），任务中心提醒「已同步 N 条，本次使用 K 条」
- 听/说改任务中心时把 Dify 密钥收到后端
- 只改仓库 YAML；线上发布由用户做
- 图谱 UI 作为抽屉内额外面板/页，不拆除四分页
- 战术/档案「合并」采用映射导入抽屉，不删 `game_theory_tactics` / `personal_prototypes`
- 适配器按模块生成上下文并做服务端二次截断
- 四类资料 → `KnowledgeItem` 的字段映射（word→title 等）

## Constraints
- 棕地：`knowledge_vault` 当前固定列，新字段必须迁移，不能只靠前端兼容
- Dify 官方：`inputs` 必须是已声明变量；`knowledge_refs` 不发给 Dify，只给后端追溯
- 博弈 `/api/game-theory/analyze` 目前丢弃未知字段，必须显式转发
- 听/说当前浏览器直连 Dify；改任务中心是范围的一部分
- 人性档案已有「拼进 `case_text`」模式；中台改为正式 `knowledge_context` 变量后，档案映射条目走新变量，避免双通道各写一套
- AGENTS.md：中文、确认后才改代码、一次一步、最小无关 diff
- 用户已否决「只做方案 B 外科手术」作为完成定义，但实施仍应分步，每步可验收

## Testable Acceptance Criteria
**菜单路径：** 资料管理中心 + 洞察听 + 洞察说 + 博弈案例研判  
**测试数据：** 上传或手录「信息不对称」；同步听/说/博弈

| 步骤 | 预期 |
|------|------|
| 1. 上传或手录 | 出现抽屉草稿，`syncStatus=draft`，未进任何训练 |
| 2. AI 提炼（若来自上传） | 草稿含摘要/标签；未确认则听/说/博弈请求不含该知识 |
| 3. 确认并同步三模块 | 状态 `synced`；`moduleTargets` 含 listen/speak/game_theory |
| 4. 三模块各提交一次训练 | 均进入任务中心；进度可见；提醒含「本次使用 1 条」 |
| 5. Dify/后端实际 inputs | 含 `knowledge_context`；不含空字段；最多 5 条 |
| 6. 任务成功 | `knowledge_vault_traces` 三条记录（听/说/博弈），追加不覆盖 |
| 7. 图谱 | 可见该节点，边连到 listen、speak、game_theory |
| 8. 撤回听同步 | 新的听力任务不再带它；历史 traces 仍在 |
| 9. 回归 | 未同步任何知识时，三模块旧 payload 不变；词汇本/登录/德州扑克行为不变 |
| 10. 用户隔离 | 用户 A 的 `/linked` 看不到用户 B |

写作/审美训练接入若同期完成，用同一套 traces/图谱边验收，但缺它们不阻止「完整故事」宣告通过。

## Assumptions Exposed + Resolutions
| 假设 | 决议 |
|------|------|
| 主痛点是少打一遍字 | 保留，但完成定义升级为知识中台 |
| 听上传不算已录入 | 仍成立：上传 ≠ 已确认；上传只产生草稿 |
| 默认不勾选更安全 | **否决**；改为确认同步后自动注入 |
| 一期不做图谱 | **否决**；SQL 图谱是做成条件 |
| 前端可先存扩展字段 | **否决**；必须先改 SQLite |
| 创建 taskId 即可写引用 | **否决**；任务成功后才写 traces |
| 写作审美训练是上线卡点 | **否决**；在范围内但非第 11 轮卡点 |

## Pressure-Pass Findings
- 回访第 1 轮「不重复录入」：第 2 轮把「录入」收窄为抽屉确认；第 7 轮把上传沉淀拉回第一期；第 10 轮用「提炼=草稿」打通两句。
- 回访第 3 轮自动全带：第 4–5 轮证明「进任务中心」不等于带得下 30 条；用户授权 AIM 上限 5 条 + 提醒。
- 第 6 轮「全要」曾使歧义回升到 35%；第 7–8 轮用户坚持中台愿景；第 9 轮才补上真正非目标。

## Brownfield Evidence vs Inference
**Evidence**
- `useKnowledgeVault.ts` 四类结构，无模块同步字段
- `server.js` `knowledge_vault` 固定列；notes PUT 不透传未知字段
- `server.js` `/api/game-theory/analyze` 只转发旧 Dify 变量
- `GameTheoryModule.tsx` 人性档案拼进 `case_text`；分析已走 taskId
- `ListenModule.tsx` 上传 `uploadMaterialToKB`，不写抽屉
- `SpeakModule` / `fetchInsightFeedback` 浏览器直连 Dify
- `/api/knowledge-node/list` 返回 `[]`，与本中台对象不是同一概念

**Inference**
- 未声明的 Dify 变量会导致失败或静默不用；必须改 YAML 并发布
- 听/说任务中心化等于新增后端代理，工作量大于博弈转发

**Unknown**
- 线上听动态出题应用的准确 YAML/变量表（`VITE_DIFY_INSIGHT_GEN_KEY`）需执行前再定位
- 生产 Dify 对未知 inputs 是 422 还是丢弃，以发布后的 Get App Parameters 为准

## Docs / Terminology Ledger
| 用户用语 | 仓库含义 | 本规格采用 |
|----------|----------|------------|
| 统一知识对象 | 代码无此类型；勿与 `KnowledgeNode`（掌握度，空实现）混淆 | 新 `KnowledgeItem`，抽屉确认后的中台对象 |
| 资料抽屉 | `knowledge_vault` + 四分页 | 确认闸门，分页保留 |
| 同步 | 代码中不存在 | 用户确认后 `moduleTargets` + `synced`，之后自动注入 |
| 博弈知识库 | 可能指 theoryFrames / tactics / prototypes / Dify retrieval | 中台对象为主；tactics/prototypes 映射导入，不删原表 |
| 知识图谱 | 仓库无图数据库 | SQLite 节点/边 + 抽屉内图谱视图 |
| 异步中心 | `TaskContext` + `taskQueue` | 听/说/博弈提交都进此中心 |

Inspected: `AGENTS.md`；`docs/superpowers/specs/2026-06-12-game-theory-redesign-design.md`（无跨模块知识）；无 `CONTEXT.md`。

## Scenario / Edge-Case Findings
- 听上传 PDF 但未确认：草稿存在，训练不带，图谱可显示未同步节点（AIM 自决是否显示草稿节点；建议草稿可见但无模块边）。
- 30 条已同步：只带 5 条，任务中心必须提醒，不得静默截断当成功全带。
- 任务失败：不写 traces，避免假引用。
- 撤回某一模块：只影响后续 `/linked` 与自动注入，不删历史 traces、不删知识。

## Optional Durable Doc Recommendations（opt-in，未自动写入 docs/）
若用户同意，可另写 `docs/superpowers/specs/` 下的知识中台 DESIGN.md。默认不从访谈原文生成对外文档。

## Technical Context Findings
- 成熟模式可复用：`training_sessions.extra_json`、博弈 `taskQueue`、人性档案注入（将升级为正式变量）
- 不要启用空的 `knowledge-node` 当中台存储
- 实施顺序建议（仍须用户选通道后才执行）：库表与 CRUD → 抽屉确认/同步 → 博弈转发+traces → 听上传草稿 → 说/听任务中心化 → 图谱视图 → 战术/档案映射 → 写作审美接入

## Residual Risk
- 范围远大于最初外科方案；若执行通道按「一次改完」推进，回归面包含听/说密钥迁移。
- 线上 YAML 未发布时，带 `knowledge_context` 的任务会失败；发布责任在用户。
- 写作/审美接入与动态出题变量仍在范围内，可能拖长工期，但不阻塞第 11 轮完整故事验收。
