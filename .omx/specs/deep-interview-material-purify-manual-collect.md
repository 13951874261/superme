# Deep Interview Spec: material-purify-manual-collect

## Metadata

| Field | Value |
|-------|--------|
| Profile | standard |
| Rounds | 8 |
| Final ambiguity | ~0.10（threshold 0.20） |
| Context type | brownfield |
| Context snapshot | `.omx/context/material-purify-manual-collect-20260821T112200Z.md` |
| Transcript | `.omx/interviews/material-purify-manual-collect-20260821T114000Z.md` |
| Interview ID | a7c3e91f-4b2d-4f18-9e6a-material-manual-collect |
| Related prior spec | `.omx/specs/deep-interview-bg-handoff-feedback.md`（handoff 展示；不含「取消自动入库」） |

## Clarity breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.93 | 与长文一致：先看候选再逐条「+ 收录」，避免批量自动入库 |
| Outcome | 0.93 | 标签页分开展示；三类词表；手动收录；提交时明确告知已进后台 |
| Scope | 0.90 | 文件 / 网页 / 视频同一套 |
| Constraints | 0.90 | 不改 Dify/SLA/任务中心 IA；材料不占今日额度 |
| Success | 0.70 | 验收路径可推导；用例措辞须用户核对（未授权自行定稿） |
| Context | 0.93 | 自动入库点与长文手动收录路径已定位 |

## Prompt-safe initial-context summary

用户要两件事：材料进入任务中心时必须明确告知；提纯结果不得自动写入生词本，改为与长文相同的「展示候选 → 手动 + 收录」。材料与长文在「今日学习材料」里用标签页分开，互不覆盖。视频转写后仍自动提纯，但不入库。

## Intent

当前材料/视频提纯会把候选词直接写入生词本（截图中一次新增 97 词），用户无法先审阅。目标是与长文同一产品逻辑：提纯只产出可读材料 + 生词/短语/句型候选，入库只能由用户逐条点击「+ 收录」。同时，材料提交后台后必须有与全站一致的「已进入任务中心」告知，避免「不知道去哪了」。

## Desired Outcome

1. 文件上传、网页提取、视频转写：提交后立刻明确告知「已进入后台任务中心」。
2. 后台仍自动提纯，但**不** `INSERT` 生词本。
3. 「今日学习材料」用标签页区分「今日长文」与「上传材料」，互不覆盖。
4. 材料标签展示正文 + 生词 + 短语 + 高频句型；后续操作用与长文相同的「+ 收录」（含 3 秒转后台、矩阵补齐、按钮状态）。
5. 材料路径的收录**不占用**今日额度。
6. 任务中心完成按钮由「导入并整理」改为「查看材料」（切到材料标签并滚动）。

## In-Scope

- `MaterialUploader` 提交时接入 `notifyBackgroundHandoff`（文件 / URL / 视频创建任务）。
- `videoTranscriber.js`：去掉自动写入生词本；提纯仍跑；解析现有工作流输出为词/短语/句（不改 Dify）。
- `server.js` `/api/material/process-and-extract`：提纯后不再排重写入 SQLite；任务结果仍返回 `article/words/phrases/sentences`。
- `TaskContext`：材料完成不再覆盖长文 localStorage；视频完成不再自动触发 `import-virtual-material` 二次提纯（因已自动提纯）。
- `IntelBriefing`：标签页「今日长文 / 上传材料」；材料侧复用 `VocabularyGrid` + `useVocabCollect`。
- `GlobalTaskCenter`：完成态主按钮文案改为「查看材料」，点击切到材料标签（不改整体布局）。
- 材料收录调用处跳过今日额度检查。

## Out-of-Scope / Non-goals

1. 不改 Dify 提纯工作流本身（提示词 / 接口）。
2. 不改 3 秒竞速阈值和任务队列 API 契约。
3. 不改任务中心整体布局，只改完成按钮文案与跳转。
4. 不回滚已经自动写入生词本的词（含截图中 97 个）。
5. 不做「一键全部收录」。
6. 不改听 / 说 / 博弈 / 资料抽屉的入库逻辑。
7. 本轮不刷新根 `DESIGN.md`。
8. 博弈手段库 `skipVocab` 路径保持现状。

## Decision Boundaries（可未经确认自行决定）

- 标签文案（如「今日长文 / 上传材料」）以及「查看材料」= 切到材料标签并滚动。
- 提交后台告知复用 `notifyBackgroundHandoff`（就近浮层 + 任务中心脉冲），不新造通道。
- 材料词表直接复用长文 `VocabularyGrid`（同一套「+ 收录」按钮状态）。
- 材料与长文用不同本地缓存，互不覆盖。
- 提纯结果为空：任务仍算完成，材料标签显示「未抽出词句」。
- 视频路径只改解析，把现有提纯输出分成词/短语/句，不改 Dify 工作流。

**不可自行定稿：** 测试用例措辞与菜单路径表，实现后必须交给用户核对。

## Constraints

- 优先复用现有方案：`notifyBackgroundHandoff`、`useVocabCollect`、`VocabularyGrid`。
- AIM：实现阶段仍须分步确认；本 spec 不直接改代码。
- 与旧 spec `bg-handoff-feedback` 并存：手动收录超时仍写入并补齐矩阵；**自动提纯不得写入**。
- 材料收录不计入 `quotaStatus` 的今日词/短语额度。

## Testable acceptance criteria（草案，须用户核对）

| 菜单路径 | 测试数据 | 预期结果 | 对应需求 |
|----------|----------|----------|----------|
| 英语 → 进度总控 → 一键整理材料 → 上传文档 → 提交 | 任意 ≤50MB 文本/PDF | 就近/Toast 明确「已进入后台任务中心」+ 顶栏脉冲；任务中心出现 `材料整理` | 明确告知已进后台 |
| 同上，待任务完成 | 能抽出词句的材料 | 「上传材料」标签出现正文 + 词/短语/句；生词本条数不因提纯增加 | 不自动入库 |
| 上传材料标签 → 点某词「+ 收录」 | 未收录词；今日额度已满 | 仍可收录并走 3 秒/矩阵；额度数字不变 | 动作一致、不占额度 |
| 英语 → 进度总控 → 视频转写 | 短视频 | 转写后自动提纯不入库；完成按钮为「查看材料」，进入材料标签；不再自动二次「导入并整理」 | 三入口同一套 |
| 先生成今日长文，再完成一次材料提纯 | 两份不同正文 | 长文标签内容保持；材料标签为新内容；互不覆盖 | 标签页分开 |
| 提纯未抽出词句 | 无有效英文词的材料 | 任务完成；材料标签提示未抽出词句；不写生词本 | 空结果 |

## Assumptions exposed + resolutions

| 假设 | 决议 |
|------|------|
| 「学习材料」= 覆盖长文的 IntelBriefing | 否。标签页分开，不覆盖 |
| 「与长文一致」= 连今日额度也一致 | 否。额度分开；收录动作/矩阵一致 |
| 视频完成后还要用户点「导入并整理」才提纯 | 否。自动提纯；按钮改为「查看材料」 |
| 停自动入库后候选无处展示 | 否。材料标签 + VocabularyGrid |

## Pressure-pass findings

1. 「在学习材料中显示」对上代码后发现会覆盖长文 → 改为标签页。
2. 「后续与长文一致」压测后拆出：要 3 秒转后台 + 矩阵；不要占今日额度。

## Brownfield evidence vs inference

**[from-code][auto-confirmed]**

- 材料提交未调用 `notifyBackgroundHandoff`（仅改上传器本地文案）。
- `videoTranscriber.js` 与 `process-and-extract` 提纯后都会写入 SQLite。
- 长文生成已是展示 + 手动 `useVocabCollect`，不自动入库。
- `TaskContext` 材料完成会写入长文同一套 localStorage；视频完成会派发 `import-virtual-material` 再跑一遍整理。
- 同一 Dify 工作流输出可被解析为 words/phrases/sentences；视频路径目前只吃扁平 `extracted_words`。

**[from-code] 推断已由用户确认**

- 「材料」含文件、网页、视频三入口。

## Docs / Terminology Ledger

| 术语 | 本 spec 含义 | 勿混淆 |
|------|----------------|--------|
| 今日长文 | IntelBriefing 标签之一，每日生成材料 | 不是上传提纯结果 |
| 上传材料 | 同一区块的另一标签，承载提纯正文与三类词表 | 不是 ArsenalPanel「学习材料库」 |
| 提纯 | Dify 抽词/短语/句，后台自动跑 | 不等于写入生词本 |
| 收录 | 用户点「+ 收录」→ `useVocabCollect` | 不是提纯完成 |
| 已进入后台 | `notifyBackgroundHandoff` | 不是上传器内部 log |

Inspected: `AGENTS.md`、`DESIGN.md` Frictionless Feedback、`.omx/specs/deep-interview-bg-handoff-feedback.md`。

Durable docs：不自动改 `DESIGN.md`（用户 opt-out）。

## Scenario / edge-case findings

- 额度已满时，材料仍须能收录（与长文不同）。
- 视频完成若仍自动 `import-virtual-material`，会二次提纯；新逻辑必须切断该链。
- 空抽词不得把任务标失败，也不得写入生词本。

## Optional durable documentation（opt-in）

日后若跑 `$design`，可把「材料提纯不入库 / 标签页与长文分列」补进 `DESIGN.md`。本轮不做。

## Technical context findings

主要触点：`MaterialUploader.tsx`、`IntelBriefing.tsx`、`VocabularyGrid.tsx`、`useVocabCollect.ts`、`backgroundHandoff.ts`、`TaskContext.tsx`、`GlobalTaskCenter.tsx`、`vocab-server/services/videoTranscriber.js`、`vocab-server/server.js`（process-and-extract 入库段）。
