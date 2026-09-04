# 统一确认弹框访谈摘要

- 模式：Standard
- 轮次：5
- 最终歧义：约 10%
- 阈值：20%
- 类型：brownfield

## 访谈结论

1. 覆盖项目内全部浏览器原生 `confirm`，不是只修自由口语删除框。
2. 共识别 8 处调用，涵盖删除、清空、同步等操作。
3. 全部替换 UI，保留各调用点原有业务逻辑与 API。
4. 保留原提示内容；统一标题、取消按钮、确认按钮。
5. 取消、Esc、点击遮罩均关闭；确认执行原操作。
6. 不新增移动端专属流程。

## 压力复核

第 2 轮要求“严格保留文案”，第 3 轮未选择“不重写文案”为非目标。第 4 轮进一步确认：保留提示正文，仅统一标题和操作按钮，消除冲突。

## 代码事实

原生调用位于：

- `src/components/modules/freeOral/FreeOralConversation.tsx`
- `src/components/ProfileEditModal.tsx`
- `src/components/KnowledgeVault/KnowledgeVaultDrawer.tsx`
- `src/components/GlobalTaskCenter.tsx`（2 处）
- `src/components/modules/WeeklyChatModule.tsx`
- `src/components/UserProfileOverlay.tsx`
- `src/components/modules/english/tabs/dashboard/ThemeGateway.tsx`
- `src/components/modules/GameTheory/TacticsPanel.tsx`

项目无通用确认组件；已有 Portal、自定义 `role="dialog"` 模式可复用。
