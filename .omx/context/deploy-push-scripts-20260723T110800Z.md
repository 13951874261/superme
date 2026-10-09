# Context Snapshot: deploy-push-scripts

- **Timestamp:** 20260723T110800Z
- **Profile:** standard (threshold 0.20, max_rounds 12)
- **Type:** brownfield

## Task statement
用户要求 deep-interview 后「输出部署脚本」：部署服务器 + 推送 GitHub 的脚本。

## Desired outcome
待访谈澄清：交付形态（新脚本 / 命令块 / 复用现有）、是否拆分、覆盖范围。

## Stated solution (user draft)
输出两类脚本：服务器部署、GitHub 推送。

## Probable intent hypothesis
- 可能希望 P1-5 改动一键上线 + 代码入库
- 可能觉得现有 `deploy-smart.ps1` 太复杂或耦合 git，想要拆分
- 可能只要可复制命令块（先例：page-density-deploy-putty spec）

## Known facts / evidence
- [from-code][auto-confirmed] `deploy-smart.ps1` 已含：变更检测 → 前后端增量部署 → git add/commit/push
- [from-code][auto-confirmed] `deploy-manual.ps1` 仅部署，明确 no git commit/push
- [from-code][auto-confirmed] 服务器：`ubuntu@150.158.34.217`，路径 `/var/www/super-agent`，服务 `super-agent-vocab`
- [from-code][auto-confirmed] 生产域：`https://ai.234124123.xyz`（deployment-notes）
- [from-code][auto-confirmed] 既有 PuTTY 与 System SSH 双模式（`-UseSystemSSH`）
- [from-code] 先例 spec：`.omx/specs/deep-interview-page-density-deploy-putty.md` 交付「聊天命令块」而非新脚本

## Constraints
- AGENTS.md：确认前不擅自改代码；优先成熟方案
- deployment-notes：Nginx 反代、勿暴露 Dify key、验证 curl health

## Unknowns / open questions
- 要「新 .ps1 文件」还是「聊天可复制命令块」？
- 部署范围：仅本轮 P1-5（前后端）还是通用 smart deploy？
- GitHub：是否自动 commit message？是否 push 全部未提交变更？
- 是否与 deploy-smart 合并还是替代？

## Decision-boundary unknowns
- 是否允许写死 SSH 密码 vs 环境变量
- 是否 force push / git add -A

## Likely codebase touchpoints
- `deploy-smart.ps1`, `deploy-manual.ps1`, `scripts/*.ps1`
- 本轮改动：`GameTheoryModule.tsx`, `server.js`, `difyAPI.ts`, `TaskContext.tsx`, `GlobalTaskCenter.tsx`, `App.tsx`

## Relevant docs/rules inspected
- `AGENTS.md`, deployment-notes rule, `deploy-smart` SKILL.md
- `.omx/specs/deep-interview-page-density-deploy-putty.md`（先例）

## Terminology notes
- 「部署脚本」在仓库中通常指 PowerShell `.ps1`，但也可能指 PuTTY 命令块
- `deploy-smart` 已捆绑 git push，用户要「两个脚本」可能意在解耦

## Prompt-safe initial-context summary status
`not_needed`
