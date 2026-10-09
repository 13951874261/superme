# Spec: 收录分区选择 + Cambridge/Dify 数据源分工

## Metadata

| Field | Value |
|-------|-------|
| Profile | Standard |
| Rounds | 12（含 Refine 9–12） |
| Final ambiguity | ≈5% |
| Threshold | 0.20 |
| Context type | Brownfield |
| Context snapshot | `.omx/context/vocab-zone-cambridge-collect-20260830T085200Z.md` |
| Transcript | `.omx/interviews/vocab-zone-cambridge-collect-20260830T090000Z.md` |

## Intent（为什么做）

1. **分区由用户决定**：不再依赖代码硬编码（如进度总控一律政商务、精听一律全场景）或主题自动推断。
2. **单词质量对齐词典页**：生词本中单词的核心英汉字段应来自 Cambridge（英汉双向译制），与词典面板收录体验一致。
3. **短语/句型走 Dify**：非单词内容不查 Cambridge，收录时重新调用 Dify 词典工作流获取最新结果。

## Desired Outcome

- 所有收录入口（进度总控、材料、词典、精听、闪卡、高亮、每日模块等）在收录动作上提供 **两个并列按钮**：「+ 政商务」「+ 全场景」。
- 用户点击哪个按钮，词条写入对应 `category`（`business` / `general`）。
- 单词收录路径与 `DictionaryPanel` + `buildVocabPayloadFromDict` + Cambridge merge 一致。
- 短语/句型收录时触发 Dify 词典工作流，用返回结果写入/种子化 payload。
- 已收录词条支持 **migrate-on-click**：点另一分区按钮 = 迁移 category，不新建重复行。

## In-Scope

### 1. 分区选择 UI（全入口）

- 将单一「+ 收录」/「收录至生词本」改为双按钮：「+ 政商务」「+ 全场景」（文案可微调，语义不变）。
- 覆盖 `useVocabCollect` 所有调用方，包括但不限于：
  - `VocabularyGrid` / `DashboardTab`（截图场景）
  - `DictionaryPanel`
  - `ListenTab`、`FlashCard`、`TextHighlighter`、`ImmersiveReader`
  - `DailyWakeupModule`、`DailyErrorVocabularyModule`
  - 其他走 `useVocabCollect` 或等效收录 API 的入口
- `CustomCardModal`：已有分区选择，可保持表单内 Segment，但行为需与其余入口 **category 语义一致**（不必强行改成双按钮，除非实现更简单）。

### 2. category 传参

- `useVocabCollect` 增加 `category: 'business' | 'general'` 参数，移除硬编码 `category: 'business'`。
- 异步 batch 路径（3 秒超时转任务中心）同样传递 category。
- 后端 `enrichAndPersistVocabEntry` / `batch-add-async` 沿用现有 `category` 字段，**不改表结构**。

### 3. 单词数据源（Cambridge 优先）

- 收录单词时，**完全对齐词典面板**：
  - 调用 `/api/dify/dict-query`（`en_zh_bidirectional`）或等价已有封装；
  - 经 `buildVocabPayloadFromDict` / `mergeCambridgeWithDify` 合并；
  - Cambridge 优先字段：音标、词性、主释义、例句、其他义项等（与现有 `cambridgeDictionary.js` en_zh 模式一致）；
  - Dify 补缺字段：同义词、反义词、搭配等。
- 进度总控/材料 Grid 收录单词时，**不得**仅依赖 `asyncMeanings` 薄缓存作为最终入库 payload。

### 4. 短语/句型数据源（Dify 重跑）

- **短语与句型统一路径**：均调用 `/api/dify/dict-query` + `en_zh_bidirectional`（后端 `useEnZhDifySyncPath`：非单词、同步等待 Dify，不走 Cambridge）。
- 用工作流返回填充释义、翻译等可见字段；矩阵/SOP/记忆节点补齐逻辑 **保持不变**（用户明确 non-goal）。
- 有 `dict_query_log` 缓存时优先命中缓存（后端现有行为）。

### 5. 已收录 / 迁移 UX（migrate-on-click）

- DB 仍按 `user_id + word` 去重（单条记录）。
- 词条已存在于分区 A：
  - 分区 A 按钮：「已收录」态；
  - 分区 B 按钮：**可点击**，点击后 **直接迁移**（无确认框）`category` 至 B（不 INSERT 新行）。
- 历史硬编码收录的词条：**不批量迁移**；用户在 Grid 上点另一分区按钮即可完成迁移。
- `vocabDetailsMap` 需携带 `category`，以便 UI 正确渲染两按钮状态。

### 6. 双按钮收录中 / 中途点击

- 用户点击分区 A 的收录按钮后：
  - **A 按钮**：disabled + 「收录中…」；
  - **B 按钮**：保持 idle 外观，但 **不可真正切换**。
- 收录进行中若用户点击 B：提示「正在收录至政商务区，请稍候」（分区名随当前目标动态替换），不取消、不排队二次收录。

## Out-of-Scope / Non-goals

- ❌ 卡片整体布局/配色 redesign（仅收录按钮区增第二个按钮）
- ❌ 数据库表结构变更（不支持同词两区各存一条）
- ❌ 今日收录额度逻辑变更
- ❌ 词汇矩阵 / 记忆节点 / 高管 SOP 补齐逻辑变更
- ❌ 历史词条批量迁移脚本

## Decision Boundaries（OMX 可自行决定）

- 双按钮具体 CSS/class 命名，保持与现有设计 token 一致即可。
- `CustomCardModal` 是否改为 literal 双按钮，或保留 Segment（只要 category 语义一致）。
- 短语/句型调用 Dify 时使用的 `dictType` / direction 参数，在现有后端支持的范围内选择。
- 迁移成功后 toast/notify 文案（如「已移至全场景区」）。
- 收录进行中（collecting/queued）时两按钮的 disabled 策略。

## Constraints

- 保留现有 3 秒收录竞速 + 任务中心 handoff。
- 保留「提取 ≠ 收录」语义。
- 复用 `buildVocabPayloadFromDict`、`mergeCambridgeWithDify`、`queryDictionaryWithEnrichmentPoll` 等成熟路径，不重复造轮子。
- 前端 Dify API Key 仍不暴露（经后端代理）。

## Testable Acceptance Criteria

### AC-1 双按钮全入口

- [ ] 进度总控三区（生词/短语/句型）每条候选显示「+ 政商务」「+ 全场景」。
- [ ] 词典面板原「收录至生词本」变为两个分区按钮。
- [ ] 精听/闪卡/高亮等原先硬编码 category 的入口，改为用户点选，不再 silent 写入。

### AC-2 单词 Cambridge 对齐词典页

- [ ] 从 Grid 收录单词 `legal` 至政商务后，生词本 payload 含 Cambridge 来源音标/释义/例句（与词典面板收录同词字段来源一致）。
- [ ] 不得仅写入 `asyncMeanings` 悬浮缓存的 meaning/phonetic 作为最终态。

### AC-3 短语/句型 Dify 重跑

- [ ] 收录短语 `take late goods` 时走 `en_zh_bidirectional` dict-query（纯 Dify 同步路径），生词本释义来自工作流返回。
- [ ] 收录句型 `Procurement review, London.` 走 **同一路径**，不走 Cambridge。

### AC-4 migrate-on-click

- [ ] `legal` 已在政商务区 → 政商务按钮「已收录」，全场景按钮可点。
- [ ] 点击全场景 → **无确认框**，`category` 直接变为 `general`。
- [ ] 不产生两条 `legal` 记录。

### AC-6 收录中交互

- [ ] 点「+ 政商务」后，该按钮变「收录中…」且 disabled。
- [ ] 收录完成前点「+ 全场景」→ 提示「正在收录至政商务区，请稍候」，不触发第二次收录。

### AC-5 Non-goals 回归

- [ ] 3 秒超时仍转任务中心；矩阵/SOP 仍后台补齐。
- [ ] 额度 UI/逻辑无变化。
- [ ] 历史词条未被批量改写；用户手动迁移仍可用。

## Assumptions & Resolutions

| Assumption | Resolution |
|------------|------------|
| 「所有收录」含精听/闪卡 | Round 1 确认：全入口覆盖 |
| 双按钮 vs 弹窗 | Round 2：split-buttons |
| 同词两区 | Round 8：单记录 + migrate-on-click |
| Grid 单词 Cam 来源 | Round 4：对齐词典面板 |
| 短语/句型来源 | Round 5/9：均走 `en_zh_bidirectional` dict-query（纯 Dify） |
| 迁移确认 | Round 10：直接迁移，无确认框 |
| 收录中按钮态 | Round 11/12：被点按钮 collecting；另一按钮 idle 但点击仅提示稍候 |

## Brownfield Evidence

- `[from-code][auto-confirmed]` `useVocabCollect.ts:105` 硬编码 `category: 'business'`
- `[from-code][auto-confirmed]` `buildVocabPayloadFromDict` 已实现 Cam-first（`vocabAPI.ts`）
- `[from-code][auto-confirmed]` `mergeCambridgeWithDify` en_zh 模式 Cam 优先例句/释义（`cambridgeDictionary.js`）
- `[from-code][auto-confirmed]` `runVocabEntryEnrichment` 仅在 payload 含 `cambridge_raw` 时 merge，Grid 路径目前不满足
- `[from-code]` 去重键 `user_id + word`，无 per-category 唯一

## Docs / Terminology Ledger

| 用户/UI | 代码 |
|---------|------|
| 政商务区 | `category: 'business'` |
| 全场景区 | `category: 'general'` |
| 英汉双向译制 | `dictType: 'en_zh_bidirectional'` |
| 收录 | `useVocabCollect` → `addWordEnriched` |

## Likely Touchpoints

- `src/hooks/useVocabCollect.ts`
- `src/components/modules/english/tabs/dashboard/VocabularyGrid.tsx`
- `src/components/modules/english/tabs/DashboardTab.tsx`
- `src/components/DictionaryPanel.tsx`
- `src/services/vocabAPI.ts`
- ListenTab / FlashCard / TextHighlighter / ImmersiveReader / Daily* modules
- `vocab-server/server.js`（batch-async category 传递、短语/句型 Dify 触发若需后端补全）

## Residual Risks

- 全入口改双按钮涉及文件较多，需逐入口回归 AC-1。
- Dify dict workflow prompt 侧重「词或短语」；整句输入的质量依赖工作流表现，句型若返回不佳需后续调 prompt（本次不改工作流）。

## Execution Handoff Options

规格已就绪（ambiguity ≈8% < 0.20）。请选择下游执行路径：

1. **`$ultragoal`**（推荐）—  durable goal 跟踪实现 + 验证
2. **`$ralplan`** — 若需先共识架构/测试形状
3. **`$autopilot`** — 直接规划 + 实现 + QA
4. **`$team`** — 多 lane 并行（入口多、适合协调）
5. **Refine further** — 继续澄清（如短语 Dify dictType 细节）

**请勿在 deep-interview 模式内直接改代码**；待您确认 handoff 后再执行。
