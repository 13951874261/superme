# Interview Transcript: material-purify-manual-collect

- **UTC:** 20260821T114000Z
- **Interview ID:** a7c3e91f-4b2d-4f18-9e6a-material-manual-collect
- **Profile:** standard（threshold 0.20，max 12）
- **Context snapshot:** `.omx/context/material-purify-manual-collect-20260821T112200Z.md`
- **Spec:** `.omx/specs/deep-interview-material-purify-manual-collect.md`

## Initial idea

材料上传进入后台中心后需要明确告知已进入后台。提纯后的材料和长文后续保持一个逻辑，不要自动进入生词本，需要手动点击收录。

## Rounds

| Round | Target | Answer |
|-------|--------|--------|
| 1 | Intent | 一致性：要和长文一样，先看候选再逐条点「+ 收录」 |
| 2 | Outcome | 在学习材料中显示；可与长文分开展示 |
| 3 | Outcome / Terminologist | 仍用现有「今日学习材料」区，用标签页/切换与长文分开，互不覆盖 |
| 4 | Scope | 转写完成后自动提纯（不入库），结果进「材料」标签；任务中心改为「查看材料」 |
| 5 | Scope | 文件上传、网页提取、视频转写全部同一套 |
| 6 | Non-goals | 不改 Dify 工作流 / 3 秒 SLA / 任务中心整体布局 / 不回滚已入库词 / 不一键全收 / 不改听说博弈资料抽屉 / 不刷 DESIGN.md |
| 6+ | Outcome | 提纯后也有生词、短语和高频句型；后续操作与长文保持一致 |
| 7 | Success / Pressure | 展示和收录动作一致；材料收录不占今日额度；需要 3 秒转后台及补齐矩阵 |
| 8 | Decision Boundaries | 标签文案与跳转、handoff 复用、VocabularyGrid 复用、分缓存、空结果完成、视频只改解析 —— 均可自行决定。测试用例不在此列，实现后须用户核对 |

## Pressure pass

- 复访「学习材料」：仓库里「今日学习材料」= 长文区，且材料成功会覆盖长文。用户改为标签页互不覆盖。
- 复访「后续与长文一致」：不是额度也一致；材料不占今日额度，但必须走 3 秒转后台 + 矩阵补齐。

## Final scores

| Dimension | Score |
|-----------|-------|
| Intent | 0.93 |
| Outcome | 0.93 |
| Scope | 0.90 |
| Constraints | 0.90 |
| Success | 0.70 |
| Context | 0.93 |
| **Weighted ambiguity** | **~0.10**（threshold 0.20） |
