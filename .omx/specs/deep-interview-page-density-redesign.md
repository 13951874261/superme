# Deep Interview Spec — page-density-redesign

## Metadata
- **Profile:** standard
- **Rounds:** 6
- **Final ambiguity:** ~0.08 (threshold 0.20)
- **Context type:** brownfield
- **Context snapshot:** `.omx/context/page-density-redesign-20250721T151800Z.md`
- **Transcript:** `.omx/interviews/page-density-redesign-20250721T153100Z.md`
- **Prompt-safe initial-context summary:** not_needed

## Clarity breakdown

| Dimension | Score | Notes |
|-----------|------:|-------|
| Intent | 0.95 | 四目标都要；冲突时密度/少滚动优先 |
| Outcome | 0.92 | 桌面首屏必须同屏见 123 |
| Scope | 0.92 | 仅进度总控布局密度 |
| Constraints | 0.95 | 五条非目标全锁 |
| Success | 0.85 | 首屏 123 + 可读；无像素硬指标 |
| Context | 0.95 | 用户确认 DashboardTab |

**Weighted ambiguity (brownfield):** ≈ 0.08

## Intent
减少「进度总控」长页无效空白与卡片割裂感，提高信息密度与首屏可见关键内容，同时避免密到不可读。用户同时在意凝聚感、工作台效率与留白品质，但密度优先。

## Desired Outcome
桌面端不滚动时，至少同时看到：
1. 能力匹配度环 + 停留/闭环摘要（StayAnalysis）
2. 今日战区简报深色三列（DailyBriefingCard）
3. 主题枢纽 / 路线图（StrategicRoadmap / ThemeGateway）

整体更紧凑、可并排；仍保留可读性。

## In-Scope
- `src/components/modules/english/tabs/DashboardTab.tsx` 及其直接子面板的**布局/间距/栅格/视觉容器合并**
- 模块顺序微调，使 123 进入首屏；其余模块下移但仍在同页
- 在现有 Tailwind / 项目样式内收紧 padding、gap、`space-y-*`
- 遵循 `DESIGN.md` 既有色与分区语言
- 应用 redesign-skill 中与**布局密度**相关的升级（避免破坏功能）

## Out-of-Scope / Non-goals
1. 不改交互逻辑与数据流
2. 不改配色体系 / 不做新主题
3. 不碰其他 Tab 或其他模块
4. 不折叠/隐藏现有模块（禁止手风琴藏内容；允许下移到首屏外）
5. 不引入新依赖

## Decision Boundaries（可自决，无需再确认）
- 具体间距数值
- 多列栅格比例
- 卡片视觉合并（外框合一、内部模块功能不变）
- 模块上下顺序（保证首屏 123）
- 验收标准由用户把关：「首屏 123 + 不拥到无法读」

## Constraints
- 沿用现有 React + Tailwind 栈
- 最小 diff；不破坏现有功能
- 与 `DESIGN.md` 一致
- redesign 阶段：小步可审阅，测后再宣称完成

## Testable acceptance criteria
1. 桌面常见视口（约 1440×900 或同等高度）不滚动时，可见 StayAnalysis 匹配度区、DailyBriefing 三列、主题枢纽/路线图。
2. SOP、Arsenal、Intel、MaterialUploader 等仍存在于同页（可在首屏外），无手风琴式隐藏。
3. 所有原有按钮/生成/上传等交互行为不变。
4. 配色仍符合 `DESIGN.md`（橙强调、深色执行区、浅色内容卡）。
5. `package.json` 无新增依赖。
6. 用户主观验收：不觉得「无法阅读的拥挤」。

## Assumptions exposed + resolutions
- 假设目标页为 DashboardTab → **Round 6 确认**
- 假设「不折叠」= 不手风琴隐藏，允许下移 → 与 Round 4 选项 4 文案一致，采用此解释
- 假设「四目标都要」在冲突时密度胜出 → **Round 2 确认**

## Pressure-pass findings
- Round 2 回访 Round 1「全都要」：冲突时选密度优先，避免执行时在留白与密度间摇摆。

## Brownfield evidence vs inference
- **Evidence:** DashboardTab `space-y-8` 栈；子面板文件路径见 transcript
- **Inference→confirmed:** 截图对应进度总控 → 用户 Round 6 确认

## Docs / Terminology Ledger
- Inspected: `DESIGN.md`；用户附加 redesign-skill、deep-interview
- `/deep-interview`、`/redesign-skill` = 技能调用，非 UI 路由
- 无「深度面试报告」前端文案；勿与本改版页混淆

## Scenario / edge-case pressure
- 窄桌面/笔记本高度不足时：优先保证 123 同屏；通过并排+减间距实现，而非隐藏模块。
- 移动端：未单独规定；默认可降级为单列紧凑栈，但验收以桌面首屏为准（实现方可自决移动细节）。

## Optional durable doc recommendations (opt-in only)
- 若验收通过，可在 `DESIGN.md` 增补「进度总控密度原则」一小节（需用户显式同意后再写）

## Technical context findings
Primary files:
- `src/components/modules/english/tabs/DashboardTab.tsx`
- `.../dashboard/StayAnalysisPanel.tsx`
- `.../dashboard/DailyBriefingCard.tsx`
- `.../dashboard/ThemeGateway.tsx` + `StrategicRoadmap.tsx`
- Related below-fold: `ArsenalPanel.tsx`, `IntelBriefing.tsx`, `MaterialUploader.tsx`
- Possibly `SOPGuide` / SOP 顶卡高度压缩（不隐藏）

## Recommended redesign approach (for execution lane)
1. 将首屏改为 CSS Grid 多列：左/中主题枢纽+路线图，右匹配度；简报并入首屏带或紧邻第二行但仍尽量入视口。
2. 根 `space-y-8` → 更紧（如 `space-y-4`/`gap-4`）；卡片 `p-5 md:p-8` 适度下调。
3. SOP 保持可见但压成更薄条，避免占掉首屏高度。
4. Arsenal / Intel / Material 顺序下移，不删除。
5. 不做配色重做；不做新组件库。

## Residual risk
低。验收含主观「不拥挤」项，执行后需用户目视确认。
