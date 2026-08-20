# Ultragoal Brief — custom-theme-cascade-delete

## Source

- Spec: `.omx/specs/deep-interview-custom-theme-cascade-delete.md`
- Transcript: `.omx/interviews/custom-theme-cascade-delete-20260820T145600Z.md`
- Context: `.omx/context/custom-theme-cascade-delete-20260820T144300Z.md`

## Objective

完善自定义场景主题删除：确认后乐观移除下拉项；级联清理词库词/短语、长文 generation、练习尝试、Dify 文档；超过 3 秒转入【任务中心】；业务语言进度/失败提示；失败可恢复主题选项。附带 API 级联与 3 秒超时进任务中心的自动化契约测试。

## Constraints / Non-goals

- 不删除系统预置主题
- 不大改 UI（保留下拉 + 垃圾桶 + 现有任务中心）
- 不做永久回收站（失败恢复除外）
- 不误删其他主题绑定数据
- 文案用业务语言，避免暴露表名/API/Dify 技术细节
- 匹配策略、任务文案、复用 3s→任务中心骨架、Dify 失败仍清本地 — 执行方可自定（Decision Boundaries）

## Success shape

1. 删除确认后自定义主题立刻从下拉消失并切回系统主题
2. 任务成功后按该场景查不到级联目标数据；Dify 尽力删除
3. 超过 3 秒出现任务中心任务 + 业务语言提示，页面不长时间阻塞
4. 失败：业务提示 + 可恢复主题选项
5. 系统预置不可删；跨主题数据不被误伤
6. API 级联契约测试 + 前端 3 秒超时进任务中心契约测试通过

## Stories

G001–G004 见 `.omx/ultragoal/goals.json`。
