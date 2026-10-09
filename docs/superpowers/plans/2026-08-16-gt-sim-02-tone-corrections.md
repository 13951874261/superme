# GT-SIM-02 语气修正对比表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Commit 策略：** 仅在用户明确要求 commit 时执行；默认改完跑测试即可。  
> **执行状态（2026-08-17）：** Task 1–5 已完成；单测/静态断言已绿；**未 commit**；手工 E2E 待用户本机验收。

**Goal:** 人机沙盘、多人会话复盘、案例研判历史均展示独立 `tone_corrections` 三列表（原话｜问题｜建议说法）；不得仅并入 strategy_guidance。

**Architecture:** 前后端共享 normalize/兜底；analyze 与 session personal-review 写入；`ToneCorrectionTable` 三处复用。

**Tech Stack:** React + TypeScript、Express（vocab-server）、node:test / vitest。

**Spec:** `docs/superpowers/specs/2026-08-16-gt-sim-02-tone-corrections-design.md`

---

## File map

| 文件 | 职责 |
| --- | --- |
| Create: `src/utils/toneCorrections.ts` (+test) | 校验、normalize、兜底 1 行 |
| Create: `vocab-server/services/toneCorrections.js` (+test) | 服务端镜像 |
| Create: `src/components/modules/GameTheory/ToneCorrectionTable.tsx` | 三列表 UI |
| Modify: `vocab-server/services/gameTheoryVerdictGuard.js` 或 analyze 路径 | 调用 ensureToneCorrections |
| Modify: `vocab-server/server.js` | analyze prompt 追加 tone_corrections |
| Modify: `vocab-server/services/gameTheorySessionService.js` | review normalize |
| Modify: `src/services/difyAPI.ts` / `GameTheorySessionTypes.ts` | 类型 |
| Modify: `GameTheoryModule.tsx` | 历史展开挂表 |
| Modify: `GameTheorySessionPanel.tsx` | ReviewView 挂表 |

---

### Task 1: 纯函数 `toneCorrections`（TDD）

**Files:**
- Create: `src/utils/toneCorrections.ts`
- Create: `src/utils/toneCorrections.test.ts`
- Create: `vocab-server/services/toneCorrections.js`
- Create: `vocab-server/tests/toneCorrections.test.js`

- [ ] **Step 1: 失败测试** — 空数组兜底 1 行；合法数组保留；残缺项过滤/补全  
- [ ] **Step 2: 实现**

```ts
export type ToneCorrection = { original: string; problem: string; suggested: string };

export function normalizeToneCorrections(
  raw: unknown,
  fallbackOriginal?: string
): { items: ToneCorrection[]; repaired: boolean }
```

兜底示例：
- original = fallbackOriginal 或「（未提供原话）」
- problem = 「表达过硬或分寸不足，易激怒对方或关闭谈判空间」
- suggested = 「先确认对方关切，再说明边界与可协商空间的下一句」

- [ ] **Step 3: 测试绿**

---

### Task 2: analyze 接入

**Files:**
- Modify: `vocab-server/server.js`（analyze 异步：`ensureGameTheoryVerdictSections` 之后）
- Modify: analyze 的 case_text 系统指令，要求输出 `tone_corrections`

- [ ] **Step 1:** `parsedResult = { ...parsedResult, tone_corrections: normalize(...).items }`（保留 repaired 信息可选写入 `tone_corrections_repaired`）  
- [ ] **Step 2:** prompt 追加字段说明  
- [ ] **Step 3:** 扩展 `gameTheoryVerdictGuard` 测试或新增 analyze 相关断言（可选轻量）

---

### Task 3: 会话 personal-review 接入

**Files:**
- Modify: `vocab-server/services/gameTheorySessionService.js`（`generatePersonalReview` 得到 review 后 normalize）
- Modify: fallback review 模板（约 strategy_guidance 旁）补默认 `tone_corrections`

- [ ] **Step 1:** 从最近用户回合抽取 fallbackOriginal  
- [ ] **Step 2:** `review.tone_corrections = normalize(...).items`  
- [ ] **Step 3:** 更新/新增 `test-game-theory-session-review.js` 或服务单测断言字段存在  

---

### Task 4: 前端类型 + `ToneCorrectionTable` + 双 UI

**Files:**
- Create: `ToneCorrectionTable.tsx`
- Modify: `GameTheoryAnalyzeResult`、`GameTheoryPersonalReview`
- Modify: `GameTheoryModule.tsx` 历史展开
- Modify: `GameTheorySessionPanel.tsx` `ReviewView`

- [ ] **Step 1:** 表格组件（三列标题固定）  
- [ ] **Step 2:** 历史：有数组则渲染（case + simulation）  
- [ ] **Step 3:** ReviewView：独立区块，置于 strategy_guidance 之前  
- [ ] **Step 4:** 静态断言可选（源码含 `tone_corrections` / 「语气修正」）

---

### Task 5: 验证清单

- [ ] `node --test vocab-server/tests/toneCorrections.test.js`  
- [ ] `npx vitest run src/utils/toneCorrections.test.ts`  
- [ ] 相关既有 GT analyze/session 测试不回归  
- [ ] 手工：人机偏硬应对 → 历史有表；会话复盘有表；案例研判历史有表  

**功能测试案例**

| 项 | 内容 |
| --- | --- |
| 编号 | GT-SIM-02 |
| 菜单路径 | 驭心博弈 → 人机对战沙盘 → 提交；另测会话复盘、案例历史 |
| 测试数据 | `你没资格过问我的编制。` |
| 预期 | 独立「语气修正」三列表，非仅 strategy_guidance 段落 |

---

## 执行说明

确认后 Subagent-Driven 按 Task 1→5 执行；**默认不 commit**。
