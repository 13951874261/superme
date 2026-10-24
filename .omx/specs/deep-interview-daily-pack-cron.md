# Deep Interview Spec: daily-pack-cron + blank-tab decouple

## Metadata
- Profile: standard (threshold ≤ 0.20)
- Rounds: 8
- Final ambiguity: ≈ 0.15
- Context type: brownfield
- Date: 2026-07-23

## Intent
修复「进站自动呼叫 Dify（破绽词/唤醒相关）拖慢顶栏 Tab」；并让【今日唤醒】与【每日破绽推送】在 UTC+8 02:00 按用户预生成，进站只读当天缓存，保留手动重新生成。

## Desired Outcome
1. 进站后立即切换顶栏（洞察听等）不再因英语壳 Dify 阻塞而长时间骨架；可接受极短懒加载。
2. 主题已同步的用户，每天 02:00 后台生成当日唤醒包 + 破绽词；进站展示当天内容。
3. 「刷新词汇 / 重新生成」仍可用，覆盖当天缓存。

## In-Scope
- Bug：解耦英语引擎进站 Dify 与顶栏模块加载（超时/取消/不阻塞顶栏）。
- 主题同步到服务器（登录/换主题）。
- 按 user_id + theme 的每日包缓存（唤醒 + 破绽词）。
- UTC+8 02:00 cron（仅主题已同步用户）。
- 进站读当天缓存；手动重新生成写回当天。

## Out-of-Scope / Non-goals
- 多时区
- 历史日期回看 / 日历
- 失败重试队列可视化（失败记日志 + 手动重生）
- 改顶栏其他模块业务逻辑

## Decision Boundaries（代理可自行决定）
- 表结构 / API 命名
- 读缓存失败 UI 文案与短暂骨架
- 手动重生串行 Dify 或后端队列
- 解耦实现细节（取消、超时、keep-alive 与懒加载）

## Constraints
- 个性化：C（按用户主题 + 生词本排除）
- 主题来源：A（登录/换主题同步服务器）
- Cron 对象：C（仅主题已同步用户）
- 时区：UTC+8 02:00
- 前端直连 Dify API Key 不安全时，优先后端代理（与部署笔记一致）

## Success Criteria
- 进站立刻切顶栏：骨架应在合理时间内结束（目标：不因 flaw-vocab/wakeup Dify pending 而分钟级卡住）。
- 主题已同步用户：02:00 后进站应命中当天缓存，破绽词区不以「正在呼叫 DIFY」为默认首屏。
- 手动重生覆盖当天包并刷新 UI。
- 未同步主题用户：cron 跳过，行为不破坏现有登录/换主题。

## Assumptions & Resolutions
- 空白是延迟加载非永久白屏 → 优先解耦/超时，非 ErrorBoundary 大修。
- 无直接 wakeup 门禁；耦合为共享 Dify + english keep-alive。
- 主题原在 localStorage → 必须服务端同步才能 cron。

## Pressure-pass
- 空白位置：顶栏 A
- 触发：进站 Dify 加载中切顶栏 A
- 等待：最终会出来 A
- 个性化 / 主题同步 / cron 用户集 / non-goals / decision boundaries 均已确认

## Technical touchpoints (evidence)
- `DailyErrorVocabularyModule.tsx` mount → `generateDailyFlawVocabulary`
- `DailyWakeupModule.tsx` click → `runEnglishWakeupRoutine`
- `MainContent.tsx` english keep-alive `hidden`
- `difyAPI.ts` 共用 WAKEUP API Key / blocking workflow
- `vocab-server` 无 wakeup cron；有 `user_id` 表可扩展
