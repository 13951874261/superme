# Context Snapshot: GT-SIM-02 沙盘研判给策（策略示例 + 语气修正）

- **UTC timestamp:** 20260817T143400Z
- **Slug:** gt-sim-02-strategy-tone
- **Type:** brownfield
- **Prompt-safe initial-context summary status:** not_needed

## Task statement

为「驭心博弈 → 人机对战沙盘」的研判给策形成 PRD：沙盘中 AI 研判不再机械单薄；须针对用户反应给出博弈策略示例，以及语言/语气表达上的修正。工作流：`$deep-interview` → `$prd`。不在本模式改产品代码。

## Desired outcome

执行就绪的访谈规格 + 正式 PRD，验收能对齐 `GT-SIM-02`（`test_cases_7.21_7.22_feedback.md`）与 7.22 博弈-3 原文中「研判 + 策略示例 + 语气修正」部分。

## Stated solution（用户原话）

驭心博弈：研判给策。问题：沙盘中 AI 研判机械单薄；应针对用户反应给出博弈策略示例，以及语言/语气表达上的修正。

## Probable intent hypothesis

上一轮 GT-CASE-02 已收口「高管斗争案例研判」的密度硬卡，并明确 **不做 GT-SIM-02 对比表、不改人机沙盘**。用户现在要把 7.22 博弈-3 里沙盘侧的「给策」单独立项。可能是：
1. 把已冻结的独立「原话｜问题｜建议说法」表收成质量 PRD（仓内表已有，但兜底泛化）；
2. 给沙盘研判补「针对用户原话」的策略示例硬卡（与 CASE-02 四节不同）；
3. 沙盘 + 会话 + 案例历史三处一起做质量。

## Known facts / evidence

- `[from-user]` 来源：`7.22日反馈.md` 博弈-3：「AI 的研判太机械、单薄、逻辑与情感性都不强，同时 AI 应当针对我的反应给出博弈的策略示例或者语言语气表达上的修正。」验收用例 `GT-SIM-02`（状态仍为「待功能落地后再测」）。
- `[from-code][auto-confirmed]` 冻结表 `docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`：**GT-SIM-02** = 经典人机沙盘 **+** 多人会话均需独立「语气修正」对比表（原话 \| 问题 \| 建议说法）；不得仅并入 `strategy_guidance`。
- `[from-code][auto-confirmed]` 设计已批准：`docs/superpowers/specs/2026-08-16-gt-sim-02-tone-corrections-design.md`；覆盖沙盘历史、会话复盘、**以及案例研判历史（选项 C）**；不改 CASE-02 四节门槛；不强制改 Dify YML。
- `[from-code][auto-confirmed]` 实现计划称 Task 1–5 已完成、单测绿、未 commit、E2E 待手工：`docs/superpowers/plans/2026-08-16-gt-sim-02-tone-corrections.md`。
- `[from-code][auto-confirmed]` 代码已有：`toneCorrections` normalize/兜底、`ToneCorrectionTable`、analyze 与 session review 均写入 `tone_corrections`；对局历史展开与会话 `ReviewView` 均渲染独立表。
- `[from-code][auto-confirmed]` 人机沙盘与案例研判走 **同一** `analyze` 接口；CASE-02 四节密度硬卡（字数 ∧ 输赢/情绪/次序/可出口话术）已对 simulation 生效：不达标则任务失败、不 INSERT 历史。
- `[from-code][auto-confirmed]` 沙盘提交会把用户应对包成 `【玩家应对策略】：\n${simAnswer}` 作为 `user_answer`。测试数据示例：`你没资格过问我的编制。`
- `[from-code][auto-confirmed]` 语气表兜底是 **泛化句**：problem=「表达过硬或分寸不足…」，suggested=「先确认对方关切，再说明边界与可协商空间的下一句」。即使 `original` 能填上用户原话，建议说法也不保证改写该句。
- `[from-code][auto-confirmed]` 会话复盘已有独立 `strategy_guidance[]`；沙盘历史没有同名列表，策略落在 CASE-02 的 `actionable_strategy` / `script_examples`。
- `[from-user]` GT-CASE-02 访谈非目标：不做 SIM-02 对比表、不改人机沙盘。与本任务正交；本 PRD 不得回改 CASE-02 已冻结口径，除非用户明确覆盖。

## Constraints

- 优先复用现有 analyze / 任务中心 / `toneCorrections` / `ToneCorrectionTable` / 会话 `strategy_guidance`，不重复造轮子。
- AGENTS.md：未确认前不改产品代码；本模式只写访谈/PRD 产物。
- 冻结非目标：不得仅并入 `strategy_guidance` 而无独立语气区块。

## Unknowns / open questions

- 本 PRD 的成功定义是「表已存在即可」，还是「必须引用并改写用户当句反应」？
- 策略示例是独立区块，还是复用 `actionable_strategy` / `script_examples` / `strategy_guidance`？
- 覆盖范围：仅人机沙盘，还是沙盘+会话，还是再含案例历史？
- 不合格时：泛化兜底仍算过，还是像 CASE-02 一样拒收入史？
- 是否改 Dify YML，还是只靠 prompt 注入 + 本地硬卡？

## Decision-boundary unknowns

- OMX 可否自行决定策略示例字段名、语气表行数下限、兜底是否允许？
- 与 GT-CASE-02 共享 analyze 时，沙盘额外硬卡失败是否沿用「不入库」？
- 设计选项 C（案例历史也挂表）是否仍在本 PRD 内？

## Likely codebase touchpoints（访谈后执行，本轮不改）

- `src/components/modules/GameTheoryModule.tsx`（沙盘提交、对局历史展开）
- `src/components/modules/GameTheory/GameTheorySessionPanel.tsx`（会话复盘）
- `src/components/modules/GameTheory/ToneCorrectionTable.tsx`
- `src/utils/toneCorrections.ts` / `vocab-server/services/toneCorrections.js`
- `vocab-server/server.js`（analyze 研判指令 + 质量拦截）
- `src/utils/gtCaseQuality.ts`（若沙盘要额外「针对用户原话」硬卡）

## Relevant repo docs inspected

- `AGENTS.md`
- `7.22日反馈.md` 博弈-3
- `test_cases_7.21_7.22_feedback.md` GT-SIM-02
- `docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`
- `docs/superpowers/specs/2026-08-16-gt-sim-02-tone-corrections-design.md`
- `docs/superpowers/plans/2026-08-16-gt-sim-02-tone-corrections.md`
- `.omx/specs/deep-interview-gt-case-02-sharp-logic-emotion.md`（排除 SIM-02 / 不改沙盘）
- `.omx/plans/prd-gt-case-02-sharp-logic-emotion.md`

## Terminology / doc-code conflicts

| 用户用语 | 仓内对应 | 冲突 |
|----------|----------|------|
| 驭心博弈 / 研判给策 | 无同名 Tab；验收 ID 为 **GT-SIM-02** | 用户标题 ≠ 菜单名；菜单是「人机对战沙盘」 |
| 沙盘中 AI 研判 | Tab `simulation` → 同一 analyze → 对局历史 | 与 CASE-02 共用 analyze；CASE-02 已对 simulation 套四节密度 |
| 博弈策略示例 | 会话=`strategy_guidance[]`；沙盘历史=`actionable_strategy`/`script_examples` | 沙盘没有独立「策略示例」区块 |
| 语言/语气表达修正 | `tone_corrections` 三列表 | 冻结规格要独立表；仓内表已有，但兜底泛化，测试用例仍「待测」 |
| 不得并入 strategy_guidance | 冻结非目标 | 设计选项 C 把表扩到案例历史；CASE-02 PRD 曾排除该表 |

## Breadth Ledger（待压力测试）

- 范围：仅沙盘 / +会话 / +案例历史
- 产出：策略示例形态 + 语气表质量
- 验收：引用用户原话 vs 有表即过
- 失败策略：泛化兜底 vs 拒收入史
- 与 CASE-02 共享 analyze 的边界
