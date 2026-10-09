# Deep Interview Spec: 取消导航锁定后的部署与 GitHub 发布

## Metadata

| Field | Value |
|-------|--------|
| Profile | standard |
| Rounds | 5 (+ Y closure) |
| Final ambiguity | ~0.08 |
| Threshold | 0.20 |
| Context type | brownfield |
| Context snapshot | `.omx/context/unlock-nav-deploy-github-20260805T015248Z.md` |
| Transcript | `.omx/interviews/unlock-nav-deploy-github-20260805T020000Z.md` |
| Prompt-safe summary | not_needed |

## Clarity breakdown

| Dimension | Score |
|-----------|-------|
| Intent | 0.92 |
| Outcome | 0.92 |
| Scope | 0.95 |
| Constraints | 0.90 |
| Success | 0.92 |
| Context | 0.90 |
| Ambiguity | ~0.08 |

## Intent

将本轮「取消战略路线图达标强制锁定」的前端改动部署到生产服务器，并推送到 GitHub，使用户可在未达标时试用博弈/高阶审美等模块。

## Desired Outcome

1. 服务器上的前端已包含 `src/App.tsx` 中 `isLocked` 不再因 mastery 指标锁定的逻辑。
2. `origin/feature/english-engine-update` 上有对应 commit。
3. 验收以部署脚本成功 + `git push` 成功为准（V1）。

## In-Scope

1. 临时移出 `scratch/check-remain4.sh`、`scratch/check-remain4-run.sh` 到仓库外。
2. 运行 `deploy-smart.ps1`（项目成熟一键路径）：前端 build/上传 + `git add -A` + commit + push 当前分支。
3. 部署推送完成后，将 scratch 文件移回原路径。
4. 本轮代码事实：`src/App.tsx` 中 mastery 达标条件已改为 `false`；保留 `pendingSentenceDebt` / `shouldForceModal` 锁定。

## Out-of-Scope / Non-goals

1. 不开 PR、不合并 `master`。
2. 不改后端、Nginx、yml。
3. 不做浏览器或 curl 功能验收。
4. 不把 scratch 脚本提交进仓库。
5. 不在 deep-interview 模式内直接实施（须经 handoff 后执行）。

## Decision Boundaries（助手可不经再确认自行决定）

1. 使用默认 commit 消息：`chore: auto deploy update <时间戳>`（脚本默认）。
2. scratch 临时备份目录名/位置（仓库外、可还原即可）。
3. `deploy-smart.ps1` 是否加 `-UseSystemSSH`：按本机 PuTTY/系统 SSH 可用性自动选择。
4. 前端-only 与否：以脚本对当前变更检测为准（仅 `App.tsx` 时应走前端构建上传）。

## Constraints

- Branch: `feature/english-engine-update`
- Remote: `https://github.com/13951874261/superme.git`
- Deploy script: `D:\cursor\work\super-agent\deploy-smart.ps1`
- Production hint: `https://ai.234124123.xyz`
- Host (from prior deploy spec): `ubuntu@150.158.34.217` → `/var/www/super-agent`

## Testable acceptance criteria

1. 运行 deploy-smart 前，工作区无 `scratch/check-remain4*.sh`（已临时移出）。
2. `deploy-smart.ps1` 退出码成功；输出含 Git push succeeded（或等价成功标志）。
3. `git status` 显示与 `origin/feature/english-engine-update` 同步（ahead 已消除）。
4. 最新远端 commit 包含 `src/App.tsx` 的 isLocked 变更；**不包含** scratch 脚本。
5. scratch 文件已移回仓库内原路径（仍可为 untracked）。

## Assumptions exposed + resolutions

| Assumption | Resolution |
|------------|------------|
| 一键脚本会 `git add -A` 误带 scratch | 先 1b 移出再跑脚本 |
| 「发布到 github」= 推 feature 分支 | 确认：不 PR、不合 master |
| 验收需浏览器验证解锁 | 否，V1 即可 |

## Pressure-pass findings

- Round 2「清 scratch」经 Round 3 压测定为 **临时移出再移回**，非永久删除。

## Docs/Terminology Ledger

- Inspected: `AGENTS.md`, deployment-notes, `deploy-smart` skill, `.omx/specs/deep-interview-deploy-push-scripts.md`
- Canonical: 「部署」= 服务器同步；「发布到 github」= push 当前 feature 分支（本次）
- Conflict resolved: 与历史 PuTTY 分块规格不同，本次用户选定 **deploy-smart 一键路径**

## Technical context

- Change already in working tree: `src/App.tsx` `isLocked` mastery branch → `false`
- Untracked (must not commit): `scratch/check-remain4.sh`, `scratch/check-remain4-run.sh`
- Recent commits on branch use `chore: auto deploy update <timestamp>` style

## Execution handoff note

推荐下一步：`$autopilot` 或用户明确说「按 spec 执行」后按本 spec 实施。  
Residual risk: 无（阈值以下且门闩已闭）。
