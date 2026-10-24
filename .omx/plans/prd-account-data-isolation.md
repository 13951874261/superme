# PRD: account-data-isolation

> Requirements: `.omx/specs/deep-interview-account-data-isolation.md`  
> Context: `.omx/context/account-data-isolation-20260830T090530Z.md`  
> Architect R1: `.omx/plans/architect-review-account-data-isolation.md`（ITERATE → 本文件 R2）  
> Mode: **ralplan consensus · deliberate** (PII / 账号学习态)

## RALPLAN-DR (deliberate)

### Principles

1. **当前账号是唯一学习数据源**：界面与 React 内存不得残留上一账号内容。
2. **服务端已有资源只重拉，不双写**（生词 / 日包 / 长文 / 画像）。
3. **服务端缺失的学习态按账号落库**，换回可恢复；界面偏好整机共用。
4. **换号不得把上一账号本地画像写进新账号服务端**。
5. **不做 session / 生成串号 / 视觉改版**（规格非目标）。

### Decision Drivers

1. 同机换号串界面是主失败面（访谈 Round 1）。
2. 换回必须能恢复复盘/夜话（Round 3），但不能双写已有资源（Round 5）。
3. 实现可自决存储形态；扩范围必须先问（Round 7）。

### Viable Options

**Option A′ — 同表 sidecar 列 + C 写纪律（推荐，R2）**  
- Approach: `user_memories.learning_ui_json`；**独立 UPDATE**，不进 `upsertUserMemoryRow`；**不 bump** 行级 `updated_at`；localStorage 分桶且**禁止无前缀回退**；`switchAccountSession` + `App` 订阅 `global-user-id-changed` 以 `key={userId}` 重挂。  
- Pros: 位置不新表；写路径与画像/dreaming 绝缘；换号可清 React 态。  
- Cons: 一次 ALTER；GET 工作台水合会带 PII，须对 Dify 读路径裁剪。

**Option B — 塞进 `memory_layers.learning_ui_state`**  
- Cons: dreaming 整对象写回。否决成立。

**Option C — 独立表**  
- Pros: 写隔离最干净。  
- Cons: 规格允许自决时过重。仅当 sidecar 无法做到独立 UPDATE 时再升级。

**Invalidation:** 不选只分桶不上云。不选把列折进 profile SAVE/upsert（Architect：那是「带 ALTER 的 B」）。不选 session。

### Pre-mortem（3 场景）

| # | 失败 | 迹象 | 缓解 |
|---|------|------|------|
| P1 | 无前缀画像回退 + load 三条写脏 | alice 服务端出现 lzhmy 画像 | 删除无前缀读回退；只合并当前 uid 桶×服务端；U3/U4/U12 |
| P2 | remount 后 initializer 读全局英语/口语键 | alice 英语页/口语仍是 lzhmy | 完整键清单分桶或换号清空；U13/E5 |
| P3 | learning_ui 走 upsert 或 bump `updated_at` | 夜话被盖 / 画像时钟错乱再写脏 | sidecar UPDATE；U10/U11/I7 |

### Expanded test plan

见 `.omx/plans/test-spec-account-data-isolation.md`。

---

## Requirements Summary

同一浏览器登录或设置中切换受邀账号后：

1. 康奈尔、生词、长文、唤醒、破绽及模块学习界面只显示当前账号数据或空态。
2. 画像不得被上一账号本地缓存写脏到新账号服务端。
3. 复盘/夜话/下周计划/暂停模块/口语弱点等「仅本地」学习态按账号存服务端，换回可恢复。
4. 背景/音效/拦截器等偏好仍整机共用。
5. 不修 `getHistoryExclude`、不修 `clear-today` 跨用户、不加 session。

## Chosen architecture (R2)

**Option A′：存储位置用 Option A，写纪律用 Option C。客户端隔离与上云分两车道。**

### 车道 1 — 界面隔离

```
switchAccountSession(nextId):
  flushLearningUi(oldId)           // 未保存夜话写入旧账号 sidecar
  → setAppUserId(nextId)           // 禁止先改 ID 再 flush
  → loadUserProfileFromServer(nextId)  // 只读 nextId 桶
  → loadLearningUi(nextId)
  → dispatch global-user-id-changed
  → App 持有 userId state，key={userId} 重挂 EnglishProvider/TaskProvider/AppContent
```

- **禁止**读写无前缀 `User_Current_Profile` / `user_current_profile` / 复盘键。`writeProfileLocal` 只写当前账号桶。
- **不自动迁移**旧全局键到任何账号（升格为规范，不是建议）。
- `parseVocabUserId` 无 id → helper 空值，**每个** vocab 路由 400；前端 400 ≠ 空列表。

### 车道 2 — 换回恢复（sidecar）

```
ALTER user_memories ADD COLUMN learning_ui_json TEXT;
-- 可选 learning_ui_updated_at；画像合并仍只用行级 updated_at

persistLearningUi(userId, json):
  若该 user_id 尚无行：INSERT 占位（profile_content=''、error_ledger='{}'、memory_layers='{}'、updated_at=0、learning_ui_json=json）
  若已有行：UPDATE 只 SET learning_ui_json（及可选 learning_ui_updated_at）
  不调用 upsertUserMemoryRow
  已有行不得改 profile_content / error_ledger / memory_layers / updated_at
  U10 断言：行存在且 JSON 即为所写

GET /api/user/profile/:id 工作台：可附带 learning_ui_json
resolveProfileForDify / inject / compress / dreaming：显式列清单，禁止 SELECT * 把夜话打进注入
POST /api/user/profile/save：默认不碰 learning_ui_json（I7）
```

工作台水合可用独立 `GET/PUT /api/user/learning-ui`（实现自决），但语义必须等同 sidecar UPDATE。

### 存储形状

```json
{
  "v": 1,
  "biweeklyReviewHistory": [],
  "lastReviewDate": null,
  "nextWeekPush": null,
  "difficultyAdjustment": {},
  "pausedModules": [],
  "weeklyChatHistory": [],
  "oralWeaknessLog": [],
  "writeBenchmarkText": "",
  "writeDailyFeedback": null
}
```

复盘历史最多 20 条（现有上限）。长文 `super_agent_last_generated_*` / `super_agent_material_*`：**只分桶，不上云**。

### 学习键清单（本轮必须表列）

| 键 | 归类 | 处理 |
|----|------|------|
| 画像 `User_Current_Profile` / `user_current_profile` / `user_memory_layers` / `user_error_ledger` / `user_profile_server_updated_at` | 学习态 | 分桶；**禁止无前缀回退** |
| `superme_biweekly_review_history` / `superme_last_review_date` / `superme_next_week_push` / `superme_difficulty_adjustment` / `superme_paused_modules` / `superme_weekly_history_enhanced` | 学习态 | 分桶 + sidecar |
| `user_weakness_log` / write_benchmark_text / write_daily_feedback | 学习态 | 分桶 + sidecar |
| `super_agent_last_generated_*` / `super_agent_material_*` / `super_agent_intel_source` | 学习态缓存 | 分桶，不上云 |
| `english_stage` / `english_theme` / `super_agent_pending_debt` | 学习态 | 分桶；主题以 `user_theme_prefs` 重拉为准 |
| `oral_conversation_context` / `superme_session_memory` / `oral_combat_points` / `oral_sandbox_xp` | 学习态 | 分桶或**换号清空**（不上云） |
| `read_module_today_summary` / `superme_write_context` | 学习态 | 分桶 |
| `dify_embed_input_overrides` 及 embed 会话缓存 | 学习态 | **换号清空**（不上云）。不重做 passport/会话恢复；只避免重挂后打开上一账号对话 |
| `super_agent_bg_*` / `super_agent_global_rate` / `super_agent_global_diff` / `super_agent_global_interceptor` / `super_agent_default_voice` / 音效 | 偏好 | 不分桶 |
| `super_agent_accent_pref` | 偏好 | 整机共用 |

`accountStorage`：学习读写只走登记清单；未登记键不得当学习态 API。实现期可**增补行**，不可把漏键默认为偏好。

### 必须修的写脏路径

`src/utils/profileHelper.ts` 667–718：三条 `syncProfileToServer(localRaw)` 改为只回写**当前 uid 桶**且桶非空、且确认属于该 uid。HTTP 失败不得用他账号内容回写。

`getLastReviewDate`：空账号不写 `Date.now()`。

`src/components/UserProfileOverlay.tsx` 33–34：改为分桶 helper。

`GlobalSettingsPanel.handleSaveUserId`：必须走 `switchAccountSession`，禁止只 `setAppUserId` + `loadUserProfileFromServer`。

`App.tsx`：持有 `userId` state，监听 `global-user-id-changed`；工作台 `key={userId}`。仅写 JSX key 而 state 不变则设置改 ID 仍不重挂。

---

## Implementation Steps

1. **车道 1 helper：** `accountStorage.ts` + 键清单 + 单测 U1/U2/U12。
2. **车道 1 画像：** 分桶、停无前缀回退、修 load 写脏；覆盖 UserProfileOverlay；U3–U5。
3. **车道 2 sidecar：** ALTER + `persistLearningUi` + GET 裁剪；禁止 upsert 写该列；U9–U11、I1/I2/I7。
4. **reviewHelper + flush：** 分桶 + sidecar；U6；换号 flush 顺序。
5. **switchAccountSession + App key：** 登录与设置共用；E5/E7。
6. **模块键：** Dashboard 长文+材料、EnglishContext 主题/债务、口语会话/弱点、WriteTab、read summary。
7. **embed 缓存换号清空。**
8. **parseVocabUserId：** 无 id 空 + 各 vocab 路由 400；前端不把 400 当空表；I6/I8。
9. 按 test-spec 跑完；手工 E1–E7。

## Risks and Mitigations

| 风险 | 缓解 |
|------|------|
| 设置改 User ID 不经邀请校验 | 非目标；只切数据 |
| 旧全局键 | **禁止**自动迁入任何账号；UI 不再读取 |
| 先改 ID 再 flush | 契约禁止；E7 |
| GET 扩大 PII | Dify/inject 列裁剪；O3 |
| `parseVocabUserId` 400 被当成空词表 | 前端错误态 ≠ 空列表 |
| 漏键 | 清单 + 未登记不得当学习态 |

## ADR

- **Decision:** Option A′：`learning_ui_json` sidecar 列 + 独立 UPDATE + 独立于画像 `updated_at`；客户端分桶且禁止无前缀回退；工作台按 userId 重挂。
- **Drivers:** 界面隔离与换回恢复拆开；dreaming/upsert 不得碰学习 UI。
- **Alternatives:** B（否决）；C 新表（sidecar 失败时升级）；折进 profile SAVE（否决）。
- **Why chosen:** 满足 Round 3 上云；写路径像独立表；不新造权限模型。
- **Consequences:** 共享行但不共享 upsert/时钟；工作台 GET 可带夜话，Dify 路径必须裁剪；embed 本轮清空而非重建。
- **Follow-ups:** 生成串号 / session / 历史脏数据回滚；Dify 会话跨设备恢复不在本轮。

## Available-Agent-Types Roster

`generalPurpose`, `explore`, `shell`。共识审查 sequential Architect → Critic。

## Follow-up Staffing

- **$ultragoal（默认）：** 车道 1 helper/画像 → 车道 2 sidecar → session 切换 → 模块键 → vocab 400。
- **$team：** 前后端可并行，换号 E1–E7 单车道收口。
- **$ralph：** 仅用户明确要求。

## Goal-Mode Follow-up Suggestions

`$ultragoal` 默认；并行时 `$ultragoal` + `$team`；`$ralph` 显式后备。

## Verification Steps

1. 跑 test-spec U1–U13（含 U10 无行占位 INSERT）。
2. 跑 I1–I8（含 I7 画像 SAVE 不清空 learning_ui；I6/I8 vocab 400）。
3. 手工/E2E：E1 康奈尔、E2 生词+长文+材料键、E3 换回夜话、E4 偏好共用、E5 设置改 ID 重挂、E7 flush 归属旧账号。
4. O3：对 `resolveProfileForDify` 与 `GET profile` 工作台路径分别抓响应，确认仅后者可含 night chat。
5. 不部署、不改清今日/historyExclude。

## Launch hints

```
$ultragoal create-goals --brief-file .omx/plans/prd-account-data-isolation.md
```

## Changelog

- R1 Planner draft（列+分桶+remount 捆绑）
- R2 吸收 Architect ITERATE：sidecar 写纪律、禁止无前缀回退、键清单、flush 顺序、App 订阅 userId、Dify 读路径裁剪、embed 换号清空、test-spec U10–U13/I7–I8/E7
- R3 Critic APPROVE 后合并：无行 INSERT 占位、U10 强化、Verification Steps、O3 点名 `SELECT *` 位点
