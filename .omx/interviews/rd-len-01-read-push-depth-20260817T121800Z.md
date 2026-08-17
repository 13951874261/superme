# Deep Interview Transcript: rd-len-01-read-push-depth

- **Interview ID:** rd-len-01-20260817
- **UTC:** 20260817T121800Z
- **Profile:** standard (threshold ≤ 0.20, max 12)
- **Type:** brownfield
- **Final ambiguity:** 0.097
- **Context snapshot:** `.omx/context/rd-len-01-read-push-depth-20260817T120100Z.md`

## Rounds

| Round | Target | Answer |
|------|--------|--------|
| 1 Intent | 为何现在写 PRD | **density-not-length**：主因不是字数，而是真文档信息密度；1500 字也可能是空话 |
| 2 Outcome | 「详尽」合格形态 | **simulate-genre**：仿真文种原文 + 具体条款/数据 + ≥2 利益方（结构比字数优先） |
| 3 Contrarian | 虚构公文红线 | **fiction-but-no-fake-citations**：允许虚构博弈，禁止伪造可核对文号/法规名；用「某省监管函〔训练〕」占位 |
| 4 Non-goals | 本轮不做 | **全部**：不修 MAT/DEC、不做卡片 UI、不抓网页当推送、不改解码报告、不新建 Dify |
| 5 Success | 1500 vs 密度 | **both-hard-gates**：≥1500 字 **且** 密度清单通过才算 `ok` |
| 6 Decision Boundaries | 放权默认包 | **仅 auto-retry**：未达标自动重试 1–2 次 |
| 7 Fallback | 重试仍失败 | **A yellow-bar-only**：失败稿入框 + 黄条 + 手动再推；不写分类兜底长文 |
| 8 Scope | Tab 覆盖 | **current-tab-generic**：四 Tab 同一套仿真原文+密度清单，仅场景标题不同 |
| 9 Density check | 谁来判密度 | **heuristic-frontend**：扩展 `readPushQuality`，不再调一次模型 |
| 10 Decode gate | 不达标能否解码 | **decode-warn-once**：第一次点解码弹出确认，确认后放行 |

## Pressure-pass notes

- Round 3 回访 Round 2「仿真文种」：训练密度可以靠虚构，但不可把假政策文号做成可核对真文。
- Round 5 回访冻结规格「不以结构字段齐全作硬卡」：明确推翻，改为双硬卡。

## Docs / Terminology Ledger

| 术语 | 裁定 |
|------|------|
| 详尽 | ≠ 仅 ≥1500 字；= 仿真原文信息密度（条款/数据 + ≥2 利益方 + 无假文号）且 ≥1500 字 |
| RD-LEN-01 | 本 PRD 验收锚点；冻结表「结构非硬卡」被本访谈覆盖 |
| 每日 AI 素材推送 | `generateReadMaterial` → 输入框；不是网页抓取 |
| 穿透解码 | `runCognitivePenetrationEngine`；本轮不改报告，仅加不达标确认 |
| 结构字段齐全 | 本轮不做分区卡片 UI；密度用启发式清单，不引入结构化展示 |

## Closure

- Non-goals ✅
- Decision Boundaries ✅
- Pressure pass ✅
- Practical closure ✅（剩余为启发式词表细节，已授权在 `readPushQuality` 内自定）
