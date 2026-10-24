# Deep Interview Spec: account-data-isolation

**Profile:** standard (threshold ≤ 0.20)  
**Type:** brownfield  
**Rounds:** 7  
**Final ambiguity:** ~0.11  
**Threshold:** 0.20  
**Context snapshot:** `.omx/context/account-data-isolation-20260830T090530Z.md`  
**Interview transcript:** `.omx/interviews/account-data-isolation-20260830T091902Z.md`  
**Prompt-safe initial-context summary:** not_needed  
**Date:** 2026-08-30

## Clarity breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.90 | 同机换号后界面不得出现上一账号学习数据 |
| Outcome | 0.90 | 分桶 + 服务端补齐缺失态，换回可恢复 |
| Scope | 0.90 | 重拉已有资源；只上云服务端没有的学习态 |
| Constraints | 0.88 | 非目标五项已钉 |
| Success | 0.82 | 换号/换回两条可测路径 |
| Context | 0.92 | 登录、画像合并、localStorage、日包/生词路径已核对 |

## Intent

受邀账号会在同一浏览器交替登录。产品承诺「因您而变」，康奈尔画像、复盘瑕疵、生词、长文等个性化内容若串到下一账号，即本轮失败。

主失败面是 **同机换号串界面**，不是「知道账号名就能打 API」（邀请登录规格已接受无密码）。

## Desired Outcome

同一浏览器：

1. `lzhmy` 使用后改登 `alice`：康奈尔、生词本、长文、唤醒、破绽及各模块学习界面只显示 `alice` 的数据或空态，**不得**出现 `lzhmy` 的画像/复盘/生词/长文。
2. 再改回 `lzhmy`：康奈尔复盘/夜话/下周计划等本轮上云的数据从该账号服务端恢复；生词/日包/长文/画像按 `user_id=lzhmy` 重拉。
3. 背景、音效、拦截器等界面偏好可仍是整机一份。

示例：`lzhmy` 画像含「对抗性沟通怯懦」，复盘瑕疵为「商务英文听辨断层」。`alice` 登录后康奈尔左栏不得出现这两段文字；`alice` 无数据时应为「暂无短板」类空态，且不得把 `lzhmy` 的本地画像 `POST` 成 `alice` 的服务端画像。

## In-Scope

1. **登录换号切数据**
   - `initializeUserSession` / `ensureAppUserId` 在 userId 变化时：按新账号加载，禁止用旧账号本地画像覆盖新账号服务端。
   - 学习类 localStorage 按账号分桶（可复用 `sa_vocab_review_light_v1:${userId}:` 模式）。
2. **服务端已有资源：换号后按当前 `userId` 重拉，不双写**
   - 画像 / 记忆层 / 错误账本（`user_memories`）
   - 生词列表
   - 每日唤醒 / 破绽（`daily_packs`）
   - 长文 / 精听
   - 主题偏好（`user_theme_prefs`）
3. **服务端还没有的学习态：按账号新建存储**
   - 双周复盘历史、上次复盘日期
   - 夜话全文、下周训练计划
   - 难度调整、暂停模块
   - 其它只存在浏览器的模块学习草稿（如口语弱点日志）；执行方可在实现时补齐发现的键，但不得把界面偏好算进去
4. **缺省 userId**
   - 学习相关请求缺少 userId 时，不得再静默落到 `lzhmy`（可改为拒绝或空结果）。

## Out-of-Scope / Non-goals

- 不加 session token，不为全部 `/api/*` 加登录中间件（维持 `docs/superpowers/specs/2026-08-30-invite-only-login-design.md`）
- 背景、音效、拦截器、默认音色等界面偏好不按账号拆
- 本轮不修生成串号：`getHistoryExclude` 扫全站生词、`clear-today` 误删别人词
- 不追查、不回滚已经写到错误账号上的历史服务端数据
- 不改康奈尔或模块视觉布局
- 不把已在服务端的长文/生词再双写一份
- 不重做 Dify 嵌入会话体系（除非换号后发现会话串号且不改无法满足界面隔离——若发生须先问用户）

## Decision Boundaries

**代理可自决：**

- localStorage 键前缀格式
- 复盘/夜话落在现有 `user_memories` JSON 还是新表
- 换号时重拉/清视图的顺序
- 缺省 userId 从 `lzhmy` 改为拒绝或空
- 模块草稿键清单的增补（学习态 vs 偏好的归类）
- 测试写法（同一 origin 模拟换号即可）

**必须先问用户：**

- 扩大到生成串号 / session 中间件 / UI 改版
- 历史脏数据回滚
- 把界面偏好也按账号隔离
- 偏离本 spec 的范围变更

## Constraints

- AGENTS.md：中文沟通；实现阶段仍需用户确认后再改产品代码（本 deep-interview 不直接实现）
- 邀请制登录：无密码、刷新需再填账号、`lzhmy` 与 `lzhumy` 为两个独立账号
- 优先复用现有 `user_id` 分库存，不新造无关抽象
- 最小 diff：只改数据归属与换号加载，不动无关模块行为

## Testable acceptance criteria

按顺序，前一项通过再做下一项。

### 用例 1：换号后康奈尔不串画像/复盘

- 路径：登录页输入账号 → 进入系统 → 首页康奈尔摘要区
- 数据：`lzhmy` 已有画像「对抗性沟通怯懦」和复盘瑕疵；`alice` 为受邀账号且服务端画像为空
- 预期：改登 `alice` 后左栏为暂无/空，不得出现 `lzhmy` 的画像或瑕疵；不得把 `lzhmy` 画像写入 `alice` 的 `user_memories`

### 用例 2：换号后生词/长文不串

- 路径：英语引擎生词本 + 长文阅读区
- 数据：`lzhmy` 生词本有 `leverage`，长文区有已生成文章
- 预期：`alice` 生词本不含 `leverage`；长文区不是 `lzhmy` 那篇（空或 alice 自己的包）

### 用例 3：换回原账号可恢复复盘/夜话

- 路径：`lzhmy` 完成一次夜话或复盘 → 改登 `alice` → 再登 `lzhmy`
- 预期：`lzhmy` 的复盘日期、瑕疵、夜话/下周计划仍在（从该账号服务端恢复或分桶本地命中且与服务器一致）

### 用例 4：界面偏好仍共用

- 路径：`lzhmy` 关闭背景或音效 → 改登 `alice`
- 预期：`alice` 仍使用同一套背景/音效设置

### 用例 5：对应需求

- 需求：学习数据随当前登录账号隔离，不允许账号间复用
- 非需求：session、生成排除表、清今日跨用户、历史回滚、视觉改版

## Assumptions exposed + resolutions

| 假设 | 决议 |
|------|------|
| 方案 A 包含生成串号 | Round 1+6：本轮主失败是界面串号；生成串号列为非目标 |
| 分桶即可交差 | Round 3：否决；本轮必须上云以便换回恢复 |
| 「全部学习缓存上云」= 长文双写 | Round 5：否决；已有资源重拉，只补缺失态 |
| 知道账号就能打 API 必须一起修 | Round 6：否决；维持邀请登录规格 |

## Pressure-pass findings

- Round 3 压 Round 2：上云是恢复能力，用户仍要求本轮做。
- Round 5 压 Round 4：术语「学习本地缓存」收敛为「服务端缺失的学习态」，避免双写。

## Brownfield evidence vs inference

- **Evidence:** 画像合并会把本地旧画像推给新 userId；复盘键未分账号；日包/生词表有 `user_id`；邀请登录规格明确不加 API 中间件。
- **Inference:** 同机换号是用户可复现的主路径；DevTools 翻另一账号分桶数据可接受（用户未选 wipe）。

## Docs / Terminology Ledger

| 来源 | 用语 | 本 spec 采用 |
|------|------|----------------|
| 用户 | 隔离、不允许复用 | 同机换号后界面与加载数据只属当前账号 |
| 邀请登录规格 | 不加 API 中间件 | 本轮非目标 |
| 职业路径计划「账号隔离」 | 仅 career 随 User ID | 本任务范围更大，不沿用该窄义 |
| lzhmy-daily-pack-missing 非目标 | 不做多账号体系重构 | 已被本任务覆盖；本 spec 取代该条对本主题的约束 |
| 代码 `parseVocabUserId` 默认 `lzhmy` | 缺省主账号 | 本轮改为拒绝/空，防止读到主账号词表 |

可选后续（opt-in，不自动写公开文档）：在邀请登录规格开放问题中注明「账号学习数据隔离见本 spec」。

## Technical context findings

- 换号入口：`LoginPage` → `initializeUserSession`；无登出清缓存。
- 高风险写脏：`loadUserProfileFromServer` 在新账号空/更旧时 `syncProfileToServer(localRaw)`。
- 分桶范例：`src/services/vocabAPI.ts` `sa_vocab_review_light_v1:${userId}:${category}`。
- 生词 by-id 无归属校验：本轮非目标（生成/IDOR 大修），但列表必须带当前 userId；缺省不得落到 `lzhmy`。

## Full condensed transcript

见 `.omx/interviews/account-data-isolation-20260830T091902Z.md`。
