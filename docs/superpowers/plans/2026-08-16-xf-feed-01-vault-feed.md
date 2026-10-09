# XF-FEED-01 资料抽屉精进闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Commit 策略：** 仅在用户明确要求 commit 时执行；默认改完跑测试即可。  
> **执行状态（2026-08-17）：** Task 1–6 已完成（主线程实现）；单测/契约测已绿；**未 commit**；手工 E2E（抽屉上传→同步→用满 3 次加深）待用户本机验收。

**Goal:** 资料抽屉内嵌上传书/材料 → 导图+theory 草稿入库 → 同步听/说/博弈；使用≥3 次后自动变难并再提炼（任务中心可追踪）。

**Architecture:** 复用 `material` 管线与 `loadInjectedKnowledge`/traces；扩展 `knowledgeVaultExtra`；材料成功时持久化 mindmap；traces 达阈触发 `vault_refine` 异步任务（难度+1 + LLM 摘要 + revisions）。

**Tech Stack:** Express + taskQueue、SQLite knowledge_vault、React KnowledgeVaultDrawer / MaterialUploader、node:test + Vitest 风格纯函数测。

**Spec:** `docs/superpowers/specs/2026-08-16-xf-feed-01-vault-feed-design.md`

---

## File map

| 文件 | 职责 |
| --- | --- |
| Modify: `vocab-server/services/knowledgeVaultExtra.js` | difficulty / refineStatus / usageCount / mindmap 解析与 patch |
| Create: `vocab-server/services/vaultRefine.js` | usage 聚合、达阈判断、enqueue、执行 refine（LLM+写库） |
| Create: `vocab-server/tests/vaultRefine.test.js` | 纯函数与触发契约单测 |
| Create: `vocab-server/tests/knowledgeVaultExtraFeed.test.js` | extra 新字段解析 |
| Modify: `vocab-server/services/knowledgeTheoryNodes.js`（或旁路） | 导入时写入 mindmap 笔记 + 统一 sourceRef |
| Modify: `vocab-server/services/gameTheoryKnowledge.js` | 注入排序 difficulty DESC；可选标题「（加深）」 |
| Modify: `vocab-server/server.js` | material 成功落导图；traces 后 maybeEnqueue；`POST .../refine` 重试 |
| Modify: `src/types/knowledge.ts` + `useKnowledgeVault.ts` | 前端类型对齐 |
| Modify: `src/components/MaterialUploader.tsx` | 可选 `compact` / `topicHint` / `variant` 供抽屉嵌入 |
| Modify: `src/components/KnowledgeVault/KnowledgeVaultDrawer.tsx` | 嵌入上传、导图只读、难度/次数/精进 UI、重试 |
| Modify: `src/components/TaskContext.tsx` + `GlobalTaskCenter.tsx` | `vault_refine` 类型与文案；完成刷新 vault |
| Create: `src/utils/vaultFeedMeta.ts` + `*.test.ts`（可选） | 前端展示用 difficulty 徽章等纯函数 |

---

### Task 1: `knowledgeVaultExtra` 扩展（TDD）

**Files:**
- Modify: `vocab-server/services/knowledgeVaultExtra.js`
- Create: `vocab-server/tests/knowledgeVaultExtraFeed.test.js`

- [ ] **Step 1:** 写失败测试：`parseKnowledgeVaultExtra` 缺省 `difficulty=1`、`refineStatus='idle'`、`usageCount=0`；patch 可写入 mindmap  
- [ ] **Step 2:** 实现解析与 `buildKnowledgeVaultExtra` / `collectKnowledgeVaultExtraPatch` 透传新字段  
- [ ] **Step 3:** 测试通过  

---

### Task 2: `vaultRefine` 纯逻辑 + 触发（TDD）

**Files:**
- Create: `vocab-server/services/vaultRefine.js`
- Create: `vocab-server/tests/vaultRefine.test.js`

- [ ] **Step 1:** 测试：`countTracesForNote`、`shouldEnqueueRefine({ usageCount:3, refineStatus:'idle', difficulty:1 }) === true`；`pending`/`usage<3`/`difficulty` 边界  
- [ ] **Step 2:** 实现 `REFINE_USAGE_THRESHOLD=3`、`bumpDifficulty`、`buildRefinePrompt`、`applyRefineResult`（mock LLM）  
- [ ] **Step 3:** 测试通过  

---

### Task 3: 材料任务落导图 + sourceRef

**Files:**
- Modify: `vocab-server/services/knowledgeTheoryNodes.js` 和/或 `server.js` material 成功分支  
- Test: 扩展既有 knowledgeTheoryNodes 测或静态契约测

- [ ] **Step 1:** `importTheoryNodeDrafts`（或并列函数）接受 `mindmap` + `sourceRef=material:{taskId}`  
- [ ] **Step 2:** 写入导图笔记（draft）+ 各 theory 节点同源 `sourceRef`  
- [ ] **Step 3:** 冒烟：断言导入后可查出 mindmap extra  

---

### Task 4: 注入排序 + traces 后入队

**Files:**
- Modify: `vocab-server/services/gameTheoryKnowledge.js`
- Modify: `vocab-server/server.js`（listen/speak/game_theory 注入成功处）  
- Optional: `POST /api/knowledge-vault/notes/:id/refine`

- [ ] **Step 1:** `sortLinkedKnowledgeRows` 或注入前按 difficulty DESC  
- [ ] **Step 2:** context 标题 difficulty≥3 加「（加深）」  
- [ ] **Step 3:** traces 写入后 `maybeEnqueueVaultRefine`：`createTask('vault_refine')` + setImmediate 执行；更新 usageCount/refineStatus  
- [ ] **Step 4:** 手动重试路由立即返回 taskId  

---

### Task 5: 前端抽屉嵌入上传 + 展示

**Files:**
- Modify: `MaterialUploader.tsx`（必要时加 compact props，避免大改英语页）  
- Modify: `KnowledgeVaultDrawer.tsx`  
- Modify: `useKnowledgeVault.ts` / `src/types/knowledge.ts`  
- Modify: `TaskContext.tsx` / `GlobalTaskCenter.tsx`

- [ ] **Step 1:** 抽屉理论区嵌入上传；任务完成刷新列表  
- [ ] **Step 2:** 导图只读展示（有 `extra.mindmap` 时）  
- [ ] **Step 3:** 卡片显示难度、次数、精进状态；failed → 调 refine API  
- [ ] **Step 4:** `vault_refine` 进类型联合；完成派发 `knowledge-vault-updated`  

---

### Task 6: 验证

- [ ] **Step 1:** 跑 `node --test vocab-server/tests/knowledgeVaultExtraFeed.test.js vocab-server/tests/vaultRefine.test.js`（及受影响旧测）  
- [ ] **Step 2:** 前端相关 vitest/node 测（若有）  
- [ ] **Step 3:** 向用户提交**一条**手工验收用例（菜单路径 / 数据 / 预期），等确认后再进入下一项反馈  

---

## 风险与默认

- LLM 再提炼失败不得清空正文。  
- 英语 `MaterialUploader` 全功能页保持可工作；抽屉可用 compact。  
- 默认 **不 commit**；用户说「开始实现」后再改产品代码。
