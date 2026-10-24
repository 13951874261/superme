# G001 Contract — memory-aid-vertical-align

Status: **awaiting user confirmation** (no FlashCard/MemoryAid code changes until confirmed)

## Residual defaults (from brief; confirm or override)

| # | Topic | Proposed default |
|---|--------|------------------|
| R1 | 「展开更多」后 | **A**：左栏变为完整例句列表；右四卡**暂停**严格 4↔4 GSAP 贴合（保留纵向四卡与限高内滚）。再次折叠回 4 槽后恢复贴合。 |
| R2 | 图片卡限高内 | **A**：缩略图 + 点击放大/lightbox（沿用现有图片 Tab 能力若已有） |

## 例句取数优先级（提案）

复用已有工具，**不新造解析规则**：

1. **首选** `extractCambridgeDisplayExamples(payload)`  
   - senses[].examples → 否则 `example_sentences`  
   - 已含字母数 >25、禁音标等展示过滤（与词典截图一致）
2. **若为空**，回退展开 `getExampleSentences` 同源数组（按现有顺序取第一个非空数组）：  
   `example_sentences` → `scenarios` → `business_examples` → `examples` → `example`  
   再拆成 `{en,zh}[]`（按行/对象），并尽量套用同一 admissibility 过滤
3. **去重**：以规范化英文句为 key
4. **槽位**：
   - `all = list`
   - `visible = all.slice(0, 4)`；`extra = all.slice(4)`
   - 渲染 4 个槽：`i < visible.length ? visible[i] : emptySlot`
   - `extra.length > 0` 显示「展开更多（N）」

## 空槽最小视觉（提案）

- 虚线边框 + 浅灰底 + 文案「暂无例句」
- 圆角/边框语言对齐现有 FlashCard 白卡片

## 作用面复核

- 仅 `FlashCard` 翻牌背面
- `MemoryAidPanel` 增加复习用 `variant="reviewStack"`（或等价），默认/矩阵调用保持横向 Tab 不变

## 示例（mud，假设 payload 有 7 条合法例句）

```
折叠态:
  左槽1..4 = 例句1..4     右卡1..4 = 词根/联想/助记/图片（限高=左槽高，GSAP顶对齐）
  [展开更多（3）]

展开态 (R1=A):
  左 = 例句1..7 完整列表   右 = 四卡仍纵向，暂停 GSAP 4↔4
```

## Next after confirm

→ G002 MemoryAid reviewStack → G003 FlashCard 双栏 → G004 GSAP 贴合 → G005 验收
