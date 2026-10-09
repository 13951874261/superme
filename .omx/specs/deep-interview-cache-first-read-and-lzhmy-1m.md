# Spec: cache-first read + lzhmy 1m dual-mp3

## Metadata

- Profile: standard
- Rounds: 6
- Final ambiguity: ~0.15 (threshold 0.20)
- Type: brownfield
- Context snapshot: `.omx/context/cache-first-read-and-lzhmy-1m-20260803T092500Z.md`
- Transcript: `.omx/interviews/cache-first-read-and-lzhmy-1m-20260803T095200Z.md`

## Clarity breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.90 | 秒开缓存；结束超时/空内容 |
| Outcome | 0.90 | 有缓存秒开；无缓存提示手动；2 个强制 mp3 |
| Scope | 0.85 | P1/P2 读路径 + 部署 + 服务器生成 |
| Constraints | 0.85 | N1/U1/S3/A2 |
| Success | 0.80 | 见验收标准 |
| Context | 0.85 | today 纯读；listen vs extract 双表 |

## Intent

用户要登录后立刻看到后台已生成内容，而不是被 catch-up/Dify 拖成 45s 超时；长文切换条件同样只读缓存。

## Desired Outcome

1. 唤醒/破绽/长文（含词/短语/句型）：有缓存毫秒级展示；无缓存提示并提供立即生成。
2. 提供上传服务器脚本（沿用/给出 deploy-smart）。
3. 部署后在服务器为 `lzhmy` 强制重生成 `meeting/A2/1` 与 `meeting/B1/1` 的文章+mp3（仅这 2 个音频）。

## In-Scope

- 关闭 login-ping 触发的 `scheduleUserDailyCatchup`（N1）
- `/api/daily-pack/today` 保持纯读；前端超时约 5s；无缓存 UI 提示+手动生成（U1）
- 长文查询：先 `daily_extracted_articles`，未命中回退 `daily_listen_articles` 并带出/解析词短语句型；未命中不自动 Dify
- Dashboard/相关页：切换条件只查缓存；无缓存提示手动生成
- 部署含既有 R3 选人改动（D1）
- 服务器脚本：强制重生成指定 2 组合（A2）

## Out-of-Scope / Non-goals

- 登录自动补跑（catch-up）任何形式保留（明确排除 N2/N3）
- 无缓存时自动开始生成（排除 U3）
- 本轮不生成 16 个 1 分钟全矩阵
- 不合并 lzhmy/lzhumy 为同一人（沿用既有别名查询即可）
- 不做 UI 视觉重设计

## Decision Boundaries（OMX 可自决）

- 读超时 5s
- extract 未命中回退 listen 表的字段映射细节
- 部署包含 R3
- 生成脚本写死 user/theme/两个组合
- 文案微调（「暂无缓存，请点击立即生成」类）

须再问用户的：改变 N1/U1/S3/A2 业务约定、增减 mp3 组合、改部署目标机。

## Constraints

- S3：先 `deploy-smart` 再服务器生成
- A2：两组合强制重生成文章+mp3
- 主题沿用「商务谈判：让步与施压」除非脚本参数另写

## Acceptance criteria

1. 登录不再调度 `scheduleUserDailyCatchup`。
2. 有 `daily_packs` ready 时，唤醒/破绽在约 5s 内展示内容（正常应远快于 5s）。
3. 无今日包时，页面提示且不自动调 Dify；点击立即生成后才生成。
4. 切换长文条件：命中 extract 或 listen 缓存则毫秒级出正文+词+短语+句型；未命中只提示手动生成。
5. 部署后服务器执行脚本：`lzhmy` 的 `meeting/A2/1` 与 `meeting/B1/1` 文章与 mp3 均为强制刷新后的 ready；不多生成其他 duration 的 mp3。
6. 给出可复制的部署命令（deploy-smart）与服务器生成命令。

## Assumptions & resolutions

- 「后台方式」= 现有 generateOneCombo / pack 服务链路
- 「其他条件」= genre × cefr × duration（+ theme）
- 双账号：读路径可继续别名查询，不合并写入

## Pressure-pass findings

N1 经下午首登无包场景 → U1（禁止自动生成，必须按钮）。

## Brownfield notes

- Evidence: today 已是纯读；超时在前端；listen 与 extract 表分离导致长文 miss。
- Inference: 超时与 catch-up 争用同一 Node 进程相关；关 catch-up + 短超时可缓解读超时。

## Docs/Terminology Ledger

- 缓存 = SQLite 预生成行 + 对应 mp3 文件
- 手动生成 = 用户点击后的 regenerate/backfill/extract 任务
- cron = 02:00 DailyPack + DailyListen

## Handoff

Ready for execution. Prefer `$ultragoal` or `$autopilot` / direct agent implementation after user confirms handoff.
