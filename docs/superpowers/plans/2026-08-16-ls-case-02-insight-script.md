# LS-CASE-02 洞察结构化长剧本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Commit 策略：** 仅在用户明确要求 commit 时执行各 Task 的 commit 步骤；默认改完跑测试即可。  
> **执行状态（2026-08-16）：** Task 1–6 已完成（Subagent-Driven）；单测全绿；**未 commit**；手工 E2E（三类 Tab 刷新/侧写）待用户本机验收。

**Goal:** 洞察(听)刷新案例返回并展示 `ScriptWorkshopDraft` 结构化长剧本，按 `scriptEvaluator` 估时门禁标注质量，侧写时 flatten 后走现有点评引擎；不引入对战/导入会话。

**Architecture:** 后端 `/api/insight/listen/scenario` 解析 Dify 答案为 draft（失败则分类兜底长剧本），计算 `evaluation`/`quality`（合格带分钟 ∈ [8,12]）；前端 `insightScript` 工具负责 flatten/门禁/解析，`InsightScriptReadonlyView` 只读展示，`ListenModule` 用 draft 展示并用 flatten 文本提交侧写。

**Tech Stack:** React + TypeScript（Vite）、Express（vocab-server）、node:test + tsx、复用 `ScriptWorkshopTypes` / `scriptEvaluator` 估时公式（字数/250）。

**Spec:** `docs/superpowers/specs/2026-08-16-ls-case-02-insight-script-design.md`

---

## File map

| 文件 | 职责 |
| --- | --- |
| Create: `src/utils/insightScript.ts` | flatten、质量门禁、解析 API、字符串包最小 draft |
| Create: `src/utils/insightScript.test.ts` | 上述纯函数单测 |
| Create: `src/components/modules/insight/InsightScriptReadonlyView.tsx` | 只读 UI |
| Create: `vocab-server/services/insightScenarioScript.js` | 服务端解析/门禁/flatten/分类兜底 |
| Create: `vocab-server/tests/insightScenarioScript.test.js` | 服务端单测 |
| Modify: `vocab-server/services/insightSpeakProxy.js` | 导出/衔接解析入口（若需要） |
| Modify: `vocab-server/server.js` | `/api/insight/listen/scenario` 返回新契约 |
| Modify: `src/services/difyAPI.ts` | `fetchDynamicInsightScenario` 返回结构化结果 |
| Modify: `src/components/modules/ListenModule.tsx` | 状态、加载、展示、侧写 |

---

### Task 1: 前端纯函数 `insightScript`（TDD）

**Files:**
- Create: `src/utils/insightScript.ts`
- Create: `src/utils/insightScript.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/utils/insightScript.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScriptWorkshopDraft } from '../components/modules/GameTheory/ScriptWorkshopTypes';
import {
  flattenInsightScript,
  evaluateInsightScriptQuality,
  wrapPlainScenarioAsDraft,
  parseInsightScenarioPayload,
} from './insightScript';

function minimalDraft(overrides: Partial<ScriptWorkshopDraft> = {}): ScriptWorkshopDraft {
  const base: ScriptWorkshopDraft = {
    sceneTitle: '测试场景',
    sceneSummary: '摘要一行',
    characters: [
      {
        id: 'c1',
        name: '张三',
        roleTitle: 'VP',
        surfaceGoal: '表面目标',
        hiddenMotive: '隐藏底牌',
        redLine: '红线',
        winCondition: '赢面',
      },
    ],
    infoMatrix: [],
    phases: [
      { phaseId: 1, title: '幕1', targetDuration: '', targetWordsRange: '', targetRatio: 0.25, content: '甲：你好。' },
      { phaseId: 2, title: '幕2', targetDuration: '', targetWordsRange: '', targetRatio: 0.25, content: '乙：你好。' },
      { phaseId: 3, title: '幕3', targetDuration: '', targetWordsRange: '', targetRatio: 0.25, content: '甲：对峙。' },
      { phaseId: 4, title: '幕4', targetDuration: '', targetWordsRange: '', targetRatio: 0.25, content: '乙：收束。' },
    ],
  };
  return { ...base, ...overrides, phases: (overrides.phases as ScriptWorkshopDraft['phases']) || base.phases };
}

test('flattenInsightScript 含标题、角色名、四幕片段', () => {
  const text = flattenInsightScript(minimalDraft());
  assert.match(text, /测试场景/);
  assert.match(text, /张三/);
  assert.match(text, /隐藏底牌/);
  assert.match(text, /甲：你好/);
  assert.match(text, /乙：收束/);
});

test('evaluateInsightScriptQuality：2000 字约 8 分钟为 ok', () => {
  const content = '字'.repeat(2000);
  const draft = minimalDraft({
    phases: [
      { phaseId: 1, title: '1', targetDuration: '', targetWordsRange: '', targetRatio: 1, content },
      { phaseId: 2, title: '2', targetDuration: '', targetWordsRange: '', targetRatio: 0, content: '' },
      { phaseId: 3, title: '3', targetDuration: '', targetWordsRange: '', targetRatio: 0, content: '' },
      { phaseId: 4, title: '4', targetDuration: '', targetWordsRange: '', targetRatio: 0, content: '' },
    ],
  });
  const q = evaluateInsightScriptQuality(draft);
  assert.equal(q.totalWords, 2000);
  assert.equal(q.estimatedMinutes, 8);
  assert.equal(q.passedDuration, true);
  assert.equal(q.quality, 'ok');
});

test('evaluateInsightScriptQuality：500 字为 below_standard', () => {
  const content = '字'.repeat(500);
  const draft = minimalDraft({
    phases: [
      { phaseId: 1, title: '1', targetDuration: '', targetWordsRange: '', targetRatio: 1, content },
      { phaseId: 2, title: '2', targetDuration: '', targetWordsRange: '', targetRatio: 0, content: '' },
      { phaseId: 3, title: '3', targetDuration: '', targetWordsRange: '', targetRatio: 0, content: '' },
      { phaseId: 4, title: '4', targetDuration: '', targetWordsRange: '', targetRatio: 0, content: '' },
    ],
  });
  const q = evaluateInsightScriptQuality(draft);
  assert.equal(q.quality, 'below_standard');
  assert.equal(q.passedDuration, false);
});

test('wrapPlainScenarioAsDraft 把纯文本放入 phase1', () => {
  const draft = wrapPlainScenarioAsDraft('短案例正文', '通用社交');
  assert.equal(draft.phases[0].content, '短案例正文');
  assert.ok(draft.sceneTitle.includes('通用社交') || draft.sceneTitle.length > 0);
});

test('parseInsightScenarioPayload 优先 draft，否则 scenario 字符串', () => {
  const withDraft = parseInsightScenarioPayload({
    success: true,
    draft: minimalDraft(),
    evaluation: { totalWords: 10, estimatedMinutes: 0.1, passedDuration: false },
    quality: 'below_standard',
  });
  assert.equal(withDraft.draft.sceneTitle, '测试场景');
  assert.equal(withDraft.quality, 'below_standard');

  const withString = parseInsightScenarioPayload({ success: true, scenario: '旧版字符串案例' });
  assert.equal(withString.draft.phases[0].content, '旧版字符串案例');
  assert.equal(withString.quality, 'below_standard');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run:

```bash
cd d:/cursor/work/super-agent
npx tsx --test src/utils/insightScript.test.ts
```

Expected: FAIL（模块不存在 / 导出未定义）

- [ ] **Step 3: 最小实现**

```ts
// src/utils/insightScript.ts
import type { ScriptWorkshopDraft, ScriptPhaseData } from '../components/modules/GameTheory/ScriptWorkshopTypes';
import { countWords, estimateDurationMinutes } from '../components/modules/GameTheory/scriptEvaluator';

export type InsightScriptQuality = 'ok' | 'below_standard';

export interface InsightScriptEvaluation {
  totalWords: number;
  estimatedMinutes: number;
  passedDuration: boolean;
}

export interface InsightScenarioResult {
  draft: ScriptWorkshopDraft;
  evaluation: InsightScriptEvaluation;
  quality: InsightScriptQuality;
  scenario: string;
}

function emptyPhase(phaseId: 1 | 2 | 3 | 4, content = ''): ScriptPhaseData {
  return {
    phaseId,
    title: `阶段${phaseId}`,
    targetDuration: '',
    targetWordsRange: '',
    targetRatio: 0.25,
    content,
  };
}

export function flattenInsightScript(draft: ScriptWorkshopDraft): string {
  const lines: string[] = [];
  lines.push(`【场景】${draft.sceneTitle || ''}`);
  if (draft.sceneSummary) lines.push(draft.sceneSummary);
  for (const c of draft.characters || []) {
    lines.push(
      `【角色】${c.name}（${c.roleTitle}）表层：${c.surfaceGoal}；底牌：${c.hiddenMotive}；红线：${c.redLine}；赢面：${c.winCondition}`
    );
  }
  for (const p of draft.phases || []) {
    lines.push(`【${p.title || `阶段${p.phaseId}`}】`);
    lines.push(p.content || '');
  }
  return lines.join('\n').trim();
}

export function evaluateInsightScriptQuality(draft: ScriptWorkshopDraft): InsightScriptEvaluation & { quality: InsightScriptQuality } {
  const totalWords = (draft.phases || []).reduce((sum, p) => sum + countWords(p.content || ''), 0);
  const estimatedMinutes = estimateDurationMinutes(totalWords);
  const passedDuration = estimatedMinutes >= 8 && estimatedMinutes <= 12;
  return {
    totalWords,
    estimatedMinutes,
    passedDuration,
    quality: passedDuration ? 'ok' : 'below_standard',
  };
}

export function wrapPlainScenarioAsDraft(scenario: string, category = ''): ScriptWorkshopDraft {
  const text = String(scenario || '').trim() || '（空案例）';
  return {
    sceneTitle: category ? `【${category}】动态案例` : '动态案例',
    sceneSummary: '由纯文本案例包装的最小结构化草稿',
    characters: [],
    infoMatrix: [],
    phases: [
      emptyPhase(1, text),
      emptyPhase(2),
      emptyPhase(3),
      emptyPhase(4),
    ],
  };
}

function isDraftLike(value: unknown): value is ScriptWorkshopDraft {
  if (!value || typeof value !== 'object') return false;
  const d = value as ScriptWorkshopDraft;
  return Array.isArray(d.phases) && d.phases.length === 4 && typeof d.sceneTitle === 'string';
}

export function parseInsightScenarioPayload(data: any): InsightScenarioResult {
  if (isDraftLike(data?.draft)) {
    const evaluation = data.evaluation && typeof data.evaluation === 'object'
      ? {
          totalWords: Number(data.evaluation.totalWords) || 0,
          estimatedMinutes: Number(data.evaluation.estimatedMinutes) || 0,
          passedDuration: Boolean(data.evaluation.passedDuration),
        }
      : (() => {
          const e = evaluateInsightScriptQuality(data.draft);
          return { totalWords: e.totalWords, estimatedMinutes: e.estimatedMinutes, passedDuration: e.passedDuration };
        })();
    const quality: InsightScriptQuality =
      data.quality === 'ok' || data.quality === 'below_standard'
        ? data.quality
        : evaluation.passedDuration
          ? 'ok'
          : 'below_standard';
    const scenario = String(data.scenario || flattenInsightScript(data.draft)).trim();
    return { draft: data.draft, evaluation, quality, scenario };
  }

  const scenario = String(data?.scenario || '').trim();
  if (!scenario) throw new Error('未返回动态考题');
  const draft = wrapPlainScenarioAsDraft(scenario);
  const e = evaluateInsightScriptQuality(draft);
  return {
    draft,
    evaluation: { totalWords: e.totalWords, estimatedMinutes: e.estimatedMinutes, passedDuration: e.passedDuration },
    quality: e.quality,
    scenario: flattenInsightScript(draft),
  };
}
```

- [ ] **Step 4: 再跑测试**

```bash
npx tsx --test src/utils/insightScript.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit（仅当用户要求）**

```bash
git add src/utils/insightScript.ts src/utils/insightScript.test.ts
git commit -m "test: add insight script flatten and quality helpers"
```

---

### Task 2: 服务端 `insightScenarioScript`（TDD）

**Files:**
- Create: `vocab-server/services/insightScenarioScript.js`
- Create: `vocab-server/tests/insightScenarioScript.test.js`
- Modify: `vocab-server/services/insightSpeakProxy.js`（导出 `extractJsonFromString` 若尚未导出，供解析复用）

- [ ] **Step 1: 写失败测试**

```js
// vocab-server/tests/insightScenarioScript.test.js
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  countScriptWords,
  estimateDurationMinutes,
  evaluateQuality,
  flattenDraft,
  buildScenarioResponse,
  getFallbackDraft,
} = require('../services/insightScenarioScript');

test('estimateDurationMinutes 2000 字 = 8.0', () => {
  assert.equal(estimateDurationMinutes(2000), 8);
});

test('evaluateQuality [8,12] 为 ok', () => {
  assert.equal(evaluateQuality(8).quality, 'ok');
  assert.equal(evaluateQuality(7.9).quality, 'below_standard');
  assert.equal(evaluateQuality(12).quality, 'ok');
  assert.equal(evaluateQuality(12.1).quality, 'below_standard');
});

test('getFallbackDraft 三类均有 4 幕', () => {
  for (const cat of ['体制内', '外企', '通用社交']) {
    const d = getFallbackDraft(cat);
    assert.equal(d.phases.length, 4);
    assert.ok(countScriptWords(d) > 1500);
  }
});

test('buildScenarioResponse 对纯字符串包装并标 below_standard', () => {
  const res = buildScenarioResponse({ answerText: '很短的案例' });
  assert.equal(res.success, true);
  assert.equal(res.draft.phases[0].content, '很短的案例');
  assert.equal(res.quality, 'below_standard');
  assert.ok(String(res.scenario).includes('很短的案例'));
});
```

- [ ] **Step 2: 跑测确认失败**

```bash
cd d:/cursor/work/super-agent/vocab-server
node --test tests/insightScenarioScript.test.js
```

Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现服务**

实现要点（完整代码写入 `insightScenarioScript.js`）：

1. `countScriptWords(draft)`：四幕 content 去空白计长（与前端 `countWords` 一致：`replace(/\s+/g,'')`）。
2. `estimateDurationMinutes(words)`：`Number((words/250).toFixed(1))`。
3. `evaluateQuality(minutes)`：`passedDuration = minutes>=8 && minutes<=12`。
4. `flattenDraft(draft)`：字段顺序与前端 `flattenInsightScript` 一致。
5. `wrapPlain(text, category)`：最小 4 幕 draft。
6. `tryParseDraft(answerText)`：用 `insightSpeakProxy.extractJsonFromString` + `JSON.parse`；校验 `phases.length===4`。
7. `getFallbackDraft(category)`：从 `PRESET_BENCHMARK_SCRIPTS` **复制一份 JSON** 进本文件（或 require 一份 `insightScenarioFallbacks.json`）。三类用同一长剧本，仅改 `sceneTitle` 前缀为 `【体制内】` / `【外企】` / `【通用社交】`（MVP 允许内容同源，保证字数达标）。
8. `buildScenarioResponse({ answerText, category })`：
   - 若 parse 成功 → 用该 draft；
   - 否则若 `answerText` 非空 → `wrapPlain`；
   - 否则 → `getFallbackDraft(category)`；
   - 计算 evaluation/quality；`scenario = flattenDraft(draft)`；返回 `{ success:true, draft, evaluation, quality, scenario }`。

同时在 `insightSpeakProxy.js` 的 `module.exports` 中导出 `extractJsonFromString`（若尚未导出）。

- [ ] **Step 4: 跑测确认通过**

```bash
node --test tests/insightScenarioScript.test.js
```

Expected: PASS

- [ ] **Step 5: Commit（仅当用户要求）**

```bash
git add vocab-server/services/insightScenarioScript.js vocab-server/tests/insightScenarioScript.test.js vocab-server/services/insightSpeakProxy.js
git commit -m "feat: add insight scenario script parse and quality gate on server"
```

---

### Task 3: 接线 `POST /api/insight/listen/scenario`

**Files:**
- Modify: `vocab-server/server.js`（约 L11055–11085）

- [ ] **Step 1: 改路由**

将成功路径改为：

```js
const { buildScenarioResponse } = require('./services/insightScenarioScript');
// ... existing dify call ...
let answerText = '';
try {
  const data = await runDifyCompletion({ apiKey, baseUrl, inputs: prepared.inputs, userId, query: '' });
  answerText = parseInsightGenAnswer(data);
} catch (difyErr) {
  // 无密钥或 Dify 失败：走兜底，不直接 500（与听模块前端兜底体验一致）
  console.warn('[insight/scenario] dify failed, using fallback', difyErr.message);
}
const payload = buildScenarioResponse({
  answerText,
  category: prepared.category,
});
return res.json(payload);
```

当 `category required` 仍 400。其他错误：若 `buildScenarioResponse` 总能返回兜底，则尽量 200；仅意外 throw 时 500。

- [ ] **Step 2: 手工 smoke（本机 vocab-server 已启动时）**

```bash
curl -s -X POST http://127.0.0.1:3001/api/insight/listen/scenario -H "Content-Type: application/json" -d "{\"category\":\"通用社交\",\"userId\":\"plan-test\"}"
```

Expected: JSON 含 `draft.phases` 长度 4、`quality`、`evaluation.estimatedMinutes`、`scenario` 非空。

- [ ] **Step 3: Commit（仅当用户要求）**

```bash
git add vocab-server/server.js
git commit -m "feat: return structured insight scenario draft from listen API"
```

---

### Task 4: 前端 API 客户端

**Files:**
- Modify: `src/services/difyAPI.ts`（`fetchDynamicInsightScenario`）

- [ ] **Step 1: 改返回类型**

```ts
import type { InsightScenarioResult } from '../utils/insightScript';
import { parseInsightScenarioPayload } from '../utils/insightScript';

export async function fetchDynamicInsightScenario(
  category: string,
  userId = getAppUserId()
): Promise<InsightScenarioResult> {
  const res = await fetch('/api/insight/listen/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `获取动态考题失败 HTTP ${res.status}`);
  return parseInsightScenarioPayload(data);
}
```

全仓搜索 `fetchDynamicInsightScenario`：目前仅 `ListenModule` 使用；一并改调用方（Task 5）。

- [ ] **Step 2: `npx tsc --noEmit` 确认类型错误仅剩 ListenModule（下一 Task 修）**

- [ ] **Step 3: Commit（仅当用户要求）**

```bash
git add src/services/difyAPI.ts
git commit -m "feat: fetchDynamicInsightScenario returns structured insight draft"
```

---

### Task 5: 只读展示组件 + ListenModule 接线

**Files:**
- Create: `src/components/modules/insight/InsightScriptReadonlyView.tsx`
- Modify: `src/components/modules/ListenModule.tsx`

- [ ] **Step 1: 创建只读视图**

组件 props：

```ts
type Props = {
  draft: ScriptWorkshopDraft;
  evaluation: { totalWords: number; estimatedMinutes: number };
  quality: 'ok' | 'below_standard';
  loading?: boolean;
};
```

UI 必须包含：

1. `quality === 'below_standard'` 时黄/红提示条：`未达 8–10 分钟标准（当前约 ${estimatedMinutes} 分钟）`
2. `sceneTitle` + `sceneSummary`
3. 角色卡：显示 `surfaceGoal` / `hiddenMotive` / `redLine`（底牌可见）
4. 四幕 `phases` 标题+正文
5. 元信息：字数、估时
6. **禁止**出现文案：`导入会话`、`开始对战`、`工坊`

样式跟随 ListenModule 现有 slate/zinc 深色面板，使用折叠可用 `<details>` 降低噪音。

- [ ] **Step 2: 改 ListenModule 状态**

- 增加：`currentDraft`、`scriptEvaluation`、`scriptQuality`
- 保留：`currentScenario: string`（侧写用，存 flatten 结果）
- `FALLBACK_SCENARIOS`：可保留作最后兜底；优先用服务端/前端 `wrap` + 质量计算。前端 catch 时：

```ts
import { PRESET_BENCHMARK_SCRIPTS } from './GameTheory/scriptEvaluator';
import { evaluateInsightScriptQuality, flattenInsightScript } from '../../utils/insightScript';

// catch:
const draft = {
  ...PRESET_BENCHMARK_SCRIPTS[0],
  sceneTitle: `【${category}】${PRESET_BENCHMARK_SCRIPTS[0].sceneTitle}`,
};
const e = evaluateInsightScriptQuality(draft);
setCurrentDraft(draft);
setScriptEvaluation(e);
setScriptQuality(e.quality);
setCurrentScenario(flattenInsightScript(draft));
```

- `loadNewScenario` success：

```ts
const result = await fetchDynamicInsightScenario(category);
setCurrentDraft(result.draft);
setScriptEvaluation(result.evaluation);
setScriptQuality(result.quality);
setCurrentScenario(result.scenario);
```

- 替换案例区原先 `{currentScenario}` 纯文本为：

```tsx
{currentDraft ? (
  <InsightScriptReadonlyView
    draft={currentDraft}
    evaluation={scriptEvaluation}
    quality={scriptQuality}
    loading={isLoadingScenario}
  />
) : (
  <p>{isLoadingScenario ? '正在生成新案例...' : currentScenario}</p>
)}
```

- 侧写提交：继续传 `scenario_text: currentScenario`（已是 flatten）。
- `currentDraft` 为空时禁用提交按钮。

- [ ] **Step 3: lint**

```bash
cd d:/cursor/work/super-agent
npm run lint
```

Expected: 无新增错误。

- [ ] **Step 4: Commit（仅当用户要求）**

```bash
git add src/components/modules/insight/InsightScriptReadonlyView.tsx src/components/modules/ListenModule.tsx
git commit -m "feat: show structured insight scripts in ListenModule readonly view"
```

---

### Task 6: 回归验证（DoD）

- [ ] **Step 1: 单测全跑**

```bash
cd d:/cursor/work/super-agent
npx tsx --test src/utils/insightScript.test.ts
cd vocab-server && node --test tests/insightScenarioScript.test.js
```

Expected: 全部 PASS

- [ ] **Step 2: 手工验收清单（对照 spec）**

| # | 操作 | 预期 |
| --- | --- | --- |
| 1 | 洞察(听) → 体制内/外企/通用社交 各点刷新 | 结构化角色+四幕，非无结构短句独占 |
| 2 | 看估时与质量条 | 多数 ok；若 below_standard 有标红且正文仍在 |
| 3 | 展开角色 | 可见隐藏底牌 |
| 4 | 填侧写并提交 | 能出点评 |
| 5 | 全文搜索 UI | 无「导入会话」「开始对战」 |

- [ ] **Step 3: 更新冻结表状态（可选文档）**

在 `docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md` 的 LS-CASE-02 行备注「设计+plan 已就绪 / 实现中」。

---

## Spec coverage 自检

| Spec 要求 | Task |
| --- | --- |
| ScriptWorkshopDraft + evaluator 估时 | 1, 2 |
| 合格带 [8,12]、below_standard 仍展示 | 1, 2, 5 |
| flatten 侧写 | 1, 5 |
| 只读 UI + 底牌可见 | 5 |
| 无导入会话/对战 | 5（禁止文案）+ 6 |
| API 契约 | 3, 4 |
| 兜底 | 2, 5 |
| 单测 | 1, 2, 6 |

**Dify 仓外 prompt：** 本 plan **不阻塞**：解析失败走长兜底；后续可另开任务改 Insight Gen 输出 JSON。

---

## 执行方式（请用户选择）

Plan 已保存。两种执行选项：

1. **Subagent-Driven（推荐）** — 每 Task 新开子代理，Task 间复审  
2. **Inline Execution** — 本会话按 `executing-plans` 批次执行并设检查点  

**请回复 1 或 2。** 未确认前不改产品代码。
