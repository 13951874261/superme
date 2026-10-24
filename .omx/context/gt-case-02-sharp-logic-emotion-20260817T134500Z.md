# Context Snapshot: GT-CASE-02 案例详实尖锐、研判有逻辑情感

- **UTC timestamp:** 20260817T134500Z
- **Slug:** gt-case-02-sharp-logic-emotion
- **Type:** brownfield
- **Prompt-safe initial-context summary status:** not_needed

## Task statement

为「驭心博弈 → 高管斗争案例研判」形成 PRD：案例要背景清晰、内容详实、斗争尖锐、可借鉴；AI 研判要有逻辑与情感，不再机械单薄。工作流：`$deep-interview` → `$prd`。不在本模式改产品代码。

## Desired outcome

执行就绪的访谈规格 + 正式 PRD，验收能对齐 `GT-CASE-02`（`test_cases_7.21_7.22_feedback.md`）与 7.22 博弈-1 原文。

## Stated solution（用户原话）

真实高管斗争案例需背景清晰、内容详实、斗争尖锐、可借鉴。当前过简、角色简单，AI 研判机械单薄，逻辑与情感性不足。

## Probable intent hypothesis

上一轮访谈已把 GT-CASE-01（刷新多样性）单独立项并排除 CASE-02。用户现在要把 7.22 博弈-1 的**内容质量**收成可执行 PRD。可能只是把已冻结的 400/四节口径写成 PRD；也可能认为字数门禁仍解决不了「尖锐/情感」。

## Known facts / evidence

- `[from-user]` 来源：`7.22日反馈.md` 博弈-1；验收用例 `GT-CASE-02`（状态仍为「待功能落地后再测」）。
- `[from-code][auto-confirmed]` 冻结表 `docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`：`background`≥400 + 多方/不完整信息/决策点；研判强制四节（利益链/情绪动机/可执行策略/话术示例）且≥600；不足降级标红。
- `[from-code][auto-confirmed]` 设计已批准：`docs/superpowers/specs/2026-08-16-gt-case-02-case-quality-design.md`；实现计划称 Task 1–6 已完成、单测绿、E2E 待手工。
- `[from-code][auto-confirmed]` 代码已有：`gtCaseQuality`（400 字 + ≥3 职衔线索）、`gameTheoryVerdictGuard`（缺节系统补全、过短仍 `below_standard`）、push prompt 要求 ≥400、analyze 指令要求四节≥600、UI 黄/红条 + 历史四分块。
- `[from-code][auto-confirmed]` 前端 `PRESET_CASES` 五条 `description` 仍约 100–150 字（例：「甩锅大区VP的会场狙击」一段话），远低于 400。成功推送路径才走长 `background`。
- `[from-code][auto-confirmed]` FALLBACK 两条 `corp_clash` 已扩写到 ≥400 且堆职衔词。
- `[from-code][auto-confirmed]` 上一轮 GT-CASE-01 访谈明确 **不改 CASE-02**；本任务与 CASE-01 PRD 正交。
- `[from-code]` 冻结表页眉仍写「尚未进入实现」，与本地已落地门禁不一致，需用户确认本 PRD 是「收口已做」还是「加严质量」。
- `[from-code]` 对照：`prd-rd-len-01-read-push-depth.md` 已从「只数字数」升级为「字数 + 密度硬卡」，因为 1500 字空话仍不合格。CASE-02 可能面临同一问题。

## Constraints

- 优先复用现有 push / analyze / 任务中心 / `gtCaseQuality`，不重复造轮子。
- AGENTS.md：未确认前不改产品代码；本模式只写访谈/PRD 产物。
- 设计非目标曾写：不做 GT-SIM-02 对比表；不改用户四维表单字段名；不强制改线上 Dify YML。

## Unknowns / open questions

- 成功是「结构+字数达标」还是「尖锐/可借鉴/逻辑情感」要另设密度硬卡？
- 本轮是否同时覆盖案例推送 **和** 研判输出？
- 短 `PRESET_CASES` 是否必须改写/退出成功路径？
- 不足时继续降级标红，还是拒收/重试（对标 RD-LEN 自动重试）？
- 是否改 Dify YML，还是只靠服务端 prompt 注入？

## Decision-boundary unknowns

- OMX 可否自行决定启发式词表、补全文案、标红样式？
- 质量未达标时是否允许系统垫字交差？
- 与 GT-SIM-02 语气修正、GT-CASE-01 自动推送的边界？

## Likely codebase touchpoints（访谈后执行，本轮不改）

- `src/components/modules/GameTheoryModule.tsx`
- `src/utils/gtCaseQuality.ts`
- `vocab-server/services/gameTheoryCasePushService.js`
- `vocab-server/services/gameTheoryVerdictGuard.js`
- `vocab-server/server.js`（analyze 研判指令）
- `src/services/difyAPI.ts`

## Relevant repo docs inspected

- `AGENTS.md`
- `7.22日反馈.md`
- `test_cases_7.21_7.22_feedback.md` GT-CASE-02
- `docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`
- `docs/superpowers/specs/2026-08-16-gt-case-02-case-quality-design.md`
- `docs/superpowers/plans/2026-08-16-gt-case-02-case-quality.md`
- `.omx/specs/deep-interview-gt-case-01-refresh-diversity.md`（排除 CASE-02）
- `.omx/plans/prd-rd-len-01-read-push-depth.md`（密度硬卡对照）

## Terminology / doc-code conflicts

| 用户用语 | 仓内对应 | 冲突 |
|----------|----------|------|
| 驭心博弈 / 高管斗争案例 | `gametheory` / Tab `cases` | 无 |
| 原文背景介绍 | 推送 `background` / 右侧 `caseText` | 「原文级」≠ 400 字门禁，语义未拍板 |
| 角色太简单 | 职衔正则 ≥3 处 | 词表命中 ≠ 多方张力叙事 |
| 研判机械单薄 | 四节 JSON + ≥600 字 | 分节/凑字 ≠ 逻辑与情感质量 |
| 冻结表「尚未实现」 | 本地门禁已落地 | 文档与代码不一致 |

## Breadth ledger（待压测）

- scope：案例 vs 研判 vs 两者
- constraints：Dify YML / PRESET 改写 / 重试策略
- outputs：PRD 验收硬卡形态
- verification：E2E GT-CASE-02
- brownfield：复用已有门禁还是加严
