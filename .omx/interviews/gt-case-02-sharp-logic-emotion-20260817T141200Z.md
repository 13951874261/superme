# Deep Interview Transcript: GT-CASE-02 案例详实尖锐、研判有逻辑情感

- **UTC timestamp:** 20260817T141200Z
- **Profile:** standard（threshold 0.20，max 12）
- **Type:** brownfield
- **Final ambiguity:** 0.11
- **Context snapshot:** `.omx/context/gt-case-02-sharp-logic-emotion-20260817T134500Z.md`
- **Spec:** `.omx/specs/deep-interview-gt-case-02-sharp-logic-emotion.md`
- **PRD:** `.omx/plans/prd-gt-case-02-sharp-logic-emotion.md`

## Round 1 | Target: Intent | Ambiguity 100%

**Q:** 这次 PRD 以哪条为成功定义？仓里已有 400/四节/600 门禁，但 7.22 原文要的是尖锐/可借鉴/逻辑情感。

**A:** `[from-user]` **raise-density**：字数只是下限，还要像 RD-LEN-01 一样加「尖锐/多方张力/情绪锚点」密度硬卡，凑字空话不算过。

## Round 2 | Target: Outcome | Ambiguity 47% | Pressure / Contrarian

**Q:** 用一条 ≥400 字、堆了董事长/CEO/VP 的套话空稿压测：怎样才算密度失败？

**A:** `[from-user]` **case-and-verdict-both**：
- 案例四信号缺一不可：≥3 具名角色张力、具体场合/时限、不完整信息、尖锐决策点（选边即伤）。
- 研判也必须硬卡：谁赢谁输、面子/恐惧等情绪锚点、可执行下一步、可出口话术。
- 两边都进本 PRD，凑字分节不算过。

## Round 3 | Target: Non-goals | Ambiguity 28%

**Q:** 本轮明确不做哪些？

**A:** `[from-user]` 当时只勾了 **no-dify-yml**（不改线上 Dify 工作流 YML）。

## Round 4 | Target: Scope / Non-goals | Ambiguity 32% | 场景压测

**Q:** 只排除 Dify YML 会把范围扩到 CASE-01 / SIM-02 表 / 四维字段名 / 其他 Tab / 二次打分。是漏勾还是有意扩大？

**A:** `[from-user]` **missed-click-all-out**：其余五项也不做。

## Round 5 | Target: Decision Boundaries | Ambiguity 22%

**Q:** Dify 吐出 ≥400 字套话时，系统怎样处理？

**A:** `[from-user]` **reject-until-ok**：不合格不进主文案、不写入对局历史，直到生成合格；可手动再推/再提交。

## Round 6 | Target: Decision Boundaries（收口） | Ambiguity 17%

**Q:** 拒绝进框时屏幕上留什么？周一刚进 Tab、连续两次套话、没有上一篇合格稿。

**A:** `[from-user]` **keep-last-or-loading**：
- 推送不合格：主文案保持上一篇合格稿；没有合格稿则只显示「推送中/未达尖锐标准，请再推」，**不展示 5 条短 PRESET**。
- 研判不合格：任务失败可重试，历史不写。

## Pressure-pass

- Round 2 用 400 字套话空稿复访 Round 1「加严」，收敛为案例+研判双边密度硬卡。
- Round 4 复访 Round 3 漏勾，收成完整非目标。
- Round 6 复访 Round 5「拒收」，收成占位 UX：上一篇合格稿 / loading 提示，永不短 PRESET。

## Closure

加权 0.11 ≤ 0.20；Non-goals 与 Decision Boundaries 已明示。剩余词表/文案/夹具措辞授权 OMX，不改变执行方向。停止提问，结晶规格与 PRD。
