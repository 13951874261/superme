# Context Snapshot — page-density-redesign

- **Timestamp:** 20250721T151800Z
- **Slug:** page-density-redesign
- **Profile:** standard (threshold ≤ 0.20, max rounds 12)
- **Type:** brownfield

## Task statement
用户反馈当前页面「过于空旷」，希望内容更集中，但不要过于拥挤。同时触发 `/redesign-skill` 与 `/deep-interview`。

## Desired outcome
在保留可用呼吸感的前提下，提高首屏/视口信息密度与模块凝聚感，减少无效纵向空白与「卡片墙」割裂感。

## Stated solution
集中布局（concentrate），避免 overcrowding；配合 redesign 升级现有视觉。

## Probable intent hypothesis
用户对长滚动、模块间距过大、单模块内容过稀感到疲劳；希望更像紧凑工作台，而不是松散营销落地页。

## Known facts / evidence
- [from-code][auto-confirmed] 最可能目标页：英语模块默认 tab「进度总控」`src/components/modules/english/tabs/DashboardTab.tsx`，根布局 `space-y-8`，多段白/深卡片纵向堆叠。
- [from-code][auto-confirmed] 关键子面板：`StayAnalysisPanel`（能力匹配度环）、`DailyBriefingCard`（深色三列）、`ArsenalPanel`、`IntelBriefing`、`MaterialUploader`（含视频区）。
- [from-code][auto-confirmed] 设计基线见 `DESIGN.md`：橙强调 `#FF5722`、内容区浅色 + 执行区深色、系统无衬线。
- [from-code][auto-confirmed] 仓库前端无「深度面试报告」文案；用户消息里的 `/deep-interview` / `/redesign-skill` 是技能调用，不是页面路由。
- [from-user] 附截图显示长竖向卡片栈、模块间距大、部分区块内容少却占高。

## Constraints
- redesign-skill：沿用现有栈，不做框架迁移；不破坏功能；小步可审阅改动。
- deep-interview：本阶段只澄清需求，不直接实现。
- 工作区规则：实现前需用户确认方向；最小 diff。

## Unknowns / open questions
- 核心意图：首屏密度 vs 视觉凝聚 vs dashboard 效率 vs 高级留白平衡？
- 改版范围：仅 DashboardTab，还是整个英语模块/全站？
- 「不要拥挤」的硬边界：是否允许并排多列、折叠/手风琴、合并卡片？
- 成功标准：滚动减少多少、首屏应露出哪些模块？
- 非目标与决策边界尚未明确。

## Decision-boundary unknowns
- OMX/代理可在不确认下自决的间距数值、字体、是否合并哪些模块？
- 是否允许改变信息层级（折叠次要内容）？

## Likely codebase touchpoints
- `DashboardTab.tsx`
- `StayAnalysisPanel.tsx`, `DailyBriefingCard.tsx`, `ArsenalPanel.tsx`, `IntelBriefing.tsx`, `MaterialUploader.tsx`
- 可能涉及 `EnglishModule.tsx` 外层间距、`index.css` / Tailwind 工具类
- `DESIGN.md`（若需同步密度原则）

## Relevant repo docs/rules inspected
- `DESIGN.md`
- workspace: redesign-skill + deep-interview（用户手动附加）
- karpathy clarify/confirm/minimal-diff 规则
- 既有 `.omx/specs/` 与本次无关（web-fetch / task-center / deploy）

## Terminology / doc-code conflicts
- 用户 `/deep-interview` ≠ UI「深度面试」；按技能工作流解释。
- 截图描述与「猎聘」类招聘页措辞曾出现在旁路描述中；代码证据指向本仓英语进度总控看板。需用户确认目标页。

## Prompt-safe initial-context summary status
`not_needed`（上下文可装入提示预算）
