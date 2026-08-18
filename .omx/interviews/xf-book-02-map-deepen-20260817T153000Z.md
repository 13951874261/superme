# Deep Interview Transcript: XF-FEED-02 书籍/视频导图加深

- **UTC timestamp:** 20260817T153000Z
- **Profile:** standard（threshold 0.20，max 12）
- **Type:** brownfield
- **Final ambiguity:** 0.09
- **Context snapshot:** `.omx/context/xf-book-02-map-deepen-20260817T151100Z.md`
- **Spec:** `.omx/specs/deep-interview-xf-book-02-map-deepen.md`
- **PRD:** `.omx/plans/prd-xf-book-02-map-deepen.md`

## Round 1 | Target: Intent | Ambiguity 100%

**Q:** 相对已落地的 XF-FEED-01（抽屉上传 → 导图/知识点 → 用满 3 次只改摘要），本次核心痛点？

**A:** `[from-user]` **refine-too-weak（B）**：用多次只改摘要，导图不扩枝、讲解不加厚，仍停简易层。

## Round 2 | Target: Outcome | Ambiguity 58% | Contrarian / 实例

**Q:** 《谈判力》首次只有利益 / BATNA / 情绪三枝，用满 3 次后怎样才算不再简易？

**A:** `[from-user]` **also-harder-inject（D）**：扩枝 AND 加厚讲解；听/说/博弈注入也必须变难（题目/情境更深）。

## Round 3 | Target: Scope | Ambiguity 47%

**Q:** 现网 difficulty 只影响注入排序。你说的「注入变难」要哪一种机制？

**A:** `[from-user]` **rewrite-three-engines（C）**：听对白、说场景、博弈案例各自变难才算过。

## Round 4 | Target: Scope | Ambiguity 43% | Simplifier

**Q:** 改三套出题引擎工作量约三个独立需求。本轮验收卡在哪？

**A:** `[from-user]` **all-three-now（A）**：不分期；知识扩枝+加厚与听/说/博弈出题都变难，缺一不算过。

## Round 5 | Target: Non-goals | Ambiguity 34% | multi

**Q:** 必须排除哪些？

**A:** `[from-user]` **no-new-learn-page**, **no-unify-other-uploads**, **no-new-dify-app**。

## Round 6 | Target: Non-goals 缺口 | Ambiguity 33% | 中点提醒

**Q:** 未勾选的 5 项（读/视频 Tab/编辑器/自动注入/词汇本登录德州）本轮真正要做哪些？

**A:** `[from-user]` **add-video-only（C）**：只额外纳入抽屉视频 Tab；其余 4 项仍排除。

## Round 7 | Target: 视频语义 | Ambiguity 28% | Terminologist

**Q:** 抽屉上传谈判录像要哪种语义（书闭环 vs 驭人术抽手段）？

**A:** `[from-user]` **same-as-book（A）**：转写 → 导图+知识点 → 加深 → 三模块出题变难；不抽驭人术手段。

## Round 8 | Target: Decision Boundaries | Ambiguity 24%

**Q:** 哪些实现细节 AIM 可自定？

**A:** `[from-user]` **aim-defaults（A）**：阈值仍每 3 次、扩枝/讲解下限、三模块变难启发式、视频复用现有转写、失败保留旧稿全部 AIM 自定；PRD 只锁验收故事。

## Round 9 | Target: Success（闭包） | Ambiguity 16% → 0.09

**Q:** 《谈判力》用满 3 次后，怎样算验收通过？

**A:** `[from-user]` **dual-auto（A）**：知识侧（扩枝+讲解含步骤/反例）+ 听/说/博弈变难启发式，全部用黄金夹具锁，缺一失败。

## Pressure-pass

- Round 2 用《谈判力》三枝实例复访 Round 1「不只改摘要」，升级为扩枝+加厚+注入变难。
- Round 4 Simplifier 压三引擎分期，用户拒绝分期。
- Round 6 复访 Round 5 未勾选非目标，收成「只加抽屉视频 Tab」。
- Round 7 对齐「视频」≠ GT-TAC 抽手段。

## Closure

加权 0.09 ≤ 0.20；Non-goals 与 Decision Boundaries 已明示；压力轮完成；成功标准已锁双硬卡夹具。停止提问，结晶规格与 PRD。
