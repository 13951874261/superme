# 功能与接口验证测试矩阵

- **执行时间**：2026-08-23 19:43–19:53（UTC+8）
- **环境**：`https://app.liujingzhuwo.site/`
- **账号**：userId=`lzhmy`，解锁密码=`1`
- **方法**：浏览器自动化登录 + 全量菜单扫描 + 逐模块点击 + 页面内 fetch/XHR 抓包（共 **381** 次请求）
- **代码改动**：本次为线上探针，未改仓库代码。本地未部署改动含 `GET /api/insight/listen/pool`。
- **截图**：`dist/e2e-screenshots/01-task-center.png`、`dist/e2e-screenshots/02-game-theory-tactics.png`

## 结论摘要

| 项 | 结果 |
|---|---|
| 登录 | 通过。本地秘钥校验后 `POST /api/user/login-ping` **200**，`GET /api/user/profile/lzhmy` **200** |
| 顶栏 7 模块切换 | 通过。听读 / 表达 / 精读 / 写作 / 博弈 / 审美均可打开，无白屏 |
| 英语 6 个子页签 | 5 个通过；**即兴演讲**打开时后台口语接口失败 |
| 破坏性按钮 | 未点：重置今日、清空已结束、删除记录、整次重新执行、完成打卡 |
| 接口健康 | 绝大多数 **200**；失败见下方「失败案例」 |

**统计（按唯一接口+状态）**：成功接口约 40+；明确失败 4 类（oral/chat 超时与 400、insight pool 404、探针参数不全的 400）。

---

## 第一步：登录

| 编号 | 菜单路径 / 地址 | 输入 | 预期 | 实际 | 对应需求 |
|---|---|---|---|---|---|
| T01 | 首页 `https://app.liujingzhuwo.site/` → 密码框 → 解锁登录 | 密码 `1`，账号 `lzhmy` | 进入工作台，无报错弹窗；鉴权 200 | **通过**。按钮变为「正在初始化…」后进入主界面 | 登录模块 |

后台：

```text
POST /api/user/login-ping  → 200  {"success":true,"catchupScheduled":false,"userId":"lzhmy"}
GET  /api/user/profile/lzhmy → 200  {"success":true,"data":{"user_id":"lzhmy",...}}
```

说明：前端先做本地密码比对（默认 `1`），再打 login-ping / profile。不是传统 Token 登录，会话靠 `userId`。

---

## 第二步：菜单与按钮清单（扫描结果）

**顶栏**：英语学习 / 听读 / 表达 / 精读 / 写作 / 博弈训练 / 高阶审美

**英语子页签**：进度总控 / 生词复习 / 精听盲听 / 多角色练习 / 纵深书面 / 即兴演讲

**听读**：理论框架库、体系要点、树形导图、全展开、导出 Word、分类（体制内/外企/通用社交）、刷新案例、模拟一键侧写

**表达**：金字塔/因果结构、进入场景博弈会话、即兴发言、整理素材

**精读**：场景分类、每日 AI 素材推送、政策意图解构

**写作**：体制内公文 / 中文商务函 / 履历价值提炼、获取AI挑战任务、提交文治审阅

**博弈**：高管冲突 / 策略档案 / 人机对战 / 多人会话 / 对局历史 / 顶层认知

**审美**：顶级政商社交 / 高端审美 / 智力博弈 / 德州扑克 / 交互复盘、换一条

**全局**：资料抽屉、每周一聊、声线、后台任务、词典三件套、习惯打卡、职业轨迹

首次进入英语页即可视交互控件 **324** 个（含大量「播放/收录」单词按钮，未逐词点击）。

---

## 第三步：逐项执行与接口契约

### A. 英语学习

| 编号 | 路径 | 输入 | 预期 | 实际 | 需求 |
|---|---|---|---|---|---|
| T02 | 顶栏 → 英语学习 | 无 | 进度总控 + 今日战区简报 | **通过**。`GET /api/theme/check-mastery` 200 | 模块切换 |
| T03 | 进度总控 | 无 | 主题/配额加载 | **通过**。本地 UI，无新失败接口 | 子页签 |
| T04 | 生词复习 | 无 | 复习词卡 + 记忆矩阵 | **通过**。`GET /api/vocab/review` 200，`GET /api/vocab/memory/:id` 200，`GET /api/vocab/item/:id` 200 | 生词 |
| T05 | 精听盲听 | 无 | 查预生成听力，无则提示任务中心 | **部分通过**。`GET /api/listen/pregenerated` **200** `status:"ready"`，article+audio 已就绪；`GET /api/english/listen-prefs` 200 | 听力缓存 |
| T06 | 多角色练习 | 无 | 沙盘场景出现 | **通过**。出现「国际银团贷款谈判 / 跨文化雷达」 | 口语沙盘 |
| T07 | 纵深书面 | 无 | 书面页打开 | **通过**。`GET /api/theme/check-mastery` 200 | 书面 |
| T08 | 即兴演讲 | 打开页签即触发 | 不卡死；接口 200 | **失败**。见 F1 | 即兴 |
| T09 | 查询/生成今日长文 | 点击 | 只查缓存，命中则渲染 | **通过**。`GET /api/english/daily-extract/article/exact` **200** `found:true`，68ms | 长文缓存 |
| T10 | 刷新词汇 | 点击 | 刷新或转入任务中心 | **部分通过**。`POST /api/daily-pack/regenerate` 200，`status:"generating"`，页面轮询 `/api/daily-pack/today`。未卡死，但是**同步轮询**而非任务中心抽屉 | 日包 |
| T11 | 播放/收录（抽样） | 未逐条点全部 40+ 词 | — | 登录后自动 `POST /api/dify/dict-query` **230 次 200**，多数 `fromCache:true` | 词典缓存 |

### B. 听读

| 编号 | 路径 | 输入 | 预期 | 实际 | 需求 |
|---|---|---|---|---|---|
| T12 | 顶栏 → 听读 | 无 | 理论框架 + 案例 | **通过**。理论树/导图可点，无新 5xx | 听读壳 |
| T13 | 体系要点 / 树形导图 / 全展开 | 点击 | 本地切换 | **通过**。无网络（本地渲染） | 导图 |
| T14 | 体制内 / 外企 / 通用社交 / 刷新案例 | 点击 | 查日池缓存，空则提示任务中心 | **失败（后端未上线）**。生产 `GET /api/insight/listen/pool` → **404** `Endpoint not found`。刷新案例无有效回包。见 F2 | 洞察日池 |
| T15 | 模拟一键侧写 | 点击 | 调试填充表单 | **通过**。本地填充，无破坏 | 调试 |

### C. 表达 / 精读 / 写作

| 编号 | 路径 | 输入 | 预期 | 实际 | 需求 |
|---|---|---|---|---|---|
| T16 | 表达 | 无 | 结构模板 + 场景入口 | **通过** | 表达壳 |
| T17 | 进入场景博弈会话 | 点击 | 跳转博弈并拉会话 | **通过**。`GET /api/game-theory/sessions` 200，含「跨部门预算谈判」 | 跨模块 |
| T18 | 精读 | 无 | 场景分类可见 | **通过** | 精读壳 |
| T19 | 政策意图解构 | 点击 | 快速出素材 | **慢通过**。连带 `GET /api/game-theory/cases/push` **200**，耗时 **12502ms**。见建议 R3 | 案例推送 |
| T20 | 写作 → 获取AI挑战任务 | 点击 | 不卡页，进任务中心 | **通过（模式正确）**。`POST /api/listen/generate-material-long` 200 `status:"pending"`，随后轮询 `GET /api/tasks/:id` 200 | 写作后台化 |

### D. 博弈训练 / 高阶审美 / 任务中心 / 抽屉

| 编号 | 路径 | 输入 | 预期 | 实际 | 需求 |
|---|---|---|---|---|---|
| T21 | 博弈训练 | 无 | 拉战术库 | **通过**。`GET /api/game-theory/tactics` 200；`prototypes` 200 `[]`；`linked` 200 | 博弈壳 |
| T22 | 对局历史 | 点击 | 列出历史 | **通过**。`GET /api/game-theory/history` 200 | 历史 |
| T23 | 博弈策略与人性档案 | 点击 | 手段库卡片 | **通过**。见截图 02 | 档案 |
| T24 | 高阶审美 | 无 | 日推场景 | **通过**。`GET /api/aesthetics/daily-push` 200，`scenario_id:"fallback-auction"` | 审美缓存 |
| T25 | 审美子页签 | 点击 5 个 | 本地切换 | **通过**。无网络 | 子页签 |
| T26 | 换一条 | 点击 | 换场景，不 5xx | **通过**。`POST /api/aesthetics/daily-push/regenerate` 200，约 2s | 换题 |
| T27 | 后台任务 → 查看详情 | 点击 | 日任务明细 200 | **通过**。`GET /api/daily-cron/runs/:id` 200。当日：抽稿 1/1、听力 1/1、长文 **64/64**、精听 1/1，失败 0。见截图 01 | 日 cron |
| T28 | 资料抽屉 | 点击 | 打开知识库 | **通过**。英语笔记 / 同步 / 录入表单出现，无新失败接口 | 抽屉 |

### E. 未执行（有意跳过）

| 按钮 | 原因 |
|---|---|
| 重置今日 / 清空已结束 / 删除记录 / 整次重新执行 | 破坏性，会清线上任务或日包 |
| 完成打卡 | 写训练进度 |
| 上传 PDF/音频/录音 | 需本地文件与麦克风 |
| 提交文治审阅 / 提交社交指数 / 提交输入并更新训练计划 | 需长文本，且会改下周计划 |
| 导出 Word/CSV | 下载副作用 |
| 逐词「播放/收录」 | 324 控件里重复项；词典接口已由页面自动覆盖验证 |

---

## 失败案例

### F1 — 即兴演讲打开即打口语接口，失败

- **路径**：英语学习 → 即兴演讲
- **请求**：`POST /api/english/oral/chat`
- **实际**：
  1. 第一次 **status=0**，耗时 8004ms（前端超时/中断，无 body）
  2. 第二次 **HTTP 400**，耗时 26781ms  
     `{"code":"invalid_param","message":"Run failed: ... PluginInvokeError ... status code 522"}`
- **原因**：打开页签就同步打 Dify 口语 Chat；上游 522（网关超时）被包装成 400。页面被这条慢请求拖住。
- **方案**：
  1. 打开页签只渲染本地题面，**用户点「开始」再请求**。
  2. 开场白改日 cron 预生成，前端只 `GET` 缓存；没有则提示「去任务中心」，不卡当前页。
  3. 超时后取消请求并 toast，不要让页签切换等待 8–26s。

### F2 — 听读日池接口生产未部署

- **路径**：听读 → 分类 / 刷新案例
- **请求**：`GET /api/insight/listen/pool?category=体制内&userId=lzhmy`
- **实际**：**404** `{"error":"Endpoint not found"}`（三个分类皆然）
- **原因**：本地 `vocab-server/server.js` 已有该路由（未部署到 `app.liujingzhuwo.site`）。前端 `ListenModule` 已按「查池 → 不够则 backfill 进任务中心」写好。
- **方案**：部署本仓库 `insightDailyPoolService` + `/api/insight/listen/pool` + `/pool/backfill`。部署前刷新案例只能走内置 fallback / 旧 `POST /api/insight/listen/scenario`。

### F3 — 探针误用导致的 400（非产品按钮）

| 请求 | 状态 | 说明 |
|---|---|---|
| `GET /api/listen/pregenerated?userId=&duration=5` | 400 | 缺 theme/genre/cefr。UI 带齐参数时是 200 `ready` |
| `POST /api/dify/dict-query` 无 `word` | 400 | 探针字段写错。UI 正常调用 230 次均 200 |

不计入产品缺陷。

---

## 适合「后台生成 + 页面只查缓存」的功能

判断标准：生成慢（>2s）、结果与「今日/主题/分类」绑定、打开页不必等模型。没有缓存时只提示任务中心，不阻塞当前页。

### 已按此模式工作（保持）

| 功能 | 查询接口 | 证据 | 缺失时 |
|---|---|---|---|
| 今日长文 | `GET /api/english/daily-extract/article` / `exact` | 命中 `found:true`，68ms | 已有 3s 竞速 + 任务中心 |
| 精听预生成 | `GET /api/listen/pregenerated` | UI 调用 `status:"ready"`，article+audio 齐 | `canBackfill` + 任务中心 |
| 每日定时包 | `GET /api/daily-cron/runs` | 长文 64/64、精听 1/1 已就绪 | 任务中心看进度 |
| 写作 AI 挑战 | `POST /api/listen/generate-material-long` | 163ms 回 `pending`，不卡页 | 已进任务队列 |
| 词典 | `POST /api/dify/dict-query` | 大量 `fromCache:true` | 未命中才打模型 |
| 审美日推 | `GET /api/aesthetics/daily-push` | 200，有 fallback 场景 | 「换一条」才 regenerate |
| 生词收录 | vocab collect | 代码已 3s 移交任务中心 | 任务中心补齐释义 |
| 博弈推演 | 任务中心（代码路径） | 模块文案已写「提交后台」 | 完成后进对局历史 |

### 应该改成此模式（按优先级）

| 优先级 | 功能 | 现状 | 建议 |
|---|---|---|---|
| P0 | **听读洞察案例** | 前端已写日池，生产 **404** | 先部署 pool；页上只 `GET` 缓存。`readyCount=0` → toast「后台生成中，去任务中心」，禁止当场打模型卡页 |
| P0 | **即兴演讲开场** | 进页签就 `oral/chat`，8s 超时 / 26s 400 | 日 cron 预生成讲题+开场；页上只读缓存。没有则任务中心，不自动 chat |
| P1 | **博弈案例推送** `GET /api/game-theory/cases/push` | 点击等 **12.5s** | 纳入每日 cron，页上只读已推送列表；刷新走 backfill 任务 |
| P1 | **刷新词汇 / 日包 regenerate** | 页内轮询 `daily-pack/today` `generating` | 改 `addTask` + 任务中心，当前页继续用旧包 |
| P2 | **审美「换一条」** | 同步 regenerate ~2s，尚可接受 | 做成 3 条日池，点换只切下一条；池空再 backfill |
| P2 | **精读「每日 AI 素材推送」** | 若走 cases/push 会再等 10s+ | 与博弈案例共用日池 |

### 不适合预生成（保持即时）

用户当下输入决定输出：语法润色、发音诊断、口语沙盘多轮 SSE、文治审阅、社交指数分析、四维复盘、词典未缓存生词。这些继续「3s 竞速，超时进任务中心」即可，不要预生成。

---

## 红队记录

| 推演 | 结果 |
|---|---|
| 空表单提交 | 「提交社交指数 / 提交文治 / 更新训练计划」均为 disabled，未误打后台 |
| 破坏性按钮 | 已识别并跳过，线上日任务与词本未清 |
| 模块 keep-alive | 英语壳 `hidden` 不卸载，抓按钮必须过滤不可见节点，否则会点到隐藏控件 |
| 任务中心遮罩 | 打开后挡住主区点击；测模块前需先关抽屉 |
| 词汇债务锁 | 本次未触发沙盘/写作锁定条 |

---

## 建议修复顺序（未改代码，待确认）

1. 部署 `GET /api/insight/listen/pool` + backfill（本地已有，生产 404）。
2. 即兴演讲改为「先渲染、再按需请求 / 读日池」，禁止进页签自动 `oral/chat`。
3. `cases/push` 纳入 cron，前端只查缓存。
4. 「刷新词汇」改任务中心，停止页内 generating 轮询。

---

# 自由即兴口语对话验收报告

- **执行日期**：2026-09-02
- **环境**：`http://127.0.0.1:3002/`（Vite `127.0.0.1:3000` + 本地 Mock 反向代理）
- **测试账号**：`e2e-free-oral`
- **代码范围**：自由口语前端、Dify SSE 适配、SQLite 会话 API、现有字典收录复用
- **截图**：
  - `artifacts/free-oral-e2e/conversation-restored.png`
  - `artifacts/free-oral-e2e/dify-expression-candidates.png`

## 结论摘要

| 项目 | 结果 |
|---|---|
| 顶级入口与模式隔离 | **通过**。`英语学习 → 口语练习 → 自由即兴对话`；角色练习保持挂载但隐藏、停用，切回后状态不丢失 |
| `/focus` 指令 | **通过**。主题 UI、系统消息、会话 PATCH 均更新为 `sustainable urban development` |
| Dify 连续对话 | **通过**。SSE JSON 信封未泄露；第二轮携带 `conversationId=mock-dify-conversation-1` |
| Dify 表达提取 | **通过**。提取单词、短语、句型共 3 条 |
| 字典收录复用 | **通过**。逐条调用 `/api/vocab/lookup` 与 `/api/vocab/add-enriched`，全场景区写入 `category=general` |
| 历史恢复与切换 | **通过**。重新登录后恢复主题、两轮消息；新建空会话后可切回历史会话 |
| 浏览器异常 | **通过**。稳定加载后的验收窗口内新增 `error/warn` 为 0 |
| 自动化验证 | **通过**。模型 4/4；会话服务 4/4；API/前端/Dify Workflow 契约、语法、diff、构建均通过 |

## 功能测试矩阵

| 编号 | 菜单路径 / 页面 | 测试输入与操作 | 预期结果 | 实际结果 | 对应需求 |
|---|---|---|---|---|---|
| FO-01 | 英语学习 → 口语练习 → 自由即兴对话 | 点击入口 | 显示独立自由对话、历史栏、输入框；不触发角色开场 | **通过** | 独立板块、原功能隔离 |
| FO-02 | 自由即兴对话 | `/focus sustainable urban development` | 聚焦状态、系统消息、后端持久化同步 | **通过**。PATCH 与系统消息 POST 均命中 | 指令控制 |
| FO-03 | 自由即兴对话 | `Hello! What makes a city sustainable?`；随后 `How can public transport help?` | 流式输出友好正文；上下文连续 | **通过**。显示 `That is a strong point. Could you give a concrete example?`；第二轮携带 Dify conversation ID | Dify 流式对话、上下文连续 |
| FO-04 | AI 回复 → 一键收入 | 打开候选；切换全场景区；收入生词本 | Dify 提取 3 条；复用字典补全与收录 | **通过**。`concrete`、`a strong point`、`Could you give a concrete example?` 均写入 | 一键收入、现有字典逻辑复用 |
| FO-05 | 刷新登录 → 口语练习 → 自由即兴对话 | 重新输入账号登录；新建会话；切回历史会话 | 历史、主题、消息恢复；会话可切换 | **通过** | 会话持久化、新建、切换、刷新恢复 |
| FO-06 | Node 自动测试 | CRUD、跨用户访问、重复消息 ID、4000/10000 字符边界、删除会话 | 数据过滤、幂等、长度限制、删除级联正确 | **通过**。4/4 | 会话安全、删除 |
| FO-07 | 生产构建 | `npm run build` | 构建退出码 0 | **通过**。仅既有动态导入与大 chunk 警告 | 可交付性 |

## Dify 平台优势落点

1. **Chatflow 连续上下文**：前端只持久化并回传 Dify `conversation_id`，不在本地重复实现上下文编排。
2. **结构化变量编排**：复用现有 Workflow 已声明的 `intent_judgement=daily`、`custom_background`、`scene_title`、`roles`、`role_switch_instruction`；本地 `focus_topic` 映射到 `custom_background`，不改线上输入契约。
3. **Workflow 表达提取**：AI 回复复用现有 `/api/vocab/purify` Dify 流程，前端只负责候选确认。
4. **流式体验**：复用现有口语 SSE 通道；兼容 `dialogue`、`answer`、`message`、Markdown JSON fence 与纯文本。
5. **职责边界**：Dify 负责生成与提取；现有字典模块负责释义补齐、分类、生词本持久化。

## 自动化命令与结果

```text
npx tsx --test src/components/modules/freeOral/freeOralModel.test.ts  → 4/4 pass
node vocab-server/tests/freeOralSessions.test.js                     → 4/4 pass
node vocab-server/tests/freeOralApiContract.test.js                  → pass
node vocab-server/tests/freeOralFrontendContract.test.js             → pass
node --check vocab-server/server.js                                  → pass
node --check vocab-server/services/freeOralSessions.js               → pass
git diff --check                                                     → pass（仅行尾转换警告）
npm run build                                                        → pass
```

## 失败案例与风险

- 本轮目标功能无失败用例。
- 浏览器日志中的旧 `StayAnalysisPanel` 报错发生于 Mock 修复前；稳定加载后的验收窗口无新增错误。
- 已核对 `yml/English_Oral_Sandbox (9).yml`：现有 `daily` 分支消费 `custom_background`；契约测试防止误传未声明变量。
- `npm run lint` 仍有 3 个既有 TypeScript 错误：`DictionaryUtilityViews.tsx` 两处、`dailyPackAPI.ts` 一处；与本功能无关。
- 大 chunk 与动态导入警告为既有构建债务，未在本次范围扩改。

---

## 真实 Dify 链路复验（2026-09-04）

- **页面环境**：`http://localhost:3000/`，最新本地 Vite 前端通过代理连接生产后端 `https://app.liujingzhuwo.site/`
- **Dify 环境**：生产独立应用 `English_Free_Oral_Conversation`
- **测试账号**：`lzhumy`
- **测试主题**：`sustainable travel`
- **测试消息**：`I want to visit London sustainably. What should I prepare first?`

| 编号 | 菜单路径 / 页面 | 测试输入与操作 | 预期结果 | 实际结果 | 对应需求 |
|---|---|---|---|---|---|
| FO-08 | 英语学习 → 口语练习 | 点击「自由即兴对话」 | 显示历史栏、主题状态和消息输入框 | **通过**。入口正常；此前缺失误判由旧 Vite 进程占用 `3000` 端口导致 | 自由口语入口 |
| FO-09 | 自由即兴对话 | `/focus sustainable travel` | 更新标题、主题状态并持久化 | **通过**。显示「当前主题：sustainable travel」及更新成功状态 | `/focus` 指令 |
| FO-10 | 自由即兴对话 | 发送 `I want to visit London sustainably. What should I prepare first?` | 真实 Dify 返回围绕主题的英文回复 | **通过**。返回伦敦可持续出行准备建议，非 Mock 数据 | 独立 Dify 主链路 |
| FO-11 | 会话详情 API | 刷新后读取当前会话 | 标题、主题、消息及 Dify 会话 ID 恢复 | **通过**。`title=sustainable travel`、`focus=sustainable travel`、`messages=3`、`conversationId=true` | 消息落库、刷新恢复 |
| FO-12 | 自动契约 | `node vocab-server/tests/freeOralFrontendContract.test.js` | 自由口语入口与前后端契约通过 | **通过** | 发布门禁 |

### 复验结论

真实 Dify 主链路通过：入口、主题更新、AI 回复、SQLite 落库、`conversationId` 持久化均符合预期。未发现需要新增代码的缺口。

### 现存风险

- 生产服务器 `150.158.34.217:443` 曾出现一次 `ETIMEDOUT`；重试后链路成功，判断为网络可用性波动，不是自由口语代码错误。
- 生产前端静态资源尚未包含本地最新自由口语 UI；本轮通过最新本地前端连接生产后端完成验收。正式上线前仍需部署前端静态包并在生产域名复验。
- 当前实现使用阻塞响应；30 秒超时与失败重发已覆盖。若真实响应长期接近超时，再评估 SSE，不在本轮提前扩展。

---

# 统一弹层系统验收报告（2026-09-04）

- **环境**：`http://localhost:3000/`
- **测试账号**：`lzhumy`
- **改动范围**：锚定确认、短菜单、轻设置、Modal/Drawer/全屏弹层规范、原生阻塞提示迁移

## 功能测试

| 编号 | 菜单路径 / 页面 | 测试操作 | 预期结果 | 实际结果 | 对应需求 |
|---|---|---|---|---|---|
| OV-01 | 英语学习 → Dashboard → 学习材料库 | 点击「重置今日」 | 浮层靠近按钮，不遮挡按钮或 Tab | **通过**。按钮 `y=1030.75`，浮层位于上方 `y=885.75`，矩形无重叠 | 锚定与避让 |
| OV-02 | 「重置今日」确认浮层 | 按 `Esc` | 关闭浮层，不执行操作，焦点返回触发按钮 | **通过**。关闭后活动元素为「重置今日」 | 关闭与焦点恢复 |
| OV-03 | 顶部 Header | 点击声线按钮 | 菜单通过 Portal 显示并自动避让视口 | **通过**。菜单正常打开，未被 Dashboard 容器裁切 | 短菜单统一 |
| OV-04 | 源码契约 | 搜索 `confirm()`、`alert()` | 不再使用浏览器原生阻塞弹框 | **通过**。`src/` 匹配数为 0 | 原生弹框迁移 |
| OV-05 | 请求协调专项测试 | 并发确认、重复结算、Host 卸载 | 后请求取消前请求；仅匹配 ID 结算；卸载返回取消 | **通过**。3 个请求协调测试通过 | 并发与生命周期 |
| OV-06 | 定位专项测试 | 下方、上翻、水平边界、空间选择、超高浮层 | 不越界、不覆盖锚点 | **通过**。5 个定位测试通过 | 定位稳定性 |
| OV-07 | 复杂弹层契约 | Modal、Drawer、Lightbox、Popover、Confirm | 使用统一语义层级与视觉 token | **通过**。2 个源码契约测试通过 | 弹层系统统一 |

## 对抗审查与修复

- 修复 Host 卸载导致确认 Promise 永久等待。
- 修复并发请求陈旧回调可能结算新请求。
- 增加同步结算门闩，避免双击重复执行。
- 增加确认弹层 Tab / Shift+Tab 焦点循环。
- 统一 `panel=4000`、`popover=5000`、`confirm=6000` 语义层级，解决 RightPanel 遮挡确认层的问题。
- 超高浮层限制可用高度并内部滚动，不覆盖触发元素。
- 滚动与缩放定位使用 `requestAnimationFrame` 合并，位置不变时不触发状态更新。
- 修正 RightPanel 不完整的 `menu` ARIA 语义。

## 自动化验证

```text
npx tsx --test src/components/overlays/*.test.ts                                  → 8/8 pass
node --test vocab-server/tests/anchoredOverlayContract.test.js \
  vocab-server/tests/overlaySurfaceContract.test.js                              → 2/2 pass
npm run lint                                                                      → pass
npm run build                                                                     → pass
git diff --check                                                                  → pass
```

## 结论与风险

统一弹层主链路通过。短确认、菜单、轻设置采用锚定浮层；复杂表单、Drawer、阅读器及预览保留合理形态并统一视觉层级。未修改业务 API 或数据流程。

现存非阻断项：开发模式因组件文件同时导出 React 组件与命令式函数，会触发 Vite Fast Refresh 整页刷新提示；生产构建不受影响。
