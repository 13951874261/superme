# PRD：Dify 实时案例生成 → 预生成 + 异步任务中心

## 1. 执行摘要

### 问题
项目内多个功能模块依赖 Dify 工作流**实时同步调用**生成案例/分析/素材，用户点击按钮后需等待 5~30 秒甚至更久才能看到结果。体验差、并发压力大。

### 方案
将所有"案例类/预判类"Dify 调用统一改造为：
- **3秒缓存命中** → 直接展示预生成内容
- **3秒超时** → 提示用户进入任务中心查看异步进度
- **夜间 0:00 cron** → 并行多线程批量预生成次日内容

### 成功指标（KPI）
| 指标 | 当前 | 目标 |
|------|------|------|
| 案例类内容首屏响应时间 | 5–30s | ≤3s（命中时） |
| 未命中时用户感知等待时间 | 同步阻塞 5–30s | ≤1s（提示转后台） |
| 预生成覆盖率（次日可命中的比例） | N/A | ≥80% |
| Dify API 峰值并发请求数 | 用户触发时不可控 | Cron 并行可控（≤8） |

---

## 2. 功能点梳理与改造清单

以下逐项列出项目中所有依赖 Dify 工作流实时生成案例的功能点，标注改造优先级和具体改造方式。

### P0 — 高优先级改造项

#### F01 · 听力模块（ListenModule）— Insight 案例池 & 反馈分析

| 属性 | 详情 |
|------|------|
| **当前行为** | 点击「获取案例」→ `fetchInsightCasePool()` 实时调 Dify 工作流生成场景案例；`fetchInsightFeedback()` 实时分析反馈 |
| **涉及文件** | `src/components/modules/ListenModule.tsx`, `vocab-server/services/insightScenarioGenerate.js`, `insightDailyCron.js`, `insightDailyPoolService.js` |
| **Dify 工作流类型** | 案例生成 + 分析 |
| **是否已有预生成机制** | ⚠️ 部分：`insightDailyCron.js` 已有每日 cron，但仅覆盖 `daily_extract`；案例池仍实时 |
| **改造方案** | 将案例池生成纳入统一预生成 cron；前端改为缓存优先 + 3秒超时转任务中心 |
| **优先级** | **P0** |

#### F02 · 阅读模块（ReadModule）— 认知穿透引擎 + 素材生成

| 属性 | 详情 |
|------|------|
| **当前行为** | 点击「加载今日推送」→ `generateReadMaterial()` 实时调 Dify 生成阅读素材（最多重试3次）；点击「认知穿透分析」→ `runCognitivePenetrationEngine()` 实时分析 |
| **涉及文件** | `src/components/modules/ReadModule.tsx`, `vocab-server/services/readPenetrationProxy.js` |
| **Dify 工作流类型** | 素材生成 + 结构化分析 |
| **改造方案** | 夜间预生成次日素材（按 scene_type × framework 组合）；认知穿透结果按输入文本哈希做短 TTL 缓存；未命中走任务中心 |
| **优先级** | **P0** |

#### F03 · 博弈论模块（GameTheoryModule）— 博弈分析 + 认知提升评估

| 属性 | 详情 |
|------|------|
| **当前行为** | 输入博弈场景 → `runGameTheoryAnalysis()` 实时调 Dify 分析策略；`runCognitiveAscension()` 实时评估深度得分 |
| **涉及文件** | `src/components/modules/GameTheoryModule.tsx`, `vocab-server/services/gameTheorySessionService.js` |
| **Dify 工作流类型** | 结构化分析 + 评分 |
| **改造方案** | 按 PRESET_CASES 预生成标准分析结果；自定义输入走任务中心；认知提升评估按输入哈希缓存 |
| **优先级** | **P0** |

#### F04 · 口语模块（SpeakModule）— 影响力引擎 + 即兴点评

| 属性 | 详情 |
|------|------|
| **当前行为** | 选定场景维度 → `runSpeakInfluenceEngine()` 实时调 Dify 生成结构化话术建议；录音后 `runSpeakCritiqueChat()` 实时评价 |
| **涉及文件** | `src/components/modules/SpeakModule.tsx`, `vocab-server/services/insightSpeakProxy.js` |
| **Dify 工作流类型** | 内容生成 + 评分 |
| **改造方案** | 影响力引擎按 SCENARIOS×DIMENSIONS 矩阵预生成常用组合（约 4×7×7=196 组合，可裁剪至高频 Top50）；即兴点评因依赖录音转写内容，保留实时但增加任务中心兜底 |
| **优先级** | **P0** |

---

### P1 — 中优先级改造项

#### F05 · 每周夜话模块（WeeklyChatModule）— 心智投喂分析

| 属性 | 详情 |
|------|------|
| **当前行为** | 输入本周内容 → `runWeeklyChatEnhanced()` 实时调 Dify `/api/weekly-chat/enhanced` 分析并重组下周训练计划 |
| **涉及文件** | `src/components/modules/WeeklyChatModule.tsx`, `vocab-server/server.js`（weekly-chat/enhanced 路由） |
| **Dify 工作流类型** | 分析 + 推荐配置生成 |
| **改造方案** | 因输入完全由用户提供，无法提前预生成完整结果。但可将 fallback 逻辑（本地关键词映射）提速至 <500ms 作为一级降级；Dify 结果通过任务中心异步返回后覆盖展示 |
| **优先级** | **P1** |

#### F06 · 双周复盘模块（BiweeklyReviewModal）— 弱点扫描与训练调整

| 属性 | 详情 |
|------|------|
| **当前行为** | 填写四维自省问卷 → `runBiweeklyReviewAnalysis()` 实时调 Dify 分析弱点并调整画像 |
| **涉及文件** | `src/components/modules/BiweeklyReviewModal.tsx` |
| **Dify 工作流类型** | 分析 + 画像更新 |
| **改造方案** | 低频操作（每两周一次），保留实时但增加 3秒超时提示 + 任务中心兜底 |
| **优先级** | **P1** |

#### F07 · 高端审美模块（EntertainmentModule）— 审美规则与日常推送

| 属性 | 详情 |
|------|------|
| **当前行为** | 点击「获取今日审美推送」→ 后端 `aestheticsPushService.generateWithDify()` 实时生成 |
| **涉及文件** | `src/components/modules/EntertainmentModule.tsx`, `vocab-server/services/aestheticsPushService.js`, `aestheticsFallback.js` |
| **Dify 工作流类型** | 内容生成 |
| **改造方案** | 已有 `aestheticsFallback.js` 本地兜底；增加夜间 cron 预生成次日推送，覆盖 social/aesthetics 两类各 5 个场景 |
| **优先级** | **P1** |

#### F08 · 口语沙盘（Oral War Room）— 开场白缓存 + 对话流

| 属性 | 详情 |
|------|------|
| **当前行为** | 选择场景 → `oralOpeningCacheService.callDifyOpening()` 实时生成开场白（已有120s超时）；对话中 `sendOralChatMessage()` 实时流式 |
| **涉及文件** | `src/components/modules/oralWarRoom/useOralDialogue.ts`, `vocab-server/services/oralOpeningCacheService.js` |
| **Dify 工作流类型** | 对话式（streaming） |
| **改造方案** | 开场白已有缓存服务但未接入统一 cron；将开场白预生成纳入夜间批量；对话流保留实时（交互性强不适合预生成），但增加断线重连 + 任务中心兜底 |
| **优先级** | **P1** |

---

### P2 — 低优先级 / 不改造项

#### F09 · 词汇提纯（Vocab Purification）

| 属性 | 详情 |
|------|------|
| **当前行为** | 上传文章 → `callVocabPurify()` 实时提取词汇短语 |
| **涉及文件** | `src/components/CustomCardModal.tsx`, `TextHighlighter.tsx`, `vocab-server/services/vocabPurifyService.js` |
| **不改造理由** | 输入完全依赖用户上传的任意文本，无法预判；且已通过 `taskQueue` 走异步任务模式（`material` 类型） |
| **结论** | **无需改造**（已符合异步模式） |

#### F10 · 词汇矩阵补全（Vocab Matrix Enrichment）

| 属性 | 详情 |
|------|------|
| **当前行为** | 新增词汇 → `runMemoryAidWorkflow()` 后台调 Dify 生成词根联想助记 |
| **涉及文件** | `vocab-server/services/vocabMatrixEnricher.js` |
| **不改造理由** | 已在后台静默执行，用户无感知等待；失败有本地 fallback |
| **结论** | **无需改造**（已符合异步模式） |

#### F11 · 材料上传与知识库导入

| 属性 | 详情 |
|------|------|
| **当前行为** | 上传材料 → `processMaterialsAndExtract()` 通过 `taskQueue` 异步处理 |
| **涉及文件** | `src/components/MaterialUploader.tsx`, `TaskContext.tsx` |
| **不改造理由** | 已走 `material` 类型任务队列，符合异步模式 |
| **结论** | **无需改造**（已符合异步模式） |

#### F12 · 写作三段式公文批阅（WriteTab）

| 属性 | 详情 |
|------|------|
| **当前行为** | 输入公文 → `runWritingReviewEngine()` 实时批阅 |
| **涉及文件** | `src/components/modules/english/tabs/WriteTab.tsx` |
| **改造方案** | 因输入完全由用户提供，无法预生成；但可增加 3秒超时提示 + 任务中心兜底（同 F05/F06 模式）。列为 P2 待后续迭代 |
| **结论** | **P2 待改造** |

---

## 3. 用户体验与验收标准

### 核心流程

```
[用户点击按钮]
       │
       ▼ (并行发起)
   ┌─────────────────────────────┐
   │ GET /api/pregen/{feature}   │ ← 查询预生成缓存
   └─────────────────────────────┘
       │                    │
    命中(≤3s)           未命中(>3s)
       │                    │
       ▼                    ▼
  直接展示内容        提交 POST /api/task/{feature}/backfill
                           │
                           ▼
                     Toast: "已加入任务中心"
                     任务中心显示进度条
                           │
                       完成(成功)
                           │
                           ▼
                  任务中心提示: "已完成，点击查看"
                  用户点击 → 跳转对应功能页
```

### 用户故事

| ID | 故事 | 验收条件 |
|----|------|----------|
| US01 | 作为学习者，我希望点击「获取案例」后在3秒内看到内容 | 缓存命中时 P95 响应 ≤3s |
| US02 | 作为学习者，当预生成内容未就绪时，我不想一直等待 | >3s 时 UI 在1s内显示"已加入任务中心"提示 |
| US03 | 作为学习者，我需要在任务中心看到生成进度 | 进度条每5秒刷新一次，显示百分比 |
| US04 | 作为学习者，生成完成后我需要被引导回原功能查看 | 任务完成后任务中心显示"查看"按钮+目标页面路径 |
| US05 | 作为系统管理员，我希望夜间自动预生成次日内容 | cron 日志显示每日00:00启动，完成率≥80% |

### 非目标（Non-Goals）

- ❌ 不改造 Dify 工作流本身的 Prompt 或逻辑定义
- ❌ 不引入 Redis/MQ 等新基础设施（复用现有 SQLite + taskQueue）
- ❌ 不改变非案例类实时交互（如口语对话流、语音识别）
- ❌ 本 PRD 仅覆盖产品需求，不含技术实现细节

---

## 4. 技术规格概要

### 架构总览

```
┌──────────────────────────────────────────────────────────┐
│                    前端 (React)                            │
│  ┌────────────┐  ┌────────────┐  ┌───────────────────┐   │
│  │ ListenModule│  │ ReadModule │  │ GameTheoryModule  │   │
│  │ SpeakModule │  │ WeeklyChat │  │ Entertainment     │   │
│  └──────┬─────┘  └─────┬──────┘  └────────┬──────────┘   │
│         │               │                   │              │
│         └───────────────┼───────────────────┘              │
│                         ▼                                  │
│          ┌──────────────────────────┐                      │
│          │ unifiedPregenAPI.ts      │                      │
│          │ - fetchCached(feature)   │                      │
│          │ - submitBackfill(feature)│                      │
│          │ - pollTaskStatus(id)     │                      │
│          └────────────┬─────────────┘                      │
│                        ▼                                   │
│          TaskContext.tsx (复用现有)                          │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP
                         ▼
┌──────────────────────────────────────────────────────────┐
│                 vocab-server (Express)                     │
│  ┌───────────────────────────────────────────────────┐   │
│  │ unifiedPreGenerateService.js                       │   │
│  │ - getFeatureConfig(feature) → {cron, dimensions,   │   │
│  │   difyWorkflowKey, cacheTable, ttlDays}            │   │
│  │ - runBatch(userId, feature, queryKey, date)        │   │
│  │ - getCached(userId, feature, queryKey, profileHash)│   │
│  │ - writeback(userId, feature, queryKey, profileHash, │   │
│  │   result)                                           │   │
│  │ - validateSessionUser(userId, profileHash)         │   │
│  └───────────────┬───────────────────────────────────┘   │
│                  ▼                                        │
│  ┌───────────────────────────────────────────────────┐   │
│  │ dailyPackCron.js (扩展)                             │   │
│  │ 00:00 → daily-pack → listen-pregen → insight-pool  │   │
│  │        → read-material → gt-analysis → speak-matrix│   │
│  │        → aesthetics-push                            │   │
│  │ 并行度: p-limit(8)                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  ┌───────────────────────────────────────────────────┐   │
│  │ pregen_results (SQLite 表)                          │   │
│  │ user_id | feature | query_key | profile_hash       │   │
│  │ condition_hash | date | status | payload           │   │
│  │ created_at | expires_at                              │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
              Dify Workflow API (外部)
```

### 账号与查询条件绑定规则（强制）

1. **身份来源**：所有查询、生成、回填、任务状态读取均以后端会话解析出的当前登录账号为准；前端传入的 `userId` 只作展示或兼容字段，服务端不得信任，禁止用它切换数据范围。
2. **画像条件**：允许使用当前账号的“账号画像 hash”（`profile_hash`）作为个性化条件。画像 hash 必须由服务端根据当前账号画像计算或读取，前端不得直接指定、替换或伪造。
3. **条件完整性**：缓存命中键必须同时包含 `user_id + feature_id + normalized_query + condition_hash + profile_hash + content_date`。缺少任一字段时视为未命中，不允许降级为同模块、同日期或同画像的共享内容。
4. **规范化与防篡改**：服务端按模块白名单过滤字段、统一枚举/排序/空值规则后生成 `normalized_query` 与 `condition_hash`；任务创建后从服务端保存的条件读取执行参数，客户端不得通过修改任务请求复用其他条件结果。
5. **Dify 侧身份**：调用 Dify Workflow API 时，`user` 使用稳定的当前账号标识；`inputs` 同时携带模块查询条件与 `profile_hash`。不得以公共账号、随机 ID 或仅使用画像 hash 代替账号 ID。
6. **存储隔离**：数据库查询必须使用当前会话账号与完整条件联合过滤；唯一约束至少覆盖 `(user_id, feature_id, condition_hash, profile_hash, content_date)`。越权、条件不完整或画像 hash 不匹配时统一返回未命中/拒绝，不返回近似结果。
7. **画像变更**：账号画像 hash 变化后，旧结果不可用于新画像；旧记录可保留用于审计，但必须标记过期或失效，重新生成新条件结果。

### 各模块前台查询条件定义（以当前功能为准）

| feature_id | 前台功能 | 必须进入查询条件的字段 |
|------------|----------|------------------------|
| `listen_insight_pool` | ListenModule 案例池 | `category`、`difficulty`、`scenario_type`、`pool_size`、`pack_date`、当前 `profile_hash` |
| `read_daily_material` | ReadModule 今日推送 | `scene_type`、`framework`、`difficulty`、`topic`、`pack_date`、当前 `profile_hash` |
| `gt_preset_analysis` | GameTheoryModule 预设分析 | `preset_case_id`、`environment`、`analysis_depth`、`language`、当前 `profile_hash` |
| `speak_influence_matrix` | SpeakModule 影响力引擎 | `scenario_id`、`dimension`、`structure`、`tone`、`language`、当前 `profile_hash` |
| `aesthetics_daily_push` | EntertainmentModule 每日推送 | `active_tab`、`category`、`scenario_id`、`push_date`、当前 `profile_hash` |
| `oral_opening_cache` | Oral War Room 开场白 | `scene_id`、`role_set`、`difficulty`、`language`、`opening_version`、当前 `profile_hash` |
| `weekly_chat_enhanced` | WeeklyChatModule 实时分析 | `content_hash`、`directions`、`week_range`、当前 `profile_hash` |
| `biweekly_review_analysis` | BiweeklyReviewModal 复盘 | `answers_hash`、`review_period`、当前 `profile_hash` |
| `write_review` | WriteTab 批阅 | `variant`、`active_module`、`write_intent`、`writing_content_hash`、`benchmark_hash`、当前 `profile_hash` |
| `vocab_purify` | 词汇提纯 | `source_content_hash`、`language`、`extraction_mode`、当前 `profile_hash` |

> 说明：实时交互也必须遵守同一绑定规则；“不预生成”不等于“可跨账号/跨条件读取”。仅对完全由当前用户运行时输入决定的内容使用输入 hash，禁止使用不完整条件命中。

### 统一预生成配置表

| feature_id | 模块 | 预生成维度组合 | Cron 时间 | 缓存TTL | 回退策略 |
|------------|------|---------------|-----------|---------|----------|
| `listen_insight_pool` | 听力 | category × pool_size | 00:15 | 24h | FALLBACK_SCENARIOS 内置 |
| `read_daily_material` | 阅读 | scene_type × framework = 3×3=9组 | 00:20 | 24h | 手动录入 |
| `gt_preset_analysis` | 博弈 | PRESET_CASES 5条 × env | 00:25 | 48h | 内置预设描述 |
| `speak_influence_matrix` | 口语 | scenario × structure Top50 | 00:35 | 72h | THEORIES 内置模板 |
| `aesthetics_daily_push` | 审美 | category × scenario 10条 | 00:45 | 24h | aestheticsFallback |
| `oral_opening_cache` | 沙盘开场白 | scenes × roles 高频Top20 | 00:55 | 48h | 默认开场白 |

### API 契约

#### GET `/api/pregen/:feature`

```json
// 请求 Query：userId/profileHash 由服务端会话和账号画像解析，前端不可覆盖
{ "feature": "listen_insight_pool", "conditions": { "category": "gov_struggle", "difficulty": 4, "scenario_type": "insight", "pool_size": 5, "pack_date": "2026-08-26" } }

// 服务端内部命中键
{ "userId": "session-user-123", "profileHash": "sha256:...", "conditionHash": "sha256:...", "date": "2026-08-26" }

// 命中响应 (HTTP 200)
{ "hit": true, "status": "ready", "payload": { ... }, "generatedAt": "2026-08-25T16:00:00Z", "scope": { "feature": "listen_insight_pool", "conditionHash": "sha256:..." } }

// 部分响应
{ "hit": true, "status": "partial", "payload": { ... }, "missingKeys": ["audio"] }

// 未命中响应 (HTTP 200)
{ "hit": false, "status": "missing", "canBackfill": true }
```

#### POST `/api/pregen/:feature/backfill`

```json
// 请求：服务端从会话取 userId/conditions，从账号画像取 profileHash
{ "feature": "listen_insight_pool", "conditions": { "category": "gov_struggle", "difficulty": 4, "scenario_type": "insight", "pool_size": 5, "pack_date": "2026-08-26" } }
// 任务参数由服务端固化，不接受客户端拼接的 params 字段

// 响应（立即返回，不等待 Dify）
{ "success": true, "taskId": "task_xxx", "status": "pending", "scope": { "feature": "listen_insight_pool", "conditionHash": "sha256:..." } }
```

### 安全与隐私

- 预生成、实时查询、回填、任务详情均按当前会话 `user_id` 隔离，禁止跨用户查询或复用。
- 查询必须绑定模块完整条件；禁止仅按 `feature`、日期、category、输入 hash 或 profile hash 单独命中。
- `profile_hash` 只允许服务端计算/读取；画像原文不进入缓存键、任务中心展示或日志，Dify inputs 仅传脱敏画像数据或 hash。
- Dify API Key 仅存在于服务端 `.env`，前端零暴露。
- 缓存过期自动清理，默认 TTL 见上表；画像 hash 变化立即使旧个性化结果失效。
- 任务详情、任务取消、任务结果读取均校验任务所属 `user_id` 与 `condition_hash`，不接受客户端替换作用域。

---

## 5. 风险与路线图

### 分阶段交付

| 阶段 | 范围 | 交付物 |
|------|------|--------|
| **MVP (v0.9)** | F02 ReadMaterial + F07 Aesthetics | 统一预生成 service + cron 扩展 + 前端缓存读取 + backfill API |
| **v1.0** | F03 GameTheory + F04 SpeakMatrix + F01 ListenInsightPool | 全量 P0 功能接入 + TaskCenter UI 增强（进度百分比+完成跳转） |
| **v1.1** | F05 WeeklyChat + F06 Biweekly + F08 OralOpening | P1 功能接入 + 3秒超时统一组件抽取 |
| **v1.2** | F12 WriteTab + 性能监控面板 | P2 补全 + 预生成命中率 Dashboard |

### 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Dify API 限流导致夜间批量部分失败 | 次日命中率下降 | 重试队列 + p-limit(8) 控制并发 + fallback 兜底 |
| 用户画像变更后预生成内容过期 | 内容个性化不足 | 画像 hash 作为 cache_key 一部分，变更时标记 invalid |
| 多用户并发预生成内存/CPU 压力 | 服务不稳定 | 按活跃度排序分批执行，限制同时处理用户数 |
| 预生成存储空间膨胀 | DB/磁盘压力 | TTL 过期清理 + 单用户总量上限（参考 listen 的 1024MB） |
| 前端3秒竞态（缓存查询 vs 超时判定） | 体验不一致 | 统一封装 `usePregenWithFallback()` hook，内部管理 Promise.race |

### 红队审查

| 攻击面 | 场景 | 防护 |
|--------|------|------|
| 缓存投毒 | 用户伪造 userId 查询他人缓存 | 服务端 session 校验 + row-level security |
| Dify 注入 | 用户恶意构造 inputs 触发 prompt injection | 复用现有 `profileHelper.stripThinkTags()` + input sanitization |
| 任务风暴 | 大量用户同时提交 backfill | rate limit per user per feature (e.g. 3/min) + queue dedup |
| 数据泄露 | pregen payload 包含其他用户信息 | 生成时严格绑定 userId，查询时二次校验 |

---

## 附录A：现有代码证据索引

| 功能点 | 前端入口 | 后端服务 | 现有任务类型 |
|--------|----------|----------|-------------|
| F01 | `ListenModule.tsx` L32 | `insightDailyCron.js` | `insight_listen`, `insight_case_backfill` |
| F02 | `ReadModule.tsx` L14 | `readPenetrationProxy.js` | 无 |
| F03 | `GameTheoryModule.tsx` L25 | `gameTheorySessionService.js` | `game_theory` |
| F04 | `SpeakModule.tsx` L31 | `insightSpeakProxy.js` | `speak` |
| F05 | `WeeklyChatModule.tsx` L5 | `server.js` weekly-chat/enhanced | 无 |
| F06 | `BiweeklyReviewModal.tsx` L3 | 无独立服务 | 无 |
| F07 | `EntertainmentModule.tsx` | `aestheticsPushService.js` | 无 |
| F08 | `useOralDialogue.ts` | `oralOpeningCacheService.js` | 无 |
| F12 | `WriteTab.tsx` | 无独立服务 | 无 |

## 附录B：TaskContext.tsx 现有任务类型清单

```
url | video | material | tts | game_theory | listen_backfill | vocab_export |
tactics_export | vault_export | vault_refine | tactics_ingest | insight_listen |
insight_case_backfill | insight_daily_cron | speak | vocab_add | theme_delete |
daily_extract
```

新增建议类型：`pregen_backfill`（通用）或按 feature 拆分为独立 type。
