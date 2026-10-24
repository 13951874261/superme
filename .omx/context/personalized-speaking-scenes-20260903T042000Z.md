# 个性化口语场景重构上下文

- 类型：brownfield
- 任务：重构“多角色练习”和“即兴演讲”界面，使用 Dify/LLM 生成个性化场景。
- 目标：解决主题固定、即兴演讲缺少背景与发言指引。
- 已确认机制：每位用户每日预生成不超过 10 个场景；结合账号最新画像；点击刷新以缓存内容保证首个非空内容 300ms 内到达；允许重新生成；达到 10 个后替换当前场景；重新生成时服务端读取最新画像；失败保留原场景。
- 画像方案：复用 `profileInject.js`、`resolveProfileForDify()`、`user_memories`；参考每日唤醒与长文生成链路。
- 调度方案：复用 `dailyPackCron`、`dailyCronRunService`、`taskQueue`，不使用 Dify Schedule Trigger 遍历用户。
- 技术边界：API Key 仅服务端；不改变现有导航、其他口语功能和现有 Dify 密钥配置；视觉与字段命名可自行决定。
- Dify 约束：输入变量声明 `user_current_profile`；服务端使用稳定 `user`；流式 `response_mode: streaming`；结构化输出。
- 现状：多角色由固定 `SCENE_DATABASE` 与少量主题映射驱动；即兴演讲直接复用全局主题且无独立换题。
- 安全：缓存和审计仅记录画像 hash/长度/存在性，不保存画像原文；重新生成不信任前端画像。
- 非目标：不重构自由即兴对话；不新增画像系统、调度框架或任务中心；不修改现有导航层级。
- 已检查：AGENTS.md、自由口语 PRD/计划、职业画像 Dify 联动设计、相关前后端实现、Dify 官方 Chatflow/Workflow/Schedule 文档。
- 初始上下文摘要：not_needed。
