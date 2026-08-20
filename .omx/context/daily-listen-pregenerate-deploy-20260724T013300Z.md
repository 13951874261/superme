# Context: daily-listen-pregenerate deploy + GitHub push

## Task
PuTTY 格式上线部署 + 发布到 GitHub（本轮 Daily Listen 预生成）

## Locked deploy decisions
- 上传前后端；**不上传** `vocab-server/vocab.db` 与本地 smoke 产物（`public/daily_listen_audio/*`, `public/daily_long_articles/*`）
- 远端启动时 `initDailyListenTables` 自动建表；脚本仅 `mkdir` 预生成目录
- 分支：`feature/english-engine-update`
- 服务器：`ubuntu@150.158.34.217`，路径 `/var/www/super-agent`

## Backend upload list
- `vocab-server/server.js`
- `vocab-server/services/dailyPackCron.js`
- `vocab-server/services/dailyListenPreGenerateService.js`

## Frontend
- `pnpm build` → `dist/` → `/var/www/super-agent/dist`

## Git include (code + docs)
- DESIGN.md, re.md, plan doc, src/*, vocab-server/*.js (not vocab.db), smoke scripts under vocab-server/scripts/

## Git exclude
- `vocab-server/vocab.db`, `vocab.db-shm`, `vocab.db-wal`
- `vocab-server/public/daily_listen_audio/**`, `vocab-server/public/daily_long_articles/**`
- `vocab-server/scripts/_tmp-task5-cleanup-verify.cjs`

## Script
- `scripts/deploy-daily-listen-pregenerate-putty.ps1`
