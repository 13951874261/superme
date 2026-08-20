# GT-CASE-02 案例详实度与研判四节 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Commit 策略：** 仅在用户明确要求 commit 时执行各 Task 的 commit 步骤；默认改完跑测试即可。  
> **执行状态（2026-08-16）：** Task 1–6 已完成；相关单测已绿；**未 commit**；手工 E2E 待用户本机验收。

**Goal:** 驭心案例推送 `background`≥400 + 多方启发式门禁；研判结果强制独立四节 JSON 且合计≥600；不足降级标红仍展示。

**Architecture:** 前端/后端共享质量规则（推送字数+角色启发式；四节字数）；`gameTheoryCasePushService` 抬门槛并扩写 fallback；`gameTheoryVerdictGuard` 在 analyze 任务完成时 normalize 四节写入 `full_result`；`GameTheoryModule` 展示 quality 条与历史四分块。

**Tech Stack:** React + TypeScript、Express（vocab-server）、node:test / vitest、任务中心异步 analyze。

**Spec:** `docs/superpowers/specs/2026-08-16-gt-case-02-case-quality-design.md`

---

## File map

| 文件 | 职责 |
| --- | --- |
| Create: `src/utils/gtCaseQuality.ts` | `GT_CASE_BG_MIN=400`、`GT_VERDICT_SECTIONS_MIN=600`、推送/四节 evaluate |
| Create: `src/utils/gtCaseQuality.test.ts` | 纯函数单测 |
| Create: `vocab-server/services/gameTheoryVerdictGuard.js` | ensure 四节 + quality |
| Create: `vocab-server/tests/gameTheoryVerdictGuard.test.js` | 服务端单测 |
| Modify: `vocab-server/services/gameTheoryCasePushService.js` | 400 门槛、FALLBACK 扩写、返回 quality |
| Modify: `vocab-server/tests/gameTheoryCasePush.test.js` | 断言 ≥400 / quality |
| Modify: `vocab-server/server.js` | analyze 路径调用 guard |
| Modify: `src/services/difyAPI.ts` | 类型：CasePush quality + AnalyzeResult 四节 |
| Modify: `src/components/modules/GameTheoryModule.tsx` | 推送条 + 历史四分块 |

---

### Task 1: 前端纯函数 `gtCaseQuality`（TDD）

**Files:**
- Create: `src/utils/gtCaseQuality.ts`
- Create: `src/utils/gtCaseQuality.test.ts`

- [ ] **Step 1: 写失败测试**（vitest 或 node:test，与仓库现有 utils 测试一致）

覆盖：
- 短 background → `below_standard`
- ≥400 且 ≥3 角色线索 → `ok`
- 四节合计 <600 → `below_standard`；≥600 → `ok`

- [ ] **Step 2: 实现 `gtCaseQuality.ts`**

```ts
export const GT_CASE_BG_MIN = 400;
export const GT_VERDICT_SECTIONS_MIN = 600;
export const GT_ROLE_HINT_RE = /董事长|CEO|COO|CFO|VP|总监|老板|下属|同事|投资人|董事|秘书|法务|创始人|大股东|总裁|经理/gi;

export function countCompactChars(text: string): number {
  return String(text || '').replace(/\s+/g, '').length;
}

export function countRoleHints(background: string): number {
  const matches = String(background || '').match(GT_ROLE_HINT_RE);
  return matches ? matches.length : 0;
}

export function evaluateCasePushQuality(caseLike: {
  background?: string;
  incomplete_info?: string;
  decision_point?: string;
}): { quality: 'ok' | 'below_standard'; quality_note?: string; char_count: number; role_hints: number }

export function evaluateVerdictSectionsQuality(sections: {
  interest_chain?: string;
  emotion_motives?: string;
  actionable_strategy?: string;
  script_examples?: string;
}): { quality: 'ok' | 'below_standard'; quality_note?: string; sections_char_count: number }
```

- [ ] **Step 3: 跑测试至绿**

---

### Task 2: 服务端 `gameTheoryVerdictGuard`（TDD）

**Files:**
- Create: `vocab-server/services/gameTheoryVerdictGuard.js`
- Create: `vocab-server/tests/gameTheoryVerdictGuard.test.js`

- [ ] **Step 1: 测试** — 缺节补齐、`quality` 标记、`suggestion` 兜底  
- [ ] **Step 2: 实现 `ensureGameTheoryVerdictSections(parsed)`**  
  - 读四节；空则写入中文兜底段落（含「系统补全」提示）  
  - 用与前端一致的 600 字规则设 `quality`  
  - 无 `suggestion` 时用四节摘要  
- [ ] **Step 3: 测试绿**

---

### Task 3: 抬高案例推送门槛 + 扩写 FALLBACK

**Files:**
- Modify: `vocab-server/services/gameTheoryCasePushService.js`
- Modify: `vocab-server/tests/gameTheoryCasePush.test.js`
- Modify: Dify mock 用例里的短 `background`（测试夹具须 ≥400）

- [ ] **Step 1: 失败测试** — `background` 须 ≥400；返回含 `quality`  
- [ ] **Step 2:** `isValidCase` 改为 `background.length` 按去空白 ≥400（或等价）  
- [ ] **Step 3:** 扩写两条 `FALLBACK_CASES` 背景至 ≥400，并确保角色线索 ≥3  
- [ ] **Step 4:** `getCasePush` 返回前附加 `evaluate` 结果（可在服务内复制精简版规则，避免跨 TS；或 require 一份 `vocab-server/services/gtCaseQuality.js` 镜像）  
  - **实现约定：** 在 `vocab-server/services/gtCaseQuality.js` 放与前端同规则的 JS 镜像，前后端各测一份，避免构建耦合。  
- [ ] **Step 5: 强化 `generation_request` prompt**：要求背景≥400 字、≥3 方角色、incomplete_info、decision_point  
- [ ] **Step 6: 测试绿**

---

### Task 4: analyze 路径接入 guard

**Files:**
- Modify: `vocab-server/server.js`（`/api/game-theory/analyze` 异步完成处，约 JSON.parse 成功之后、写历史之前）

- [ ] **Step 1:** `parsedResult = ensureGameTheoryVerdictSections(parsedResult)`  
- [ ] **Step 2:** 在注入 `case_text` 的系统指令中追加：必须输出四节字段名与字数要求  
- [ ] **Step 3:** 如有 analyze 相关静态/单测则更新；否则以 Task 2 单测为准  

---

### Task 5: 前端类型 + UI

**Files:**
- Modify: `src/services/difyAPI.ts` — `GameTheoryCasePush` / `GameTheoryAnalyzeResult`  
- Modify: `src/components/modules/GameTheoryModule.tsx`

- [ ] **Step 1:** `refreshPushedCase` 保存/展示 `quality`；`below_standard` 时案例区顶部提示条  
- [ ] **Step 2:** 历史展开：若存在四节则四分块渲染；否则仅 `suggestion`；`quality==='below_standard'` 标红  
- [ ] **Step 3:** 可选静态断言测试（参考 `gameTheoryCasePushFrontend.test.js`）检查关键文案/字段名出现  

---

### Task 6: 验证清单

- [ ] `node --test vocab-server/tests/gameTheoryVerdictGuard.test.js`  
- [ ] `node --test vocab-server/tests/gameTheoryCasePush.test.js`（或项目惯用入口）  
- [ ] `npx vitest run src/utils/gtCaseQuality.test.ts`  
- [ ] 手工：换一条看背景长度与标红；提交研判后展开历史看四分块  

**功能测试案例（交付用）**

| 项 | 内容 |
| --- | --- |
| 编号 | GT-CASE-02 |
| 菜单路径 | 驭心博弈 → 高管斗争案例研判 → 换一条 → 填四维 → 提交 |
| 测试数据 | 任意 env Tab；应对若干句 |
| 预期 | 背景详实（或标红仍可读）；历史四分块有利益链/情绪/策略/话术；不足标红 |
| 对应需求 | 7.22 博弈-1 案例详实 + 研判有逻辑与情感 |

---

## 执行说明

确认本 plan 后，使用 **Subagent-Driven Development** 按 Task 1→6 顺序执行；每 Task 测绿再进下一项；**默认不 commit**。
