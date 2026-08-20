# Deep Interview Spec: confetti-jank-fix

**Profile:** standard (threshold ≤ 0.20)  
**Type:** brownfield  
**Rounds:** 6  
**Final ambiguity:** ~0.12  
**Context snapshot:** `.omx/context/confetti-jank-fix-20260820T144552Z.md`  
**Interview transcript:** `.omx/interviews/confetti-jank-fix-20260820T145500Z.md`  
**Prompt-safe initial-context summary:** not_needed  

## Clarity breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.90 | 消除互动卡死优先 |
| Outcome | 0.90 | 庆祝期间全程丝滑 + 反馈仍在 |
| Scope | 0.90 | 三层触点全修 |
| Constraints | 0.90 | 反馈优先、粒子可极轻 |
| Success | 0.75 | 由意图/结果推导的可测标准 |
| Context | 0.85 | Confetti / OralWarRoom / TextHighlighter 已定位 |

## Intent

庆祝成功反馈出现时，页面不得卡死、训练流程不得被打断。华丽彩带不是目标；可操作与流畅才是。

## Desired Outcome

触发「挑战达成」类庆祝时：

1. 顶部横幅仍出现（样式/文案不变）
2. 彩带极轻（可接近几乎看不见），但庆祝感仍在
3. 庆祝期间页面保持丝滑、可点击，无多秒卡死
4. 父组件重渲染不会导致彩带反复叠加或结束定时器被无限推迟

## In-Scope

1. **`src/components/Confetti.tsx`**
   - effect 生命周期内只点火一轮（不因 `onComplete` 引用变化重跑）
   - `onComplete` 用 ref 持有
   - 显著降低 `particleCount` / 波次 / `ticks` / `duration`（执行方可自定具体数值）
   - 可选：`prefers-reduced-motion` 时跳过粒子或仅保留横幅
2. **`src/components/modules/OralWarRoomImprovTimer.tsx`（及必要的调用方）**
   - `elapsed === TARGET_SECONDS` 时 `onMilestone` / 音效只触发一次
3. **旁路直调**
   - `src/components/Confetti.tsx` 导出的 `showConfetti`
   - `src/components/TextHighlighter.tsx` 内直接 `confetti(...)`
   - 参数与共享组件同级「极轻」策略对齐

## Out-of-Scope / Non-goals

- 不改庆祝文案与横幅样式
- 不引入新动画依赖；继续 `canvas-confetti` + 现有 GSAP 横幅
- 不改业务成功判定（何时 `setShowConfetti(true)`）
- 不改音效内容与触发时机关系（可保留现有 `playPageTurn` / `playSuccess` 调用）
- 不做全站动画/性能大扫除

## Decision Boundaries

**OMX / 执行方可自行决定（无需再确认）：**

- 具体粒子数、spread、ticks、波次间隔、duration
- 是否启用 `disableForReducedMotion` / 等价检测
- ImprovTimer「只触发一次」的实现方式（ref / 标志位等）
- 直调 confetti 路径的具体轻量化参数
- 在不动 API 行为的前提下，是否给调用方做最小稳定化（例如不强制改所有内联 `onComplete`，优先在 Confetti 内部消化）

**必须再问用户的情况：**

- 扩大到非庆祝彩带的其它动画系统
- 改横幅文案/视觉、换库、改成功判定或音效策略
- 删除庆祝反馈（只修性能变成「完全无庆祝」）

## Constraints

- 方案基线为用户预选的 **A**：修共享 Confetti，保留庆祝
- 取舍已裁决：**反馈优先于观感密度**；丝滑不可妥协
- 遵守 `AGENTS.md`：实现前仍需用户对执行交接的明确确认；最小 diff

## Testable acceptance criteria

1. **单次点火：** 在庆祝 `duration` 内，人为触发父组件多次重渲染（如计时器滴答），`canvas-confetti` 不得反复追加多波「风暴」；庆祝应在约定时长内结束并卸载。
2. **可交互：** 沙盘破绽反击成功弹出庆祝时，2–3 秒内聊天区/按钮仍可点击，页面不出现「整页假死」。
3. **极轻粒子：** 肉眼可见粒子明显少于当前生产表现（接近轻微点缀即可）。
4. **即兴达标一次：** 即兴计时到达 5:00 时，里程碑庆祝/音效只触发一次，不因后续重渲染重复触发。
5. **旁路对齐：** TextHighlighter / `showConfetti` 直调路径使用同等轻量参数，不单独打出高密度粒子。
6. **非目标守恒：** 横幅文案样式、成功判定、音效策略、依赖清单无无关变更。

## Assumptions exposed + resolutions

| Assumption | Resolution |
|------------|------------|
| 卡死主因是粒子数本身 | 代码证据指向 unstable `onComplete` + 频繁重渲染导致重复点火；粒子减量是丝滑的额外保障 |
| 「视觉可保留」= 密度不变 | Round 3 否决：反馈优先，粒子可极轻 |
| 只修沙盘即可 | Round 4：三层触点全修 |

## Pressure-pass findings

Round 3（Contrarian）回访 Round 1 vs Round 2：以「反馈 + 丝滑」为准，允许大幅削弱彩带密度。

## Brownfield evidence vs inference

### [from-code][auto-confirmed]

- `Confetti.tsx` effect 依赖 `onComplete`；调用方普遍内联回调
- OralWarRoom 成功路径同时 gold glow + confetti
- ImprovTimer `useEffect([elapsed, onMilestone])` 在 `elapsed === TARGET_SECONDS` 时触发

### [from-code]（推断，已纳入修复意图）

- 重复点火是卡死主因；减粒子是达成「全程丝滑」的必要加固

## Docs / Terminology Ledger

| Term | Canonical meaning |
|------|-------------------|
| 挑战完成 / 挑战达成 | `Confetti` 顶部横幅文案「挑战达成 (Challenge Completed)」+ 彩带 |
| 方案 A | 修共享 Confetti 行为并轻量化，保留庆祝 |
| 反馈优先 | 横幅必须在；粒子可极轻甚至接近不可见 |

Inspected: `AGENTS.md`；既往 `.omx/specs/deep-interview-performance-bottlenecks.md`（无直接重叠）。  
Durable doc updates: **opt-in only，本轮不自动写入公共文档。**

## Technical context / touchpoints

- `src/components/Confetti.tsx`（必改）
- `src/components/modules/OralWarRoomImprovTimer.tsx`（必改）
- `src/components/TextHighlighter.tsx`（必改直调参数）
- 调用挂载点（仅在为实现「只触发一次」所必需时最小改动）：`OralWarRoom.tsx` / `OralWarRoomChat.tsx` 等

## Residual risk

低。需求已低于阈值且门禁齐备。残留风险：不同机器上「丝滑」主观感受差异——以「可点击 + 无重复风暴」为硬标准，主观丝滑由极轻粒子兜底。

## Optional durable documentation

可在用户明确要求后，于设计/性能笔记中追加「庆祝特效必须单次点火 + reduced-motion」约定；**默认不做**。
