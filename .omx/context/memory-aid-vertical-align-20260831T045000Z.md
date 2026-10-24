# Context: memory-aid-vertical-align

- Task: 右侧 MemoryAid 四个入口（词根/联想/助记/图片）改为纵向排列，并与左侧例句区动态上下对齐
- Desired outcome: 左右视觉节奏对齐，减少右侧横向 Tab 与左侧纵向例句的错位空旷感
- Stated solution: 纵向排列 + 动态对齐（用户附截图）；提及 /gsap-frameworks（本仓为 React，应对齐 gsap-react / useGSAP）
- Intent hypothesis: 希望四块记忆辅助像左侧例句卡片一样纵向堆叠可读，且整块顶部与例句列表顶部对齐，并随内容高度变化保持对齐
- Known facts [from-code][auto-confirmed]:
  - MemoryAidPanel.tsx: 四 Tab 横向 flex + 单内容区切换 activeTab
  - VocabTab: lg:grid-cols-12 左词典 / 右 MemoryAid（另有矩阵台面布局）
  - 左例句：DictionaryPanel EnZh 等视图纵向卡片列表，数量可变（常 >4）
  - 项目已用 @gsap/react useGSAP（MemoryMatrixStage）
- Constraints: AGENTS 确认后才改；元素不可随意缺失；R1 密度方向仍在
- Unknowns: 「动态对齐」是整栏顶对齐、滚动联动、还是 1:1 对齐某几条例句；四块是否同时展开还是保留 Tab；是否改 DictionaryPanel 全局还是仅 Vocab 翻牌后布局
- Decision-boundary unknowns: GSAP 仅入场还是持续测距对齐；图片 Tab 高度策略
- Touchpoints: MemoryAidPanel.tsx, 可能 VocabTab.tsx / DictionaryPanel 布局壳
- Docs inspected: vocab-matrix-density redesign spec（密度，非本需求）
- Prompt-safe summary status: not_needed
