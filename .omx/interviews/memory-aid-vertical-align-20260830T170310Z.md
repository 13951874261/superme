# Deep Interview Transcript — memory-aid-vertical-align

- Profile: standard (threshold ≤ 0.20)
- Type: brownfield
- Final ambiguity: ~0.12
- Context snapshot: `.omx/context/memory-aid-vertical-align-20260831T045000Z.md`
- Spec: `.omx/specs/deep-interview-memory-aid-vertical-align.md`

## Rounds

| # | Focus | Answer |
|---|--------|--------|
| 1 | Intent — 动态对齐含义 | **D** 与前 N 条例句一一顶边对齐 |
| 2 | Outcome — 例句 &lt;4 | **C** 左栏垫成 4 槽再对齐 |
| 3 | Outcome — 例句 &gt;4 | **B** 左栏默认只显示前 4，其余「展开更多」 |
| 4 | Scope — 右侧形态 | **A** 四卡同时展开全文 |
| 5 | Outcome — 高度差 | **C** 右侧限高对齐例句卡，卡内滚动 |
| 6 | Scope — 作用面 | **D** 生词复习 |
| 7 | Non-goals | **A** 不改词汇矩阵双栏，只改生词复习 |
| 8 | Context — 代码 vs 截图 | **A** 重构 FlashCard 翻牌背面为截图级双栏 4↔4 |
| 9 | Decision Boundaries | **B** 必须用 GSAP 测 DOM 顶边动态贴合（含 resize/内容变化） |

## Pressure pass

- Round 8 revisited Round 6/7：用户说「生词复习」，但截图是矩阵双栏；代码中 FlashCard 为单栏。用户裁定：**把截图效果迁到复习页**，矩阵双栏仍为 Non-goal。

## Notes

- 用户附带 `/gsap-frameworks`；本仓为 React，落地应对齐 **gsap-react / useGSAP**（及测距/resize 策略），非 Vue lifecycle 示例。
