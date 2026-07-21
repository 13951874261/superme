# Context Snapshot — page-density-deploy-putty

- **Timestamp:** 20250721T160800Z
- **Slug:** page-density-deploy-putty
- **Profile:** standard (threshold ≤ 0.20, max rounds 12)
- **Type:** brownfield

## Task statement
结合本轮「进度总控」密度改版修改，输出部署服务器并发布到 GitHub 的 PuTTY 脚本。

## Desired outcome
用户可执行的 PuTTY（pscp/plink）部署流程 + GitHub 发布（commit/push），覆盖本轮前端改动。

## Stated solution
产出 PuTTY 脚本（形式待确认：独立 .ps1 / 命令块 / 调用 deploy-smart）。

## Probable intent hypothesis
本轮已完成布局密度改版，需要把前端产物同步到生产并推送远程仓库留痕；沿用仓库既有 PuTTY 部署习惯。

## Known facts / evidence
- [from-code][auto-confirmed] 本轮触达文件（密度改版）：`DashboardTab.tsx`、`StayAnalysisPanel.tsx`、`DailyBriefingCard.tsx`、`StrategicRoadmap.tsx`、`ThemeGateway.tsx`；属前端布局，需 `build` + 上传 `dist/`。
- [from-code][auto-confirmed] 已有 `deploy-smart.ps1`（PuTTY/系统 SSH、前端 build+上传 dist、可选 git push）。
- [from-code][auto-confirmed] 既有同类脚本：`scripts/deploy-*-putty.ps1`（如 `deploy-webfetcher-putty.ps1`）。
- [from-code][auto-confirmed] 先前规格 `.omx/specs/deep-interview-deploy-webfetcher-putty-commands.md`：PuTTY + hostkey + git push；彼时非目标含「不部署前端」。
- [from-user] 本请求明确要求「部署服务器并发布到 github」的 putty 脚本，且「结合本轮修改」。

## Constraints
- deep-interview：本阶段只澄清，不直接实现/不直接部署
- 部署笔记：生产建议经 nginx；前端不暴露 Dify key

## Unknowns
- 交付物形态：新 `.ps1` 文件 vs 聊天里可复制命令 vs 直接跑 `deploy-smart.ps1`
- Git 范围：仅本轮相关文件 vs 全部本地变更（含 `.omx/`、dist 等）
- 是否必须用 PuTTY（pscp/plink）而不能用 `-UseSystemSSH`
- 目标分支、是否允许脚本内自动 commit
- 密码/密钥如何注入（占位符 vs 环境变量）

## Decision-boundary unknowns
- commit message、是否含 `.omx/`、是否 force 上传整个 dist

## Likely touchpoints
- `deploy-smart.ps1` / `scripts/deploy-*-putty.ps1`
- 前端 `dist/` → `/var/www/super-agent/dist`
- git remote / 当前分支

## Docs inspected
- `deploy-smart` skill
- prior putty deep-interview spec
- deployment-notes workspace rule (nginx, health checks)

## Terminology
- 「PuTTY 脚本」在本仓通常指 PowerShell + `pscp`/`plink`，非 `.ppk` 会话文件 alone

## Prompt-safe summary status
`not_needed`
