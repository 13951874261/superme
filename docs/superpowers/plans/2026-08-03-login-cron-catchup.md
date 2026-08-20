# Login Cron Catch-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 可靠记录页面登录用户，并为错过 02:00 生成的用户补齐当天唤醒、破绽、长文和音频。

**Architecture:** 把单用户补跑封装到后端服务并用进程内 Promise 去重；登录接口同步完成登记后异步触发补跑。前端改为检查 login-ping 响应，服务器诊断由独立只读脚本完成。

**Tech Stack:** Node.js 20、Express、better-sqlite3、React/TypeScript。

---

### Task 1: 单用户补跑服务

**Files:**
- Modify: `vocab-server/services/dailyListenPreGenerateService.js`
- Modify: `vocab-server/services/dailyPackCron.js`
- Test: `vocab-server/scripts/test-login-catchup.js`

- [ ] 先写失败测试，验证同一用户同一天只启动一次补跑，且仅补缺失包。
- [ ] 使用内置 Node 20 运行测试并确认因导出不存在而失败。
- [ ] 提取 `runDailyListenForUser`，让 cron 和登录补跑共用单用户生成逻辑。
- [ ] 实现 `scheduleUserDailyCatchup`，按 `userId + packDate` 管理进行中的 Promise。
- [ ] 重跑测试并确认通过。

### Task 2: 登录登记可靠化

**Files:**
- Modify: `vocab-server/server.js`
- Modify: `src/utils/profileHelper.ts`
- Modify: `src/App.tsx`

- [ ] 后端 login-ping 在落库后调用 `scheduleUserDailyCatchup`，立即返回 `catchupScheduled`。
- [ ] 前端新增可等待、检查响应的 login-ping 函数。
- [ ] 会话初始化先打点再加载画像；App 的兜底打点保留明确错误日志。
- [ ] 运行 `pnpm lint` 确认 TypeScript 通过。

### Task 3: 服务器只读诊断

**Files:**
- Create: `vocab-server/scripts/check-user-daily-readiness.js`

- [ ] 接受命令行用户 ID，读取生产/本地正确数据库路径。
- [ ] 输出主题、最近登录、当天 pack、长文与音频计数。
- [ ] 使用本地 Node 20 对 `lzhmy` 运行并确认无写操作。

### Task 4: 验证与部署

**Files:**
- Verify only.

- [ ] 运行定向后端测试、前端类型检查和构建。
- [ ] 检查 diff，确保不包含无关文件或秘密。
- [ ] 增量上传后端与前端到 `150.158.34.217`，重启 `super-agent-vocab`。
- [ ] 在服务器运行健康检查和 `check-user-daily-readiness.js lzhmy`。
