# Deep Interview Spec: RD-LEN-01 穿透(读) AI 推送素材够详尽

## Metadata

| 项 | 值 |
|---|---|
| Profile | standard |
| Rounds | 10 |
| Final ambiguity | 0.097 |
| Threshold | 0.20 |
| Context type | brownfield |
| Context snapshot | `.omx/context/rd-len-01-read-push-depth-20260817T120100Z.md` |
| Transcript | `.omx/interviews/rd-len-01-read-push-depth-20260817T121800Z.md` |
| Prompt-safe summary | not_needed |
| Residual risk | 低；启发式词表可能漏判/误判，用黄金夹具锁验收，不引入二次 LLM 评审 |

## Clarity breakdown

| Dimension | Score |
|-----------|-------|
| Intent | 0.92 |
| Outcome | 0.90 |
| Scope | 0.90 |
| Constraints | 0.90 |
| Success | 0.88 |
| Context | 0.90 |

## Intent

用户自贴网站/文档能支撑认知穿透训练，但「每日 AI 素材推送」常是教官摘要腔，即使凑够 1500 字也没有条款、利益方和可引用细节，训练变浅。要解决的是**信息密度**，不是单纯加长。

## Desired Outcome

点击「每日 AI 素材推送」后，输入框得到一篇**可当原文训练**的仿真材料：像政策函/财报段落/邮件/书摘那样可读，含具体条款或数据、至少两个利益方，且不出现可核对的假文号/法规名；字数去空白 ≥1500。未达标时系统自动再生成 1–2 次；仍失败则把失败稿放入框内标黄，允许手动再推。不达标时第一次点解码需确认。

## In-Scope

- 仅「穿透(读) → 每日 AI 素材推送」链路
- Prompt 升级（同一套规则，四 Tab 仅场景标题/类型名不同）
- 双硬卡：`READ_PUSH_MIN_CHARS=1500` **且** 密度启发式清单
- 前端自动重试 1–2 次（每次新开 Dify 会话，不带 `conversation_id`）
- 黄条展示失败原因（字数 / 密度分项）
- 不达标首次解码确认弹层

## Out-of-Scope / Non-goals

1. 不修粘贴/网页抓取/上传（RD-MAT-01）
2. 不修穿透解码刷不出（RD-DEC-01）
3. 不做结构化分区卡片 UI（维持原文输入框）
4. 不把真实网页抓取当作每日推送来源
5. 不改穿透解码报告（四宫格/导师评价）
6. 不新建独立 Dify 应用；沿用 `/api/english/oral/chat`
7. 不写分类兜底长文
8. 不按 Tab 拆四套文种模板

## Decision Boundaries（实现侧可自定、不必再问）

- 自动重试次数在 **1–2** 内取 2（共最多 3 次生成）
- `readPushQuality` 启发式词表、正则、分项阈值的具体实现
- 确认弹层用 `window.confirm` 还是现有 modal 风格（须文案含「素材未达详尽标准」）
- 黄条分项文案措辞
- 用户手动改写输入框后是否即时重算质量（建议：是）

## Constraints

- 禁止伪造可核对的真实机关文号/法规名；占位如「某省监管函〔训练〕」
- 允许全虚构利益博弈，界面不强制「非真实发文」总标（文号占位已承担）
- 沿用现有 chat 代理；Dify 官方 Send Chat Message：省略 `conversation_id` 即新会话
- blocking 模式长文有超时风险，本轮不改为 streaming（除非现网已经超时，另案）

## Testable acceptance criteria

1. 1600 字空话套话 → `below_standard`（密度失败），即使 ≥1500
2. 1200 字合格密度稿 → `below_standard`（字数失败）
3. ≥1500 且密度四项通过 → `ok`
4. 含 `国发〔2024〕xx号` 且无「训练」→ 密度失败
5. 含「某省监管函〔训练〕」+ 条款 + 两利益方 + ≥1500 → `ok`
6. 推送未达标时第一次点解码出现确认；确认后解码；同一次失败稿再点不再弹
7. 新一次推送重置确认状态
8. 连续点 2 次推送，E2E RD-LEN-01：不是两三句摘要

## Assumptions exposed + resolutions

| 假设 | 裁定 |
|------|------|
| 1500 字门禁等于详尽 | **否**；双硬卡 |
| 仿真文种=可写假文号 | **否**；禁止可核对文号/法规名 |
| 四 Tab 要四套模板 | **否**；同一套清单 |
| 失败要兜底长文 | **否**；失败稿入框 |
| 密度要二次 LLM | **否**；前端启发式 |

## Pressure-pass findings

Round 3 把「仿真」从真假政策风险里切开：要的是体裁与博弈密度，不是可检索的假公文身份。

## Brownfield evidence vs inference

- `[from-code][auto-confirmed]` 门禁与黄条已存在，无重试、无密度项、解码不确认
- `[from-code][auto-confirmed]` `generateReadMaterial` 已要求 1500 字与多方立场，但仍走一次 `proxyOralChatMessage`
- `[from-user]` 冻结「结构非硬卡」被本访谈覆盖

## Docs/Terminology Ledger

见访谈记录。可选后续（opt-in）：把冻结总表 RD-LEN-01 行更新为双硬卡——**不自动改 docs**。

## Technical context findings

- 触点：`ReadModule.tsx`、`difyAPI.ts#generateReadMaterial`、`readPushQuality.ts` + test
- 不碰 `vocab-server` oral/chat 契约，除非重试超时另案
- 对标：`gtCaseQuality` 角色启发式；听模块重试+兜底（本轮只要重试、不要兜底）
