# 统一确认弹框执行规格

## 元数据

- Profile：Standard
- Rounds：5
- Final ambiguity：约 10%
- Threshold：20%
- Context：brownfield
- Context snapshot：`.omx/context/unified-confirm-dialog-20260904T041900Z.md`

## 意图

用站内自定义确认弹框替代浏览器原生 `confirm`，解决视觉突兀、样式不可控、交互不统一问题，同时避免改变任何现有业务行为。

## 目标结果

所有 `src/` 下原生 `confirm` 调用均迁移到一个轻量通用确认能力。浮层锚定在对应触发位置附近，自动避让触发按钮、Tab 与视口边缘；支持键盘及外部点击关闭，原操作的触发条件、请求、成功/失败处理保持不变。

## 范围内

- 替换当前识别的全部 8 处原生 `confirm` 调用。
- 创建最小通用确认组件/Hook，优先复用 React Portal 与项目现有样式。
- 支持动态提示正文。
- 统一默认标题、取消按钮、确认按钮。
- 支持取消、Esc、点击浮层外部关闭。
- 确认后执行调用点原有逻辑。
- 浮层优先显示在触发点下方；空间不足时自动切换至上方或侧面。
- 浮层与触发元素保留可见间距，不覆盖触发按钮或邻近 Tab。
- 视口滚动、缩放或布局变化时重新定位。
- 补充聚焦的组件或契约测试。

## 范围外 / 非目标

- 不修改业务逻辑、API、请求参数、成功/失败处理。
- 不新增移动端专属流程。
- 不顺带重构无关 Modal。
- 不引入第三方弹框依赖。
- 不扩展为完整设计系统。

## 决策边界

可自主决定：

- 通用组件文件位置与最小 API。
- 圆角、间距、危险色及锚点箭头等视觉细节。
- 测试文件与测试形式。

需再次确认：

- 任何业务/API 行为改变。
- 新增额外确认步骤。
- 删除或改写提示正文语义。
- 扩展到非 `confirm` 的现有 Modal 重构。

## 约束

- 保留每个调用点原提示内容。
- 标题与按钮统一；危险操作确认按钮使用危险语义样式。
- 点击浮层内容不得触发外部关闭。
- Esc、取消、点击浮层外部关闭不得执行回调。
- 定位不得覆盖触发元素；浮层必须完整约束在视口安全边距内。
- 定位策略适用于删除与非危险确认操作。
- 确认回调只执行一次。
- 基本无障碍：`role="alertdialog"` 或等效语义、`aria-modal="true"`、标题/描述关联、键盘焦点可用。
- 不新增依赖。

## 验收标准

1. 搜索 `src/` 不再存在 `confirm(`、`window.confirm(`、`globalThis.confirm(` 业务调用。
2. 自由口语删除会话显示站内弹框，正文包含会话标题及不可恢复提示。
3. 其他 7 个调用点显示同一确认 UI，正文保留原语义。
4. 点击取消、Esc、浮层外部：关闭浮层，不执行原操作。
5. 点击确认：仅执行一次原操作。
6. 浮层内容点击不关闭。
7. 所有确认浮层显示在对应触发点附近，不覆盖触发按钮、Tab 或超出视口。
8. 触发点附近空间不足时自动翻转位置；滚动、缩放后位置仍正确。
9. 删除、清空、同步等原 API 与后续状态处理保持原样。
10. 相关测试、TypeScript 检查、生产构建通过。

## 假设与处理

- 假设统一 UI 可覆盖删除与非删除确认：通过动态正文与统一动作按钮满足；不更改业务流程。
- 文案冲突：已确认保留正文，只统一标题与按钮。
- 多弹框并发：按单实例、后请求排队或拒绝的最小实现处理；不得导致回调串线。

## 压力复核结论

“保留行为”与“统一文案”曾存在潜在冲突。最终边界：提示正文语义原样保留；仅标题、取消/确认按钮统一。

## 代码依据

原生确认调用存在于：

- `src/components/modules/freeOral/FreeOralConversation.tsx`
- `src/components/ProfileEditModal.tsx`
- `src/components/KnowledgeVault/KnowledgeVaultDrawer.tsx`
- `src/components/GlobalTaskCenter.tsx`
- `src/components/modules/WeeklyChatModule.tsx`
- `src/components/UserProfileOverlay.tsx`
- `src/components/modules/english/tabs/dashboard/ThemeGateway.tsx`
- `src/components/modules/GameTheory/TacticsPanel.tsx`

## 文档与术语账本

- `AGENTS.md`：要求先确认、最小修改、测试验证。
- `docs/prd/free-speaking-chat.md`：自由口语删除必须二次确认。
- 术语：统一使用“确认弹框”；“提示正文”指各调用点现有消息；“业务行为”指原回调、API 与状态处理。
- 未发现文档与代码行为冲突；仅视觉实现落后于期望。
