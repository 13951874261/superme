# Deep Interview Spec: 部署服务器 + 推送 GitHub 命令块

## Metadata

| Field | Value |
|-------|--------|
| Profile | standard |
| Rounds | 5 |
| Final ambiguity | ~0.08 |
| Context snapshot | `.omx/context/deploy-push-scripts-20260723T110800Z.md` |
| Transcript | `.omx/interviews/deploy-push-scripts-20260723T111200Z.md` |

## Intent

为 P1-5 及本轮工作提供可复制 PuTTY 部署 + GitHub 推送命令块，不写新脚本文件。

## Desired Outcome

1. **块 1 服务器**：build → 上传 dist → 上传 server.js → 重启服务 → nginx → curl 验证  
2. **块 2 GitHub**：add 本轮文件清单 → commit → push `feature/english-engine-update`

## In-Scope

- PuTTY pscp/plink，密码 `$env:DEPLOY_SSH_PW`
- 前端 pnpm build + dist 上传
- 后端 server.js 上传 + super-agent-vocab restart
- 验证：vocab health + game-theory history API
- Git：本轮 12 个路径（见下）

## Out-of-Scope / Non-goals

- 不新建 `.omx/specs` 以外的 durable 脚本文件
- 不 force push
- 密码不写进仓库文件

## Git 本轮文件清单

```
src/App.tsx
src/components/GlobalTaskCenter.tsx
src/components/TaskContext.tsx
src/components/modules/GameTheoryModule.tsx
src/services/difyAPI.ts
vocab-server/server.js
.omx/context/p1-5-game-theory-export-cases-20260723T081325Z.md
.omx/context/deploy-push-scripts-20260723T110800Z.md
.omx/interviews/p1-5-game-theory-export-cases-20260723T085216Z.md
.omx/specs/deep-interview-p1-5-game-theory-export-cases.md
.omx/ultragoal/brief.md
.omx/ultragoal/goals.json
.omx/ultragoal/ledger.jsonl
```

## Constraints

- Host: `ubuntu@150.158.34.217`
- HostKey: `ssh-ed25519 255 SHA256:bMGzO191QrmuP6o2MMi/UwtmJdzmqFpnAsVXFfoCNfE`
- Remote: `/var/www/super-agent`
- Branch: `feature/english-engine-update`
- 生产验证：`https://ai.234124123.xyz`

## Testable acceptance criteria

1. 命令块在 PowerShell 5.1+ 可分段执行
2. 远端 health 200；history API 返回 JSON
3. push 后 origin 无未推送 commit
4. 无新 .ps1 落盘
