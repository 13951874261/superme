# Spec: daily-auto-gen-verify

## Metadata

| Field | Value |
|-------|-------|
| Profile | standard |
| Rounds | 7 |
| Final ambiguity | ~0.15 (threshold 0.20) |
| Context type | brownfield |
| Context snapshot | `.omx/context/daily-auto-gen-framework-20260725T105226Z.md` |
| Transcript | `.omx/interviews/daily-auto-gen-verify-20260725T112935Z.md` |
| Prompt-safe initial-context summary | not_needed |

## Clarity breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.90 | 逐模块验收；非重建统一框架 |
| Outcome | 0.88 | 现状+差距+改法 → 确认 → 修 → 下一模块 |
| Scope | 0.88 | 顺序 A；非目标 A–F + 存储 |
| Constraints | 0.88 | SQLite + 服务器本地音频/文本；确认后才动码 |
| Success | 0.80 | 总原则 A + 细则 B；冲突以 A 为准 |
| Context | 0.85 | pack/listen 已落地；Dashboard 提纯仍实时 |

## Intent（为什么）

确认四模块是否已满足「后台按前台条件定时生成并存储；查询仅取当日满足条件数据」；有缺口则**验一个、确认改法、修一个**，避免未确认整包重构。

## Desired Outcome

1. 按模块顺序产出对照包：现状实现 / 相对需求差距 / 具体改法（文件、行为、不动项）
2. 用户确认改法后才改代码
3. 修完再进入下一模块
4. 最终四模块相对验收基准可判定为满足（或明确残留风险）

## In-Scope

1. **每日唤醒** — 对照 `docs/superpowers/specs/2026-07-23-daily-pack-cron-design.md` + 总原则 A
2. **每日破绽词汇** — 同上 daily-pack 合同 + 总原则 A
3. **精听盲听** — 对照 `re.md` / `DESIGN.md` Listen 段 + `docs/superpowers/plans/2026-07-24-daily-listen-pregenerate.md` + 总原则 A
4. **AI生成长文并提纯** — Dashboard 路径另立对照条 + 总原则 A（预期缺口最大）
5. 每模块：证据核查、差距报告、改法包、确认后最小修复、功能验证用例

## Out-of-Scope / Non-goals

| ID | Non-goal |
|----|----------|
| S1 | 不新建对象存储；继续 SQLite；音频与生成文本存服务器本地磁盘 |
| A | 不重构已可用的 daily-pack / listen 预生成主干（只补缺口） |
| C | 不改 Dify workflow 本体（只复用现有调用） |
| D | 不复活/接入 `BlindListeningCabin`（盲听以 `ListenTab` 为准） |
| E | 本轮不做部署上线 |
| F | 不做四模块「大一统新框架」重写（保持现有 02:00 cron 串联） |

## Decision Boundaries

### 必须用户确认

- 每个模块的「现状 + 差距 + 改法」整包
- 任何超出已确认改法包的额外文件/行为变更
- 若总原则 A 与细则 B 冲突且修复会扩大范围时，先请示

### 代理可自行决定（无需再问）

- 在已确认改法包内的具体补丁写法、命名与现有风格对齐
- 选用哪种本地验证命令（在 AGENTS.md「一次一个功能 + 测试用例」约束内）
- 报告中的证据引用粒度（文件路径 + 关键行为）

## Constraints

- 沟通与产出：中文
- AGENTS.md：未确认不改代码；单步确认
- 存储：SQLite + `vocab-server/public/daily_*` 类本地路径
- Cron：复用现有 `dailyPackCron` 02:00 Asia/Shanghai 串联，不另起调度框架
- 日期键：Asia/Shanghai `pack_date`（`getPackDate()`）

## Acceptance baseline（总原则 A）

对每一模块判定「满足」须同时成立：

1. **定时生成**：按该模块对应的前台查询条件（或已同步偏好）在后台定时生成
2. **自动存储**：生成结果写入 SQLite 且（如有媒体/正文文件）写入服务器磁盘
3. **当日查询**：前台日常读取路径只查当前 `pack_date` 且满足条件的数据；优先缓存，未命中策略按该模块细则（缺失/backfill/手动 regenerate）

细则 B 来源：

- 唤醒/破绽：`docs/superpowers/specs/2026-07-23-daily-pack-cron-design.md`
- 精听盲听：`DESIGN.md` Listen 段、`re.md`、`docs/superpowers/plans/2026-07-24-daily-listen-pregenerate.md`
- AI长文并提纯：以 Dashboard 现网行为为现状基准，用总原则 A 量差距后另写对照条（确认改法时交给用户）

冲突裁决：**以总原则 A 为准**。

## Execution order（locked）

1. 每日唤醒  
2. 每日破绽词汇  
3. 精听盲听  
4. AI生成长文并提纯  

Per module loop:

```
核查现状 → 写差距 → 写改法包（文件/行为/不动）
  → 用户确认改法
  → 最小修改
  → 给出并跑通该模块测试用例
  → 下一模块
```

## Assumptions exposed + resolutions

| Assumption | Resolution |
|------------|------------|
| 四模块都要新建统一框架 | 否；验收 + 只补缺口（Intent D + Non-goal F） |
| 确认后可直接大改 | 否；每模块先改法包再确认（Round 3-B） |
| 「需求」= 仅口头描述 | 否；A 总则 + B 细则，冲突归 A（Round 4-C） |
| 盲听 = BlindListeningCabin | 否；ListenTab（Non-goal D） |
| 听写预生成长文 = Dashboard 提纯 | 否；两条链路（Context） |

## Brownfield evidence (preflight)

- `dailyPackCron.js`：02:00 先 pack 后 listen
- `daily_packs` + GET `/api/daily-pack/today`：唤醒/破绽当日只读
- `dailyListenPreGenerateService.js` + GET `/api/listen/pregenerated`：36 组合预生成
- Dashboard「AI生成长文并提纯」：实时 `daily-extract` + localStorage，无当日预生成表
- Plan 文档 checkbox 滞后；以代码为准做现状

## Skills to use（实现本规格）

按阶段启用，勿一次全开：

### 必用（本任务主路径）

| Skill | 何时 | 作用 |
|-------|------|------|
| `deep-interview` | 已完成 | 需求门禁；本规格为其产出 |
| `analyze`（或只读 explore） | 每模块「现状」步 | 证据级对照，禁止猜实现 |
| `surgical-modification` | 写「改法包」时 | 最小 diff 计划：文件/行为/不动项 |
| `verification-before-completion` | 声称某模块满足前 | 必须有可核对验证证据 |
| `systematic-debugging` | 验收发现行为不符时 | 先取证再改，禁止盲补 |

### 按模块选用

| Skill | 何时 | 作用 |
|-------|------|------|
| `test-driven-development` | 确认改法后、动手修之前（若缺口需新行为） | 先失败用例再补丁 |
| `browser-test-analyzer` | 前端路径验收（Wakeup/Flaw/ListenTab/Dashboard） | 菜单路径级 E2E 与截屏证据 |
| `writing-plans` / `executing-plans` | 仅当模块④缺口大到改法包无法一页说清时 | 拆任务后再确认执行 |
| `subagent-driven-development` | 单模块改法已确认且步骤独立可并行核查时 | 加速证据收集/实现，仍遵守确认门禁 |
| `requesting-code-review` | 每模块修复完成后（可选） | 独立审查最小 diff |
| `brainstorming` | **默认不用** | Non-goal F；非创意新功能 |
| `deploy-smart` | **本轮禁用** | Non-goal E |
| `best-practice-research` | 仅当需外部/官方约束（如 Dify/TTS 限额）且会影响验收时 | 有界调研，不替代用户决策 |

### 流程规则侧（非独立 skill，但必须遵守）

- 仓库 `AGENTS.md`：中文、复述、确认后改、一次一功能+测试用例
- Cursor rules：`karpathy-confirm-before-implement`、`minimal-diff`、`no-unrelated-changes`、`test-and-verify`

### 明确不需要作为主路径的 skills

- `impeccable` / `taste-skill` / `redesign-skill` / `soft-skill` / `stitch-skill` — 非 UI 重设计
- `ralph` / `visual-ralph` / `ultragoal` — 除非用户在交接时显式选择持久化执行环
- `create-skill` / `create-rule` / `create-hook` — 非本轮目标

## Recommended handoff

默认：`$ultragoal` 或直接按本规格 **模块①开始验收**（用户确认后进入执行会话）。  
若模块④预计架构争议大：先 `$ralplan` 只规划 Dashboard 预生成，再执行。  
勿在 deep-interview 会话内直接改代码。

## Residual risk

- 低：访谈经闭合门禁结束；Non-goals / 顺序 / 确认门槛已锁
- 中：模块④对照条需在该模块验收步现场起草（无独立历史设计合同）
- Plan 文档 checkbox 与代码不同步 — 验收以代码+总原则 A 为准，不强行改文档除非用户另开范围
