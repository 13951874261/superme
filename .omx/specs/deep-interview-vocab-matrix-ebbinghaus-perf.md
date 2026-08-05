# Deep Interview Spec: 词汇矩阵 × 艾宾浩斯 无损性能优化

## Metadata

| Field | Value |
|-------|--------|
| Profile | standard |
| Rounds | 5 |
| Final ambiguity | ~0.08 |
| Threshold | 0.20 |
| Context type | brownfield |
| Context snapshot | `.omx/context/vocab-matrix-ebbinghaus-perf-20260805T075500Z.md` |
| Transcript | `.omx/interviews/vocab-matrix-ebbinghaus-perf-20260805T080300Z.md` |

## Clarity breakdown

| Dimension | Score |
|-----------|-------|
| Intent | 0.92 |
| Outcome | 0.90 |
| Scope | 0.92 |
| Constraints | 0.90 |
| Success | 0.90 |
| Context | 0.88 |
| Ambiguity | ~0.08 |

## Intent

在约 5941/5939 词量级下，无损提升「词汇矩阵」响应与「艾宾浩斯生词本」展示一致性与可读性，并用 DB 索引支撑现有查询。

## Desired Outcome

1. 两侧「今日复习」**内容同源**（同一到期队列规则与数据）。
2. 毫秒级首屏（cache-first）；网络层轻量列表 + 索引。
3. 侧栏词条不再因 truncate 无法查看全文（悬停/点击展开）。
4. 不改变 SM-2 / 造句 / 翻转 / CSV 等既有功能语义。

## In-Scope

1. **过滤**：移除词汇矩阵进页强制 `onlyCurrentTheme`；今日复习**不按主题过滤**；保留政商务/全场景分区。
2. **同源数据**：侧栏与矩阵共用基于 `/api/vocab/review`（或等价轻量接口）的到期队列；stats 数字与列表一致。
3. **P3 性能**：session/memory cache-first；轻量字段列表（无巨大 payload）；按需取详情；侧栏虚拟滚动（可视窗口）。
4. **D2 UI**：保留单行；悬停或点击展开 word/音标/释义全文。
5. **索引**：为现有查询加索引，至少覆盖  
   `WHERE next_review_date <= ? AND repetitions < 999 ORDER BY next_review_date`  
   以及 list/stats 常用路径（如 `added_at`、`word COLLATE NOCASE` 视实现而定）。

## Out-of-Scope / Non-goals

1. 不做 GSAP 动画大改。
2. 不改 SM-2、造句评估、翻转跳过、CSV 导出逻辑（除数据源对齐的间接影响）。
3. 不把矩阵改成一次铺开 5939 张卡（仍一次一张，队列同源）。
4. 不强制主题过滤「修好后保留」。

## Decision Boundaries（助手可不经再确认）

1. 缓存 key、TTL、同步中角标文案。
2. 轻量 API 字段集合与按需详情接口形态（扩展现有或加 query 参数）。
3. 虚拟列表窗口大小、展开交互（hover vs click，移动端优先 click）。
4. 索引 DDL 具体列序与是否部分索引。
5. 请求超时（约 3–5s）与失败时保留缓存策略。

## Constraints

- 无损优化：功能语义不变。
- 数据量：~6k 词，~5939 到期（截图证据）。
- 生产 API：`/api/vocab/*`；DB：`vocab.db` SQLite WAL。

## Testable acceptance criteria

1. 进入词汇矩阵：有缓存时 **&lt;50ms** 出现卡片或明确空态，无永久「正在检查…」。
2. 侧栏「待复习/复习 N」与矩阵今日队列长度 **同源一致**（同分区下）。
3. 侧栏截断词可悬停或点击看到完整 word（及约定字段）。
4. `EXPLAIN QUERY PLAN` 对 `/review` 走索引（或等价验证）。
5. 造句/翻转/导出回归通过（抽测）。

## Assumptions + resolutions

| Item | Resolution |
|------|------------|
| 「内容一致」 | 同一到期队列，非矩阵铺开全列表 |
| 主题过滤 | 今日复习关闭；分区保留 |
| 显示不完整 | D2 展开，非默认全文换行 |
| 毫秒级 | P3 = cache + 轻量 + 索引 |

## Docs/Terminology

- 词汇矩阵 = English `vocab` tab（VocabTab）
- 艾宾浩斯生词本 = Sidebar `VocabularyBook`
- 今日复习 = `next_review_date <= now AND repetitions < 999`

## Technical findings

- `/list` 全量 `SELECT *` 是侧栏慢的主因之一。
- VocabTab 强制主题过滤导致与侧栏数量分裂。
- vocabulary 表缺 review 复合索引。

## Handoff

推荐：`$performance-goal` 或 `$ultragoal`（默认可追踪）；需架构评审用 `$ralplan`；直接落地用 `$autopilot` / 用户「执行」。
