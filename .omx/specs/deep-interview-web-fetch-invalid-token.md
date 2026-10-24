# Deep Interview Spec: web-fetch-invalid-token

## Metadata
| Field | Value |
|-------|-------|
| Profile | standard |
| Rounds | 3 |
| Final Ambiguity | ~0.08 |
| Threshold | 0.20 |
| Context Type | brownfield |
| Context Snapshot | `.omx/context/web-fetch-invalid-token-20250721T150000Z.md` |

## Clarity Breakdown
| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.95 | 修复网页提取预览失败 |
| Outcome | 0.90 | 本地 API 返回 markdown |
| Scope | 0.95 | 仅 webFetcher.js |
| Constraints | 0.85 | 保留 SSRF，不改前端 |
| Success Criteria | 0.90 | node -c + 本地 fetch-url |
| Context | 0.95 | 根因已代码验证 |

## Intent
修复 Deep-Interview Step 2「网页提取」预览报错，使后端能正确调用远程 `/v1/web/fetch` 并返回 markdown。

## Desired Outcome
用户粘贴 URL → 点击「预览网页内容」→ 后端 `/api/materials/fetch-url` 成功返回 `{ success, title, markdown }`。

## In-Scope
1. 修复 `vocab-server/services/webFetcher.js` 编码损坏导致的 **SyntaxError**
2. 恢复/对齐远程 fetch 调用，参数与用户 curl 一致：
   - `POST {base}/web/fetch`
   - `model: "fetch-combo"`
   - `format: "markdown"`
   - `max_characters: 0`
   - `Authorization: Bearer {DIFY_FETCH_API_KEY || fallback}`
3. 保留 `validateUrl` SSRF 校验与 `sanitizeMarkdown` 后处理
4. 验证：`node -c webFetcher.js` + 本地 `POST /api/materials/fetch-url`（任意可访问 URL）

## Out-of-Scope / Non-goals
- 不改前端（`UrlFetchPanel`, `MaterialUploader`, `GlobalTaskCenter`）
- 不改 SSRF 校验规则（`urlValidator.js`）
- 不部署到生产服务器（用户自行重启 vocab-server）
- 不做 GlobalTaskCenter 异步任务改造

## Decision Boundaries (OMX may decide without confirmation)
- 修复乱码字符串的具体中文文案
- 修正 L40 注释吞掉 `let markdown` 的逻辑错误
- 修正 endpoint 拼接双斜杠（`/v1//web/fetch` → `/v1/web/fetch`）
- 添加 `max_characters: 0` 请求字段
- 保留现有 env + 硬编码 API Key fallback 模式（用户未选 fix-env-deploy）

## Constraints
- API Key 不得暴露到前端
- 最小 diff，仅 touch `webFetcher.js`
- 遵循现有 `fetchUrlContent` 返回结构

## Testable Acceptance Criteria
1. `node -c vocab-server/services/webFetcher.js` 退出码 0
2. vocab-server 运行中，`curl -X POST http://localhost:3001/api/materials/fetch-url -H "Content-Type: application/json" -d '{"url":"https://example.com"}'` 返回 `success: true` 且含非空 `markdown`
3. 前端现有流程无需改动即可受益

## Root Cause Analysis

### 直接原因
`vocab-server/services/webFetcher.js` 文件 UTF-8 编码损坏：
- L42、L52 中文字符串引号未闭合 → Node `SyntaxError: Invalid or unexpected token`
- L40 注释与 `let markdown = ...` 混行，赋值语句被注释掉

### 错误传播链
```
UrlFetchPanel.handlePreview()
  → fetch POST /api/materials/fetch-url
    → server.js require('./services/webFetcher')
      → SyntaxError at parse time
        → catch → res.status(500).json({ error: error.message })
          → 前端 setError("Invalid or unexpected token")
```

### 与用户 curl 的关系
设计已指向同一 API（`https://23.95.214.232/v1/web/fetch`），但因模块语法错误 **从未执行到 fetch 调用**。修复后需补齐 `max_characters: 0`。

## Assumptions & Resolutions
| Assumption | Resolution |
|------------|------------|
| 远程 API 可用 | 验收用 example.com；federalreserve URL 非必须 |
| 硬编码 Key 保留 | fix-only 范围，沿用 env fallback |
| 截图 URL 末尾 `!` | 不特殊处理；SSRF/URL 校验保持现状 |

## Pressure-Pass Findings
- R1 确认 scope=fix-only → 排除部署与 env 重构
- R3 确认 non-goals → 前端与 SSRF 不动，收窄实施面

## Technical Touchpoints
- `vocab-server/services/webFetcher.js` — **唯一修改文件**
- `vocab-server/server.js:6783-6797` — 路由不变
- `src/components/UrlFetchPanel.tsx` — 只读，不改

## Transcript Summary
- **R1:** 范围 = 仅修复 webFetcher.js
- **R2:** 验收 = 语法检查 + 本地 API 返回 markdown
- **R3:** 非目标 = 不改前端、不改 SSRF
