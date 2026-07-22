# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-07-22
- Primary product surfaces: Daily Wakeup (每日唤醒), vocabulary mining workspace
- Evidence reviewed: `PRODUCT.md`, `DailyWakeupModule.tsx`, module trainers

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
- Content hierarchy: Status/actions first, generated content next, Foundation last

## Design principles
- Clarity Over Clutter: one workbench for status + controls
- Immediate Context: theme and check-in visible before running AI
- Frictionless Feedback: notice and timer inline, not in a separate sparse card
- Tradeoffs: Medium density preferred over sparse hero layouts for tool screens

## Visual language
- Color: Primary accent `#FF5722`; secondary `#2563eb`; surfaces slate/white and `#202124`
- Typography: System UI sans; tracked uppercase labels sparingly; mono for timers/IPA
- Spacing/layout rhythm: Product density — related controls 8–12px; section gaps 12–16px; avoid stacked large empty cards
- Shape/radius/elevation: `rounded-xl` workbench; soft low shadows only when elevating interaction
- Motion: 150–250ms state transitions; timer ring updates; reduced decorative pulse
- Imagery/iconography: Lucide icons at consistent stroke; no decorative hero imagery on tool panels

## Components
- Existing: `ModuleWrapper`, `DailyWakeupModule`, `PronunciationTrainer`, `GrammarPolishTrainer`
- New/changed: Merged awakening status + action workbench; Foundation textarea initial `rows=3`
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
- Layout adaptations: Status row wraps; timer stays top-right of workbench
- Touch/hover: Buttons keep ≥40px tap height where practical

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
- Compatibility: Existing Dify wakeup / training APIs unchanged
- Test/screenshot expectations: Visual check of Daily Wakeup first viewport density

## Open questions
- [ ] Whether ModuleWrapper compact spacing should tighten globally for all modules / product / medium
