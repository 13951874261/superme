# English Strategic Roadmap Unlock & Custom Scenarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解锁英语战略路线图的完全限制，并在全场景分区（包括 ReadModule 和主框架）中加入用户手动新增/输入自定义学习路线及场景词条的功能。

**Architecture:** 
1. **路线图解锁放开**：在前端 `App.tsx` 和 `useOralWarRoomSession.ts` 中完全放开 `isLocked` 的硬编码限制；在口语沙盘通关后，自动将攻克记录（通过 `checkThemeMastery` 和 `setThemeFocus`）进行全局同步，实时在 `StrategicRoadmap.tsx` 中体现。
2. **自定义场景框架与词条表单**：在阅读剖析模块 `ReadModule.tsx` 的场景框架中，除了 `social`/`gov`/`corp` 以外，新增 `'custom'` 自定义模式。选择 `'custom'` 时，显示自定义输入表单，允许用户手动输入战略路线、演练场景细节或词条，并能在本地 `localStorage` 或通过 API 存储。

**Tech Stack:** React 19 + TypeScript + Tailwind CSS

---

### Task 1: 完全放开解锁拦截器限制

**Files:**
- Modify: `src/App.tsx:173-176`

- [ ] **Step 1: 修改 isLocked 的硬编码判定条件，完全放开路线图锁定限制。**

```typescript
// 寻找 App.tsx 原来的 isLocked 判定：
// const isLocked = (isInterceptorEnabled && !masteryData._isInitial && (
//   false /* 战略路线图达标不再进行强制锁定 */
// )) || !!pendingSentenceDebt || shouldForceModal;

// 修改为：
const isLocked = !!pendingSentenceDebt || shouldForceModal;
```

- [ ] **Step 2: 验证编译通过。**

Run: `npm run lint`
Expected: 编译通过且无 TS 类型报错。

---

### Task 2: 完善路线图的通关解锁与同步

**Files:**
- Modify: `src/components/modules/oralWarRoom/useOralWarRoomSession.ts`
- Modify: `src/components/modules/english/context/EnglishContext.tsx`

- [ ] **Step 1: 在 useOralWarRoomSession.ts 的通关判定条件满足时，主动调用后端接口同步解锁状态。**

```typescript
// 寻找 sandbox 状态及 metrics 通关逻辑，并在通关时触发 setThemeFocus / checkThemeMastery 更新 masteredThemes
```

- [ ] **Step 2: 在 EnglishContext.tsx 中增加将自定义主题加入 masteredThemes 列表的辅助方法。**

---

### Task 3: 在 ReadModule 中新增自定义场景框架表单

**Files:**
- Modify: `src/components/modules/ReadModule.tsx`

- [ ] **Step 1: 扩展 sceneFramework 状态以包含 'custom'。**

```typescript
const [sceneFramework, setSceneFramework] = useState<'social' | 'gov' | 'corp' | 'custom'>('gov');
const [customSceneInput, setCustomSceneInput] = useState('');
```

- [ ] **Step 2: 在 UI 中添加“自定义场景”按钮，并在选中时呈现文本输入表单。**

- [ ] **Step 3: 自定义模式下的 AI 提示生成支持。**

```typescript
const frameworkText = { social: '通用社交', gov: '体制内职场', corp: '跨国企业', custom: customSceneInput || '自定义场景' }[sceneFramework];
```

---

### Task 4: 添加战略场景自定义表单单测与集成验证

**Files:**
- Create: `tests/StrategicRoadmapCustom.spec.ts`

- [ ] **Step 1: 编写自动化测试，验证在自定义框架下，场景内容能正确传递给 AI 提炼 API。**

---