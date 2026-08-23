# Deep Interview Spec: unify-listen-dashboard-enums

## Metadata

| Field | Value |
| --- | --- |
| Profile | standard |
| Rounds | 10 |
| Final ambiguity | ~0.13（threshold 0.20） |
| Context type | brownfield |
| Context snapshot | `.omx/context/unify-listen-dashboard-enums-20260823T021700Z.md` |
| Transcript | `.omx/interviews/unify-listen-dashboard-enums-20260823T024500Z.md` |
| Interview ID | unify-listen-dashboard-enums-20260823 |
| Prompt-safe initial-context summary | not_needed |

## Clarity breakdown

| Dimension | Score | Notes |
| --- | --- | --- |
| Intent | 0.92 | 消除总控/精听/夜里体裁对不上 |
| Outcome | 0.88 | 8 个体裁三处同一份；保留研报并扩展 |
| Scope | 0.88 | 只动总控、精听、夜里预热名单与默认并发 |
| Constraints | 0.85 | 不改 Dify 提示词；并发默认 4 / 上限 4 |
| Success | 0.75 | 验收路径可从用户选择推导 |
| Context | 0.90 | 三套名单与启动窗口已对照代码 |

## Intent

总控能选「行业研报」，精听和凌晨预热却没有这个键，页面查缓存落空。要统一枚举，让同一组合在总控、精听、夜里对得上。

## Desired Outcome

用现网 `lzhmy`、次日早上举例：

1. 总控与精听下拉都是同一 8 项（含深度播客、行业研报）。
2. 夜里按这 8 项 × 4 难度 × 4 时长预热（128 组/用户，不再是 64）。
3. 总控选「行业研报 + B1 + 35分钟」，若昨夜该组合已生成，不再出现「名单外所以没有」的空态。
4. 精听也能选「行业研报 + B1 + 35分钟」，查同一套键。
5. 长文默认并发从 3 改为 4，上限仍 4。

## 标准名单（唯一）

| 键 | 中文（沿用现有） |
| --- | --- |
| meeting | 高管会议 |
| news | 财经新闻 |
| podcast | 深度播客 |
| reading | 沉浸阅读 |
| email | 商务邮件 |
| report | 行业研报 |
| negotiation | 谈判拉扯 |
| presentation | 路演汇报 |

难度、时长不改：`A2/B1/B2/C1`，`1/15/25/35`。默认选中仍是 `meeting`。

## In-Scope

- 总控 `ArsenalPanel` 下拉补上 `podcast`，与上表一致。
- 精听 `ListenTab` 下拉扩到同一 8 项。
- 抽取一份前后端共用的体裁常量（文件位置可自定）。
- `LONG_GENRES` / 精听 `GENRES` / 相关脚本与合同测试改为这 8 项。
- 长文 Cron 默认并发改为 4（`DAILY_LONG_ARTICLE_CONCURRENCY` 未设置时）；上限保持 4。
- 精听与长文打 Dify 都**原样传**这 8 个 `genre` 键；不改 Dify 工作流和提示词。
- 空状态文案可小改（例如不再暗示「系统每天都会有这篇」）。

## Out-of-Scope / Non-goals

1. 不改写作 / 多角色 / 即兴演讲。
2. 不改 Dify 工作流提示词、节点、应用配置。
3. 不迁移、不清理旧缓存行。
4. 不改难度、时长枚举。
5. 不做主题统一（见 `docs/superpowers/specs/2026-08-23-unified-theme-design.md`）。
6. 不改凌晨选人逻辑。
7. 不拉长 `02:00–02:15` 启动窗口。
8. 不把并发上限抬过 4。

## Decision Boundaries（可未经确认自行决定）

- 共享常量放哪个文件、怎么命名。
- 中文标签沿用上表。
- 默认选中 `meeting`。
- 空状态文案小改。
- 测试放在现有 contract / 页面测试里，不新造框架。
- `mapGenreToDify`：本刀精听/长文路径不再用它折键；若别处仍调用，保持原函数以免误伤，但不在新路径上用它改写入键。

**必须再问：** 并发超过 4；改 Dify 提示词让研报更像研报；把写作/角色/演讲也纳入同一名单。

## Constraints

- 确认前不改业务代码（本 spec 本身只写文档）。
- 夜里组合数：8 × 4 × 4 = 128 / 用户（原 64）。启动后可通宵跑；用 4 路加快，不保证早上某时刻前全部 ready。
- 查缓存仍按 `genre` 字符串精确匹配；`report` 不能拿 `reading` 顶替。
- 优先复用现有下拉、Cron、查询接口，不新造预热管道。

## Testable acceptance criteria

1. 总控下拉选项键集合 = 精听下拉选项键集合 = 夜里预热体裁集合 = 上表 8 个。
2. 总控可见「深度播客」；精听可见「行业研报」「商务邮件」「谈判拉扯」「路演汇报」「沉浸阅读」。
3. 夜里对每个用户生成（或跳过已有）`report|B1|35` 等 128 键之一；总控用同一条件 `GET` 精确查询能命中（该步已完成时）。
4. 未设置环境变量时，长文预热并发为 4。
5. 精听生成请求的 `genre` 为 `report` 时，打 Dify 的 inputs.genre 也是 `report`，不是 `reading`。
6. 写作 / 多角色 / 演讲页面体裁若原本没有这 8 项，保持不动。
7. 旧库里已有行不删不改键。

## Assumptions + resolutions

| 假设 | 结论 |
| --- | --- |
| 「要对上」= 必须留研报 | 是，不收缩名单 |
| 15 分钟必须跑完 | 否，那是启动窗口 |
| 112/128 篇必须先加并发 | 要加快，但只提到 4 |
| 不改 Dify 提示词则研报文体可能一般 | 接受；先对上键 |

## Pressure-pass findings

Round 2：提出「收成精听 3 项也能对上、更省额度」。用户拒绝，要求保留总控选项并扩展精听/夜里。

Round 7：指出启动窗口误解。用户仍要求加快，Round 8 定为默认 4。

Round 10：Round 9 同时勾了「折 4 类」和「原样传 8 键」。拍板为两边都原样传。

## Brownfield evidence vs inference

- 证据：三套名单、启动窗口、并发 3/4、长文原样传 `genre`、精听 `mapGenreToDify`。
- 推断：8 体裁会使夜里更慢；不改提示词时研报文本质量不确定。

## Docs / Terminology Ledger

- 已读：`AGENTS.md`、主题设计 spec（无关体裁）、精听预热 plan、daily-auto-gen-verify spec。
- 「总控」= Dashboard 学习材料库；「精听」= ListenTab；「枚举」本刀只改体裁。
- 「窗口」= 启动窗口，不是跑完时限。

## Optional durable-doc follow-ups（opt-in，未授权不写）

- 可在 `DESIGN.md` Listen 段补一句：体裁名单以共享 8 项为准。
- 不要把访谈原文写进对外文档。

## Technical context

- 前端：`ArsenalPanel.tsx`、`ListenTab.tsx`、`DashboardTab.tsx`、`difyAPI.ts`
- 后端：`dailyCronRunService.js`、`dailyListenPreGenerateService.js`、`dailyPackCron.js`、`server.js` 相关查询

## Handoff residual risk

无 early-exit。残留：128 组/用户仍可能早上未全部 ready；不改 Dify 时研报/邮件文体可能偏泛。
