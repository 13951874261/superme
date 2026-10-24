# 自由即兴口语对话实施计划

**日期：** 2026-09-02  
**目标：** 在口语练习内新增独立“自由即兴对话”，复用现有 Dify 口语 Chatflow、Dify 表达提取 Workflow、统一生词收录链路；不改变角色练习。

## 第一性原理边界

- Dify：AI 对话编排、`conversation_id` 上下文、流式回复、表达提取。
- 本地：会话索引与消息事实源、`/focus` 状态、用户隔离、UI。
- 复用：`sendOralChatMessageStream()`、`callVocabPurify()`、`useVocabCollect()`、现有 SQLite。
- 不新增依赖；不复制词典/收录逻辑；不修改 Dify Workflow 配置。

## 执行顺序（TDD）

1. **纯函数契约**
   - 新增失败测试：严格 `/focus 主题`、1—100 字、普通自然语言不误判；Dify 候选规范化与去重。
   - 最小实现并通过测试。

2. **会话持久化契约**
   - 新增失败测试：SQLite 表、会话 CRUD、消息顺序、`user_id + session_id` 隔离、主题更新。
   - 实现单一服务模块；`server.js` 仅挂载路由。

3. **Dify 编排接口**
   - 自由对话继续调用现有 `/api/english/oral/chat`。
   - 复用 Dify 已声明的 `intent_judgement=daily`、`custom_background`、`scene_title`、`roles`、`role_switch_instruction`；本地 `focus_topic` 映射到 `custom_background`；保存 Dify `conversation_id`。
   - 流式完成后保存 AI 消息；失败保留用户消息并允许重试。

4. **前端自由对话 UI**
   - 口语模块顶级切换：“角色练习 / 自由即兴对话”。
   - 会话列表、新建、继续、删除；消息区、输入区、主题状态。
   - GSAP 仅做面板/消息轻动画；`useGSAP` 作用域清理；尊重 `prefers-reduced-motion`。

5. **一键收入生词本**
   - AI 消息调用 `callVocabPurify()`。
   - 展示单词/短语/句式候选，用户勾选并选择“政商务/全场景”。
   - 逐条调用 `useVocabCollect()`；不另建收录 API。

6. **验证与红队**
   - 新增测试、现有口语关键测试、`npm run lint`、`npm run build`。
   - 边界：空主题、超长主题、重复候选、跨用户读取、Dify 中断、空回复、重复点击、刷新恢复。
   - 浏览器验证入口、流式对话、主题聚焦、历史恢复、候选收录、角色练习回归。

## 红队预案

- **串话：** 所有会话和消息查询同时限定 `user_id`、`session_id`。
- **Dify 上下文丢失：** 每会话独立持久化 `conversation_id`，恢复时继续传入。
- **本地与 Dify 双写不一致：** 用户消息先落库；AI 消息仅在流式完成后落库；失败不伪造成功回复。
- **指令注入：** 仅整行匹配 `/focus\s+(.+)`；主题长度限制；本地主题作为低权限背景映射到 Dify `custom_background`，不新增 Workflow 变量。
- **批量收录风暴：** 禁用提交按钮；复用现有 3 秒后台转交机制。
