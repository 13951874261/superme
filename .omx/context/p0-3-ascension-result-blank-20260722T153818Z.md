# Context Snapshot: P0-3 顶层认知升维无法产出研判结果

## Task Statement
对 P0-3「顶层认知升维提交后结果区空白」做 deep-interview，收敛为可执行规格；前置已有 surgical-modification 最小改造草案，本阶段不直接改代码。

## Desired Outcome
用户提交 5 层因果链后，结果区总能给出可理解反馈（成功研判 / 格式异常兜底 / 明确错误），不再“点了无效”。

## Stated Solution (User Proposal)
1. 后端 `/api/game-theory/ascension`：JSON.parse 失败时提取 `<result>`/`<analysis_result>`，再失败则 200 + 结构化兜底含 `_raw_fallback`
2. 前端 `handleAscensionSubmit` catch：把错误写入 `ascResult.suggestion`
3. 可选：`difyAPI` 空 result 防御；结果区 `_raw_fallback` 折叠

## Probable Intent Hypothesis
修复静默失败的 P0 体验；次要意图可能是提高对 Dify 非 JSON 返回的容错，而非立刻修 Dify 工作流本身。

## Known Facts [from-code][auto-confirmed]
- `vocab-server/server.js` L6134-6144：`JSON.parse(cleanJson)` 失败 → 500「升维研判结果格式异常，无法解析 JSON」
- `src/services/difyAPI.ts` L1792-1794：`!res.ok` 已 `throw new Error(data?.error || …)`，错误可抛出
- `src/components/modules/GameTheoryModule.tsx` L150-152：catch 仅 `console.error` + `playGentleWarning`，不写 `ascResult`
- 结果区依赖 `ascResult`（约 L1608+），失败路径保持 `null` → 空白
- 成功路径已渲染 `suggestion`（L1660-1667），错误写入该字段可零布局改动复用

## Constraints
- AGENTS.md：中文、确认后改、最小范围、分步确认
- deep-interview：本阶段不实施
- 与 P0-2 同属 GameTheoryModule，风格应对齐（P0-2 失败用 alert；本草案倾向 suggestion 区）

## Unknowns / Open Questions
- 成功标准偏「永远有可见反馈」还是「尽量恢复真实研判」？
- 本轮是否含 `_raw_fallback` 折叠 UI（范围 A vs B）？
- 是否同步改 Dify 工作流 YML，还是仅前后端容错？
- 错误展示用 suggestion 区 vs alert（与 P0-2 对齐）？
- Non-goals / Decision Boundaries 尚未书面锁定

## Decision-Boundary Unknowns
- OMX 可否把兜底 HTTP 设为 200（success:true）而非 422/500？
- `_raw_fallback` 截断长度、是否进正式类型
- 标签提取范围是否含 Markdown 代码块内 JSON

## Likely Codebase Touchpoints
- `vocab-server/server.js` (~6101-6151)
- `src/components/modules/GameTheoryModule.tsx` (~129-155, ~1608-1667)
- `src/services/difyAPI.ts` (~1771-1795)

## Docs/Rules Inspected
- `AGENTS.md` — 确认后修改、最小范围
- `.omx/specs/deep-interview-p0-2-game-theory-prototype-entry.md` — 同模块 P0 先例
- 上一轮 surgical-modification 方案（会话内）

## Terminology
- 「顶层认知升维」= TAB `ascension` / `runCognitiveAscension` / `/api/game-theory/ascension`
- 「研判结果」= `CognitiveAscensionResult`（is_passed, depth_score, layer_feedback, ultimate_law, suggestion）
- 「原始返回兜底」= `_raw_fallback`

## Prompt-Safe Initial-Context Summary Status
`not_needed` — 上下文已结构化，代码行号已核对
