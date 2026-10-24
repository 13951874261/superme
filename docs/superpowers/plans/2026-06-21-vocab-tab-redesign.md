# 词汇矩阵今日待复习界面重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构词汇矩阵（VocabTab.tsx）中展示今日待复习词汇的界面。上方区域展示类似于图1【情报捕获仓】的完整词典细节与记忆辅助面板，下方展示强制造句评估区。

**Architecture:** 
1. **上层（情报展示区）**：引入一个高度定制的单词详情卡片。我们将重构并优化现有的 `DictionaryPanel.tsx` 词典视图排版（商务英英、英汉双向、现代汉语），根据 `currentWord.dict_type` 或其 `payload` 数据结构，自适应渲染出精美的词条头部、中文释义、Definitions定义、Business Usage Notes（商务注解）、Workplace Scenarios（工作场所场景，带发音）、Example Sentences（例句支撑，带发音）、Synonyms & Antonyms（同反义词药丸标签）以及 Collocations（常用搭配折叠面板）。
2. **生词记忆辅助集成**：在上方详情卡片的底部直接嵌入 `MemoryAidPanel` 记忆辅助面板（包括词根词缀、联想记忆、助记短语、图片记忆）。
3. **下层（造句评估区）**：重塑“强制闭环造句”的交互层，将其设计为一个独立的带有触觉反馈的“考核战术面板”，包含多行输入框、实时字数及格式检验、AI教官评分与意见卡片、以及操作按钮组（提交、下一个、强行跳过等）。
4. **视觉风格**：基于 `design-taste-frontend-v1` 标准，去除任何 emoji 符号，全量采用 Lucide 图标；对卡片采用双重边框（Double-Bezel）嵌套硬件感结构；统一使用圆角比例，并配以轻量级平滑过渡动画。

**Tech Stack:** React, Tailwind CSS, Lucide React, Framer Motion, Dify Sentence Evaluation API, SM-2 Spaced Repetition logic.

---

### Task 1: 解析当前 VocabEntry 类型的 payload 数据适配多种视图

**Files:**
- Modify: `src/components/modules/english/tabs/VocabTab.tsx`

- [ ] **Step 1: 适配三种核心词典视图的数据提取**
在 `VocabTab.tsx` 中定义一个辅助函数 `normalizePayloadForView`，将 `currentWord.payload` 和 `currentWord.dict_type` 转换为兼容 `DictionaryPanel.tsx` 中 `EnEnBusinessView` / `EnZhBidirectionalView` / `ZhModernView` 所需的规范格式。

- [ ] **Step 2: 处理存量词汇或简易词汇的兜底数据结构**
对于只含有 `meaning` 和 `definition_en` 等简单字段的词条，伪造或封装一个规范化的 `EnZhBidirectionalPayload` 以便于渲染出标准的双向词典效果，避免界面排版崩塌。

---

### Task 2: 重构上方词典详情渲染区域（自适应词典视图）

**Files:**
- Modify: `src/components/modules/english/tabs/VocabTab.tsx`

- [ ] **Step 1: 导入并引用 DictionaryPanel 中的视图组件**
在 `VocabTab.tsx` 中导入 `EnEnBusinessView`、`EnZhBidirectionalView` 和 `ZhModernView`，或者将其核心排版样式重构为高内聚的组件在 `VocabTab.tsx` 中独立使用。由于需要与卡片风格无缝融合，我们直接在 `VocabTab.tsx` 中声明或扩展自适应词汇卡片组件 `<VocabDetailsCard word={currentWord} />`。

- [ ] **Step 2: 实施“双重边框（Double-Bezel）”嵌套硬件感卡片设计**
上方的详情卡片结构需如下实施：
- 外壳 (Outer Shell):
  ```tsx
  <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-[2rem] shadow-sm relative overflow-hidden">
  ```
- 内芯 (Inner Core):
  ```tsx
  <div className="bg-white border border-slate-100 rounded-[calc(2rem-0.625rem)] p-6 md:p-8 space-y-6">
  ```
- [ ] **Step 3: 严格按图1排版单词详情**
1. **词条头部**：在大卡片内渲染头部，单词名称使用大字号加粗黑体（若为英文则采用 Serif 字体增加高级感，中文采用 Sans-serif 字体），右侧包含词性（POS）胶囊、发音 SpeakButton（喇叭图标）、商务分类标签、主题 badge。
2. **核心译义/中文释义**：使用粉色/浅红（rose-50/rose-500/rose-100）左侧粗边框块。
3. **英文定义 (Definitions)**：使用琥珀色/橙色（amber-50/amber-500/amber-100）左侧粗边框块。
4. **商务注解 (Business Usage Notes)**：使用靛蓝色/蓝色（indigo-50/indigo-600/indigo-100）圆角框。
5. **工作场所场景 (Workplace Scenarios)** 与 **例句支撑 (Example Sentences)**：卡片化排列，每一个场景和例句都有各自独立的浅色背景（如 slate-50/indigo-50/amber-50），右侧配备 SpeakButton 发音按钮。
6. **近义词 & 反义词 (Synonyms & Antonyms)**：分别渲染为绿色药丸和红色药丸云标签。
7. **Collocations 搭配** 与 **其他释义**：折叠面板，点击可展开收起。

---

### Task 3: 整合 MemoryAidPanel 记忆辅助面板到单词卡片底部

**Files:**
- Modify: `src/components/modules/english/tabs/VocabTab.tsx`
- Create/Import: `src/components/MemoryAidPanel.tsx`

- [ ] **Step 1: 在单词卡片底部预留记忆辅助插槽**
在 `Inner Core` 容器的底部，在 Collocations 折叠面板之下，添加一个分隔线。

- [ ] **Step 2: 渲染 MemoryAidPanel**
直接挂载 `<MemoryAidPanel wordId={currentWord.id} wordText={currentWord.word} />`，使得“词根词缀”、“联想记忆”、“助记短语”、“图片记忆”完全呈现在卡片内，不需要用户跳转或呼出侧边栏。

---

### Task 4: 重构下方“强制闭环造句”评估区

**Files:**
- Modify: `src/components/modules/english/tabs/VocabTab.tsx`

- [ ] **Step 1: 打造高对比、触觉反馈明显的评估控制卡片**
下方的造句区同样采用 Double-Bezel 设计，或者设计为一个嵌入式灰度控制台，与上方的详情大卡片形成“获取情报 -> 消化记忆 -> 产出考核”的清晰心流边界。
- [ ] **Step 2: 重构造句 Textarea 与 AI 评分回显**
1. 优化 `textarea` 输入框的焦点动效。
2. 在输入框下方或右侧优雅呈现 `evalResult`。评分（1-5分）如果达到或超过 3 分，显示绿色 `PASS` 徽章并写入 SM-2；否则显示红色 `REJECT` 徽章，并显示修正建议。
- [ ] **Step 3: 重构操作按钮**
1. 按钮支持 `:active` 状态的稍微缩放动效 (`active:scale-[0.98] transition-all`)。
2. 按钮使用高饱低亮（如深黑 `bg-[#202124]`，橙色 `bg-[#FF5722]`），并全量去除 emoji。

---

### Task 5: 验证并完成测试

- [ ] **Step 1: 验证界面在 Light/Dark 模式下的显示与 WCAG 对比度**
- [ ] **Step 2: 给出详细的复习评估功能测试用例**
- [ ] **Step 3: 提供前后端接口对齐确认**
