# UI Consistency System Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge shell + business modules onto one restrained brand skin (`#202124` / `#FF5722`, light surfaces + dark execution panels) without changing IA, flows, or APIs.

**Architecture:** Token-first System Pass. Fix `src/index.css` tokens and shared button/card/badge primitives, then sweep modules in priority order replacing indigo/violet/purple primary CTAs and invented navy skins with brand roles. Style-only diffs; stop and ask if a surface requires layout change.

**Tech Stack:** React 19, Vite 6, Tailwind CSS v4 (`@theme` in `src/index.css`), TypeScript (`pnpm lint` / `tsc --noEmit`), Node one-shot assert scripts, ripgrep ban checks

**Spec:** `docs/superpowers/specs/2026-07-22-ui-consistency-design.md`  
**Design contract:** `DESIGN.md`

---

## File map (create / modify)

| Path | Responsibility |
|------|----------------|
| `src/index.css` | Define `--color-brand-hover`; keep `.btn-primary` / `.btn-secondary` / `.bento-card` on contract |
| `scripts/assert-ui-tokens.mjs` | Fail if required CSS tokens missing |
| `scripts/assert-ui-cta-bans.mjs` | Fail if banned primary CTA class patterns remain in scoped paths |
| `src/components/modules/english/tabs/ui/Button/PrimaryButton.tsx` | Brand primary CTA |
| `src/components/modules/english/tabs/ui/Button/GhostButton.tsx` | Secondary CTA |
| `src/components/modules/english/tabs/ui/Badge/StatusBadge.tsx` | Drop violet `active` skin |
| `src/components/Header.tsx` | Shell status dots / chips off indigo ping |
| `src/components/Sidebar.tsx` | Shell nav accents if divergent |
| `src/components/MainContent.tsx` | Canvas only; no new skins |
| `src/components/modules/ModuleWrapper.tsx` | Module chrome |
| `src/components/modules/DailyWakeupModule.tsx` | Confirm execution panel stays brand ink; no new hues |
| `src/components/modules/english/tabs/DashboardTab.tsx` | Indigo callouts → brand/info |
| `src/components/modules/english/tabs/dashboard/ThemeGateway.tsx` | Indigo ghost → brand/accent |
| `src/components/modules/english/tabs/dashboard/VocabularyGrid.tsx` | Indigo borders/buttons → brand border/accent |
| `src/components/modules/english/tabs/dashboard/StayAnalysisPanel.tsx` | Indigo chip → border/brand |
| `src/components/modules/english/tabs/dashboard/ImmersiveReader.tsx` | Dark theme → `#0F1115` brand-dark (not slate-navy `#0f172a`) if still present |
| `src/components/modules/OralWarRoomBreakthroughMenu.tsx` | Purple category → accent or info |
| `src/components/modules/OralWarRoomContextPanel.tsx` | Purple intent skins → status/accent |
| `src/components/modules/OralWarRoomSceneSelector.tsx` | Violet selected → brand/accent |
| `src/components/modules/OralWarRoomSituationPanel.tsx` | Violet/purple chips → status ramp |
| `src/components/modules/OralWarRoomTacticalSop.tsx` | Indigo + left stripe → full-border brand callout |
| `src/components/UrlFetchPanel.tsx` | CTA/card alignment |
| `src/components/VideoTranscribePanel.tsx` | CTA/card alignment |
| `src/components/MaterialUploader.tsx` | CTA alignment |
| `src/components/modules/ListenModule.tsx` | Indigo primary CTAs → brand |
| `src/components/modules/SpeakModule.tsx` | Indigo primary CTAs → brand |
| `src/components/modules/english/tabs/ListenTab.tsx` | Indigo stripe callout |
| `src/components/modules/english/tabs/ImpromptuSpeechTab.tsx` | Violet primary CTAs |
| `src/components/modules/DailyErrorVocabularyModule.tsx` | Indigo primary CTAs |
| `src/components/modules/PronunciationTrainer.tsx` | Indigo control button |
| `src/components/modules/GrammarPolishTrainer.tsx` | Cyan `#00BCD4` primary → accent/brand |
| `src/components/DictionaryPanel.tsx` | Indigo/purple decorative skins → brand/info restrained |
| `src/components/RightPanel.tsx` | Purple quote chrome → brand/accent |
| `src/components/modules/ReadModule.tsx` | Drop purple decorative primary; keep semantic track colors |

Do **not** create a new design-system package. Do **not** change API / mastery / Dify logic.

---

### Task 1: Foundation tokens + assert script

**Files:**
- Modify: `src/index.css` (`@theme` block ~lines 15–18)
- Create: `scripts/assert-ui-tokens.mjs`
- Test: `node scripts/assert-ui-tokens.mjs`

- [ ] **Step 1: Write failing token assert**

Create `scripts/assert-ui-tokens.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');

const required = [
  '--color-brand:',
  '--color-brand-light:',
  '--color-brand-dark:',
  '--color-brand-hover:',
  '--color-accent:',
  '--color-border:',
  '--color-success:',
  '--color-warning:',
  '--color-danger:',
  '--color-info:',
];

const missing = required.filter((token) => !css.includes(token));
if (missing.length) {
  console.error('Missing UI tokens:', missing.join(', '));
  process.exit(1);
}
console.log('UI tokens OK');
```

- [ ] **Step 2: Run assert — expect FAIL**

Run: `node scripts/assert-ui-tokens.mjs`  
Expected: exit 1, mentions `--color-brand-hover:`

- [ ] **Step 3: Add token in `@theme`**

In `src/index.css` `@theme` block, after `--color-brand-dark`:

```css
  --color-brand: #202124;
  --color-brand-light: #3A3B3C;
  --color-brand-dark: #0F1115;
  --color-brand-hover: #3A3B3C;
  --color-accent: #FF5722;
```

- [ ] **Step 4: Run assert — expect PASS**

Run: `node scripts/assert-ui-tokens.mjs`  
Expected: `UI tokens OK`

- [ ] **Step 5: Commit**

```bash
git add src/index.css scripts/assert-ui-tokens.mjs
git commit -m "fix: define --color-brand-hover for primary button contract"
```

---

### Task 2: Shared StatusBadge + CTA ban assert (scoped)

**Files:**
- Modify: `src/components/modules/english/tabs/ui/Badge/StatusBadge.tsx`
- Create: `scripts/assert-ui-cta-bans.mjs`
- Test: `node scripts/assert-ui-cta-bans.mjs`

- [ ] **Step 1: Write CTA ban assert (starts empty scope, then expands)**

Create `scripts/assert-ui-cta-bans.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Paths relative to repo root — expand as each sweep task completes */
const SCOPED = process.argv.slice(2);
if (!SCOPED.length) {
  console.error('Usage: node scripts/assert-ui-cta-bans.mjs <relpath>...');
  process.exit(2);
}

const BANNED = [
  /bg-violet-600/,
  /bg-purple-600/,
  /bg-indigo-600(?!\/)/, // solid indigo primary fills
  /hover:bg-violet-500/,
  /hover:bg-indigo-700/,
  /bg-\[#00BCD4\]/,
];

let failed = false;
for (const rel of SCOPED) {
  const full = path.join(root, rel);
  const text = fs.readFileSync(full, 'utf8');
  for (const re of BANNED) {
    if (re.test(text)) {
      console.error(`BAN hit ${re} in ${rel}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('CTA bans OK for', SCOPED.length, 'files');
```

- [ ] **Step 2: Retire violet `active` on StatusBadge**

Replace `active` config in `StatusBadge.tsx`:

```tsx
  active: {
    bg: 'bg-[var(--color-accent)]/10',
    border: 'border-[var(--color-accent)]/25',
    text: 'text-[var(--color-accent)]',
    icon: Sparkles,
    iconColor: 'text-[var(--color-accent)]',
    pulse: false,
  },
```

- [ ] **Step 3: Verify badge file against bans**

Run:

```bash
node scripts/assert-ui-cta-bans.mjs src/components/modules/english/tabs/ui/Badge/StatusBadge.tsx
```

Expected: `CTA bans OK`

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/english/tabs/ui/Badge/StatusBadge.tsx scripts/assert-ui-cta-bans.mjs
git commit -m "style: align StatusBadge active state to brand accent"
```

---

### Task 3: Shell accents

**Files:**
- Modify: `src/components/Header.tsx` (indigo ping ~287–288)
- Modify: `src/components/Sidebar.tsx` (only if indigo/violet primary fills exist)
- Modify: `src/components/modules/ModuleWrapper.tsx` (only divergent CTA chrome)

- [ ] **Step 1: Replace Header indigo live-dot with brand/accent**

Find indigo ping avatar/dot in `Header.tsx` and replace with:

```tsx
<div className="w-4 h-4 rounded-full bg-[var(--color-accent)] border-2 border-white shadow-md flex items-center justify-center relative">
  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
</div>
```

(Keep structure; only swap color classes.)

- [ ] **Step 2: Grep shell for solid indigo/violet primaries**

Run:

```bash
rg -n "bg-indigo-600|bg-violet-600|bg-purple-600" src/components/Header.tsx src/components/Sidebar.tsx src/components/modules/ModuleWrapper.tsx src/components/MainContent.tsx
```

Expected: no matches (or only non-CTA leftovers documented and fixed).

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.tsx src/components/Sidebar.tsx src/components/modules/ModuleWrapper.tsx
git commit -m "style: align shell accents to brand tokens"
```

---

### Task 4: Daily Wakeup spot-check (restrained)

**Files:**
- Modify: `src/components/modules/DailyWakeupModule.tsx` only if ban/grep finds indigo/violet/cyan primary fills

- [ ] **Step 1: Grep module**

Run:

```bash
rg -n "bg-indigo-600|bg-violet-600|bg-purple-600|bg-\[#00BCD4\]|#0f172a" src/components/modules/DailyWakeupModule.tsx
```

Expected: no matches. If none, skip code edits.

- [ ] **Step 2: If matches exist, map to brand roles**

- Solid primary → `bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)]` or existing white-on-dark CTA already in file  
- Accent action → `bg-[var(--color-accent)]`  
- Execution panel backgrounds must stay `#202124` / `#1b1c1e` / `#0F1115` family

- [ ] **Step 3: Commit only if changed**

```bash
git add src/components/modules/DailyWakeupModule.tsx
git commit -m "style: keep Daily Wakeup on brand execution palette"
```

---

### Task 5: English Dashboard high-traffic surfaces

**Files:**
- Modify: `src/components/modules/english/tabs/DashboardTab.tsx`
- Modify: `src/components/modules/english/tabs/dashboard/ThemeGateway.tsx`
- Modify: `src/components/modules/english/tabs/dashboard/VocabularyGrid.tsx`
- Modify: `src/components/modules/english/tabs/dashboard/StayAnalysisPanel.tsx`
- Modify: `src/components/modules/english/tabs/dashboard/ImmersiveReader.tsx` (if `#0f172a` present)

- [ ] **Step 1: Run ban assert — expect FAIL on current files**

```bash
node scripts/assert-ui-cta-bans.mjs \
  src/components/modules/english/tabs/DashboardTab.tsx \
  src/components/modules/english/tabs/dashboard/ThemeGateway.tsx \
  src/components/modules/english/tabs/dashboard/VocabularyGrid.tsx
```

Expected: BAN hits (indigo fills / hovers).

- [ ] **Step 2: DashboardTab indigo callout → brand**

Replace indigo icon plate / link hover with brand:

```tsx
<div className="bg-[var(--color-brand)] text-white p-1 rounded-md shadow-sm">
```

```tsx
<button className="flex items-center gap-1 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 px-2 py-0.5 rounded-md transition-colors text-xs font-bold">
```

(Adjust only the indigo class strings; keep layout.)

- [ ] **Step 3: ThemeGateway indigo ghost → brand border**

```tsx
className="flex items-center gap-1 text-[var(--color-brand)] border-[var(--color-border)] hover:bg-slate-50 !px-2 !py-1.5"
```

- [ ] **Step 4: VocabularyGrid indigo → brand border / accent hover**

Card hover border:

```tsx
className="group relative flex flex-col justify-between p-4 bg-slate-50/50 hover:bg-white border border-slate-100 hover:border-[var(--color-border)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md transition-all duration-300 min-h-[96px] text-left overflow-hidden"
```

Action chips/buttons: replace `text-indigo-*` / `bg-indigo-*` / `hover:bg-indigo-*` with:

```tsx
className="text-[9px] font-bold text-[var(--color-brand)] bg-slate-50 hover:bg-[var(--color-brand)] hover:text-white px-2 py-0.5 rounded-lg border border-[var(--color-border)] transition-all cursor-pointer shrink-0 btn-press"
```

- [ ] **Step 5: StayAnalysisPanel chip**

```tsx
<span className="text-[10px] bg-slate-50 text-[var(--color-brand)] px-1.5 py-0.5 rounded-md font-bold shrink-0 border border-[var(--color-border)]">
```

- [ ] **Step 6: ImmersiveReader dark base**

If `bg-[#0f172a]` exists, replace with `bg-[var(--color-brand-dark)]`.

- [ ] **Step 7: Re-run ban assert — expect PASS**

```bash
node scripts/assert-ui-cta-bans.mjs \
  src/components/modules/english/tabs/DashboardTab.tsx \
  src/components/modules/english/tabs/dashboard/ThemeGateway.tsx \
  src/components/modules/english/tabs/dashboard/VocabularyGrid.tsx \
  src/components/modules/english/tabs/dashboard/StayAnalysisPanel.tsx \
  src/components/modules/english/tabs/dashboard/ImmersiveReader.tsx
```

- [ ] **Step 8: Typecheck**

Run: `pnpm lint`  
Expected: no new errors from these files.

- [ ] **Step 9: Commit**

```bash
git add src/components/modules/english/tabs/DashboardTab.tsx src/components/modules/english/tabs/dashboard/
git commit -m "style: align English dashboard CTAs and chips to brand tokens"
```

---

### Task 6: Oral War Room family

**Files:**
- Modify: `src/components/modules/OralWarRoomBreakthroughMenu.tsx`
- Modify: `src/components/modules/OralWarRoomContextPanel.tsx`
- Modify: `src/components/modules/OralWarRoomSceneSelector.tsx`
- Modify: `src/components/modules/OralWarRoomSituationPanel.tsx`
- Modify: `src/components/modules/OralWarRoomTacticalSop.tsx`

- [ ] **Step 1: BreakthroughMenu purple category → accent**

```tsx
color: 'text-[var(--color-accent)]',
bg: 'bg-[var(--color-accent)]/10',
border: 'border-[var(--color-accent)]/25',
hoverBg: 'hover:bg-[var(--color-accent)]/15',
```

- [ ] **Step 2: ContextPanel intent purple → accent / info**

Map decorative purple labels to accent; keep emerald/red/gray for ally/blocker/neutral semantics unchanged.

Example intent skin:

```tsx
intent: { label: '意图避重', color: 'text-[var(--color-accent)]', bg: 'bg-[var(--color-accent)]/10', border: 'border-[var(--color-accent)]/25' },
```

- [ ] **Step 3: SceneSelector selected violet → brand**

```tsx
? 'bg-[var(--color-brand)] text-white'
```

Tier color `跨文化`: change `text-purple-500` → `text-[var(--color-info)]` (semantic, not purple skin).

- [ ] **Step 4: SituationPanel violet chip → info**

```tsx
<span className="px-1.5 py-0.5 rounded-full bg-[var(--color-info)]/15 text-[var(--color-info)] text-[8px] font-bold">
```

Purple section headers (`沟通风格`) → `text-[var(--color-brand)]` + accent icon.

- [ ] **Step 5: TacticalSop — remove left stripe, use full border callout**

Replace indigo left-stripe block with:

```tsx
<div className="bg-slate-50 border border-[var(--color-border)] rounded-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm mb-4">
  <div className="bg-[var(--color-brand)] text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-md">
```

(Do not use `border-l-4` colored accent.)

- [ ] **Step 6: Ban assert on Oral files**

```bash
node scripts/assert-ui-cta-bans.mjs \
  src/components/modules/OralWarRoomBreakthroughMenu.tsx \
  src/components/modules/OralWarRoomSceneSelector.tsx \
  src/components/modules/OralWarRoomTacticalSop.tsx
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/modules/OralWarRoom*.tsx
git commit -m "style: align Oral War Room skins to brand and status tokens"
```

---

### Task 7: Content tools (URL / video / uploader)

**Files:**
- Modify: `src/components/UrlFetchPanel.tsx`
- Modify: `src/components/VideoTranscribePanel.tsx`
- Modify: `src/components/MaterialUploader.tsx`

- [ ] **Step 1: Grep for banned primaries**

```bash
rg -n "bg-indigo-600|bg-violet-600|bg-purple-600|bg-\[#00BCD4\]" \
  src/components/UrlFetchPanel.tsx \
  src/components/VideoTranscribePanel.tsx \
  src/components/MaterialUploader.tsx
```

- [ ] **Step 2: Replace solid primary fills**

Mapping:
- Submit / Add URL primary → `bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white rounded-xl` (or existing `.btn-primary`)
- Single high-emphasis action already orange → keep one accent CTA
- Secondary → border `border-[var(--color-border)]` ghost

- [ ] **Step 3: Ban assert**

```bash
node scripts/assert-ui-cta-bans.mjs \
  src/components/UrlFetchPanel.tsx \
  src/components/VideoTranscribePanel.tsx \
  src/components/MaterialUploader.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/components/UrlFetchPanel.tsx src/components/VideoTranscribePanel.tsx src/components/MaterialUploader.tsx
git commit -m "style: align URL and media tool CTAs to brand tokens"
```

---

### Task 8: Listen / Speak / Impromptu / trainers (primary CTA sweep)

**Files:**
- Modify: `src/components/modules/ListenModule.tsx`
- Modify: `src/components/modules/SpeakModule.tsx`
- Modify: `src/components/modules/english/tabs/ListenTab.tsx`
- Modify: `src/components/modules/english/tabs/ImpromptuSpeechTab.tsx`
- Modify: `src/components/modules/DailyErrorVocabularyModule.tsx`
- Modify: `src/components/modules/PronunciationTrainer.tsx`
- Modify: `src/components/modules/GrammarPolishTrainer.tsx`

- [ ] **Step 1: Ban assert — expect FAIL**

```bash
node scripts/assert-ui-cta-bans.mjs \
  src/components/modules/ListenModule.tsx \
  src/components/modules/SpeakModule.tsx \
  src/components/modules/english/tabs/ImpromptuSpeechTab.tsx \
  src/components/modules/DailyErrorVocabularyModule.tsx \
  src/components/modules/PronunciationTrainer.tsx \
  src/components/modules/GrammarPolishTrainer.tsx
```

- [ ] **Step 2: Global replace policy inside these files (manual, not blind sed)**

| From | To |
|------|----|
| `bg-indigo-600 hover:bg-indigo-700` (primary CTA) | `bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)]` |
| `bg-violet-600 hover:bg-violet-500` (primary CTA) | same brand primary, or one accent if it is the sole emphasis action |
| `bg-[#00BCD4]` primary | `bg-[var(--color-accent)]` (GrammarPolish accent action) |
| `border-l-4 border-indigo-500` callouts | full `border border-[var(--color-border)]` + brand icon plate |
| Selected tab `bg-indigo-600` | `bg-[var(--color-brand)]` |
| Hover-only `hover:bg-indigo-50` on light cards | `hover:bg-slate-50` or `hover:border-[var(--color-border)]` |

Keep chat bubble differentiation if needed via brand ink vs slate, not indigo.

- [ ] **Step 3: ImpromptuSpeechTab violet primaries**

Primary record/start buttons:

```tsx
className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg cursor-pointer"
```

Progress bar gradient `from-violet-500 to-[#FF5722]` → `from-[var(--color-brand-light)] to-[var(--color-accent)]`.

Focus card purple chrome → accent/10 borders (not purple-50 skin).

- [ ] **Step 4: Re-run ban assert — PASS**

Same file list as Step 1.

- [ ] **Step 5: `pnpm lint`**

Expected: clean or only pre-existing unrelated errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/modules/ListenModule.tsx src/components/modules/SpeakModule.tsx \
  src/components/modules/english/tabs/ListenTab.tsx \
  src/components/modules/english/tabs/ImpromptuSpeechTab.tsx \
  src/components/modules/DailyErrorVocabularyModule.tsx \
  src/components/modules/PronunciationTrainer.tsx \
  src/components/modules/GrammarPolishTrainer.tsx
git commit -m "style: replace indigo/violet trainer CTAs with brand roles"
```

---

### Task 9: Dictionary, RightPanel, ReadModule leftovers

**Files:**
- Modify: `src/components/DictionaryPanel.tsx`
- Modify: `src/components/RightPanel.tsx`
- Modify: `src/components/modules/ReadModule.tsx`
- Modify: `src/components/FlashCard.tsx` (purple label only if decorative)

- [ ] **Step 1: DictionaryPanel — restrain indigo glass skins**

Replace decorative indigo gradients/plates with:

```tsx
border border-[var(--color-border)] bg-slate-50/50
```

Remove colored `border-l` / `w-1 bg-indigo-500` side stripes; use spacing or full border.

POS / category chips may use `--color-info` at 10% fill, not purple-500 fills.

- [ ] **Step 2: RightPanel purple quote chrome**

```tsx
<span className="w-1 h-3 bg-[var(--color-accent)] rounded-full"></span>
```

```tsx
<div className="bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 text-[var(--color-brand)] rounded-xl p-4 text-xs leading-relaxed italic font-medium">
```

- [ ] **Step 3: ReadModule purple decorative card**

The `bg-purple-50/50` “外企跨文化博弈” tip card →:

```tsx
<div className="p-3 bg-[var(--color-accent)]/5 rounded-2xl border border-[var(--color-accent)]/20 flex gap-2 items-start">
```

Keep orange/blue/amber **track** chips (semantic tracks per DESIGN); do not force them all to one color.

- [ ] **Step 4: Grep remaining purple/violet solid primaries under `src/components`**

```bash
rg -n "bg-violet-600|bg-purple-600|bg-indigo-600|bg-\[#00BCD4\]" src/components --glob "*.tsx"
```

Expected: zero solid primary fills. Soft `/10` tints of info are OK if not CTA. If leftovers remain in out-of-scope files, either fix in this task or list explicitly in the commit body as deferred with reason.

- [ ] **Step 5: Commit**

```bash
git add src/components/DictionaryPanel.tsx src/components/RightPanel.tsx \
  src/components/modules/ReadModule.tsx src/components/FlashCard.tsx
git commit -m "style: restrain dictionary and panel decorative skins to brand"
```

---

### Task 10: Final verification gate

**Files:** none required (docs only if checklist notes added)

- [ ] **Step 1: Token assert**

```bash
node scripts/assert-ui-tokens.mjs
```

Expected: `UI tokens OK`

- [ ] **Step 2: Full CTA ban pass on swept list**

```bash
node scripts/assert-ui-cta-bans.mjs \
  src/components/modules/english/tabs/ui/Badge/StatusBadge.tsx \
  src/components/modules/english/tabs/DashboardTab.tsx \
  src/components/modules/english/tabs/dashboard/ThemeGateway.tsx \
  src/components/modules/english/tabs/dashboard/VocabularyGrid.tsx \
  src/components/modules/OralWarRoomBreakthroughMenu.tsx \
  src/components/modules/OralWarRoomSceneSelector.tsx \
  src/components/modules/OralWarRoomTacticalSop.tsx \
  src/components/UrlFetchPanel.tsx \
  src/components/VideoTranscribePanel.tsx \
  src/components/MaterialUploader.tsx \
  src/components/modules/ListenModule.tsx \
  src/components/modules/SpeakModule.tsx \
  src/components/modules/english/tabs/ImpromptuSpeechTab.tsx \
  src/components/modules/DailyErrorVocabularyModule.tsx \
  src/components/modules/PronunciationTrainer.tsx \
  src/components/modules/GrammarPolishTrainer.tsx
```

Expected: `CTA bans OK`

- [ ] **Step 3: Typecheck**

```bash
pnpm lint
```

Expected: exit 0 (or only pre-existing unrelated failures documented).

- [ ] **Step 4: Manual five-screen visual checklist**

With `pnpm dev` open:

1. Shell (header/sidebar) — no indigo live dots / alien primaries  
2. Daily Wakeup — dark execution panel still brand ink, not washed white  
3. English Dashboard — vocab cards / theme controls on brand border, no indigo CTA plate  
4. Oral War Room — no purple menu skin / violet selected pill as default  
5. URL / media tools — Add URL / submit uses brand primary  

Success: tidier same product; not a reskin.

- [ ] **Step 5: Final commit only if verification notes or tiny fixes landed**

```bash
git add -A
git status
# commit only if there are leftover verification fixes
git commit -m "chore: verify UI consistency System Pass gate"
```

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| Define `--color-brand-hover` | Task 1 |
| Primary / Secondary / Accent roles | Tasks 2–8 |
| Retire purple/navy primary skins | Tasks 5–9 |
| Light surface vs execution panel | Tasks 4–6 |
| No new design-system package | File map |
| Sweep order Foundation→Shell→Wakeup→Dashboard→Oral→Tools→Remainder | Tasks 1–9 |
| No IA / API / lock changes | Architecture + file map |
| Left-stripe callouts removed on touched SOP/listen callouts | Tasks 6, 8 |
| Five-screen verification | Task 10 |
| ReadModule keep semantic tracks, drop purple decorative | Task 9 |
| Login deferred | omitted (open question) |

## Placeholder / consistency review

- No TBD steps; ban script paths are concrete  
- Brand token names consistent: `--color-brand`, `--color-brand-hover`, `--color-accent`  
- Ban regex allows future expansion via CLI args per task  

---
