# Deep Interview Transcript: GT-SIM-02 沙盘研判给策

- **UTC timestamp:** 20260817T144600Z
- **Profile:** standard（threshold 0.20，max 12）
- **Type:** brownfield
- **Final ambiguity:** 0.10
- **Context snapshot:** `.omx/context/gt-sim-02-strategy-tone-20260817T143400Z.md`
- **Spec:** `.omx/specs/deep-interview-gt-sim-02-strategy-tone.md`
- **PRD:** `.omx/plans/prd-gt-sim-02-strategy-tone.md`

## Round 1 | Target: Intent | Ambiguity 100%

**Q:** 本次 PRD 以哪条为成功定义？仓里语气表已挂上，但兜底泛化；CASE-02 四节密度已套同一 analyze。

**A:** `[from-user]` **three-surfaces-quality（D）**：沙盘 + 会话 + 案例历史三处都要：不机械 + 策略示例 + 语气表，且都必须贴用户原话。

## Round 2 | Target: Outcome | Ambiguity 50% | Pressure / Contrarian

**Q:** 案例研判提交的是四维分析、没有对白。什么算必须贴的原话？

**A:** `[from-user]` **case-reuse-case02（C）**：案例历史不新增策略区块，只沿用 CASE-02 四节 + 已有语气表；「贴当句」只强制沙盘应对和会话用户发言。

## Round 3 | Target: Outcome | Ambiguity 40%

**Q:** 人机沙盘对局历史里，什么才算「博弈策略示例」？

**A:** `[from-user]` **new-strategy-list（B）**：历史里新增独立「博弈策略示例」列表（对齐会话 `strategy_guidance`），与四节并列；语气表仍独立。

## Round 4 | Target: Scope | Ambiguity 37% | Simplifier

**Q:** 新增列表后，四节里的「可执行策略 / 话术示例」怎么办？

**A:** `[from-user]` **sandbox-hide-actionable（B）**：仅沙盘历史隐藏这两节，改由新列表 + 语气表承担给策；利益链 / 情绪动机仍显示。

## Round 5 | Target: Constraints | Ambiguity 28%

**Q:** 给策合格、被隐藏两节仍是套话时，能否入库？

**A:** `[from-user]` **sim-new-gate（A）**：沙盘改走新硬卡（列表贴当句 + 语气表贴当句 + 利益/情绪仍要密度）；被隐藏两节不再作为入史条件。

## Round 6 | Target: Non-goals | Ambiguity 19%

**Q:** 本轮明确不做哪些？

**A:** `[from-user]` **all-eight-out（A）**：不改 Dify YML；不改 CASE-02 案例口径；不改四维字段；不做 SIM-01；不改驭人术/升维；不做二次打分；不把泛化兜底当沙盘合格；案例历史不新增策略列。

## Round 7 | Target: Decision Boundaries | Ambiguity 16%

**Q:** 沙盘硬卡失败、会话没贴当句时怎么处理？OMX 可决定什么？

**A:** `[from-user]` **reject-both-fixture-lock（A）**：两边都拒收。沙盘任务失败、不入库、可重试；会话不展示完成态、可重新生成。贴当句规则 / 列表条数 / 失败文案由 OMX 自定，验收锁夹具。

## Pressure-pass

- Round 2 用「案例无对白」复访 Round 1「三处都贴原话」，收成：贴当句只强制沙盘+会话。
- Round 4 用「两块策略重复」复访 Round 3 新列表，收成：仅沙盘历史隐藏可执行策略/话术示例。

## Closure

加权 0.10 ≤ 0.20；Non-goals 与 Decision Boundaries 已明示。剩余贴当句启发式/文案/条数授权 OMX，夹具不可破。停止提问，结晶规格与 PRD。
