# Context Snapshot: 跨模块 上传书籍→导图+知识点并加深交互

## Task Statement
对「上传书籍/视频（尤其书籍）总结思维导图与知识点讲解，供系统学习并加深交互；内容随多次使用逐步精进，不长期停留简易层」做 Standard deep-interview，访谈收敛后按 PRD skill 形成 `.omx/plans/prd-*.md`。本模式内不改产品代码。

## Desired Outcome
书籍（优先）及视频可沉淀为导图 + 知识点讲解；学习者能系统学习并加深交互；同一份内容随使用次数变深，而不是一直停在浅层摘要。

## Stated Solution (User Proposal)
跨模块能力：上传书籍 → 思维导图 + 知识点；并加深交互。视频也提了，但强调尤其书籍。

## Probable Intent Hypothesis
现网已有 XF-FEED-01 骨架（抽屉上传 → 导图/知识点草稿 → 同步听/说/博弈 → traces≥3 再提炼+升难度），用户仍感到「简易层」：可能是首次提取太浅、加深只改摘要不扩导图、缺少讲解/练习交互、或读/听/视频口未纳入同一学习闭环。

## Known Facts [from-code][auto-confirmed]
- 冻结规格 `docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`：**XF-FEED-01** = 资料抽屉主入口，上传书 → 导图+知识点入库 → 同步听/说/博弈；精进 = 推送变难 + 知识点再提炼，一期必须 A+B；其他上传口本轮不强制统一。
- 设计稿 `docs/superpowers/specs/2026-08-16-xf-feed-01-vault-feed-design.md`：阈值 N=3、difficulty 1–5、导图进 `extra_json.mindmap`、任务 `material` + `vault_refine`。文首写「尚未改产品代码」，但代码已落地。
- `KnowledgeVaultDrawer` 理论 Tab 已嵌 `MaterialUploader compact`（隐藏 URL/视频 Tab，仅文件上传）；卡片有 L{difficulty}、加深中/已加深/失败、重试加深。
- `vaultRefine.js`：`usage >= lastRefineUsage + 3` 入队；LLM 只把摘要加深一层，输出 `{"summary":"..."}`；成功升难度、写 revision、更新正文。
- `knowledgeTheoryNodes.js`：材料任务可导入最多 8 条知识点草稿 + 一条只读导图笔记。
- 听模块另有素材上传 → 左侧导图/知识点 + Word 导出（`prd-listen-theory-mindmap-export.md` / `prd-distributed-material-knowledge-export.md`）。
- 穿透(读) 课外书 Tab：本地仅 `.txt/.md` 读入输入框做解码，**不**走书籍→导图入库。
- 来源枚举已有 `upload_book` / `upload_video`；抽屉 compact 上传口当前不暴露视频 Tab。
- 统一知识中台规格已存在：抽屉确认闸门、注入上限 5、图谱、听/说/博弈任务化。

## Known Facts [from-research]
- 无本轮外部最佳实践依赖；沿用仓内 material 管线与 XF-FEED-01 契约即可作为事实基线。

## Constraints
- AGENTS.md：中文、确认后才改代码、成熟方案优先、最小 diff、单步确认。
- Dify 密钥不得进浏览器；前端只打本站后端。
- 知识不跨用户；草稿未确认不同步进训练（中台既有语义）。
- XF-FEED-01 默认假设：听/驭人术/英语提纯等其他上传口不强制与抽屉统一——若本轮要改，须用户显式覆盖。

## Unknowns / Open Questions
- 相对已落地的 XF-FEED-01，本轮真正要补的失败模式是什么（提取浅 / 加深浅 / 无讲解交互 / 口不统一 / 读模块缺书）？
- 「加深交互」是训练注入变难、导图可点开讲解、问答练习，还是别的？
- 视频是否必须进本轮主路径，还是仅书籍？
- 首次生成是否也要有「非简易层」硬卡，还是只靠多次使用加深？
- 非目标与 AIM 可自决边界未问。

## Decision Boundaries (Unresolved)
- 未确认哪些实现细节可由 AIM 自决（加深阈值、导图是否随 refine 扩枝、是否新建学习页等）。

## Likely Codebase Touchpoints
- `src/components/KnowledgeVault/KnowledgeVaultDrawer.tsx`
- `src/components/MaterialUploader.tsx`
- `vocab-server/services/vaultRefine.js`
- `vocab-server/services/knowledgeTheoryNodes.js`
- `vocab-server/services/knowledgeDraftExtract.js`
- `src/components/modules/{Listen,Read,Speak}Module.tsx`（若覆盖其他上传口）
- 既有 PRD：`prd-distributed-material-knowledge-export.md`、`prd-listen-theory-mindmap-export.md`、统一知识中台 spec

## Docs/Rules Inspected
- `AGENTS.md`、`DESIGN.md`（无本主题专章）
- `docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`
- `docs/superpowers/specs/2026-08-16-xf-feed-01-vault-feed-design.md`
- `.omx/specs/deep-interview-unified-knowledge-platform.md`
- `.omx/specs/deep-interview-rd-len-01-read-push-depth.md`（读模块推送密度，非本书籍导图）
- `.omx/plans/prd-distributed-material-knowledge-export.md`
- `.omx/plans/prd-listen-theory-mindmap-export.md`
- 无 `CONTEXT.md` / `CONTEXT-MAP.md`

## Terminology / Conflicts
- 用户「加深交互」≠ 现网 `vault_refine` 的「摘要再写一层」；可能还包含讲解、练习、导图扩枝。
- 用户「系统学习」可能指课程式导图讲解，也可能指注入听/说/博弈训练。
- 「跨模块」在冻结表里 = 资料抽屉 → 听/说/博弈；用户可能还想纳入穿透(读)。
- 设计稿声称未改代码，代码已有 XF-FEED-01 实现——以代码为准。
- `KnowledgeNode`（掌握度，后端空列表）≠ 资料抽屉知识点。

## Prompt-Safe Initial-Context Summary Status
`not_needed` — 初始用户输入短，本快照即为下游可用摘要。

### Prompt-Safe Summary
目标：上传书（及可能视频）得到导图+知识点讲解，能系统学，并随多次使用变深。仓内 XF-FEED-01 已实现抽屉文件上传、导图草稿、使用 3 次后摘要加深+升难度；抽屉 compact 无视频 Tab；读模块课外书不入库导图。待访：相对现状的真正缺口、加深交互含义、视频/读是否纳入、非目标与决策边界。
