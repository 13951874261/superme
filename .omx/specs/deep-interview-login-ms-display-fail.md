# Deep-interview Spec: login-ms-display-fail

## Metadata

| Field | Value |
|-------|-------|
| Profile | standard |
| Rounds | 6 |
| Final ambiguity | ~0.13 |
| Threshold | 0.20 |
| Type | brownfield |
| Context snapshot | `.omx/context/login-ms-display-fail-20260803T130700Z.md` |
| Transcript | `.omx/interviews/login-ms-display-fail-20260803T211515Z.md` |

## Clarity Breakdown

| Dimension | Score |
|-----------|-------|
| Intent | 0.90 |
| Outcome | 0.90 |
| Scope | 0.90 |
| Constraints | 0.85 |
| Success | 0.85 |
| Context | 0.75 |

## Intent

弄清 lzhmy 登录后「非毫秒级出现」的真实失败面；本轮只要根因分析，不改代码。

## Desired Outcome

一份区分两条链的 RCA：
1. HTTP 超时链：`GET /api/daily-pack/today` 为何 >5s
2. Ready 缓存链：库中是否有 `lzhmy` 当日 `ready` 包；为何 UI「0 词 / 失败」

## In-Scope

- 前端 `getTodayDailyPack` 5s Abort 与双模块请求行为
- 后端 `/api/daily-pack/today` 读/写路径
- `daily_packs` ready 有无与 serialize 行为
- 生产只读证据（后续由用户提供）与浏览器 Network

## Out-of-Scope / Non-goals

- 长文 `vocab_json/phrases_json=[]` 深挖
- 02:00 cron 选人逻辑
- UI 改版
- 本轮任何代码修改

## Decision Boundaries

- **E**：分析结论、`upsertUserTheme` 可疑阻塞、双打 today 加重因素等，均需用户确认后才写入定稿
- 草稿可标「待实测 / 待确认」，不得伪装成已证实唯一根因

## Constraints

- 定稿证据必须含：生产 curl today 耗时、sqlite ready 行、浏览器 Network timing/status
- 不改代码、不部署

## Acceptance Criteria

1. 先输出「待实测」草稿（代码 + 历史日志）
2. 用户补充 B+C 证据
3. 用户逐条确认草稿结论后定稿
4. 定稿明确区分「超时」与「无 ready 缓存」两条链

## Pressure-pass

Round 4 复盘 Round 1「只要报告」→ 抬高证据门槛为生产实测 + Network。

## Docs/Terminology Ledger

- 「毫秒级出现」≠「5s 内不超时」；超时只说明 Abort，不等于无包
- 设计文档仍写登录 catch-up；代码 N1 已关闭（本报告不深挖 cron）
- `getDailyPackRow` 无 signature 时只返回 `status='ready'`

## Handoff

默认下一步：用户执行只读命令并贴 Network → 确认草稿 → 定稿。  
可选后续：`$ultragoal` / `$ralplan`（若确认后要修）。
