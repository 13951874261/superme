# Spec: 英英词典单字 Cambridge 对齐

> Deep-interview crystallized spec. Requirements source of truth for handoff. Do not re-interview by default.

## Metadata
- Profile: standard
- Rounds: 6
- Final ambiguity: ~0.12 (threshold 0.20)
- Type: brownfield
- Context snapshot: `.omx/context/en-en-cambridge-single-20260829T073828Z.md`
- Transcript: `.omx/interviews/en-en-cambridge-single-*`

## Clarity breakdown
| Dimension | Score | Notes |
|-----------|-------|-------|
| Intent | 0.90 | Cam EN authenticity + progressive UX |
| Outcome | 0.90 | Pure-EN card; Cam + limited enrichment |
| Scope | 0.92 | en_en + single word only |
| Constraints | 0.85 | Non-goals + decision boundaries set |
| Success | 0.85 | Result-only acceptance |
| Context | 0.80 | Existing Cam path is en_zh-only today |

## Intent
Make 【英英词典】 single-word lookups use real Cambridge **English** dictionary content and the same Cam-first / progressive enrichment experience as 【英汉双向】 single-word lookups.

## Desired Outcome
For a single English word query in `en_en_business`:
1. Instant (or near-instant) Cambridge-backed English head content (phonetics / senses / definitions / examples as extracted).
2. Progressive fill of **synonyms / antonyms / collocations** only (English).
3. Card is **pure English**: no Chinese gloss, no business_notes / 商务批注 UI.

## In-Scope
- `dictType === 'en_en_business'` **and** `isSingleEnglishWord(word)` path.
- Cambridge URL: `https://dictionary.cambridge.org/dictionary/english/{word}` (lowercase word segment).
- Fetch / parse / cache / merge / display for that path.
- UI redesign of 英英单字展示 based on extracted Cam fields (+ three enrichment fields).
- Backend merge policy: Cam owns definitions/examples; Dify-derived fields only fill syn/ant/col; ignore business_notes (and Chinese) for this path even if returned.

## Out-of-Scope / Non-goals
- Phrases and sentences under `en_en_business` (keep current Dify 商务英英 behavior/UI).
- Any change to `en_zh_bidirectional` Cambridge simplified-Chinese source/logic.
- Vocab collect / matrix / task-center overall flow changes.

## Decision Boundaries (OMX may decide without confirmation)
- UI block order, fold defaults, English label copy.
- EN dictionary markdown field extraction and payload mapping, as long as display is stable and acceptance criteria hold.
- Whether to reuse/adapt existing parser vs add EN-specific parse path.
- Which Dify branch/internals supply syn/ant/col, as long as final card policy holds.

## Constraints
- Brownfield: prefer existing dict-query Cam-first + enrichment-poll patterns used by en_zh single-word.
- Do not break phrase/sentence en_en path.
- AGENTS.md: Chinese communication; confirm-before-implement still applies at execution handoff.

## Testable acceptance criteria
1. Query `bug` in 英英词典 (single word): within a few seconds see English Cambridge-derived definition/examples (not thin Dify-business-only card); URL/source uses `.../dictionary/english/bug`.
2. Direction/meta must not present Chinese gloss or 商务批注 for this path.
3. Within enrichment window, synonyms and/or antonyms and/or collocations may appear; if present, English-only.
4. Query a phrase/sentence in 英英词典: behavior remains previous Dify business path (unchanged).
5. Query a word in 英汉双向: still uses english-chinese-simplified Cam path (unchanged).
6. Collect/vocab matrix flow: no intentional change required for this feature.

## Assumptions + resolutions
- "参考英汉双向处理逻辑" = Cam-first + progressive enrichment UX/policy, not copying ZH UI or ZH Cambridge URL.
- "有限 Dify" = only syn/ant/col matter for acceptance; business fields may still be produced upstream but must not surface.
- "展示方式按提取内容设计" = agent designs UI from available extracted fields under Decision Boundaries.

## Pressure-pass findings
- Challenged enrichment implementation: user chose result-only acceptance (Dify branch internals unconstrained).

## Docs / Terminology Ledger
- Repo term `en_en_business` = UI title 英英词典 / 商务英英 view today.
- Repo Cam base today: `english-chinese-simplified` for en_zh only (`cambridgeDictionary.js`).
- User term "形成markdown文件获得地址" = Cambridge page URL used as fetch source for markdown content.
- Conflict resolved: 英英单字 must use `/dictionary/english/{word}`, not simplified Chinese dictionary URL.

## Technical context (evidence)
- `[from-code][auto-confirmed]` `useCambridgeWordPath` currently only for `en_zh_bidirectional` + single English word (`server.js`).
- `[from-code][auto-confirmed]` `CAMBRIDGE_BASE` is english-chinese-simplified (`cambridgeDictionary.js`).
- `[from-code]` `UtilityEnEnBusinessView` currently shows definitions_en, business_notes, meaning_zh, scenarios.

## Handoff residual risk
- EN dictionary page markdown shape may differ from EN-ZH parser fixtures; parsing quality is under Decision Boundaries but may need iteration after first sample (`bug`).
- Dify may be slow/empty for syn/ant/col; Cam-first card must still satisfy acceptance without enrichment.
