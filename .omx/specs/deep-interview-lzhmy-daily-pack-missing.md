# Deep Interview Spec: lzhmy-daily-pack-missing

## Metadata
- Profile: standard（threshold ≤ 0.20）
- Rounds: 8
- Final ambiguity: ≈ 0.16
- Context type: brownfield
- Date: 2026-08-04
- Context snapshot: `.omx/context/lzhmy-daily-pack-missing-20260804T112059Z.md`
- Transcript: `.omx/interviews/lzhmy-daily-pack-missing-20260804T115509Z.md`

## Clarity breakdown
| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.90 | 读+生成双修 |
| Outcome | 0.90 | 唤醒/破绽/最小听读集 + Dify 入参对齐 |
| Scope | 0.90 | 最小听读白名单已钉 |
| Constraints | 0.80 | Non-goals + 失败策略已定 |
| Success | 0.75 | 可测清单明确 |
| Context | 0.90 | 生产库与签名问题已核实 |

## Intent
修复 `lzhmy`（及同路径用户）「暂无缓存 / 0 词」体验：既要让前端稳定读到完整今日包，又要让生成链路写出满足 Dify 稳定入参的完整资产（唤醒+破绽+最小长文/音频）。

## Desired Outcome
1. 登录进入英语页后，**不点刷新**即可看到：
   - 今日唤醒 **10** 词完整
   - 今日破绽 **6** 词完整
2. 最小听读集对 `lzhmy` **ready**：
   - `meeting / B1 / 1` 长文 + 音频
   - `news / B1 / 1` 长文 + 音频
3. 读写均使用与 Dify 工作流一致的稳定入参（theme / history_exclude / user_current_profile；时间字段不进缓存键）。

## In-Scope
- 前端读路径：词表加载/超时与 `input_signature` 对齐，避免空 history 误报 missing
- 后端生成/落库：唤醒+破绽在同一稳定签名下完整写入；与 cron/手动生成一致
- 最小听读预生成/补齐：`meeting/B1/1`、`news/B1/1`
- 本轮交付时对 `lzhmy` **运维补生成一次**，保证验收日数据齐全
- 必要提示文案微调（失败时引导手动）

## Out-of-Scope / Non-goals
- A. 不重开登录自动 catch-up（稳态仍靠 02:00 cron + 手动）
- B. 不做 64 组可缓存听写全量
- C. 不改 Dify 工作流定义本身
- D. 不做 UI 大改版
- E. 不做多账号体系重构（`lzhmy`/`lzhumy` 现有别名读逻辑可保留，不扩展）

## Decision Boundaries（代理可自行决定）
- A. 前端词表超时/签名对齐具体改法（如取消/放宽 500ms 竞速、统一大小写 history）
- B. 后端缓存键读写对齐实现细节（保持 D1：theme + history_exclude + profile）
- C. 运维补生成脚本/命令组织方式（复用现有 script vs 临时命令）
- D. 日志与失败文案微调  
- **必须请示：** 扩大听读白名单、重开 catch-up、改 Dify 工作流、UI 大改、偏离本 spec 的范围变更

## Constraints
- 稳态失败行为 = U1：缺包提示 + 手动生成，不自动调 Dify
- 本轮验收日必须通过运维补生成把白名单数据补齐
- 生产真库路径：`/var/www/super-agent/vocab.db`（勿用 `vocab-server/vocab.db` 旧库）
- AGENTS：中文沟通；实现阶段仍需用户确认后再改代码（本 deep-interview 不直接实现）

## Testable acceptance criteria
1. 以 `lzhmy` 打开英语页：唤醒区展示 10 词，破绽区展示 6 词，无需先点「刷新今日包/刷新词汇」。
2. `GET /api/daily-pack/today` 在前端实际使用的稳定入参下返回 `status=ready`，且 `wakeup.vocab.length=10`、`flawVocab.length=6`。
3. `meeting/B1/1` 与 `news/B1/1` 的长文+音频对 `lzhmy` 均为可用 ready（可通过 pregenerated API 或库表核查）。
4. 人为制造空 history 或错误签名时，行为符合 U1（提示手动），不偷偷自动 Dify。
5. 运维补生成命令/脚本可复现，且写入真库 `/var/www/super-agent/vocab.db`。

## Assumptions & resolutions
- 「长文及音频都完整」收敛为最小集，而非 64 组。
- 「满足 Dify 入参」= 沿用已实现的 D1 稳定字段进缓存键，不改工作流 YAML。
- Round8「A」解释为：**A–D 可自决**（相对「走 E 逐项请示」）。

## Pressure-pass findings
- 场景：cron/Dify 超时缺口  
- 决议：交付含一次运维补齐；之后失败走提示+手动

## Brownfield evidence vs inference
- **Evidence:** 真库今日两条 manual 签名分裂；空 history → missing；前端 500ms 竞速；cron done@02:10；Listen/Extract 超时日志
- **Inference:** 截图主因是读键 miss + 包不完整；今日无完整 cron 双字段包

## Docs / Terminology Ledger
- 规格：`docs/superpowers/specs/2026-08-03-dify-input-cache-key-align-design.md`
- 旧访谈：`.omx/specs/deep-interview-daily-pack-cron.md`
- 「暂无缓存」= API `missing` 或 UI 未拿到可用 wakeup/flaw
- 「刷新今日包」≠ 必定 regenerate（当前有仅 reload 的按钮路径）

## Technical context findings
- Touchpoints: `dailyPackAPI.ts`（`buildDailyPackQueryInput`）、`DailyWakeupModule.tsx`、`DailyErrorVocabularyModule.tsx`、`dailyPackService.js`、`dailyPackCron.js`、`dailyListenPreGenerateService.js`、运维补生成 scripts

## Optional durable-doc updates（opt-in）
- 可将本验收白名单与真库路径写入运维备注；**默认不自动改公开文档**

## Condensed transcript
见 `.omx/interviews/lzhmy-daily-pack-missing-20260804T115509Z.md`
