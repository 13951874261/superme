# 生图接口替换为 9router /v1/images/generations 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目中“生成记忆图片”链路的外部生图接口由当前的 Dify `chat-messages` 工作流调用，统一替换为 `https://9router.234124123.xyz/v1/images/generations`，并按指定的 5 个模型依次轮换调用，直到任一模型成功返回图片为止；如全部失败则任务标记失败。前端接口形态、组件交互、业务返回字段保持不变。

**Architecture:** 复用现有“前端 → 项目后端 `/api/vocab/generate-image/:id` → 第三方生图服务”的链路。仅替换后端 `vocab-server/server.js` 中实际调用第三方服务的代码段：使用新的 9router 端点和 OpenAI 风格的 Images Generations 协议，按用户给定的请求体字段调用，并按顺序故障转移轮换 5 个模型。根据用户提供的实际响应，主解析路径精确读取 `data[0].url`，将该 URL 写入 `memory_aids.image_url` 后由现有前端 `<img src={memoryAids.image_url}>` 自动预览；同时保留 `data[0].b64_json` 等兼容兜底。前端 `MemoryAidPanel.tsx`、`vocabAPI.ts.generateMemoryImage()` 不改动。

**Tech Stack:** Node.js (vocab-server), Express, fetch (Node 18+ 全局 fetch), 现有 `taskQueue` 服务；前端 React + TypeScript（本次不改动）。

---

## 0. 现状梳理（只读，不产生变更）

**Files:**
- Read: `src/components/MemoryAidPanel.tsx`
- Read: `src/services/vocabAPI.ts:307`（`generateMemoryImage`）
- Read: `vocab-server/server.js:1592-1754`（`/api/vocab/generate-image/:id`）
- Read: `vocab-server/.env`（已存在 `DIFY_TEXT2IMAGE_API_KEY`，本次会新增 9router 配置项）

链路结论（已通过代码核对）：
- 前端唯一调用入口：`src/services/vocabAPI.ts -> generateMemoryImage(id)`，被 `MemoryAidPanel.tsx` 内部使用，且 `MemoryAidPanel` 在 `RightPanel.tsx` / `VocabularyBook.tsx` / `modules/english/tabs/VocabTab.tsx` 三处被引用。前端不直接调用任何外部生图服务。
- 外部生图服务调用集中在 `vocab-server/server.js` 的 `app.post('/api/vocab/generate-image/:id', ...)` 内的 `setImmediate` 异步任务里，是本次唯一需要修改外部接口调用的位置。

> 本步骤仅做心智核对；不需要改动任何代码。

- [ ] **Step 0.1:** 复核上述 4 个文件的现状与本计划描述一致，确认本次唯一修改点是 `vocab-server/server.js:1616-1748` 这一段 `setImmediate(async () => { ... })` 内部的外部 HTTP 调用与响应解析。

---

## 1. 新增 9router 生图接口配置项（环境变量）

**Files:**
- Modify: `vocab-server/.env`（新增 3 个变量）
- Modify: `vocab-server/server.js`（仅在 `/api/vocab/generate-image/:id` 内读取）

**约定的新配置项：**
- `IMAGE_GEN_BASE_URL`，默认 `https://9router.234124123.xyz/v1`
- `IMAGE_GEN_API_KEY`，默认 `sk-899c9c34738f61b5-2u53op-6ed8a313`（与用户给出的 curl 一致；后续可通过 `.env` 覆盖）
- `IMAGE_GEN_MODELS`，默认 `cf/@cf/black-forest-labs/flux-2-klein-9b,nb/nanobanana-flash,fal/fal-ai/flux/schnell,stability/stable-image-ultra,runway/gen4_image`（顺序即轮换顺序）

**注意：**
- 不删除/不改名旧的 `DIFY_TEXT2IMAGE_API_KEY` / `DIFY_TEXT2IMAGE_BASE_URL`，保持仓库其余对 Dify 的引用稳定，仅在生图代码段改为读取新的 `IMAGE_GEN_*`。
- 新接口的 Bearer Token 写入 `.env`，避免硬编码生产凭据。

- [ ] **Step 1.1:** 在 `vocab-server/.env` 中新增：
  ```env
  # 9router Images Generations
  IMAGE_GEN_BASE_URL=https://9router.234124123.xyz/v1
  IMAGE_GEN_API_KEY=sk-899c9c34738f61b5-2u53op-6ed8a313
  IMAGE_GEN_MODELS=cf/@cf/black-forest-labs/flux-2-klein-9b,nb/nanobanana-flash,fal/fal-ai/flux/schnell,stability/stable-image-ultra,runway/gen4_image
  ```

- [ ] **Step 1.2:** 不改动其它 .env 内容，确认 `dotenv` 在 `vocab-server` 启动入口已经加载（基于现有代码 `process.env.DIFY_TEXT2IMAGE_API_KEY` 可正常读取，可推断已加载）。本步骤为只读复核，不需要改动文件。

---

## 2. 替换外部生图调用为 9router /v1/images/generations，按顺序故障转移轮换模型

**Files:**
- Modify: `vocab-server/server.js`（仅 `app.post('/api/vocab/generate-image/:id', ...)` 内部 `setImmediate` 异步段落，约第 1616–1748 行）

**精确范围：**
- 起：`taskQueue.updateTask(task.id, { status: 'running', logs: ['开始调用 Dify text2image 模型'] });`
- 止：`taskQueue.updateTask(task.id, { status: 'completed', result: {...}, logs: ['图片生成与入库完成'] });` 之前的所有调用与解析代码。
- 保留：`/api/vocab/generate-image/:id` 路由、taskQueue 创建/返回 taskId、`memoryAids.image_prompt` 校验、最终把 `imageUrl/downloadUrl` 写回数据库、`taskQueue.updateTask({ status: 'completed', result: { id, image_url, download_url }, ... })` 这段“收尾逻辑”。
- 保留：`Fallback to synchronous` 那段最外层的同步返回逻辑（实际上这段在前端 `generateMemoryImage` 里会走轮询 taskId，本次不改）。

**新调用形态（每个模型一次尝试）：**
```js
// 伪代码示意
const resp = await fetch(`${baseUrl}/images/generations`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model,
    prompt: memoryAids.image_prompt,
    n: 1,
    size: 'auto',
    quality: 'auto',
    background: 'auto',
    image_detail: 'high',
    output_format: 'png',
  }),
});
```

**响应解析顺序（命中即返回该 URL，未命中尝试下一种）：**
1. `data.data[0].url`（用户提供的实际 9router 响应主路径；若命中，直接作为 `imageUrl` 与 `downloadUrl`）
2. `data.data[0].b64_json`：转为 `data:image/png;base64,<...>` 形式作为 `imageUrl`，`downloadUrl` 同值
3. `data.data[0].revised_prompt`：仅作为调试日志可选记录，不参与主业务字段返回
4. `data.url`、`data.image_url`、`data.preview`（少数兼容实现的扁平字段）
5. 兜底：复用现有的“正则提取 https URL”逻辑（保留）

**轮换与故障转移逻辑：**
- 从 `IMAGE_GEN_MODELS` 解析出模型数组（去空白、去空字符串）。
- 按数组顺序依次请求：
  - 收到 `resp.ok === true` 且能解析出 `imageUrl`：视为成功，停止后续尝试，进入入库与 `taskQueue.updateTask({ status: 'completed', ... })`。
  - HTTP 非 2xx 或解析不到图片 URL：记录此模型的失败原因到日志，并尝试下一个模型。
- 全部模型尝试完成仍未成功：
  - `taskQueue.updateTask({ status: 'failed', error: \`所有生图模型均失败：${lastErrorSummary}\` })`，与现有失败语义保持一致。

**日志：**
- 每次尝试输出：`[generate-image] try model=<model> ...`
- 成功：`[generate-image] success model=<model> url=<imageUrl>`
- 失败：`[generate-image] model <model> failed: <reason>`
- 全部失败：`[generate-image] all models failed`

- [ ] **Step 2.1:** 在 `vocab-server/server.js` 顶部已有的常量/工具区附近，新增（或就近）一个本文件作用域的辅助函数 `tryGenerateImageOnce(baseUrl, apiKey, model, prompt)`，封装“单模型一次请求 + 响应解析 + 返回 `{ ok, imageUrl, downloadUrl, error }`”。仅供 `/api/vocab/generate-image/:id` 内部使用，不导出，避免影响现有模块结构。

- [ ] **Step 2.2:** 替换 `setImmediate` 内的外部调用段：
  - 读取 `IMAGE_GEN_BASE_URL`、`IMAGE_GEN_API_KEY`、`IMAGE_GEN_MODELS`（解析为数组）。
  - `for (const model of models) { const r = await tryGenerateImageOnce(...); if (r.ok) { imageUrl = r.imageUrl; downloadUrl = r.downloadUrl; break; } else { lastError = r.error; } }`
  - 维持后续“写入数据库 + `taskQueue.updateTask({ status: 'completed', result, logs })`”原样不动。
  - 全部失败则走 `taskQueue.updateTask({ status: 'failed', error })`。

- [ ] **Step 2.3:** 修改紧邻日志：
  - `taskQueue.updateTask(task.id, { status: 'running', logs: ['开始调用 9router /v1/images/generations 模型'] });`
  - 移除/改写所有“Dify text2image”相关字样，避免误导（不动其它接口的 Dify 引用）。

- [ ] **Step 2.4:** 单点验证（不改其它代码）：
  - 在已生成 `image_prompt` 的某条 vocabulary 记录上，调用 `POST /api/vocab/generate-image/:id`，观察 taskId 进度日志：第一个模型若失败应自动尝试下一个；若第一个就成功则不会尝试后续模型。
  - 数据库 `memory_aids.image_url` 与 `download_url` 写入正常；前端 `MemoryAidPanel` 自动展示图片（`<img src={memoryAids.image_url}>` 直接渲染 9router 返回的 `data[0].url`）。

---

## 3. 不改动前端，但通读校验前端兼容性

**Files:**
- Read-only: `src/services/vocabAPI.ts:307-335`、`src/components/MemoryAidPanel.tsx`

**校验点：**
- 后端响应字段未变：`{ success, taskId }`（首次响应）+ `/api/tasks/:taskId` 完成后 `{ status: 'completed', result: { id, image_url, download_url } }`。
- 前端 `generateMemoryImage` 仍然依赖 `image_url` 与 `download_url` 字段，本计划严格保留。
- 用户提供的 9router 实际响应中图片地址为 `data[0].url`，后端会把该地址写入 `image_url`；`MemoryAidPanel.tsx` 中 `<img src={memoryAids.image_url} />` 会直接用该 URL 进行图片预览。
- `MemoryAidPanel.tsx` 中 `<img src={memoryAids.image_url} />` 在“返回 base64 data URL”的兜底情况下也能直接显示（浏览器原生支持 `data:image/png;base64,...`）。

- [ ] **Step 3.1:** 通读上述前端文件，确认本次后端改动不会破坏任何前端字段假设；不修改任何前端文件。

---

## 4. 自测用例（功能验证）

> 验证全部通过后，给出对应需求与菜单路径，便于回归。

**用例 A：首个模型即成功**
- 菜单路径：英语词汇模块 → 进入任意词汇详情页 → 记忆辅助卡片 → “生成记忆图片”。
- 前置：该词条已有 `memory_aids.image_prompt`。
- 测试数据：默认 `IMAGE_GEN_MODELS` 顺序。
- 预期：后端日志显示第一个模型 `cf/@cf/black-forest-labs/flux-2-klein-9b` 成功返回；前端面板出现图片；`memory_aids.image_url` 入库；`download_url` 入库。
- 对应需求：将“所有页面调用的生成图片接口”切换到 9router 新接口。

**用例 B：前 N 个模型失败，后续模型成功（顺序故障转移）**
- 临时把 `IMAGE_GEN_MODELS` 第一个改成不存在的模型字符串（如 `cf/__not_exist__`），其它保留。
- 预期：日志依次报告前一个/前 N 个失败原因，最终某个模型成功；前端图片正常出现。
- 对应需求：依次轮换调用直到成功为止。

**用例 C：全部模型失败**
- 临时把 `IMAGE_GEN_API_KEY` 改成无效值。
- 预期：日志显示所有模型均失败；taskQueue 任务状态为 `failed`；前端 `MemoryAidPanel` 弹出错误提示（已有 `setError` 兜底）。
- 对应需求：失败兜底符合“依次轮换直到成功为止；全部失败则失败”。

**用例 D：缺少 `image_prompt`**
- 选择一条尚未生成 `memory_aids` 的词条，直接点击“生成记忆图片”。
- 预期：保持现有行为，HTTP 400 “No image_prompt found, please generate memory aids first”。
- 对应需求：保留既有前置校验，不引入新副作用。

- [ ] **Step 4.1:** 按用例 A → D 顺序在本机或测试环境逐项验证；记录每次实际响应、对应的 model、是否进入故障转移。

---

## 5. 收尾

- [ ] **Step 5.1:** 检查 `vocab-server/server.js` 仅修改了第 1592–1754 行内部以及（如有需要）顶部的小型工具函数声明区域，未影响其它路由。
- [ ] **Step 5.2:** 检查 `vocab-server/.env` 仅追加 3 行新变量，未删除或修改其它项。
- [ ] **Step 5.3:** 不修改任何前端文件、不修改任何文档/yml 文件。

---

## 风险与边界说明

- 9router 端点是否对所有 5 个模型都接受相同的 `n / size / quality / background / image_detail / output_format` 参数尚不能 100% 确定；本计划严格按用户提供的 curl 字段直传。如某个模型对某些参数报错，将作为该模型的失败计入故障转移日志，由下一个模型继续尝试，整体行为符合“依次轮换直到成功为止”的需求。
- 仅修改后端调用层，前端接口契约不变，最大限度避免对其它页面造成影响。
