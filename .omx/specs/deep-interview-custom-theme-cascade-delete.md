# Deep Interview Spec — custom-theme-cascade-delete

## Metadata
- slug: `custom-theme-cascade-delete`
- profile: standard
- rounds: 6
- final_ambiguity: ~0.12 (threshold 0.20)
- type: brownfield
- context_snapshot: `.omx/context/custom-theme-cascade-delete-20260820T144300Z.md`
- transcript: `.omx/interviews/custom-theme-cascade-delete-20260820T145600Z.md`
- prompt_safe_initial_context_summary: not_needed

## Clarity Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.92 | 数据干净 + 界面立刻干净 |
| Outcome | 0.90 | 乐观移除 + 业务语言进度 + 失败可恢复 |
| Scope | 0.92 | 词/短语、长文、练习、Dify 文档全级联 |
| Constraints | 0.90 | >3s → GlobalTaskCenter；复用既有 SLA 模式 |
| Success | 0.88 | 行为验收 + 自动化契约测试 |
| Context | 0.85 | 现有 delete 仅删 custom_themes + 尝试删 Dify |

## Intent
删除自定义场景时，既要立刻从界面消失，也要把该场景产生的联动学习数据清干净，避免污染后续训练与统计；慢操作不卡 UI，转入任务中心。

## Desired Outcome
1. 用户确认删除后，下拉中该自定义主题**立即消失**，并切回可用系统主题。
2. 后台继续级联清理关联数据；用业务语言提示「正在清理该场景下的学习资料与练习记录」等。
3. 若整段清理超过 3 秒，自动进入【任务中心】继续，用户可离开当前页。
4. 失败时业务语言提示，并提供**恢复该主题选项**（非永久回收站）。

## In-Scope
- 完善/扩展 `DELETE /api/theme/custom/:id`（或异步任务等价入口）为**级联删除**
- 前端：乐观移除 + 3 秒竞速 + 任务中心登记（对齐 `useVocabCollect` / `GlobalTaskCenter` / perf SLA L4）
- 级联目标：
  1. `custom_themes` 记录
  2. 该场景萃取的 `vocabulary` 单词/短语（`ai_extracted` / `ai_phrase` 等，按主题绑定匹配）
  3. `generation_history` 中该 theme 记录
  4. `training_attempts` 中该 `scene_type` 记录
  5. Dify 知识库关联文档（尽力删除）
- 自动化测试：API 级联契约 + 前端 3 秒超时进任务中心契约

## Out-of-Scope / Non-goals
- 不删除系统预置主题
- 不做主题选择区 UI 大改版（保留下拉 + 垃圾桶 + 现有任务中心）
- 不做永久回收站 / 历史可永久找回（失败恢复除外）
- 不误删其他主题绑定的词条或练习（匹配必须防误伤）
- 本访谈不直接实现；实现须另选交接车道

## Decision Boundaries（OMX 可不经再确认自行决定）
- 词条/记录匹配策略：优先稳定键（id / payload.topic / theme 字段），必要时辅主题名，严格防跨主题误删
- 任务中心任务类型名与业务文案具体措辞
- 复用现有 3 秒竞速 → 任务中心技术骨架
- Dify 删除失败：本地级联继续；任务结果标明「云端资料清理未完成」类业务提示

## Constraints
- 删除确认仍保留（现有 confirm 可保留）
- SLA：前端等待上限 3 秒，超时解耦进任务中心
- 文案：业务语言，避免暴露内部表名/API/Dify 技术细节（失败时可弱提示「云端资料」）
- 仅改本需求相关路径，不顺手重构无关模块

## Testable Acceptance Criteria
1. **乐观 UI**：删除确认后，自定义主题立刻从下拉消失；当前选中切到系统预置主题之一。
2. **级联数据**：任务成功后，按该场景查询不到其萃取词/短语、generation 记录、对应练习尝试、custom_themes 行；Dify 文档尽力删除。
3. **SLA**：级联超过 3 秒时，出现任务中心任务与业务语言提示；页面不长时间阻塞。
4. **失败恢复**：级联失败时，业务提示 + 可恢复该主题选项（恢复后主题重新出现在下拉）。
5. **防误伤**：系统预置主题不可删；其他主题数据不被删除。
6. **自动化**：存在覆盖 API 级联删除与「3 秒超时进任务中心」的契约/单元测试且通过。

## Assumptions Exposed + Resolutions
- 「场景」= 自定义场景主题（custom theme），不是系统预置 → 用户确认 Non-goals A
- 「立刻干净」与「>3s 后台」的张力 → 乐观移除（Round 2）
- 现有 `DELETE` 不完整 → 本需求扩展级联，而非仅修前端

## Pressure-pass Findings
Round 2 回访 Round 1：在坚持 C（数据+界面干净）的同时，超 3 秒进任务中心时采用乐观移除，而非「删除中」占位。

## Brownfield Evidence vs Inference
- `[from-code][auto-confirmed]`：`ThemeGateway` 已有删除按钮；`DELETE /api/theme/custom/:id` 仅删行 + 尝试删 Dify；`custom-add` 写入 vocabulary；项目已有 3s→任务中心模式
- `[from-code]`：`stay-stats` 用 theme 名关联 generation/attempts/vocabulary LIKE — 级联匹配需比 LIKE 更稳妥（授权 Decision Boundary A）
- `[from-user]`：C / 乐观移除 / 全级联 / Non-goals E / 授权 E / 验收 B

## Docs / Terminology Ledger
- 检视：`AGENTS.md`、`detail.md`（自定义主题链路）、`ThemeGateway.tsx`、`trainingAPI.ts`、`server.js` delete/add、`useVocabCollect.ts`、`GlobalTaskCenter.tsx`
- 规范用语：`自定义场景主题` / `custom_themes` / `任务中心`
- 用户「场景」→ 映射为自定义主题
- 可选后续（opt-in）：实现后可在 detail.md 补「级联删除」一句；**不自动写公开文档**

## Scenario / Edge-case Pressure
- 删除进行中用户刷新：乐观移除后依赖任务中心完成态与列表刷新
- Dify 失败：本地仍清，业务提示云端未完成
- 同名碰撞：匹配策略防误伤（授权自行设计）

## Technical Context Findings
- 触点：`ThemeGateway.tsx`、`DashboardTab.tsx`、`trainingAPI.ts`、`vocab-server/server.js` DELETE、任务队列/TaskContext、`GlobalTaskCenter`
- 参考实现：`useVocabCollect` 3 秒竞速托管

## Residual Risk
低。主要风险：词条匹配误伤（已授权保守匹配）；Dify 共享知识库历史设计与「按文档删除」的一致性需实现时验证。

## Handoff Notes
本文件为需求真源。下游规划/执行不得重新访谈默认范围；须保留 Intent、Non-goals、Decision Boundaries、Acceptance。
