# Interview Transcript: vocab-zone-cambridge-collect

**Profile:** Standard | **Threshold:** 0.20 | **Final ambiguity:** ≈8%  
**Rounds:** 12（含 Refine 9–12） | **Context:** `.omx/context/vocab-zone-cambridge-collect-20260830T085200Z.md`

## Round Summary

| Round | Dimension | Question | Answer |
|-------|-----------|----------|--------|
| 1 | Scope | 「所有收录」范围？ | **全部收录入口统一弹选，覆盖现有自动/硬编码路由** |
| 2 | Outcome | 分区选择交互形态？ | **每条卡片两个按钮：「+ 政商务」「+ 全场景」** |
| 3 | Decision boundary | 同词两区重复收录？ | 最初选 block-second（后被 Round 8 统一） |
| 4 | Constraints | 单词 Cambridge 获取时机？ | **与词典面板收录完全一致**（buildVocabPayloadFromDict + Cam merge） |
| 5 | Constraints | 短语/句型数据来源？ | **收录时再跑一遍 Dify 词典工作流** |
| 6 | Non-goals | 明确不在范围内？ | 不改布局配色、不改表结构、不改额度、不改矩阵/SOP、不迁移历史 |
| 7 | Pressure | 历史已收录词条 Grid 展示？ | 允许重新选分区（会改 category） |
| 8 | Decision boundary | block vs migrate 统一规则？ | **migrate-on-click：另一分区按钮可点 = 迁移分区** |
| 9 | Constraints | 短语/句型 Dify 路径？ | **均走 `en_zh_bidirectional` dict-query（纯 Dify）** |
| 10 | Outcome | 迁移时要确认吗？ | **直接迁移，无确认框** |
| 11 | Outcome | 收录中两按钮状态？ | **被点按钮 collecting+disabled；另一 idle** |
| 12 | Edge case | 收录中途点另一分区？ | **提示「正在收录至XX，请稍候」，不切换** |

## Pressure Pass Finding

Round 3（互斥置灰）与 Round 7（历史可重选）存在张力；Round 8 裁决为 **migrate-on-click**，最终语义：

- 已收录词条在当前分区按钮显示「已收录」态；
- 另一分区按钮仍可点击，点击后将 `category` 迁移至目标分区（不新建重复词条）；
- 历史硬编码收录的词条同样适用迁移规则（不批量迁移，但用户可手动点另一分区完成迁移）。

## Clarity Breakdown (final)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.95 | 用户显式控分区 + 单词 Cambridge 质量 |
| Outcome | 0.90 | 双按钮 + 迁移语义明确 |
| Scope | 0.95 | 全入口覆盖 |
| Constraints | 0.90 | 对齐词典面板；短语/句型重跑 Dify |
| Success | 0.85 | 见 spec 验收标准 |
| Context | 0.90 | 代码 touchpoints 已定位 |

**Weighted ambiguity (brownfield):** ≈8%

## Readiness Gates

- [x] Non-goals explicit
- [x] Decision boundaries explicit (migrate-on-click)
- [x] Pressure pass complete (Round 3/7/8)
- [x] Practical closure audit pass
