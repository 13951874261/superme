# Custom Book Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现并部署 PRD V1.3 定义的五格式私有书籍解析、任务中心、理论框架、听读及表达训练闭环。

**Architecture:** 保留 React/Vite、Express、SQLite、现有任务中心、D3、TTS/STT；书籍域使用独立 Router/Service 和 SQLite lease 队列。书籍文件置于非公开目录；Umi-OCR 作为回环 Docker 服务；Calibre 通过受限子进程执行。现有短材料与通用任务链不改。

**Tech Stack:** React 19、TypeScript、Vite、Express、better-sqlite3、Node test runner、pdf-parse、EPUB ZIP 解析、Calibre、Umi-OCR、Dify Workflow、Nginx、systemd。

---

### Task 1: 可信会话、迁移与训练隔离

**Files:**
- Create: `vocab-server/db/migrate.js`
- Create: `vocab-server/services/authSessionService.js`
- Create: `vocab-server/middleware/requireAuth.js`
- Create: `vocab-server/routes/authRoutes.js`
- Modify: `vocab-server/server.js`
- Modify: `src/components/LoginPage.tsx`
- Modify: `src/services/difyAPI.ts`
- Test: `vocab-server/tests/authSession.test.js`
- Test: `vocab-server/tests/trainingSessionIsolation.test.js`

- [ ] 写会话签发、HttpOnly cookie、到期、撤销、越权拒绝的失败测试。
- [ ] 运行 `node --test vocab-server/tests/authSession.test.js vocab-server/tests/trainingSessionIsolation.test.js`，确认因功能缺失失败。
- [ ] 使用 Node `crypto` 和 SQLite 实现随机 token、仅存 SHA-256、`req.auth.userId`；不引入 JWT。
- [ ] 使用 `PRAGMA user_version` 迁移 `auth_sessions`；重建 `training_sessions` 为 `UNIQUE(user_id, training_date)`。
- [ ] 登录页改用 `/api/auth/login`，前端请求启用 cookie；退出调用 `/api/auth/logout`。
- [ ] 重跑定向测试、邀请登录回归、`npm run lint`。

### Task 2: 私有上传与书籍核心模型

**Files:**
- Create: `vocab-server/services/bookStorage.js`
- Create: `vocab-server/services/bookUploadValidation.js`
- Create: `vocab-server/services/bookService.js`
- Create: `vocab-server/routes/bookRoutes.js`
- Modify: `vocab-server/db/migrate.js`
- Modify: `vocab-server/server.js`
- Test: `vocab-server/tests/bookUpload.test.js`
- Test: `vocab-server/tests/bookAuthorization.test.js`

- [ ] 写五格式允许、伪装/DRM/超限拒绝、SHA-256 去重、跨用户 404、事务失败清理测试。
- [ ] 运行测试，确认 RED。
- [ ] 创建 PRD 中 `books`、`book_revisions`、`book_source_units`、章节、框架、证据、删除表。
- [ ] 实现专用 Multer 磁盘上传、服务端路径、非公开目录、并发 2、格式初筛、原子移动。
- [ ] 同事务创建 book/revision/pending job；返回 `201 {bookId,jobId,jobStatus,createdAt}`。
- [ ] 重跑定向测试和现有上传回归。

### Task 3: SQLite lease 队列与全局重任务闸门

**Files:**
- Create: `vocab-server/services/bookJobService.js`
- Create: `vocab-server/services/bookJobRunner.js`
- Create: `vocab-server/services/heavyResourceGate.js`
- Create: `vocab-server/routes/bookJobRoutes.js`
- Test: `vocab-server/tests/bookJobLease.test.js`
- Test: `vocab-server/tests/bookJobCancellation.test.js`

- [ ] 写原子领取、lease/heartbeat、重启恢复、取消竞态、幂等、队列上限测试。
- [ ] 运行测试，确认 RED。
- [ ] 实现 SQLite 条件状态更新和单一 heavy slot。
- [ ] 实现 `GET /api/books/:bookId/jobs/:jobId` 聚合进度及 retry/cancel。
- [ ] 重跑测试；验证并发提交时仅一项运行。

### Task 4: PDF、EPUB、MOBI、AZW3、TXT 来源提取

**Files:**
- Create: `vocab-server/services/bookSourceExtractor.js`
- Create: `vocab-server/services/bookEpubExtractor.js`
- Create: `vocab-server/services/bookCalibreConverter.js`
- Create: `vocab-server/services/bookOcrClient.js`
- Create: `vocab-server/services/safeProcess.js`
- Modify: `vocab-server/package.json`
- Modify: `vocab-server/package-lock.json`
- Test: `vocab-server/tests/bookSourceExtractor.test.js`
- Test: `vocab-server/tests/bookResourceLimits.test.js`

- [ ] 用合法最小样本写五格式、locator、压缩炸弹、转换超限、OCR 失败测试。
- [ ] 运行测试，确认 RED。
- [ ] TXT 使用 BOM/UTF-8 优先及受控编码回退；EPUB 流式 ZIP 检查后提取 spine/XHTML 文本。
- [ ] MOBI/AZW3 通过 `execFile`/受限 wrapper 转 EPUB；禁止 shell 参数拼接。
- [ ] PDF 文本逐页保存；文本不足时逐页渲染并调用回环 Umi-OCR，保存原文/校对/diff。
- [ ] 所有格式写入 `book_source_units` 与格式中立 locator。
- [ ] 重跑测试并用样本执行直接运行检查。

### Task 5: 章节与证据化理论框架

**Files:**
- Create: `vocab-server/services/bookWorkflowProxy.js`
- Create: `vocab-server/services/bookFrameworkService.js`
- Create: `vocab-server/routes/bookFrameworkRoutes.js`
- Test: `vocab-server/tests/bookWorkflowProxy.test.js`
- Test: `vocab-server/tests/bookEvidenceValidation.test.js`

- [ ] 写章节候选/确认不可变、Dify Schema、locator/quote/hash、取消后拒写、框架确认测试。
- [ ] 运行测试，确认 RED。
- [ ] 按格式目录构建章节候选；用户确认后创建不可变 revision。
- [ ] 复用 Dify Workflow 代理模式，加入超时、重试、严格输出校验、run ID 和成本记录。
- [ ] 实现逐章提取、全书归并、证据验证、草稿编辑和确认；确认后同步 `knowledge_vault`。
- [ ] 重跑测试。

### Task 6: 前端上传、3 秒交接与任务中心

**Files:**
- Create: `src/types/books.ts`
- Create: `src/services/booksAPI.ts`
- Create: `src/hooks/useBookUploadHandoff.ts`
- Create: `src/components/books/BookUploader.tsx`
- Create: `src/components/books/BookJobCard.tsx`
- Modify: `src/components/modules/ListenModule.tsx`
- Modify: `src/components/GlobalTaskCenter.tsx`
- Modify: `src/App.tsx`
- Test: `src/services/booksAPI.test.ts`
- Test: `src/hooks/bookUploadHandoff.test.ts`
- Test: `src/utils/bookRouteState.test.ts`

- [ ] 写 multipart、无 userId、3→2→1、立即查看、单次跳转、jobId 精确查询测试。
- [ ] 运行 `npx tsx --test ...`，确认 RED。
- [ ] 实现书籍 API、上传组件、绝对截止时间 handoff、URL 状态。
- [ ] 任务抽屉插入并聚焦高亮 `BookJobCard`；终态停止轮询。
- [ ] 重跑测试、`npm run lint`、`npm run build`。

### Task 7: 听读理论树、证据与节点 TTS

**Files:**
- Create: `src/components/books/BookTheoryPanel.tsx`
- Create: `vocab-server/services/bookListenService.js`
- Modify: `src/components/modules/ListenModule.tsx`
- Modify: `src/components/modules/insight/InsightMindMap.tsx`
- Modify: `vocab-server/routes/bookFrameworkRoutes.js`
- Test: `vocab-server/tests/bookListenAudio.test.js`
- Test: `src/utils/bookTheoryTree.test.ts`

- [ ] 写当前框架、稳定节点 ID、证据回链、文字稿幂等、音频缓存/版本/删除测试。
- [ ] 运行测试，确认 RED。
- [ ] 在 `ListenModule` 增加“内置理论/我的书籍”，复用 D3 与等价树列表。
- [ ] 实现节点详情、证据、文字稿、用户触发 TTS、历史版本标记。
- [ ] 音频使用私有路径与鉴权读取；加入全局 heavy gate。
- [ ] 重跑测试、lint、build。

### Task 8: 一分钟复述与概念解释

**Files:**
- Create: `vocab-server/services/bookExerciseService.js`
- Create: `vocab-server/routes/bookExerciseRoutes.js`
- Modify: `vocab-server/services/audioTranscriptionService.js`
- Modify: `src/components/modules/SpeakModule.tsx`
- Modify: `src/components/modules/oralWarRoom/useMediaRecorder.ts`
- Test: `vocab-server/tests/bookExerciseEvaluation.test.js`
- Test: `src/services/bookExerciseFlow.test.ts`

- [ ] 写指定节点、两题型、60 秒、raw/polished transcript、结构化分数、幂等 attempt、历史恢复测试。
- [ ] 运行测试，确认 RED。
- [ ] STT 返回 raw+polished；评分只以 raw/用户修订文本判断理论准确性。
- [ ] `SpeakModule` 增加理论训练分支，复用成熟录音 hook；不新增顶级模块。
- [ ] 实现异步评价、终态轮询、证据回链、历史版本绑定。
- [ ] 重跑测试、lint、build。

### Task 9: 安全、资源、部署配置

**Files:**
- Modify: `super-agent-vocab.service`
- Modify: `app.liujingzhuwo.site`
- Modify: `deploy-smart.ps1`
- Create: `ops/umi-ocr/compose.yml`
- Create: `vocab-server/services/bookCleanupService.js`
- Test: `vocab-server/tests/bookSecurityConfig.test.js`

- [ ] 写无明文密钥、systemd 限制、Nginx 书籍限制、TTL/磁盘水位测试。
- [ ] 运行测试，确认 RED。
- [ ] 移除仓库密钥 fallback；改用权限 0600 `EnvironmentFile`。
- [ ] 设置 Node、OCR、Calibre 资源限制；创建私有目录及清理任务。
- [ ] 增加 `/api/books` 专用 Nginx 规则；保持现有 `/api/` 行为。
- [ ] 修复部署脚本 service 源文件、锁文件触发和危险 `.env` 覆盖行为。
- [ ] 重跑配置测试、`nginx -t` 等等价本地检查。

### Task 10: 全量验证、对抗审查与生产部署

**Files:**
- Create: `e2e/custom-book-flow.cjs`
- Modify only as failures require.

- [ ] 运行全部新增 Node/TS 测试及相关既有回归。
- [ ] 运行 `npm run lint`、`npm run build`。
- [ ] 启动本地服务，验证上传→任务→框架→听读→表达主路径及失败路径。
- [ ] 执行代码、安全、过度设计三类审查；修复全部阻断问题并复验。
- [ ] 只读预检生产服务器的 RAM/Swap/磁盘、Docker、Calibre、Node、Nginx、systemd。
- [ ] 轮换暴露密钥并安装受限 OCR/Calibre 依赖；不使用当前会自动提交全部工作区的危险部署流程。
- [ ] 备份生产配置和数据库；增量部署后端、前端、Nginx、systemd 与 OCR。
- [ ] 执行线上健康、五格式样本、3 秒交接、跨用户拒绝、任务恢复、听读、表达、资源互斥验证。
- [ ] 检查 OOM、Swap、Node/Nginx/SQLite 日志；任一发布阻断条件触发则回滚对应入口。
