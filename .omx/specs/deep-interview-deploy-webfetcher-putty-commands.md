# Deep Interview Spec: deploy-webfetcher-putty-commands

## Metadata
| Field | Value |
|-------|-------|
| Profile | quick |
| Rounds | 1 |
| Final Ambiguity | ~0.12 |
| Context Snapshot | `.omx/context/deploy-webfetcher-putty-commands-20250721T151100Z.md` |

## Intent
获得 PuTTY 格式的服务器部署 + GitHub 推送命令，发布 webFetcher 网页提取修复。

## Desired Outcome
用户可在 Windows PowerShell 复制执行：上传 `webFetcher.js`、重启服务、验证、git push 全部本地变更。

## In-Scope
- PuTTY pscp/plink 命令（含 hostkey）
- 远程备份、上传、systemctl restart、curl 健康检查
- `git add -A` + commit + push 到 `feature/english-engine-update`

## Non-goals
- 不创建新 deploy 脚本文件（除非用户后续要求）
- 不部署前端
- 不上传 server.js（本轮未改）

## Decision Boundaries
- OMX 决定 commit message 文案
- OMX 决定先本地 node -c 再上传

## Acceptance Criteria
- 命令块完整可复制
- 路径/HostKey/分支与仓库一致
- 密码占位符不写死

## Git Scope [from-user]
提交全部本地变更（含 `.omx/`）
