# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-07-22
- Primary product surfaces: Daily Wakeup (每日唤醒), vocabulary mining workspace
- Evidence reviewed: `PRODUCT.md`, `DailyWakeupModule.tsx`, module trainers; startup API path in `App.tsx`, `difyChatbot.ts`, `DifyAssistantFrame.tsx`, `difyAPI.ts`, `profileHelper.ts`

## Brand
- Personality: Professional, authoritative, focused, premium
- Trust signals: Clear status, durable training history, restrained accents
- Avoid: Toy/gamified pastel UI; low-contrast text; widget clutter

## Product goals
- Goals: Dense, task-first practice surfaces; status and actions in one glance
- Non-goals: Marketing-style whitespace; nested decorative cards for empty states
- Success signals: First viewport shows status + controls without large dead zones

## Personas and jobs
- Primary personas: Professional learners, financial executives, business negotiators
- User jobs: Start daily wakeup, train pronunciation/grammar, check in duration
- Key contexts of use: Desktop focused sessions; dark execution panels + light content

## Information architecture
- Primary navigation: Top module nav (听/说/读/写 + extensions)
- Core routes/screens: Daily Wakeup workbench → results → Foundation trainers
- Content hierarchy: Dashboard uses 2×2 paired rows (Roadmap|Stay, Theme|Briefing) + full-width Arsenal; equal column stretch, no dead zones

## Design principles
- Clarity Over Clutter: one workbench for status + controls
- Immediate Context: theme and check-in visible before running AI
- Frictionless Feedback: notice and timer inline, not in a separate sparse card
- Tradeoffs: Medium density preferred over sparse hero layouts for tool screens

## Visual language
- Color: Primary accent `#FF5722`; secondary `#2563eb`; surfaces slate/white and `#202124`
- Typography: System UI sans; tracked uppercase labels sparingly; mono for timers/IPA
- Spacing/layout rhythm: Product density — shell header compact (`py-2`, no min-height padding); content `pt-2` under tabs; module titles are single-row toolbars that fill horizontal width; related controls 8–12px; section gaps 12–16px; avoid stacked large empty cards
- Shape/radius/elevation: `rounded-xl` workbench; soft low shadows only when elevating interaction
- Motion: 150–250ms state transitions; timer ring updates; reduced decorative pulse
- Imagery/iconography: Lucide icons at consistent stroke; no decorative hero imagery on tool panels

## Components
- Existing: `ModuleWrapper`, `DailyWakeupModule`, `PronunciationTrainer`, `GrammarPolishTrainer`, `Header`, `MainContent`
- New/changed: Merged awakening status + action workbench; Foundation textarea initial `rows=3`; compact shell header; ModuleWrapper single-row title+description toolbar
- Variants and states: idle / running / checked-in / loading
- Token/component ownership: Keep accent tokens in CSS vars / Tailwind utilities already used

## Accessibility
- Target standard: WCAG AA contrast for body and controls
- Keyboard/focus behavior: Visible focus rings on inputs and buttons
- Contrast/readability: Light ink on dark panels; avoid gray-on-tinted-white for primary copy
- Screen-reader semantics: Section headings retained; status text not icon-only
- Reduced motion: Prefer opacity/transform; avoid layout animation for density changes

## Responsive behavior
- Supported: Desktop-first; stack controls on small screens
- Layout adaptations: Status row wraps; timer stays top-right of workbench; module description stacks under title on narrow screens
- Touch/hover: Buttons keep ≥32px tap height on shell chips; primary CTAs ≥36px

## Interaction states
- Loading: Spinner in primary CTA; notice text updates
- Empty: Compact Foundation textareas (3 rows), resize-y allowed
- Error: Inline notice string (no `alert`)
- Success: Check-in label + emerald state
- Disabled: Check-in disabled until wakeup result exists

## Content voice
- Tone: Direct, operational, Chinese UI labels
- Terminology: 唤醒 / 打卡 / 主题 / Foundation
- Microcopy rules: No redundant “see card below” pointers; say status once

## Implementation constraints
- Framework/styling: React + Tailwind; do not migrate stacks
- Design-token constraints: Preserve `#FF5722` / `#202124` brand pair
- Performance: No new animation libraries for this density pass
- Performance (API / startup): Prefer removing dead or duplicate network work on the critical path; keep chatbot/assistant behavior unchanged; reuse existing inflight/TTL caches in `difyChatbot.ts` before adding new layers
- Performance (page / tab switch): Prefer keep-alive or shared context fetches over remount-triggered duplicate APIs; do not change lock/debt redirects, mastery gates, or Dify conversation isolation semantics without an explicit product decision
- Compatibility: Existing Dify wakeup / training APIs unchanged
- Test/screenshot expectations: Visual check of Daily Wakeup first viewport density — no large empty band under header or beside module title; Dashboard right column must not leave a dead zone under Daily Briefing (Arsenal fills it); Network waterfall for startup + assistant open after API perf work; module/tab switch should not re-fire identical stay-stats/quota/flaw-vocab when data is still fresh

## Open questions
- [x] product / high — English sub-tabs: remount vs CSS keep-alive → lazy keep-alive shipped
- [x] product / high — Keep English+DailyWakeup mounted when leaving top module → shipped
- [x] product / medium — Pause `checkThemeMastery` polling when not on english → shipped
- [ ] product / medium — Defer `rotateEmbedSessionOnRouteChange` until assistant opens (may affect cross-module Dify continuity) / product / medium
- [ ] Whether non-english modules need the same shell density audit / product / low
