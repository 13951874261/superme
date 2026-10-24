# Deep Interview Transcript: bg-handoff-feedback

- **Interview ID:** b3189c67-e4a4-4ef9-802e-bc56446bae4d
- **Profile:** standard (threshold ≤ 0.20)
- **Type:** brownfield
- **UTC:** 20260821T065803Z
- **Final ambiguity:** ~0.14
- **Context snapshot:** `.omx/context/bg-handoff-feedback-20260821T063808Z.md`

## Seed

1. 长文生成 3 秒转后台提醒不够显著  
2. 点击收录无响应；应提示转后台并补齐生词本矩阵  
3. 方案 A + GSAP；全站收录同模式；所有 3s/任务中心 handoff 统一就近提醒  
4. `/deep-interview` `/gsap-frameworks` `/design`

## Rounds

| # | Focus | Answer |
|---|--------|--------|
| 1 | 双通道硬性 | **B** 就近提示 + 全局 Toast/任务中心脉冲 缺一不可 |
| 2 | 压力/主反馈 | 未选节流项；明确按钮态：`收录`→`收录中`(+后台提醒)→`已收录` |
| 3 | 3s 后按钮文案 | **B** →`后台处理中`，完成后再`已收录`（矩阵齐备） |
| 4 | 终态范围 | **C** 凡提交任务中心的异步操作 |
| 5 | 交付切分 | **C** 三批：长文页 → 唤醒/破绽 → 其余任务中心入口 |
| 6 | Non-goals | **A,B,C,D,E** |
| 7 | Decision Boundaries | **A,B,C,D,E**（可自行决定） |

## Pressure-pass finding

- Round 2/3：将「无响应」根因压到**按钮态缺失 + 反馈远离点击点**；3s 后必须显式「后台处理中」，不得静默保持「收录中」或提前伪「已收录」。

## Docs / Terminology

- 「破绽」=`DailyErrorVocabularyModule`
- 「补充生词本其他内容」= 词汇矩阵（释义/搭配/记忆节点/高管 SOP 等）
- `DESIGN.md` Frictionless Feedback（就近）对齐；本轮**不**刷新 DESIGN.md（Non-goal E）
- React + 已有 `gsap`；实现时用 `gsap.context` + 卸载 `revert`（对齐 gsap-react 惯例）
