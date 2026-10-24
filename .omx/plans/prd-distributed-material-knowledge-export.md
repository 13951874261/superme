# PRD：平台级分布式素材结构化知识生成（导图 + 知识点 + 解释/举例 + 多格式导出）

> **文档名称：** 平台级分布式素材结构化知识生成  
> **状态：** 待评审  
> **日期：** 2026-08-17  
> **首期落地场景：** 洞察(听) → 分布式素材上传  
> **验收锚点：** `LS-MAT-01`（及平台级等价用例 PK-MAT-*）

---

## 1. Executive Summary

**Problem Statement**  
当前分布式素材上传后的核心产出偏向训练案例生成，缺少稳定的「知识结构化沉淀」能力。用户上传书本、章节、案例材料后，无法直接获得可复用的思维导图、知识点、解释/举例及可导出知识资产，素材价值停留在一次性消费。

**Proposed Solution**  
建设平台级「分布式素材结构化知识生成能力」：用户上传 `PDF / 网页链接 / txt / docx` 后，系统自动解析并生成思维导图、知识点、解释与举例；导出前提供人工确认/编辑环节；确认后可导出为 `Word`、`Markdown`、`图片/PDF`。

**Success Criteria**

1. 首期支持 `PDF / 网页链接 / txt / docx` 四类输入，均可进入统一结构化流程。
2. 成功解析素材可生成「导图 + 知识点 + 解释/举例」，`explanation` 非空率 ≥ 80%（成功提取样本）。
3. 所有导出必须经过人工确认，未确认内容不得正式导出。
4. 导出覆盖 Word、Markdown、图片/PDF，层级结构一致。
5. 平台能力可被多业务模块复用，不与单一场景强耦合。
6. 保留并兼容「训练案例生成」并行链路。

---

## 2. User Experience & Functionality

### User Personas

- **内容学习者/训练者**：上传素材，获取结构化知识并对照学习、导出沉淀。
- **内容运营/教研人员**：批量整理素材，确认后导出供团队复用。
- **业务模块开发者**：接入统一能力，避免重复实现解析与导出。

### User Stories

#### Story 1：素材上传与结构化生成

As a 内容学习者, I want 上传 PDF / 网页链接 / txt / docx 后自动生成思维导图、知识点、解释与举例, so that 我不必手动整理长文素材。

**Acceptance Criteria：**

- AC1.1 首期支持四类输入：`PDF`、`网页链接`、`txt`、`docx`。
- AC1.2 上传成功后进入统一处理流程，状态可见（处理中 / 成功 / 失败）。
- AC1.3 成功解析后产出：**思维导图树 + 知识点列表 + 解释 + 举例**。
- AC1.4 同一素材可同时触发「训练案例生成」（若业务模块启用），两条链路互不阻塞、互不覆盖。
- AC1.5 解析失败时给出明确原因与后续指引（如重试、换格式、手动录入），不得静默丢失。

#### Story 2：知识点展示（非推送机制）

As a 内容学习者, I want 在页面中直接查看结构化知识点及其解释/举例, so that 我能对照学习，而不依赖消息流或推荐机制。

**Acceptance Criteria：**

- AC2.1 「知识点推送」在本 PRD 中定义为 **生成并展示**，不包含聊天式推送、定时推送、答题后智能推荐。
- AC2.2 知识点与导图节点一一关联或可映射；点击导图节点可定位对应知识点详情。
- AC2.3 每个知识点至少包含：**标题、解释、至少 1 条例句/场景举例**（生成失败时允许占位并提示补全）。
- AC2.4 支持折叠/展开：默认以导图骨架为主，详情按需展开，避免长文铺满页面。
- AC2.5 展示层与业务模块 UI 解耦：平台提供标准数据结构与渲染契约，各模块可定制布局但语义一致。

#### Story 3：人工确认与编辑后导出

As a 内容学习者, I want 在导出前检查并修改 AI 生成内容, so that 导出文件可信、可用。

**Acceptance Criteria：**

- AC3.1 所有导出操作前必须经过 **「确认」** 状态；未确认内容不得作为正式导出。
- AC3.2 首期支持编辑：修改节点/知识点标题、解释、举例；删除节点；补充缺失说明。
- AC3.3 不支持首期范围：完整可视化导图编辑器（拖拽改结构、多人协作、版本分支）。
- AC3.4 确认后可导出为三种格式：
  - `Word (.docx)`：保留「素材标题 → 章节/节点 → 知识点 → 解释/举例」层级，Heading 样式可编辑。
  - `Markdown (.md)`：同上层级，适合二次整理与 Git 管理。
  - `图片 / PDF`：导图可视化快照，适合分享与打印。
- AC3.5 导出文件名可读，例如 `{素材标题}-知识结构化-{YYYYMMDD}.docx`。
- AC3.6 导出仅在客户端/服务端按既有安全通道生成，不泄露 API Key 或内部任务 ID。

#### Story 4：平台级复用与业务接入

As a 业务模块开发者, I want 接入统一的分布式素材结构化能力, so that 各模块不必重复实现解析、生成、导出逻辑。

**Acceptance Criteria：**

- AC4.1 平台提供统一 API / 服务契约：上传、解析、结构化生成、确认、导出。
- AC4.2 首期落地场景包含「洞察(听)」分布式素材上传，但不把 PRD 范围限定为单模块。
- AC4.3 业务模块可配置：是否同步生成训练案例、是否在模块内展示导图/知识点面板。
- AC4.4 同一素材在平台层只保留一份结构化结果，各模块引用而非各自复制一套数据。

### Non-Goals

- 不做实时「聊天式知识点推送」、消息流、定时推送、答题后智能推荐。
- 不做完整可视化导图编辑器（拖拽改结构、多人协作、版本管理）。
- 首期不支持 `epub` 及音视频素材解析。
- 不做知识库后端大重构；在现有上传、提取、资料抽屉能力上扩展。
- 不强制改造各业务模块的右侧答题/训练主流程。
- 不把「草稿未同步不自动带入训练」等既有业务规则在本 PRD 中擅自变更。
- 不做平台级全文搜索引擎或跨素材知识图谱（留 v2.0 演进）。

### 示例场景（验收锚点）

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 上传 1 份 3 页 `docx` 书稿节选 | 进入处理中，完成后出现导图 + 知识点 |
| 2 | 展开某节点 | 看到解释 + 至少 1 条举例 |
| 3 | 修改一条举例并点击「确认」 | 状态变为已确认，导出按钮可用 |
| 4 | 分别导出 Word / Markdown / PDF | 三种文件层级一致、内容含刚才修改 |
| 5 | 在「洞察(听)」模块上传同一素材 | 可同时看到训练案例提示 + 结构化知识视图 |

---

## 3. AI System Requirements

### Tool Requirements

**已有能力（复用，不重复造轮子）：**

| 能力 | 现有实现 | 平台化用途 |
|------|----------|------------|
| 素材上传 | `/api/material/upload`、`uploadMaterialToKB` | 统一素材入库入口 |
| 知识提取 | `extractListenKnowledgeDraft` → `/api/knowledge-vault/extract-draft` | 素材 → 结构化草稿 |
| 导图数据模型 | `InsightMindMapNode`（`insightMindMapBuilder`） | 平台标准树结构 |
| 静态骨架构建 | `theoryMindMapBuilder` | 书级/章节级骨架适配器参考 |
| 导图渲染 | `InsightMindMap` | 各模块 UI 复用 |
| Word 导出 | `insightWordExport`（`createInsightDocxBlob`） | 确认后 docx 导出 |
| Markdown / 图片导出 | `mindMapExport`（`mindMapToMarkdown`、`downloadSvg`、`downloadPng`） | md / 图片导出 |
| PDF 导出 | `mindMapExport` 中 SVG→PDF 或浏览器打印链路 | 导图 PDF 快照 |

**本轮需补齐的平台层能力：**

1. **统一结构化契约** — 定义平台级 `StructuredKnowledgePackage`：

```typescript
{
  materialId: string;
  title: string;
  status: 'processing' | 'draft' | 'confirmed' | 'failed';
  mindMapRoot: InsightMindMapNode;
  knowledgePoints: Array<{
    nodeId: string;
    title: string;
    explanation: string;
    example: string;
  }>;
  sourceMeta: { type: 'pdf'|'url'|'txt'|'docx'; fileName?: string; url?: string };
  confirmedAt?: string;
  confirmedBy?: string;
}
```

2. **素材解析适配器** — PDF/txt/docx 走既有上传 + 后端/Dify 文本提取；网页链接走 URL 抓取 + 提取；各格式失败时返回可诊断错误码。

3. **Draft → 导图树映射器** — 将 `extractListenKnowledgeDraft` 返回的 draft 映射为 `InsightMindMapNode`，与静态骨架共用同一 builder 接口。

4. **人工确认状态机** — `processing → draft（可编辑）→ confirmed（可导出）`；未 `confirmed` 禁止正式导出。

5. **多格式导出编排器** — 以 `confirmed` 状态的 package 为单一数据源，分别调用 Word / Markdown / 图片·PDF 导出。

6. **AI 提取质量兜底** — 若 Dify 返回不足以构成「解释 + 举例」，提供最小结构（标题 + 摘要 + 待补全占位）并引导资料管理中心手动录入。

### Evaluation Strategy

| 维度 | 方法 | 通过标准 |
|------|------|----------|
| 契约/单测 | draft → `InsightMindMapNode`；confirmed 包 → 三种导出 blob | 树层级正确、Heading/MD 层级一致 |
| AI 输出质量 | 对成功提取样本抽检 | 叶节点 `explanation` 非空率 ≥ 80%；`example` 非空率 ≥ 60%（MVP） |
| 失败路径 | 模拟解析失败、提取超时 | 可见错误提示 + 手动录入指引，无静默丢失 |
| 端到端验收 | `LS-MAT-01` 及平台级等价用例 | 上传 → 展示 → 编辑确认 → 三格式导出全链路通过 |
| 平台复用 | 「洞察(听)」接入 + 契约文档 | 第二模块可按同一 API 接入，无需复制解析逻辑 |

**非目标（AI 层）：**

- 不做实时聊天式推送或个性化推荐模型
- MVP 不做跨素材知识图谱推理
- 不做全自动「零人工」直接发布

---

## 4. Technical Specifications

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     业务接入层（Module Adapters）                  │
│  洞察(听) / 未来模块 …  ──► 统一 SDK / Hook / API 客户端            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│              平台层：Distributed Material Knowledge Service       │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐ │
│  │ Upload   │→ │ Parse/Extract│→ │ Structure  │→ │ Confirm   │ │
│  │ Adapter  │  │ (Dify/Vault) │  │ Builder    │  │ State     │ │
│  └──────────┘  └──────────────┘  └────────────┘  └─────┬─────┘ │
│                                                          │       │
│                    StructuredKnowledgePackage            │       │
└──────────────────────────────────────────────────────────┼───────┘
                                                           │
         ┌─────────────────────────────────────────────────┼───────┐
         │  Export Orchestrator                            ▼       │
         │  ├─ Word (.docx)  ← insightWordExport                      │
         │  ├─ Markdown (.md) ← mindMapToMarkdown + KP append         │
         │  └─ Image/PDF     ← InsightMindMap SVG → PNG/PDF          │
         └───────────────────────────────────────────────────────────┘
```

**数据流（单次上传）：**

1. 用户上传 `PDF / url / txt / docx` → Upload Adapter
2. 可选并行：`uploadMaterialToKB`（知识库）+ `extractListenKnowledgeDraft`（结构化草稿）
3. Structure Builder 将 draft + 可选静态骨架 → `StructuredKnowledgePackage`（status=`draft`）
4. 用户在 UI 编辑节点/知识点 → 本地或 Vault 暂存
5. 用户点击「确认」→ status=`confirmed`
6. Export Orchestrator 按选定格式生成并下载

### Integration Points

| 集成点 | 说明 | 现有路径 |
|--------|------|----------|
| 上传 | 文件/URL 统一入口 | `/api/material/upload`、`/api/knowledge-vault/extract-draft` |
| 提取 | Dify 知识草稿 | `extractListenKnowledgeDraft` |
| 资料抽屉 | 草稿写入、手动补全 | `knowledge-vault-updated` 事件 |
| 导图 UI | 可折叠树图 | `InsightMindMap.tsx` |
| 导出 | 三格式 | `insightWordExport.ts`、`mindMapExport.ts` |
| 首期落地 UI | 左侧理论区 + 分布式素材 Tab | `ListenModule.tsx` |

**平台 API 契约（建议，MVP 可先内聚于现有路由）：**

| 方法 | 路径（建议） | 用途 |
|------|--------------|------|
| POST | `/api/material-knowledge/upload` | 上传并触发结构化 |
| GET | `/api/material-knowledge/:id` | 获取 package（含 status） |
| PATCH | `/api/material-knowledge/:id` | 编辑 draft 内容 |
| POST | `/api/material-knowledge/:id/confirm` | 确认，置为可导出 |
| POST | `/api/material-knowledge/:id/export` | 参数 `format=docx\|md\|pdf\|png` |

### Security & Privacy

- 用户上传文件/URL 仅走既有 HTTPS 与后端代理通道；前端不暴露 Dify API Key
- 导出在浏览器本地生成或经后端一次性流式返回，不落盘明文日志
- 导出文件不含 API Key、内部 taskId、userId 明文（可选水印除外）
- `confirmed` 前内容视为草稿，权限与上传者绑定；跨用户不可见
- txt/docx 解析需限制单文件大小（建议 ≤ 20MB，与现有 upload 策略对齐）

### 已确认决策汇总

| 项 | 决策 |
|----|------|
| 能力层级 | 平台级，「洞察(听)」为首期落地场景 |
| 知识点「推送」 | 仅生成并展示，非消息/推荐流 |
| 输入类型 | PDF + 网页链接 + txt + docx |
| 导出格式 | Word + Markdown + 图片/PDF |
| 确认环节 | 导出前必须人工确认/编辑 |
| 训练案例 | 保留并行链路，不回归破坏 |
| 内容来源 | 静态骨架（可选）+ 素材提取结果合并 |

---

## 5. Risks & Roadmap

### Phased Rollout

| 阶段 | 目标 | 交付内容 | 验收锚点 |
|------|------|----------|----------|
| **MVP** | 平台能力首版 + 「洞察(听)」落地 | 统一 `StructuredKnowledgePackage` 契约；PDF/url/txt/docx 上传解析；导图 + 知识点 + 解释/举例展示；draft → confirmed 状态机；Word / Markdown / 图片·PDF 三格式导出；失败可见提示 | `LS-MAT-01` 等价全链路；平台契约单测 |
| **v1.1** | 体验与稳定性 | 资料抽屉「确认同步」后自动刷新左侧树；举例字段结构化分栏；大树默认折叠 + 展开深度限制；批量导出；独立 SDK / Hook 文档 | 第二业务模块试点接入 |
| **v2.0** | 平台化深化 | epub / 音视频转写接入；导图与答题高亮联动；跨素材检索；可选完整导图编辑器；自定义导出模板 | 跨模块复用率、导出满意度 |

### Technical Risks

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| AI 提取结构不稳定 | 导图层级混乱、举例缺失 | 统一 draft→tree adapter + 最小兜底结构；失败走手动录入；质量门槛 80% explanation 非空 |
| docx/txt 解析差异大 | 部分格式提取失败率高 | 分格式适配器 + 明确错误码；超大文件限流；失败提示换 PDF |
| 三格式导出内容不一致 | 用户信任下降 | 单一 `confirmed` 数据源；导出编排器单测对齐层级 |
| 导图节点过多卡顿 | 左侧/UI 性能差 | 默认折叠；限制首屏展开深度；v1.1 虚拟化 |
| 平台/API 与 Listen 模块耦合 | 难以第二模块复用 | MVP 抽离 `material-knowledge` 服务层；契约文档先行 |
| 人工确认环节被绕过 | 不可信内容外泄 | 导出 API 校验 `status=confirmed`；UI 未确认时禁用导出 |
| 与训练案例链路冲突 | 回归破坏现有流程 | 并行触发、独立状态；不改右侧答题主流程 |

### Product Risks

| 风险 | 缓解 |
|------|------|
| 「知识点推送」被误解为消息流 | PRD 与 UI 文案统一为「结构化知识点展示」 |
| 用户期望完整编辑器 | MVP 明确仅简单编辑；完整编辑器标 v2.0 |
| 导出 PDF 与 Word 层级期望不一致 | 验收用例明确三格式层级对照表 |

---

## 6. 验收用例摘要

### 平台级 E2E（等价 LS-MAT-01）

| 项 | 内容 |
|----|------|
| **菜单路径** | 洞察(听) → 分布式素材上传（首期）；其他模块按接入文档 |
| **测试数据** | 3 页以内 PDF 或 docx 书稿节选，或 1 个网页案例链接 |
| **步骤** | 上传 → 等待结构化完成 → 查看导图/知识点 → 编辑并确认 → 分别导出 Word/Markdown/PDF |
| **预期** | 1) 训练案例提示仍可用 2) 出现导图+知识点+解释/举例 3) 三格式可导出且含编辑内容 4) 失败时有手动录入指引 |

### 功能测试案例表

| ID | 菜单路径 | 测试数据 | 预期结果 | 对应需求 |
|----|----------|----------|----------|----------|
| PK-MAT-01 | 分布式素材上传 | PDF 3页 | 导图+知识点+举例，可确认导出 | Story 1/2/3 |
| PK-MAT-02 | 同上 | docx 节选 | 同上 | 输入类型 docx |
| PK-MAT-03 | 同上 | txt 短文 | 同上 | 输入类型 txt |
| PK-MAT-04 | 同上 | 网页链接 | 同上 | 输入类型 url |
| PK-EXP-01 | 确认后导出 | 已确认 package | docx 层级可编辑 | AC3.4 |
| PK-EXP-02 | 确认后导出 | 已确认 package | md 层级一致 | AC3.4 |
| PK-EXP-03 | 确认后导出 | 已确认 package | png/pdf 导图快照 | AC3.4 |
| PK-CFM-01 | 未确认 | draft 状态 | 导出按钮禁用 | AC3.1 |
| PK-FAIL-01 | 上传损坏文件 | 无效 pdf | 可见错误+录入指引 | AC1.5 |

---

## 7. 主要改动文件（预期）

| 层级 | 文件/模块 |
|------|-----------|
| 平台契约 | 新建 `StructuredKnowledgePackage` 类型与服务层 |
| 树构建 | `theoryMindMapBuilder.ts` / `knowledgeAdapter.ts` |
| 导出 | 扩展 `insightWordExport.ts`、`mindMapExport.ts` |
| API | `/api/material-knowledge/*`（或扩展现有 vault 路由） |
| 首期 UI | `ListenModule.tsx` |
| 测试 | 契约单测 + `LS-MAT-01` 手工/E2E |

---

## 附录：与旧版 PRD 的关系

- 旧版 `.omx/plans/prd-listen-theory-mindmap-export.md` 聚焦「洞察(听)左侧理论库 + LS-KNOW-01/LS-MAT-01」，导出仅 Word、合集 M1 语义。
- 本 PRD 在其基础上 **升级为平台级能力**，扩展输入（+txt/docx）、导出（+Markdown+图片/PDF）、确认环节，并明确 Non-Goals 与 API 契约。
- 实施时可先满足本 PRD 的 MVP，再按需回溯补齐 LS-KNOW-01 静态骨架展示（若尚未完成）。
