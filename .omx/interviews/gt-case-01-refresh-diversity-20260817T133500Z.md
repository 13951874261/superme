# Deep Interview Transcript: GT-CASE-01 刷新后案例多样性

- **UTC timestamp:** 20260817T133500Z
- **Profile:** standard（threshold 0.20，max 12）
- **Type:** brownfield
- **Final ambiguity:** 0.103
- **Context snapshot:** `.omx/context/gt-case-01-refresh-diversity-20260817T130200Z.md`
- **Spec:** `.omx/specs/deep-interview-gt-case-01-refresh-diversity.md`
- **PRD:** `.omx/plans/prd-gt-case-01-refresh-diversity.md`

## Round 1 | Target: Scope | Ambiguity 51%

**Q:** 这次谈话要攻哪一块？

**A:** `[from-user]` 只做 GT-CASE-01：刷新/换一条后案例要有新鲜度与多样性，不要总是那几个。

## Round 2 | Target: Outcome | Ambiguity 38%

**Q:** 「重新刷新清除后还是那几个」要修到哪一种才算完成？

**A:** `[from-user]` 两边都要：换一条要新，硬刷新后也不能回到固定那 5 条（对齐现有 GT-CASE-01 用例）。

## Round 3 | Target: Outcome | Ambiguity 31% | scenario

**Q:** 周一换了 3 条新标题，周二 Ctrl+Shift+R 再进，第一眼希望看到什么？

**A:** `[from-user]` 硬刷新后自动再推一条新案例填进主文案；列表形态可后定，只要主案例不是原来那 5 条之一。

## Round 4 | Target: Constraints | Ambiguity 23% | Contrarian

**Q:** 「主文案不是那 5 条预设」你更能接受哪种代价？

**A:** `[from-user]` 进页可先闪一下预设，后台立刻推新并替换主文案；用户不该长时间停在那 5 条。

## Round 5 | Target: Non-goals | Ambiguity 19% | Simplifier

**Q:** 本轮明确不做哪些？

**A:** `[from-user]` 不改 GT-CASE-02；不改案例列表 UI（不强制从库水合、不重做左侧卡片）；不改 Dify YML；换一条/进页替换不走任务中心；不扩大 FALLBACK 种子库。

**推断（非本轮新问）：** Round 1 已排除其他 Tab；未勾选「切 Tab 不再自动推」由 Round 6 拍板。

## Round 6 | Target: Decision Boundaries | Ambiguity 17% | scenario

**Q:** 自动替换主文案什么时候允许发生？

**A:** `[from-user]` 每次点开「高管斗争案例研判」都自动再推并替换主文案。

## Round 7 | Target: Decision Boundaries | Ambiguity 14%

**Q:** 有未提交草稿时自动替换要哪一种？

**A:** `[from-user]` 执行侧可自定；默认静默替换并清空四维，不必再问。

## Round 8 | Target: Success Criteria | Ambiguity 10% | closure

**Q:** 生成失败时怎样才算 GT-CASE-01 通过？

**A:** `[from-user]` 失败路径交给执行侧；成功路径必须换掉那 5 条预设。

## Pressure-pass

- 复访 Round 2「硬刷新也要新」→ Round 3 场景压测 → 收敛为「主文案自动再推，列表可后定」。
- Contrarian：挑战「每次进页都调 Dify」→ 接受先闪预设再后台替换。
- 脏数据与失败路径授权 OMX 默认可自行决定。
