# Interview: unify-listen-dashboard-enums

- Profile: standard（threshold 0.20，max 12）
- Type: brownfield
- Snapshot: `.omx/context/unify-listen-dashboard-enums-20260823T021700Z.md`
- Rounds: 10
- Final ambiguity: ~0.13
- Pressure pass: Round 2 Contrarian（收名单 vs 扩名单）
- OMX CLI: 本环境不可用，状态落在 `.omx/context/unify-listen-dashboard-enums-state.json`

## 初始想法

统一精听和总控中的枚举值，保持一致性。

## 预检事实（非访谈轮）

- `[from-code][auto-confirmed]` 总控下拉 7 项；类型含 `podcast` 但未展示。
- `[from-code][auto-confirmed]` 精听下拉 3 项：`meeting / news / podcast`。
- `[from-code][auto-confirmed]` 夜里 `LONG_GENRES` 4 项：`meeting / news / podcast / reading`。
- `[from-code][auto-confirmed]` 难度、时长两边已一致。
- `[from-code][auto-confirmed]` `02:00–02:15` 只是启动窗口；长文默认 3 路、上限 4。

## 轮次

| 轮 | 维度 | 结论 |
| --- | --- | --- |
| 1 | Intent | 解决「一边能选、另一边/夜里没有」 |
| 2 | Outcome（Contrarian） | 留下研报等总控选项，精听和夜里跟着扩，不收缩 |
| 3 | Outcome | 标准名单 = 8 个体裁并集，三处同一份 |
| 4 | Non-goals | 不改写作/角色/演讲；不改 Dify 提示词；不迁旧缓存；不改难度时长 |
| 5 | Non-goals | 主题统一另走；凌晨窗口/并发/选人「可以改」 |
| 6 | Scope | 认定 112 篇要先加并发 |
| 7 | Constraints | 知道能通宵跑完，仍要加快 |
| 8 | Constraints | 默认并发改 4，上限仍 4 |
| 9 | Decision Boundaries | 可自定：共享常量位置、中文标签、默认会议、空文案；同时勾了打架的两条 Dify 传参 |
| 10 | Decision Boundaries | 精听和长文都原样传 8 个键，工作流不改 |

## 压力结论

「要对上」不等于必须留研报。用户明确拒绝收成 3/4 项，选择扩到 8 项。
