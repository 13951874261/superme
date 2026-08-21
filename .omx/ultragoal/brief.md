# Ultragoal Brief — material-purify-manual-collect

## Source

- Spec: `.omx/specs/deep-interview-material-purify-manual-collect.md`
- Transcript: `.omx/interviews/material-purify-manual-collect-20260821T114000Z.md`
- Context: `.omx/context/material-purify-manual-collect-20260821T112200Z.md`

## Objective

材料（文件上传 / 网页提取 / 视频转写）提交后必须明确告知已进入后台任务中心。提纯仍自动跑，但不得写入生词本。提纯结果在「今日学习材料」的「上传材料」标签中展示正文 + 生词 + 短语 + 高频句型；与「今日长文」标签互不覆盖。用户逐条点「+ 收录」才入库，动作与长文一致（3 秒转后台、补齐矩阵、按钮状态），但不占今日额度。任务中心完成按钮改为「查看材料」。

## Constraints / Non-goals

- 不改 Dify 提纯工作流本身（提示词 / 接口）
- 不改 3 秒竞速阈值和任务队列 API 契约
- 不改任务中心整体布局，只改完成按钮文案与跳转
- 不回滚已经自动写入生词本的词
- 不做「一键全部收录」
- 不改听 / 说 / 博弈 / 资料抽屉的入库逻辑（博弈 `skipVocab` 保持）
- 本轮不刷新根 DESIGN.md

## Decision Boundaries（执行方可自定）

- 标签文案与「查看材料」跳转（切到材料标签并滚动）
- 复用 `notifyBackgroundHandoff`
- 复用 `VocabularyGrid`
- 材料与长文分本地缓存
- 空抽词：任务完成 + 材料标签提示未抽出
- 视频只改解析，把现有输出分成词/短语/句

**不可自行定稿：** 测试用例措辞，实现后须用户核对。

## Success shape

1. 三入口提交 → 就近/Toast + 任务中心脉冲，文案明确「已进入后台」
2. 提纯完成 → 生词本条数不因此增加；材料标签出现三类候选
3. 长文标签不被材料结果覆盖
4. 材料「+ 收录」可走 3 秒/矩阵；今日额度不变
5. 视频不再自动二次「导入并整理」；按钮为「查看材料」

## Stories

见 `.omx/ultragoal/goals.json`（G001–G004）。

G001 已按用户要求合并：材料标签一眼展示生词/短语/高频句型三块，同时停自动入库。
