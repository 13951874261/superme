根据 `surgical-modification` 技能规范，以下为经评估完善后的「外科手术式修改计划」。  
**已确认约束：** 方案 A（后端代理调 Dify `/audio-to-text`）；Dify 失败时**不**保留 Whisper / 9router 轮询降级。  
该技能只输出计划模板及代码对比，**不直接执行物理文件写入**（待你确认后再改代码）。

依据 Dify 官方文档：[语音转文字](https://docs.dify.ai/zh/api-reference/audio/convert-audio-to-text)（`POST /audio-to-text`；`file` + `user`；Key **必须放服务端**）。

---

# Surgical Precision Modification Plan (外科手术式修改计划) — 方案 A 完善版

### 1. Problem Description (问题描述)
- **主要文件路径**：
  - `D:\cursor\work\super-agent\vocab-server\server.js`（约行 8065–8205）
  - `D:\cursor\work\super-agent\src\services\difyAPI.ts`（约行 2301–2325）
- **现象描述**：
  - 前端 `transcribeAudioWithWhisper` 请求本站 `/api/audio/transcriptions`，后端对 local Whisper / 9router 多模型轮询。
  - 目标改为：仅通过后端调用 Dify 官方 `POST /audio-to-text`，获得工作空间默认 STT 转写结果。
  - Dify 失败时直接返回错误，**不**回退 Whisper 轮询。
- **影响范围评估**：
  - 所有调用 `transcribeAudioWithWhisper` 的路径：`SpeakModule`、`ImpromptuSpeechTab`、`listeningAPI`。
  - 仍走 `/api/audio/transcriptions` 的其它调用方（含 `file_url` 下载再转写）一并改为只走 Dify。
  - **不**改 UI 布局；**不**改已有前端直连函数 `audioToText()`（发音纠正链路，仍用 `VITE_DIFY_STT_API_KEY`，本次范围外）。
- **能力边界说明**：Dify `/audio-to-text` 仅为语音转文字，本身不提供「纠错闭环」；若需纠错，应走其它工作流（本次不做）。

---

### 2. Improvement Plan (改进方案)
- **修改目标**：STT 唯一上游改为 Dify `/audio-to-text`；API Key 仅存服务端；前端去掉明文 Bearer。
- **实现步骤**：
  1. **服务端环境变量**：新增 `DIFY_STT_API_KEY`（值为指定的 App API Key）。`DIFY_API_BASE_URL` 沿用现有（默认 `https://dify.234124123.xyz/v1`）。
  2. **改造** `vocab-server/server.js` 的 `POST /api/audio/transcriptions`：
     - 保留：multipart 收文件、`file_url`/`fileUrl` 下载到临时文件、finally 清理临时文件。
     - 删除：`modelsToTry` 整段轮询（local whisper / groq / openai / aai / 9router）。
     - 新增：用服务端 Key 组 `FormData`（`file` + `user`）请求 ``${difyBase}/audio-to-text``；成功返回 `{ text }`；失败透传 Dify 状态码与错误体，**不降级**。
     - `user` 取自 `req.body.user`，缺省为 `'default-user'`。
     - 下载 `file_url` 时的 Authorization：优先用 `DIFY_STT_API_KEY`，去掉硬编码 `sk-899c9c...`。
  3. **改造** `difyAPI.ts` 的 `transcribeAudioWithWhisper`：
     - 继续请求 `/api/audio/transcriptions`（不直连 Dify）。
     - 删除前端硬编码 `Authorization: Bearer sk-...`。
     - `FormData` 增加 `user`；文件名按 `blob.type` 映射到官方允许扩展名（见下方 MIME 注意）。
     - 错误文案改为「语音转文字失败」，避免再写 Whisper。
  4. **不修改** `audioToText()`（行 1385 附近）；避免重复造轮子，但发音纠正直连链路留待后续单独治理。
- **注意事项（Dify 官方约束）**：
  - 接受 MIME：`audio/mp3`、`audio/m4a`、`audio/wav`、`audio/amr`、`audio/mpga`；`audio/mpeg`、常见浏览器 `audio/webm` 会 `415 unsupported_audio_type`。
  - 文件 ≤ 30 MB。
  - Key 禁止写入前端源码 / `VITE_*`（本方案符合官方「Key 放服务端」）。
  - 计划与代码中**不要**再粘贴明文 App Key；仅写入服务器 `.env`。

---

### 3. Files to Modify (待修改文件列表)
- **主要修改文件（后端）**：
  - `D:\cursor\work\super-agent\vocab-server\server.js`
- **次要修改文件（前端服务层）**：
  - `D:\cursor\work\super-agent\src\services\difyAPI.ts`
- **配置（部署侧，非仓库明文）**：
  - 服务器 / 本地 `vocab-server` 环境：`DIFY_STT_API_KEY=<指定 App Key>`
- **明确不改**：
  - UI 组件、`audioToText()`、`server_good_backup.js`、Whisper 相关测试脚本（除非另开任务）

---

### 4. File Names (涉及文件名)
- `server.js` — STT 中转：Whisper 轮询 → 仅 Dify `/audio-to-text`
- `difyAPI.ts` — `transcribeAudioWithWhisper`：去明文 Key、传 `user`、MIME 文件名映射

---

### 5. Reference Code (参考代码对比)

#### 5.1 前端 `difyAPI.ts`

```diff
@@ -2301,25 +2301,36 @@
 /**
- * 高精度语音转文字 (Whisper) 接口
+ * 语音转文字：经本站后端代理调用 Dify /audio-to-text（Key 仅存服务端）
  */
 export async function transcribeAudioWithWhisper(audioBlob: Blob, userId = getAppUserId()): Promise<string> {
+  const mime = (audioBlob.type || '').toLowerCase();
+  const extByMime: Record<string, string> = {
+    'audio/mp3': 'mp3',
+    'audio/mpeg': 'mp3', // 官方拒 audio/mpeg；扩展名用 mp3，仍可能 415，需录制端尽量产出允许类型
+    'audio/mpga': 'mpga',
+    'audio/m4a': 'm4a',
+    'audio/wav': 'wav',
+    'audio/wave': 'wav',
+    'audio/x-wav': 'wav',
+    'audio/amr': 'amr',
+  };
+  const ext = extByMime[mime] || 'mp3';
+
   const formData = new FormData();
-  // Whisper-1 接口强制要求传递 file 字段，格式这里转换为 mp3 规范以保障兼容性
-  formData.append('file', audioBlob, 'audio.mp3');
-  // 由后端中转接口轮询确定具体的模型与参数，这里仅作为原始文件流上传
+  formData.append('file', audioBlob, `audio.${ext}`);
+  formData.append('user', userId || 'default-user');
 
   const res = await fetch('/api/audio/transcriptions', {
     method: 'POST',
-    headers: {
-      'Authorization': 'Bearer sk-899c9c34738f61b5-2u53op-6ed8a313',
-    },
     body: formData,
   });
 
   if (!res.ok) {
     const errText = await res.text().catch(() => '');
-    throw new Error(`Whisper 语音转文字失败 (${res.status}): ${errText}`);
+    throw new Error(`语音转文字失败 (${res.status}): ${errText}`);
   }
 
   const data = await res.json().catch(() => ({}));
   return typeof data.text === 'string' ? data.text.trim() : '';
 }
```

#### 5.2 后端 `server.js`（核心：删除轮询，改为唯一 Dify 调用）

```diff
@@ -8065,10 +8065,14 @@
-// Whisper ... 9router ...
+// STT 中转：仅代理 Dify POST /audio-to-text（无 Whisper 降级）
 app.post('/api/audio/transcriptions', upload.any(), async (req, res) => {
   let fileObj = null;
   let tempFilePath = null;
 
   try {
     // ... 保留 file_url 下载 / multipart 取 file 逻辑 ...
+    const sttApiKey = process.env.DIFY_STT_API_KEY;
+    if (!sttApiKey) {
+      return res.status(500).json({ error: 'Server missing DIFY_STT_API_KEY' });
+    }
+    const difyBase = process.env.DIFY_API_BASE_URL
+      || process.env.VITE_DIFY_API_BASE_URL
+      || 'https://dify.234124123.xyz/v1';
+    const userId = (req.body && (req.body.user || req.body.userId)) || 'default-user';
 
-    // 下载 file_url 时：
-    headers: { 'Authorization': req.headers.authorization || 'Bearer sk-899c9c...' }
+    // 下载 file_url 时：
+    headers: { 'Authorization': `Bearer ${sttApiKey}` }
 
-    // 删除整段 modelsToTry 轮询（local/groq/openai/aai/9router）
+    const fileBuffer = fs.readFileSync(fileObj.path);
+    const mimeType = fileObj.mimetype || 'audio/mp3';
+    const originalName = fileObj.originalname || 'audio.mp3';
+
+    const formData = new globalThis.FormData();
+    const blob = new globalThis.Blob([fileBuffer], { type: mimeType });
+    formData.append('file', blob, originalName);
+    formData.append('user', String(userId));
+
+    const response = await fetch(`${difyBase}/audio-to-text`, {
+      method: 'POST',
+      headers: { 'Authorization': `Bearer ${sttApiKey}` },
+      body: formData,
+    });
+    const data = await response.json().catch(() => ({}));
+
+    if (!response.ok) {
+      console.error('[STT Dify] audio-to-text failed:', response.status, data);
+      return res.status(response.status).json(
+        typeof data === 'object' && data ? data : { error: 'Dify audio-to-text failed.' }
+      );
+    }
+
+    // 与前端约定：返回 { text }
+    return res.json({
+      text: typeof data.text === 'string' ? data.text : '',
+    });
   } catch (error) {
-    console.error('Whisper 中转失败:', error);
+    console.error('Dify STT 中转失败:', error);
     return res.status(500).json({ error: error.message });
   } finally {
     // ... 保留临时文件清理 ...
   }
 });
```

> 执行时应对 `server.js` 8065–8205 整段做精确替换，避免残留 `modelsToTry`。

---

### 6. UI/UX Modification Plan (UI/UX 修改说明)
- **视觉改变**：无。录音按钮、波形、上传态保持原样。
- **交互逻辑**：停止录制 → 上传 `/api/audio/transcriptions` → 后端调 Dify → 文本填入输入框。
- **失败体验**：Dify 报错时直接抛错/提示（如 `speech_to_text_disabled`、`unsupported_audio_type`、`401`），无静默降级到 Whisper。
- **无障碍 / 响应式**：无额外改动。

---

### 7. 验收标准与测试用例（完善增补）

| # | 菜单路径 | 测试数据 | 预期结果 | 对应需求 |
|---|---|---|---|---|
| 1 | 说模块 → 录音 → 停止 | 合法 `mp3`/`wav`/`m4a` 短音频 + 已配置 `DIFY_STT_API_KEY` | 输入框出现 Dify 返回的 `text` | A：代理 STT |
| 2 | 同上 | 故意清空服务端 `DIFY_STT_API_KEY` | HTTP 500，文案含 missing key；**不**出现 9router/Whisper 日志 | 无降级 |
| 3 | 同上 | 上传 `audio/webm`（若录制端产出） | Dify `415` 或明确失败；不轮询 Whisper | MIME 约束 |
| 4 | 即兴演讲 Tab → 录音提交 | 正常英文短句 | 转写文本进入后续评估链路 | 影响面覆盖 |
| 5 | 安全抽查 | 前端打包 / Network | 请求仅打本站 `/api/audio/...`；响应头/源码中**无** App Key | Key 服务端 |

**部署检查清单**：
1. 本机/服务器 `.env` 写入 `DIFY_STT_API_KEY`（勿提交仓库）。
2. 确认对应 Dify 应用已开启语音转文字，且工作空间默认 STT 模型可用。
3. `curl` 本机：`POST http://127.0.0.1:3001/api/audio/transcriptions`（multipart `file` + `user`）应返回 `{ "text": "..." }`。

---

### 8. 风险与后续（非本次必做）
- 浏览器默认 `MediaRecorder` 常为 `webm`：若线上大量 `415`，需另开任务做前端转码或改录制 MIME（本次仅做扩展名映射 + 失败提示）。
- 现存 `audioToText()` 仍把 `VITE_DIFY_STT_API_KEY` 暴露给浏览器，与官方安全要求不符；建议后续统一改为走本代理。
- 计划/历史聊天中曾出现明文 Key：上线前建议在 Dify 控制台**轮换**该 App Key。

---

**请确认：** 以上完善版计划是否符合预期？回复「同意」或「确认」后，再按此计划分步改代码（先后端，再前端，再验收用例 1）。
