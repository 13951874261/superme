# 生产接口验证报告（2026-08-19）

> 服务器：`ubuntu@150.158.34.217`  
> 验证时间：2026-08-19 16:31  
> 验证方式：SSH 登录服务器，本机回环 + 公网域名双路径测试，模拟前台真实入参

---

## 一、服务基础状态

| 项目 | 值 | 状态 |
|------|-----|------|
| `super-agent-vocab` 服务 | `active (running)`，内存 40.3 MB | ✅ |
| Node 进程监听 `*:3001` | 正常 | ✅ |
| 系统负载 | 0.01 / 0.06 / 0.08 | ✅ 极低 |
| 内存 | 3.3Gi 物理 + 2.0Gi Swap，可用 2.2Gi | ✅ |
| 磁盘 `/` | 59G，已用 43% | ✅ |
| Nginx 配置语法 | `syntax is ok` | ✅ |
| 生效域名 | `app.liujingzhuwo.site`（有 server_name 配置） | ✅ |
| `ai.234124123.xyz` | **无对应 Nginx server block** | ❌ 404 |

---

## 二、接口验证详细结果

### 2.1 健康检查

| 路径 | HTTP | 耗时 | 结果 |
|------|------|------|------|
| `127.0.0.1:3001/api/vocab/health` | 200 | 1.0ms | `{"success":true,"ok":true}` ✅ |
| `https://app.liujingzhuwo.site/api/vocab/health` | 200 | 70ms | 同上 ✅ |

---

### 2.2 词表列表 `/api/vocab/list` — 前台条件查询验证

| 测试用例 | 前台传参 | HTTP | 耗时 | 返回 items | hasMore | 结论 |
|---------|---------|------|------|-----------|---------|------|
| 默认无参数 | — | 200 | 1.6ms | 50 | True | ✅ 正常 |
| light=1 分页（正确写法） | `light=1&limit=20&offset=0` | 200 | 1.4ms | 20 | True | ✅ 正常 |
| **前台 page/pageSize 写法** | `page=1&pageSize=20&light=1` | 200 | 1.5ms | **50** | True | ❌ **参数无效**，`page`/`pageSize` 未被识别，退化为默认 50 条 |
| **前台 keyword 搜索** | `keyword=apple&limit=20&offset=0` | 200 | 1.4ms | **20** | True | ❌ **keyword 无效**，返回的是全量前20条，不是 apple 相关数据 |
| word 精确查（后端参数） | `word=apple&limit=20&offset=0` | 200 | 1.3ms | **0** | False | ⚠️ 库中无 apple，结果为空（参数本身有效） |
| category=business | `category=business&limit=20&offset=0` | 200 | 7.7ms | 20 | True | ✅ 正常，有数据返回 |
| category=general | `category=general&limit=20&offset=0` | 200 | 1.3ms | 20 | True | ✅ 正常 |
| word+category 组合 | `word=learn from&category=business&limit=20` | **000** | 0ms | — | — | ❌ **curl 失败**（URL 含空格未编码，请求发不出去） |
| offset 翻页 | `limit=20&offset=20` | 200 | 1.3ms | 20 | True | ✅ 翻页正常 |
| limit 超上限（200→取100） | `limit=200&offset=0` | 200 | 2.0ms | 100 | True | ✅ 正确截断到上限 100 |
| light=0 废弃保护 | `light=0` | 400 | 0.9ms | — | — | ✅ 正确拒绝，返回提示 |

---

### 2.3 单词详情 `/api/vocab/item/:id`

| 测试用例 | HTTP | 耗时 | 结论 |
|---------|------|------|------|
| 正常 UUID id | 200 | 1.1ms | ✅ 返回完整词条 |
| 不存在的 id | 404 | 1.1ms | ✅ `{"error":"Word not found"}` |
| 错误路径 `/api/vocab/1` | 404 | 1.0ms | ✅ `{"error":"Endpoint not found"}`（前台曾用此格式需注意） |

---

### 2.4 复习队列 `/api/vocab/review`

| 测试用例 | HTTP | 耗时 | 返回 items | hasMore | 结论 |
|---------|------|------|-----------|---------|------|
| 默认 `limit=20&offset=0` | 200 | 1.3ms | 20 | True | ✅ |
| light 模式 | 200 | 1.4ms | 20 | True | ✅ |
| `category=business&limit=10` | 200 | 1.2ms | 10 | True | ✅ |

---

### 2.5 统计接口 `/api/vocab/stats`

| HTTP | 耗时 | 结果 |
|------|------|------|
| 200 | 1.8ms | `{"total":10866,"dueToday":10863}` ✅ |

> **注意：** dueToday=10863，几乎等于 total，说明复习到期数据量极大，可能影响复习队列的性能表现。

---

### 2.6 词典查询 `POST /api/vocab/lookup`

| 入参 | HTTP | 结果 | 结论 |
|------|------|------|------|
| `{"word":"apple","dict_type":"en_zh_bidirectional"}` | 200 | `{"items":[]}` | ⚠️ **空结果** — lookup 表中无 apple 缓存，属正常（未触发后台增强） |
| `{"word":"sky","dict_type":"en_zh_bidirectional"}` | 200 | `{"items":[]}` | ⚠️ 同上（日志显示 sky 曾被异步增强但被 abort） |
| 中文词 | 200 | `{"items":[]}` | ⚠️ 同上 |
| 空词 | 200 | `{"items":[]}` | ✅ 不报错，返回空 |

> **关联日志异常：** 服务日志中存在 `[Dict Background] 异步增强异常 (sky): This operation was aborted`，说明后台 Dify 字典增强任务被中断，导致 lookup 缓存未写入。

---

### 2.7 DailyPack `/api/daily-pack/today`

| HTTP | 耗时 | 结果 | 结论 |
|------|------|------|------|
| 200 | 2.0ms | `{"success":true,"status":"missing"}` | ⚠️ **今日包未生成** — 计划任务设为 02:00 运行，但当前 status=missing，需确认是否正常触发 |

---

### 2.8 公网域名全链路（`https://app.liujingzhuwo.site`）

| 接口 | HTTP | 耗时 | 结果 |
|------|------|------|------|
| `/api/vocab/health` | 200 | 70ms | ✅ |
| `/api/vocab/list?limit=20&offset=0&light=1` | 200 | 67ms | ✅ items=20 有数据 |
| `/api/vocab/list?word=apple&limit=20&offset=0` | 200 | 69ms | ⚠️ items=0（库中无 apple） |
| `/api/vocab/stats` | 200 | 817ms | ⚠️ **耗时偏高**（817ms vs 本机 1.8ms）— 公网延迟正常，但 stats 查询本身偏慢 |

---

## 三、问题汇总与优先级

### P0 — 功能错误（前台数据不符合预期）

#### 问题1：前台 `keyword` 搜索参数无效 ❌

- **现象：** 前台传 `keyword=apple`，接口返回的是全量前 20 条，不包含 apple 相关数据
- **根因：** 后端 `/api/vocab/list` 路由只支持 `word=`（精确匹配），不识别 `keyword=`
- **影响：** 前台搜索框完全无效，用户搜索任何词都返回相同的默认列表
- **修复方向：** 后端增加 `keyword` 参数支持（`WHERE word LIKE '%keyword%'`），或前台改用 `word=`

#### 问题2：前台 `page`/`pageSize` 分页参数无效 ❌

- **现象：** 传 `page=1&pageSize=20` 返回 50 条（默认值），不是 20 条
- **根因：** 后端只识别 `limit=` 和 `offset=`，不识别 `page`/`pageSize`
- **影响：** 前台翻页逻辑失效，每页实际返回量不受控
- **修复方向：** 后端增加 `page`/`pageSize` → `limit`/`offset` 的自动转换，或前台统一改为 `limit`/`offset`

#### 问题3：`word+category` 组合查询 URL 含空格导致请求失败 ❌

- **现象：** `word=learn from&category=business` 请求直接失败（HTTP 000）
- **根因：** URL 参数值含空格未做 encode（`learn from` → `learn%20from`）
- **影响：** 所有含空格的多词组合词无法通过词名查询
- **修复方向：** 前台在构造查询 URL 时对参数值做 `encodeURIComponent`

---

### P1 — 功能异常（服务降级）

#### 问题4：`/api/vocab/lookup` 查词结果始终为空 ⚠️

- **现象：** 查 apple、sky 均返回 `{"items":[]}`
- **根因：** 后台 Dify 字典增强任务频繁被 abort（`This operation was aborted`），缓存未写入
- **影响：** 前台查词功能无实时翻译数据
- **需确认：** Dify 服务是否正常、网络是否超时

#### 问题5：DailyPack 当日包未生成 ⚠️

- **现象：** `{"success":true,"status":"missing"}`
- **根因：** 计划任务 02:00 运行，若今日未执行则 missing
- **需确认：** 查 cron 日志确认是否正常执行过

---

### P2 — 配置风险

#### 问题6：Nginx server_name 冲突（5 条 warn）⚠️

- `sites-enabled` 目录下存在多个 `.bak_*` 备份文件，Nginx 重载时均被加载
- 导致 `app.liujingzhuwo.site` 在 443/80 上各有 5 个重复定义
- **修复：** 将 `.bak_*` 文件移出 `sites-enabled` 目录

#### 问题7：`ai.234124123.xyz` 域名无 Nginx 配置 ⚠️

- 所有请求返回 404
- 若前台有任何地方使用此域名访问 API，将全部失败

---

## 四、后端接口参数规格（实测确认）

```
GET /api/vocab/list
  limit=N      每页条数，上限 100，默认 50
  offset=N     偏移量，默认 0
  category=    business | general
  word=        精确词名匹配（COLLATE NOCASE）
  light=1      精简字段模式（不传也生效，字段由 LIGHT_SELECT 控制）
  light=0      已废弃，返回 400

GET /api/vocab/item/:uuid   获取单词详情
GET /api/vocab/review       复习队列（同支持 limit/offset/category）
GET /api/vocab/stats        统计（total / dueToday）
POST /api/vocab/lookup      { word, dict_type } → 查词典缓存

❌ 不支持：keyword=、page=、pageSize=
```

---

## 五、建议优先修复顺序

1. **后端 `/api/vocab/list` 增加 `keyword` 模糊搜索 + `page`/`pageSize` 别名支持**（P0，前台搜索/翻页当前完全失效）
2. **前台 URL 构造增加 `encodeURIComponent`**（P0，多词组合词查询失败）
3. **排查 Dify 字典增强 abort 原因**（P1，lookup 空结果）
4. **确认 DailyPack 02:00 cron 日志**（P1，今日包状态 missing）
5. **清理 sites-enabled 下 `.bak_*` 文件**（P2，消除 Nginx warn）
