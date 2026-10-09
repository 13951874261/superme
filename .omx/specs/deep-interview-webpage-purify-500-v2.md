# Deep Interview Spec: webpage-purify-500 (v2 — upstream switch)

## Metadata
| Field | Value |
|-------|-------|
| Profile | standard |
| Rounds | 6 (resume session 2026-07-22) |
| Final ambiguity | ~0.09 |
| Threshold | 0.20 |
| Type | brownfield |
| Prior spec | `.omx/specs/deep-interview-webpage-purify-500.md` |
| Context snapshot | `.omx/context/webpage-purify-500-20260722T084916Z.md` |
| Transcript | `.omx/interviews/webpage-purify-500-20260722T093300Z.md` |

## Clarity breakdown
| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.95 | 修生产网页提取；目标从「诊断 9router」升级为「切到指定上游」 |
| Outcome | 0.92 | 生产预览返回非空 markdown |
| Scope | 0.92 | 上游 endpoint + env + 部署 |
| Constraints | 0.88 | 允许生产部署；密钥走 env |
| Success | 0.90 | curl + 浏览器验收 |
| Context | 0.95 | 根因：默认 endpoint 指向不可达 9router |

## Intent
生产 `POST /api/materials/fetch-url` 仍 500（`fetch failed`）。相对昨日规范，**目标变为**：将上游切换为用户验证过的 `https://23.95.214.232/v1/web/fetch`，而非仅诊断旧默认 `9router.234124123.xyz`。

## Desired Outcome
在 `https://app.liujingzhuwo.site` 粘贴合法 URL →「预览网页内容」成功，返回非空 markdown。

## In-Scope
1. 将 `webFetcher.js` 默认 `FETCH_ENDPOINT_BASE` 改为 `https://23.95.214.232/v1`（与用户 curl 一致）
2. 请求体对齐：`model: fetch-combo`, `url: <用户输入>`, `format: markdown`（可保留 `max_characters: 0` 若上游兼容）
3. 鉴权：`Authorization: Bearer ${DIFY_FETCH_API_KEY}`；生产 systemd 可显式设置 `FETCH_ENDPOINT_BASE` / `DIFY_FETCH_API_KEY`
4. 部署 `webFetcher.js`（及必要时 service env）并重启 `super-agent-vocab`
5. 生产 `POST /api/materials/fetch-url` 与浏览器预览验收

## Out-of-Scope / Non-goals
1. 不改前端 UI/布局（错误文案产品化本轮不做）
2. 不改 `generate-material` / `pack-for-llm` / 任务中心
3. 不重做抓取架构；不换非 `/web/fetch` 协议
4. 不处理特定站点正文质量
5. 不在 YAML/前端暴露 API Key

## Decision Boundaries（无需再确认）
- 默认上游改为 `https://23.95.214.232/v1`
- env 变量命名沿用 `FETCH_ENDPOINT_BASE`、`DIFY_FETCH_API_KEY`
- 部署与 systemd 重启
- 最小 diff：优先 `webFetcher.js` + 可选 `super-agent-vocab.service`

## Constraints
- 密钥仅服务端 env/fallback，不进前端或 git 明文新增
- Nginx `/api/` → vocab-server:3001
- 浏览器 `127.0.0.1:7897` 仅为本机代理，不代表服务器出站

## Testable acceptance criteria
1. `webFetcher.js` 默认 `FETCH_ENDPOINT_BASE` = `https://23.95.214.232/v1`
2. 生产 `POST https://app.liujingzhuwo.site/api/materials/fetch-url` with `{"url":"https://example.com"}` → `success: true`, `markdown` 非空
3. 浏览器「预览网页内容」不再 500 / `fetch failed`
4. Non-goals 范围未越界

## Assumptions + resolutions
| Assumption | Resolution |
|------------|------------|
| 症状变了 | **否定** — 仍为 `fetch failed` |
| 需换抓取库 | **否定** — 同 `/web/fetch` 协议，换 base URL |
| 9router 可修通 | **弃用** — 用户指定 23.95.214.232 |
| API Key 不同 | **否定** — 与现有 fallback 一致，应用 env |

## Pressure-pass findings
Round 3 回压「情况变了」→ 实为**目标**从诊断升级为明确上游替换；用户 curl 提供可执行契约。

## Technical context
- `vocab-server/services/webFetcher.js` — change default endpoint
- `super-agent-vocab.service` — optional explicit env
- `vocab-server/server.js` — `/api/materials/fetch-url` unchanged
- Deploy: `deploy-smart` / `deploy-webfetcher-putty.ps1`

## Residual risk
- 生产机到 `23.95.214.232` 出站若仍失败，需查防火墙/TLS（低于 9router 假设）
- 用户 curl 未含 `max_characters`；若上游拒绝该字段需从 body 移除
