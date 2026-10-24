# Deep Interview Spec: P0-3 顶层认知升维无法产出研判结果

## Metadata
- **Profile:** standard
- **Rounds:** 5
- **Final Ambiguity:** 0.09 (threshold 0.20)
- **Context Type:** brownfield
- **Context Snapshot:** `.omx/context/p0-3-ascension-result-blank-20260722T153818Z.md`
- **Interview Transcript:** `.omx/interviews/p0-3-ascension-result-blank-20260722T154757Z.md`
- **Feasibility Verdict:** ✅ 可行；比原 surgical 草案更小——前端双通道为主，后端保持 500

## Clarity Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.95 | 体验可见性优先 |
| Outcome | 0.92 | 系统异常必须可区分 + 双通道 |
| Scope | 0.92 | 非目标 A–D 已钉死 |
| Constraints | 0.88 | 失败保持 500，不走软 200 |
| Success Criteria | 0.85 | 见下方验收 |
| Context (brownfield) | 0.92 | 根因链路已代码确认 |

## Intent
修复「顶层认知升维」提交后结果区空白、用户误以为无效的问题；首要是失败/异常**可见且可区分**，不是最大化从非 JSON 中恢复研判。

## Desired Outcome
- 网络失败、后端 500、格式异常时：结果区出现带 `【系统异常】` 前缀的说明，并弹一次 `alert`，伴随现有警告音
- 正常 JSON 研判成功/未达标路径行为与现网一致（含分数、达标徽章逻辑）
- 用户能区分「系统/格式故障」与「因果链纵深不够」

## In-Scope
1. **前端主改** `GameTheoryModule.handleAscensionSubmit` catch：
   - `setAscResult({ is_passed:false, depth_score:0, layer_feedback:[], ultimate_law:'', suggestion: '【系统异常】' + errMsg })`
   - `alert(【系统异常】…)` 一次
   - 保留 `playGentleWarning()`
2. **前端次要** `difyAPI.runCognitiveAscension`：确保 `!res.ok` / 空 `result` 时 throw，且 `message` 含后端 `error` 文案（可补一行空 result 防御）
3. **后端**（最小）：保持格式失败 **HTTP 500** + 明确 `error` 字符串；**可不做** XML 提取与 200 软兜底（与 Round 5 一致）。若改，仅允许改善 `error` 文案清晰度，不改变状态码策略

## Out-of-Scope / Non-goals
- 不改 Dify 工作流 / YML
- 不做 `_raw_fallback` 折叠 UI（亦不要求首版返回该字段）
- 不改升维结果区布局/视觉风格（除 suggestion 文案与 alert）
- 不改 `is_passed` / `depth_score` 等真实研判语义
- 不做 200 软兜底假结果
- 不强制后端 XML/`<result>` 二次解析

## Decision Boundaries（OMX 可自主决定）
- alert 与 suggestion 共用同一套文案模板：`【系统异常】${errMsg}`
- `errMsg` 优先 `e.message`，否则 `String(e)`
- 是否给 `CognitiveAscensionResult` 增加可选错误字段：**否**（复用 `suggestion` 即可）
- 后端是否动代码：**默认可跳过**；仅当现有 500 文案过于含糊时，收紧为更具体的 `error` 字符串
- `difyAPI` 空 `result` 防御一行：可做（降低静默 undefined）

## Constraints
- 最小 diff；不影响博弈分析、原型档案等其他 TAB
- 对齐模块内已有 `alert` 失败反馈（参见 P0-2）
- AGENTS.md：实施前仍需用户明确确认执行
- deep-interview 本阶段不直接改代码

## Testable Acceptance Criteria
1. **菜单路径：** 博弈论模块 →「顶层认知升维」
2. **正常路径：** 填满事件 + 5 层，Dify 返回合法 JSON → 结果区展示与现网一致；无多余 alert
3. **后端 500 / 格式异常：** 提交后出现 `alert`（含【系统异常】），结果区 suggestion 含同一前缀与错误信息；非空白
4. **网络失败：** 同上双通道可见
5. **研判未达标（合法 JSON、is_passed=false）：** 无【系统异常】前缀；表现为纵深不足，不弹系统异常 alert
6. **回归：** 其他 TAB（案例/战术/推演）行为不变

## Assumptions & Resolutions

| Assumption | Resolution |
|------------|------------|
| 软 200 兜底必要 | ❌ Round 5 选 A：保持 500 |
| 必须区分系统异常 vs 纵深不足 | ✅ Round 2 B |
| 双通道 alert + suggestion | ✅ Round 3 C |
| 后端 XML 解析 / raw 折叠属首版 | ❌ 非目标 + Round 5 |

## Pressure-Pass Findings
- Round 1「可见即可」→ Round 2 收紧为「必须可区分故障类型」
- 原 surgical「200 + `_raw_fallback`」与 catch 双通道冲突；Round 5 收敛为前端驱动的最小方案

## Docs/Terminology Ledger
- 「顶层认知升维」= TAB `ascension` / `runCognitiveAscension` / `POST /api/game-theory/ascension`
- 「系统异常」= 前缀 `【系统异常】`，用于 suggestion + alert
- 「研判未达标」= 合法结果且 `is_passed === false`，无系统异常前缀
- 相关先例：`.omx/specs/deep-interview-p0-2-game-theory-prototype-entry.md`（同模块 alert 模式）

## Technical Context
- `vocab-server/server.js` L6138-6143：parse 失败 → 500（可保留）
- `difyAPI.ts` L1792-1794：已 throw `data?.error`
- `GameTheoryModule.tsx` L150-152：catch 无 UI（**主修复点**）
- 结果区 L1660-1667：已渲染 `ascResult.suggestion`

## Optional Durable Doc Updates
- 无强制；若用户后续 opt-in，可将本 P0 验收写入内部 changelog（公开安全、非自动）

## Residual Risks
- Dify 长期非 JSON → 用户持续看到系统异常而非研判（已接受，另开任务修工作流）
- 用户可能忽略 alert 只看结果区——双通道已缓解

## Revised Minimal Diff vs Original Surgical Draft

| 原草案 | 本 Spec |
|--------|---------|
| 后端 200 软兜底 + `_raw_fallback` | **不做**；保持 500 |
| XML 标签二次解析 | **非必须** |
| 仅 catch 写 suggestion | catch：**suggestion + alert**，前缀【系统异常】 |
| 可选 raw 折叠 UI | **明确非目标** |
