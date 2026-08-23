# Ultragoal Brief — ls-case-daily-pool

## Source

- Spec: `.omx/specs/deep-interview-ls-case-daily-pool.md`
- Transcript: `.omx/interviews/ls-case-daily-pool-20260823T123000Z.md`
- Context: `.omx/context/ls-case-daily-pool-20260823T111200Z.md`

## Objective

洞察(听) 进页/刷新改为英语长文同款供给：每日 04:00 预生成；每用户 × 三类 × ≥10 套；30 天按用户去重；进页只读缓存；刷尽后任务中心异步补生成。内容仍用现有洞察剧本，不改 Dify YML。

## Constraints / Non-goals

- 不改驭心博弈
- 不改英语长文 / 精听 / 02:00 DailyPack
- 不改 Dify YML
- 不做 LS-CASE-02 时长门禁升级
- 不改侧写表单 / 点评 / 导图
- 不新造任务队列

## Decision Boundaries

- 并行度、表结构、去重指纹、任务类型名
- 空池 UI：空态 + 任务中心，不现场打 Dify
- Tab 展示已是「体制内职场 / 外企职场」，内部 id 保持 `体制内` / `外企`

## Stories

见 `.omx/ultragoal/goals.json`（G001–G003）。
