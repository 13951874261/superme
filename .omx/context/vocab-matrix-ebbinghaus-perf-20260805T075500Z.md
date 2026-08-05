# Context Snapshot: vocab-matrix-ebbinghaus-perf

- Task statement: 无损优化词汇矩阵 Tab 响应性能，并与艾宾浩斯生词本展示一致；修复生词本内容显示不完整；评估按查询条件加 DB 索引。结合 gsap-performance / browser-test-analyzer / deep-interview。
- Desired outcome: 毫秒级可用首屏；两侧到期数量/复习入口一致；侧栏词条全文可读（或不因布局被截成 Fo...）；查询有索引支撑；不改变既有复习/SM-2/分区功能。
- Stated solution: 用户要求分析+深度访谈澄清，非立即改码。
- Probable intent hypothesis: 5941 词库下全量拉取与错误过滤导致矩阵卡顿/不一致，侧栏窄宽 + truncate 导致“显示不完整”。
- Known facts/evidence:
  - `[from-code][auto-confirmed]` VocabularyBook 调用 `getAllWords()`（`/api/vocab/list` = `SELECT * FROM vocabulary`），侧栏渲染列表并对 word/phonetic/释义使用 `truncate`。
  - `[from-code][auto-confirmed]` 截图：共 5941 词 / 5939 待复习；矩阵区曾显示「今日复习 2 词」——两侧数量不一致。
  - `[from-code][auto-confirmed]` VocabTab：`getReviewWords` + 强制 `onlyCurrentTheme`，过滤 `category === theme || payload.theme === theme`（category 与 theme 语义错位）。
  - `[from-code][auto-confirmed]` `/api/vocab/review`：`WHERE next_review_date <= ? AND repetitions < 999 ORDER BY next_review_date ASC`；未见 vocabulary 表上对应复合索引。
  - `[from-code][auto-confirmed]` `/api/vocab/stats` 单独 COUNT，侧栏数字可与矩阵列表不同源。
  - `[from-code]` gsap-performance：长列表应虚拟化/只动画可见项；本问题主因更像数据与布局，非 GSAP 动画。
- Constraints: 无损优化；AGENTS 中文确认优先；deep-interview 禁止直接实现。
- Unknowns: 「一致」指到期数量一致，还是列表内容完全同一数据源？「显示不完整」要去 truncate 全文，还是加宽/tooltip？索引是否本轮必做？
- Decision-boundary unknowns: 矩阵是否应直接复习 5939 条还是分页/队列化？侧栏是否仍全量 DOM？
- Likely touchpoints: VocabTab.tsx, VocabularyBook.tsx, vocabAPI.ts, vocab-server vocabulary schema/indexes
- Relevant docs: AGENTS.md; prior SWR 讨论; gsap-performance skill
- Terminology: 「词汇矩阵」= English vocab tab；「艾宾浩斯生词本」= Sidebar VocabularyBook
- Prompt-safe summary status: not_needed
