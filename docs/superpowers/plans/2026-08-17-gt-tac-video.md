# GT-TAC-视频 驭人术资料异步提炼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Commit 策略：** 仅在用户明确要求 commit 时执行；默认改完跑测试即可。  
> **执行状态（2026-08-17）：** Task 1–5 已完成；单测/契约测已绿；**未 commit**；手工 E2E（PDF/视频异步提炼与回看）待用户本机验收。

**Goal:** 驭人术上传文档/视频统一走 `tactics_ingest` 异步任务：转写（视频）+ 抽手段入库；视频可播可看转写；限额 200MB/30min。

**Architecture:** 新 ingest API + media 表；复用 videoTranscriber（keepVideo/skipVocab）；抽出 extractTacticsFromText；TacticsPanel/TaskCenter 接线。

**Tech Stack:** Express + multer + better-sqlite3 + taskQueue + FFmpeg/ffprobe + React TaskContext。

**Spec:** `docs/superpowers/specs/2026-08-17-gt-tac-video-design.md`

---

## File map

| 文件 | 职责 |
| --- | --- |
| Create: `vocab-server/services/tacticsIngest.js` | 限额常量、时长校验、extract 编排、写 media/tactics |
| Create: `vocab-server/tests/tacticsIngest.test.js` | 纯函数/契约单测 |
| Modify: `vocab-server/services/videoTranscriber.js` | mode: keepVideo / skipVocab / outDir |
| Modify: `vocab-server/server.js` | DDL media + media_id；ingest-background；静态/鉴权取文件；抽出原 upload 逻辑 |
| Modify: `src/services/difyAPI.ts` | `requestTacticsIngestBackground`；TacticItem.media_id |
| Modify: `src/components/modules/GameTheory/TacticsPanel.tsx` | 异步上传 + 视频 accept + 媒体查看 |
| Modify: `src/components/TaskContext.tsx` + `GlobalTaskCenter.tsx` | `tactics_ingest` 类型与完成 UI |
| Create: 轻量前端契约测（可选静态） |

---

### Task 1: `tacticsIngest` 纯逻辑（TDD）

**Files:**
- Create: `vocab-server/services/tacticsIngest.js`
- Create: `vocab-server/tests/tacticsIngest.test.js`

- [ ] **Step 1:** 测 `TACTICS_INGEST_MAX_MB=200`、`MAX_MINUTES=30`；`assertWithinLimits({ sizeBytes, durationSec })`  
- [ ] **Step 2:** 测 `parseTacticsLlmJson` / 去重插入规划（可 mock）  
- [ ] **Step 3:** 实现并通过  

---

### Task 2: videoTranscriber mode

**Files:**
- Modify: `vocab-server/services/videoTranscriber.js`
- Test: 静态断言或对 options 分支的小测

- [ ] **Step 1:** 增加 options：`keepVideo`、`skipVocab`、`mediaOutDir`  
- [ ] **Step 2:** `skipVocab` 时跳过清库/生词本；`keepVideo` 时不 unlink 视频（可删临时 mp3）  
- [ ] **Step 3:** 英语默认调用路径无传 options → 行为与现网一致  

---

### Task 3: DDL + ingest-background API

**Files:**
- Modify: `vocab-server/server.js`

- [ ] **Step 1:** 建表 `game_theory_tactics_media`；`ALTER` 加 `media_id`（兼容已有库）  
- [ ] **Step 2:** `POST /api/game-theory/tactics/ingest-background`：校验体积 → 落盘 → createTask → 后台转写/抽文本 → extract → 写库  
- [ ] **Step 3:** `GET /api/tactics_media/:id` 与 `.../file`（userId 校验）  
- [ ] **Step 4:** 将现有 upload-tactics 抽文本+LLM 逻辑迁入 `tacticsIngest` 供复用  

---

### Task 4: 前端接线

**Files:**
- Modify: `difyAPI.ts`、`TacticsPanel.tsx`、`TaskContext.tsx`、`GlobalTaskCenter.tsx`

- [ ] **Step 1:** 上传改 background + addTask；accept 含 video  
- [ ] **Step 2:** 任务完成刷新列表；回看/转写入口  
- [ ] **Step 3:** 手段行有 media_id 时 Modal 播视频+转写  

---

### Task 5: 验证

- [ ] **Step 1:** `node --test vocab-server/tests/tacticsIngest.test.js` + 相关旧测  
- [ ] **Step 2:** 契约静态测（路由字符串 / task type）  
- [ ] **Step 3:** 向用户提交**一条**手工验收用例（先 PDF，再视频）  

---

## 风险

- 磁盘：永久保留视频需监控；可后续加清理策略（本轮不做自动删）。  
- ffprobe 未安装时时长校验失败 → 任务 failed 并提示。  
- 默认 **不 commit**；用户说「开始实现」后再改产品代码。
