# Deep Interview Spec: P0-2 驭人术档案录入失败

## Metadata
- **Profile:** standard
- **Rounds:** 2
- **Final Ambiguity:** 0.14 (threshold 0.20)
- **Context Type:** brownfield
- **Context Snapshot:** `.omx/context/p0-2-game-theory-prototype-entry-20260722T140800Z.md`
- **Feasibility Verdict:** ✅ 可行，建议按 API 层对称修复 + 后端校验 + 组件失败提示实施

## Clarity Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.95 | 修复手动录入不可见 + 防静默失败 |
| Outcome | 0.95 | 录入后刷新列表可见；失败有反馈 |
| Scope | 0.90 | API + server + 组件 UX；不迁移历史数据 |
| Constraints | 0.85 | 最小 diff，不动自动归档链路 |
| Success Criteria | 0.80 | 见下方验收标准 |
| Context (brownfield) | 0.95 | 根因已在代码中确认 |

## Intent
修复「驭人术与人性档案」手动录入后刷新列表看不到记录的 P0 缺陷，并避免用户误以为写入成功。

## Desired Outcome
- 手动录入写入当前登录用户的 `user_id` 桶
- 录入失败时有明确声光/文案反馈
- 后端拒绝无 `userId` 的写入，防止回归

## In-Scope
1. `difyAPI.upsertPersonalPrototype` 内默认注入 `userId: params.userId ?? getAppUserId()`
2. `server.js` POST `/api/game-theory/prototypes` 缺失 `userId` 时返回 400
3. `GameTheoryModule.handleAddProto` catch 块增加 `playGentleWarning` + `alert`
4. 功能验证用例（手动录入 → 列表可见）

## Out-of-Scope / Non-goals
- 不迁移/清理历史写入 `default-user` 桶的脏数据
- 不改页面布局与成功动画
- 不改自动归档（`runGameTheoryAnalysis`）链路
- 不改 DELETE 接口行为

## Decision Boundaries (OMX 可自主决定)
- userId 注入放在 API 层而非组件层（与用户选择的 `getPersonalPrototypes` 对称模式一致）
- 组件层不重复 import `getAppUserId`，仅补失败 UX
- 错误提示沿用本模块已有 `alert` 模式
- 后端 400 错误信息使用 `{ error: 'Missing userId' }`

## Constraints
- 单调用方：`upsertPersonalPrototype` 仅 `handleAddProto` 使用
- `getAppUserId()` 已存在于 `difyAPI.ts`，无需新依赖
- `playGentleWarning` 已在 `GameTheoryModule` import

## Testable Acceptance Criteria
1. 登录用户 A，手动录入档案「测试人物」，提交成功后列表立即出现该记录
2. 刷新页面后记录仍在（`user_id` 与 A 一致，非 `default-user`）
3. 模拟后端 500/网络失败时，出现 warning 音效 + alert，表单不清空（或按现有逻辑）
4. 直接 POST 无 `userId` 的请求返回 400（若做后端校验）
5. 自动推演归档链路行为不变（回归 smoke）

## Assumptions & Resolutions
| Assumption | Resolution |
|------------|------------|
| 根因是 userId 缺失 | ✅ 代码已确认 |
| 自动归档正常 | ✅ analyze 路径独立且已传 userId |
| 组件层必须显式传 userId | ❌ 改为 API 层对称注入（用户 Round 1 选择） |

## Pressure-Pass Findings
- 用户原方案在组件传 userId 可行，但不如 API 层注入符合项目既有模式（`getPersonalPrototypes` 已在 API 层默认 userId）
- 后端 `default-user` 兜底是静默失败根因之一，400 校验应纳入首版

## Docs/Terminology Ledger
- `personal_prototypes` 表，`user_id` 字段
- `getAppUserId()` → localStorage，fallback `'default-user'`
- 手动录入 = `handleAddProto`；自动归档 = analyze 路由 `prototype_archive`

## Residual Risks
- 历史误写入 `default-user` 的数据对用户仍不可见（已明确为非目标）
- DELETE 接口仍不校验 userId（首版不扩 scope）
