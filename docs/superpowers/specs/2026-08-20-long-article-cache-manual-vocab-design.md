# 长文缓存命中 + 3 秒转后台 + 提取不自动进生词本

**日期：** 2026-08-20  
**状态：** 已批准；实现按 `docs/superpowers/plans/2026-08-20-long-article-cache-manual-vocab.md` 完成（待手工验收勾选）  
**方案：** 增强现有 `daily_extracted_articles`（选项 A）；前台手动与后台 cron 共用同一套逻辑

## 1. 目标

1. **缓存优先**：按当前用户 + 主题等条件查询，命中则直接展示长文及提取的生词 / 短语 / 句式。
2. **未命中不挡页**：从前台点击起算，超过 3 秒未成功则关遮罩、轻提示「已转入后台」，任务进入【任务中心】；完成后写入缓存供再查命中。
3. **提取 ≠ 入库**：长文提取结果只进展示缓存，**不自动写入生词本**；入库仅用户逐条收录并补齐矩阵。
4. **路径一致**：前台手动生成与后台自动生成（cron / daily pack）遵守同一套缓存写入与「不写生词本」规则。

## 2. 非目标

- 不新建独立展示缓存表（已选定增强 `daily_extracted_articles`）。
- 不改变逐条「+ 收录」的矩阵补齐语义（仍可走现有 3 秒收录竞速）。
- 不在本需求内改精听音频 owner 规则（`skipListenAudioSync` 等保持现状）。
- 不取消正在运行的 Dify 作业（仅 UI 解耦 + 任务中心可见）。

## 3. 现状问题（根因摘要）

| 问题 | 根因 |
|------|------|
| 全屏遮罩卡 15~30 秒 | `handleAutoGenerate` 持有 `isAutoGenerating`；`triggerEnglishMasteryExtraction` 无限轮询至完成 |
| 任务中心看不到长文任务 | 使用内存 `extractionTasks`，未进 `taskQueue` |
| 自动进生词本 | `runDailyExtractAsync` 对词/短语/句式 `INSERT INTO vocabulary` |
| 主题命中不稳 | 表 `UNIQUE(user_id, quota_date, genre, cefr_level)` **未含 theme/duration**，多主题可能互相覆盖 |

## 4. 数据与索引（选项 A）

### 4.1 表职责（不变）

`daily_extracted_articles` 作为「今日长文 + 展示用词表」唯一主缓存：

- `article`：长文正文  
- `words_json` / `phrases_json` / `sentences_json`：展示用提取结果  
- 维度：`user_id`、`quota_date`、`theme`、`genre`、`cefr_level`、`duration`、`input_signature`

### 4.2 Schema 修正（纳入本需求）

1. **调整唯一键**（与查询命中一致）：  
   `UNIQUE(user_id, quota_date, theme, genre, cefr_level, duration)`  
   - 迁移策略：新建唯一索引 / 重建约束；冲突行按 `updated_at` 保留最新。  
2. **新增查询索引**（示例命名，实现时可微调）：  
   - `idx_dea_user_date_dims`：`(user_id, quota_date, theme, genre, cefr_level, duration)`  
   - `idx_dea_user_date_sig`：`(user_id, quota_date, input_signature)`  
3. 前台精确查询与 cron 跳过「已生成」判断，均对齐上述维度（含 `theme`）。

### 4.3 写入规则（手动 = cron）

两条路径最终都调用同一套 daily-extract 落库逻辑：

1. 生成长文 + 提取词表 → **只** `INSERT OR REPLACE` 进 `daily_extracted_articles`。  
2. **删除/禁用** 对 `vocabulary` 的批量自动插入（词 / 短语 / 句式）。  
3. 响应中的 `wordsAddedCount` / `phrasesAddedCount` / `sentencesAddedCount` 对自动路径恒为 `0`（或字段废弃，前端文案改为「已缓存展示」）。  
4. **配额门禁**：今日词/短语入库配额仅约束「手动收录」；生成/提取路径**不再**因配额耗尽而拒绝生成长文（避免「配额满 → 无法刷长文」）。

## 5. 查询与交互流程

```
用户查询 / 点击「查询·生成」
        │
        ▼
按 user + date + theme + genre + cefr + duration
（或 input_signature）查 daily_extracted_articles
        │
   ┌────┴────┐
 命中       未命中
   │           │
   ▼           ▼
直接渲染     启动生成任务（taskQueue + 原 async worker）
长文+三列词表     │
不写生词本   ┌────┴────┐
           ≤3s 完成   >3s 未完成
              │           │
              ▼           ▼
           关 loading   关遮罩 + 轻提示「已转入后台」
           渲染结果     可继续操作；任务中心可见
                        完成后写缓存；再查命中
```

### 5.1 前台 3 秒竞速（对齐现有模式）

复用 `useVocabCollect` / 主题删除的竞速模式：

- 常量如 `DAILY_EXTRACT_RACE_MS = 3000`，计时从点击起。  
- `≤3s` 完成：正常关遮罩并展示。  
- `>3s`：`setIsAutoGenerating(false)`，`showNotice(..., '已转入后台')`，`addTask` 挂到【任务中心】，后台继续写缓存。  
- 去掉「预计 15~30 秒」阻塞文案依赖；遮罩仅短时反馈。

### 5.2 任务中心可见性

- `POST /api/english/daily-extract` 创建时同步 `taskQueue.createTask(...)`（类型如 `daily_extract`）。  
- worker 进度/完成/失败 `updateTask`；前端可轮询任务中心，不必死等私有 `extractionTasks`。  
- 可短期保留 `extractionTasks` 作兼容，但**以 taskQueue 为用户可见真源**；计划内尽量收敛到一套。

### 5.3 后台 cron

- 继续走 `generateLongArticleForUser` → `POST /api/english/daily-extract`。  
- 与手动相同：只写缓存、不写生词本、唯一键含 theme。  
- cron 本身无 UI 遮罩；产物供次日/随后前台命中。

## 6. 生词本路径（保持手动）

- 弹药库 `VocabularyGrid`「+ 收录」→ `useVocabCollect`（已有 3 秒转后台）。  
- 生成成功提示改为「长文与词表已缓存展示」，**不再**出现「入库 X 词 Y 短语」类自动入库话术（除非来自用户手动收录）。

## 7. 主要改动面（实现时）

| 层级 | 文件（预期） |
|------|----------------|
| Schema/索引 | `dailyListenPreGenerateService.initDailyListenTables` 或统一 migration；启动时 `CREATE INDEX IF NOT EXISTS` |
| 去自动入库 | `vocab-server/server.js` → `runDailyExtractAsync` |
| 任务中心 | `server.js` daily-extract 入口 + `taskQueue` |
| 前台竞速 | `difyAPI.triggerEnglishMasteryExtraction`、`DashboardTab.handleAutoGenerate` |
| 契约测试 | 新增/改：不写 vocabulary；3s 竞速常量；索引存在；命中维度含 theme |

## 8. 验收标准

1. 缓存命中：同用户同主题等条件，查询立即出长文 + 三列词表，生词本条数不变。  
2. 缓存未命中手动生成 >3s：遮罩关闭、轻提示、可操作；任务中心有任务；完成后缓存可命中。  
3. cron 生成后：仅 `daily_extracted_articles` 有数据；`vocabulary` 无「Daily Extract」批量新增。  
4. 用户逐条收录后：该条进入生词本且可补齐矩阵。  
5. 相关自动化测试通过。

## 9. 风险与注意

- **UNIQUE 迁移**：旧约束不含 theme，需数据清理或去重后再加新唯一键。  
- **配额文案**：前端大量「入库」提示需同步改，避免误导。  
- **双任务源**：迁移期注意 `extractionTasks` 与 `taskQueue` 状态一致，避免任务中心卡在 running。

## 10. 已锁定决策

- 范围 C：3 秒转后台 + 不自动写生词本。  
- 展示缓存选项 1；落点 **A**（增强 `daily_extracted_articles` + 索引）。  
- 计时从点击开始；超时关弹窗 + 轻提示。  
- 前台与后台自动生成同一套逻辑。
