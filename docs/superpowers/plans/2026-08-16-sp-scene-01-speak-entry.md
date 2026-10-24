# SP-SCENE-01 说页场景博弈入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Commit 策略：** 仅在用户明确要求时 commit。  
> **执行状态（2026-08-16）：** Task 1–5 已完成（Subagent-Driven）；`gtFocusTab` 单测通过；**未 commit**；手工跳转验收待用户本机确认。

**Goal:** 破局(说) P1 通栏按钮跳转到驭心「多人群体博弈会话」Tab，复用 sessionStorage 深链，不改会话内核。

**Architecture:** Speak 写 `gt_focus_tab=session` + `setActiveModule('gametheory')` + 派发 `navigate-gametheory-session`；GameTheoryModule 消费 key 并 `setActiveTab('session')`（对齐 `gt_focus_history_id` 模式）。

**Tech Stack:** React + TypeScript；`sessionStorage`；`CustomEvent`。

**Spec:** `docs/superpowers/specs/2026-08-16-sp-scene-01-speak-entry-design.md`

---

## File map

| 文件 | 职责 |
| --- | --- |
| Create: `src/utils/gtFocusTab.ts` | key 常量、写入、消费（可单测） |
| Create: `src/utils/gtFocusTab.test.ts` | 单测 |
| Modify: `src/components/MainContent.tsx` | 向 SpeakModule 传 `setActiveModule` |
| Modify: `src/components/modules/SpeakModule.tsx` | props + P1 通栏按钮 |
| Modify: `src/components/modules/GameTheoryModule.tsx` | 消费深链 + 事件监听 |

---

### Task 1: `gtFocusTab` 工具（TDD）

**Files:**
- Create: `src/utils/gtFocusTab.ts`
- Create: `src/utils/gtFocusTab.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/utils/gtFocusTab.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GT_FOCUS_TAB_KEY,
  GT_FOCUS_TAB_SESSION,
  GT_NAV_SESSION_EVENT,
  requestGameTheorySessionFocus,
  consumeGameTheorySessionFocus,
} from './gtFocusTab';

test('常量', () => {
  assert.equal(GT_FOCUS_TAB_KEY, 'gt_focus_tab');
  assert.equal(GT_FOCUS_TAB_SESSION, 'session');
  assert.equal(GT_NAV_SESSION_EVENT, 'navigate-gametheory-session');
});

test('request 写入 session；consume 读出并清除', () => {
  const store = new Map<string, string>();
  const fakeSession = {
    setItem: (k: string, v: string) => { store.set(k, v); },
    getItem: (k: string) => store.get(k) ?? null,
    removeItem: (k: string) => { store.delete(k); },
  } as Storage;

  const events: string[] = [];
  const fakeWindow = {
    dispatchEvent: (e: Event) => {
      events.push(e.type);
      return true;
    },
  } as Window;

  requestGameTheorySessionFocus({ sessionStorage: fakeSession, win: fakeWindow });
  assert.equal(store.get(GT_FOCUS_TAB_KEY), 'session');
  assert.deepEqual(events, [GT_NAV_SESSION_EVENT]);

  assert.equal(consumeGameTheorySessionFocus({ sessionStorage: fakeSession }), true);
  assert.equal(store.has(GT_FOCUS_TAB_KEY), false);
  assert.equal(consumeGameTheorySessionFocus({ sessionStorage: fakeSession }), false);
});

test('非法值 consume 返回 false 并清除', () => {
  const store = new Map<string, string>([[GT_FOCUS_TAB_KEY, 'cases']]);
  const fakeSession = {
    setItem: (k: string, v: string) => { store.set(k, v); },
    getItem: (k: string) => store.get(k) ?? null,
    removeItem: (k: string) => { store.delete(k); },
  } as Storage;
  assert.equal(consumeGameTheorySessionFocus({ sessionStorage: fakeSession }), false);
  assert.equal(store.has(GT_FOCUS_TAB_KEY), false);
});
```

- [ ] **Step 2: 跑测确认失败**

```bash
cd d:/cursor/work/super-agent
npx tsx --test src/utils/gtFocusTab.test.ts
```

Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

```ts
// src/utils/gtFocusTab.ts
export const GT_FOCUS_TAB_KEY = 'gt_focus_tab';
export const GT_FOCUS_TAB_SESSION = 'session';
export const GT_NAV_SESSION_EVENT = 'navigate-gametheory-session';

type FocusDeps = {
  sessionStorage?: Storage;
  win?: Window;
};

export function requestGameTheorySessionFocus(deps: FocusDeps = {}): void {
  const ss = deps.sessionStorage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  const w = deps.win ?? (typeof window !== 'undefined' ? window : undefined);
  ss?.setItem(GT_FOCUS_TAB_KEY, GT_FOCUS_TAB_SESSION);
  if (w) {
    w.dispatchEvent(new CustomEvent(GT_NAV_SESSION_EVENT));
  }
}

/** @returns true 表示应切换到 session Tab */
export function consumeGameTheorySessionFocus(deps: FocusDeps = {}): boolean {
  const ss = deps.sessionStorage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  if (!ss) return false;
  const raw = ss.getItem(GT_FOCUS_TAB_KEY);
  ss.removeItem(GT_FOCUS_TAB_KEY);
  return raw === GT_FOCUS_TAB_SESSION;
}
```

- [ ] **Step 4: 跑测确认通过**

```bash
npx tsx --test src/utils/gtFocusTab.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit（仅当用户要求）**

---

### Task 2: MainContent 传 props

**Files:**
- Modify: `src/components/MainContent.tsx`

- [ ] **Step 1: 改 Speak 渲染**

将：

```tsx
<SpeakModule />
```

改为：

```tsx
<SpeakModule setActiveModule={setActiveModule} />
```

- [ ] **Step 2: 确认无其它调用方需要改**（仅此处 lazy 挂载）

- [ ] **Step 3: Commit（仅当用户要求）**

---

### Task 3: SpeakModule P1 入口

**Files:**
- Modify: `src/components/modules/SpeakModule.tsx`

- [ ] **Step 1: 增加 props 类型**

在组件前：

```ts
import type { ModuleType } from '../../App';
import { requestGameTheorySessionFocus } from '../../utils/gtFocusTab';
import { Users } from 'lucide-react'; // 若未导入则加入现有 lucide import 列表

type SpeakModuleProps = {
  setActiveModule?: (m: ModuleType) => void;
};

export default function SpeakModule({ setActiveModule }: SpeakModuleProps = {}) {
```

（若当前是 `export default function SpeakModule()`，改为接收 props；默认 `{}` 避免其它测试挂载崩。）

- [ ] **Step 2: 在 Tab 行上方插入 P1 通栏**（约在 `flex border-b ... pb-3 mb-6` 的 **前面**）

```tsx
<div className="mb-4 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-slate-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  <div>
    <p className="text-sm font-black text-slate-800">进入场景博弈会话</p>
    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
      多轮 1VS1/多人博弈，结束后再出阶层与利益全景分析
    </p>
  </div>
  <button
    type="button"
    onClick={() => {
      playClick();
      requestGameTheorySessionFocus();
      if (setActiveModule) {
        setActiveModule('gametheory');
      } else {
        console.warn('[SpeakModule] setActiveModule 未传入，已写入 gt_focus_tab');
      }
    }}
    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-4 py-2.5 shadow-sm whitespace-nowrap"
  >
    <Users className="w-4 h-4" />
    进入场景博弈会话
  </button>
</div>
```

注意：`requestGameTheorySessionFocus` 已 dispatch 事件；顺序为 **先 request 再 setActiveModule**，以便模块 mount 时能读到 storage（若事件在未 mount 时发出，mount 时的 `consume` 仍会读到 storage）。

更稳顺序（推荐写入实现）：

```ts
playClick();
if (typeof sessionStorage !== 'undefined') {
  sessionStorage.setItem('gt_focus_tab', 'session');
}
setActiveModule?.('gametheory');
requestGameTheorySessionFocus(); // 若 request 会重复 setItem，可拆成 setItem + dispatch；或让 request 只 set+dispatch，且在 setActiveModule 之前调用一次即可
```

**实现约定（避免双写混乱）：** 点击处理为：

```ts
onClick={() => {
  playClick();
  requestGameTheorySessionFocus(); // setItem + dispatch
  setActiveModule?.('gametheory');
}}
```

GameTheory 在 mount 与事件两处都 `consume`（见 Task 4）。若 mount 时已消费，事件里再 consume 得 false，无害。

- [ ] **Step 3: `npm run lint` 确认 Speak/MainContent 无新错**

- [ ] **Step 4: Commit（仅当用户要求）**

---

### Task 4: GameTheoryModule 消费深链

**Files:**
- Modify: `src/components/modules/GameTheoryModule.tsx`

- [ ] **Step 1: import**

```ts
import { consumeGameTheorySessionFocus, GT_NAV_SESSION_EVENT } from '../../utils/gtFocusTab';
```

- [ ] **Step 2: 在 `gt_focus_history_id` 的 useEffect 旁新增**

```ts
useEffect(() => {
  const applySessionFocus = () => {
    if (consumeGameTheorySessionFocus()) {
      setActiveTab('session');
    }
  };
  applySessionFocus();
  const onNav = () => applySessionFocus();
  window.addEventListener(GT_NAV_SESSION_EVENT, onNav);
  return () => window.removeEventListener(GT_NAV_SESSION_EVENT, onNav);
}, []);
```

不要改 history 深链现有逻辑。不要改 `GameTheorySessionPanel`。

- [ ] **Step 3: Commit（仅当用户要求）**

---

### Task 5: DoD 手工验收

- [ ] **Step 1: 单测**

```bash
npx tsx --test src/utils/gtFocusTab.test.ts
```

Expected: PASS

- [ ] **Step 2: 手工清单**

| # | 操作 | 预期 |
| --- | --- | --- |
| 1 | 破局(说) | Tab 上方见通栏「进入场景博弈会话」 |
| 2 | 点击 | 进入驭心，Tab 为「多人群体博弈会话」 |
| 3 | 在 session 看角色数 | 可自选 2+/多人，未自动开局 |
| 4 | 顶栏再回说，再点入口 | 再次落到 session |
| 5 | 说页四 Tab 审阅 | 仍可用 |
| 6 | 说页 DOM | 无内嵌完整会话面板 |

---

## Spec coverage

| Spec | Task |
| --- | --- |
| P1 通栏文案 | 3 |
| gt_focus_tab + setActiveModule | 1, 2, 3 |
| 事件 + 已在模块内再点 | 1, 4 |
| 不改会话内核 | 4（仅 setActiveTab） |
| 测试/DoD | 1, 5 |

---

## 执行方式

Plan 已保存到 `docs/superpowers/plans/2026-08-16-sp-scene-01-speak-entry.md`。

1. **Subagent-Driven（推荐）**  
2. **Inline Execution**  

**请回复 1 或 2。** 确认前不改产品代码。
