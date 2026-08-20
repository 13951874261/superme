# 后台任务中心：展示优化 + 可删除日志

**日期：** 2026-08-20  
**状态：** 已批准；实现计划见 `docs/superpowers/plans/2026-08-20-task-center-ui-delete.md`  
**方案：** 方案一（前端展示优化 + 后端硬删）

## 1. 目标

1. **优化展示**：降低信息密度、加强状态/按钮视觉分层；**不改变**现有业务能力（查看详情、整次重新执行、重跑失败项、导入/下载/跳转、运行日志展开等）。
2. **新增删除**：支持删除后台任务中心日志（每日定时 cron runs + 普通后台任务）。
3. **排序**：合并列表按时间 **倒序**，最新在最上方。

## 2. 范围

### 2.1 纳入

- `src/components/GlobalTaskCenter.tsx` 布局与删除入口
- `src/components/TaskContext.tsx` 删除/清空/刷新状态
- `src/services/dailyCronAPI.ts` 删除相关客户端 API
- `vocab-server`：普通任务删除、`daily_cron` run 级联硬删、清空已结束

### 2.2 不纳入

- 取消正在运行的后端作业
- 删除业务产物（长文文件、音频、生词、手段库数据等）
- 软删除 / 回收站 / 可恢复
- 改动「查看详情 / 重跑 / 导入下载」等现有按钮语义

## 3. UI 设计

### 3.1 顶栏

- 标题「后台任务中心」、副标题保持不变
- 关闭按钮左侧增加「清空已结束」：
  - 仅当存在至少 1 条可删项时显示
  - 点击后 `confirm`：「将删除 N 条已结束记录，不可恢复。确定？」

### 3.2 每日定时卡片

- 标题区：图标 + 名称/日期 + 状态徽章 + 删除按钮（🗑）
- 元信息弱化：`triggerSource` + 截断 ID（悬停可看全 ID）
- 四模块统计改为等分小格（唤醒 / 破绽 / 长文 / 精听），突出完成比与失败数
- 状态色加强；「整次重新执行」保持主按钮视觉权重
- 现有按钮与详情展开逻辑不变

### 3.3 普通任务卡片

- 同样增加 🗑（规则同下）
- 疏朗间距、状态色分层
- 保留现有完成态操作与运行日志折叠

### 3.4 列表排序

- 合并 `[...cronRuns mapped, ...tasks]` 后按时间字段倒序
- 排序键：优先 `createdAt`，其次 `updatedAt` / `completedAt`；皆无则排后
- 普通任务与 cron run 均已具备 `createdAt`（服务端）；前端 TaskItem 类型需补齐该字段以便排序
- 同时间戳保持稳定顺序

## 4. 删除规则

| 操作 | 允许状态 | 确认 |
|------|----------|------|
| 单条删除 | `completed` / `failed` / `partial_failed` | 无 confirm，直接删 |
| 单条删除 | `pending` / `running` | 按钮禁用 |
| 清空已结束 | 所有可删的已结束项 | 二次 confirm |

删除对象仅为任务中心日志记录，不触及业务产物。

## 5. API 设计

### 5.1 `DELETE /api/tasks/:taskId`

- 不存在 → `404`
- `pending` / `running` → `409`
- 成功 → 从 `taskQueue` / `tasks.json` 移除，返回 `{ success: true }`

### 5.2 `DELETE /api/daily-cron/runs/:runId?userId=...`

- 校验 run 归属 `userId`
- `pending` / `running` → `409`
- 成功 → 级联删除该 run 的 `daily_cron_log_events`、`daily_cron_steps`、`daily_cron_runs`（对齐现有 `cleanupOldCronRuns` 删除顺序）
- 返回 `{ success: true }`

### 5.3 清空已结束

- `POST /api/tasks/clear-finished`：删除队列中全部已结束普通任务（与现有 `GET /api/tasks` 同范围，不做 per-user 过滤）
- `POST /api/daily-cron/runs/clear-finished`（body/query 带 `userId`）：删除该用户全部已结束 cron runs（级联）
- 前端「清空已结束」并行调用二者，再刷新列表
- 部分失败时提示成功/失败条数，并刷新保留未删项
- `N` = 清空前可删条数（cron 可删 + 普通任务可删）之和

### 5.4 客户端

- `dailyCronAPI.ts`：`deleteDailyCronRun`、`clearFinishedDailyCronRuns`
- `TaskContext`：`deleteTask`、`deleteCronRun`、`clearFinished`；删成功后更新本地 state

## 6. 错误处理

| 情况 | 行为 |
|------|------|
| 网络 / 5xx | 提示失败；不乐观移除 |
| 404 | 视为成功：从列表移除并刷新 |
| 409 | 提示「进行中的任务不能删除」并刷新 |
| 清空部分失败 | 提示成功/失败条数并刷新 |
| 删除进行中 | 对应按钮 loading，防连点 |

## 7. 验收标准

1. 最新记录在列表最上方（时间倒序）
2. 已结束卡片可直接删除，刷新后不再出现
3. 排队中 / 处理中垃圾桶禁用
4. 「清空已结束」需 confirm；确认后两类已结束记录清空
5. 展示优化后，详情 / 重跑 / 导入下载等行为与改前一致
6. 删除日志不删除对应业务产物

## 8. 主要改动文件（预期）

- `src/components/GlobalTaskCenter.tsx`
- `src/components/TaskContext.tsx`
- `src/services/dailyCronAPI.ts`
- `vocab-server/server.js`（路由）
- `vocab-server/services/taskQueue.js`（新增 `deleteTask` / `clearFinishedTasks`）
- `vocab-server/services/dailyCronRunService.js`（新增单条删除与 `clearFinishedRunsForUser`）
- 对应最小单测（服务层删除与状态守卫）

## 9. 决策记录

- 删除范围：cron + 普通任务（选项 C）
- 确认方式：单条直接删；清空才 confirm（选项 C）
- 进行中：不可删（选项 A）
- 展示：降密度 + 视觉分层（选项 C）
- 实现：后端硬删（方案一）
- 排序：时间倒序，最新在上
