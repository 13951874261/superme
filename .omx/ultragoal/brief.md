# Ultragoal Brief — bg-handoff-feedback

## Source

- Spec: `.omx/specs/deep-interview-bg-handoff-feedback.md`
- Transcript: `.omx/interviews/bg-handoff-feedback-20260821T065803Z.md`
- Context: `.omx/context/bg-handoff-feedback-20260821T063808Z.md`

## Objective

统一「提交任务中心 / 约 3 秒转后台」的前端反馈：就近提示 + 全局 Toast + 任务中心脉冲三者硬性；收录按钮态 `收录` → `收录中` →（≥3s）`后台处理中` →（矩阵齐备）`已收录`。终态覆盖凡进任务中心的异步入口；交付分三批（长文页 → 唤醒/破绽 → 其余）。用已有 GSAP 克制强化可见性；不改后端契约。

## Constraints / Non-goals

- 不改后端 3s 阈值 / 任务队列契约
- 不改 GlobalTaskCenter IA / 删除
- 不迁 DictionaryPanel → useVocabCollect
- 不新增大动画库；仅用已有 gsap；150–250ms、无 glow
- 本轮不刷新根 DESIGN.md

## Decision Boundaries（执行方可自定）

- Toast 文案/时长/连续点击节流
- GSAP 缓动细节
- 共享组件命名与落点
- P1 测试用例写法（事后核对）
- 完成后翻「已收录」复用 vocab-updated / 任务轮询

## Success shape

1. P1：长文生成 ≥3s → 就近 + Toast + 任务中心脉冲；按钮有进行中/后台态
2. P1：词表收录立即「收录中」；≥3s「后台处理中」+ 双通道；矩阵齐备「已收录」
3. P2：唤醒/破绽同模式
4. P3：其余任务中心入口同展示逻辑（文案按动作适配）
5. 合约/回归测试覆盖 P1 关键路径；词典收录路径不变

## Stories

见 `.omx/ultragoal/goals.json`（G001–G006）。
