# G005 verification — memory-aid-vertical-align

Updated: 2026-08-31

## Automated evidence

| Check | Result | Evidence |
|-------|--------|----------|
| extractReviewExampleList | PASS | `node --import tsx --test src/utils/reviewExampleSlots.test.ts` (3/3) |
| buildReviewExampleSlots pad/extra (AC2/AC3 logic) | PASS | same suite |
| VocabTab still default tabs (AC6) | PASS (code) | `VocabTab.tsx` calls `<MemoryAidPanel .../>` without `variant` |
| FlashCard wires dual-pane | PASS (code) | uses `FlashCardExampleMemoryAlign` |
| reviewStack + GSAP maxHeight/ResizeObserver | PASS (code) | `FlashCardExampleMemoryAlign.tsx` + `MemoryAidPanel variant=reviewStack` |

## Runtime / visual AC

| AC | Status | Notes |
|----|--------|-------|
| AC1 翻牌双栏四卡同开 | UNVERIFIED runtime | local Vite not reachable this session; needs生词复习 UI |
| AC2 展开更多 | PARTIAL | slot math covered; UI toggle unproven in browser |
| AC3 空槽 | PARTIAL | pad-to-4 unit tested; empty-slot UI unproven |
| AC4 卡内滚动 | UNVERIFIED runtime | GSAP sets maxHeight+overflowY in code |
| AC5 resize/换词 | UNVERIFIED runtime | ResizeObserver+deps in code |
| AC6 矩阵回归 | PASS (code) | no VocabTab MemoryAid API change |

## Quality gate (ultragoal final)

- ai-slop-cleaner: not run (omx CLI unavailable)
- independent code-review/architect: not run
- **Do not mark aggregate Codex/Cursor goal complete** until user confirms visual AC1–5 and optional deploy

## Blocker for full G005 close

Need user (or browser with logged-in session) to open 生词复习翻牌 and confirm AC1–5; then deploy if desired.
