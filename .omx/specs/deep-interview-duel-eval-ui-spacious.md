# Deep Interview Spec: 实操对决评估 UI 空旷优化

## Metadata
- Profile: standard
- Rounds: 4
- Final Ambiguity: ~0.08 (threshold 0.20)
- Context: brownfield
- Snapshot: `.omx/context/duel-eval-ui-spacious-20260722T144800Z.md`

## Intent
消除「人机对抗沙盘」推演结果页大片空白，让评估报告成为主舞台。

## Desired Outcome
有 `simResult` 时：顶部可折叠录入摘要条 + 全宽/主区报告；信息密、一眼可读；关闭评估后回到录入。

## In-Scope
- 仅 `GameTheoryModule.tsx` 中 `activeTab === 'simulation'` 的结果态布局与样式重排
- 用现有 `simResult` 字段重排（得分、三段研判、因果链、人性归档、点拨）
- 顶部可折叠条：对手/模型/对策摘要 + 展开录入 + 关闭评估

## Out-of-Scope / Non-goals
1. 不改「高管斗争案例研判」同类右侧栏
2. 不改推演 API / 返回字段 / 业务逻辑
3. 不加新图表、雷达图、装饰性大动画
4. 不改底部「答疑」等全局浮层

## Decision Boundaries (OMX 可自主)
- 报告内具体栅格由 OMX 按 DESIGN.md 决定（用户选 3）
- 推荐落地：上得分横条 + 下双栏（左研判/点拨，右因果链/归档）；收起态默认 `对手名 · 模型 · 对策摘要`
- Token：zinc/brand 体系统一，避免新紫色皮肤；工具向密度

## Constraints
- React + Tailwind + motion；不换栈
- 不破坏 `handleStartSimPlay` / `simResult` 数据流
- AGENTS.md：用户确认后再实施

## Acceptance Criteria
1. 推演成功后主视口无明显大块空白（红框区域被报告占用）
2. 顶部可折叠：默认收起摘要；展开可改录入；关闭评估回到全宽录入
3. 现有字段全部仍可见；加载态仍有反馈
4. 高管案例 Tab、答疑浮层、API 行为不变

## Pressure-Pass
- R1 主舞台 → R2 折叠条细化表单去向 → R4 授权 OMX 定栅格细节
