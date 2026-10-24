# GT-SIM-02 语气修正对比表设计

> **状态**：设计已批准（方案 1 + 选项 C）；实现计划见 `docs/superpowers/plans/2026-08-16-gt-sim-02-tone-corrections.md`；**尚未改产品代码**。  
> **日期**：2026-08-16  
> **关联**：`docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`（GT-SIM-02）  
> **方案**：独立 `tone_corrections[]` + 共用表格 UI；覆盖人机沙盘、多人会话、**以及**案例研判历史

---

## 1. 目标与非目标

### 目标

- 研判结果出现**独立**「语气修正」区块，形态为对比表：**原话 | 问题 | 建议说法**。
- 覆盖：
  1. 经典人机对战沙盘（`source_type: simulation`）→ 对局历史  
  2. 多人/场景会话个人复盘（`GameTheoryPersonalReview`）  
  3. **案例研判**（`case_analysis`）→ 对局历史（选项 C）
- 不得仅并入 `strategy_guidance` / `suggestion` / `script_examples` 而无独立区块。

### 非目标

- 不改动 GT-CASE-02 四节字数门槛与分节字段。
- 不强制本轮改线上 Dify YML（prompt 注入 + normalize 兜底）。
- 不要求语气表替代策略指导列表。

---

## 2. 数据契约

```ts
type ToneCorrection = {
  original: string;   // 原话
  problem: string;    // 问题（为何不妥）
  suggested: string;  // 建议说法
};

// analyze full_result / session review 均带：
tone_corrections: ToneCorrection[];
```

### 合格条件

- 至少 **1** 条，且每条 `original` / `problem` / `suggested` 均非空 → 视为有独立区块。
- 否则：服务端用用户应对（或会话最后用户发言）兜底 **1** 行；可设 `tone_corrections_repaired: true` 或沿用 `quality_note` 追加说明「语气修正经系统补全」。

### 与既有字段关系

| 字段 | 关系 |
| --- | --- |
| `script_examples` | 仍可保留自由文本话术；**不**代替表格 |
| `strategy_guidance` | 会话策略列表保留；表格独立展示 |
| `suggestion` | 汇总建议保留 |

---

## 3. 架构

```
analyze (case | simulation)
  → ensureGameTheoryVerdictSections (既有)
  → ensureToneCorrections(parsed, userAnswer)
  → full_result.tone_corrections → 历史展开 ToneCorrectionTable

session personal-review
  → generatePersonalReview
  → ensureToneCorrections(review, lastUserUtterance)
  → ReviewView 独立区块 ToneCorrectionTable
```

### 共用

- `src/components/modules/GameTheory/ToneCorrectionTable.tsx`（展示）
- `src/utils/toneCorrections.ts` + `vocab-server/services/toneCorrections.js`（normalize / 兜底，前后端镜像）

---

## 4. UI

### 对局历史（案例 + 人机）

- 在 GT-CASE-02 四分块 / 旧字段区块附近，若存在 `tone_corrections?.length`，渲染标题「语气修正」+ 三列表。
- 旧历史无该字段：不渲染、不报错。

### 会话复盘 `ReviewView`

- 在 `strategy_guidance` **之前或并列**放独立「语气修正」表。
- 禁止把三列内容只拼进 guidance 的 `<p>` 列表。

### 表格样式

- 三列：原话 | 问题 | 建议说法；小屏可改为纵向堆叠三行标签（实现时保持现有 zinc 风格，不新开设计体系）。

---

## 5. Prompt 注入

- **analyze**：在现有研判指令中追加：必须输出 `tone_corrections` 数组（≥1），元素含 `original/problem/suggested`。
- **会话 personal-review**：在生成 review 的提示/解析路径中要求同字段；解析后 `ensureToneCorrections`。

---

## 6. 验收（对齐 GT-SIM-02）

| 路径 | 预期 |
| --- | --- |
| 人机对战沙盘 → 提交偏硬应对 → 历史展开 | 独立语气修正表，含原话/问题/建议 |
| 场景博弈会话 → 生成个人复盘 | 同上，且不与 strategy_guidance 混为一谈 |
| 案例研判 → 历史展开 | 同样有表（选项 C） |

测试数据示例：`你没资格过问我的编制。`

---

## 7. 自检

- [x] 独立字段，非并入 guidance  
- [x] 双路径 + 案例历史（C）已写明  
- [x] 旧历史兼容  
- [x] 与 GT-CASE-02 边界清晰  

---

## 8. 下一步

用户审阅无异议后，按 plan 执行（默认 **不 commit**）。
