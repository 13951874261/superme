# Test Spec：账号学习数据隔离

> PRD: `.omx/plans/prd-account-data-isolation.md` R2  
> Requirements: `.omx/specs/deep-interview-account-data-isolation.md`  
> DELIBERATE: unit / integration / e2e / observability

## 1. Unit

| ID | Case | Expected |
|----|------|----------|
| U1 | `learnKey('alice',…)` vs `lzhmy` | 键不同，读写互不覆盖 |
| U2 | `super_agent_bg_enabled` | 不包装账号前缀 |
| U3 | load alice、本地全局/他桶仍是 lzhmy 画像、alice 服务端空 | 不得 POST 到 alice；alice 桶画像空 |
| U4 | HTTP 失败 / `!res.ok` | 不得用他账号内容回写当前 userId |
| U5 | alice 服务端画像新、本地桶空 | 写入 alice 桶，不改 lzhmy 桶 |
| U6 | `getLastReviewDate` 空账号 | 不写 `Date.now()` |
| U7 | `parseVocabUserId` 无 userId | helper 空；路由 400，不回落 `lzhmy` |
| U8 | learning_ui JSON roundtrip | 复盘/夜话/计划/弱点按字段恢复 |
| U9 | dreaming persist memory_layers | `learning_ui_json` 字节不变 |
| U10 | 只 persist alice learning_ui（含 alice **尚无 user_memories 行**） | 行被创建或更新后 JSON 即为所写；已有行则 `updated_at` 不变；lzhmy 行不动；**未**走 `upsertUserMemoryRow` 写该列 |
| U11 | 可与 U9 合并，但必须断言 persistLearningUi ≠ upsert 写集 | 同 U9/U10 |
| U12 | `getStoredProfileRaw` 在 alice 上下文、无前缀键仍是 lzhmy 画像 | 读到空；不得 POST 到 alice |
| U13 | remount 后 `english_theme` / `super_agent_pending_debt` | 不得作为 alice 初始 UI（分桶或空） |

## 2. Integration

| ID | Case | Expected |
|----|------|----------|
| I1 | profile GET alice vs lzhmy | 画像与 learning_ui 互不可见 |
| I2 | persist alice learning_ui | 不修改 lzhmy 行 |
| I3 | vocab/list?userId=alice | 不含 lzhmy 的 leverage |
| I4 | daily-pack/today?userId=alice | 非 lzhmy 的 wakeup/flaw |
| I5 | 连续 persist 同一账号 | 后写覆盖；复盘 ≤20 |
| I6 | 缺 userId 的 `/api/vocab/stats` | 400，前端不当空表 |
| I7 | `POST /api/user/profile/save` 只带画像、不带 learning_ui | 不得把该账号 learning_ui 打成空 |
| I8 | 缺 userId 的 vocab list/review | 400，不是 lzhmy 词表 |

## 3. E2E / Manual

路径 A：登录页 → 康奈尔 / 英语引擎。路径 B：全局设置 → 用户标识。

| ID | Scenario | Expected |
|----|----------|----------|
| E1 | lzhmy 画像「对抗性沟通怯懦」+ 复盘瑕疵 → 登 alice（空） | 康奈尔无该文；alice `user_memories.profile_content` 无该文 |
| E2 | lzhmy 生词 leverage + 长文 + **材料键** `super_agent_material_*` → 登 alice | 无 leverage；生成文与材料区都不是 lzhmy 的 |
| E3 | lzhmy 夜话提交 → 登 alice → 再登 lzhmy | 夜话/复盘日期/下周计划恢复 |
| E4 | lzhmy 关背景 → 登 alice | 背景仍关 |
| E5 | 设置把 User ID 改为 alice | 同 E1/E2，且英语 React 态不残留（工作台已因 userId state 重挂） |
| E6 | 需求对照 | 隔离学习数据；非目标：session、生成排除表、清今日、脏数据回滚、视觉 |
| E7 | 设置改 ID 前有未保存夜话 | flush 后属于**旧**账号 sidecar；alice 不得出现该夜话 |

## 4. Observability

| ID | Expected |
|----|----------|
| O1 | 换号日志 from/to userId，无画像/夜话正文 |
| O2 | 试图用非当前桶回写时 warn |
| O3 | `resolveProfileForDify` / `injectUserProfile` / compress / dreaming 不得 `SELECT *` 把 `learning_ui_json` 带进注入；现有 `GET /api/user/profile/:userId`（`server.js` 约 2928，`...row` 展开）工作台可带该字段，但 Dify 装配路径必须显式列清单 |

## 5. Security / PII

- 软隔离（请求 userId）；不假装 session。
- 工作台 GET 可含 learning_ui；Dify 读路径必须列裁剪。
