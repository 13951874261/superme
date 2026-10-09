# 词汇矩阵高密度重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把词汇矩阵 `Target Revealed` 态从「左栏易空旷 + 右栏三卡松散」改成「左上主卡 + 左下圆形记忆矩阵 + 右侧压缩三卡」，消除大面积空白，保持学习闭环不变。

**Architecture:** 在 `VocabTab` 翻转态左栏下方新增独立组件 `MemoryMatrixStage`，用现有 `payload` + `getMemoryAids` 组装圆心/双环节点；右栏继续挂 `MemoryAidPanel` / SM-2 / SOP，仅压缩密度。动效用 `@gsap/react` 的 `useGSAP` + `gsap.utils` 做节点分布与轻量入场，卸载自动 cleanup。不改造句评分与 SM-2 提交协议。

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide, gsap + `@gsap/react`, 现有 `vocabAPI` / `DictionaryPanel` 视图

**Spec:** `docs/superpowers/specs/2026-08-20-vocab-matrix-density-redesign-design.md`

**本仓库约束：** 每完成一个 Task 先向用户展示结果并等待确认，再进入下一 Task。`git commit` 仅在用户明确要求时执行。

---

## File Map

| 文件 | 职责 |
| --- | --- |
| Create: `src/utils/memoryMatrixNodes.ts` | 纯函数：从 payload + MemoryAids 组装圆心/环节点（可单测） |
| Create: `src/components/modules/english/tabs/vocab/MemoryMatrixStage.tsx` | 圆形记忆矩阵 UI + 轻量 GSAP |
| Modify: `src/components/modules/english/tabs/VocabTab.tsx` | 翻转态布局：左栏主卡+矩阵，右栏压缩三卡 |
| Modify: `src/components/MemoryAidPanel.tsx` | 图片 prompt 默认摘要折叠；可选 `compact` 密度 |
| Optional: `src/components/DictionaryPanel.tsx` | 仅当 VocabTab 复用视图仍偏空时，加可选 `dense` 间距；默认不影响独立词典面板 |
| Create: `src/utils/memoryMatrixNodes.test.ts`（或项目既有测试惯例路径） | 节点组装单测 |

---

### Task 1: 纯函数组装记忆矩阵节点

**Files:**
- Create: `src/utils/memoryMatrixNodes.ts`
- Create: `src/utils/memoryMatrixNodes.test.ts`（若项目无 vitest/jest 配置，则改为在文件内导出并用 `node` 临时断言脚本；优先复用现有前端测试工具）

- [ ] **Step 1: 确认项目测试命令**

Run:
```bash
node -e "const p=require('./package.json'); console.log(Object.keys(p.scripts||{}).join('\n'))"
```
Expected: 看到现有 `test` / `vitest` / `jest` 之一。若无测试脚本，后续 Step 用手动断言函数 + `npx tsc --noEmit` 代替，不新增测试框架。

- [ ] **Step 2: 编写节点组装实现**

```ts
// src/utils/memoryMatrixNodes.ts
import type { MemoryAids } from '../services/vocabAPI';

export type MatrixRingKind = 'synonym' | 'collocation' | 'scenario' | 'root' | 'assoc' | 'phrase' | 'image' | 'hook';

export interface MatrixNode {
  id: string;
  kind: MatrixRingKind;
  label: string;
  ring: 1 | 2;
}

export interface MatrixModel {
  centerTitle: string;
  centerMeaning: string;
  centerTag?: string;
  ring1: MatrixNode[];
  ring2: MatrixNode[];
  footerHook: string;
  imageUrl?: string;
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (typeof x === 'string') return x.trim();
      if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        return String(o.scene || o.example_en || o.en || o.text || '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

function short(text: string, max = 28): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildMemoryMatrixModel(input: {
  word: string;
  meaningZh: string;
  payload?: Record<string, unknown> | null;
  aids?: MemoryAids | null;
}): MatrixModel {
  const p = input.payload || {};
  const synonyms = asStringList(p.synonyms).slice(0, 4);
  const collocations = asStringList(p.collocations).slice(0, 3);
  const scenarios = asStringList(p.scenarios).slice(0, 3);

  const ring1: MatrixNode[] = [];
  synonyms.forEach((label, i) => {
    ring1.push({ id: `syn-${i}`, kind: 'synonym', label: short(label, 22), ring: 1 });
  });
  collocations.forEach((label, i) => {
    if (ring1.length >= 6) return;
    ring1.push({ id: `col-${i}`, kind: 'collocation', label: short(label, 24), ring: 1 });
  });
  scenarios.forEach((label, i) => {
    if (ring1.length >= 6) return;
    ring1.push({ id: `scn-${i}`, kind: 'scenario', label: short(label, 20), ring: 1 });
  });

  const ring2: MatrixNode[] = [];
  const aids = input.aids;
  ring2.push({
    id: 'image',
    kind: 'image',
    label: aids?.image_url ? '图片记忆' : '待生成图片',
    ring: 2,
  });
  if (aids?.root_memory) {
    ring2.push({ id: 'root', kind: 'root', label: short(aids.root_memory, 22), ring: 2 });
  }
  if (aids?.association_memory) {
    ring2.push({ id: 'assoc', kind: 'assoc', label: short(aids.association_memory, 22), ring: 2 });
  }
  if (aids?.mnemonic_phrase && ring2.length < 5) {
    ring2.push({ id: 'phrase', kind: 'phrase', label: short(aids.mnemonic_phrase, 22), ring: 2 });
  }

  const footerHook =
    aids?.mnemonic_phrase?.trim() ||
    aids?.association_memory?.trim() ||
    (scenarios[0] ? `场景钩子：${scenarios[0]}` : '先抓住圆心释义，再扫一圈联想节点');

  return {
    centerTitle: input.word,
    centerMeaning: short(input.meaningZh || '暂无中文释义', 40),
    centerTag: synonyms[0] ? short(synonyms[0], 10) : undefined,
    ring1: ring1.slice(0, 6),
    ring2: ring2.slice(0, 5),
    footerHook: short(footerHook, 64),
    imageUrl: aids?.image_url,
  };
}

/** 用极坐标把节点均匀分布到圆环（纯数学，便于单测） */
export function placeOnRing(
  count: number,
  radiusPx: number,
  startDeg = -90
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const deg = startDeg + (360 / count) * i;
    const rad = (deg * Math.PI) / 180;
    out.push({
      x: Math.cos(rad) * radiusPx,
      y: Math.sin(rad) * radiusPx,
    });
  }
  return out;
}
```

- [ ] **Step 3: 写并运行最小断言**

若存在 vitest：
```ts
// src/utils/memoryMatrixNodes.test.ts
import { describe, expect, it } from 'vitest';
import { buildMemoryMatrixModel, placeOnRing } from './memoryMatrixNodes';

describe('buildMemoryMatrixModel', () => {
  it('优先用 synonyms/collocations 填第一环，不超过 6', () => {
    const model = buildMemoryMatrixModel({
      word: 'strategic flexibility',
      meaningZh: '战略灵活性',
      payload: {
        synonyms: ['adaptability', 'agility', 'versatility', 'elasticity', 'extra'],
        collocations: ['maintain strategic flexibility', 'enhance operational flexibility'],
        scenarios: [{ scene: 'negotiation', example_en: 'We need flexibility.' }],
      },
      aids: { mnemonic_phrase: '谈判中灵活调向' },
    });
    expect(model.centerTitle).toBe('strategic flexibility');
    expect(model.ring1.length).toBeLessThanOrEqual(6);
    expect(model.ring1.some((n) => n.kind === 'synonym')).toBe(true);
    expect(model.ring2[0].kind).toBe('image');
    expect(model.footerHook).toContain('谈判');
  });

  it('placeOnRing 均匀返回 count 个点', () => {
    expect(placeOnRing(4, 100)).toHaveLength(4);
    expect(placeOnRing(0, 100)).toEqual([]);
  });
});
```

Run: 项目对应的 test 命令（Step 1 确认的那个）  
Expected: PASS

若无测试框架，Run:
```bash
npx tsc --noEmit
```
Expected: 无新增类型错误

- [ ] **Step 4: 向用户提交本步结果并等待确认**

说明：已完成节点组装纯函数 + 断言；尚未改 UI。  
问：「这是这一步的结果，请您检查是否符合预期？」

- [ ] **Step 5: Commit（仅当用户要求）**

```bash
git add src/utils/memoryMatrixNodes.ts src/utils/memoryMatrixNodes.test.ts
git commit -m "feat: add memory matrix node builder for vocab density redesign"
```

---

### Task 2: 实现静态圆形记忆矩阵组件（无动效）

**Files:**
- Create: `src/components/modules/english/tabs/vocab/MemoryMatrixStage.tsx`
- Create directory if missing: `src/components/modules/english/tabs/vocab/`

- [ ] **Step 1: 实现静态组件**

```tsx
// src/components/modules/english/tabs/vocab/MemoryMatrixStage.tsx
import React, { useMemo } from 'react';
import SpeakButton from '../../../../../SpeakButton';
import type { MemoryAids } from '../../../../../services/vocabAPI';
import {
  buildMemoryMatrixModel,
  placeOnRing,
  type MatrixNode,
} from '../../../../../utils/memoryMatrixNodes';

export interface MemoryMatrixStageProps {
  word: string;
  meaningZh: string;
  payload?: Record<string, unknown> | null;
  aids?: MemoryAids | null;
  onFocusImageAid?: () => void;
}

function NodeChip({ node }: { node: MatrixNode }) {
  const tone =
    node.kind === 'synonym'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : node.kind === 'collocation'
        ? 'bg-sky-50 text-sky-800 border-sky-200'
        : node.kind === 'image'
          ? 'bg-orange-50 text-orange-800 border-orange-200'
          : 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <span
      data-matrix-node
      className={`absolute -translate-x-1/2 -translate-y-1/2 max-w-[7.5rem] truncate rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-sm ${tone}`}
      title={node.label}
    >
      {node.label}
    </span>
  );
}

export default function MemoryMatrixStage({
  word,
  meaningZh,
  payload,
  aids,
  onFocusImageAid,
}: MemoryMatrixStageProps) {
  const model = useMemo(
    () => buildMemoryMatrixModel({ word, meaningZh, payload, aids }),
    [word, meaningZh, payload, aids]
  );

  const ring1Pos = placeOnRing(model.ring1.length, 112);
  const ring2Pos = placeOnRing(model.ring2.length, 168, -60);

  return (
    <div className="w-full rounded-2xl border border-emerald-100/80 bg-gradient-to-b from-emerald-50/40 to-white p-4">
      <div className="relative mx-auto aspect-square w-full max-w-[420px]">
        <div className="pointer-events-none absolute inset-[12%] rounded-full border border-emerald-300/70" />
        <div className="pointer-events-none absolute inset-[24%] rounded-full border border-emerald-200/80" />

        <div className="absolute left-1/2 top-1/2 z-10 w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-3 py-4 text-center shadow-sm">
          <div className="text-[11px] font-black tracking-wide text-[#202124] leading-snug break-words">
            {model.centerTitle}
          </div>
          <div className="mt-1 text-[10px] font-medium text-slate-600 leading-snug">
            {model.centerMeaning}
          </div>
          {model.centerTag && (
            <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-100">
              {model.centerTag}
            </span>
          )}
        </div>

        {model.ring1.map((node, i) => (
          <div
            key={node.id}
            className="absolute left-1/2 top-1/2"
            style={{ transform: `translate(${ring1Pos[i].x}px, ${ring1Pos[i].y}px)` }}
          >
            <NodeChip node={node} />
          </div>
        ))}

        {model.ring2.map((node, i) => (
          <button
            key={node.id}
            type="button"
            className="absolute left-1/2 top-1/2"
            style={{ transform: `translate(${ring2Pos[i].x}px, ${ring2Pos[i].y}px)` }}
            onClick={() => {
              if (node.kind === 'image') onFocusImageAid?.();
            }}
          >
            <NodeChip node={node} />
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-100 pt-3">
        <p className="text-[11px] text-slate-600 font-medium leading-snug flex-1 min-w-[12rem]">
          {model.footerHook}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {model.imageUrl ? (
            <a
              href={model.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-lg"
            >
              查看大图
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onFocusImageAid?.()}
              className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-lg"
            >
              去生成图片
            </button>
          )}
          <SpeakButton
            text={word}
            className="w-8 h-8 bg-slate-100 text-slate-600 hover:bg-[#FF5722] hover:text-white border border-slate-200 rounded-lg"
            iconClassName="w-3.5 h-3.5"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run:
```bash
npx tsc --noEmit
```
Expected: 无新增错误（若路径别名导致 import 过深，按仓库惯例改为相对路径修正，不改业务逻辑）

- [ ] **Step 3: 向用户提交本步结果并等待确认**

说明：矩阵组件已可独立渲染，但尚未挂到 VocabTab。  
问：「这是这一步的结果，请您检查是否符合预期？」

- [ ] **Step 4: Commit（仅当用户要求）**

```bash
git add src/components/modules/english/tabs/vocab/MemoryMatrixStage.tsx
git commit -m "feat: add static MemoryMatrixStage for vocab revealed view"
```

---

### Task 3: 在 VocabTab 翻转态挂载布局（主卡 + 矩阵 + 右栏）

**Files:**
- Modify: `src/components/modules/english/tabs/VocabTab.tsx`（`isFlipped` 分支，约 486–582 行）

- [ ] **Step 1: 增加记忆辅助数据拉取（供矩阵第二环）**

在 `VocabTab` 内增加：

```tsx
import { getMemoryAids, type MemoryAids } from '../../../../services/vocabAPI';
import MemoryMatrixStage from './vocab/MemoryMatrixStage';

// 组件内 state
const [matrixAids, setMatrixAids] = useState<MemoryAids | null>(null);
const memoryAidAnchorRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!currentWord?.id || !isFlipped) return;
  let cancelled = false;
  getMemoryAids(currentWord.id)
    .then((data) => {
      if (!cancelled) setMatrixAids(data || null);
    })
    .catch(() => {
      if (!cancelled) setMatrixAids(null);
    });
  return () => {
    cancelled = true;
  };
}, [currentWord?.id, isFlipped]);
```

从 `adaptedWord.payload` 提取 `meaningZh`（与现有 `spellChallengeData.meaning` 同源逻辑复用即可）。

- [ ] **Step 2: 重构翻转态左栏结构**

将 `lg:col-span-7` 左栏改为：

```tsx
<div className="lg:col-span-7 space-y-4">
  <div className="space-y-3">
    {adaptedWord.type === 'zh_modern' && <ZhModernView payload={adaptedWord.payload} query={currentWord.word} />}
    {adaptedWord.type === 'en_en_business' && <EnEnBusinessView payload={adaptedWord.payload} query={currentWord.word} />}
    {adaptedWord.type === 'en_zh_bidirectional' && <EnZhBidirectionalView payload={adaptedWord.payload} query={currentWord.word} />}
  </div>
  <MemoryMatrixStage
    word={currentWord.word}
    meaningZh={spellChallengeData.meaning}
    payload={adaptedWord.payload as Record<string, unknown>}
    aids={matrixAids}
    onFocusImageAid={() => {
      memoryAidAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }}
  />
</div>
```

右栏 `lg:col-span-5` 的 MemoryAidPanel 外包一层：

```tsx
<div ref={memoryAidAnchorRef} className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-3 shadow-sm">
  ...
  <MemoryAidPanel wordId={currentWord.id} wordText={currentWord.word} compact />
</div>
```

注意：下方造句区 / Anki 评分区块一行都不改。

- [ ] **Step 3: 本地目视验证清单**

菜单路径：`英语模块 → 词汇矩阵 → Enter 拼写通过或点「直接翻转」`

Expected:
1. 左下出现圆形双环矩阵，不再大块空绿圆
2. 右栏仍有三块
3. 造句区仍可用

- [ ] **Step 4: 向用户提交本步结果并等待确认**

- [ ] **Step 5: Commit（仅当用户要求）**

```bash
git add src/components/modules/english/tabs/VocabTab.tsx
git commit -m "feat: mount MemoryMatrixStage into vocab revealed layout"
```

---

### Task 4: 压缩右侧三卡与 MemoryAidPanel 密度

**Files:**
- Modify: `src/components/MemoryAidPanel.tsx`
- Modify: `src/components/modules/english/tabs/VocabTab.tsx`（SM-2 卡与 SOP 卡 className）

- [ ] **Step 1: MemoryAidPanel 增加 `compact?: boolean`**

```tsx
interface MemoryAidPanelProps {
  wordId: string;
  wordText: string;
  compact?: boolean;
}
```

在图片 tab 的 prompt 区块：

```tsx
const [promptExpanded, setPromptExpanded] = useState(false);
const prompt = memoryAids.image_prompt || '';
const promptPreview = prompt.length > 120 && !promptExpanded ? `${prompt.slice(0, 120)}…` : prompt;

// compact 时：py/空白更小；prompt 默认摘要
<p className={`text-xs text-slate-600 font-mono leading-relaxed select-all ${compact ? 'max-h-24 overflow-hidden' : ''}`}>
  {compact ? promptPreview : prompt}
</p>
{compact && prompt.length > 120 && (
  <button type="button" className="text-[10px] font-bold text-slate-500 mt-1" onClick={() => setPromptExpanded((v) => !v)}>
    {promptExpanded ? '收起' : '展开全文'}
  </button>
)}
```

`compact` 为 false 时行为与现网一致（独立复用处不受影响）。

- [ ] **Step 2: 压缩 SM-2 与 SOP 卡**

在 `VocabTab`：
- SM-2 容器：`p-5 space-y-4` → `p-3.5 space-y-3`
- 增加行动提示一行，例如：

```tsx
<p className="text-[10px] text-slate-300">
  {(currentWord.repetitions || 0) < 3
    ? '今日仍需高质量回忆，建议完成造句或 Anki 评分。'
    : '记忆较稳，可用造句巩固商务语态。'}
</p>
```

- SOP 卡：只保留「语态分寸 + 1 场景 + 1 提示」；去掉多余 emoji；内边距 `p-4` → `p-3`

- [ ] **Step 3: 向用户提交本步结果并等待确认**

Expected：右侧更紧，但仍是三块；FlashCard / 其他挂载 `MemoryAidPanel` 处默认外观不变。

- [ ] **Step 4: Commit（仅当用户要求）**

```bash
git add src/components/MemoryAidPanel.tsx src/components/modules/english/tabs/VocabTab.tsx
git commit -m "feat: compact vocab right-rail memory aids and SM-2 cards"
```

---

### Task 5: 接入轻量 GSAP（入场 + utils 分布微调）

**Files:**
- Modify: `src/components/modules/english/tabs/vocab/MemoryMatrixStage.tsx`

- [ ] **Step 1: 按项目惯例接入 useGSAP**

参考 `ListenVoicePicker.tsx`：

```tsx
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

// 组件内
const rootRef = useRef<HTMLDivElement>(null);

useGSAP(
  () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes = gsap.utils.toArray<HTMLElement>('[data-matrix-node]', rootRef.current);
    if (!nodes.length) return;
    if (reduce) {
      gsap.set(nodes, { autoAlpha: 1, scale: 1 });
      return;
    }
    gsap.fromTo(
      nodes,
      { autoAlpha: 0, scale: 0.85 },
      {
        autoAlpha: 1,
        scale: 1,
        duration: 0.35,
        stagger: 0.04,
        ease: 'power2.out',
        // 内容默认可见：若动画被跳过也不隐藏
        clearProps: 'transform',
      }
    );
  },
  { scope: rootRef, dependencies: [model.centerTitle, model.ring1.length, model.ring2.length], revertOnUpdate: true }
);
```

根容器加 `ref={rootRef}`。节点初始不要用 CSS `opacity:0` 永久隐藏；入场用 `fromTo`，保证无 JS 时仍可见。

可选：对半径用 `gsap.utils.clamp(96, 180, radius)` 做响应式微调（容器宽度变化时）。

- [ ] **Step 2: 验证动效边界**

Expected:
- 切词/翻转后节点 stagger 出现
- 无持续旋转 / pulse
- DevTools 切换 reduced-motion 后无夸张动画
- 离开页面无残留 inline transform 泄漏（`revertOnUpdate` / context cleanup）

- [ ] **Step 3: 向用户提交本步结果并等待确认**

- [ ] **Step 4: Commit（仅当用户要求）**

```bash
git add src/components/modules/english/tabs/vocab/MemoryMatrixStage.tsx
git commit -m "feat: add lightweight GSAP entrance for memory matrix nodes"
```

---

### Task 6: DictionaryPanel 密度（仅必要时）

**Files:**
- Modify: `src/components/DictionaryPanel.tsx`（仅当 Task 3 后左上主卡仍明显偏空）

- [ ] **Step 1: 评估是否需要**

若主卡同义词/搭配已默认展开且间距可接受 → **跳过本 Task**，在执行记录写「YAGNI skip」。

若仍空：给三个导出视图增加可选 prop：

```tsx
dense?: boolean
```

`dense` 时缩小 section 的 `space-y` / `p-*` 一档；VocabTab 传 `dense`，独立 `DictionaryPanel` 默认不传。

- [ ] **Step 2: 向用户提交本步结果（或明确跳过说明）并等待确认**

---

### Task 7: 验证与测试用例交付

**Files:** 无强制代码改动；输出验证记录

- [ ] **Step 1: 静态检查**

Run:
```bash
npx tsc --noEmit
```
Expected: PASS（或仅有与本改动无关的既有告警，需注明）

- [ ] **Step 2: 按 spec 用例逐条验证（一次一个）**

| ID | 菜单路径 | 测试数据 | 操作 | 预期 | 对应需求 |
| --- | --- | --- | --- | --- | --- |
| M1 | 英语 → 词汇矩阵 → 翻转 | 含 synonyms+collocations 的词 | 进入 Revealed | 圆心+环节点可见，左下无大块空圆 | 不空旷 + 保留圆 |
| M2 | 同上 | 任意到期词 | 看右栏 | 三卡仍在且更紧凑 | 保留三块压缩 |
| M3 | 同上 | 无 image_url | 看第二环/下沿 | 「待生成图片」可点并滚到右上 | 缺图兜底 |
| M4 | 同上 | 连续两词 | 评分切下一词 | 短促入场，无卡顿残留 | GSAP |
| M5 | 同上 | 任意词 | 造句评估 ≥3 | 仍写入复习，行为与改前一致 | 不破坏闭环 |

- [ ] **Step 3: 向用户交付验证结果与最终测试用例文案**

- [ ] **Step 4: Commit（仅当用户要求打包提交）**

```bash
git add -A
git status
# 用户确认后再 commit
```

---

## Spec Coverage Checklist（自检）

| Spec 要求 | 对应 Task |
| --- | --- |
| 方案 A 布局 | Task 3 |
| 圆心 + 双环 + 下沿 | Task 1–2 |
| 右栏三块压缩工具化 | Task 4 |
| 轻量 GSAP + utils + cleanup | Task 5 |
| 不改造句/SM-2 API | Task 3 明确不碰下方区 |
| 缺数据兜底 | Task 1 ring 裁切 + Task 2 待生成 |
| DictionaryPanel 谨慎改动 | Task 6 可选 |
| 验证用例 | Task 7 |

## Placeholder / Ambiguity Scan

- 无 TBD；测试框架若不存在，Task 1 已规定 fallback。
- `compact` / `dense` prop 默认 false，避免误伤其他入口。
- 节点坐标用 `placeOnRing`，GSAP 只做 opacity/scale。
