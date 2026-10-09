# Context Snapshot — progress-control-aesthetics

- **Timestamp:** 20260721T163556Z
- **Slug:** progress-control-aesthetics
- **Profile:** standard (threshold ≤ 0.20, max rounds 12)
- **Type:** brownfield

## Task statement
用户要对「进度总控」页做进一步美观度提升，要求不要过于空旷、也不要臃肿；同时触发 `/redesign-skill`、`/impeccable`、`/deep-interview`。附当前 UI 截图。

## Desired outcome
在已完成密度改版（首屏 Option B 栅格）基础上，进一步提升视觉品质与信息节奏，消除「空」与「肿」并存的观感。

## Stated solution
分析如何提升美观度；本阶段 deep-interview 只澄清，不直接改代码。

## Probable intent hypothesis
上一轮密度改版解决了「长页空白 / 首屏看不见关键块」，但路线图内部仍多层嵌套卡片，右侧能力匹配区相对稀疏，用户现在要的是**视觉精炼**（减嵌套、齐权重、统一节奏），而不只是再挤间距。

## Known facts / evidence
- [from-code][auto-confirmed] 目标页：`DashboardTab.tsx`；首屏已是 `lg:grid-cols-12`：左 7 列 Roadmap+ThemeGateway，右 5 列 Stay+Briefing。
- [from-code][auto-confirmed] 路线图 `StrategicRoadmap.tsx`：时间轴容器内再嵌「当前推进 / 轨道战果 / 当前阵地」三卡 + 两阶段选择卡（含进度条、chip、侧条、emoji）——典型 box-in-box。
- [from-code][auto-confirmed] `StayAnalysisPanel`：环图+三条件较扁；无 stayStats 时右侧视觉重量明显轻于左侧。
- [from-code][auto-confirmed] 既有密度访谈与验收：`.omx/specs/deep-interview-page-density-redesign.md`（首屏 123、不改交互/配色体系、不折叠模块）。
- [from-code][auto-confirmed] `DESIGN.md`：橙 `#FF5722`、浅蓝次强调、浅内容区 + 深执行区；`PRODUCT.md` register=product。
- [from-user] 截图观感：左重右轻；路线图信息密、右侧留白；整体「空旷与臃肿并存」。

## Constraints
- deep-interview：本阶段不实现。
- redesign / impeccable：沿用现有栈；产品 UI 忌装饰过度；nested cards 应拆。
- 工作区：实现前需确认方向；最小 diff。

## Unknowns / open questions
- 本轮相对上一轮密度规格：是「在既有边界内精炼」，还是允许更大视觉/信息层级改动？
- 「美观」优先维度：减嵌套 / 左右权重 / 统一表面语言 / 字号节奏？
- 深色 Daily Briefing 是否仍强制保留为执行区语言？
- 非目标与决策边界（本轮）尚未明确。

## Decision-boundary unknowns
- 是否允许删减路线图内重复进度展示（时间轴 vs 阶段卡内进度条）？
- 是否允许合并 Stay + Briefing 为单一右侧面板？
- 间距/字号是否可在不改配色 token 前提下自决？

## Likely codebase touchpoints
- `DashboardTab.tsx`（首屏栅格容器）
- `StrategicRoadmap.tsx`（嵌套密度主因）
- `StayAnalysisPanel.tsx`, `DailyBriefingCard.tsx`, `ThemeGateway.tsx`
- 可选：`DESIGN.md` 增补密度/嵌套原则（需用户 opt-in）

## Relevant repo docs/rules inspected
- `PRODUCT.md`, `DESIGN.md`
- `.omx/specs/deep-interview-page-density-redesign.md`
- `.omx/context/page-density-redesign-20250721T151800Z.md`
- impeccable `reference/product.md`（dashboard = product register）
- redesign-skill audit（nested cards / uneven density / eyebrow overuse）
- karpathy clarify / confirm / minimal-diff

## Terminology / doc-code conflicts
- 无新冲突。沿用「进度总控 = DashboardTab」。
- `/deep-interview` 等为技能调用，非 UI 路由。
- 上一轮「不改配色体系」是否仍对本轮「美观度」生效，需用户确认。

## Prompt-safe initial-context summary status
`not_needed`
