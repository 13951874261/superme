# 全站卡顿改善 — 第一阶段性能基准测试报告

## 测试概述

| 项 | 内容 |
| --- | --- |
| 执行时间 | 2026-08-18 09:30–09:36（UTC+8） |
| 测试环境 | 生产 [https://app.liujingzhuwo.site/](https://app.liujingzhuwo.site/) ，登录密码 `1`，User ID `lzhmy` |
| 执行方式 | Playwright Chromium headless（当前会话无 Browser MCP，沿用既有 `scripts/run-perf-e2e.cjs`）；另用独立 TCP/TTFB 探针 |
| 代码修改概述 | **未改产品代码**。仅新增基准脚本与本报告。对照需求「生成慢、卡顿频繁、收起折叠也卡」测菜单切换 / 折叠 / 生成路径。 |
| SLA | 响应 < 8000ms 为达标；纯 UI 折叠/切页 > 300ms 记为卡顿 |
| 总测试用例数 | 28 |
| 通过 | 1 |
| 失败 / 超时 | 2（登录初始化；全站 `/api/*` 无首字节） |
| 阻塞（未能进入主界面，后续用例无法执行） | 25 |
| 截图目录 | `dist/e2e-perf/` |
| 原始结果 | `dist/e2e-perf/results.json`、`dist/e2e-perf/pending-at-login.json` |

**入口（共用）**

- 访问地址：`https://app.liujingzhuwo.site/`
- 前置：密码 `1` 解锁登录
- 浏览器插件：本会话 MCP catalog 为空，Browser 插件不可用

**关键结论（先看这个）**

静态站点是通的，**后端 Node 反代全部挂起**。因此菜单切换、折叠、生成路径全部无法在生产上完成计时。这与「多台电脑均不流畅」一致：不是单机前端问题，而是共用 API 进程无响应。

| 探测 | TCP/TLS | TTFB | 结果 |
| --- | --- | --- | --- |
| `GET /` 静态页 | DNS 116ms / TLS 216ms | **307ms** | 达标 |
| `GET /api/tasks` | TLS 157ms 已建立 | **> 8000ms 无首字节** | 超时 |
| `GET /api/vocab/health` | 已发出 | **> 8000ms 无首字节** | 超时 |
| `POST /api/user/login-ping` 等 5 个接口 | — | **> 12000ms abort** | 超时 |

---

## 功能测试用例与执行详情

### A. 可达性与登录

| 编号 | 菜单路径 / 访问地址 | 测试输入 | 预期结果 | 实际结果 | 耗时 | 截图 | 对应需求 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PERF-NAV-01 | 打开 `https://app.liujingzhuwo.site/` | GET 首页 | DCL < 8s | **通过** DCL 1478ms，节点 42 | 1602ms | `dist/e2e-perf/00-login.png` | 首屏 |
| PERF-LOGIN-01 | 登录页 → 解锁登录 | 密码 `1` | 出现「英语引擎」< 8s | **失败** 按钮停在「正在初始化…」；90s 仍未进主界面 | 90250ms | `dist/e2e-perf/00-home.png` | 登录 / 整体反应慢 |
| PERF-API-01 | 直连 `/api/*`（不经页面） | health / tasks / login-ping / theme-list / cron-runs | 12s 内返回 | **超时** 顺序与并行全部 Abort | ≥12000ms | （无页面） | 生成慢 / 全站卡顿 |

登录时浏览器里 **卡住未完成** 的请求（摘自 `pending-at-login.json`，等待约 90s）：

1. `/api/tasks`
2. `/api/daily-cron/runs?userId=lzhmy&days=7`
3. `/api/theme/check-mastery`（重复多次）
4. `/api/training/session/upsert`
5. `/api/theme/focus`
6. `/api/theme/stay-stats`
7. `/api/user/login-ping`（登录按钮依赖它结束才会 `onUnlock`）
8. `/api/theme/list`
9. `/api/theme/mastered-list`

说明：密码 `1` **已被接受**（按钮从「解锁登录」变为「正在初始化…」），阻塞发生在 `initializeUserSession()` 等待后端，而不是密码错误。

### B. 顶栏模块切换（全部阻塞）

| 编号 | 菜单路径 | 测试输入 | 预期 | 实际 | 对应需求 |
| --- | --- | --- | --- | --- | --- |
| PERF-TAB-EN | 顶栏 → 英语引擎 | 点击 | 出现「进度总控」< 8s，UI < 300ms | **阻塞** | 菜单切换 |
| PERF-TAB-LS | 顶栏 → 洞察(听) | 点击 | 出现理论知识区 < 8s | **阻塞** | 菜单切换 |
| PERF-TAB-SP | 顶栏 → 破局(说) | 点击 | 模块可见 < 8s | **阻塞** | 菜单切换 |
| PERF-TAB-RD | 顶栏 → 穿透(读) | 点击 | 模块可见 < 8s | **阻塞** | 菜单切换 |
| PERF-TAB-WR | 顶栏 → 文治(写) | 点击 | 模块可见 < 8s | **阻塞** | 菜单切换 |
| PERF-TAB-GT | 顶栏 → 驭心博弈 | 点击 | 模块可见；允许自动推送案例 | **阻塞** | 菜单切换 / 生成慢 |
| PERF-TAB-AE | 顶栏 → 高阶审美 | 点击 | 模块可见 < 8s | **阻塞** | 菜单切换 |

### C. 英语子页签（全部阻塞）

| 编号 | 菜单路径 | 测试输入 | 预期 | 实际 | 对应需求 |
| --- | --- | --- | --- | --- | --- |
| PERF-EN-SUB-* | 英语引擎 → 进度总控 / 词汇矩阵 / 精听盲听 / 多角色沙盘 / 纵深书面 / 即兴演讲 | 依次点击 6 个页签 | UI < 300ms，硬阈值 < 8s | **阻塞** | 子模块切换 |

### D. 折叠交互（全部阻塞）— 对应「收起折叠也卡」

| 编号 | 菜单路径 | 测试输入 | 预期 | 实际 | 对应需求 |
| --- | --- | --- | --- | --- | --- |
| PERF-FOLD-WAKE | 英语引擎 → 每日唤醒 → 折叠模块 | 点 `aria-label=折叠模块` | < 300ms | **阻塞** | 收起折叠也卡 |
| PERF-UNFOLD-WAKE | 同上 → 展开模块 | 再点展开 | < 300ms | **阻塞** | 收起折叠也卡 |
| PERF-FOLD-CAL | 左侧栏 → Monthly Calendar | 点击标题收起 | < 300ms | **阻塞** | 收起折叠也卡 |
| PERF-UNFOLD-CAL | 左侧栏 → Monthly Calendar | 再点展开 | < 300ms | **阻塞** | 收起折叠也卡 |
| PERF-FOLD-UTIL | 左侧栏 → Utility Tools | 展开 / 收起 | < 300ms | **阻塞** | 收起折叠也卡 |
| PERF-FOLD-SIDEBAR | 左侧栏边缘按钮 | 收起 / 展开侧栏 | < 300ms | **阻塞** | 收起折叠也卡 |
| PERF-VAULT-OPEN | Utility Tools → 资料抽屉 | 打开 / 关闭 | 打开 < 8s | **阻塞** | 资料抽屉 |
| PERF-LS-FOLD-ALL | 洞察(听) → 理论知识 → 全折叠 / 全展开 | 点击全折叠 | < 300ms | **阻塞** | 收起折叠也卡 |

### E. 生成路径（全部阻塞）— 对应「生成慢」

| 编号 | 菜单路径 | 测试输入 | 预期 | 实际 | 对应需求 |
| --- | --- | --- | --- | --- | --- |
| PERF-GT-SWAP | 驭心博弈 → 换一条 | 点击；等待网络静默 | < 8s 出案例或明确失败 | **阻塞** | 生成慢 |
| PERF-RD-PUSH | 穿透(读) → 每日 AI 素材推送 | 点击 | < 8s 出素材或明确失败 | **阻塞** | 生成慢 |
| PERF-EN-WAKE-REFRESH | 英语引擎 → 刷新今日包 | 点击 | < 8s 出包或明确失败 | **阻塞** | 生成慢 |

---

## 失败案例分析

### 1) 登录停在「正在初始化…」（PERF-LOGIN-01）

- **现象**：密码 `1` 校验通过；按钮文案变为「正在初始化…」；90 秒仍看不到「英语引擎」。
- **原因（观测）**：`LoginPage` 在 `onUnlock` 前 `await initializeUserSession()`，其中 `POST /api/user/login-ping` 无超时；该请求与登录页就已经发出的 `/api/tasks`、`/api/theme/*`、`/api/training/*` 一起挂起。
- **放大因素**：`App` 在未登录时就挂载了 `EnglishProvider` + `TaskProvider`，登录页就会打出 6+ 条无超时的 `/api` 请求。浏览器对同源通常只有约 6 条并行连接，`login-ping` 被排在队列后段（pending 列表里它比 `/api/tasks` 晚约 1.2s 才发出）。

### 2) 所有 `/api/*` 无 TTFB（PERF-API-01）

- **现象**：Nginx 能完成 TLS；静态 HTML TTFB 307ms；反代到 Node 的接口 8–12s 无首字节。连只读内存的 `/api/tasks` 也同样挂起。
- **原因（观测）**：问题在 `127.0.0.1:3001` 的 vocab-server 进程（或其对 Nginx 的 upstream），不是前端打包、也不是 DNS。
- **推断**：Node 事件循环未再处理 Express 回调（同步死循环 / 超长同步 SQLite / 进程假死），或 upstream 连接已死但 Nginx 仍在等。当前仓库证据不足以从本机判定是哪一种，需要服务器上 `systemctl status` / 进程 CPU 才能钉死。

### 3) 折叠与生成用例全部阻塞

- **现象**：未能进入主界面，Playwright 无法点击顶栏和折叠按钮。
- **原因**：被 1)+2) 挡住。**不能**把「折叠卡」记成已在生产上测到的前端 jank；只能记为「未测」。
- **代码上仍存在的可疑点（未用本次计时证实）**：`CollapsiblePanel` 用 `max-h-[5000px]` 做折叠动画；侧栏 `backdrop-blur`；英语壳 keep-alive 隐藏不卸载。这些要等 API 恢复后再测。

---

## 具体解决方案（第一阶段只记录，第三阶段再改代码）

1. **立刻（运维）**：在生产机检查并必要时重启 `super-agent-vocab`（`systemctl status/restart`），然后复测 `/api/tasks` TTFB 是否回到毫秒级。不重启则后续 E2E 无法继续。
2. **登录解耦**：未登录不要让 `TaskProvider` / `EnglishContext` 打业务接口；`login-ping` / `profile` 必须有 ≤8s 超时，超时仍进入主界面。
3. **探活**：补真正的 `/api/vocab/health`（部署文档已写、当前 `server.js` 无此路由），且不碰 SQLite。
4. **恢复后再跑本报告 B/C/D/E 用例**，才能量化「折叠是否 >300ms」「生成是否 >8s」。

---

## 附录：脚本与文件

- 基准脚本：`scripts/run-perf-e2e.cjs`
- API 探针：`scripts/probe-api-latency.cjs`、`scripts/probe-ttfb.cjs`
- 登录卡住时的 pending 列表：`dist/e2e-perf/pending-at-login.json`
