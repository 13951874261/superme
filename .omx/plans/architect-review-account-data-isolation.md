# Architect Review: account-data-isolation

- Role: **Architect**（ralplan consensus · deliberate · PII/账号隔离）
- 本轮不实现产品代码；不扮演 Critic
- 审查对象：`.omx/plans/prd-account-data-isolation.md` **R2**、`.omx/plans/test-spec-account-data-isolation.md`
- 对照：R1 本文件 §6 必须改动；`.omx/specs/deep-interview-account-data-isolation.md`
- 日期：2026-08-30

## R2 delta

**Verdict: APPROVE**

R1 判定 ITERATE，要求把「列 + 分桶 + remount」拆成 sidecar 写纪律与客户端隔离两车道。R2 已改称 Option A′（位置用 A、写纪律用 C），并补齐：独立 `persistLearningUi`、不进 upsert、不 bump 行级 `updated_at`、禁止无前缀回退、键清单、`flush(old) → setId → load(next) → 订阅重挂`、Dify 列裁剪、embed 换号清空、U10–U13 / I7–I8 / E7 / 强化 O3。R1 §6 条目全部闭合。剩余 0 行 UPDATE 空转、存量全局键不迁移，记为不阻塞实现契约，不挡批准。

---

## 1. R1 §6 闭合核对

| §6 要求 | R2 落点 | 状态 |
|---------|---------|------|
| 6.1 sidecar 列；禁止进 `upsertUserMemoryRow` 默认写集 | Chosen architecture / persistLearningUi：独立 UPDATE，不调用 upsert | **闭合** |
| 6.1 只写 JSON、不改行级 `updated_at`（或独立 `learning_ui_updated_at`） | persist 不改 `updated_at`；可选独立时钟；画像合并仍用行级时钟 | **闭合** |
| 6.1 `POST /api/user/profile/save` 默认不覆盖 learning_ui | 「默认不碰 learning_ui_json（I7）」 | **闭合** |
| 6.1 工作台 GET 可带 JSON；Dify/inject/compress/dreaming 显式列、禁夜话注入 | 车道 2 + O3 | **闭合** |
| 6.2 删除无前缀读回退；`writeProfileLocal` 只写当前桶 | 禁止读写无前缀画像/复盘键；不自动迁移 | **闭合** |
| 6.2 `UserProfileOverlay` 列入触点 | 33–34 改分桶 helper | **闭合** |
| 6.2 `switchAccountSession`：flush(old)→setId→load(next)→重挂；禁先改 ID | 车道 1 顺序钉死；E7 | **闭合** |
| 6.2 App 持有 userId / 订阅 `global-user-id-changed` | App.tsx 契约；仅 JSX key 不够 | **闭合** |
| 6.3 学习键清单（英语主题/债务、口语会话、阅读摘要、embed、偏好/口音） | 「学习键清单」表列齐；未登记不得当学习态 | **闭合** |
| 6.3 embed：分桶清空 **或** 写成 Principle 5 缺口 | 本轮换号清空、不上云、不重建 passport | **闭合（选 a）** |
| 6.4 两车道步骤；Step 3 = 列+独立 persist+GET 裁剪 | Implementation Steps 1–3 / 5 | **闭合** |
| 6.4 每个 vocab 路由 400；前端 400 ≠ 空表 | Step 8；I6/I8 | **闭合** |
| 6.5 ADR = A 位置 + C 写纪律；PII 靠列裁剪；embed 缺口或最小清空 | ADR Decision / Consequences / Follow-ups | **闭合** |
| 6.6 U10–U13、I7–I8、E7、O3 强化 | test-spec 均在 | **闭合** |
| 6.6 E2/E5 含材料键 `super_agent_material_*` | E2 写明生成文与材料区；E5 同 E1/E2 | **闭合** |

test-spec 标题与 PRD 均标 R2；U10 比 R1 要求多断言「未走 upsert 写该列」，与 U11 对齐。

---

## 2. 钢人反论（R2 缩短）

R1 钢人的核心（「A 若折进 upsert 就是带 ALTER 的 B」；无前缀回退复活写脏；`key={userId}` 当隔离本身）已被 R2 拆掉。剩下的反对不再足以否决 A′，只约束实现诚实度：

1. **同表仍是运维事故面，不是写路径事故面。** 备份、`SELECT *`、未来有人把新列加回 upsert 默认写集，夜话仍和画像在同一行。R2 用独立 UPDATE + Dify 列清单关掉了**当前**写作/注入路径；关不掉的是默认查询习惯。这是 C 仍更干净的理由，但规格允许自决时过重——R1 已接受「做不到绝缘再升级 C」。
2. **`UPDATE … WHERE user_id=?` 在 0 行时空转。** `user_memories.profile_content` / `updated_at` 均为 NOT NULL（`vocab-server/server.js` 465–469）。从未建行的受邀号若只 flush sidecar，Principle 3 换回恢复空转。U10 若只断言「时钟不变 / 他行不动 / 未走 upsert」，空 UPDATE 也能绿。这不是再绑回 upsert 的理由，而是 persist 必须定义为 **UPDATE，0 行则只 INSERT sidecar + 合法 NOT NULL 占位（空画像、`updated_at=0` 或不参与合并），仍禁止 `upsertUserMemoryRow`**。
3. **禁止读无前缀键且不迁移**，部署后全局键里未上云的夜话对所有账号不可见（见 §3）。这是 R1 要求升格的规范，不是新缺口。

**钢人结论：** 不要因为同表就退回「折进 profile SAVE」；也不要因为 UPDATE 契约就假装 0 行也能恢复。A′ 成立，前提是 persist 在无行时仍绝缘时钟。

---

## 3. 真实张力（一处）

**张力：Principle 4（永不写脏）× Principle 3（换回可恢复，含存量本地态）。**

R2 删除无前缀回退、禁止自动迁入任何账号，P1/U12 可证。代价是：现网 `User_Current_Profile` / `superme_*` 全局键里、尚未进 sidecar 的复盘/夜话，上线后对**当前**账号也读不到。一次性「只迁入当时已登录 uid」能保存量且不脏污下一账号，但会重开「迁错人」窗口，且与 R1 升格的禁迁规范冲突。

本轮接受该损失：隔离主失败面优先于保全未上云存量。若产品要保老数据，须另开范围，不能由实现者默默做迁移。

embed 清空 vs 不重做会话：R2 已选清空，换回不恢复 Dify 对话；访谈非目标允许。不单列第二条张力。

---

## 4. 综合路径（Synthesis）

R2 的 A′ 即 R1 §4 综合方案，予以确认，不再改存储位置：

```
车道 1  界面隔离（可先于 ALTER）
  键清单分桶 / 换号清空
  禁止无前缀读写
  loadUserProfileFromServer 只合并 当前桶 × 当前服务端
  switchAccountSession: flush(old) → setId → load(next) → dispatch → App key={userId}

车道 2  sidecar 恢复
  ALTER learning_ui_json
  persistLearningUi = 独立 UPDATE
    0 行 → INSERT 仅 user_id + learning_ui_json + NOT NULL 占位
    不调用 upsertUserMemoryRow，不 bump 画像 updated_at
  工作台 GET 可附带 JSON
  Dify / inject / compress / dreaming：显式列，禁止 SELECT * 带夜话
```

相对 B：否决仍成立（dreaming 整对象写回 layers）。  
相对 C：sidecar 写纪律落地后不新表；仅当独立 UPDATE/INSERT-sidecar 做不到再升级。  
相对「只分桶不上云」：否决仍成立（访谈 Round 3）。

---

## 5. 五条原则逐条

| # | 原则 | R2 判定 |
|---|------|---------|
| 1 | 当前账号是唯一学习数据源；界面与 React 内存不得残留 | **可保证。** 清单覆盖 R1 点名漏键；remount 依赖 userId state；U13/E5；embed 换号清空。 |
| 2 | 已有资源只重拉，不双写 | **未违反。** 长文只分桶不上云；persist 不写 profile/layers。 |
| 3 | 缺失学习态按账号落库，换回可恢复；偏好整机共用 | **方向与契约足够。** 形状/上云范围对；偏好白名单已列。0 行 persist 见 §2/§7，不挡批准。存量全局键主动放弃，见 §3。 |
| 4 | 换号不得把上一账号本地画像写入新账号服务端 | **可保证。** 禁回退 + 修三条写脏 + U3/U4/U12；独立时钟避免 learning_ui 建行再触发合并。 |
| 5 | 不做 session / 生成串号 / 视觉改版 | **未违反。** vocab 400 不是 session；embed 清空不是重建会话体系。 |

无原则被 PRD 故意否决；1 与 4 在 R2 契约下可证，故 **APPROVE**。

---

## 6. 代码事实（R1 仍成立，供执行对照）

执行期勿把下列现状当成「R2 已落地」——产品代码未改：

- `loadUserProfileFromServer` 三条 `syncProfileToServer(localRaw)`：`profileHelper.ts` 667–718
- `getStoredProfileRaw` / `writeProfileLocal` 仍读写无前缀键：同文件 80–90
- `App` 不订阅换号、工作台无 `key={userId}`：`App.tsx` 389–415
- `upsertUserMemoryRow` 写集 bump `updated_at`：`server.js` 770–787
- `parseVocabUserId` 无 id → `'lzhmy'`：`server.js` 3269–3274
- `EnglishContext` 仍水合全局 `english_theme`：248–292
- `UserProfileOverlay` 直读全局画像：33–34

这些正是车道 1/2 的实现对象，不是 R2 计划缺口。

---

## 7. 不阻塞的观察（不必为此 ITERATE）

- persist 0 行：实现写成 UPDATE-or-INSERT-sidecar-only；U10/U8 建议断言「alice 行存在且 JSON 为所写内容」，避免空 UPDATE 假绿。
- 禁迁全局键：上线后未上云夜话对当前账号也不可见；文档已升格，执行勿偷偷迁移。
- Pre-mortem P1–P3、Option B 否决、软隔离、Roster / `$ultragoal`：维持。
- `getLastReviewDate` 空账号写 `Date.now()`：U6 覆盖，保留。

---

## 8. 结论

Option A′（同表 sidecar + C 写纪律 + 客户端两车道）在 R2 中已成为可执行架构，不再是「带 ALTER 的 B」。R1 §6 必须改动已写入 PRD/ADR/test-spec。Architect 批准进入 Critic 门。

**Verdict: APPROVE**
