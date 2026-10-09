# Context Snapshot: P0-2 驭人术档案录入失败

## Task Statement
分析并评估「驭人术与人性档案」手动录入失败问题的改造方案可行性；主技能 `surgical-modification`，辅助 `systematic-debugging`。

## Desired Outcome
确认根因、方案最小改动范围、验收标准，输出可执行改造方案（不直接实施）。

## Stated Solution (User Proposal)
1. 前端 `handleAddProto` 补齐 `userId: getAppUserId()`
2. 增加失败提示（`playGentleWarning` + `alert`）
3. 可选：后端 POST 拒绝缺失 `userId`

## Probable Intent
修复手动录入档案刷新后不可见的 P0 缺陷，并防止同类静默失败回归。

## Known Facts [from-code][auto-confirmed]

### Root Cause Chain
- `GameTheoryModule.tsx:368-372` — `upsertPersonalPrototype({ name, type, description })` 未传 `userId`
- `difyAPI.ts:1808-1817` — `upsertPersonalPrototype` 原样 `JSON.stringify(params)`，不像 `getPersonalPrototypes(userId = getAppUserId())` 那样默认注入
- `server.js:6168` — POST 解构 `userId = 'default-user'`，缺失时写入 default-user 桶
- `server.js:6156` — GET 用 `req.query.userId || 'default-user'`，但前端 GET 通过 `getPersonalPrototypes()` 已传当前 userId
- 结果：写入 default-user，读取当前 userId → 列表为空

### Auto-Archive Path (Not Broken)
- `runGameTheoryAnalysis` 默认传 `userId = getAppUserId()` (`difyAPI.ts:1744`)
- 后端 analyze 路由在 `server.js:5842+` 直接用请求体 userId 写入 `personal_prototypes`

### Call Sites
- `upsertPersonalPrototype` 仅被 `GameTheoryModule.tsx` 的 `handleAddProto` 调用

### UX Patterns in Module
- `playGentleWarning` 已 import（line 8）
- 推演失败已用 `alert(err.message || '...')`（lines 306, 482）

## Constraints
- 最小 diff，不影响自动归档与其他模块
- AGENTS.md：确认后再改代码
- deep-interview：本阶段不直接实施

## Unknowns / Open Questions
- 修复层：组件显式传 userId vs 在 `difyAPI.upsertPersonalPrototype` 内默认注入（与 `getPersonalPrototypes` 对称）
- 后端校验是否纳入首版范围
- 历史误写入 `default-user` 桶的数据是否需迁移/清理

## Decision Boundaries (Unresolved)
- OMX 可否在 API 层而非组件层做 userId 注入？
- 后端 400 校验是否为必做还是可选强化？

## Likely Codebase Touchpoints
- `src/components/modules/GameTheoryModule.tsx` (~363-384)
- `src/services/difyAPI.ts` (~1808-1822) — 备选修复点
- `vocab-server/server.js` (~6166-6194) — 可选

## Docs/Rules Inspected
- `AGENTS.md` — 中文、确认后修改、最小范围
- User-provided surgical-modification skill selection

## Terminology
- 「人性档案册」= `personal_prototypes` 表 / `PersonalPrototype` 类型
- 「手动录入」= `handleAddProto` 表单提交
- 「自动归档」= `runGameTheoryAnalysis` → 后端 analyze 写入

## Prompt-Safe Summary Status
`not_needed` — 用户输入已结构化且代码验证完成
