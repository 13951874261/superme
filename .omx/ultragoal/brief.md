# Brief: 生词复习 — 例句↔记忆辅助 4↔4 GSAP 顶边动态对齐

> Requirements source: `.omx/specs/deep-interview-memory-aid-vertical-align.md`  
> Interview: `.omx/interviews/memory-aid-vertical-align-20260830T170310Z.md`  
> Context: `.omx/context/memory-aid-vertical-align-20260831T045000Z.md`

## Intent

生词复习翻牌后，右侧四块记忆辅助与左侧前四条例句顶边一一对齐、纵向排列；对齐随布局/内容变化由 GSAP 测距动态更新。

## In-Scope

1. 重构 `FlashCard` 翻牌背面为双栏（左例句槽 | 右记忆卡）
2. 左：最多 4 条；不足垫空槽；超出折叠 +「展开更多」
3. 右：词根/联想/助记/图片四卡同时展开；限高跟左槽；超出卡内滚动
4. **必须**用 `@gsap/react` / `useGSAP` 测 DOM 顶边动态贴合（含 resize/内容变化）
5. `prefers-reduced-motion`：可取消位移动画，静态顶对齐仍成立

## Out-of-Scope / Non-goals

- 不改词汇矩阵 `VocabTab` 词典/记忆辅助双栏
- 不改记忆辅助后端/Dify 契约（除非前端取多例句必需）
- 不改 `MemoryMatrixStage`
- 不做全站 DictionaryPanel 重设计

## Decision Boundaries

- 对齐手段：GSAP 测距贴顶（已裁定，不可改成「仅 CSS 网格当对齐」）
- 空槽/展开更多/滚动条视觉、例句字段优先级：实现前用最小默认示意确认（见 G001）

## Residual confirmations (G001)

1. 「展开更多」后：默认左栏变完整列表、右栏暂冻结对前四槽或暂停严格 4↔4——需用户一句话确认
2. 图片卡限高内：默认缩略+可点开

## Acceptance

对照 spec acceptance criteria 1–6；矩阵双栏回归未改。
