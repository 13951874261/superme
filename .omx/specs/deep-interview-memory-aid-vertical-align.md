# Spec: 生词复习 — 例句↔记忆辅助 4↔4 顶边动态对齐

## Metadata

| Field | Value |
|-------|--------|
| Profile | standard |
| Rounds | 9 |
| Final ambiguity | ~0.12 |
| Threshold | 0.20 |
| Type | brownfield |
| Context snapshot | `.omx/context/memory-aid-vertical-align-20260831T045000Z.md` |
| Interview | `.omx/interviews/memory-aid-vertical-align-20260830T170310Z.md` |

## Clarity breakdown (final)

| Dimension | Score |
|-----------|-------|
| Intent | 0.95 |
| Outcome | 0.92 |
| Scope | 0.92 |
| Constraints | 0.85 |
| Success | 0.70 |
| Context | 0.90 |

## Intent

生词复习翻牌后，右侧四块记忆辅助（词根 / 联想 / 助记 / 图片）与左侧前四条例句**顶边一一对齐、纵向排列**，消除横向 Tab 与多条例句的视觉错位；对齐随布局/内容变化**动态**更新。

## Desired Outcome

FlashCard 翻牌背面重构为双栏：

```
+------------------+------------------+
| 例句槽1 (或空槽)  | 词根词缀卡(限高) |
| 例句槽2 (或空槽)  | 联想记忆卡(限高) |
| 例句槽3 (或空槽)  | 助记短语卡(限高) |
| 例句槽4 (或空槽)  | 图片记忆卡(限高) |
| [展开更多例句…]   | (重新生成等底栏) |
+------------------+------------------+
```

- 左：最多展示 4 条例句；不足则空槽占位；超过则折叠，提供「展开更多」。
- 右：四卡**同时展开**全文；每卡高度跟随对应左槽，超出**卡内滚动**。
- 对齐：左右第 i 行**顶边**动态贴合（GSAP 测距）。

## In-Scope

1. `FlashCard.tsx` 翻牌背面布局重构（生词复习）。
2. `MemoryAidPanel`（或复习页专用编排层）改为四卡纵向全展开；复习场景下去掉横向 Tab 切换为主交互。
3. 例句列表：取前 4、垫空槽、折叠其余 +「展开更多」。
4. GSAP（`@gsap/react` / `useGSAP`）测量左右行顶边并动态贴合；监听 resize / 内容变化后刷新。
5. `prefers-reduced-motion`：可取消位移动画，但仍应保持静态顶对齐结果。

## Out-of-Scope / Non-goals

- **不改**词汇矩阵 `VocabTab` 翻牌后词典/记忆辅助双栏。
- 不改记忆辅助后端 API / Dify 生成契约（除非为取多例句所必需的前端取数）。
- 不改 MemoryMatrixStage 圆环舞台。
- 不借机做全站 DictionaryPanel 重设计。

## Decision Boundaries（OMX 可自行决定 / 已裁定）

| 项 | 裁定 |
|----|------|
| 对齐实现 | **必须** GSAP 测左右 DOM 顶边动态贴合（含 resize/内容变化）。**不是**「仅 CSS 网格 + GSAP 入场」作为对齐手段。 |
| 空槽/展开更多/滚动条视觉 | 未授权自由发挥 → 实现计划中给出最小默认，**改前用一屏示意请用户确认**（或沿用现有卡片边框/圆角语言）。 |
| 例句字段优先级 | 未授权自由发挥 → 计划阶段列出 payload 候选字段与排序，**确认后再写死**。 |

## Constraints

- 技术栈：React；动画用现有 `gsap` + `@gsap/react`（用户附 gsap-frameworks，但本仓应对齐 **gsap-react**）。
- 元素不可缺失：词根、联想、助记、图片、重新生成、例句朗读等能力保留。
- 仅影响生词复习路径。
- AGENTS：确认计划后再改代码；分步确认。

## Testable acceptance criteria

1. 生词复习翻牌后：左右并排；右为 4 张同时可见的记忆卡（非横向 Tab 单内容）。
2. 例句 ≥4：默认仅 4 条；存在「展开更多」后可看其余；折叠态下仍保持 4↔4 顶对齐。
3. 例句 &lt;4：左出现空槽，右仍 4 卡，顶边与 4 槽对齐。
4. 任一记忆卡内容高于对应例句槽时：卡内可滚，不撑破破坏四行顶边关系（刷新对齐后仍成立）。
5. 窗口 resize 或切换单词导致高度变化后：顶边在合理帧内重新贴合（无长期错位）。
6. 词汇矩阵双栏布局与改前一致（回归：未误改 VocabTab 该区域）。

## Assumptions / residual

- 「展开更多」展开后，是否暂时放弃 4↔4 严格对齐：默认展开时左栏可变为完整列表、右栏保持四卡顶对齐到视口内前四槽或冻结对齐——**计划阶段需一句话确认**。
- 图片记忆卡在限高内的展示（缩略图 vs 完整图）：默认缩略+可点开，计划确认。

## Pressure-pass findings

截图场景 ≠ 当前 FlashCard 结构；用户明确要求把双栏 4↔4 **迁到生词复习**，矩阵双栏不做。

## Docs / Terminology Ledger

- 生词复习 = FlashCard 复习流（`FlashCard.tsx` + `MemoryAidPanel`）。
- 词汇矩阵双栏 = `VocabTab` 内 Dictionary + MemoryAid（Non-goal）。
- 「动态对齐」= GSAP 测距贴顶边，非仅视觉近似。

## Technical touchpoints

- `src/components/FlashCard.tsx`
- `src/components/MemoryAidPanel.tsx`（复习模式变体或抽取 `MemoryAidStack`）
- 可能：例句提取工具（`vocabCsvExport` / payload examples 字段）
- GSAP：`useGSAP`、resize/layout 后 `invalidate`/`refresh` 贴合逻辑

## Handoff

Requirements gate complete. Next: `$ralplan` 或确认后分步实现。**本模式不直接写业务代码。**
