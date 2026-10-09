# XF-FEED-01 资料抽屉精进闭环设计

> **状态**：设计已批准（方案 1 · 痕迹驱动 + 异步加深）；实现计划见 `docs/superpowers/plans/2026-08-16-xf-feed-01-vault-feed.md`；**尚未改产品代码**。  
> **日期**：2026-08-16（批准 2026-08-17）  
> **关联**：`docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`（XF-FEED-01）  
> **方案**：抽屉内嵌 `MaterialUploader` 复用 `material` 管线；导图入库；traces≥N 触发 `vault_refine`（变难 + 再提炼一期双交付）

---

## 1. 目标与非目标

### 目标

1. **资料抽屉主入口**：上传书/材料 → 导图可回看 + theory 知识点草稿入库 → 用户勾选同步到听 / 说 / 博弈。  
2. **精进一期双交付**：  
   - **A 推送变难**：知识点使用达阈值后提高 `difficulty`，注入优先更深/更难条目。  
   - **B 知识点再提炼**：同一触发下 LLM 生成更深摘要，revision 快照后更新正文。  
3. 全程可追踪：上传走任务中心 `material`；加深走任务中心 `vault_refine`。

### 非目标

- 听 / 驭人术 / 英语材料提纯等**其他上传口本轮不强制与抽屉行为统一**（可保留现状）。  
- 不做 L1/L2/L3 多笔记版本链。  
- 不改博弈会话引擎、不强制场景出题侧注入。  
- 不强制原生 `.xlsx`（导出已另项覆盖）。

---

## 2. 架构

```
[KnowledgeVaultDrawer]
   └─ 嵌入 MaterialUploader（sourceHint=vault / compact 文案）
            ↓
   POST /api/material/process-and-extract  → task type: material
            ↓
   theoryNodes → importTheoryNodeDrafts（现有，draft）
   mindmap     → 持久化到 vault（extra_json.mindmap + 同源 sourceRef）
            ↓
   用户「确认并同步」→ syncStatus=synced + moduleTargets
            ↓
   听/说/博弈 analyze 路径 loadInjectedKnowledge（现有）
            ↓
   appendKnowledgeTraces
            ↓
   聚合 usage ≥ N(=3) 且 refineStatus∉{pending} → createTask('vault_refine')
            ├─ difficulty = min(5, difficulty+1)
            └─ LLM 再提炼 → revisions 快照 → 更新 summary/content → refineStatus=done
```

---

## 3. 数据契约

### 3.1 `extra_json` 扩展（`knowledgeVaultExtra`）

| 字段 | 类型 | 默认 | 含义 |
| --- | --- | --- | --- |
| `difficulty` | number 1–5 | `1` | 推送变难等级 |
| `refineStatus` | `'idle'\|'pending'\|'done'\|'failed'` | `'idle'` | 最近一次加深状态 |
| `usageCount` | number | `0` | 缓存展示用；真相源仍为 `knowledge_vault_traces` |
| `mindmap` | `{ center, branches }` 可选 | — | 仅导图载体笔记或同批主笔记持有 |
| `sourceRef` | string（现有） | — | 同批用 `material:{taskId}` 串联导图与 theory 草稿 |

### 3.2 导图持久化

- 材料任务成功后：除 `importTheoryNodeDrafts` 外，**写入一条** theory 类笔记（或专用 `sourceType: 'mindmap'`），`extra_json.mindmap` = 结构化导图，`title` 如「导图 · {topic}」，`syncStatus: 'draft'`。  
- 同批 theory 节点与该导图共享 `sourceRef = material:{taskId}`。  
- 抽屉可只读展开导图；同步时用户可勾选模块（与其他草稿相同流程）。

### 3.3 触发与加深

| 项 | 约定 |
| --- | --- |
| 阈值 **N** | **3**（同一 noteId，全模块 traces 合计） |
| 触发时机 | 每次 `appendKnowledgeTraces` 成功后检查；或独立 `maybeEnqueueVaultRefine(noteId)` |
| 防抖 | `refineStatus === 'pending'` 不重复入队；`difficulty >= 5` 可再提炼正文但不升难度 |
| 任务类型 | `vault_refine` |
| 失败 | `refineStatus='failed'`；抽屉提供「重试加深」→ 再入队 |
| 成功 | 先写 `knowledge_vault_revisions`，再更新笔记正文/summary，`difficulty+=1`（上限 5），`refineStatus='done'`，刷新 `usageCount` |

### 3.4 注入排序

`loadInjectedKnowledge`：在已 synced ∩ moduleTargets 集合上排序  

`difficulty DESC` → `confirmedAt DESC` → 取最多 5 条。  

`difficulty >= 3` 时 context 标题旁标注「（加深）」。

---

## 4. UI

| 位置 | 行为 |
| --- | --- |
| 抽屉理论区顶部 | 嵌入 `MaterialUploader`（文件 Tab 为主；文案「上传书籍/材料」）；成功 toast + 依赖现有 `knowledge-vault-updated` 刷新 |
| 导图笔记 | 只读树/分支列表（不要求可编辑） |
| 知识点卡片 | 展示难度徽章、使用次数、精进状态；失败显示重试 |
| 任务中心 | `vault_refine` 显示「知识点加深」类文案；完成无强制下载 |

---

## 5. API / 任务

| 能力 | 说明 |
| --- | --- |
| 现有 `POST /api/material/process-and-extract` | 扩展结果落库：mindmap 笔记 + 同 `sourceRef` |
| 现有 sync / linked / traces | 不变语义 |
| 新增内部：`enqueueVaultRefine` / 路由可选 `POST /api/knowledge-vault/notes/:id/refine`（手动重试） | 立即返回 `taskId`，后台 LLM + 更新 |
| `TaskContext` 类型联合 | 增加 `'vault_refine'`；完成时派发 `knowledge-vault-updated` |

LLM 再提炼：优先复用仓内已有兜底 LLM 调用模式；prompt 要求输出更深、可执行的中文摘要，禁止空话；解析失败则 `failed` 不覆盖正文。

---

## 6. 验收

| 场景 | 预期 |
| --- | --- |
| 抽屉上传书/材料 | 立刻有 `material` 任务；完成后出现 theory 草稿 + 可展开导图 |
| 勾选听/说/博弈同步 | 训练注入 reminder 非空；traces 增加 |
| 同一知识点累计使用 ≥3 | 自动出现 `vault_refine`；难度升高；摘要变深；有 revision |
| 加深失败 | 状态 failed + 可重试；原正文保留 |
| 英语材料提纯口 | 可保留；本轮不要求与抽屉 UI 一致 |

---

## 7. 自检

- [x] 主入口在抽屉；复用 material 管线（批准选项 A）  
- [x] 变难 + 再提炼同一触发、一期双交付（批准方案 1）  
- [x] N=3、difficulty 1–5、导图 `extra_json.mindmap` + `sourceRef` 已写死默认  
- [x] 非目标：其他上传口不强制统一  
- [x] 无 TBD 占位  

---

## 8. 下一步

用户审阅本 spec 无异议后，按 `docs/superpowers/plans/2026-08-16-xf-feed-01-vault-feed.md` 执行（默认 **不 commit**，待用户说「开始实现」）。
