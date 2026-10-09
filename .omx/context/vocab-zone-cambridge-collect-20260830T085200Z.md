# Context Snapshot: vocab-zone-cambridge-collect

**Timestamp:** 20260830T085200Z  
**Task slug:** vocab-zone-cambridge-collect

## Task Statement

用户要求两项改动：
1. 所有收录的单词、短语、句型，点击「+ 收录」时需让用户选择进入【政商务区】或【全场景区】。
2. 生词本字段：单词在【英汉双向译制】模式下优先取 Cambridge 结果，其余字段取 Dify 工作流；短语和句型直接取 Dify 工作流返回。

## Desired Outcome

- 收录动作统一弹出/展示分区选择（business / general）。
- 单词入库 payload 遵循 Cam-first + Dify 补缺策略（与词典面板已有逻辑对齐）。
- 短语/句型入库 payload 直接来自 Dify（长文/材料提取或矩阵补齐路径）。

## Stated Solution

- UI：收录前选择政商务区 vs 全场景区。
- 数据源：单词 → Cambridge 优先（en_zh_bidirectional 字段）+ Dify 其他；短语/句型 → 纯 Dify。

## Probable Intent Hypothesis

- 用户希望分区不再由代码硬编码或场景自动推断，改由用户显式决定。
- 单词释义质量需与词典查询页一致（Cambridge 权威音标/释义/例句），避免仅依赖 Dify 或悬浮翻译缓存。
- 截图场景为进度总控 VocabularyGrid 三区收录按钮。

## Known Facts / Evidence [from-code]

| 发现 | 位置 |
|------|------|
| `useVocabCollect` 硬编码 `category: 'business'` | `src/hooks/useVocabCollect.ts:105` |
| `CustomCardModal` 已有政商务/全场景切换 UI | `src/components/CustomCardModal.tsx:29,450-459` |
| `ListenTab` / `FlashCard` 硬编码 `general` | `ListenTab.tsx`, `FlashCard.tsx` |
| `TextHighlighter` / `ImmersiveReader` 按主题自动判定 category | 对应组件 |
| `buildVocabPayloadFromDict` 已实现 Cam-first + Dify 补缺 | `src/services/vocabAPI.ts:214+` |
| `DictionaryPanel` 收录走 `buildVocabPayloadFromDict` | `DictionaryPanel.tsx` |
| `DashboardTab.handleAddWordToVocab` 仅传 `asyncMeanings` 薄 payload，非完整 Cambridge | `DashboardTab.tsx:560-571` |
| DB 字段 `vocabulary.category` = `'business'` \| `'general'` | `vocab-server/server.js` |
| 短语/句型 `dict_type` = `ai_phrase` / `ai_sentence` | 收录链路 |

## Constraints

- 不改变「提取 ≠ 收录」语义（候选词表不自动入库）。
- 现有 3 秒收录竞速 + 任务中心 handoff 机制应保留（待确认）。
- AGENTS.md：需求确认后才修改；优先复用成熟方案。

## Unknowns / Open Questions

1. 「所有收录入口」是否包含 ListenTab、FlashCard、TextHighlighter、DictionaryPanel、DailyError、DailyWakeup、CustomCardModal？
2. 分区选择 UI 形态：弹窗 / 按钮旁下拉 / 记住上次选择？
3. 同一词条是否允许同时存在于两个分区？
4. 单词从 VocabularyGrid 收录时，是否在点击时同步拉取完整 Cambridge payload（类似 DictionaryPanel）？
5. 「英汉双向译制优先字段」的精确字段清单是否与 `buildVocabPayloadFromDict` / `mergeCambridgeWithDify` 一致？
6. 短语/句型「直接取 Dify」是指长文提取 JSON 还是收录后 matrix enricher / dict-query？

## Decision-Boundary Unknowns

- 是否覆盖/替换现有按场景自动路由（精听→全场景区）？
- CustomCardModal 已有分区选择，是否改为与其他入口一致的交互？
- 后端 batch-add-async 路径是否也要传 category？

## Likely Codebase Touchpoints

- `src/hooks/useVocabCollect.ts` — category 参数化 + 选择 UI 触发点
- `src/components/modules/english/tabs/dashboard/VocabularyGrid.tsx` — 截图入口
- `src/components/modules/english/tabs/DashboardTab.tsx` — handleAddWordToVocab
- `src/components/DictionaryPanel.tsx` — 词典收录
- `src/services/vocabAPI.ts` — buildVocabPayloadFromDict / addWordEnriched
- `vocab-server/services/cambridgeDictionary.js` — merge 逻辑
- 各 hardcoded category 入口组件

## Docs / Rules Inspected

- `AGENTS.md` — 中文、需求确认、最小改动
- `.omx/specs/deep-interview-material-purify-manual-collect.md` — 手动收录语义
- `.omx/specs/deep-interview-en-en-cambridge-single.md` — Cam-first 模式参考
- `docs/superpowers/specs/2026-08-20-long-article-cache-manual-vocab-design.md`

## Terminology Notes

| 用户/UI | 代码 |
|---------|------|
| 政商务区 | `category: 'business'` |
| 全场景区 | `category: 'general'` |
| 英汉双向译制 | `dictType: 'en_zh_bidirectional'` |
| 收录 | `useVocabCollect` / `add-enriched` |

## Prompt-Safe Summary Status

`not_needed` — 用户输入与截图上下文在预算内。
