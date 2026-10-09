# Context Snapshot — dashboard-right-blank

## Task statement
Fill or redesign the large empty white region under Daily Briefing on English Dashboard (进度总控), red-boxed in user screenshot.

## Desired outcome
Right column no longer looks unfinished; blank space resolved in a way that fits tactical training dashboard.

## Stated solution
User invoked /impeccable + /redesign-skill + /deep-interview — clarify before implement, then redesign.

## Probable intent hypothesis
Left column (Roadmap + ThemeGateway) is taller than right (StayAnalysis + DailyBriefing). Grid uses items-start, so right column ends early and page bg shows as a blank panel. User wants that dead zone filled or layout rebalanced.

## Known facts / evidence
- [from-code] Target: `d:\cursor\work\super-agent\src\components\modules\english\tabs\DashboardTab.tsx` lines ~696-745: `lg:grid-cols-12`, left `col-span-7` Roadmap+Gateway, right `col-span-5` StayAnalysis + DailyBriefing; `items-start`.
- [from-code] `StayAnalysisPanel` only renders Stay Analysis block when `stayStats` truthy; ability ring when not mastered.
- [from-code] Below-fold still has ArsenalPanel, IntelBriefing, ImmersiveReader (not in the blank).
- [from-code] Prior spec `.omx/specs/deep-interview-page-density-redesign.md` locked density + first-screen 123; may have created height imbalance as side effect.
- Workspace Cursor root is `sproj`; app lives in `work\super-agent`. Impeccable `context.mjs` from sproj → NO_PRODUCT_MD; need check/init PRODUCT.md under super-agent before craft.

## Constraints
- deep-interview: no implementation until crystallize + user picks handoff
- karpathy: clarify + confirm before implement
- redesign: work with existing stack, minimal rewrite
- Prior non-goals (page-density): no interaction/data changes, no recolor, no other tabs, no accordion hide, no new deps — may need reconfirm for this blank-fill task

## Unknowns
- Should blank be filled with NEW content, or layout rebalance only?
- If content: what job (next action, stay analysis, CTA to arsenal/intel, today suggestion)?
- Scope: only right column vs full dashboard reflow?
- Non-goals and decision boundaries for THIS task

## Decision-boundary unknowns
- What OMX may decide (spacing vs inventing a new module) without confirmation

## Likely codebase touchpoints
- DashboardTab.tsx layout
- StayAnalysisPanel.tsx / DailyBriefingCard.tsx
- Possibly promote Arsenal/Intel snippet or new compact panel into right column

## Relevant repo docs inspected
- deep-interview-page-density-redesign.md
- DashboardTab / DailyBriefing / StayAnalysis source

## Terminology
- 进度总控 / DashboardTab = English module dashboard
- 空白 = red-boxed dead zone under Daily Briefing in right column

## Prompt-safe initial-context summary status
not_needed
