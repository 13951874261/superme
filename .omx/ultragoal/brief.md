# Brief: 收录分区选择 + Cambridge/Dify 数据源分工

> Deep-interview crystallized spec. Requirements source of truth for handoff. Do not re-interview by default.

- Spec: `.omx/specs/deep-interview-vocab-zone-cambridge-collect.md`
- Context: `.omx/context/vocab-zone-cambridge-collect-20260830T085200Z.md`
- Transcript: `.omx/interviews/vocab-zone-cambridge-collect-20260830T090000Z.md`

## Intent

1. 分区由用户决定，不再硬编码或按主题自动推断。
2. 单词入库与词典面板一致：英汉双向 Cambridge 优先，Dify 补缺。
3. 短语/句型收录时走 `en_zh_bidirectional` dict-query 纯 Dify 同步路径。

## In-Scope

- 全部收录入口双按钮：「+ 政商务」「+ 全场景」
- `useVocabCollect` 传 `category`；3 秒竞速 / 任务中心同样传 category
- 单词：`buildVocabPayloadFromDict` + Cam merge
- 短语/句型：dict-query `en_zh_bidirectional`（不走 Cambridge）
- migrate-on-click：已收录点另一分区 = 改 `category`，不新建行
- 收录中：被点按钮 collecting+disabled；另一按钮 idle，点击仅提示稍候

## Out-of-Scope

- 卡片整体布局/配色 redesign
- 数据库表结构变更
- 额度逻辑、矩阵/SOP/记忆节点逻辑
- 历史词条批量迁移
- Dify 工作流 prompt 调优

## Acceptance (must hold)

- AC-1 全入口双按钮
- AC-2 Grid 单词 Cam 对齐词典页
- AC-3 短语/句型纯 Dify
- AC-4 直接迁移无确认框
- AC-6 收录中另一按钮仅提示稍候
- AC-5 3 秒 handoff / 额度 / 历史不批量改写
