# 每日主题单词：减量、3+2 专业口径、词形去重 — 设计文档

> 状态：用户已通过（2026-08-31）  
> 日期：2026-08-31  
> 选定方案：**乙** — Prompt 改口径 + 服务端改目标数/词形/跨模块排除/唤醒关闭旧词补齐  
> 覆盖：此前 `dedupe-refresh-vocab` 中「唤醒必须恰好 10 词」「数量优先于不重复」「不改 Dify 工作流」三条，仅对**唤醒路径**失效。破绽路径仍按旧规格。

---

## 1. 已确认决策

| 项 | 结论 |
|---|---|
| 唤醒每日数量 | 最多 **5** 个 |
| 5 词结构 | **3+2 混合**：3 个紧跟当前主题的专业术语 + 2 个博弈论/逻辑学/系统论词库词 |
| 破绽模块 | **不动**：仍 6 词，仍可旧词补齐，不改 Prompt |
| 去重范围 | 唤醒与破绽共享 30 天池 + **当日长文提纯词** + **当日精听词** |
| 词形 | `modeling`/`modelling`/`model` 算同一词；**`negotiate`/`negotiation` 也算同一词** |
| 不够时 | 唤醒 **宁可少推，不用普通旧词凑数** |
| 「蜘蛛效应」 | 按 **蝴蝶效应（butterfly effect）** |

---

## 2. 问题与根因

**现象：** 每日唤醒自动推约 10 个词；刷新后仍见 `modeling`；词偏普通；与长文/精听/破绽上下词条重复。

**根因（已核对代码）：**

1. Dify `yml/time_base/english_wakeup_routine.yml` 写死「恰好 10 个词」且「优先商务高频词」。
2. 服务端 `WAKEUP_VOCAB_TARGET = 10`（`vocab-server/services/dailyPackService.js`）。
3. 去重键仅为小写精确匹配，不做词形；`modeling` 与 `modelling`、`negotiate` 与 `negotiation` 被当成不同词。
4. 唤醒数量不足时走 `fillVocabToTarget`，用最久旧词凑满，重复感被放大。
5. 排除名单不含当日 `daily_extracted_articles.words_json`、`daily_listen_articles.vocab_json`。
6. 前端 `DailyWakeupModule.tsx` 标题写死「10 个高频词发音注意点」。

---

## 3. 期望结果（可测）

主题「商务谈判」时，一批唤醒词应接近：

```
主题专业（3）：BATNA / reservation price / anchoring
博弈逻辑（2）：prisoner's dilemma / Nash equilibrium
```

不得出现 `modeling`、`agenda`、`deadline` 等普通高频词。  
同一批或刷新后不得再出 `model`/`modeling`/`modelling`，也不得再出 `negotiate`/`negotiation`。  
当日长文或精听已出现的词（含词形变体）不得再进唤醒。  
合格新词不足 5 个时，返回实际数量（可为 4/3/2/1/0），**不**用旧词补齐。

破绽模块仍返回 6 词，补齐逻辑不变。

---

## 4. 数据流

```
当前主题
    │
    ▼
Dify 唤醒工作流
  要求：最多 5 词 = 3 主题专业 + 2 博弈/逻辑（尽量可贴本主题）
  禁止：商务高频口语词（modeling / agenda / deadline …）
    │
    ▼
服务端排除名单
  = 近 30 天 pushed_vocab_history
  + 生词本前 50
  + 当日 daily_extracted_articles.words_json
  + 当日 daily_listen_articles.vocab_json
  （比较与去重一律用词形词根，不只精确小写）
    │
    ▼
硬过滤（精确 + 词形）
    │
    ├─ 唤醒：最多留 5；不足则重试 1 次；仍不足则原样返回，禁止 fillVocabToTarget
    └─ 破绽：仍目标 6，仍可补齐（本规格不改此分支）
    │
    ▼
写入 pushed_vocab_history（展示用原文，匹配用词根）
```

`input_signature` **仍不得**纳入推送历史或当日长文/精听排除名单，以免打坏 `daily_packs` 缓存键。`/api/daily-pack/today` 仍禁止同步调 LLM。

---

## 5. 3+2 混合口径

不是「5 个都来自博弈词库」，也不是「丢掉主题」。

| 槽位 | 数量 | 规则 |
|---|---|---|
| 主题专业 | 3 | 必须能用在**当前主题**场景，且为该领域 C1/C2 术语（谈判→`BATNA`，不是 `meeting`） |
| 博弈/逻辑 | 2 | 必须来自博弈论 / 逻辑学 / 系统论词库，并尽量能解释当前主题（谈判→`prisoner's dilemma`；供应链→`butterfly effect`） |

服务端维护一份小词库（约 20–30 条，可演进，不另做管理界面），至少包含：

- prisoner's dilemma, Nash equilibrium, zero-sum, butterfly effect
- information asymmetry, moral hazard, BATNA, coordination game
- dominant strategy, Pareto, anchoring, cobweb theorem（蛛网，仅作词库成员，不替代蝴蝶效应）

**槽位判定（仅唤醒）：** LLM 可带可选字段 `slot: "theme" | "theory"`。无该字段时：词形命中 §5 词库 → `theory`，否则 → `theme`。同一词只能占一个槽；词库词若已被主题槽用掉，不得再计入博弈槽。

**生成后软校验（仅唤醒）：**

1. 过滤后先收最多 3 个 `theme`、最多 2 个 `theory`，合计最多 5。
2. 若 `theory` 不足 2：把尚未用过的词库候选写入重试提示，再调 LLM 1 次。
3. 仍不足：按 4A **不凑数、不失败**，返回现有合格词。
4. 普通高频词进拒绝名单（见 §7），不占任一槽。

展示顺序：先主题专业，后博弈/逻辑；缺槽则按剩余顺序展示。

---

## 6. 词形归一（轻量，无新依赖）

比较键 = `stem(normalize(word))`，多词短语对每个 token 分别 stem 再拼接。

`normalize`：小写、去首尾空格、撇号/连字符收成空格、压缩连续空白。

`stem`：按最长优先剥常见后缀，使下列成对相同：

| 输入 | 视为同一词 |
|---|---|
| model / models / modeling / modelling | model |
| negotiate / negotiation / negotiating | negoti- |
| prisoner / prisoners | prisoner |
| prisoner's dilemma / prisoners dilemma | prisoner dilemma |

**不做**完整 Porter，也不引入 NLP 库。不把毫无共同词根的近义（`leverage` vs `advantage`）算重复。

写入历史时仍存展示原文（小写 trim）；匹配与「是否已推过」一律看 stem。同一 stem 已在窗口内则不再写入第二条。

排除名单传给 LLM 时带原文即可；服务端硬过滤以 stem 为准。

---

## 7. 普通词拒绝名单（仅唤醒硬过滤）

至少拒绝（含词形）：`model`, `modeling`, `modelling`, `agenda`, `deadline`, `meeting`, `email`, `discuss`, `discussion`。

破绽路径不使用此名单。

---

## 8. 当日跨模块排除（3B）

新增只读收集，不改长文/精听生成逻辑：

- `daily_extracted_articles`：`user_id` + 当日 `quota_date` 的 `words_json`（及短语若存在则一并排除，避免「上下词条」撞短语）
- `daily_listen_articles`：`user_id` + 当日 `pack_date` 的 `vocab_json` / `phrases_json`

条目形状兼容 `string` / `{word}` / `{text}` / `{term}` / `{phrase}`。  
比较用 §6 词形键。仅读**当日**，不回溯历史长文/精听（30 天池仍只来自 `pushed_vocab_history`）。

破绽生成会**间接受益**（排除名单变强），但目标数 6 与补齐策略不变。

---

## 9. 唤醒关闭旧词补齐

`generateVocabWithDedupe` 增加开关，例如 `allowBackfill`：

- 唤醒：`allowBackfill = false`，`targetCount = 5`。不足则重试 1 次后原样返回。
- 破绽：`allowBackfill = true`（默认），行为与现网一致。

不足 5 时的提示（复用 `wakeup._dedupeNotice`，可换文案）：

> 今日合格新词不足，已按不重复原则少推，未用旧词凑数。

前端已有 notice 展示位，只改文案来源，不改布局。

---

## 10. 文件清单

| 角色 | 路径 | 改动 |
|---|---|---|
| 主改 | `vocab-server/services/dailyPackService.js` | 目标数 5；stem；当日长文/精听排除；唤醒关补齐；3+2 软校验；普通词拒绝 |
| 主改 | `yml/time_base/english_wakeup_routine.yml` | 去掉「恰好 10 / 商务高频词」；改为最多 5 = 3+2；宁缺毋滥 |
| 文案 | `src/components/modules/DailyWakeupModule.tsx` | 「10 个高频词发音注意点」改为随数量/3+2 的标题，如「今日主题专业词（3+2）」 |
| 测试 | `vocab-server/tests/vocabDedupePipeline.test.js` | 唤醒期望从 10 改为 ≤5 且不再要求补齐到满额 |
| 测试 | 新增或扩写用例 | 词形、3+2、当日长文/精听排除、唤醒不补齐、破绽仍 6 |

不改：`DailyErrorVocabularyModule.tsx`、长文/精听生成、`/api/daily-pack/today` SLA、`input_signature` 算法、生词本收录逻辑。

Dify 线上工作流需在改 YAML 后导入/同步，否则 LLM 仍可能吐 10 个高频词；服务端硬截断与过滤仍保证不超过 5、不含已拒词。

---

## 11. 非目标

- 不做「历史推送词」管理界面
- 不做词库后台配置页（词库写在服务端常量即可）
- 不改破绽 Prompt、数量、补齐
- 不改打卡 / TTS / 语法复健结构
- 不引入 stem 库或新 npm 依赖

---

## 12. 测试计划（一次一个功能，本规格对应唤醒质量）

| # | 菜单路径 | 测试数据 | 预期 | 对应需求 |
|---|---|---|---|---|
| 1 | 英语 → 每日唤醒 → 生成/刷新 | 主题「商务谈判」 | ≤5 词；结构为 3 主题专业 + 2 博弈/逻辑（不足则更少）；无 modeling/agenda | 减量 + 3+2 |
| 2 | 同上，连续刷新 2 次 | 上一批含 negotiate | 下一批不得出现 negotiate / negotiation / negotiating | 词形去重 |
| 3 | 先有当日长文/精听含 butterfly effect | 再生成唤醒 | 唤醒不得再出 butterfly effect / butterfly effects | 3B 跨模块 |
| 4 | mock LLM 只返回已推送词/普通词 | — | 唤醒 <5 且无旧词补齐；有少推提示 | 4A |
| 5 | 英语 → 每日破绽词汇 | 任意主题 | 仍 6 词；补齐逻辑仍在 | 破绽不动 |
| 6 | `GET /api/daily-pack/today` | 已有缓存 | 不触发同步 LLM；`dailyPackTodaySla.test.js` 仍通过 | SLA |

---

## 13. 覆盖的旧约束

| 旧规格（dedupe-refresh-vocab） | 本规格 |
|---|---|
| 唤醒恰好 10 词 | 唤醒最多 5（3+2） |
| 不够用最久旧词凑满 | 仅破绽仍凑；唤醒不凑 |
| 不改 Dify 工作流 | 必须改唤醒 YAML |
| 去重不做词形还原 | 必须做轻量 stem（含 negotiate/negotiation） |
