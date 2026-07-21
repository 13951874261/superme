# Deep Interview Spec — page-density-deploy-putty

## Metadata
- **Profile:** standard
- **Rounds:** 4
- **Final ambiguity:** ~0.09 (threshold 0.20)
- **Context type:** brownfield
- **Context snapshot:** `.omx/context/page-density-deploy-putty-20250721T160800Z.md`
- **Transcript:** `.omx/interviews/page-density-deploy-putty-20250721T161600Z.md`

## Clarity breakdown

| Dimension | Score | Notes |
|-----------|------:|-------|
| Intent | 0.95 | 聊天可复制 PuTTY 命令块 |
| Outcome | 0.92 | build + 上传 dist + nginx + git push |
| Scope | 0.95 | git add -A 全部本地变更 |
| Constraints | 0.95 | 无后端、无新脚本、无 force、无明文密码 |
| Success | 0.85 | 可执行成功；建议含 nginx -t / 健康检查 |
| Context | 0.95 | 复用既有 Host/HostKey/路径 |

## Intent
为本轮进度总控密度改版（及当前工作区全部变更）提供可复制的服务器部署 + GitHub 发布命令，沿用 PuTTY pscp/plink 习惯。

## Desired Outcome
用户在 Windows PowerShell 中设置密码后，按块执行即可：本地前端构建 → pscp 同步 `dist/` → nginx reload → `git add -A` + commit + push 当前分支。

## In-Scope
- 可复制 PowerShell 命令块（非新文件）
- `npm`/`pnpm` build（按仓库惯例选用可用包管理器）
- pscp 上传 `dist/index.html`、`dist/assets`、`dist/images`（与 `deploy-smart.ps1` 一致）
- plink：`nginx -t` + `systemctl reload nginx`
- `git add -A`、commit、`git push origin HEAD`（当前分支 `feature/english-engine-update`）
- 密码：`$env:DEPLOY_SSH_PW` 或交互，不写死

## Out-of-Scope / Non-goals
1. 不部署后端、不重启 vocab systemd
2. 不创建新的 `scripts/*.ps1`
3. 不做 force push
4. 命令中不写死 SSH/GitHub 密码

## Decision Boundaries（可自决）
- Host / HostKey（复用仓库既有）
- commit message 文案
- pscp 上传顺序与远端路径细节
- nginx reload / 验证命令措辞
- build 用 `pnpm` 还是 `npm`（以本机可用为准，优先与项目一致）

## Constraints
- Host: `ubuntu@150.158.34.217`
- HostKey: `ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE`
- Remote web: `/var/www/super-agent`
- PuTTY: `C:\Program Files\PuTTY\pscp.exe` / `plink.exe`（与既有脚本一致）
- Project: `D:\cursor\work\super-agent`
- Branch: `feature/english-engine-update`
- Remote: `origin` → `https://github.com/13951874261/superme.git`

## Testable acceptance criteria
1. 命令块可复制到 PowerShell 5.1+ 执行（分段或整段均可）
2. 构建成功后远端 `dist` 更新且 `nginx -t` 通过并 reload
3. `git status` 在 push 后相对 origin 无未推送的本次 commit（或 ahead 已消除）
4. 无后端重启、无 force push、无明文密码、无新脚本文件落盘

## Assumptions + resolutions
- Round 2 同时选 4+5 → Round 3 裁定为全部本地变更
- 交付形态为聊天命令块而非 durable 脚本 → Round 1

## Pressure-pass findings
- Round 3 回访 Round 2 的 4/5 冲突，锁定 `git add -A`

## Docs / Terminology
- 「PuTTY 脚本」= PowerShell + pscp/plink 命令块
- 对齐惯例对齐 `deploy-smart.ps1` 前端上传段

## Recommended command-block shape (for execution lane)
1. `$env:DEPLOY_SSH_PW = '...'`（用户自填）
2. `cd` 项目根 → build
3. pscp index/assets/images → `/var/www/super-agent/dist/`
4. plink nginx -t && reload
5. 可选 curl 本机或说明用户浏览器验证 `https://ai.234124123.xyz`
6. git add -A → commit → push（无 --force）

## Residual risk
工作区含 `.omx/`、其它未跟踪脚本等会进入同一 commit；用户已接受。

## Handoff note
执行车道应**直接在回复中输出完整可复制命令块**，不要新建脚本文件。
