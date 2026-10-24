# Context Snapshot: material-purify-manual-collect

- **UTC:** 20260821T112200Z
- **Task statement:** 材料上传进入后台任务中心后必须明确告知已进入后台；提纯后的材料与长文后续保持同一逻辑：不自动写入生词本，需用户手动点击收录。
- **Desired outcome:** 用户能立刻感知「已进任务中心」；提纯结果只作为候选，收录动作与长文一致（逐条点「+ 收录」）。
- **Stated solution:** 后台交接要明确告知；材料提纯与长文后续逻辑对齐，取消自动入库。
- **Probable intent hypothesis:** 截图中视频转写一次性「新增 97 个词汇到生词本」，用户无法审阅；同时材料上传只改了上传器本地文案，缺少全站统一的「已进后台」反馈，造成「不知道去哪了」。
- **Prompt-safe initial-context summary status:** `not_needed`

## Known facts / evidence

### [from-code][auto-confirmed]
- 材料文件/网页提纯：`MaterialUploader.runExtractionForFiles` → `processMaterialsAndExtract` → 任务中心 `type: 'material'`。提交后只改上传器本地 `currentStep`/`logs`，**未**调用 `notifyBackgroundHandoff`。
- 视频转写：`handleVideoTaskCreated` 同样只写本地步骤文案，**未**走统一 handoff。
- 全站已有统一后台交接：`src/utils/backgroundHandoff.ts` 的 `notifyBackgroundHandoff`（就近浮层 + 可选 Toast + 任务中心脉冲）。说/听/博弈/长文生成/收录/导出/驭人术已接入；**材料上传是缺口**。
- 视频转写完成后默认自动提纯并 `INSERT` 生词本：`vocab-server/services/videoTranscriber.js` 日志「正在查重新增至生词本」「共新增 N 个词汇到生词本」（与用户截图一致）。`skipVocab=true` 仅博弈手段库路径使用。
- 材料整理流水线同样自动入库：`vocab-server/server.js` `/api/material/process-and-extract` 在提纯后「排重写入 SQLite 生词本」。
- 任务中心完成态仍显示「导入并整理」：`GlobalTaskCenter.handleImport` → 事件 `import-virtual-material` → 再次跑 `runExtractionForFiles`（可能二次提纯+二次入库）。
- 长文生成（进度总控 Dashboard）：提取词/短语/句型只展示；文案为「请逐条点「+ 收录」加入生词本」。入库走 `useVocabCollect`。生成超时 3 秒已用 `notifyBackgroundHandoff`。
- 既有相关访谈：`.omx/specs/deep-interview-bg-handoff-feedback.md`（Phase 3 曾把「提纯上传」列为后续复用展示逻辑，但未改「自动入库」产品规则）。

### [from-code]（推断，待确认）
- 用户口中「材料」可能同时指：文件上传、网页提取、视频转写、任务中心「导入并整理」。
- 停掉自动入库后，提纯出的候选词需要一个「手动收录」展示面；长文有 `VocabularyGrid`，材料目前没有对等 UI。
- Dashboard 注释仍写「自动翻译缓存也会把词句写入生词库」——与当前「仅缓存到界面、不落生词本」注释并存，需确认是否还有隐式写入。

### Docs / rules inspected
- `AGENTS.md` / `.claude/CLAUDE.md`：确认后才改代码；中文；分步确认
- `DESIGN.md`：Frictionless Feedback；Listen backfill 已规定「已提交后台…请稍后在任务中心查看」
- `.omx/specs/deep-interview-bg-handoff-feedback.md`：handoff 反馈规范；收录仍补齐矩阵；Phase 3 含提纯上传展示，不含取消自动入库
- `.omx/plans/prd-perf-sla-3s-10s.md`：全站 ≤3s 必须有可见反馈；重任务转任务中心

## Terminology / conflicts
- 「材料」：上传器文件 / URL / 视频转写 / 任务中心导入，代码里不是同一个 task type（`material` vs `video`）。
- 「提纯」：Dify 工作流抽词；与 Whisper 转写不是同一步。
- 「收录」：长文 = 用户点 `+ 收录` → `useVocabCollect`（含 3 秒转后台补齐矩阵）。材料当前 = 后端自动 INSERT，无点击。
- 「已进入后台」：用户要的是明确告知；代码里材料路径只有上传器内部文案，没有 Toast/就近/脉冲。
- 与旧 spec 冲突：旧访谈要「收录超时仍写入并补齐矩阵」；本需求要「提纯结果不得自动写入」。二者可并存：自动提纯不入库；用户手动收录后仍可走矩阵补齐。

## Constraints
- AIM：未经确认不改代码；deep-interview 阶段禁止实现
- 本机无 `omx` CLI → 用文件持久化 state + AskQuestion / 纯文本单轮提问
- 优先复用 `notifyBackgroundHandoff`，不另造提醒通道

## Unknowns / decision boundaries
- 停自动入库后，候选词展示在哪（Dashboard 词表 / 任务中心 / 材料页）？
- 「材料」范围是否含网页提取、视频转写、导入并整理？
- 「明确告知」是否必须套用已有 handoff（就近+Toast+脉冲），还是只要 Toast？
- 长文是否仍有隐式写入（翻译缓存）需要一并关掉？
- Non-goals：是否改提纯工作流本身、是否改任务中心 IA、是否动 3 秒 SLA
- 已自动入库的 97 词是否要回滚？

## Likely touchpoints
- `src/components/MaterialUploader.tsx`
- `src/components/GlobalTaskCenter.tsx`
- `src/utils/backgroundHandoff.ts`
- `vocab-server/services/videoTranscriber.js`
- `vocab-server/server.js`（process-and-extract 入库段）
- `src/components/modules/english/tabs/DashboardTab.tsx` / `VocabularyGrid.tsx` / `useVocabCollect.ts`
