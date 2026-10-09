# PERF-01 + 导出异步 设计

> **状态**：设计已批准（方案 1 / 范围 A）；实现计划见 `docs/superpowers/plans/2026-08-16-perf-export-async.md`；**尚未改产品代码**。  
> **日期**：2026-08-16  
> **关联**：冻结表 **PERF-01** + **导出速度**  
> **方案**：复用生词本 `export-background` + 任务中心下载；前端定点 `startTransition` + 驭心 Tab keep-alive

---

## 1. 目标与非目标

### 目标

1. **导出不堵 UI**：驭心手段库导出、资料抽屉导出（全部 Word/CSV 为主入口）点击后立刻进任务中心，完成后下载；失败可感知。  
2. **PERF-01**：顶栏切模块更顺；驭心 Tab 反复切换不反复整树卸载；折叠点击不夹带同步重活。

### 非目标

- 不优化 Dify/LLM 生成本身的耗时。  
- 不强制「≤N 秒同步下完」。  
- 不本轮改 XF-FEED-01 / 遮罩点不到（除非导出路径必须碰到）。  
- 分块导出可一并异步，但验收以「全部导出」+ 驭人术导出为主。

---

## 2. 导出异步架构

对齐已有：

- `POST /api/vocab/export-background` → `taskId`  
- 任务 `type: vocab_export`，`result: { name, content, mimeType }`  
- `GlobalTaskCenter` 完成态下载按钮

### 新增 API

| API | 用途 |
| --- | --- |
| `POST /api/game-theory/tactics/export-background` | body: `{ tactics: TacticItem[] }` → CSV 任务 |
| `POST /api/knowledge-vault/export-background` | body: `{ format: 'csv'\|'docx', title?, sections? \| vaultSnapshot? }` → 对应文件任务 |

任务类型建议：
- `tactics_export`
- `vault_export`

`result` 形状与 `vocab_export` 一致：`{ name, content, mimeType }`（docx 可用 base64 字符串 + mime `application/vnd.openxmlformats-officedocument.wordprocessingml.document`，或与现有二进制下载约定统一——**实现时优先：CSV 用文本 content；docx 用 base64 content + 任务中心按类型解码**）。

### 前端改造

- `TacticsPanel`：改为调用 background API + `addTask` + toast（保留纯函数 `buildTacticsCsv` 供测）。  
- `KnowledgeVaultDrawer`：全部导出 CSV/Word 走 background；同步 `exportAllToCsv` / `exportAllToWord` 可保留为内部构建或仅测试用。  
- `GlobalTaskCenter`：对 `tactics_export` / `vault_export` 显示下载按钮（复用 vocab 下载逻辑，docx 分支解码）。

### 资料在客户端

Vault 数据在前端：导出时 **POST 快照**（sections 或精简 vault JSON）到服务端生成，避免服务端读不到 localStorage。

---

## 3. PERF-01 前端定点

| 点 | 改动 |
| --- | --- |
| 顶栏切模块 | `setActiveModule` 外包 `startTransition`（`MainContent` / `App` 触发处） |
| 驭心 Tab | `GameTheoryModule`：`mountedTabs` + `hidden` keep-alive（对齐 `EnglishModule`），首次进入才挂载 session/simulation 等重面板 |
| 折叠 | 审计导出/导图折叠点击路径：不得在同一同步栈里跑全量导出或超大 `JSON.stringify`；导出已异步后自然缓解 |

---

## 4. 验收

| 场景 | 预期 |
| --- | --- |
| 驭人术 → 导出 | 立刻有任务；UI 可切 Tab；完成后可下载 CSV |
| 资料抽屉 → 导出全部 CSV/Word | 同上 |
| 顶栏英语↔洞察↔驭心往返 + 折叠 | 约 1s 内有响应，不整页假死；英语 keep-alive 内容仍在 |
| 导出失败 | 任务 `failed` + 可见 error |

---

## 5. 自检

- [x] 复用任务中心契约，不新造并行体系  
- [x] 导出两处冻结点名已覆盖  
- [x] PERF 改动面可控（非全站重构）  
- [x] 与「不设同步秒数硬门槛」一致  

---

## 6. 下一步

用户审阅无异议后按 plan 执行（默认 **不 commit**）。
