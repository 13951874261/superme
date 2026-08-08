# Test Spec：每日定时任务日志（修订版）

> PRD: `.omx/plans/prd-daily-cron-task-logs.md` (R3+)  
> Requirements: `.omx/specs/deep-interview-daily-cron-task-logs.md`  
> DELIBERATE: unit / integration / e2e / observability

## 1. Unit

| ID | Case | Expected |
|----|------|----------|
| U1 | sanitize payload with Bearer/app-key | stripped |
| U2 | aggregate execution_status | completed/partial_failed/failed/running |
| U3 | progress includes skipped as finished | converges on short-circuit |
| U4 | buildInputSource fields | friendly + technical |
| U5 | retention cutoff day-8 | deletable; leased running kept |
| U6 | assertRunOwner mismatch | deny → API 404 |
| U7 | failed_snapshot on all-success | reject |
| U8 | flaw snapshot has focus/salt | present; no key |
| U-snap | failed_snapshot path spies resolvers/random | call count = 0 |
| U-date | businessDate for cron log | Shanghai pack_date frozen |

## 2. Integration

| ID | Case | Expected |
|----|------|----------|
| I1 | list user A | only A, ≤7 days |
| I2 | A detail B runId | 404 |
| I3 | A rerun B | 404 |
| I4 | failed_snapshot | new run; snapshot inputs; parent link; old intact |
| I5 | all_current after theme change | new theme in inputs |
| I6 | double-click rerun | single new run |
| I7 | cleanup day-8 | deleted; running kept |
| I8 | startup：遗留 running（含未过期 lease） | 全部 → failed/interrupted |
| I9 | one combo Dify fail | partial_failed; sanitized error |
| I10 | async extract late fail | step not completed on HTTP accept |
| I10b | extract timeout | step failed timeout |
| I10c | taskId map miss | task_lost |
| I-skip | pack ready continue | 64 leaves skipped; listen still runs; progress 100% |
| I-stitch | pack+listen same tick | one run_id; four modules |
| I-stitch-users | Listen 前漂移 listCronTargetUsers | 仍一张卡；不 INSERT 第二 run |
| I-unique | 重复 (cron_tick_id, user_id) | UNIQUE 拒绝 |
| I-listen | no dual audio owner | single listen terminal writer |
| I-audit | SQLite write fail mid-run | audit_health=degraded; no false completed |
| I-auth | forged userId declared boundary | only sees forged tenant’s rows（document soft-auth） |
| I-reg | taskQueue TTL + /api/tasks snapshot | **zero behavioral change** |
| I-rerun-scope | all_current spy | 不调用 listCronTargetUsers / 全局 multi-user cron；仅当前 userId |

## 3. E2E / Manual

路径：顶栏「后台任务：查看队列」→「后台任务中心」。

Harness：优先现有 Playwright（若仓库可用）；否则 Node API 集成 + 书面 UI 验收。**禁止**依赖真实等 02:00——用 `POST` 内部 cron-run / 注入 service。

| ID | Scenario | Expected |
|----|----------|----------|
| E-A | 全成功 | 一张卡；四模块；completed |
| E-B | 长文一组合失败 | partial_failed；失败默认可见 |
| E-C | 重跑失败项 | 新卡；快照；旧保留 |
| E-D | 整次重跑 | 当前入参 |
| E-E | 安全 | Network/DB/UI 无 Key/Bearer |
| E-F | 保留+重启 | 7 天；interrupted |
| E-G | 回归材料/视频/博弈/听力 | 同改前；task TTL≈30min |
| E-H | 用户隔离 | A 不见 B |
| E-I | 入参双层 | 中文 + 技术详情 |
| E-J | 文案 | 后台任务 |
| E-K | reduced-motion | 跳过/duration=0 |
| E-GSAP | 打开/关闭抽屉后卸载相关动画作用域 | 无残留 tween |

## 4. Observability

| ID | Expected |
|----|----------|
| O1 | module start/finish/error events |
| O2 | console 仍存在；UI 不依赖 stdout |
| O3 | progress by finished units |
| O4 | duplicate ticks → two runs visible |
| O5 | short-circuit skip reason logged |
| O-date | log notes UTC quota_date vs Shanghai pack_date risk when divergent |

## 5. Security checklist

- [ ] DB/API/UI 无 key/Bearer  
- [ ] 敏感默认折叠  
- [ ] Owner 404 on detail/rerun  
- [ ] sanitize recursive on errors  
- [ ] Identity ADR 文档化（declared userId）

## 6. Exit criteria

U*、I*、E-A–K、O* 通过；Security 全勾；I-reg 证明 taskQueue 零 diff。

## 7. Changelog

- R1 initial  
- **R2** Architect：I10b/c, I-skip, I-stitch, I-listen, I-audit, I-auth, I-reg, U-snap, U-date, O-date, harness note  
- **R3** I8 全量 orphan；I-stitch-users；I-unique  
- **R4** Critic APPROVE：E-GSAP；I-rerun-scope
*** End Patch
