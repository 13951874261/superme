# Context Snapshot: web-fetch-invalid-token

**Timestamp:** 20250721T150000Z  
**Task:** 分析 Deep-Interview Step 2「网页提取」报错 `Invalid or unexpected token`，并改为调用远程 `/v1/web/fetch` 接口。

## Task Statement
用户在「材料提纯 / 网页提取」粘贴 URL 后点击「预览网页内容」，界面显示红色错误：`Invalid or unexpected token`。用户提供了应使用的 curl 接口示例（`POST https://23.95.214.232/v1/web/fetch`，model=`fetch-combo`，format=`markdown`，max_characters=0）。

## Desired Outcome
网页提取预览成功返回 markdown 内容，可确认作为提纯材料。

## Stated Solution
后端应调用用户提供的 `/v1/web/fetch` API 获取网页 markdown。

## Probable Intent
修复网页提取链路，使生产/本地环境能稳定抓取外部 URL（如 federalreserve.gov）。

## Known Facts / Evidence [from-code][auto-confirmed]

### 报错根因（已验证）
- `node -c vocab-server/services/webFetcher.js` 失败：
  - `SyntaxError: Invalid or unexpected token` at line 42
- 文件 `vocab-server/services/webFetcher.js` 存在 **UTF-8 编码损坏**：
  - 中文字符串乱码且 **引号未闭合**（L42、L52）
  - L40 注释与代码混在同一行，导致 `let markdown = ...` 被注释掉
- 请求链路：`UrlFetchPanel.tsx` → `POST /api/materials/fetch-url` → `server.js:6783` → `require('./services/webFetcher')` → **模块加载即 SyntaxError**
- 前端 `UrlFetchPanel.tsx:52` 将 `err.message` 直接展示，故用户看到的就是 Node 语法错误原文。

### 现有实现意图（损坏前设计）
- `webFetcher.js` 已设计调用 `${FETCH_ENDPOINT_BASE}/web/fetch`（默认 `https://23.95.214.232/v1/`）
- 已使用 `model: fetch-combo`, `format: markdown`, Bearer token（env `DIFY_FETCH_API_KEY` 或硬编码 fallback）
- **与用户 curl 差异**：请求体缺少 `max_characters: 0`；endpoint 拼接可能产生双斜杠 `/v1//web/fetch`

### 相关文件
- 前端：`src/components/UrlFetchPanel.tsx`, `src/components/MaterialUploader.tsx`
- 后端：`vocab-server/server.js` (L6783-6797), `vocab-server/services/webFetcher.js`
- 辅助：`urlValidator.js` (SSRF), `markdownSanitizer.js`
- 文档：`detail.md`, `docs/user_maual.md`

### 用户测试 URL
- 截图 URL：`https://www.federalreserve.gov/data/intlsumm/forassets202!`（末尾 `!` 可能是误输入）

## Constraints
- API Key 不应暴露在前端；应保留在后端 env
- 现有 SSRF 校验（urlValidator）应保留
- 部署：vocab-server systemd + nginx 反代 `/api/`

## Unknowns / Open Questions
- 修复范围：仅修复 webFetcher.js，还是同步部署到生产服务器？
- API Key / endpoint 是否应完全走 env，移除硬编码 fallback？
- 用户 URL 末尾 `!` 是否为真实链接？
- 是否需要任务中心异步化（GlobalTaskCenter 已有网页提取任务展示文案）？

## Decision Boundaries (unresolved)
- OMX 是否可移除硬编码 API Key fallback？
- 是否在本轮一并部署 vocab-server？

## Likely Codebase Touchpoints
- `vocab-server/services/webFetcher.js` (primary fix)
- 可选：`.env` / 部署脚本 / server 重启

## Docs Inspected
- `detail.md` §网页提取接口
- `docs/user_maual.md`
- deployment-notes rule (nginx/systemd)

## Prompt-safe Summary Status
`not_needed` — context fits interview budget.
