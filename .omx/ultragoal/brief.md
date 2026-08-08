# Ultragoal Brief — daily-cron-task-logs

## Source

- Spec: `.omx/specs/deep-interview-daily-cron-task-logs.md`
- PRD: `.omx/plans/prd-daily-cron-task-logs.md`
- Test: `.omx/plans/test-spec-daily-cron-task-logs.md`
- Consensus: `.omx/plans/ralplan-consensus-daily-cron-task-logs.md`

## Objective

在后台任务中心展示当前声明用户最近 7 天每日定时任务执行日志（四模块一张卡），支持入参/来源查看与双语义重跑；不改 02:00；零 diff `taskQueue`。

## Constraints

- Declared userId tenant filter (no G-ID)
- No secrets in DB/API/UI
- No auto-retry / export / admin cross-user
- Do not fix pack-continue skipping long articles (only expose via logs)

## Stories

G001–G007 map to PRD Implementation Steps 1–7.
*** End Patch
