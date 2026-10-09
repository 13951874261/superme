# 精听盲听：Voice 口音 + 压力因素设计

**日期：** 2026-08-17  
**状态：** 已确认（待实现计划）  
**需求：** 职场场景 + 口音/打断/卡顿等压力（EN-LIS-03）

## 1. 目标

听力自动生成需支持：

1. **真实口音**：按所选 Edge TTS Voice 合成（如 `edge-tts/en-US-BrianNeural`），不再用 ffmpeg 变调伪装口音。
2. **国家展示**：从 Voice 配置归属国展示（复用 `VOICE_OPTIONS.country`，如 `Brian` → `美国 (US)`）。
3. **压力因素**：故意打断、网络卡顿、白噪丢包；页内由用户勾选；**每日 Cron 强制三开**。
4. **职场/通用对话场景**：沿用现有场景/题材选择（Meeting 等），本设计不重做剧本生成。

## 2. 已确认决策

| 项 | 决策 |
|---|---|
| 口音入口 | Voice 优先（方案 A） |
| 与 Header 全局音色 | 本页独立，不写 `super_agent_default_voice` |
| 旧口音下拉 | 删除，完全替换为 Voice 选择器 |
| 国家来源 | 配置表 `VOICE_OPTIONS.country`（方案 1，不运行时解析英文括号） |
| 压力实现 | 沿用现有 ffmpeg 后处理；去掉 rubberband 口音分支 |
| 范围 | 精听页自动生成 + 每日定时预生成 |
| Cron Voice | 用户服务端偏好中的最后精听 Voice；无记录兜底 `en-US-BrianNeural` |
| Cron 压力 | **强制** `interruptions` + `packet_loss` + `information_gap` 全开 |
| 页内压力 | 仍由用户勾选控制（不强制默认三开） |
| Voice 持久化 | 服务端用户偏好 `listen_voice_id`（选中即保存） |
| GSAP | 仅 Voice 选择器微动效（`useGSAP` + `scope`） |

## 3. 范围

### 3.1 范围内

- `ListenTab`：口音下拉 → 本页 Voice 选择器 + 国家旁注；压力三勾选保留。
- TTS：`model = edge-tts/{voiceId}`；`effects` 不再传 `accent`。
- 后端 `applyAudioEffects`：停用口音变调；保留打断/卡顿/白噪。
- `GET/PUT` 精听 Voice 偏好 API + SQLite 存储（对齐 `user_theme_prefs` 模式）。
- 每日预生成：读 prefs Voice + 强制三压力。
- 契约/验收测试对齐 EN-LIS-03。

### 3.2 范围外

- 不改 Header 全局音色行为。
- 不重做压力音效算法。
- 不从 `English (United States)` 字符串运行时解析国家。
- 不改上传音频主流程（可顺带忽略遗留 `effects.accent`）。
- 不重做 Dify 职场剧本生成逻辑。

## 4. 架构

```
[ListenTab]
  listenVoiceId (本页 state)     压力勾选 (用户)
         │                            │
         ├─ PUT /api/english/listen-prefs { voiceId }
         │
         ▼                            ▼
  model: edge-tts/{id}     effects: { interruptions?, packet_loss?, information_gap? }
         │                            │
         └──────────► POST /api/tts/speech
                           → TTS 合成
                           → applyAudioEffects(无 accent)
                           → audioUrl / taskId

[每日 Cron 预生成]
  voiceId = prefs.listen_voice_id || en-US-BrianNeural
  effects = { interruptions: true, packet_loss: true, information_gap: true }
         │
         ▼
  synthesizeAndSaveAudio(...) → daily_listen_audios
```

## 5. 前端

### 5.1 UI

自动生成模式下压力栏：

- 删除：标准/印度/英国/澳洲口音 `<select>`。
- 新增：本页 Voice 选择器（数据源 `src/config/voices.ts` 的 `VOICE_OPTIONS`）。
- 旁注：当前 Voice 的 `country`（例：`美国 (US)`）。
- 保留：故意打断 / 网络卡顿 / 白噪丢包 三个 checkbox。

默认 `listenVoiceId`：优先 `GET` 服务端偏好；否则 `en-US-BrianNeural`。

### 5.2 生成链路

- `buildListenTtsEffects()`：只返回压力布尔字段，**不含 `accent`**。
- `fetchDifyTTS(script, { isAsync, voiceId: listenVoiceId, effects })`。
- `hasActiveListenEffects`：改为「任一压力勾选为 true」（不再看口音）。
- 有压力时：保持现有「不写回带特效音频到干净缓存」策略。

### 5.3 GSAP（仅 Voice 选择器）

- 使用 `gsap` + `@gsap/react` 的 `useGSAP`，传入 `scope: pickerRef`。
- 动效：面板展开/收起、选中芯片高亮、国家标签淡入。
- 事件回调包 `contextSafe`；卸载自动 revert；不在 SSR 执行 gsap。
- 不给压力勾选区加 GSAP。

### 5.4 与 Header 隔离

- 选 Voice **不得**写入 `localStorage.super_agent_default_voice`。
- 不得派发会改变全局音色的副作用（除非仅本页预览且恢复原值——本需求可不做全局预览）。

## 6. 后端

### 6.1 TTS

- `/api/tts/speech`：继续接受 `model` + `effects`。
- 忽略遗留 `effects.accent`（兼容旧客户端）。
- `applyAudioEffects`：删除或永久跳过 rubberband 口音分支。
- 非法 `voiceId`：回退 `en-US-BrianNeural` 并打日志。

### 6.2 精听 Voice 偏好

对齐现有 `user_theme_prefs` 模式，新增表（名称实现时可微调，语义如下）：

```sql
CREATE TABLE IF NOT EXISTS user_listen_prefs (
  user_id TEXT PRIMARY KEY,
  listen_voice_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

API：

- `GET /api/english/listen-prefs` → `{ voiceId: string | null }`
- `PUT /api/english/listen-prefs` body `{ voiceId: string }`  
  - 校验：必须属于服务端允许的 Voice 列表（与前端 `VOICE_OPTIONS.id` 对齐）  
  - upsert 当前用户

写入时机：精听页 **选中 Voice 即 PUT**（不必等到生成）。

### 6.3 每日预生成

在 `dailyListenPreGenerateService`（及 `synthesizeAudioFile` 注入路径）中：

1. 读取该用户 `user_listen_prefs.listen_voice_id`；缺失则 `en-US-BrianNeural`。
2. `model = edge-tts/{voiceId}`。
3. 合成后（或合成管线内）应用 **强制三压力** effects。
4. 统一替换历史上不一致的默认音色（Emma/Ana 等）为上述 prefs/兜底逻辑。

数据流对比：

| 路径 | model | effects |
|------|--------|---------|
| 页内 Brian + 仅卡顿 | `edge-tts/en-US-BrianNeural` | `{ packet_loss: true }` |
| 页内 Neerja，压力全关 | `edge-tts/en-IN-NeerjaNeural` | 无/空 |
| 每日 Cron（有 prefs） | `edge-tts/{prefs}` | 三压力全开 |
| 每日 Cron（无 prefs） | `edge-tts/en-US-BrianNeural` | 三压力全开 |

## 7. 错误处理

- TTS/任务失败：沿用现有异步失败提示与降级文案。
- 偏好 PUT 失败：提示可重试；本页仍可用本地 state 完成本次生成，但 Cron 可能仍用旧/兜底 Voice。
- ffmpeg 压力失败：与现状一致（记录错误；尽量返回未特效音频或任务失败），本轮不重设计。

## 8. 测试与验收

### 8.1 成功标准

1. 精听页可选 Voice，旁注显示对应国家。
2. 生成口音随 Voice 变化（非变调）。
3. 页内勾选压力后，音频可感知对应效果。
4. Cron：Voice 来自 prefs（或 Brian 兜底）；压力强制三开。
5. Header 全局音色不被精听页改动。

### 8.2 自动化

- 契约测试（扩展现有 listen/TTS 相关测试）：
  - ListenTab 不再以旧四国口音下拉为唯一口音入口；引用 `VOICE_OPTIONS` / Voice 选择器。
  - effects 载荷不含 `accent`；`applyAudioEffects` 无口音 rubberband 分支。
  - prefs GET/PUT 存在且校验 voiceId。
  - 预生成路径使用 prefs Voice + 三压力（或断言调用参数）。

### 8.3 手工（EN-LIS-03）

| 项 | 内容 |
|---|---|
| 菜单路径 | 英语引擎 → 精听盲听 → 压力因素 / Voice |
| 测试数据 | Voice=`Neerja`；职场会议场景；勾选故意打断 + 网络卡顿；生成今日精听 |
| 预期 | 国家「印度 (IN)」；印度口音；可感知勾选压力；Header 音色不变 |
| 对应需求 | 职场场景 + 口音/打断/卡顿等压力 |

补充：

- 页内 Brian、压力全关 → 美音干净音频。
- 保存 Voice 后触发/检查 Cron 产物 → 口音随上次 Voice，且含三压力。

### 8.4 非目标回归

上传音频、剧本生成、任务中心异步进度行为不变。

## 9. 主要改动文件（预期）

- `src/components/modules/english/tabs/ListenTab.tsx`（+ 可选 `ListenVoicePicker.tsx`）
- `src/config/voices.ts`（复用，原则上不改结构）
- `src/services/ttsAPI.ts`、`src/services/listeningAPI.ts`
- `vocab-server/server.js`（TTS effects、listen-prefs 路由）
- `vocab-server/services/dailyListenPreGenerateService.js`
- 相关契约测试（如 `vocab-server/tests/listenUploadStress.test.js` 或新建）

## 10. 非目标与风险

- Cron 强制三压力会使预生成音频与「干净缓存」语义不同；页内有压力时本就不写干净缓存——保持该不变量。
- 用户从未打开精听页时 Cron 用 Brian + 三压力，属预期兜底。
- API Key / TTS 上游可用性不在本设计范围；沿用现有网关与本地 edge-tts 降级。
