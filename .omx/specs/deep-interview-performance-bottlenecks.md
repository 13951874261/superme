# Deep Interview Spec: performance-bottlenecks

**Profile:** standard (threshold ≤ 0.20)  
**Type:** brownfield  
**Rounds so far:** 1 (awaiting Round 2)  
**Current ambiguity (est.):** ~0.32  
**Context snapshot:** `.omx/context/performance-bottlenecks-20260721T163900Z.md`  
**Plan:** `docs/superpowers/plans/2026-07-22-frontend-performance-bottlenecks.md`

## Intent
Reduce measurable frontend jank/redundant work in English training UI without UI redesign.
**[from-user] Round 1:** Priority = **网络请求削减** (RightPanel coalesce + VocabTab reload first).

## Desired Outcome
First pass: cut duplicate/redundant vocab network calls; defer pure render-path work unless needed for that goal.

## In-Scope (provisional after Round 1)
- RightPanel `getAllWords` coalesce (Task 4)
- VocabTab gated / de-duped reload (Task 2 reload portion)
- EnglishContext consumer migration / Sidebar memo / Vite — **pending Round 2 boundary**

## Out-of-Scope / Non-goals (provisional until user confirms)
- Full removal of `legacyValue`
- Dify embed rewrite
- Animation library dedupe (framer-motion + motion)
- Changing mastery poll interval without browser evidence

## Decision Boundaries
OMX may choose exact memo/helper placement and AbortController vs cancelled flag if behavior-equivalent. User must confirm priority lane, migration aggressiveness, and optimizeDeps.

## Acceptance Criteria
- App does not re-render on vocab idx-only updates after migration
- RightPanel open path: 1× getAllWords
- Sidebar month grid not recomputed when only unrelated Sidebar UI state toggles (month unchanged)
- No functional regression on Vocab / Dashboard / RightPanel dict display
