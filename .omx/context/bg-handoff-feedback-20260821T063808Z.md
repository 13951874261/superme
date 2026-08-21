# Context Snapshot: bg-handoff-feedback

- **UTC:** 20260821T063808Z
- **Task statement:** 统一「3 秒转后台」就近提醒 + 全站收录同一反馈模式（GSAP 强化可见性）
- **Desired outcome:** 用户点击长文生成 / 收录等操作后，3 秒未完成时能明确感知「已转后台 / 任务中心」，且收录会补齐生词本矩阵；唤醒、破绽、长文等收录路径一致
- **Stated solution:** 方案 A（强化现有路径）+ 提醒放在点击按钮附近 + GSAP + 统一展示逻辑
- **Probable intent hypothesis:** 当前右上角 `showNotice` / 远端 Toast 与点击点脱节，导致「无响应」错觉；根因是反馈位置与即时态缺失，而非后台任务本身失败
- **Prompt-safe initial-context summary status:** `not_needed`

## Known facts / evidence

### [from-code][auto-confirmed]
- 收录统一 hook：`src/hooks/useVocabCollect.ts`（`VOCAB_COLLECT_RACE_MS = 3000`），超时 → `batchAddWordsAsync` + 任务中心
- 已接入 `useVocabCollect`：`DailyWakeupModule`（唤醒）、`DailyErrorVocabularyModule`（破绽）、`DashboardTab`（长文词表）
- 唤醒/破绽：`notify → showToast`；长文 Dashboard：`notify → showNotice('dashboard', …)`（右上角小角标，`text-[11px]`，约 4s 消失）
- `VocabularyGrid` 的「+ 收录」**未**绑定 `isCollecting` / `isCollected`，点击后按钮态不变 → 「无响应」感知
- 长文生成 3s 竞速：`DAILY_EXTRACT_RACE_MS` + `withDailyExtractTimeout`（`difyAPI.ts` / `DashboardTab`）
- 另有 3s 竞速：`THEME_DELETE_RACE_MS`（场景清理 → 任务中心）
- 词典面板 `DictionaryPanel` 仍走 `addWord`，**未**走 `useVocabCollect` 矩阵补齐竞速
- `package.json` 已依赖 `gsap@^3.15.0`；项目为 React（实现时应对齐 gsap.context + 卸载 revert；优先 gsap-react 惯例）
- 合约测试：`vocab-server/tests/vocabCollectBackgroundHandoffContract.test.js`

### [from-code]（推断，待确认）
- 用户口中「所有相同 3 秒进入后台」可能仅指收录 + 长文，也可能包含主题删除 / Listen backfill / 导出等一切 handoff

### Docs / rules inspected
- `AGENTS.md` / `.claude/CLAUDE.md`：确认后才改代码；中文；分步确认
- `DESIGN.md`（Active, 2026-07-24）：**Frictionless Feedback: notice inline**；Motion 150–250ms；「Performance: No new animation libraries for density passes」——但 GSAP **已在依赖中**，与「新引入库」不同
- `docs/superpowers/specs/2026-08-20-task-center-ui-delete-design.md`：任务中心展示/删除
- `.omx/plans/prd-perf-sla-3s-10s.md`：全站 ≤3s 必须有可见反馈；重任务转任务中心
- `design2.md`：无关旧语音问题草稿，非本任务权威

## Terminology / conflicts
- 用户选「A（Toast + 任务中心脉冲）」又要求「提醒在按钮附近」→ 主通道优先级未定
- 「破绽」= `DailyErrorVocabularyModule`（flaw vocab）
- 「补充生词本中的其他内容」在代码语义 = 词汇矩阵（释义/搭配/记忆节点/高管 SOP 等），非另造字段

## Constraints
- AIM：未经确认不改代码；deep-interview 阶段禁止实现
- 本机无 `omx` CLI → 用文件持久化 state + 纯文本单轮提问
- DESIGN.md 刷新属 `$design` 产出，deep-interview 规定 durable docs 需用户 opt-in

## Unknowns / decision boundaries
- 就近浮层 vs 全局 Toast 的硬性验收优先级
- 「所有 3 秒后台」边界是否含主题删除 / Listen / 导出 / 词典收录
- Non-goals：是否改后端 SLA、是否改任务中心 IA、是否刷新根 `DESIGN.md`
- GSAP 动效强度 vs DESIGN「restrained motion / reduced decorative pulse」

## Likely touchpoints
- `useVocabCollect.ts`, `VocabularyGrid.tsx`, `DashboardTab.tsx`, `DailyWakeupModule.tsx`, `DailyErrorVocabularyModule.tsx`
- 可能新增共享「就近 handoff 提示」组件 + Header 任务中心脉冲
- 合约测试扩展；可选 `DESIGN.md` Interaction states 增补
