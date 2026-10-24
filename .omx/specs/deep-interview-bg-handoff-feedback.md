# Deep Interview Spec: bg-handoff-feedback

## Metadata

| Field | Value |
|-------|--------|
| Profile | standard |
| Rounds | 7 |
| Final ambiguity | ~0.14 (threshold 0.20) |
| Context type | brownfield |
| Context snapshot | `.omx/context/bg-handoff-feedback-20260821T063808Z.md` |
| Transcript | `.omx/interviews/bg-handoff-feedback-20260821T065803Z.md` |
| Interview ID | b3189c67-e4a4-4ef9-802e-bc56446bae4d |

## Clarity breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.90 | 消除「无响应」错觉；双通道确认已转后台 |
| Outcome | 0.90 | 按钮 FSM + 就近 + Toast + 任务中心脉冲 |
| Scope | 0.90 | 终态=凡任务中心；交付三批 |
| Constraints | 0.90 | 前端展示层；不动后端契约 |
| Success | 0.70 | P1 可测标准已推导；细节在 Decision Boundaries 下放行 |
| Context | 0.90 | useVocabCollect / Dashboard / Wakeup / Flaw 已定位 |

## Intent

用户无法可靠感知「3 秒竞速已转入任务中心继续处理（含收录矩阵补齐）」。反馈远离点击点且收录按钮无中间态，造成「点击无响应」。目标是统一、显著、就近的 handoff 反馈，并用 GSAP 克制强化可见性。

## Desired Outcome

1. 点击后**立即**有按钮态变化 + 就近提醒。  
2. 约 3 秒未完成：就近提醒 + 全局 Toast + 顶栏任务中心脉冲（三者均必现）。  
3. 收录路径：`收录` → `收录中` →（≥3s）`后台处理中` →（矩阵齐备）`已收录`。  
4. 后台仍补齐生词本矩阵（现有 `useVocabCollect` / `batchAddWordsAsync` 行为保持）。  
5. 终态：所有「提交任务中心」的异步入口共用同一展示组件/逻辑。

## In-Scope

### Phase 1（本轮优先实现）
- Dashboard「查询/生成今日长文」3s → 任务中心 handoff 反馈
- Dashboard 词表「+ 收录」（`VocabularyGrid` + `useVocabCollect`）按钮 FSM + 双通道反馈
- 共享就近 handoff 提示组件 +（可选）Header 任务中心 GSAP 脉冲钩子
- 合约/前端测试按需扩展

### Phase 2
- `DailyWakeupModule`、`DailyErrorVocabularyModule` 套用同一模式（已有 `isCollecting` 文案需对齐「后台处理中」）

### Phase 3
- 其余任务中心入口：Listen backfill、导出、提纯上传、场景清理等——复用同一展示逻辑（按钮态文案按动作语义适配，如「生成中 / 后台处理中」）

## Out-of-Scope / Non-goals

1. 不改后端 3 秒阈值、任务队列 API 契约  
2. 不改 `GlobalTaskCenter` IA / 删除能力  
3. 不把 `DictionaryPanel` 迁到 `useVocabCollect`  
4. 不新增大动画库；仅用已有 `gsap`；动效 150–250ms、无装饰性 glow  
5. 本轮不刷新根 `DESIGN.md`（日后 `$design` opt-in）

## Decision Boundaries（可未经确认自行决定）

- Toast 文案微调、时长、连续点击合并/节流  
- GSAP 缓动/位移（克制约束内）  
- 共享组件命名与文件落点  
- P1 测试用例写法（实现后提交用户核对）  
- 完成后翻「已收录」：复用 `vocab-updated` / 任务轮询，不新造推送通道  

## Constraints

- React + Tailwind；对齐 `DESIGN.md` Frictionless Feedback / restrained motion  
- GSAP：`gsap.context(scope)` + unmount `revert`（React 生命周期；勿按 Vue onMounted 照搬）  
- AIM：实现仍须分步确认；deep-interview 本身不直接改代码  
- 保持矩阵齐备语义：`已收录` ⇔ `matrixReady`（Round 3-B）

## Testable acceptance criteria

### P1 — 长文生成
| 项 | 内容 |
|----|------|
| 菜单路径 | 英语 → 进度总控/Dashboard →「查询/生成今日长文」 |
| 测试数据 | 缓存未命中、生成耗时 >3s |
| 预期 | ≤3s 内按钮进入进行中态；≥3s：按钮附近提示「已转后台」+ Toast + 任务中心图标脉冲；任务中心出现对应任务；完成后长文/词表回填（现有行为保留） |
| 对应需求 | 长文 3s 转后台提醒显著 |

### P1 — 词表收录
| 项 | 内容 |
|----|------|
| 菜单路径 | 同上 → 词卡「+ 收录」 |
| 测试数据 | 新词（矩阵未齐备）；故意让矩阵补齐 >3s |
| 预期 | 立即「收录中」+ 就近提醒；≥3s →「后台处理中」+ Toast + 任务中心脉冲；矩阵齐备后「已收录」；生词本矩阵字段被补齐 |
| 对应需求 | 收录有响应；转后台；补矩阵 |

### 回归
- 唤醒/破绽（P2 前）行为不因 P1 共享改动而破坏（若抽公共 hook，保持向后兼容默认）  
- 词典面板收录路径不变（Non-goal C）

## Assumptions + resolutions

| Assumption | Resolution |
|------------|------------|
| 「无响应」= 逻辑失败 | **否**；主要是 UI 态/反馈位置（代码已有 handoff） |
| 「已收录」= 仅入库 | **否**；仍要矩阵齐备 |
| 方案 A 与「就近」冲突 | Round 1-B：双通道均硬性 |
| 终态 C 一次做完 | Round 5-C：三批 |

## Pressure-pass findings

- 连续收录 Toast 节流：下放 Decision Boundary A（实现自定，须保证就近每次可见）  
- 3s 后禁止假「已收录」（否决提前变绿）

## Brownfield evidence

- `[from-code][auto-confirmed]` `useVocabCollect`：Wakeup / Flaw / Dashboard  
- Dashboard `VocabularyGrid` 未绑 `isCollecting`  
- `showNotice` 右上角小角标 vs Wakeup `showToast` 不统一  
- `DAILY_EXTRACT_RACE_MS` / `VOCAB_COLLECT_RACE_MS` / `THEME_DELETE_RACE_MS` = 3000  

## Docs / Terminology Ledger

| Term | Canonical |
|------|-----------|
| 任务中心 | Header `GlobalTaskCenter` / `TaskContext` |
| 破绽 | `DailyErrorVocabularyModule` |
| 矩阵 | enrich 字段集；`matrixReady` |
| 就近提醒 | 相对触发按钮的浮层/态，非仅顶栏角标 |

Inspected: `AGENTS.md`, `DESIGN.md`, `prd-perf-sla-3s-10s.md`, task-center design spec, collect handoff contract test.

## Optional durable doc recommendations（opt-in，未自动执行）

- 日后 `$design`：在 `DESIGN.md` Interaction states 增补「后台 handoff：就近 + Toast + 任务中心脉冲」  
- 不自动写入复盘/公开 ADR，除非用户明确要求  

## Technical context（实现提示，非本模式执行）

- 抽取共享：`useBackgroundHandoffFeedback` 或 `NearActionNotice` + `pulseTaskCenterIcon`  
- P1 改：`DashboardTab.tsx`, `VocabularyGrid.tsx`, `useVocabCollect.ts`（导出收集态给 Grid）, `Header.tsx`（脉冲目标）  
- 测试：扩展 `vocabCollectBackgroundHandoffContract` 或新增 UI 合约断言文案/态  

## Residual risk

- P3 入口多，文案需按动作适配，存在遗漏入口风险 → 应用清单式盘点 `addTask(` 调用点  
- 无 `omx` CLI：状态为文件持久化，与标准 OMX 运行时略有偏差  

---

**Handoff readiness:** requirements gate PASSED. Deep-interview MUST NOT implement. Choose next skill below.
