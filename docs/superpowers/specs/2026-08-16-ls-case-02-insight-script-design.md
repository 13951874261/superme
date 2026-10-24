# LS-CASE-02 洞察(听)结构化长剧本设计

> **状态**：设计已批准；实现计划见 `docs/superpowers/plans/2026-08-16-ls-case-02-insight-script.md`；**尚未改产品代码**。  
> **日期**：2026-08-16  
> **关联**：`docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`（LS-CASE-02）  
> **方案**：A — API 出 `ScriptWorkshopDraft` + 听页只读展示器 + flatten 侧写

---

## 1. 目标与非目标

### 目标

- 洞察(听)「刷新案例」产出**结构化长剧本**，对白按语速估时约 **8–10 分钟**（合格带实现为 **≥8 且 ≤12 分钟**）。
- **强复用**驭心剧本工坊类型 `ScriptWorkshopDraft` 与 `scriptEvaluator`（字数/估时）。
- 听模块负责**只读展示**与**侧写提交**；侧写仍走现有 Insight 点评引擎。

### 非目标

- 听模块**不开**多人群体博弈会话。
- **不**提供「导入会话 / 开始对战」。
- 不嵌入完整 `ScriptWorkshopDrawer` 编辑/导入能力（避免越界）。

---

## 2. 架构

```
[刷新案例] → POST /api/insight/listen/scenario { category, userId }
                  ↓
       Dify Insight Gen（或服务端兜底组装）
                  ↓
       解析为 ScriptWorkshopDraft
                  ↓
       evaluateScriptDraft / estimateDurationMinutes
                  ↓
       返回 { draft, evaluation, quality }
                  ↓
  ListenModule 只读展示器（角色/底牌/四幕）
                  ↓
  侧写：flatten(draft) → scenario_text → 现有点评 API
```

### 复用

- `src/components/modules/GameTheory/ScriptWorkshopTypes.ts`
- `src/components/modules/GameTheory/scriptEvaluator.ts`
- 可选：`PRESET_BENCHMARK_SCRIPTS` 作为长兜底素材来源（按分类改写）

### 新建（实现阶段）

- 听页只读展示组件（建议独立文件，避免继续膨胀 `ListenModule.tsx`）
- `flattenInsightScript(draft): string` 工具（可单测）
- API 响应解析 / `quality` 门禁（可与后端共享估时规则）

### 不修改职责

- `ScriptWorkshopDrawer` 的导入会话、对战相关入口

---

## 3. 数据流与 API 契约

### 请求

`POST /api/insight/listen/scenario`  
Body：`{ category: '体制内' | '外企' | '通用社交', userId }`

### 响应

```ts
{
  success: true,
  draft: ScriptWorkshopDraft,
  evaluation: {
    totalWords: number,
    estimatedMinutes: number, // words / 250，与 scriptEvaluator 一致
    passedDuration: boolean   // estimatedMinutes ∈ [8, 12]
  },
  quality: 'ok' | 'below_standard',
  scenario?: string // 可选：flatten(draft)，兼容旧客户端
}
```

### 合格带（已确认）

- `quality === 'ok'` 当且仅当 `estimatedMinutes >= 8 && estimatedMinutes <= 12`
- 否则 `quality === 'below_standard'`（**仍返回并展示 draft**，不拒收）

### flatten 规则（侧写）

按序拼接为 `scenario_text`：

1. `sceneTitle`、`sceneSummary`
2. 各 `characters[]`：name、roleTitle、surfaceGoal、hiddenMotive、redLine、winCondition
3. 四幕 `phases[]`：title + content

不改变现有点评 API 的请求字段形状（仍传扁平 `scenario_text` + 用户分析）。

### 前端状态

- `currentDraft: ScriptWorkshopDraft | null`
- `evaluation`（字数、估时、是否达标）
- `quality: 'ok' | 'below_standard'`

`loadNewScenario` 写入上述状态；提交侧写时调用 `flatten(currentDraft)`。

---

## 4. 错误处理与听页 UI

### 错误 / 降级

| 情况 | 行为 |
| --- | --- |
| API 失败 / 超时 | 使用该 `category` 的内置 `ScriptWorkshopDraft` 兜底；按同一规则算 `quality` |
| 非结构化 / 解析失败 | 若仅有旧版 `scenario` 字符串，包成最小 draft 或改走兜底；并提示 |
| `below_standard` | **照常展示** + 顶栏：「未达 8–10 分钟标准（当前约 X 分钟）」+ 可「刷新案例」 |
| draft 为空时侧写 | 禁用提交，提示先刷新案例 |

### 只读 UI 结构

1. 质量提示条（仅 `below_standard`）
2. 场景标题 + 摘要
3. 角色卡（可折叠）：表层诉求 / **隐藏底牌（对用户可见）** / 红线
4. 四幕对白（可折叠分幕，默认展开）
5. 元信息：字数、估时分钟
6. **禁止出现**：导入会话、开始对战、工坊编辑

侧写输入与提交保持现有 ListenModule 流程。

---

## 5. 测试与验收

### 单测

- `flatten(draft)` 含标题、角色名、四幕关键片段
- 估时门禁：[8,12] → `ok`，否则 `below_standard`
- 合法 draft JSON 可解析；坏 JSON 走兜底路径

### 手工 / E2E（LS-CASE-02）

- 三类 Tab 各刷新：结构化展示（角色+分幕）
- 估时多数落在 8–12；不足有标红且内容可见
- 可展开并看见 `hiddenMotive`
- 提交侧写能出点评
- 页面无「导入会话 / 开始对战」

### DoD

1. 类型与校验对齐工坊  
2. 只读展示 + 降级标红符合冻结规格  
3. 侧写链路可用  
4. 非目标满足  
5. 单测通过；三类 Tab 各至少手工刷 1 次  

---

## 6. 实现触碰面（供 writing-plans，非本阶段改码）

| 区域 | 路径（预期） |
| --- | --- |
| 听模块 UI | `src/components/modules/ListenModule.tsx` + 新只读展示组件 |
| 前端 API | `src/services/difyAPI.ts`（`fetchDynamicInsightScenario` 扩展） |
| 后端出题 | `vocab-server/services/insightSpeakProxy.js`、`vocab-server/server.js`（`/api/insight/listen/scenario`） |
| 共享类型/校验 | `ScriptWorkshopTypes.ts`、`scriptEvaluator.ts` |
| Dify | Insight Gen 应用 prompt（仓外）需能产出/贴近 `ScriptWorkshopDraft` JSON；失败靠兜底 |

---

## 7. 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-08-16 | 方案 A；分段批准：架构 / 契约(估时 B=8–12) / UI(底牌可见) / 测试 |
