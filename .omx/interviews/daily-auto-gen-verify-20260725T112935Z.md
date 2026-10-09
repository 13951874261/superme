# Deep Interview Transcript: daily-auto-gen-verify

- Profile: standard (threshold ≤ 0.20, max 12)
- Type: brownfield
- Final ambiguity: ~0.15
- Context snapshot: `.omx/context/daily-auto-gen-framework-20260725T105226Z.md`
- Spec: `.omx/specs/deep-interview-daily-auto-gen-verify.md`

## Initial idea

在现有项目上按前台查询条件后台定时生成内容并存储；每日查询仅取当日满足条件数据。模块：每日唤醒、每日破绽词汇、AI生成长文并提纯、精听盲听。并明确所需 skills。

## Rounds

| # | Target | Answer |
|---|--------|--------|
| 1 | Intent | D：逐个验证确认是否已实现满足需求 |
| 2 | Outcome | D：报告后立刻按缺口改代码；验一个修一个；**确认后才可改** |
| 3 | Decision Boundaries | B：先交付现状 + 与需求差距 + 具体改法（文件/行为/不动项），确认改法后再动手 |
| 4 | Success / Scope | C：总原则 A + 模块细则 B；冲突以 A 为准 |
| 5 | Non-goals | 不新建对象存储；SQLite + 服务器存音频与生成文本 |
| 6 | Non-goals 补全 | A,C,D,E,F 全部列为不做 |
| 7 | Scope 顺序（闭合） | A：①唤醒 → ②破绽 → ③精听盲听 → ④AI长文并提纯 |

## Pressure-pass findings

- Round 7 用代码事实（Dashboard 提纯缺口最大）反压「四模块同等新建」假设；用户仍选先易后难顺序 A，确认动机是验收而非先啃最大洞。
- Round 3–4 将「满足需求」从模糊口号压成：总原则（定时按条件生成+当日只读）+ 分模块既有合同，冲突归总原则。

## Docs/Terminology Ledger

| 术语 | 仓库含义 | 裁决 |
|------|----------|------|
| 精听盲听 | 业务在 `ListenTab` + pregenerate；`BlindListeningCabin` 孤立未引用 | 以 ListenTab 为准（Non-goal D） |
| AI生成长文并提纯 | Dashboard 实时 `daily-extract`，非 listen 预生成长脚本 | 独立对照条；可能与 A 总则差距最大 |
| 每日包 | `daily_packs` + GET today；含唤醒+破绽 | 已有 cron |
| 需求基准 | A 总则优先于 B 细则 | Round 4-C |
