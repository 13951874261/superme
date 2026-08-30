# Brief: 账号学习数据隔离（Option A′）

> Requirements source: `.omx/specs/deep-interview-account-data-isolation.md`  
> Plan: `.omx/plans/prd-account-data-isolation.md`  
> Test: `.omx/plans/test-spec-account-data-isolation.md`  
> Consensus: Architect R2 APPROVE → Critic APPROVE

## Intent

同机换号后，康奈尔/生词/长文/唤醒/破绽及模块学习界面只显示当前账号数据；换回可恢复复盘/夜话；不得把上一账号本地画像写脏到新账号服务端。

## In-Scope

1. localStorage 按账号分桶；禁止无前缀画像/复盘回退
2. `learning_ui_json` sidecar（独立 persist，不进 upsert，不 bump 画像 `updated_at`）
3. `switchAccountSession`：flush(旧)→改 ID→load→App `key={userId}` 重挂
4. 模块学习键分桶；embed 换号清空
5. `parseVocabUserId` 缺省 400；前端 400 ≠ 空表

## Out-of-Scope

- session token / 全站 API 中间件
- `getHistoryExclude` 全站扫词、`clear-today` 跨用户
- 历史脏数据回滚、视觉改版
- 界面偏好（背景/音效等）按账号拆

## Acceptance

对照 test-spec：U1–U13、I1–I8、E1–E7、O1–O3。
