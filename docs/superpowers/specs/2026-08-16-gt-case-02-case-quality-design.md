# GT-CASE-02 驭心案例详实度与研判四节契约设计

> **状态**：设计已批准（方案 1 + 数据结构 A）；实现计划见 `docs/superpowers/plans/2026-08-16-gt-case-02-case-quality.md`；**尚未改产品代码**。  
> **日期**：2026-08-16  
> **关联**：`docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`（GT-CASE-02）  
> **方案**：推送门槛↑ + 研判独立 JSON 四节 + 不足降级标红（对齐 RD-LEN）

---

## 1. 目标与非目标

### 目标

- **案例推送**：`background` ≥ **400** 字（去空白计）；含多方角色张力、不完整信息、决策点。
- **研判输出**：独立四节字段（利益链 / 情绪动机 / 可执行策略 / 话术示例）；四节拼接 ≥ **600** 字；含情绪判断与可执行建议。
- **不足时**：仍返回并展示，**降级标红**（`quality: 'below_standard'`），不拒收。

### 非目标

- **不做** GT-SIM-02 独立「原话 | 问题 | 建议说法」对比表（可复用 `script_examples` 素材，但不在本项做表）。
- **不改** 用户填写的「四维拆解表单」字段名（`stakeholderInterests` 等）。
- **不强制** 本轮改线上 Dify YML 工作流定义（以服务端 prompt 注入 + normalize 兜底闭环）。

---

## 2. 架构

```
[换一条案例] → GET /api/game-theory/cases/push
                    ↓
         Dify 生成 / DB / FALLBACK
                    ↓
         evaluateCasePushQuality(background, …)
                    ↓
         返回 case + quality / quality_note
                    ↓
  GameTheoryModule：展示背景；below_standard 黄/红条

[提交四维研判] → POST /api/game-theory/analyze（任务中心）
                    ↓
         Dify analysis_result JSON
                    ↓
         ensureGameTheoryVerdictSections(parsed)
                    ↓
         full_result 含四节 + quality；写入历史
                    ↓
  对局历史展开：四分块展示 + 不足标红
```

### 复用模式

- 字数门禁风格对齐 `src/utils/readPushQuality.ts`
- 串台/不足兜底风格对齐 `aestheticsResultGuard`（本项不做词典检测）

---

## 3. 数据契约

### 3.1 案例推送

现有字段保留：`id, env, title, dedupe_key, background, incomplete_info, decision_point, source`

新增：

```ts
{
  quality: 'ok' | 'below_standard',
  quality_note?: string, // 如「背景未达 400 字详实门槛」
  char_count?: number    // background 去空白字数
}
```

**合格条件（全部满足才 `ok`）**

1. `background` 去空白长度 ≥ 400  
2. `incomplete_info` 去空白 ≥ 20（维持现有下限）  
3. `decision_point` 去空白 ≥ 20  
4. **多方角色启发式**：`background` 中至少匹配 **3** 个角色线索（职衔/称呼词表，如：董事长|CEO|VP|总监|老板|下属|同事|投资人|董事|秘书|法务|COO|CFO|创始人|大股东 等）；不足则 `below_standard`（仍展示）

**校验策略**

- `isValidCase`（能否入库/接受 Dify 原始输出）可仍略宽于展示门禁，或同步抬到 400——**实现约定：接受门槛与展示门槛统一为 background≥400**，过短 Dify 结果视为无效并走 fallback。  
- Fallback / 种子案例必须预先写满 ≥400，避免常态标红。

### 3.2 研判四节（独立 JSON，方案 A）

在 `GameTheoryAnalyzeResult` / `full_result` 上扩展：

```ts
{
  // 既有
  is_success: boolean;
  score: number;
  stakeholder_interests?: string;
  motives_analysis?: string;
  weaknesses?: string;
  causal_chain?: string[];
  prototype_archive?: …;
  suggestion: string;

  // 新增 GT-CASE-02
  interest_chain: string;       // 利益链
  emotion_motives: string;      // 情绪动机（面子/恐惧/欲望等）
  actionable_strategy: string;  // 可执行策略
  script_examples: string;      // 话术示例
  quality: 'ok' | 'below_standard';
  quality_note?: string;
  sections_char_count?: number; // 四节去空白合计
}
```

**合格条件**

- 四节均非空；且四节去空白合计 ≥ **600** → `quality: 'ok'`  
- 否则：`ensure…` 用中文分节兜底补齐缺失节（标明「系统补全」语义可写在 `quality_note`），`quality: 'below_standard'`，**仍写入历史并可展示**

**`suggestion`**

- 保留；若模型未给，可由四节首句摘要拼接（一句话汇总），避免历史列表预览空白。

**Prompt 注入（analyze）**

- 在现有 `case_text` 系统研判指令中，强制要求输出上述四节 JSON 字段；说明禁止空话套话，每节须有场景锚点。

---

## 4. UI

### 推送侧

- 「换一条」成功后：若 `quality === 'below_standard'`，在案例正文上方黄/红提示条（文案用 `quality_note` 或默认「案例背景未达详实门槛（GT-CASE-02）」）。

### 历史展开侧

- 在现有 `suggestion` 区块之上或替代主展示：四分块标题固定为  
  **利益链 / 情绪动机 / 可执行策略 / 话术示例**  
- `below_standard` 时顶部标红条。  
- 旧历史无四节字段：UI 降级仅显示 `suggestion`（不报错）。

---

## 5. 文件规划（实现阶段）

| 文件 | 职责 |
| --- | --- |
| `src/utils/gtCaseQuality.ts` (+test) | 推送字数/角色启发式；四节合计门禁 |
| `vocab-server/services/gameTheoryVerdictGuard.js` (+test) | `ensureGameTheoryVerdictSections` |
| `vocab-server/services/gameTheoryCasePushService.js` | 门槛 400、扩写 FALLBACK、返回 quality |
| `vocab-server/server.js` | analyze 归一化写入四节 |
| `src/services/difyAPI.ts` | 类型扩展 |
| `src/components/modules/GameTheoryModule.tsx` | 推送标红 + 历史四分块 |

---

## 6. 验收（对齐测试用例 GT-CASE-02）

| 路径 | 预期 |
| --- | --- |
| 驭心博弈 → 高管斗争案例 → 换一条 | 背景明显详实；多方；有未知信息与决策点；过短则标红仍可读 |
| 填四维 → 提交研判 → 任务完成 → 展开历史 | 四分块有内容；合计够长则无标红；过短则标红但仍可读 |

---

## 7. 自检

- [x] 无占位符 TBD 阻塞实现  
- [x] 与冻结表字数（400 / 600）一致  
- [x] 明确排除 GT-SIM-02 对比表  
- [x] 旧历史兼容路径已写明  

---

## 8. 下一步

用户审阅本规格无异议后，按 `docs/superpowers/plans/2026-08-16-gt-case-02-case-quality.md` 执行实现（默认 **不 commit**，除非用户要求）。
