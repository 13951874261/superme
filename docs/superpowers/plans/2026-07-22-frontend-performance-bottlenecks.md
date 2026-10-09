# Frontend Performance Bottlenecks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut unnecessary EnglishContext re-renders, Sidebar calendar work, and RightPanel duplicate `getAllWords` calls with minimal surgical diffs.

**Architecture:** Theme/Vocab/Media Providers already exist but are unused by consumers. Primary fix is migrate hot consumers off `useEnglishContext` onto domain hooks; secondarily memoize Sidebar calendar reads and coalesce RightPanel word loads. Do **not** drop `themeValue/vocabValue/mediaValue` from `legacyValue` deps without atomic replacements (that would stale).

**Tech Stack:** React 18, Vite 6, Playwright (smoke), Chrome DevTools Network/Performance

---

### Task 1: Migrate App off legacy EnglishContext (P0)

**Files:**
- Modify: `src/App.tsx`
- Modify (only if types export needed): `src/components/modules/english/context/EnglishContext.tsx`
- Test: manual + optional Playwright smoke

- [ ] **Step 1: Write failing assertion / smoke note**

Document expected: changing `currentWordIdx` in VocabTab must **not** re-render App lock banner props when mastery/debt unchanged. Use React DevTools "Highlight updates" or a temporary render counter.

- [ ] **Step 2: Switch App to `useThemeMastery`**

```tsx
// App.tsx — replace useEnglishContext destructure for theme/mastery/debt
import { EnglishProvider, useEnglishContext, useThemeMastery } from './components/modules/english/context/EnglishContext';

// Inside AppContent (or equivalent child of EnglishProvider):
const { setActiveTab } = useEnglishContext(); // keep only what legacy still owns
const { theme, masteryData, pendingSentenceDebt } = useThemeMastery();
```

If `setActiveTab` is the only remaining legacy need, keep that single hook call; prefer not spreading full context.

- [ ] **Step 3: Verify App no longer subscribed to vocab/media churn**

Run: `npm run dev`, open Vocab, flip cards / change idx, watch App with Highlight updates.
Expected: App does not flash on every word index change.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "perf: subscribe App to theme mastery context only"
```

---

### Task 2: Migrate VocabTab to useVocabState (+ thin legacy) (P0)

**Files:**
- Modify: `src/components/modules/english/tabs/VocabTab.tsx`

- [ ] **Step 1: Split hooks**

```tsx
const { activeTab, theme, inlineNotice, noticeAnchor, showNotice } = useEnglishContext();
const {
  vocabZone, setVocabZone,
  dueWords, setDueWords,
  currentWordIdx, setCurrentWordIdx,
  sentenceInput, setSentenceInput,
  isEvaluating, setIsEvaluating,
  loadingDueWords, setLoadingDueWords,
} = useVocabState();
const { pendingSentenceDebt, setPendingSentenceDebt } = useThemeMastery();
```

- [ ] **Step 2: Gate reloadVocab**

```tsx
useEffect(() => {
  if (activeTab === 'vocab' && dueWords.length === 0) {
    void reloadVocab();
  }
}, [activeTab, vocabZone, dueWords.length, reloadVocab]);
```

Keep `vocab-updated` listener calling `reloadVocab()` (force refresh on mutation).

- [ ] **Step 3: Stabilize reloadVocab deps**

```tsx
const reloadVocab = useCallback(async () => {
  setLoadingDueWords(true);
  try {
    const data = await getReviewWords();
    if (Array.isArray(data) && data.length > 0) {
      setDueWords(data);
      setIsFallback(false);
    } else {
      const allData = await getAllWords().catch(() => []);
      setDueWords(allData);
      setIsFallback(true);
    }
    setCurrentWordIdx(0);
    setSentenceInput('');
    setEvalResult(null);
    setIsFlipped(false);
    setSpellInput('');
  } catch {
    const allData = await getAllWords().catch(() => []);
    setDueWords(allData);
    setIsFallback(allData.length > 0);
  } finally {
    setLoadingDueWords(false);
  }
}, []); // setters are stable
```

- [ ] **Step 4: Verify Network**

Enter/leave vocab tab twice with dueWords already populated → no extra `getReviewWords`/`getAllWords` until `vocab-updated` or zone change with empty list policy as chosen.

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/english/tabs/VocabTab.tsx
git commit -m "perf: VocabTab uses domain context and gated reload"
```

---

### Task 3: Sidebar calendar memoization (P0)

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Hoist pure helpers + memoize month grid**

Move `getDaysInMonth` / `getDateStr` / habits parse to module scope (or keep local but wrap results):

```tsx
const calendarDays = React.useMemo(
  () => getDaysInMonth(viewYear, viewMonth),
  [viewYear, viewMonth]
);

const habitsCache = React.useMemo(() => {
  const cache: Record<string, number> = {};
  for (const slot of calendarDays) {
    const dateStr = getDateStr(viewYear, viewMonth, slot.day, slot.monthOffset);
    const saved = localStorage.getItem(`superme_habits_${dateStr}`);
    if (!saved) { cache[dateStr] = 0; continue; }
    try {
      cache[dateStr] = Object.values(JSON.parse(saved)).filter(Boolean).length;
    } catch {
      cache[dateStr] = 0;
    }
  }
  return cache;
}, [calendarDays, viewYear, viewMonth, selectedDate]);
```

- [ ] **Step 2: Render from cache**

```tsx
{calendarDays.map((slot, index) => {
  const dateStr = getDateStr(viewYear, viewMonth, slot.day, slot.monthOffset);
  const habitsCount = habitsCache[dateStr] ?? 0;
  // ...
})}
```

- [ ] **Step 3: Verify**

DevTools Performance: open/close calendar; no >16ms task attributed to calendar rebuild on unrelated Sidebar state toggles when month unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "perf: memoize Sidebar calendar days and habits counts"
```

---

### Task 4: RightPanel coalesce getAllWords (P0)

**Files:**
- Modify: `src/components/RightPanel.tsx`

- [ ] **Step 1: Merge open/word sync effects**

Remove the third effect (`[wordData, isOpen]` syncLocal). Keep `vocab-updated` listener but share one loader:

```tsx
useEffect(() => {
  const word = typeof wordData?.word === 'string' ? wordData.word.trim() : '';
  if (!isOpen || !word) {
    if (!word) {
      setLocalWordEntry(null);
      setDictResult(null);
      setDictLoading(false);
    }
    return;
  }

  let cancelled = false;
  const preload = wordData?.dictPreload;
  if (preload?.ok && preload?.payload) {
    setDictResult(preload);
    setDictLoading(false);
  }

  (async () => {
    if (!preload?.ok) {
      setDictResult(null);
      setDictLoading(true);
    }
    try {
      const allWords = await getAllWords();
      if (cancelled) return;
      const found = allWords.find(w => w.word.toLowerCase() === word.toLowerCase());
      setLocalWordEntry(found || null);
    } catch (err) {
      console.error('Failed to search local word database:', err);
      if (!cancelled) setLocalWordEntry(null);
    }

    try {
      let res = await queryDictionaryWithCache({ word, dictType: 'en_en_business' });
      if (cancelled) return;
      if (!(res && res.ok)) {
        res = await queryDictionaryWithCache({ word, dictType: 'en_zh_bidirectional' });
      }
      if (cancelled) return;
      if (res && res.ok) setDictResult(res);
      else if (!preload?.ok) setDictResult(null);
    } catch (err) {
      console.error('Failed to query dictionary for RightPanel:', err);
      if (!cancelled && !preload?.ok) setDictResult(null);
    } finally {
      if (!cancelled) setDictLoading(false);
    }
  })();

  return () => { cancelled = true; };
}, [isOpen, wordData?.word, wordData?.dictPreload]);
```

Retain `vocab-updated` listener calling the same local-entry refresh (1 call on event only).

- [ ] **Step 2: Verify Network**

Open RightPanel on a word → exactly **one** `getAllWords` for open path (plus dict queries).

- [ ] **Step 3: Commit**

```bash
git add src/components/RightPanel.tsx
git commit -m "perf: coalesce RightPanel getAllWords on open"
```

---

### Task 5 (optional P1): Vite optimizeDeps — only if user accepts cold start

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Change config**

```ts
optimizeDeps: {
  noDiscovery: false,
  include: [
    'framer-motion',
    'motion',
    'lucide-react',
    '@phosphor-icons/react',
  ],
},
```

- [ ] **Step 2: Verify**

```bash
npm run build
npm run dev
```

Expected: build exit 0; subsequent cold starts faster after cache fill.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "chore: prebundle heavy deps in Vite optimizeDeps"
```

---

## Verification matrix (verification-before-completion)

| Claim | Command / check | Pass criteria |
|-------|-----------------|---------------|
| App not on vocab churn | DevTools Highlight updates while flipping vocab | App shell does not flash each idx change |
| Vocab gated reload | Network on re-enter vocab with data | No duplicate review/all fetch unless empty or event |
| Sidebar memo | Performance panel calendar toggle | No month rebuild when only `isCalendarOpen` flips if days memoized correctly |
| RightPanel dedupe | Network filter vocab API | 1× getAllWords on open (not 2) |
| Vite (if done) | `npm run build` | exit 0 |

## Spec coverage self-check

- Context storm: Task 1–2 (consumer migration; stronger than broken dep removal)
- Sidebar: Task 3
- RightPanel: Task 4
- VocabTab reload: Task 2
- Vite: Task 5 optional
- App init / Dify / 45s poll: **out of first surgical pass** unless user elevates (needs browser evidence)
