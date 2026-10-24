# PRD：洞察(听) 左侧知识点体系化（导图 + 要点 + 举例 + 可折叠 Word 导出）

> **验收锚点：** `LS-KNOW-01`、`LS-MAT-01`（`test_cases_7.21_7.22_feedback.md`）  
> **模块路径：** 顶栏 → 洞察(听) → 左侧「理论框架库」/「分布式素材上传」  
> **状态：** 已确认  
> **日期：** 2026-08-17

---

## 1. Executive Summary

**Problem Statement：** 左侧「理论框架库」以零散手风琴条文呈现，缺少书级目录与导图；分布式素材上传后虽能写资料抽屉草稿/生成训练题，但用户看不到针对该素材的「导图 + 知识点 + 解释/举例」，也无法从左侧体系一键导出可编辑 Word。

**Proposed Solution：** 以静态书级骨架为底座，复用 `InsightMindMap` 做可折叠树图；要点层展示「概念 + 解释/举例」。素材提取结果挂到该骨架（或独立素材分支），并统一导出 Word（复用/扩展 `insightWordExport`）。导出采用 **M1**：一份 Word 合集 = 静态骨架 + 当前已挂载的素材分支。

**Success Criteria：**

1. `LS-KNOW-01` 全过：左侧为「导图 + 知识点 + 解释/举例」，可折叠，可导出 Word。
2. `LS-MAT-01` 全过：上传 PDF/链接后出现该素材的导图 + 知识点 + 举例，可导出 Word；失败时提示可到资料管理中心手动录入（不静默丢失）。
3. 默认折叠后左侧不以长文铺满；用户可一键展开对照答题。
4. 导出 `.docx` 用 Word/WPS 打开后仍保留「章节 → 知识点 → 解释/举例」层级且可编辑。
5. 右侧答题表单、精听 Voice/压力、知识库大重构、实时聊天式推送均不在本轮范围且不被回归破坏。

---

## 2. User Experience & Functionality

### User Personas

- **主用户：** 用「洞察(听)」做博弈侧写训练的学习者，答题时需要左侧对照理论，事后要带走可编辑笔记。
- **次用户：** 上传书本章节/案例 PDF 或网页链接，希望立刻得到结构化知识点而非只生成一道题。

### User Stories

#### Story 1（LS-KNOW-01）

As a 训练者, I want 左侧理论知识像一本书的思维导图 + 要点 + 举例且可折叠, so that 我对照答题时不干扰视线、需要时再展开。

**Acceptance Criteria：**

- AC1.1 左侧「理论框架库」展示**书级导图**（复用 `InsightMindMap` 交互：节点可折叠/展开），而非仅零散单句列表。
- AC1.2 每个叶节点（或二级节点）可展开看到：**知识点标题 + 简单解释 + 至少 1 条例句/场景举例**。
- AC1.3 支持「全部折叠 / 全部展开」；首次进入默认以折叠为主（仅保留导图骨架或一级分类可见）。
- AC1.4 提供「导出 Word」；无内容时按钮禁用并有简短说明。
- AC1.5 静态骨架至少覆盖现有 `THEORY_DATA` 两大类（逻辑学与系统谬误、人性解码与心理侧写），信息量不低于现状。

#### Story 2（LS-MAT-01）

As a 训练者, I want 上传分布式素材后看到该素材的导图与知识点并可导出, so that 我能把书/案例沉淀成可编辑笔记。

**Acceptance Criteria：**

- AC2.1 上传 PDF 或网页链接并提交后：仍可提示训练案例已生成（兼容现流程）。
- AC2.2 **同时**在左侧出现针对该素材的：思维导图 + 知识点 + 简单解释/举例（可挂在「素材衍生」分支，和/或合并进书级骨架）。
- AC2.3 该素材视图支持折叠；支持导出 Word（**M1：与静态骨架合并为一份合集导出**）。
- AC2.4 提取失败：明确提示可到「资料管理中心」手动录入；**不得**静默丢失（可保留训练题生成成功 + 草稿失败分流提示，与现状一致并强化可见性）。
- AC2.5 内容来源为 **2B**：静态骨架始终存在；素材/资料抽屉确认内容可**追加节点**到体系（不要求本轮做完整图谱编辑器）。

#### Story 3（导出）

As a 训练者, I want 导出 Word, so that 我能在本地继续编辑复习。

**Acceptance Criteria：**

- AC3.1 MVP **仅 Word（.docx）**；不强制 Markdown/SVG/PNG（右侧答题后导图的既有导出可保留，但不计入本 PRD 新范围）。
- AC3.2 Word 内层级：`书/素材标题 → 章节 → 知识点 → 解释/举例`（可用 Heading 样式）。
- AC3.3 文件名可读，例如 `洞察理论框架-YYYYMMDD.docx` 或含素材标题。
- AC3.4 **M1 导出语义：** 单次「导出 Word」包含静态理论骨架 + 当前会话已挂载的全部素材分支（一份合集）。

### Non-Goals

- 不改右侧分步答题表单与提交点评主流程。
- 不改精听 Voice / 压力因素（见 `docs/superpowers/specs/2026-08-17-listen-voice-pressure-design.md`）。
- 不重做知识库后端架构；不新开独立模块入口。
- 不做实时「聊天式知识点推送」。
- MVP 不做 Markdown/SVG/PNG 导出（理论库侧）。
- 不做完整可视化导图编辑器（拖拽改结构、多人协作等）。
- 不把「资料抽屉同步进训练」的产品规则改成自动带入（保持「草稿未同步不自动带入训练」既有语义，除非另开需求）。

---

## 3. AI System Requirements

### Tool Requirements

**已有能力（复用）：**

- `extractListenKnowledgeDraft`（素材 → 资料抽屉「理论框架」草稿）
- `uploadMaterialToKB`
- `InsightMindMap`（`src/components/modules/insight/InsightMindMap.tsx`）
- `createInsightDocxBlob` / `downloadInsightDocx`（`src/utils/insightWordExport.ts`）

**本轮需补齐：**

- 将草稿/提取结果**映射**为 `InsightMindMapNode`（`name` / `detail` / `children`），供左侧导图与 Word 共用。
- 静态 `THEORY_DATA` **规范化**为同一 `InsightMindMapNode` 树，避免两套数据结构。
- 素材提取：优先复用现有 Dify 提取；若返回不足以构成「解释+举例」，定义最小兜底结构（标题 + 摘要作 detail + 空举例占位提示），并引导资料中心补全。

### Evaluation Strategy

- **契约/单测：** 树构建器（静态 + 素材 draft → `InsightMindMapNode`）；Word blob 含多级 Heading 与 detail 段落。
- **手工验收：** 严格按 `LS-KNOW-01`、`LS-MAT-01` 菜单路径与预期。
- **AI 输出质量门槛（MVP）：** 叶节点 `detail` 非空率 ≥ 80%（对成功提取的草稿）；失败走 AC2.4，不计入质量分母的「成功提取」集合。

---

## 4. Technical Specifications

### Architecture Overview

```
[静态 THEORY 骨架] ──┐
                     ├─► TheoryMindMapTree (InsightMindMapNode)
[素材 extractDraft] ─┘         │
                               ├─► InsightMindMap（左侧可折叠）
                               └─► downloadInsightDocx / 扩展 exporter → .docx（M1 合集）

上传 PDF/URL → uploadMaterialToKB? → extractListenKnowledgeDraft
                 → 成功：合并进 Tree + 提示 + 可切回理论库看到新分支
                 → 失败：可见提示 → 资料管理中心手动录入
```

### Integration Points

| 点 | 说明 |
|---|---|
| UI | `ListenModule` 左侧 `theory` / `upload` Tab |
| 导图 | `src/components/modules/insight/InsightMindMap.tsx` |
| 导出 | `src/utils/insightWordExport.ts`（扩展以支持「纯理论树、无导师点评」场景） |
| 提取 | `extractListenKnowledgeDraft`（`difyAPI`） |
| 资料抽屉 | 现有草稿写入 + `knowledge-vault-updated`；本轮只消费/展示，不大改 Vault |

### Security & Privacy

- 用户上传文件/URL 仅走既有上传与提取通道；导出仅在浏览器本地生成下载，不新增明文日志落盘。
- 不在导出文件中写入 API Key 或内部任务 ID。

### 已确认决策

| 项 | 决策 |
|---|---|
| 范围 | LS-KNOW-01 + LS-MAT-01 同一份 PRD |
| 内容来源 | 2B：静态骨架 + 资料库/上传书补节点 |
| 导图交互 | 3A：复用 `InsightMindMap` 树图可折叠 |
| 导出 MVP | 仅 Word（.docx） |
| 导出形态 | **M1**：静态骨架 + 已挂载素材分支，一份合集 |
| 成功标准 | LS-KNOW-01 + LS-MAT-01 两条用例都过 |

---

## 5. Risks & Roadmap

### Phased Rollout

| 阶段 | 内容 |
|---|---|
| **MVP** | 静态树 → InsightMindMap + 折叠 + Word（M1 合集）；素材提取结果挂树 + 失败提示；双用例验收 |
| **v1.1** | 资料抽屉「确认同步」后自动刷新左侧树；举例字段结构化（解释/举例分栏） |
| **v2.0** | 可选 Markdown/SVG；导图与答题高亮联动（点击知识点跳到相关表单项） |

### Technical Risks

| 风险 | 缓解 |
|---|---|
| 素材 AI 结构不稳定 | 统一 adapter + 兜底节点；失败提示资料中心 |
| 导图节点过多导致左侧卡顿 | 默认折叠；限制展开深度；大树虚拟化留 v1.1 |
| Word 过大/图片可选 | MVP 理论导出可不嵌 PNG；仅层级文本 |
| 与右侧「本场洞察导图」混淆 | 文案区分：「理论框架导图」vs「本场答题导图」 |

---

## 6. 验收用例摘要

### LS-KNOW-01

- **菜单路径：** 洞察(听) → 左侧栏「理论框架库」
- **测试数据：** 打开模块，查看左侧知识点；点击折叠/展开；导出 Word
- **预期：**
  1. 不是零散单句，而是「思维导图 + 具体知识点 + 简单解释/举例」
  2. 可折叠，需要对照时再展开
  3. 至少能导出 Word 且可编辑

### LS-MAT-01

- **菜单路径：** 洞察(听) → 分布式素材上传（PDF 电子书/案例库 或 网页案例链接）
- **测试数据：** 上传一份短 PDF 或 txt（书本章节节选，约 1–3 页），等待「训练题目已生成」
- **预期：**
  1. 提示可生成训练案例
  2. 针对该素材出现思维导图 + 知识点 + 解释/举例
  3. 可导出 Word；失败时提示可到「资料管理中心」手动录入，而不是静默丢失

---

## 7. 主要改动文件（预期）

- `src/components/modules/ListenModule.tsx`（左侧理论库 UI、折叠、导出入口）
- `src/components/modules/insight/InsightMindMap.tsx`（复用，必要时扩展折叠 API）
- `src/utils/insightMindMapBuilder.ts` 或新建 `theoryMindMapBuilder.ts`（静态 + 素材树构建）
- `src/utils/knowledgeAdapter.ts`（素材 draft → `InsightMindMapNode`）
- `src/utils/insightWordExport.ts`（支持纯理论树、M1 合集导出）
- 相关契约/单测
