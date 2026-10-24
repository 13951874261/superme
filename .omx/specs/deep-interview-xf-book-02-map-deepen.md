# Deep Interview Spec: XF-FEED-02 上传书籍/视频 → 导图+知识点并加深交互

## Metadata

| 项 | 值 |
|---|---|
| Profile | standard |
| Rounds | 9 |
| Final ambiguity | 0.09 |
| Threshold | 0.20 |
| Context type | brownfield |
| Context snapshot | `.omx/context/xf-book-02-map-deepen-20260817T151100Z.md` |
| Transcript | `.omx/interviews/xf-book-02-map-deepen-20260817T153000Z.md` |
| PRD | `.omx/plans/prd-xf-book-02-map-deepen.md` |
| Prompt-safe summary | not_needed |
| Residual risk | 低；三模块变难启发式由 AIM 定，必须用黄金夹具锁死，禁止用「看起来更深」代替门禁 |

## Clarity breakdown

| Dimension | Score |
|-----------|-------|
| Intent | 0.94 |
| Outcome | 0.92 |
| Scope | 0.92 |
| Constraints | 0.85 |
| Success | 0.90 |
| Context | 0.92 |

## Prompt-Safe Initial-Context Summary

上传书（及抽屉视频）得到导图+知识点讲解，能注入听/说/博弈系统学习；随多次使用必须扩枝、加厚讲解、且三模块出题变难，不得长期停在简易摘要层。仓内 XF-FEED-01 已实现抽屉文件上传、导图草稿、traces≥3 后只改摘要并升难度。本规格在其上加严加深产物与三套出题硬卡，并开放抽屉视频 Tab（与书同一闭环，不抽驭人术手段）。

## Intent

现网加深链路失败模式是：**使用次数上去了，知识仍停在首次提取的浅层目录**。用户要的不是再把 `summary` 改长，而是同一份书籍/视频知识随使用真正变深，并且听/说/博弈的训练题也跟着变难。没有扩枝、加厚讲解、三模块出题变难，就不算做成。

## Desired Outcome

1. 资料抽屉可上传书籍（文件）与视频；成功后出现可回看导图 + 知识点讲解草稿。
2. 用户确认并勾选听/说/博弈后，训练注入这些知识（沿用确认闸门、上限 5）。
3. 同一知识点累计使用达阈（默认每 3 次）触发 `vault_refine`：**导图新增更细子枝（原枝保留）**，**每个相关知识点的解释含可执行步骤或反例**。
4. 加深完成后，听对白/长剧本、说场景、博弈案例生成必须变难，且过启发式硬卡；只加长 `knowledge_context` 不算过。
5. 加深失败保留旧导图与旧正文，可重试。

## In-Scope

1. 升级 `vault_refine`：不再只写摘要；必须更新 `extra_json.mindmap` 扩枝，并加厚对应 theory 笔记的讲解字段。
2. 资料抽屉 `MaterialUploader` compact：保留文件 Tab，**开放视频 Tab**，URL Tab 仍隐藏。
3. 视频走现有转写 + `material` 管线，产出与书相同：导图 + 知识点草稿 + 后续加深 + 三模块变难。
4. 洞察(听) 动态出题/长剧本生成：当注入知识 `difficulty >= 3`（或本轮 AIM 等价标记）时必须变难并过硬卡。
5. 破局(说) 场景生成：同上。
6. 驭心博弈案例推送：同上（在现有 `gtCaseQuality` 上叠加「已加深知识」变难项，不改 Dify YML）。
7. 黄金夹具：知识侧扩枝+步骤/反例；听/说/博弈各至少 1 套合格/不合格对。
8. 任务中心：`material` 与 `vault_refine` 进度可见。

## Out-of-Scope / Non-goals

- 不新建独立「书籍学习页」；加深发生在抽屉导图 + 三模块训练
- 不统一听/英语/驭人术其他上传口（含说模块已有 PDF 定制背景口）
- 不新建 Dify 应用，不改线上 Dify 发布（只改仓库 prompt/代理）
- 不改穿透(读) 课外书/解码
- 不做可拖拽导图可视化编辑器
- 草稿未确认不得自动注入训练
- 不改词汇本、登录画像、德州扑克
- 不把抽屉视频做成 GT-TAC（不抽手段进战术库）
- 本规格不授权直接改代码；需用户选择后续执行通道

## Decision Boundaries（AIM 可自决、不必再问）

- 加深阈值保持 traces 每满 **3** 次再加深一层；`pending` 不重复入队；`difficulty` 上限 5
- 扩枝层数、每枝新增子节点上限、讲解最低字数/步骤条数
- 三模块「变难」启发式词表、分项与拒收策略（对标 `gtCaseQuality` / `readPushQuality`）
- 视频复用 `VideoTranscribePanel` + 现有 material 任务，不新开转写服务
- 失败：`refineStatus=failed`，保留旧 mindmap/正文，抽屉「重试加深」
- 注入排序仍 `difficulty DESC` → `confirmedAt DESC`，最多 5 条；`difficulty >= 3` 标题标「（加深）」
- 夹具文件名、失败文案、compact 视频 Tab 文案
- 听/说/博弈各自挂钩哪条现有生成 API（必须是用户可点的出题/推送入口，不得只改点评）

## Constraints

- 棕地：必须复用 XF-FEED-01 的 `knowledge_vault` extra、traces、`vault_refine`、抽屉确认闸门
- Dify：不新建应用；`inputs` 必须是已声明变量；密钥留后端
- 知识不跨用户
- AGENTS.md：中文、确认后才改代码、一次一步、最小无关 diff
- 不分期：知识加深与三模块出题变难必须同一 PRD 验收

## Testable acceptance criteria

1. 浅层导图夹具（仅 3 个一级枝、一两句解释）经一次合格 refine 后：必须出现至少 1 个命名二级子枝，且至少 1 条讲解含步骤或反例；仅摘要变长 → **失败**。
2. refine 失败夹具：旧 mindmap 与旧 summary 不变，`refineStatus=failed`，可重试。
3. 听：注入加深知识后生成的对白/长剧本，浅层夹具 100% 拒收；合格夹具 100% 过硬卡。
4. 说：注入加深知识后生成的场景，同上。
5. 博弈：注入加深知识后案例推送，同上（可叠加现有 CASE-02 密度卡）。
6. 抽屉 compact 可见「视频」Tab，不可见「网页提取」；视频成功后出现导图+知识点草稿（不出现战术库新手段）。
7. 未确认草稿的训练注入 reminder 仍为空。
8. 菜单路径 E2E：资料抽屉 → 上传书/视频 → 任务完成 → 确认同步听/说/博弈 → 各模块训练使用 3 次 → `vault_refine` → 导图扩枝且三模块再生成明显更难。

## Assumptions exposed + resolutions

| 假设 | 裁定 |
|------|------|
| 只把 summary 改长 = 加深 | **否** |
| difficulty 升序 = 出题变难 | **否**；必须改三套生成 |
| 可以先做知识、出题另立项 | **否**；不分期 |
| 抽屉视频 = 驭人术抽手段 | **否**；与书同一闭环 |
| 要独立学习页才能「系统学习」 | **否**；抽屉导图 + 三模块训练 |
| 变难靠人工抽检 | **否**；双硬卡黄金夹具 |

## Pressure-pass findings

Round 2 把「不停留简易层」从知识侧扩到三模块出题。Round 4 确认不分期。Round 6–7 把视频收成抽屉 Tab + 书语义，排除 GT-TAC 与读模块。

## Brownfield evidence vs inference

- `[from-code][auto-confirmed]` `vaultRefine.js` 只要求 LLM 输出 `{"summary"}`，不改 mindmap
- `[from-code][auto-confirmed]` `loadInjectedKnowledge` 按 difficulty 排序，出题引擎不读难度编题
- `[from-code][auto-confirmed]` `MaterialUploader compact` 隐藏 URL 与视频 Tab
- `[from-code][auto-confirmed]` 知识点草稿最多 8 条；导图单独一条 theory 笔记
- `[from-user]` 必须扩枝+加厚+改三套出题；开放抽屉视频；双硬卡夹具

## Docs/Terminology Ledger

| 来源 | 用语 | 本规格含义 |
|------|------|------------|
| XF-FEED-01 | 精进 A+B | A 变难排序 + B 再提炼摘要；本规格 **加严 B 为扩枝+加厚，并加 C 三模块出题变难** |
| GT-TAC | 上传视频 | 驭人术转写+抽手段；**本轮不做** |
| 资料抽屉视频 | 用户 Round 7 | 转写→导图+知识点→同一加深闭环 |
| KnowledgeNode | 掌握度空列表 | **不是** 本需求对象 |
| 加深交互 | 用户原话 | 抽屉导图变深 + 三模块训练变难，不是新学习页 |

可选后续（opt-in，不自动改 docs）：冻结总表新增 **XF-FEED-02** 行。

## Technical context findings

- 触点：`vaultRefine.js`、`knowledgeTheoryNodes.js`、`KnowledgeVaultDrawer.tsx`、`MaterialUploader.tsx`、听长剧本/动态出题、说场景生成、`gameTheoryCasePushService.js` + `gtCaseQuality`
- 不碰：ReadModule、词汇本、登录、德州、Dify YML 线上发布、战术库写入
- 对标：XF-FEED-01 任务闭环；GT-CASE-02 / RD-LEN-01 启发式硬卡风格

## Full or condensed transcript

见 `.omx/interviews/xf-book-02-map-deepen-20260817T153000Z.md`。
