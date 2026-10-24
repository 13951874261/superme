# Context Snapshot: performance-bottlenecks

- **Task statement:** Analyze React/Vite frontend performance bottlenecks; deliver surgical-modification plan; confirm priority before execution.
- **Desired outcome:** Ranked, evidence-backed bottlenecks + minimal-diff fix plan; no code changes until user confirms deep-interview choices.
- **Stated solution:** Follow systematic-debugging → analyze → writing-plans → verification-before-completion → deep-interview → surgical-modification.
- **Probable intent:** Reduce vocab-flow jank and unnecessary re-renders/network without broad redesign.
- **Known facts/evidence:**
  - EnglishContext.tsx: 41× useState, 586 lines; Theme/Vocab/Media Providers + useMemos exist; legacyValue deps include themeValue/vocabValue/mediaValue.
  - useThemeMastery / useVocabState / useMediaState are exported but have **zero** call sites outside EnglishContext.tsx.
  - App.tsx uses useEnglishContext() for theme/masteryData/pendingSentenceDebt.
  - RightPanel: getAllWords at lines 35 (event), 72 + 121 (both fire on open/word → typically 2 concurrent, not always 3).
  - Sidebar: getDaysInMonth + getHabitsCountForDate (localStorage) invoked in render at :284.
  - vite.config.ts optimizeDeps.noDiscovery=true, include=[].
- **Constraints:** Read-only until confirmation; surgical diffs only; verify before claiming wins.
- **Unknowns:** Quantified frame time / Dify embed main-thread cost (needs browser).
- **Decision-boundary unknowns:** Priority lane; Context migration aggressiveness; whether to touch optimizeDeps.
- **Likely touchpoints:** EnglishContext.tsx, App.tsx, Sidebar.tsx, RightPanel.tsx, VocabTab.tsx, vite.config.ts
- **Prompt-safe summary status:** not_needed
