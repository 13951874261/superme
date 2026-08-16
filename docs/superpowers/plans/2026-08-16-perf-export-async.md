# PERF-01 + 导出异步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Commit 策略：** 仅在用户明确要求 commit 时执行；默认改完跑测试即可。  
> **执行状态（2026-08-17）：** Task 1–5 已完成；契约/vault 导出单测已绿；**未 commit**；手工 E2E（导出进任务中心、切 Tab）待用户本机验收。

**Goal:** 驭心手段库与资料抽屉导出立刻进任务中心、不堵 UI；顶栏切模块 + 驭心 Tab keep-alive 缓解假死感。

**Architecture:** 复用 `taskQueue` + `GlobalTaskCenter` 的 `vocab_export` 结果契约；新增 tactics/vault background 导出 API；前端导出按钮改异步提交；`startTransition` + GameTheory `mountedTabs`。

**Tech Stack:** Express taskQueue、React TaskContext、docx Packer（已有）。

**Spec:** `docs/superpowers/specs/2026-08-16-perf-export-async-design.md`

---

## File map

| 文件 | 职责 |
| --- | --- |
| Modify: `vocab-server/server.js` | 两处 export-background 路由 |
| Modify: `src/services/difyAPI.ts` | `buildTacticsCsv` + `exportTacticsBackground` |
| Modify: `src/components/modules/GameTheory/TacticsPanel.tsx` | 异步导出 |
| Modify: `src/components/KnowledgeVault/vaultExport.ts` | background 提交辅助 |
| Modify: `src/components/KnowledgeVault/KnowledgeVaultDrawer.tsx` | 按钮接任务中心 |
| Modify: `src/components/GlobalTaskCenter.tsx` | 下载 tactics/vault（含 docx base64） |
| Modify: `src/components/MainContent.tsx` | startTransition 切模块 |
| Modify: `src/components/modules/GameTheoryModule.tsx` | Tab keep-alive |
| Create: 轻量测试（CSV 构建 / API 契约静态或 node:test） |

---

### Task 1: 服务端 tactics / vault export-background

**Files:**
- Modify: `vocab-server/server.js`
- Create: `vocab-server/tests/exportBackgroundContract.test.js`（可选：断言路由字符串存在 + result 字段约定注释）

- [ ] **Step 1:** `POST /api/game-theory/tactics/export-background`  
  - `createTask('tactics_export', ...)` → 立即 `res.json({ taskId })`  
  - `setImmediate`：拼 CSV（BOM + 列：手段名称,分类,描述,来源）→ `updateTask({ status:'completed', result:{ name, content, mimeType:'text/csv;charset=utf-8' } })`  
  - catch → `failed`

- [ ] **Step 2:** `POST /api/knowledge-vault/export-background`  
  - `format==='csv'`：用 body 提供的 rows 或 vaultSnapshot 拼 CSV  
  - `format==='docx'`：复用现有 docx 构建逻辑，`Packer.toBuffer` → base64 → `mimeType` docx，`encoding:'base64'` 字段可选  
  - 立即返回 taskId

- [ ] **Step 3:** 冒烟：node 断言路由源码含路径（静态）或最小 mock

---

### Task 2: GlobalTaskCenter 支持新类型下载

**Files:**
- Modify: `src/components/GlobalTaskCenter.tsx`

- [ ] **Step 1:** 将 `vocab_export` 下载分支泛化为「文本/CSV 类」含 `tactics_export`、`vault_export`（csv）  
- [ ] **Step 2:** docx：`result.encoding==='base64'` 时 `atob` → `Uint8Array` → Blob  
- [ ] **Step 3:** UI 完成态显示「下载」按钮（与 vocab 同级）

---

### Task 3: 前端导出入口改异步

**Files:**
- Modify: `difyAPI.ts` — 抽出 `buildTacticsCsvString`；新增 `requestTacticsExportBackground`  
- Modify: `TacticsPanel.tsx` — addTask + toast  
- Modify: `vaultExport.ts` — `requestVaultExportBackground`；保留同步构建函数给测试  
- Modify: `KnowledgeVaultDrawer.tsx` — 全部 CSV/Word 走任务；需 `useTask` / toast

- [ ] **Step 1:** 手段库导出不直接 `link.click`  
- [ ] **Step 2:** 抽屉全部导出 CSV/Word 异步  
- [ ] **Step 3:** 单测：`buildTacticsCsvString` / vault CSV rows 仍绿  

---

### Task 4: PERF 前端定点

**Files:**
- Modify: `MainContent.tsx` — Tab onClick 用 `startTransition(() => setActiveModule(...))`  
- Modify: `GameTheoryModule.tsx` — `mountedTabs` + `hidden={activeTab!==id}` 包各 Tab 面板

- [ ] **Step 1:** 切模块 transition  
- [ ] **Step 2:** 驭心 keep-alive（cases 默认挂载；其余首次进入再挂）  
- [ ] **Step 3:** 确认 session 面板不被错误卸载丢状态（keep-alive 正是为了保状态）

---

### Task 5: 验证清单

- [ ] 相关 node/vitest  
- [ ] 手工：导出进任务中心；导出中切 Tab/折叠；完成后下载  
- [ ] 手工：顶栏多模块往返 + 驭心 Tab 往返  

**功能测试案例**

| 编号 | 路径 | 预期 |
| --- | --- | --- |
| PERF-01 | 顶栏多模块 + 折叠 | 不假死；英语内容 keep-alive |
| 导出速度 | 驭人术导出；资料抽屉全部导出 | 立刻任务；可下载；不堵 UI |

---

## 执行说明

确认后按 Task 1→5 执行；**默认不 commit**。
