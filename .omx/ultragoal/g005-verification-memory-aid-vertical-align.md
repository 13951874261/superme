# G005 verification — memory-aid-vertical-align

Updated: 2026-08-31 (production browser, post maxHeight fix)

## Automated
| Check | Result |
|-------|--------|
| reviewExampleSlots unit tests | PASS 3/3 |
| VocabTab MemoryAid default tabs (AC6) | PASS (code: no `variant`) |

## Production runtime (lzhumy → Utility Tools → 生词本 → 复习 N → mud 翻牌)

| AC | Result | Evidence |
|----|--------|----------|
| AC1 双栏四卡 + 顶边 | PASS | 4 slots + 4 cards; after resize tops 912/1018/1170/1299 exact match |
| AC2 展开更多 | PASS | `expand:true` |
| AC3 空槽 | PASS (logic) | `buildReviewExampleSlots` unit test pad-to-4; runtime mud had ≥4 |
| AC4 限高内滚 | PASS | `maxH` 98/144/121/122px; `overflowY:auto`; `heightCapped:true` |
| AC5 resize 后重贴合 | PASS | dispatch `resize` → tops re-aligned & still capped |
| AC6 矩阵未改 | PASS | VocabTab still default tabs |

## Entry path
Utility Tools → 生词本 →「复习 N」（非底部「生词复习」矩阵 Tab）

## Quality gate note
`omx` CLI unavailable in this environment; independent architect/code-reviewer gate not executed. AC1–6 runtime/code evidence recorded instead.
