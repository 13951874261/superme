# 上下文快照：刷新/重新生成后词汇去重

- slug: `dedupe-refresh-vocab`
- 时间: 2026-08-20T13:50:00Z (UTC+8 21:50)
- 类型: brownfield
- 超大上下文摘要门: not_needed

## 任务陈述
「每日唤醒」与「每日破绽词汇推送」两个模块，在用户点击【重新生成】/【刷新词汇】后，新生成的词汇不允许与此前推送过的词汇重复。

## 期望结果
用户连续刷新时，每一批词都是新的；跨天、跨会话也不会再看到最近一段时间内已推送过的词。

## 用户给出的解法陈述
"刷新或重新生成后不允许重复"（症状描述，未指定去重范围与兜底策略）。

## 意图假设
用户把这两个模块当作每日新词输入源。重复词等于当次训练无效产出，直接削弱模块价值。用户点刷新的动机就是"再给我一批没见过的"。

## 已知事实（代码证据）

### 组件与链路
- `src/components/modules/DailyWakeupModule.tsx` — 每日唤醒 UI，`handleRegenerate` 在 L130-163
- `src/components/modules/DailyErrorVocabularyModule.tsx` — 破绽词汇 UI，`fetchFlawVocab(true)` 在 L25-56
- `src/services/dailyPackAPI.ts` — `buildDailyPackQueryInput` L79-98、`regenerateDailyPack` L178-203、`pollTodayUntilSettled` L156-176
- `vocab-server/server.js` — `POST /api/daily-pack/regenerate` L7816-7938（立即返回 generating，setImmediate 后台生成）
- `vocab-server/services/dailyPackService.js` — 核心生成与缓存
- `vocab-server/services/dailyPackCron.js` — UTC+8 02:00 预生成
- `yml/time_base/english_wakeup_routine.yml` — Dify 工作流 prompt（约 L312-346）

### 现有排除机制（不足之处）
- `callWakeupWorkflow`（dailyPackService.js L239-264）向 Dify 传 `history_exclude`
- `history_exclude` 的内容**只有生词本 `vocabulary` 表的词**，不含历史推送词
  - 唤醒：前端 `buildDailyPackQueryInput` 取 `getAllWords({limit:50})` 最近 50 词
  - 破绽：服务端 `generateFlawVocabForUser` L268 取 `dbWords.slice(-50)`
- `buildFlawDisplayWords`（L179-201）有 `sessionExclude` 形参，但 L284/L286 调用时**恒传空数组**，形同虚设
- 唤醒路径**无任何服务端硬过滤**，完全依赖 Dify prompt 层软约束

### 根因
系统从未持久化"曾经推送展示过哪些词"。`daily_packs` 表按 `(user_id, pack_date, input_signature)` 唯一，重新生成时**直接覆盖同一行**，上一轮的 10 词随即丢失，无法作为下一轮的排除依据。

## 约束
- Dify 唤醒工作流强制 `vocab` 恰好 10 个词
- 破绽词展示固定 6 个
- `/api/daily-pack/today` 禁止同步调 LLM（有测试契约 `tests/dailyPackTodaySla.test.js` 约束）
- 生成为后台异步 + 前端轮询模式，超时 180s

## 已检视的仓库文档/规则
- `AGENTS.md`（根目录）— 需求复述、分步确认、测试用例要求
- `.cursor/rules/deployment-notes.mdc` — vocab-server systemd 部署、nginx 反代约定
- `vocab-server/tests/dailyPackTodaySla.test.js` — today 接口 SLA 契约

## 术语澄清
- "刷新" = 破绽词汇模块的【刷新词汇】按钮
- "重新生成" = 每日唤醒模块的【重新生成】按钮
- 两者底层是同一个 `/api/daily-pack/regenerate` 接口，仅 `type` 参数不同（`flaw` / `wakeup`）
- 用户所说的"重复"经澄清后定义为：与最近 30 天内**任一模块**推送过的词相同

## 触点清单
- 新增：词汇推送历史表 + 读写函数
- 修改：`dailyPackService.js`（生成路径注入排除、返回后硬过滤、写入历史）
- 修改：`server.js` regenerate 路由（若需传递模块类型）
- 修改：`dailyPackCron.js`（预生成路径同样去重）
