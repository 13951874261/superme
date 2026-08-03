# 设计：Daily Pack / 长文 按 Dify 稳定入参读写对齐

**日期：** 2026-08-03  
**状态：** 已实现（待部署验证）  
**来源决策：** D1 + F1 + L1；用户口头确认「同意」设计方案；「继续」后 inline 实施  

## 1. 问题

当前唤醒/破绽与长文存在「生成入参」与「读取条件」不对齐：

- `daily_packs`：生成会算 `input_signature`，但 `upsertDailyPack` 压成「同用户同日一行」覆盖；`/api/daily-pack/today` 传 `null` 签名，只取任意 `ready`。
- 落库 `theme` 可能被 Dify 输出 `wakeup.theme` 覆盖（例：入参「商务谈判…」→ 库内「商务沟通」）。
- 前端唤醒 mount 用空 `historyExclude/profile`，破绽用 `buildDailyPackQueryInput`，同一页两套 today 键。
- 长文表虽有 `theme+genre+cefr+duration` UNIQUE，但读取存在**忽略 theme** 及跨表宽兜底，与 Dify 稳定入参不完全一致。

## 2. 目标

写入与读取使用**同一套稳定 Dify 入参**作为缓存键；命中则毫秒级返回缓存，未命中返回 missing/无缓存（不自动调 Dify，沿用 U1）。

## 3. 非目标

- 不修改 Dify 工作流定义本身
- `_system_time` / `_system_timestamp_ms` **永不**进入缓存键
- 不做 UI 大改版（仅必要读参对齐）
- 不在本规格内重新开启 login-catchup（保持 N1）

## 4. 缓存键定义

### 4.1 唤醒 / 破绽（D1 + F1）

Dify 唤醒工作流入参：

| 字段 | 是否进键 |
|------|----------|
| `theme` | 是（**用户主题**；破绽调用里带 Salt 的 dynamicTheme **不进键**） |
| `history_exclude` | 是 |
| `user_current_profile` | 是 |
| `_system_time` | 否 |
| `_system_timestamp_ms` | 否 |

签名：沿用 `computeInputSignature(theme, historyExclude, userCurrentProfile)`（sha256 截断 16 位）。

库内 `theme` 列：必须等于**请求入参主题**，禁止 `wakeup.theme || theme` 覆盖。

### 4.2 长文（L1）

Dify mastery / 长文相关稳定入参：

| 字段 | 是否进键 |
|------|----------|
| `theme` | 是 |
| `genre` | 是 |
| `cefr_level` | 是 |
| `duration` | 是 |
| `history_exclude` | 是 |
| `user_flaws` | 是 |
| `user_current_profile` | 是 |
| `_system_*` | 否 |

新增/统一 `computeListenArticleInputSignature({ theme, genre, cefrLevel, duration, historyExclude, userFlaws, userCurrentProfile })`。

说明：现有 `computeDailyArticleInputSignature({ topic, materialText, ... })` 与真实 Dify 入参不一致，实现时以本表为准迁移/替换调用点，避免两套签名并存。

## 5. 数据与接口行为

### 5.1 `daily_packs`

- UNIQUE 语义恢复/坚持：`(user_id, pack_date, input_signature)`
- `upsertDailyPack`：按 `user_id + pack_date + input_signature` 定位；**禁止**仅按 `user_id + pack_date` 覆盖不同签名行
- `GET /api/daily-pack/today`：用 query 的 `theme` / `historyExclude` / `userCurrentProfile` 计算签名后精确查询；未命中 → `{ status: 'missing' }`
- 别名 `lzhmy`/`lzhumy`：仍可在候选 user 上查，但签名条件不变

### 5.2 前端 daily pack

- `DailyWakeupModule` mount / 刷新：与破绽一致，统一 `buildDailyPackQueryInput(theme)` 后再 `getTodayDailyPack`
- inflight 键与签名字段一致，避免空参/满参双打错包

### 5.3 长文表与读路径

涉及表（按现有库）：

- `daily_listen_articles`
- `daily_listen_audios`
- `daily_extracted_articles`（镜像/前端 extract 读）

行为：

- 写入时计算并保存 L1 `input_signature`
- 读取（`/api/listen/pregenerated`、`/api/english/daily-extract/article` 等）按相同签名（或等价字段全集）精确命中
- **删除** `getArticleRow` / `getAudioRow` 中「忽略 theme」兜底，以及「无 listen 则宽匹配 extracted」导致错主题命中的路径
- 未命中：返回无缓存 / `canBackfill` 等现有契约中表示缺缓存的状态；不自动 Dify

Cron / force-generate：生成时必须传入完整稳定入参并写入签名；cron 侧 history/flaws/profile 取与线上生成一致的来源（词库/档案），避免「cron 空参写、前端满参读」永久 miss。

## 6. 兼容与迁移

- 旧行可能无签名或签名按旧规则：读精确 miss 时**不**回退到宽匹配（与 L1/严格对齐一致）；用户手动生成或次日 cron 写入新键
- 可选运维：提供只读诊断脚本，打印某用户当日 packs/listen 的 theme + signature 摘要（非本规格必做）

## 7. 验收标准

1. 用主题 T + 固定 history/profile 生成唤醒/破绽后，相同三项读 → `ready`，且库 `theme === T`
2. 仅改 theme 或 history 任一 → `missing`
3. 破绽两次生成 Salt 不同，但用户主题与 history/profile 相同 → 同一 signature（可覆盖同键，不另开键）
4. 长文：相同 L1 七元组读 → hit；改任一字段 → miss
5. 前端 Network：today 请求的 history/profile 与生成时一致（唤醒与破绽同一套）
6. 回归：login-ping 仍 `catchupScheduled: false`（N1）

## 8. 主要触点（实现指引）

| 区域 | 文件（预期） |
|------|----------------|
| Pack 签名/upsert/读 | `vocab-server/services/dailyPackService.js` |
| today / regenerate | `vocab-server/server.js` |
| Listen 读写与兜底删除 | `vocab-server/services/dailyListenPreGenerateService.js` |
| Extract 读/写签名 | `vocab-server/server.js`（daily-extract 路径） |
| 前端读参统一 | `src/components/modules/DailyWakeupModule.tsx`、`dailyPackAPI.ts` |
| 测试 | `vocab-server/scripts/test-*.js` 增补签名读写与「无宽兜底」用例 |

## 9. 决策摘要

| 代号 | 决议 |
|------|------|
| D1 | 唤醒键 = theme + history_exclude + user_current_profile |
| F1 | 破绽 Salt 不进键 |
| L1 | 长文键 = theme+genre+cefr+duration+history_exclude+user_flaws+user_current_profile |
| 范围 | daily_packs + 长文相关表/读接口 |

## 10. 自检记录

- [x] 无 TBD/占位未决项（旧数据策略已定为不宽回退）
- [x] 与 N1/U1 无冲突
- [x] D1/F1/L1 与正文键表一致
- [x] 未混入长文 vocab 空数组修复等无关范围
