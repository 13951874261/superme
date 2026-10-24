# 上下文快照：挑战庆祝彩带卡顿修复

- slug: `confetti-jank-fix`
- 时间: 2026-08-20T14:45:52Z
- 类型: brownfield
- 超大上下文摘要门: not_needed
- interview_id: e88dd70c-0718-4eca-abfd-6a5b3925716e
- profile: standard (threshold ≤ 0.20, max_rounds 12)

## 任务陈述
多角色沙盘「挑战完成」庆祝特效导致整页卡顿、无法操作；用户已倾向方案 A（修好 Confetti 组件，保留庆祝）。

## 期望结果（暂定）
庆祝仍可出现，但页面保持可交互、彩带不会反复叠加；修复惠及所有复用 `Confetti` 的入口。

## 用户给出的解法陈述
选择 **A（推荐）**：修好 `Confetti`（effect 只跑一次、`onComplete` 用 ref、降低粒子/时长、必要时 `disableForReducedMotion`），并启动 `$deep-interview`。

## 意图假设
用户要的是「成功反馈还在，但不能挡训练流程」——卡死比视觉华丽更不可接受。

## 已知事实（代码证据）

### [from-code][auto-confirmed]
- 庆祝横幅组件：`src/components/Confetti.tsx`，文案为「挑战达成 (Challenge Completed)」（截图 OCR 可能写成「挑战完成」）
- 使用 `canvas-confetti`：默认 `particleCount: 60`，两波间隔 250ms，`ticks: 200`，`duration` 默认 3000ms
- `useEffect` 依赖 `[duration, onComplete, fireConfetti]`；调用方普遍传入内联 `onComplete={() => setShowConfetti(false)}`，引用不稳定
- 多角色沙盘：`OralWarRoom.tsx` L32 挂载 Confetti；成功路径 `processOralAiResponse.ts` L84-86 同时 `setShowGoldGlow(true)` + `setShowConfetti(true)` + `playSuccess()`
- 即兴计时达标：`OralWarRoomImprovTimer.tsx` L39-44 在 `elapsed === TARGET_SECONDS` 时调用 `onMilestone`；`OralWarRoomChat.tsx` L299 传入内联 `onMilestone={() => setShowConfetti(true)}`，`onMilestone` 在 effect 依赖中 → 达标后父重渲染可能反复触发
- 其它复用点：DashboardTab / VocabTab / WriteTab / SpeakModule / ImpromptuSpeechTab / Sidebar / ThemeMasteryOverlay；`TextHighlighter.tsx` / `showConfetti` 另有直接 `confetti()` 调用

### [from-code]（推断，待用户确认是否纳入本轮）
- 卡顿主因更可能是「父组件频繁重渲染导致 confetti 反复点火 + 结束定时器被重置」，而非单次 60 粒子本身
- 沙盘场景有每秒计时器等重渲染源，最容易放大该缺陷

## 约束
- `AGENTS.md`：需求确认后才改；仅改用户要改的部分；中文沟通；分步确认
- 用户已选方案 A，未授权直接实现（deep-interview 禁止本模式内直接改代码）
- 无 `omx` CLI（本机 `omx-not-found`），状态落盘到 `.omx/state/`，问答用纯文本单轮

## 已检视的仓库文档/规则
- `AGENTS.md` — 确认优先、最小改动、中文
- `.omx/specs/deep-interview-performance-bottlenecks.md` — 既往前端性能访谈（网络请求优先），与本次彩带卡顿无直接重叠
- 无专门 Confetti/庆祝设计文档

## 术语
- 「挑战完成/挑战达成」= `Confetti` 顶部黑底横幅 + canvas-confetti 粒子
- 方案 A = 修复组件行为并轻量化，保留庆祝

## 触点清单（暂定）
- 必改：`src/components/Confetti.tsx`
- 可能相关（是否修由访谈边界决定）：`OralWarRoomImprovTimer.tsx` / 各调用方内联 `onComplete`
- 旁路：`TextHighlighter.tsx` 直接 confetti（是否同修）

## Unknowns / Decision Boundaries（未决）
- 成功标准：短暂掉帧可接受 vs 必须全程流畅可点？
- 范围：只修共享 Confetti，还是连 ImprovTimer 重复触发、TextHighlighter 一并修？
- Non-goals：是否禁止改庆祝文案/视觉风格/音效？
- 决策边界：粒子数/时长具体数值是否可由执行方自定？
