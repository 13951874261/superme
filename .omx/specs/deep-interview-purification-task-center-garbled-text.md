# Deep Interview Spec: 提纯任务中心乱码

## Metadata
- Profile: standard
- Rounds: 3
- Final ambiguity: ~0.18
- Threshold: 0.20
- Context type: brownfield

## Intent
修复「提纯任务中心 → 运行日志」及同源的后端中文乱码，根因是 `vocab-server/server.js` 源码中文字符串已损坏为字面量 `????`，而非运行时编码转换问题。

## Desired Outcome
- 新创建的后台任务（TTS / video / image-gen / material 等）在任务中心显示可读中文日志与任务名。
- `server.js` 中所有非注释的中文字符串恢复为正确 UTF-8 文本。

## In-Scope
- 以 `vocab-server/server_good_backup.js` 为对照，对 `vocab-server/server.js` 做 diff 恢复损坏中文。
- 重点覆盖所有 `taskQueue.createTask` / `taskQueue.updateTask(..., { logs: [...] })` 路径。
- 同步恢复同文件中 API `error` / `message` 等用户可见中文字符串。

## Out-of-Scope / Non-goals
- 不改前端 `TaskContext` 日志合并逻辑（轮询仍全量覆盖 `logs`）。
- 不清理服务器已持久化的 `tasks.json` 历史乱码。
- 不修改 `taskQueue.js`、`videoTranscriber.js` 等中文正常的文件。

## Decision Boundaries (OMX may decide)
- 以 `server_good_backup.js` 为准；backup 缺失的新增逻辑根据上下文补写中文。
- 注释中的 `????` 可不动。
- `console.log` 中的损坏中文优先级低于用户可见字符串。

## Constraints
- 最小 diff：只改字符串字面量，不重构任务队列架构。
- 保持现有 API 契约与任务类型不变。

## Acceptance Criteria
1. TTS 异步任务日志显示如「分块 28/33 已写入」，而非 `[timestamp] ????? 28/33 ???????`。
2. image-gen / video 任务名与日志为可读中文。
3. material 提纯与 listen 剧本路径日志保持正常中文。
4. `server.js` 中非注释代码行不再含 `????` 用户可见字符串（注释除外）。
5. 本地语法检查通过（`node --check vocab-server/server.js`）。

## Technical Findings

### 根因
`vocab-server/server.js` 文件编码损坏：部分 UTF-8 中文被替换为 ASCII `?`。JSON 传输与前端渲染链路正常。

### 任务中心数据流
```
后端 taskQueue.updateTask → tasks.json (UTF-8)
→ GET /api/tasks/:id → TaskContext 轮询覆盖 logs
→ GlobalTaskCenter 原样渲染
```

### 乱码热点（进入任务中心）
| 任务类型 | 日志来源 | 状态 |
|---------|---------|------|
| tts | server.js synthesizeAndSaveAudio + /api/tts/speech | 损坏（截图根因） |
| image-gen | server.js generate-image 异步块 | 损坏 |
| video | videoTranscriber.js 日志正常；server.js 任务名损坏 | 部分 |
| material (提纯) | server.js processMaterials 块 | 正常 |
| material (听力剧本) | server.js listen-gen 块 | 正常 |
| 初始日志 | taskQueue.createTask | 正常 |

### 前端临时日志（非根因，首轮轮询后被覆盖）
- ListenTab.tsx: 「音频已提交合成队列...」
- MaterialUploader.tsx: 「提纯任务已在后台建立...」

## Handoff
推荐 `$autopilot` 或 `$ultragoal` 执行 backup-diff 修复与验证。
