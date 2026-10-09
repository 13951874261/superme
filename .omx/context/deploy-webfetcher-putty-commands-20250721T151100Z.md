# Context Snapshot: deploy-webfetcher-putty-commands

**Timestamp:** 20250721T151100Z  
**Task:** 输出 PuTTY 格式命令：上传 webFetcher 修复到服务器 + 推送到 GitHub

## Task Statement
用户需要 PuTTY（pscp/plink）格式的手动部署与 Git 推送命令，用于发布 `webFetcher.js` 网页提取修复。

## Desired Outcome
可复制粘贴的 PowerShell 命令块：服务器上传、服务重启、健康检查、git commit/push。

## Known Facts [from-code][auto-confirmed]
- 变更文件：`vocab-server/services/webFetcher.js`（M）
- 未跟踪：`.omx/`（interview artifacts，通常不提交）
- 分支：`feature/english-engine-update`
- Remote：`origin https://github.com/13951874261/superme.git`
- 服务器：`ubuntu@150.158.34.217`
- 远程路径：`/var/www/super-agent/vocab-server`
- HostKey：`ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE`
- PuTTY 路径：`C:\Program Files\PuTTY\pscp.exe` / `plink.exe`
- 服务名：`super-agent-vocab.service`
- 现有模板：`scripts/deploy-task-center-encoding-putty.ps1`（仅 server.js；本轮需 services/webFetcher.js）
- 一键方案：`deploy-smart.ps1 -BackendOnly`（含 PuTTY + git push）

## Constraints
- PuTTY 格式（-hostkey, -pw, -batch）
- 密码通过 `$env:DEPLOY_SSH_PW` 或交互输入，不硬编码在输出中

## Unknowns
- Git commit 是否仅含 webFetcher.js，还是包含 .omx/

## Prompt-safe Summary Status
`not_needed`
