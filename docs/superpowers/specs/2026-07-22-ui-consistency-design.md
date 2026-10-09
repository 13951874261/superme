# UI Consistency System Pass — Design Spec

**Date:** 2026-07-22  
**Status:** Approved (awaiting implementation plan)  
**Approach:** Token-first medium System Pass (Approach 1)  
**Related:** `DESIGN.md`, `PRODUCT.md`

## 1. Problem

The product shell and business modules currently mix multiple visual skins in one scroll (deep navy “game” cards, purple primary CTAs, frosted glass blocks, light enterprise lists, solid black buttons). The brand already defines a restrained professional language (`#FF5722` accent, `#202124` ink, light content + dark execution panels), but modules do not consistently apply it.

## 2. Goals

- Make shell + all business modules read as one product at a glance.
- Preserve existing brand anchors from `DESIGN.md`: light content areas, dark execution panels, accent `#FF5722`, brand ink `#202124`.
- Prefer token + shared component substitution over layout or IA rewrites.
- Keep change restrained: users should feel “tidier,” not “a different product.”

## 3. Non-goals

- Marketing-style whitespace redesign
- New design-system package or stack migration
- Changes to Dify / training / mastery-lock / keep-alive behavior
- Full-app dark-mode theme switch
- Visual rewrite of Login beyond conflicting tokens

## 4. Decisions (confirmed)

| Topic | Choice |
|-------|--------|
| Scope | C — Full shell + business modules (Daily Wakeup, Oral War Room, URL fetch, etc.), restrained |
| Visual north star | A — Existing `DESIGN.md` dual surfaces |
| Intensity | B — Medium System Pass |
| Delivery approach | 1 — Token-first, then module sweep |

## 5. Consistency rules

1. **Primary CTA:** Brand ink (`#202124` / `.btn-primary` / `PrimaryButton`). Hover may use accent; do not introduce purple/blue primary buttons.
2. **Secondary / Ghost:** White + thin border or `GhostButton` / `.btn-secondary`.
3. **Accent action:** Solid `#FF5722` allowed for high-emphasis non-submit actions; at most one dominant accent CTA per viewport.
4. **Surface cards (light):** White + `--color-border` + `rounded-xl`; prefer `BentoCard` / equivalent.
5. **Execution panels (dark):** `#202124` / `#0F1115` family; white text + accent accents. No module-invented navy/indigo skins.
6. **Status:** `--color-success|warning|danger|info` (emerald/amber/danger/info). Module-private purple/violet as primary skin is out.
7. **Radius / shadow:** Containers `rounded-xl`; inner controls tighter; use existing `--shadow-card` family; no heavy multi-layer glow.
8. **Pill exceptions:** `rounded-full` allowed for status dots, progress rings, shell FAB/badges — not as default primary button shape.

## 6. Token and component contract

### Keep

- `--color-brand`, `--color-brand-light`, `--color-brand-dark`
- `--color-accent` (`#FF5722`)
- `--color-canvas`, `--color-surface`, `--color-border`, ink ramp
- Status and track colors already in `src/index.css`
- Font: Outfit

### Fix / define in Foundation

- Ensure `--color-brand-hover` is defined in `@theme` (currently referenced by `.btn-primary:hover` but missing from token block; map to a brand-lighter step such as `#3A3B3C` / `--color-brand-light` unless a dedicated hover is preferred).
- Align `.btn-primary`, `.btn-secondary`, and bento surface utilities with Section 5.

### Promote as app-wide recommendations (no new package)

- `PrimaryButton`, `GhostButton`, `BentoCard`, `StatusBadge` under English `tabs/ui/`
- Modules may keep inline Tailwind, but colors/radius/buttons must land on the contract above

### Retire as default skins

- Purple primary CTAs and `bg-purple-*` module skins
- Deep navy / game-style card bases (convert to brand ink if they are execution panels, or light surface if content)
- Decorative glass cards as default containers (shell background blur may remain)

## 7. Sweep order

1. **Foundation** — `src/index.css` tokens and shared button/surface classes  
2. **Shell** — `Header`, `Sidebar`, `MainContent`, `ModuleWrapper`  
3. **High-traffic** — `DailyWakeupModule`, English `DashboardTab` (+ Roadmap, Stay, Theme, Briefing, Arsenal, VocabularyGrid)  
4. **Oral War Room family** — `OralWarRoom*` (e.g. BreakthroughMenu purple skin, Situation chip clutter)  
5. **Content tools** — `UrlFetchPanel`, `VideoTranscribePanel`, `MaterialUploader`, `ReadModule`, etc.  
6. **Remainder** — Listen/Write/Speak, vocab book, settings/modals: only clear outliers

### Per surface: change

- Button roles, radius, weight → contract  
- Card backgrounds → light surface or brand execution panel  
- Status chips/dots → status tokens  
- Multiple CTA languages in one viewport → Primary / Secondary / ≤1 Accent  

### Per surface: do not change

- Layout skeleton (including Dashboard 2×2), copy, flows  
- API / lock / Dify semantics  
- Density goals (do not inflate whitespace)  
- Purely geometric small elements (dots, rings)

## 8. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Oversized diff | Batch by sweep order; style-only PRs/commits |
| Over-lightening dark panels | Whitelist execution panels; recolor to brand ink, do not flatten to white cards |
| Semantic blue/purple mis-fire | Info blue OK as semantic accent; banned as module primary CTA/card skin |
| Missing hover token | Define in Foundation first |
| Abrupt feel | No IA/copy/spacing system rewrite |

## 9. Verification

- Visual pass on five screens: Shell, Daily Wakeup, English Dashboard, Oral War Room, URL/media tools — same-viewport mixed skins should be gone  
- Interaction: primary hover/disabled; dark-panel readability; chip contrast (WCAG AA target)  
- Regression: no intentional logic changes; run lint/typecheck if touched  
- Success: one brand glance; no purple primary CTA / invented navy bases; not a “reskin” sensation  

## 10. Implementation handoff

After user review of this spec:

1. Refresh root `DESIGN.md` (done alongside this doc)  
2. Invoke `writing-plans` for a batched implementation plan  
3. Execute with `/redesign-skill` + `/impeccable` under restrained rules; stop and ask if a surface requires layout change to avoid abruptness  

## 11. Open questions for implementation (non-blocking)

- Whether Login needs a dedicated light pass beyond token conflicts  
- Exact mapping of multi-color track chips in ReadModule (keep semantic variety vs. compress to status ramp) — default: keep semantic meaning, drop purple as decorative primary  
