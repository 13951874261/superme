# G005 verification — memory-aid-vertical-align

Updated: 2026-08-31 (production browser)

## Automated
| Check | Result |
|-------|--------|
| reviewExampleSlots unit tests | PASS 3/3 |
| VocabTab MemoryAid default tabs (AC6 code) | PASS |

## Production runtime (lzhumy → Utility Tools → 生词本 → 复习 N → mud 翻牌)

| AC | Result | Evidence |
|----|--------|----------|
| AC1 双栏四卡同开 + 顶边 | PASS | DOM: 4×`data-ex-slot` + 4×`data-memory-card`; tops 912/1018/1170/1299 对齐（±1px）；标题「例句 ↔ 记忆辅助」 |
| AC2 展开更多 | PASS (presence) | `hasExpand:true` on mud (≥4 examples) |
| AC3 空槽 | PARTIAL | unit pad-to-4; no &lt;4-example word exercised in browser this run |
| AC4 限高内滚 | FIX DEPLOYED | First probe: tops OK but `maxHeight` was `none` (card taller than slot). Fixed `maxHeight: \`${h}px\``; redeployed |
| AC5 resize | UNVERIFIED | ResizeObserver present in code; not manually resized in browser |
| AC6 矩阵未改 | PASS (code) | VocabTab still `<MemoryAidPanel />` without variant |

## Entry path note
Dashboard「生词复习」= VocabTab 矩阵，不是 FlashCard。FlashCard 入口：侧栏 Utility Tools → 生词本展开 →「复习 N」。

## Residual for full close
- Re-check AC4 after redeploy (maxHeight px)
- Optional AC3/AC5 manual
- Ultragoal quality gate (ai-slop / independent review) still not run via omx
