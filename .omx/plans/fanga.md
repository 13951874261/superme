# 词表/API 性能方案（生产复验修订）Implementation Plan

> **本文性质：冻结规格（source of truth），不是待自动执行的实施清单。**  
> **For agentic workers:** 本会话唯一可执行任务是 Task 1（写/修本文件）。附录 A/B 的回归命令**没有** `- [ ]`，SDD **不得**自动派发 implementer 去跑测试、SSH、或改生产。用户口头确认「跑回归」后另开会话，再用 executing-plans。  
> **本会话交付范围：** 只写入本文件。不得改 PostgreSQL / 安装 Redis / 改 Nginx / 改 `vocab-server` 代码，除非用户另开需求并明确同意。  
> **对照 PRD：** `.omx/plans/prd-vocab-table-query-perf.md`（`VOCAB-Q-PERF-01`）、`.omx/plans/prd-perf-sla-3s-10s.md`（`PERF-SLA-01`）  
> **复验日期：** 2026-08-19（SSH `ubuntu@150.158.34.217`，只读）

**Goal:** 用生产证据替换「调 PostgreSQL `shared_buffers` + 部署 Redis + 优化 Nginx 连接、预期提升 30–90%」的旧四级方案，冻结错误热路径，并把验收指标改到真正决定词表接口耗时的请求体积与分页。

**Architecture:** 浏览器走 Nginx `/api/` 反代到本机 `127.0.0.1:3001` 的 Node `vocab-server`；词表与覆盖率读 **SQLite** `/var/www/super-agent/vocab.db`。Dify 走 Nginx `/dify/` 反代到远程 `dify.234124123.xyz`，不经过本机 5432。本机 PostgreSQL 14 是空闲实例（库约 8.5MB、无业务连接），不在词表热路径上。

**Tech Stack:** Nginx · Node.js/Express · better-sqlite3 · 生产 `vocab.db`（WAL）· systemd `super-agent-vocab` · 远程 Dify HTTP API（非本机 PG/Redis）

---

## 0. 需求复述与示例对齐

用户要的是：把上次 SSH 探索给出的四级优化方案，按生产复验结果**改写成可执行、可验收、且不会误伤本机的方案**，写入本文件。

**示例（必须以此为准，不得再按 PG 缓存讲词表变快）：**

```
旧路径（已过时，PRD 探针）：
GET /api/vocab/list?light=1     → ~9998 行裸数组，3.65MB，5.8–6.2s

复验当日生产（本机回环）：
GET http://127.0.0.1:3001/api/vocab/list?light=1
  → HTTP 200，21864 字节，1.5ms
  → JSON 形状 { items: [最多 50 条 light 行], hasMore: true }

错误动作：把 PostgreSQL shared_buffers 从 128MB 调到 1GB
  → 上述请求仍不进 PG，1.5ms 不会变成「快 30–90%」
  → 3.3Gi 无 swap 机器上还可能挤占 whisper-server（RSS ~571MB）
```

---

## 1. 复验证据（2026-08-19）

### 1.1 主机不是 CPU/连接打满

| 项 | 值 |
|----|-----|
| load average | 0.22 / 0.15 / 0.08 |
| 内存 | 3.3Gi 物理，**无 swap**，available ≈ 1.4Gi |
| 磁盘 | `/` 59G，已用 20G（34%） |
| 词表进程 | `super-agent-vocab: active`，监听 `*:3001` |
| 最大 RSS | `whisper-server` ≈ 571MB；`vocab-server` ≈ 99MB |

### 1.2 热路径数据库是 SQLite，不是 PostgreSQL

| 项 | 值 |
|----|-----|
| 文件 | `/var/www/super-agent/vocab.db` |
| 类型 | SQLite 3.x，692MB（WAL 6.0MB） |
| `vocabulary` | 10855 行（到期 10852）。相对同日 PRD 探针 9998/9995，各 +857，为两次只读探针之间的写入增量，不是笔误 |
| `dict_query_log` | 112855 行（相对同日 PRD 探针 112830，+25，同为两次探针之间的写入） |
| 代码 | `vocab-server/server.js`：`require('better-sqlite3')`；**无** `pg` / redis 客户端 |

### 1.3 PostgreSQL 存在但空闲

| 项 | 值 |
|----|-----|
| 服务 | `postgresql: active`，仅 `127.0.0.1:5432` |
| 版本 | PostgreSQL 14 |
| `shared_buffers` | 128MB（上游默认值，不是「被调坏」） |
| `effective_cache_size` | 4GB（**超过** 3.3Gi 物理内存；仅为规划器提示） |
| 库体积 | `postgres` / `app_db` / template 均约 **8.5MB** |
| 会话 | 除探测 `psql` 外无业务 `application_name` |
| 主进程 RSS | ≈ 18MB |

Dify 不走这台 PG：`/etc/nginx/sites-enabled/app.liujingzhuwo.site` 中 `set $dify_upstream "dify.234124123.xyz"`。

### 1.4 Redis 未部署 — 事实正确，但不是词表慢因

- `redis` / `redis-server`：inactive
- 无 6379 监听，无 `redis-cli`
- `VOCAB-Q-PERF-01` Non-Goals：**不引入第二套数据库或 Redis**

### 1.5 词表接口当日回环耗时（已分页）

| 接口 | HTTP | 体积 | 耗时 |
|------|------|------|------|
| `/api/vocab/health` | 200 | 51B | 1.0ms |
| `/api/vocab/list?light=1` | 200 | 21.8KB | 1.5ms |
| `/api/vocab/list?light=1&limit=50&offset=0` | 200 | 21.8KB | 1.5ms |
| `/api/vocab/review?light=1` | 200 | 16.2KB | 1.5ms |
| `/api/dify/dict-coverage` | 200 | 209B | 4.3ms |

覆盖率响应键仍为：`success` / `total_queries` / `success_queries` / `success_rate` / `level_distribution`（当日 `total_queries=112855`）。

### 1.6 Nginx 现状

- `/api/`：`proxy_pass http://127.0.0.1:3001;` 且 `proxy_http_version 1.1;`
- 站点内已有 `proxy_cache off;`
- `worker_connections 768;`，`gzip on;`
- 配置中**没有**针对词表 API 的 keepalive 调优项
- 连接复用最多省 TLS 握手，解释不了旧的 5.8s / 3.65MB 全量 JSON

---

## 2. 旧四级方案判定（不可采用）

| 旧分级 | 旧动作 | 判定 | 原因 |
|--------|--------|------|------|
| 瓶颈 A | 增大 `shared_buffers`（128MB → 更大） | **禁止** | 词表请求不进 PG；空库 8.5MB；3.3Gi 无 swap 上加大缓存有 OOM 风险 |
| 瓶颈 B | 部署 Redis 缓存高频 API | **禁止** | 分页后 list/review 已 1.5ms / ~22KB；加 Redis 多一跳与失效逻辑；与 PRD 冲突 |
| 瓶颈 C | Nginx 连接管理作为主优化 | **降为非目标** | 已是 HTTP/1.1 反代；load 0.22；不是秒级瓶颈 |
| 收益 | 「响应性能提升 30–90%」 | **无依据** | 未对照旧 5.8s 路径做 before/after；对 1.5ms 接口该百分比无意义 |
| 验收 | 缓存命中率、连接复用 | **测错对象** | 词表路径没有 Redis；连接复用不衡量 3.65MB 序列化 |

**因果链（正确）：**

```
浏览器
  → Nginx :80/:443  /api/
  → Node :3001  vocab-server
  → SQLite vocab.db   ← 唯一业务库
Dify
  → Nginx /dify/  → https://dify.234124123.xyz
  → 不经过 127.0.0.1:5432
PostgreSQL :5432
  → 空闲，与词表 API 无边
Redis
  → 未安装，且不应为词表 API 新增
```

---

## 3. 修订后的分级（可执行）

### P0 — 保持已落地的应用层收缩（主杠杆，已完成，只回归）

服务端强制分页 + 覆盖率聚合。禁止再回到全量数组。

已存在实现锚点：

- `vocab-server/server.js`：`GET /api/vocab/list`、`GET /api/vocab/review` 拒绝 `light=0`，`limit` 缺省 50、上限 100，响应 `{ items, hasMore }`
- `vocab-server/server.js`：`GET /api/dify/dict-coverage` 使用 `COUNT(*)` 与 `GROUP BY level`，不 `SELECT response_payload`
- 前端：`src/services/vocabAPI.ts` 的 `getAllWords` 强制 `limit`；`src/components/RightPanel.tsx` 用 `getVocabByWord`；`src/components/modules/english/tabs/DashboardTab.tsx` 用 `lookupVocabWords`；`src/components/KnowledgeVault/KnowledgeVaultDrawer.tsx` 分页 `limit`+`offset`

**本轮不得再改这些路径**，除非回归失败。

### P1 — 回归门禁（规格内的验收方法；默认不自动执行）

用契约测试 + 生产只读 curl 钉死「不得回退到全量」。不引入缓存层。命令见附录 A/B，须用户确认后另开会话才跑。

### P2 — 非本文件实施：Dify 远程时延

秒级等待来自远程模型，不是本机 PG/Redis。跟踪 `PERF-SLA-01`（流式首包、任务中心），**禁止**用本机 `shared_buffers` 去「优化 Dify」。

### P3 — 非本文件实施：内存治理

`whisper-server` RSS ≈ 571MB 才是本机最大内存户。另开需求。禁止为 unused PG 再要几百 MB `shared_buffers`。

---

## 4. Non-Goals（冻结）

- 不修改 PostgreSQL `shared_buffers` / `effective_cache_size` / `work_mem`
- 不安装、不启用 Redis，不在 `vocab-server` 增加 redis 客户端
- 不把 Nginx keepalive / `proxy_cache` 当词表 P0
- 不改 SM-2、词条 `payload` 字段名、覆盖率 JSON 键名
- 不把浏览器改为直连 Dify Key
- 不归档 `dict_query_log`（563MB 级 payload 历史）——属 `VOCAB-Q-PERF-01` v2
- 不在本轮改 `whisper-server` 启动参数

---

## 5. 文件地图（实施时只允许这些，且须另确认）

本会话：**只写** `.omx/plans/fanga.md`。

若用户日后确认「只做回归、不改生产配置」：

| 文件 | 职责 |
|------|------|
| `vocab-server/tests/vocabQueryPerf.test.js` | 服务端契约：分页、拒绝 light=0、coverage 不读 payload |
| `src/services/vocabAPI.test.ts` | 前端请求必须带 `limit` / 点查 / lookup |
| `vocab-server/server.js` | **只在回归失败时**修 list/review/coverage |
| `src/services/vocabAPI.ts` | **只在回归失败时**修 `getAllWords` 强制 limit |

禁止改：`/etc/postgresql/14/main/postgresql.conf`、Redis 安装脚本、Nginx keepalive 作为本方案交付。

---

## 6. 任务

### Task 1: 将本修订方案落盘为唯一源

**Files:**

- Create/overwrite: `.omx/plans/fanga.md`

- [x] **Step 1: 写入完整方案正文（本文件）**

本文件即为交付物。不得用「见 PRD」代替证据表、禁止项与测试用例。

- [x] **Step 2: 自检占位符**

全文不得出现 TBD / TODO / 稍后补充。命令必须可复制。

- [x] **Step 3: 规格审查与质量审查通过后，保持本文件为冻结稿**

审查只改本文件的事实错误或遗漏，不顺带改代码。本步在审查循环结束后勾选。

**Commit：** 用户未要求提交时不 `git commit`。

本节之后**没有** Task 2/3/4 checkbox。回归命令在附录 A/B；禁止动作在 §6.1。SDD 遇到附录不得当作未完成任务去执行。

---

### 6.1 永久禁止项（无 checkbox、禁止派发 implementer）

不是待办。把下面任何一行拿到 shell 里执行，即判定本方案失败。

| 意图 | 禁止动作（不可执行文本，不是脚本） |
|------|--------------------------------------|
| 调大 PG 缓存「优化词表」 | FORBIDDEN: change postgresql.conf shared_buffers to 1GB then restart postgresql |
| 为 list/review 装 Redis | FORBIDDEN: apt-get install redis-server ; enable --now redis-server |
| 用 Nginx keepalive 当词表 P0 交付 | FORBIDDEN: treat keepalive or proxy_cache as vocab SLA pass condition |

若有人坚持「PG 128MB 太小」：对该空闲实例，128MB **已经偏大**（库 8.5MB、RSS 18MB）。要动 PG 必须先证明有业务连接打进 `pg_stat_activity`，且单独开需求评估 3.3Gi 无 swap。本方案不授权。

---

## 7. 功能测试案例（一次一项）

对应需求：`VOCAB-Q-PERF-01` + 本次复验修订。

### FANGA-01 列表分页（先做）

- **菜单路径：** 英语引擎 → 打开生词本 / 词汇矩阵列表
- **测试数据：** 生产库 ≥9000 词；Network 出现 `GET /api/vocab/list?light=1&limit=50`（可带 `offset`/`category`）
- **预期结果：** ≤500ms；JSON `{ items, hasMore }`；`items.length≤50`；`hasMore === true`；body &lt; 100KB；**不得**出现 3MB+ 裸数组
- **对应需求：** P0 保持分页；否定「必须靠 Redis 才快」

### FANGA-02 拒绝 light=0

- **菜单路径：** 无（curl）
- **测试数据：** `GET /api/vocab/list?light=0`
- **预期结果：** HTTP 400；不得返回万行 payload
- **对应需求：** KPI 3

### FANGA-03 右侧栏点词

- **菜单路径：** 打开右侧词典/上下文 → 选已在生词本中的词（如 `strategy`）
- **测试数据：** 该词在 `vocabulary` 中存在
- **预期结果：** Network 为 `limit=1&word=` 或 `/api/vocab/item/:id`；不得出现缺少 `limit` 的 `/list` 或 `/review`；点查量级 ≤500ms
- **对应需求：** Story 2；`src/components/RightPanel.tsx` 使用 `getVocabByWord`

### FANGA-04 覆盖率不读 payload

- **菜单路径：** `GET /api/dify/dict-coverage`（或前端若有入口）
- **测试数据：** 生产库有成功日志
- **预期结果：** ≤500ms；键完整；服务端该次查询不读 `response_payload`（契约测试钉死）
- **对应需求：** Story 4

### FANGA-05 负例：基础设施方案不得作为通过条件

- **菜单路径：** 无（运维检查）
- **测试数据：** `SHOW shared_buffers;`、`ss -lnt | grep 6379`、Nginx keepalive 是否存在
- **预期结果：** **即使** `shared_buffers` 仍为 128MB、Redis 未安装、Nginx 未加 keepalive，只要 FANGA-01～04 通过，本方案即通过。不得因「没装 Redis」判失败。
- **对应需求：** 本次复验修订的核心否决项

---

## 8. 与旧「3 项测试用例」的替换关系

| 旧用例 | 处理 |
|--------|------|
| Redis 缓存命中率 | **删除**。词表路径无 Redis；命中率不预测 1.5ms vs 5.8s |
| 连接复用效果 | **删除作为通过条件**。Nginx 已是 `proxy_http_version 1.1`；keepalive 不进入本方案验收 |
| （未与全量 JSON 对照的）30–90% | **删除**。改用绝对 SLA：list/review/coverage 单次 &lt; 500ms 且 body &lt; 100KB；p95 见附录 B 的 20 次循环 |

---

## 9. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 把本文件当成「去调 PG」的授权 | OOM / 无效变更 | §6.1 禁止项；Non-Goals |
| 回归未跑就宣称完成 | 全量列表回潮 | 附录 A/B 未跑则只能说「方案已写」，不能说「生产已验收」 |
| 用户体感仍慢 | 误回到 Redis | 先区分：词表 HTTP vs 远程 Dify vs Whisper；分别走 VOCAB-Q-PERF / PERF-SLA-01 / 内存需求 |
| `getAllWords({ limit: 50 })` 仍被今日包调用 | 只得第一页 50 词 | 已知：`src/services/dailyPackAPI.ts`。若产品要「今日包含全部生词」须另开需求，不在本方案装 Redis 解决 |

---

## 10. 控制器执行约束（给 SDD）

1. **当前用户指令**优先：本会话只维护 `.omx/plans/fanga.md`。附录 A/B 无 checkbox，不得当未完成任务执行。
2. 不要为附录 A/B 而安装 Redis、改 PostgreSQL、reload Nginx、提交 git（除非用户后来说「跑回归」或「提交」）。
3. 审查子代理若建议「顺手调大 shared_buffers / 加 Redis」，视为 **spec 违规**，必须驳回。
4. 工作区：用户已打开 `.omx/plans/fanga.md`，在当前仓库原地写文件，不另开 worktree。

---

## 附录 A — 本地契约回归（门闩：用户确认「跑回归」后另开会话）

无 checkbox。Files：`vocab-server/tests/vocabQueryPerf.test.js`、`src/services/vocabAPI.test.ts`。在仓库根 `D:\cursor\work\super-agent` 用 PowerShell。

**A1 服务端契约**

```powershell
node vocab-server/tests/vocabQueryPerf.test.js
```

Expected stdout 含：`vocabQueryPerf.test.js contract checks passed successfully.`

断言必须继续覆盖：`list`/`review` 对 `light=0` 返回 400；SQL 含 `LIMIT ? OFFSET ?`，不含 `SELECT * FROM vocabulary`；`coverage` 含 `GROUP BY level`，不含 `SELECT response_payload FROM dict_query_log`。

**A2 前端请求契约**

`package.json` 已有 devDependency `tsx`。固定命令：

```powershell
npx tsx --test src/services/vocabAPI.test.ts
```

Expected: 全部 PASS，exit 0。

必须继续覆盖：

- `getAllWords()` → `/api/vocab/list?light=1&limit=50`
- `getAllWords({ limit: 20 })` → `limit=20`
- `getVocabByWord('strategy')` → `limit=1&word=strategy`
- `lookupVocabWords` → `POST /api/vocab/lookup`

**A3 冻结无 pg / redis 客户端**

```powershell
git grep -n -E 'ioredis|redis.createClient|require\(.pg.\)' -- vocab-server
```

Expected: 无业务命中（exit 1 表示无匹配，视为通过）。**禁止**为了让 grep「有输出」而安装 Redis。

---

## 附录 B — 生产只读验收（门闩：用户确认后 SSH；禁止写配置）

无 checkbox。控制器是 Windows。先登录生产，再在**远端 shell**执行 Linux 命令。目标是远端 `127.0.0.1:3001`，不是 Windows 本机 3001。

```powershell
ssh ubuntu@150.158.34.217
```

**B1 单次体积与时延 + light=0 + 热路径确认**

仅在已登录的 SSH 会话内执行（不要在 Windows 本机跑 curl）：

```
curl -s -o /tmp/v_health -w "health %{http_code} bytes=%{size_download} t=%{time_total}\n" "http://127.0.0.1:3001/api/vocab/health"
curl -s -o /tmp/v_list -w "list %{http_code} bytes=%{size_download} t=%{time_total}\n" "http://127.0.0.1:3001/api/vocab/list?light=1&limit=50&offset=0"
curl -s -o /tmp/v_review -w "review %{http_code} bytes=%{size_download} t=%{time_total}\n" "http://127.0.0.1:3001/api/vocab/review?light=1&limit=50"
curl -s -o /tmp/v_cov -w "coverage %{http_code} bytes=%{size_download} t=%{time_total}\n" "http://127.0.0.1:3001/api/dify/dict-coverage"
curl -s -o /tmp/v_l0 -w "light0 %{http_code} bytes=%{size_download}\n" "http://127.0.0.1:3001/api/vocab/list?light=0"
python3 -c "import json; d=json.load(open('/tmp/v_list')); assert 'items' in d and 'hasMore' in d; assert len(d['items'])<=50; assert d['hasMore'] is True; print('list items', len(d['items']), 'hasMore', d['hasMore']); c=json.load(open('/tmp/v_cov')); assert all(k in c for k in ['success','total_queries','success_queries','success_rate','level_distribution']); print('coverage keys ok', c['total_queries'], c['success_queries'])"
file /var/www/super-agent/vocab.db
ss -lnt | grep -E '5432|6379|3001' || true
systemctl is-active redis || true
systemctl is-active redis-server || true
systemctl is-active postgresql || true
systemctl is-active super-agent-vocab || true
```

单次通过标准（出处：§1.5 2026-08-19 回环；允许抖动）：

| 项 | 通过标准 |
|----|----------|
| health | 200；bytes 约 51；t &lt; 50ms（当日 1.0ms） |
| list/review | 200；bytes **&lt; 100000**（当日 21.8KB / 16.2KB）；**单次** t &lt; 500ms（当日 ≈ 1.5ms） |
| coverage | 200；bytes 约 209（&lt; 2KB 来自当日 209B，不是另立 KPI）；单次 t &lt; 500ms（当日 4.3ms） |
| light=0 | **400**，非万行数组 |
| list JSON | `{items,hasMore}`，`len(items)≤50`，库 ≥9000 词时 `hasMore===true` |
| coverage JSON | 五键完整 |
| vocab.db | `file` 输出含 SQLite |
| 端口 | 有 `3001`；`5432` 仅本机；**无 6379 行** |
| systemd | `super-agent-vocab` 为 `active`；`postgresql` 可以为 `active`（不得当词表已优化证据）；`redis` / `redis-server` 为 `inactive` **或** `unknown` **或** `not-found` **均为通过**。禁止为把该行变成 `inactive` 而安装 Redis |

禁止在 SSH 内执行：`ALTER SYSTEM`、改 `postgresql.conf`、`apt install redis`、`nginx -s reload`。

**B2 p95（与 VOCAB-Q-PERF-01 KPI 对齐；可选）**

单次合格 ≠ p95。用户确认「测 p95」后再在同一 SSH 会话执行。list 连续 20 次，p95 ≤ 500ms 且每次 body &lt; 100KB：

```
python3 -c "import subprocess; url='http://127.0.0.1:3001/api/vocab/list?light=1&limit=50&offset=0'; times=[]; sizes=[]
for i in range(20):
    out=subprocess.check_output(['curl','-s','-o','/tmp/v_p95','-w','%{http_code} %{size_download} %{time_total}', url], text=True); code,size,t=out.split(); assert code=='200'; times.append(float(t)); sizes.append(int(size))
times.sort(); p95=times[int(0.95*(len(times)-1))]; print('n=20 max_bytes', max(sizes), 'p95_s', round(p95,4), 'max_s', round(max(times),4)); assert max(sizes)<100000; assert p95<=0.5"
```

Expected: 打印 `p95_s` ≤ 0.5 且 `max_bytes` &lt; 100000。对 `/api/vocab/review?light=1&limit=50` 与 `/api/dify/dict-coverage` 换 URL 各跑一轮（一次一项）。

---

## 11. Self-review（作者）

- Spec 覆盖：旧瓶颈三项均有判定；生产证据有表；禁止项无 bash 围栏；测试用例五项且一次一项；与 `VOCAB-Q-PERF-01` KPI 对齐。
- 占位符扫描：无 TBD/TODO；前端测试命令固定为 `npx tsx --test`。
- 类型/契约一致性：`{ items, hasMore }`、coverage 五键、limit 缺省 50 上限 100、`POST /api/vocab/lookup`，与现 `server.js` / `vocabAPI.test.ts` 一致。
- 未把 P2/P3 写成本轮代码任务；附录无 `- [ ]`，避免 SDD 自动打生产。
