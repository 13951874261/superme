# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-07-24
- Primary product surfaces: App shell, Daily Wakeup (每日唤醒), English dashboard / Listen tab, Oral War Room, vocabulary mining / URL-media tools, Global Task Center
- Evidence reviewed: `PRODUCT.md`, `DailyWakeupModule.tsx`, English dashboard components, `ListenTab.tsx`, `TaskContext.tsx`, `GlobalTaskCenter.tsx`, Oral War Room family, `src/index.css` tokens, `Header`/`MainContent`/`ModuleWrapper`; startup API path in `App.tsx`, `difyChatbot.ts`, `DifyAssistantFrame.tsx`, `difyAPI.ts`, `profileHelper.ts`; `re.md` daily listen pregenerate spec; `vocab-server` dailyPack + listen/TTS routes
- Consistency spec: `docs/superpowers/specs/2026-07-22-ui-consistency-design.md`
- Listen pregenerate decisions (2026-07-24): C1 login ping + theme sync; A2 only 5/15/25m cached; B3 cap 1024MB; B4 partial status; A5 manual regen writes cache; A6 cron after daily-pack at 02:00; A7 task type `listen_backfill`

## Brand
- Personality: Professional, authoritative, focused, premium
- Trust signals: Clear status, durable training history, restrained accents
- Avoid: Toy/gamified pastel UI; low-contrast text; widget clutter; module-private purple/navy “game” skins; mixed primary CTA languages in one viewport

## Product goals
- Goals: Dense, task-first practice surfaces; status and actions in one glance; shell + modules read as one visual system; Listen tab prefers same-day pregenerated article+audio so users do not wait on Dify/TTS when cache hits
- Non-goals: Marketing-style whitespace; nested decorative cards for empty states; full visual rewrite; new design-system package; pregenerating historical themes or all system themes; caching non-5/15/25 durations
- Success signals: First viewport shows status + controls without large dead zones; same scroll view no longer mixes navy/purple/enterprise skins; Listen filter switch to a ready combo shows content without a blocking spinner; miss/partial shows one clear backfill CTA into Task Center

## Personas and jobs
- Primary personas: Professional learners, financial executives, business negotiators
- User jobs: Start daily wakeup, train pronunciation/grammar, check in duration, run Oral War Room and vocab mining; open Listen and pick genre/CEFR/duration with instant cache when available
- Key contexts of use: Desktop focused sessions; dark execution panels + light content; early-morning cache miss after cron failure → submit backfill and continue elsewhere via Task Center

## Information architecture
- Primary navigation: Top module nav (听/说/读/写 + extensions)
- Core routes/screens: Daily Wakeup workbench → results → Foundation trainers; English Dashboard; English Listen tab (pregenerate-first); Oral War Room; URL/media tools; Global Task Center (header)
- Content hierarchy: Dashboard uses 2×2 paired rows (Roadmap|Stay, Theme|Briefing) + full-width Arsenal; equal column stretch, no dead zones; Listen keeps existing filter toolbar + script/audio workbench, adds inline cache-miss / partial bars only
- Consistency pass does not change IA or layout skeletons

## Design principles
- Clarity Over Clutter: one workbench for status + controls
- Immediate Context: theme and check-in visible before running AI
- Frictionless Feedback: notice and timer inline, not in a separate sparse card
- One Skin Per Product: token-first System Pass; restrained substitution over redesign
- Tradeoffs: Medium density preferred over sparse hero layouts for tool screens; tidier over novelty

## Visual language
- Color: Accent `#FF5722` (`--color-accent`); brand ink `#202124` (`--color-brand`); surfaces canvas/white and execution `#202124` / `#0F1115`; status via `--color-success|warning|danger|info`; info blue OK as semantic accent only, not as module primary CTA/card skin
- Typography: Outfit (`--font-sans`); tracked uppercase labels sparingly; mono for timers/IPA
- Spacing/layout rhythm: Product density — shell header compact (`py-2`, no min-height padding); content `pt-2` under tabs; module titles are single-row toolbars that fill horizontal width; related controls 8–12px; section gaps 12–16px; avoid stacked large empty cards
- Shape/radius/elevation: Containers `rounded-xl`; primary buttons `rounded-xl`–`rounded-2xl`; soft low shadows via `--shadow-card` family only when elevating interaction; `rounded-full` reserved for dots/rings/FAB/badges
- Motion: 150–250ms state transitions; timer ring updates; reduced decorative pulse / glow
- Imagery/iconography: Lucide icons at consistent stroke; no decorative hero imagery on tool panels

## Components
- Existing to reuse app-wide: `ModuleWrapper`, `Header`, `MainContent`, `DailyWakeupModule`, English `PrimaryButton` / `GhostButton` / `BentoCard` / `StatusBadge`
- Roles: Primary = brand ink (`.btn-primary` / `PrimaryButton`); Secondary = ghost/outline; Accent action = solid `#FF5722` with ≤1 dominant accent CTA per viewport; Light surface card vs dark execution panel
- New/changed (consistency pass): Define missing `--color-brand-hover` in `@theme`; retire purple primary CTAs and invented navy/indigo card skins; align shell + modules to the contract above without new package
- Listen pregenerate: reuse `showNotice` + `useTask().addTask`; compact miss/partial banner in `ListenTab`; Task Center branch for `listen_backfill` (no “导入并提纯”); avoid extra empty cards / dual competing CTAs / purple indigo callouts
- Variants and states: idle / running / checked-in / loading; status chips on success/warning/danger/info ramp
- Token/component ownership: CSS vars in `src/index.css`; prefer shared button/card primitives over one-off hex skins

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
- Loading: Spinner in primary CTA; notice text updates; Listen cache lookup uses a short inline load (not a full-page empty card)
- Empty: Compact Foundation textareas (3 rows), resize-y allowed
- Error: Inline notice string (no `alert`)
- Success: Check-in label + emerald state
- Disabled: Check-in disabled until wakeup result exists; primary disabled uses muted zinc, not a third brand color
- Listen `ready`: Show article + audio immediately from pregenerate APIs
- Listen `partial`: Show ready article; audio zone shows compact “后台生成音频” accent CTA (≤1 dominant accent in that zone)
- Listen `missing` / `failed` (only when duration ∈ {5,15,25}): Compact banner + “后台生成” CTA — no nested decorative empty card
- Listen duration ∉ {5,15,25}: Keep existing realtime generate path (no backfill CTA for cron cache)
- Listen backfill submitted: Toast/notice「已提交后台生成，请稍后在任务中心查看。」; Task Center shows `listen_backfill` row; do not block the Listen viewport waiting for completion
- Offline/slow network: Prefer explicit failed notice + retry/backfill over silent empty

## Content voice
- Tone: Direct, operational, Chinese UI labels
- Terminology: 唤醒 / 打卡 / 主题 / Foundation / 后台生成 / 任务中心 / 预生成
- Microcopy rules: No redundant “see card below” pointers; say status once; prefer「今日该组合内容尚未准备好，可提交后台生成。」over playful “Oops”

## Implementation constraints
- Framework/styling: React + Tailwind; do not migrate stacks
- Design-token constraints: Preserve `#FF5722` / `#202124` brand pair; define `--color-brand-hover`; no new design-system package
- Consistency delivery: Token-first sweep order — Foundation → Shell → Daily Wakeup + English Dashboard → Oral War Room → URL/media tools → remainder outliers
- Performance: No new animation libraries for density/consistency passes
- Performance (API / startup): Prefer removing dead or duplicate network work on the critical path; keep chatbot/assistant behavior unchanged; reuse existing inflight/TTL caches in `difyChatbot.ts` before adding new layers
- Performance (page / tab switch): Prefer keep-alive or shared context fetches over remount-triggered duplicate APIs; do not change lock/debt redirects, mastery gates, or Dify conversation isolation semantics without an explicit product decision
- Compatibility: Existing Dify wakeup / training / listen generate / TTS APIs remain; pregenerate is an additive cache layer
- Listen pregenerate storage: SQLite metadata + `vocab-server/public/daily_listen_audio` + `vocab-server/public/daily_long_articles`; capacity cleanup 7-day then ≤1024MB total; cron at 02:00 Asia/Shanghai **after** daily-pack job in the same tick
- Task Center: New type `listen_backfill` must render with existing task row chrome (no purple/game skin); completed result may deep-link refresh Listen filters rather than “导入并提纯”
- Test/screenshot expectations: Visual check of Daily Wakeup first viewport density — no large empty band under header or beside module title; Dashboard right column must not leave a dead zone under Daily Briefing (Arsenal fills it); five-screen consistency check (Shell, Wakeup, Dashboard, Oral War Room, URL/media) with no mixed navy/purple/enterprise skins in one viewport; Network waterfall for startup + assistant open after API perf work; module/tab switch should not re-fire identical stay-stats/quota/flaw-vocab when data is still fresh; Listen miss/partial states use compact banner + single accent CTA

## Open questions
- [x] product / high — English sub-tabs: remount vs CSS keep-alive → lazy keep-alive shipped
- [x] product / high — Keep English+DailyWakeup mounted when leaving top module → shipped
- [x] product / medium — Pause `checkThemeMastery` polling when not on english → shipped
- [x] design / high — UI consistency scope/intensity/approach → full shell+modules, medium System Pass, token-first (see consistency spec)
- [x] product / high — Daily listen pregenerate decisions (login/duration/cap/partial/regen/cron/task type) → locked 2026-07-24 in Source of truth
- [ ] product / medium — Defer `rotateEmbedSessionOnRouteChange` until assistant opens (may affect cross-module Dify continuity) / product / medium
- [x] design / low — Login beyond token conflicts → 2026-08-30 邀请制登录首页：左右分栏（暗色理念场 + 浅色邀请门），仅受邀账号无密码，名单由 `scripts/invite-account.js` 手动写入（见 `docs/superpowers/specs/2026-08-30-invite-only-login-design.md`）
- [ ] design / low — ReadModule multi-color track chips: keep semantic variety vs compress to status ramp (default: keep meaning, drop purple decorative primary) / implementer
- [ ] Whether non-english modules need the same shell density audit / product / low
- [ ] product / low — After `listen_backfill` completes, auto-reload Listen vs require user to re-open filter / default: auto-reload if same filters still selected
