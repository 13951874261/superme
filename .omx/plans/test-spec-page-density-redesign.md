# Test Spec — page-density-redesign

**PRD:** `.omx/plans/prd-page-density-redesign.md`  
**Spec source:** `.omx/specs/deep-interview-page-density-redesign.md`

## Scope of tests
Layout/CSS/DOM order only on English 进度总控. No API contract tests.

## Automated / build
| ID | Check | Pass criteria |
|----|-------|---------------|
| T0 | Frontend build/typecheck | Project standard command succeeds |
| T1 | Dependency freeze | `package.json` / lockfile unchanged in diff |

## Manual layout (desktop)
| ID | Setup | Steps | Pass criteria |
|----|-------|-------|---------------|
| T2 | Chrome/Edge, viewport 1440×900, logged-in English → 进度总控, stayStats populated, SOP collapsed | Load page; do not scroll; capture screenshot | Visible in first viewport: StrategicRoadmap/ThemeGateway, StayAnalysis match ring (if not mastered), DailyBriefing 3 cards |
| T2b | Viewport 1280×800, same state | Load; no scroll | Triad still identifiable without scroll (may be tighter; no clipping of controls) |
| T2c | `masteryData.isMastered` true (ring section hidden) | Load at 1440×900; no scroll | Hub + stayStats/Briefing still above fold; no empty hero column collapse |
| T2d | After Steps 1–5 complete (**and Step 5b if triggered**) | Screenshot checkpoint before sign-off | AC1 evidence attached to PR/notes |
| T3 | Same as T2 | Scroll full page | SOP, ArsenalPanel, IntelBriefing, MaterialUploader all still present |
| T4 | Same | Inspect DOM order | Arsenal appears after DailyBriefing (not between Stay and Briefing); Stay has own card shell (not bare border-t) |

## Manual smoke (interaction unchanged)
| ID | Action | Pass criteria |
|----|--------|---------------|
| T5 | Toggle SOP expand/collapse | Still works; default can remain collapsed |
| T6 | Change theme via ThemeGateway (if unlocked) | Same behavior as before |
| T7 | Click one Arsenal generate control (or open confirm UI) | Same handlers; no layout-only regression |
| T8 | Open MaterialUploader tab UI | Still reachable below fold |

## Visual / UX gate
| ID | Check | Pass criteria |
|----|-------|---------------|
| T9 | Readability | User confirms not “无法阅读的拥挤” |
| T10 | Color | Dark briefing still `#202124`-family; brand accent unchanged |

## Out of scope for this test pack
- Other English tabs
- Mobile pixel-perfect first-screen triad (desktop is acceptance baseline)
- New unit tests for score math (unchanged)
