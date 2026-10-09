# PRD — page-density-redesign (进度总控布局密度)

**Source of truth:** `.omx/specs/deep-interview-page-density-redesign.md`  
**Mode:** `$ralplan` / `$plan --consensus --direct` (RALPLAN-DR short)  
**Status:** consensus complete (Architect APPROVE_WITH_CHANGES applied; Critic APPROVE)  

---

## RALPLAN-DR Summary

### Principles (4)
1. **Density-first under conflict** — prefer fewer scrolls and side-by-side packing over marketing whitespace.
2. **First-screen triad is non-negotiable** — Theme hub/roadmap + Stay match ring + Daily Briefing must be visible without scroll on ~1440×900.
3. **Layout-only surgery** — no interaction/data/color/dependency changes; no accordion-hiding of modules.
4. **Minimal diff** — prefer reorder + grid + spacing in `DashboardTab` / child classNames over new abstractions.

### Decision Drivers (top 3)
1. Desktop first-screen visibility of modules **123**.
2. Preserve all modules on the same page (may move below fold).
3. Keep diffs reviewable and confined to 进度总控.

### Viable Options

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **A — Reorder + 2-col hero** | Move `ArsenalPanel` below `DailyBriefingCard`; wrap Hub+Stay in `lg:grid`; tighten `space-y`/`p-*`; compress SOP header | Smallest behavioral risk; fixes the main stack bug (Arsenal between Stay and Briefing); clear mapping to AC | Visual “card wall” partially remains; Briefing may still sit at fold edge on short laptops |
| **B — Unified command shell** | One outer shell visually merges Hub+Stay+Briefing; Arsenal/Intel/Material stay separate below | Strongest cohesion; best density | Larger className/DOM wrap churn; easier to accidentally look like “new UI” |
| **C — Briefing-led top strip** | Put compact Daily Briefing first, then Hub\|Stay | Guarantees Briefing above fold | Demotes Theme hub; weaker “指挥台” narrative; more UX reorder shock |

**Favored:** **Option A**, with a **height-budget gate**: after Stay/Briefing compaction, if hero+Briefing still exceed ~780px usable content at 1440×900, apply **bounded Option-B technique** (one shared `gap-4` wrapper around hero+Briefing; no new palette/shadows).

**Invalidation:**
- **C** invalidated — conflicts with Outcome ranking (hub is part of required triad, not demoted).
- **Full B** deferred — violates minimal-diff driver unless A fails AC1 after mandated Stay densification (incl. stayStats).

### Target zone layout (Architect-mandated)
```
[SOP thin bar — collapsed default]
[HERO lg:grid — Hub 7/12 | Stay 5/12, matching card shells]
[BRIEFING full width, immediately below hero]
[BELOW FOLD: Arsenal → Intel → Material]
```

---

## Requirements Summary

Tighten English module **进度总控** (`DashboardTab`) so desktop users see StayAnalysis (match ring), DailyBriefing, and Theme hub/roadmap without scrolling, while keeping the page readable and all modules present.

### Current stack evidence
`DashboardTab.tsx` ~L672–822 root `space-y-8`:

1. SOP card (~L676–694)  
2. Hub: StrategicRoadmap + ThemeGateway (~L697–731)  
3. StayAnalysisPanel (~L734–738)  
4. **ArsenalPanel (~L739–751)** ← blocks Briefing from first screen  
5. DailyBriefingCard (~L760–765)  
6. IntelBriefing (~L767–794)  
7. MaterialUploader (~L796–822)

`StayAnalysisPanel.tsx` uses tall vertical flex (`gap-6`, ring + checklist stacked).  
`DailyBriefingCard.tsx` uses `p-6 md:p-8` + `mb-8` + `gap-6` three-up grid.

---

## Acceptance Criteria (testable)

1. At viewport ≈ **1440×900**, without scrolling, user can see: Theme hub/roadmap, Stay match ring area, Daily Briefing three stat cards.
2. SOP, Arsenal, Intel, MaterialUploader remain mounted on the same page (may be below fold); no new accordion that removes them from the document flow when “collapsed” as a product feature (existing SOP expand/collapse may stay as-is).
3. No changes to handlers, API calls, props contracts, or button behaviors beyond layout wrappers needed for grid.
4. Colors remain `DESIGN.md`-aligned (no palette rewrite).
5. `package.json` / lockfile unchanged (no new deps).
6. Manual UX: denser but text/controls remain readable (user gate).

---

## Implementation Steps

### Step 1 — Reorder for triad priority
**File:** `DashboardTab.tsx`  
Move `ArsenalPanel` to render **after** `DailyBriefingCard` (before `IntelBriefing`).  
Do not change Arsenal props/handlers.

### Step 2 — First-screen hero grid + card shells
**File:** `DashboardTab.tsx`  
Wrap Hub card + `StayAnalysisPanel` in `grid grid-cols-1 lg:grid-cols-12 gap-4`:
- Hub (Roadmap+ThemeGateway): `lg:col-span-7`
- StayAnalysis: `lg:col-span-5`  
**Card-shell contract (mandatory):** Stay must get its **own matching card shell** (`rounded-3xl`, border, padding aligned with Hub)—not bare `border-t` orphan (current Stay root assumes in-card footer but is already a sibling outside Hub ~L731 vs L734).

### Step 3 — Compact StayAnalysis for column fit
**File:** `StayAnalysisPanel.tsx`  
On `md+`, prefer horizontal/compact layout (ring + checklist side-by-side or tighter `gap-3` / smaller ring) so column height ≈ Hub card. Preserve all labels and icons; no logic changes to score math.

### Step 3b — Compact stayStats block (Architect mandatory)
**File:** `StayAnalysisPanel.tsx`  
When `stayStats` is present, densify that block on `md+`: reduce padding (`p-5`→`p-3`), gaps (`gap-4`→`gap-2`), tighter header/margins; keep 3-col stats + suggestion text readable. Ring/checklist compaction alone is insufficient if stayStats dominates height.

### Step 4 — Compact Daily Briefing vertical budget
**File:** `DailyBriefingCard.tsx`  
Reduce padding/margins (`p-6 md:p-8` → `p-4 md:p-5`, **drop `mb-8`**, `gap-6` → `gap-3`/`gap-4`, header `mb-6 pb-4` → `mb-3 pb-3`) while keeping dark `#202124` shell and 3-column stats.

### Step 5 — Global rhythm + SOP thin bar
**File:** `DashboardTab.tsx`  
- Root `space-y-8` → `space-y-4` (or `space-y-5`)  
- Hub card `p-5 md:p-6 gap-5` → slightly tighter  
- SOP: keep existing expand behavior; default collapsed; reduce outer `p-5 gap-4` so collapsed bar is short  
- Account for English tab chrome (~60–100px) in height budget; do not touch Roadmap/ThemeGateway unless AC1 still fails after Steps 3–4

### Step 5b — Height-budget gate
After Steps 1–5, if hero+Briefing still fail AC1 at 1440×900 with stayStats populated: apply bounded Option-B shared `gap-4` wrapper around hero+Briefing only. Document in PR notes. Check `inlineNotice` absolute positioning still clear of hero.

### Step 6 — Verify below-fold modules
Confirm Arsenal → Intel → Material still render; no deletion. Spot-check generate/upload/notice flows unchanged. Note: `MaterialUploader` `scrollTo({ top: 300 })` may feel off after layout shift—smoke only, fix only if broken.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Short laptop (≤800px height) still fails AC1 | Further compact Stay + Briefing; last resort thin shared wrapper (Option B technique) without new theme |
| Stay `border-t` looks wrong as column | Matching card shell (Step 2 contract) |
| stayStats vertical dominance | Step 3b mandatory densification |
| Short laptop / chrome eat height | T2b 1280×800; Step 5b bounded B wrapper |
| Grid breaks mobile | `grid-cols-1` default; desktop `lg:` only |
| Accidental prop/handler churn | Diff review: className/order only |
| Arsenal order UX surprise | Acceptable per Decision Boundaries; note in PR |
| `inlineNotice` overlaps hero after grid/wrapper | Re-check absolute `top-16` after Step 2/5b; nudge offset if needed |

---

## Verification Steps

1. `npm run build` (or project’s standard frontend typecheck/build) — must pass.  
2. Manual: open English → 进度总控 at **1440×900**, with **stayStats populated** and **SOP collapsed**; screenshot first viewport; confirm triad visible (T2).  
3. Scroll: confirm Arsenal/Intel/Material still present (T3).  
4. Smoke: theme switch, SOP toggle, one generate button, material upload entry — still works (T5–T8).  
5. `git diff` — no `package.json` changes; no other tabs touched (T1).  
6. If Step 5b triggered: include post-wrapper screenshot in T2d sign-off.

---

## ADR (final — Critic APPROVE)

- **Decision:** Option A (reorder Arsenal below Briefing + Hub|Stay `lg:grid` with matching card shells + Stay/stayStats/Briefing densification), gated by ~780px height budget with bounded Option-B `gap-4` wrapper fallback.  
- **Drivers:** (1) Desktop first-screen triad 123 (2) Preserve all modules on-page (3) Minimal layout-only diff  
- **Alternatives considered:** B full unified command shell; C briefing-first strip  
- **Why chosen:** Fixes Arsenal-between-Stay-and-Briefing structural defect with least risk; C demotes hub against Outcome; full B deferred unless AC1 fails post-compaction  
- **Consequences:** Denser 进度总控; Arsenal later in scroll; Stay becomes peer card; possible order UX notice  
- **Follow-ups:** Execute via `$ultragoal` (default); `$team` optional for parallel file lanes; `$ralph` only as explicit persistence fallback  

## Consensus status
- Architect: APPROVE_WITH_CHANGES → applied  
- Critic: **APPROVE**  
- `ralplan_consensus_gate.complete`: **true**

## Available-Agent-Types Roster (handoff)

Known Task/native lanes usable post-approval: `generalPurpose`, `explore`, `shell`, plus product follow-ups `$ultragoal`, `$team`, `$ralph` (fallback).

## Follow-up Staffing Guidance

| Lane | Roles | Why |
|------|-------|-----|
| `$ultragoal` (default) | 1 implementer + verify checkpoint | Single-page layout; sequential steps 1–6 |
| `$team` | optional 2 lanes: (1) DashboardTab reorder/grid (2) Stay+Briefing compact | Only if parallelizing; sync on className conventions |
| `$ralph` | explicit fallback | Persistent verify loop if first-screen AC fails repeatedly |

**Suggested reasoning:** medium for implementer; high only if AC1 fails and Option-B wrapper needed.

## Goal-Mode Follow-up Suggestions
- **`$ultragoal`** — default after consensus  
- `$autoresearch-goal` — not applicable  
- `$performance-goal` — not applicable (layout, not perf)

## Launch Hints
```
$ultragoal create-goals --brief-file .omx/plans/prd-page-density-redesign.md
```
Or: implement against this PRD + `test-spec-page-density-redesign.md` (also valid: say「按规格开始改」).

## Team Verification Path
If `$team`: each lane returns before/after screenshots at 1440×900 + note that handlers untouched; Ultragoal checkpoints AC1–AC5.

## Changelog
- 2025-07-21: Planner draft from deep-interview spec + DashboardTab stack audit.
- 2025-07-21: Applied Architect APPROVE_WITH_CHANGES — Step 3b stayStats, card-shell contract, height-budget gate, expanded risks/tests.
- 2025-07-21: Critic APPROVE — merged non-blocking verification/risk polish; ADR finalized.
