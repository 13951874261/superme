# Deep Interview Transcript: confetti-jank-fix

- interview_id: e88dd70c-0718-4eca-abfd-6a5b3925716e
- profile: standard (threshold ≤ 0.20)
- type: brownfield
- rounds: 6
- final ambiguity: ~0.12
- context snapshot: `.omx/context/confetti-jank-fix-20260820T144552Z.md`
- timestamp: 2026-08-20T14:55:00Z

## Transcript

| Round | Dimension | Answer |
|-------|-----------|--------|
| 1 | Intent | 互动卡死优先；视觉可保留 |
| 2 | Outcome | 庆祝期间也要全程丝滑 |
| 3 | Constraints (Contrarian) | 反馈优先：横幅 + 极轻彩带；丝滑不可妥协（裁决 R1/R2 冲突） |
| 4 | Scope | Confetti.tsx + ImprovTimer 重复触发 + TextHighlighter/showConfetti 全部修 |
| 5 | Non-goals | 不改文案/样式、不换库、不改成功判定、不改音效、不做全站动画大扫除 |
| 6 | Decision Boundaries | 技术细节全权（粒子/时长/reduced-motion/防抖写法等），符合「极轻+丝滑+非目标」即可 |

## Pressure-pass finding

Round 3 revisited Round 1（视觉可留）vs Round 2（全程丝滑）：用户选择反馈优先，允许大幅削弱粒子。
