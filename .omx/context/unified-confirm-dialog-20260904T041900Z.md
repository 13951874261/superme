# 统一确认弹框上下文

- 类型：brownfield
- 任务：替换项目内全部浏览器原生 `confirm` 弹框。
- 目标：消除浏览器原生弹框的突兀视觉与不可控交互，提供站内一致的确认体验。
- 已确认范围：覆盖 `src/` 下全部 8 处原生 `confirm` 调用，包括删除、清空、同步等操作。
- 行为边界：严格保留现有业务逻辑与 API；不新增移动端专属流程。
- 文案规则：保留原提示内容；统一弹框标题、取消按钮、确认按钮。
- 关闭规则：取消、Esc、点击遮罩均关闭；确认按钮执行原操作。
- 现有事实：项目没有通用 `ConfirmDialog`；多个组件已有 `role="dialog"`/Portal 模式；`FreeOralConversation.tsx` 内已有自定义 Dialog 样式可参考。
- 相关文件：`FreeOralConversation.tsx`、`ProfileEditModal.tsx`、`KnowledgeVaultDrawer.tsx`、`GlobalTaskCenter.tsx`、`WeeklyChatModule.tsx`、`UserProfileOverlay.tsx`、`ThemeGateway.tsx`、`TacticsPanel.tsx`。
- 相关文档：`AGENTS.md`、`docs/prd/free-speaking-chat.md`。
- 非目标：业务/API 改造；移动端专属流程。
- 决策权限：可决定通用组件文件位置、视觉细节、测试落点；不得改变操作触发条件、数据请求、成功/失败处理。
- 初始上下文摘要：not_needed。
