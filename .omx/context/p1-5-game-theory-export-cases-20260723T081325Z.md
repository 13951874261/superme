# Context Snapshot: p1-5-game-theory-export-cases

- **Timestamp:** 20260723T081325Z
- **Profile:** standard (threshold 0.20, max_rounds 12)
- **Type:** brownfield

## Task statement
P1-5：博弈板块「导出/研判慢」感知 +「刷新后案例仍是那几个」；通过 deep-interview 收敛最终改造方案（不直接改代码）。

## Desired outcome
待访谈澄清：UX 诚实等待 vs 异步任务；案例库静态预设 vs 动态入库。

## Stated solution (user draft)
- 后端 analyze 改异步 taskId + 轮询
- 去掉假进度条
- 新增 `GET /api/game-theory/cases` + 删 `PRESET_CASES`

## Probable intent hypothesis
用户把「假进度卡住」当成导出慢，把「刷新后案例不变」当成缺动态案例库；真实墙钟时间由 Dify blocking 决定，案例不变可能是产品设计（预设教学案例）。

## Known facts / evidence
- [from-code][auto-confirmed] `PRESET_CASES` 前端写死 5 条（`GameTheoryModule.tsx:33-74`）
- [from-code][auto-confirmed] 假进度 `stepInterval` 1200ms × 5 步（两处：案例研判 + 人机对战）
- [from-code][auto-confirmed] `/api/game-theory/analyze` 使用 `response_mode: 'blocking'`
- [from-code][auto-confirmed] 无 `game_theory_cases` / `async_tasks` 表；已有 `personal_prototypes` + `taskQueue` + `/api/tasks/:taskId` + `TaskContext`
- [from-code][auto-confirmed] 设计文档定义案例库为「预设案例」教学入口（`docs/superpowers/specs/2026-06-12-game-theory-redesign-design.md`）
- [from-code] 分析成功会 upsert `personal_prototypes`，不会写入案例列表

## Constraints
- AGENTS.md：中文、确认前不改代码、优先成熟方案不造轮子
- 优先复用 `taskQueue` / `TaskContext`，勿新建冲突的 tasks API

## Unknowns / open questions
- 主痛点是「慢」还是「案例不变」？
- 案例不变是 bug 还是对「预设」的误解？
- 是否要研判结果自动入库为新案例？
- 异步化是否必须（超时/离开页面）还是仅 UX？

## Decision-boundary unknowns
- OMX/AIM 可否自行选择 A/B/C 与 X/Y/Z？
- Non-goals 未声明

## Likely codebase touchpoints
- `src/components/modules/GameTheoryModule.tsx`
- `src/services/difyAPI.ts`
- `vocab-server/server.js`
- `vocab-server/services/taskQueue.js`
- `src/components/TaskContext.tsx`

## Relevant repo docs/rules inspected
- `AGENTS.md`（确认优先、中文、最小改动）
- `docs/superpowers/specs/2026-06-12-game-theory-redesign-design.md`
- `.omx/context/p0-2-game-theory-prototype-entry-20260722T140800Z.md`（同模块先例）
- Prior analyze session: blocking + PRESET_CASES 根因已核验

## Terminology / doc-code notes
- 「案例库」在设计文档 = 预设教学案例，可编辑输入；用户口语「刷新后案例还是那几个」可能期望「历史对局/用户案例」
- 「导出」在 UI 文案是假进度最后一步，实际是 Dify 研判，不是文件导出
- 「人性原型档案」才是动态持久化实体，勿与案例库混淆

## Prompt-safe initial-context summary status
`not_needed`（上下文可收敛，非 oversized）
