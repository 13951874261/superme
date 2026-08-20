# 上下文快照：自定义场景级联删除

- slug: `custom-theme-cascade-delete`
- 时间: 2026-08-20T14:43:00Z (UTC+8 22:43)
- 类型: brownfield
- 超大上下文摘要门: `not_needed`
- 相关对话前置: 用户先确认「自定义场景主题」可自由新增 + 及时删除；本轮扩展为「删除场景时联动删除关联内容」

## 任务陈述
新增/完善删除场景功能；删除某个自定义场景时，与其联动的其他内容一并删除。

## 期望结果（用户表述，待访谈细化）
删除自定义场景后，场景本身及其联动产物不再残留，避免继续出现在可选列表或训练闭环中。

## 用户给出的解法陈述
「新增删除场景的功能，场景联动的其他内容也请一并删除」（症状/目标混合；未定义“联动内容”边界）。

## 意图假设
用户不希望“删了主题名、但词库/长文/口语记录/知识库仍挂着该主题”，造成幽灵数据污染后续练习与统计。

## 已知事实（代码证据）`[from-code][auto-confirmed]`

### 前端入口
- `ThemeGateway.tsx`：选中**当前**自定义主题时显示红色垃圾桶；确认后调 `deleteCustomTheme(id)`，成功后切回系统预置第一项并 `refreshCustomThemes()`
- `CustomThemeModal.tsx`：`+ 自定义` 创建入口
- `DashboardTab.tsx`：`currentCustomTheme` 用 `displayName || themeName === theme` 匹配；动态 import `trainingAPI.deleteCustomTheme`
- `EnglishContext.tsx`：`listCustomThemes` / `refreshCustomThemes`

### API
- `POST /api/theme/custom-add`：上传材料 → Dify 知识库 → 工作流萃取 → upsert `custom_themes` → 写入 `vocabulary`（`ai_extracted` / `ai_phrase`，payload 含 `topic`/`source: Custom Theme Extract`）
- `DELETE /api/theme/custom/:id`：**仅**尝试删 Dify 文档 + `DELETE FROM custom_themes`；**不**删 vocabulary / generation_history / training_attempts 等
- `GET /api/theme/stay-stats`：按 theme 名统计 generation_history、training_attempts、vocabulary（payload LIKE）

### 创建时产生的联动数据（推断，待确认范围）
1. `custom_themes` 行 + `dify_document_id` / `dify_dataset_id`
2. `vocabulary` 中萃取词/短语（topic 绑定主题名）
3. 后续训练可能产生：`generation_history.theme`、`training_attempts.scene_type`、主题通关/聚焦状态等

### 危险边界（需访谈）
- `custom-add` 会**清空整个** `Knowleage_Pro_Scenarios` dataset 再上传——知识库似为共享槽位，不是严格一主题一文长期并存；删除行为与该设计可能冲突
- 预置系统主题不可删（前轮用户已确认方向）

## 约束
- AGENTS.md：需求复述 → 计划确认 → 分步执行；deep-interview 阶段**禁止直接实现**
- 仅改用户确认范围；优先复用现有 delete API / ThemeGateway

## 未知 / 开放问题
- “联动其他内容”具体包含哪些表/模块？
- 删除是否硬删除、是否可恢复？
- 与当前主题选中态、今日长文缓存、口语战局会话如何处理？
- Non-goals / Decision Boundaries 未定义

## 决策边界未知
- OMX 可否自行决定联动表清单？
- 匹配键用 `theme_name` 还是 `display_name` 还是 `id`？
- Dify 删除失败时本地是否仍删？

## 可能触点
- `ThemeGateway.tsx`, `DashboardTab.tsx`, `CustomThemeModal.tsx`
- `src/services/trainingAPI.ts`
- `vocab-server/server.js` `DELETE /api/theme/custom/:id` 与相关表清理
- 可能涉及 vocabulary / generation_history / training_* / 本地缓存

## 已检文档/规则
- `AGENTS.md`（确认优先、中文、分步）
- `detail.md`（自定义主题 Base64 → trainingAPI → Dify）
- 无既有 `.omx/context/*custom-theme*` 快照

## 术语
- 仓库用语：`custom theme` / `自定义场景主题` / `custom_themes`
- 用户用语：「场景」≈ 上述自定义主题（待确认是否含系统预置）

## Prompt-safe 初始上下文摘要状态
`not_needed`
