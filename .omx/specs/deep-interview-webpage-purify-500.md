# Deep Interview Spec: webpage-purify-500

## Metadata
| Field | Value |
|-------|-------|
| Profile | standard |
| Rounds | 6 |
| Final ambiguity | 0.10 |
| Threshold | 0.20 |
| Type | brownfield |
| Context snapshot | `.omx/context/webpage-purify-500-20260721T164910Z.md` |
| Transcript | `.omx/interviews/webpage-purify-500-20260721T170005Z.md` |
| Prompt-safe summary | not_needed |

## Clarity breakdown
| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.95 | 先诊断，再修到生产可用 |
| Outcome | 0.90 | 生产预览返回 markdown |
| Scope | 0.90 | fetch-url 恢复链路 |
| Constraints | 0.90 | 允许生产 SSH/curl |
| Success | 0.88 | 见验收标准 |
| Context | 0.95 | 链路与历史上下文已对齐 |

## Intent
生产「网页提纯/提取」失败（500 / `fetch failed`）。先用服务器侧证据钉死根因，再直接修复并部署，直到生产预览可用。

## Desired Outcome
在 `https://app.liujingzhuwo.site` 上，粘贴合法 URL →「预览网页内容」成功，展示非空 markdown，可确认作为提纯材料。

## In-Scope
1. 生产机诊断：对上游 `FETCH_ENDPOINT_BASE`（默认 `https://9router.234124123.xyz/v1`）的 `/web/fetch` 做连通性验证；核对 `super-agent-vocab` 日志中的 `[Fetch URL Error]`
2. 根因分类并修复（出站代理/DNS/TLS/防火墙、env、超时重试、或 `webFetcher.js` / `fetch-url` 错误包装）
3. 部署与 `systemctl` 重启；用生产 `POST /api/materials/fetch-url` 验收

## Out-of-Scope / Non-goals
1. 不改前端 UI/文案/布局（必要时仅错误展示逻辑）
2. 不改 `generate-material` / `pack-for-llm` / 任务中心
3. 不重做异步任务化或换全新抓取架构；最多修现有 `/web/fetch` 调用链
4. 不处理特定站点正文质量/广告过滤效果
5. 本轮不做 API Key 轮换或密钥治理（可继续现有 env/fallback）

## Decision Boundaries（无需再确认）
- 服务器出站：`HTTP(S)_PROXY`、systemd 环境变量等
- 上游配置：`FETCH_ENDPOINT_BASE`、超时、重试（保持 `/web/fetch` 形态）
- 应用代码：`webFetcher.js`、`/api/materials/fetch-url` 错误信息
- 部署：上传、重启服务、curl 验收  
边界条件：不扩展到材料生成/提纯以外功能。

## Constraints
- 允许生产 SSH / 服务器本机 curl / 读服务日志
- API Key 不暴露到前端（既有约定）
- Nginx 反代 `/api/` → vocab-server；生产域名以 `app.liujingzhuwo.site` 为准

## Testable acceptance criteria
1. 生产机可证明上游调用失败原因（连通性结果或等价日志），与 `error: "fetch failed"` 对齐
2. 修复部署后，`POST https://app.liujingzhuwo.site/api/materials/fetch-url` 对可访问测试 URL（如 `https://example.com`）返回 `success: true` 且 `markdown` 非空
3. 浏览器「预览网页内容」不再出现该 500 / `fetch failed`
4. 未改动 Non-goals 中的材料管线与 UI 布局

## Assumptions + resolutions
| Assumption | Resolution |
|------------|------------|
| 仍是未部署的 SyntaxError | **否定** — Response 为 `fetch failed`，模块已能加载 |
| 浏览器代理 `127.0.0.1:7897` 解释服务器出站 | **否定** — 出站需在生产机验证 |
| 失败点在 Node → 9router 网络 | **工作假设** — 待 SSH curl 证实或推翻 |

## Pressure-pass findings
用 Response 正文回压「先诊断」：从「可能还是坏文件」转为「出站 fetch 失败」主假设。

## Brownfield evidence
- `[from-code][auto-confirmed]`：`UrlFetchPanel` → `POST /api/materials/fetch-url` → `webFetcher.fetchUrlContent` → `${endpoint}/web/fetch`
- `[from-user]`：生产 500 body `{"success":false,"error":"fetch failed"}`
- 历史：`.omx/specs/deep-interview-web-fetch-still-invalid-token.md`（部署漏传）— 本轮症状已不同

## Docs / Terminology Ledger
| Term | Canonical meaning |
|------|-------------------|
| 网页提纯 / 网页提取 | 同一 UI 能力：`/api/materials/fetch-url` 预览 |
| fetch failed | Node fetch 出站网络失败文案（非业务 JSON） |
| Inspected | `detail.md`, `docs/user_maual.md`, deployment-notes, prior `.omx` web-fetch specs |

## Scenario pressure
若生产机 `curl` 上游成功但应用仍 `fetch failed` → 查进程环境（代理/DNS）与 Node 运行用户差异，而非改前端。

## Optional durable docs (opt-in)
可事后把「生产出站依赖 9router」写入运维笔记；**不自动写入**公开文档。

## Technical context
- Primary: `vocab-server/services/webFetcher.js`, `vocab-server/server.js` (`/api/materials/fetch-url`)
- Frontend display: `src/components/UrlFetchPanel.tsx`
- Deploy aids: `scripts/deploy-webfetcher-putty.ps1`, deploy-smart

## Residual risk
低。根因尚未在生产机实证；执行期第一步必须是服务器侧验证，再选修复手段。
