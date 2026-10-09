# GT-TAC-视频 驭人术资料异步提炼设计

> **状态**：设计已批准（方案 1 · 统一 `tactics_ingest`）；实现计划见 `docs/superpowers/plans/2026-08-17-gt-tac-video.md`；**尚未改产品代码**。  
> **日期**：2026-08-17  
> **关联**：`docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`（GT-TAC-视频）  
> **方案**：文档与视频统一异步任务；视频 keep + 旁路生词本；可播 + 可看转写；≤200MB / ≤30 分钟

---

## 1. 目标与非目标

### 目标

1. 驭人术本机上传 **PDF / TXT / MD / 视频** → **任务中心异步**提炼手段并入库。  
2. 视频：转写 + 抽手段 + **可回看（播放）** + **可看转写全文**。  
3. 限额：体积 **≤200MB**，时长 **≤30 分钟**（超限失败并提示）。  
4. 手段库 UI 能关联打开媒体抽屉（播放器 + 转写）。

### 非目标

- 不做「仅 URL、不落盘」。  
- 不把主路径并入资料抽屉 `material` / XF-FEED。  
- 不改变英语 Dashboard 默认 `video` → 生词本行为（共享转写函数用 mode 旁路）。  
- 本轮不强制原生 `.xlsx`（导出已另项覆盖）。

---

## 2. 架构

```
[TacticsPanel 上传弹窗]
  accept: .pdf,.txt,.md,.text + video/*
        ↓
POST /api/game-theory/tactics/ingest-background  (multipart)
        ↓
落盘：
  文档 → 临时缓冲读文本 / 可短存
  视频 → /var/.../tactics_media/{userId}/{uuid}.ext（永久，相对项目 public）
        ↓
createTask('tactics_ingest') → 立即 res.json({ taskId })
        ↓
setImmediate 后台：
  若视频：ffprobe 校验时长 → 转写（videoTranscriber mode: keepVideo, skipVocab）
  若文档：现有 PDF/TXT 抽文本
        ↓
extractTacticsFromText（从现 upload-tactics-material 抽出）
        ↓
INSERT game_theory_tactics（带 media_id 可空）
INSERT/UPDATE game_theory_tactics_media（视频）
        ↓
task.result = { inserted, tacticIds, mediaId?, videoUrl?, transcript?, sourceName }
```

前端：`addTask` + toast；完成事件刷新手段列表；任务中心提供回看/转写入口。

---

## 3. 数据契约

### 3.1 新表 `game_theory_tactics_media`

| 列 | 说明 |
| --- | --- |
| `id` | UUID |
| `user_id` | 所属用户 |
| `task_id` | 来源任务 |
| `file_path` | 服务器绝对或相对路径 |
| `public_url` | 如 `/api/tactics_media/{id}/file` |
| `transcript` | 转写全文 |
| `duration_sec` | 秒 |
| `source_name` | 原文件名 |
| `created_at` | ms |

### 3.2 手段表扩展

- `game_theory_tactics` 增加可空 `media_id`（TEXT），指向上表。  
- 保留 `source_file`（文件名或 `video:{mediaId}` 兼容展示）。  
- 同批多条手段共享同一 `media_id`。

### 3.3 限额常量

| 常量 | 值 |
| --- | --- |
| `TACTICS_INGEST_MAX_MB` | 200 |
| `TACTICS_INGEST_MAX_MINUTES` | 30 |

---

## 4. API / 任务

| 能力 | 说明 |
| --- | --- |
| `POST /api/game-theory/tactics/ingest-background` | multipart `file` + `userId`；返回 `{ taskId }` |
| `GET /api/tactics_media/:id/file` | 鉴权后流式返回视频（owner 校验） |
| `GET /api/tactics_media/:id` | 返回元数据 + transcript（owner） |
| 现有同步 `upload-tactics-material` | 可保留兼容，或内部转调异步；UI 默认只走 background |
| Task type | `tactics_ingest` |
| 转写 | 扩展 `videoTranscriber`：`{ keepVideo, skipVocab, outDir }`；英语默认不变 |

失败：体积/时长/转写/LLM 任一步失败 → `failed` + `error` 文案；已插入的手段不回滚强制要求（尽量事务：媒体+手段同批成功再 complete；失败不写半截媒体行）。

---

## 5. UI

| 位置 | 行为 |
| --- | --- |
| `TacticsPanel` 弹窗 | 支持视频 MIME；提交后进任务中心，不阻塞长转写 |
| `TaskContext` / `GlobalTaskCenter` | 识别 `tactics_ingest`；完成可「刷新手段库」「回看视频」「查看转写」 |
| 手段卡片 | 有 `media_id` 时显示「来源视频」入口 → 简易 Modal：`<video>` + 转写 `<pre>` |

---

## 6. 验收

| 场景 | 预期 |
| --- | --- |
| 上传 PDF/TXT | 立刻有 `tactics_ingest`；完成后手段增加；UI 可继续操作 |
| 上传合规视频 | 同上 + 可播 + 可看转写 |
| >200MB 或 >30min | 失败提示清晰 |
| 英语视频提纯 | 原 `video`→生词本路径不被破坏 |

---

## 7. 自检

- [x] 可回看 = 播视频 + 转写（批准 C）  
- [x] 限额 200MB / 30min（批准 A）  
- [x] 文档+视频均异步（批准 B）  
- [x] 方案 1 统一 ingest（批准）  
- [x] 非目标：无纯 URL、不并抽屉 material  
- [x] 无 TBD  

---

## 8. 下一步

用户审阅本 spec 无异议后，按 plan 执行（默认 **不 commit**，待用户说「开始实现」）。
