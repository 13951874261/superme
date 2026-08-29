# Context Snapshot: en-en-cambridge-single

- Task: Align 【英英词典】 single-word flow with 【英汉双向】 single-word logic; phrases/sentences unchanged; Cambridge URL = https://dictionary.cambridge.org/dictionary/english/{word}; design UI from extracted content.
- Desired outcome: Single English words in en_en_business use Cambridge EN dictionary (not EN-ZH), parse+display like bidirectional Cam path where appropriate.
- Stated solution: Mirror bidirectional single-word handling; change markdown/source URL; redesign display from extracted fields.
- Probable intent: User wants authentic EN definitions from Cambridge English dictionary for word lookups in 英英词典, same Cam-first UX as 英汉双向.
- Known facts:
  - [from-code] en_zh_bidirectional uses isSingleEnglishWord + fetchCambridgeEntry with english-chinese-simplified base.
  - [from-code] en_en_business currently primarily Dify workflow branch (dict_tool_workflow), UtilityEnEnBusinessView for display.
  - [from-code] DictionaryPanel has en_en_business titled 英英词典.
- Constraints: AGENTS.md Chinese + confirm-before-implement; phrases/sentences must not change; deep-interview no direct implementation.
- Unknowns: How closely to mirror Cam+Dify merge vs Cam-only for en_en; which fields to extract from EN dictionary page; whether collect/vocab sync same as bidirectional; whether British/American spelling redirects.
- Decision-boundary unknowns: What OMX may decide on UI layout without confirmation; Dify still used for enrichment or not for en_en single words.
- Touchpoints: cambridgeDictionary.js, server.js dict-query, DictionaryUtilityViews UtilityEnEnBusinessView, DictionaryPanel, possibly yml workflow.
- Docs inspected: AGENTS.md; cambridgeDictionary.js; DictionaryPanel DICT_CONFIG; dict_tool_workflow yml en_en_business branch.
- Prompt-safe summary status: not_needed
