# Critic Review: account-data-isolation

- Role: **Critic**（ralplan consensus · deliberate · PII/账号隔离）
- 本轮不实现产品代码；不重做 Architect 架构判定
- 审查对象：`.omx/plans/prd-account-data-isolation.md` R2（含 persist INSERT-placeholder）、`.omx/plans/test-spec-account-data-isolation.md`、`.omx/specs/deep-interview-account-data-isolation.md`
- Architect：`.omx/plans/architect-review-account-data-isolation.md` **R2 APPROVE**（先于本门）
- 日期：2026-08-30

## Verdict: APPROVE

R2 已把 Option A′ 写成可执行契约（位置 A + 写纪律 C + 客户端两车道）。五条原则与 A′ 同向；B / C / 折进 SAVE·upsert / 只分桶不上云均有否决或升级条件；风险有对应缓解与用例；验收与验证可测。Deliberate 要求的 pre-mortem（P1–P3）与 unit/integration/e2e/observability 均在。剩余缺口是计划内部对齐（U10 0 行断言、验证步骤独立成节），不构成 ITERATE。

---

## 门禁总表

| # | 门禁 | 判定 |
|---|------|------|
| 1 | 原则–选项一致性（5 原则 vs A′） | **通过** |
| 2 | 替代方案公平（B / C / upsert-in-SAVE） | **通过** |
| 3 | 风险缓解清晰 | **通过** |
| 4 | 验收标准可测（90%+ 具体） | **通过**（约 100%） |
| 5 | 验证步骤具体 | **通过**（内容在 test-spec + Step 9；独立节可补） |
| 6 | Deliberate：pre-mortem ×3 + 扩展测试四面 | **通过** |
| 7 | 浅替代 / 驱动矛盾 / 空泛风险 / 弱验证 | **未触发拒绝** |

Architect R2 APPROVE 作为前置成立；Critic 不推翻其综合路径，只验收质量门。

---

## 1. 原则–选项一致性

| # | 原则 | A′ 落点 | Critic |
|---|------|---------|--------|
| 1 | 当前账号是唯一学习数据源；界面与 React 内存不得残留 | 键清单分桶 / 换号清空；禁无前缀回退；`switchAccountSession` + App `userId` + `key={userId}`；embed 清空 | **一致。** U13/E5/E2 可证。 |
| 2 | 已有资源只重拉，不双写 | persist 不写 profile/layers；长文/材料只分桶不上云；生词/日包按 `userId` 重拉 | **一致。** 未把已有资源再塞进 sidecar。 |
| 3 | 缺失学习态按账号落库，换回可恢复；偏好整机共用 | sidecar JSON 形状覆盖复盘/夜话/计划/暂停/弱点/写作草稿；UPDATE 或 0 行 INSERT 占位；偏好白名单不分桶 | **一致，带已文档化代价。** 禁迁全局键 → 上线前未上云存量对当前号也不可见（ADR/风险已升格）。口语会话/embed 选清空，不属访谈点名的「必须上云」集合（弱点日志在 sidecar）。 |
| 4 | 换号不得把上一账号本地画像写入新账号服务端 | 删无前缀读；`writeProfileLocal` 只写当前桶；修 `profileHelper.ts` 667–718 三条 `syncProfileToServer(localRaw)`；独立时钟，persist 不 bump 行级 `updated_at` | **一致。** U3/U4/U12/E1。 |
| 5 | 不做 session / 生成串号 / 视觉改版 | vocab 缺 id → 400，不是中间件；embed 清空不是重建 passport；E6 钉非目标 | **一致。** |

无原则被 A′ 故意否决。Driver 2（换回可恢复）与「禁迁全局键」的张力已在 Architect §3 与 PRD 风险表写明：隔离主失败面优先于保全未上云存量。这是显式取舍，不是驱动自相矛盾。

**INSERT-placeholder 与原则 3/4：** PRD `persistLearningUi` 已写清：无行则 INSERT `profile_content=''`、`error_ledger='{}'`、`memory_layers='{}'`、`updated_at=0` + JSON；不调用 `upsertUserMemoryRow`。对照 `vocab-server/server.js` 465–469，`profile_content` / `updated_at` 为 NOT NULL，占位字段覆盖合法插入。`updated_at=0` 若叠加未删的无前缀读，会加重现有 709–710 写脏；步骤顺序（车道 1 先于 persist 被换号使用）因此是负荷约束，PRD Implementation Steps 1→3 已体现。

---

## 2. 替代方案是否公平

| 选项 | 处理 | 是否浅 |
|------|------|--------|
| **B** `memory_layers.learning_ui_state` | 否决：dreaming 整对象写回（`server.js` 1733 `SELECT *` + layers 写回） | **否。** 有具体失败机制，不是「不喜欢 layers」。 |
| **C** 独立表 | 承认写隔离更干净；规格允许自决时过重；**仅当独立 UPDATE/INSERT-sidecar 做不到再升级** | **否。** 有升级触发，不是空贬。 |
| **折进 `POST /api/user/profile/save` / `upsertUserMemoryRow`** | 否决：Architect「带 ALTER 的 B」；P3/U10/U11/I7 | **否。** 与 Driver 2、原则 2/4 对齐。 |
| **只分桶不上云** | 否决：访谈 Round 3 | **否。** 对应用户已拍板的恢复能力。 |

Pros/cons 边界足够：A′ 的代价（ALTER、工作台 GET 带 PII、须裁剪 Dify 读路径）写在选项本身，未藏到后文。不要求 Planner 再发明第四条同等深度的存储方案。

---

## 3. 风险缓解清晰度

| 风险 | 缓解 | 可证？ |
|------|------|--------|
| 设置改 User ID 不经邀请校验 | 非目标，只切数据 | E6 |
| 旧全局键误迁 / 误读 | **禁止**自动迁入；UI 不再读无前缀键 | U12/P1 |
| 先改 ID 再 flush | 契约顺序钉死 | E7 |
| GET 扩大 PII（夜话进 Dify） | 显式列清单，禁 `SELECT *` 注入 | O3 |
| vocab 400 被当成空词表 | 前端错误态 ≠ 空列表 | I6/I8 |
| 漏键当偏好 | 清单；未登记不得当学习态 API | 操作契约；实现可增补行 |

无「注意安全 / 小心并发」类空话。Architect §7 不阻塞项（0 行 persist、禁迁损失、软隔离）已落入 PRD 或明确接受，不挡本门。

残留观察（不升 ITERATE）：`server.js` 现有 `SELECT * FROM user_memories` 不止 dreaming（约 1733 / 1795 / 1991 / 2931 / 3056 / 3114 / 3240）。O3 写的是装配路径「不含 night chat / weakness 正文」，语义够用；实现时若只改 `resolveProfileForDify` 而漏 compress/dreaming 的 `SELECT *`，O3 应红。可选把调用点写入 test-spec，见 §可选改进。

---

## 4. 验收标准可测性

统计（只计带 Expected / 路径+数据+预期 的条目）：

| 来源 | 条数 | 具体 | 含糊 |
|------|------|------|------|
| 访谈用例 1–5 | 5 | 5 | 0 |
| PRD Requirements 1–5 | 5 | 5 | 0 |
| test-spec U1–U13 | 13 | 13 | 0（U11 可与 U9 合并，断言仍具体） |
| I1–I8 | 8 | 8 | 0 |
| E1–E7 | 7 | 7 | 0（E6 为非目标清单，可执行） |
| O1–O3 | 3 | 3 | 0 |

**具体率 ≈ 100% > 90%。** 访谈数据（「对抗性沟通怯懦」、`leverage`、路径 A 登录 / 路径 B 设置）已落到 E1–E5。无「体验更好」「尽快恢复」无度量词。

弱断言一处（不挡批准）：PRD persist 写「U10 断言：行存在且 JSON 即为所写」，test-spec U10 Expected 现为「`updated_at` 不变；lzhmy 行不动；未走 upsert」。对**已有行**足够；对 **0 行受邀号** 若测试夹具先插入空行，空 UPDATE 仍可能假绿。U8 roundtrip 若从无行起步可兜住，但未写明。列为 Planner 可选合并，不构成弱验证整计划。

---

## 5. 验证步骤是否具体

- 实现步骤 1–8 各绑 U/I/E ID；Step 9 = 跑完 test-spec + 手工 E1–E7。
- E2E 写明路径 A/B、账号 `lzhmy`/`alice`、材料键 `super_agent_material_*`。
- 代码锚点可核对且仍为现状（执行对象，非计划空洞）：`profileHelper.ts` 667–718 三条回写；`UserProfileOverlay.tsx` 33–34 直读全局键；`upsertUserMemoryRow` `server.js` 770–787 bump `updated_at`；`EnglishContext.tsx` 251 水合全局 `english_theme`。

PRD 无独立「Verification Steps」标题，但验证内容不缺。质量门通过；独立成节见可选改进。

---

## 6. Deliberate 附加项

### Pre-mortem（3）

| # | 失败机制 | 迹象 | 缓解/用例 | 是否空泛 |
|---|----------|------|-----------|----------|
| P1 | 无前缀回退 + load 三条写脏 | alice 服务端出现 lzhmy 画像 | 禁回退；只合并当前桶×服务端；U3/U4/U12 | **否** — 对应现码 675/710/717 |
| P2 | remount 后 initializer 读全局英语/口语键 | alice 英语/口语仍是 lzhmy | 清单分桶或清空；U13/E5 | **否** — 对应 `english_theme` 251 |
| P3 | learning_ui 走 upsert 或 bump `updated_at` | 夜话被盖 / 画像时钟错乱再写脏 | 独立 UPDATE；U10/U11/I7 | **否** — 对应 upsert 写集 |

三条均是本仓真实失败面，不是通用「数据丢了」。数量满足 deliberate。

### 扩展测试四面

- **Unit：** U1–U13（分桶、偏好、写脏、400、sidecar 时钟、禁回退、英语初值）
- **Integration：** I1–I8（跨账号不可见、vocab/日包、覆盖上限 20、SAVE 不碰 learning_ui、缺 id 400）
- **E2E：** E1–E7（画像/生词长文材料/换回夜话/偏好/设置入口/非目标/未保存 flush）
- **Observability：** O1–O3（换号日志无正文、回写 warn、Dify 注入无夜话/弱点）

Security/PII 节承认软隔离、不假装 session，与原则 5 / 邀请登录规格一致。

---

## 7. 拒绝条件扫描（未触发）

- **浅替代：** 未触发（见 §2）。
- **驱动矛盾：** 未触发。Driver 1 界面隔离 ↔ 车道 1；Driver 2 恢复且不双写 ↔ 车道 2 独立时钟；Driver 3 存储自决 ↔ A′ 默认、C 升级。
- **空泛风险：** 未触发（见 §3）。
- **弱验证 / 弱 pre-mortem / 缺扩展测试：** 未触发（见 §4–§6）。U10 0 行措辞缺口不够把整份 expanded plan 打成 weak。

---

## 可选改进（APPROVE 后由 Planner 合并）

非必须改架构；合入后计划更不易假绿、更易交接。

1. **test-spec U10（及必要时 U8）补 0 行：** 无 `user_memories` 行时 persist alice → 行存在、`learning_ui_json` 为所写、`updated_at=0`（或不参与画像合并）、未走 `upsertUserMemoryRow`；已有行路径保持「时钟不变 / 他行不动」。与 PRD persist 段已写断言对齐。
2. **PRD 增加短 Verification Steps：** 单测 U\* → 集成 I\* → 手工路径 A/B 跑 E1–E7 → 抽查 O3 注入串。避免执行只读 Step 9 一句。
3. **O3 可点名 `SELECT *` 位点**（dreaming/inject/compress 等），防止只改 `resolveProfileForDify`。
4. **键清单加一句 Principle 3 例外：** `super_agent_last_generated_*` / `super_agent_material_*` / 口语会话 / embed 为设备分桶或清空、不上云；换回恢复义务只绑 sidecar 形状字段。
5. **Changelog 记一笔 persist 0 行 INSERT-placeholder**（R2 小补丁），避免读者以为只做 UPDATE。

---

## 结论

Option A′ 与五原则、访谈范围、Architect R2 综合路径对齐；替代方案与风险不是走过场；deliberate 测试面完整。Critic **批准**进入共识门（Planner 宜合并上列可选项后再写 durable handoff）。

**Verdict: APPROVE**
