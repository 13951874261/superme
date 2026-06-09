好的，以下是**方案 1：Dify 轻量级检索 + 数据库持久化方案**的详细设计方案。

---

## 方案 1 详细设计方案

---

### 一、整体架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                        前端 (React)                          │
│  DashboardTab ─→ CustomThemeModal ─→ MaterialUploader        │
│  EnglishContext (新增 customThemes 状态)                      │
└─────────────┬───────────────────────────────────────────────┬┘
              │ ①主题 CRUD             │ ②每日生成请求
              ▼                        ▼
┌──────────────────────────────────────────────────────────────┐
│                    后端 (Express + SQLite)                    │
│                                                              │
│  新增:                                                       │
│  POST /api/theme/custom-add   创建自定义主题                   │
│  GET  /api/theme/list         获取全部主题(含自定义)            │
│  DELETE /api/theme/custom/:id 删除自定义主题                   │
│                                                              │
│  修改:                                                       │
│  POST /api/english/daily-extract  增加去重参数                  │
│                                                              │
│  新增表:                                                      │
│  custom_themes      自定义主题持久化                           │
│  generation_history 每日生成记录(用于去重)                      │
└─────────────┬────────────────────────────────────────────────┘
              │ ③文件上传 / 知识库检索 / LLM 合成
              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Dify 平台 (2个工作流)                       │
│                                                              │
│  工作流A: Custom Theme Extraction                            │
│  (复用现有 material/process-and-extract 的逻辑)               │
│                                                              │
│  工作流B: Enhanced Daily Extract (修改现有 English Mastery)   │
│  新增输入: history_exclude, user_flaws                       │
│  节点: 知识库检索 → LLM 融合生成 → 输出                       │
└──────────────────────────────────────────────────────────────┘
```

---

### 二、Dify 工作流设计

#### 2.1 工作流 A：自定义主题萃取工作流 (Custom Theme Extraction)

**用途**：用户上传商务材料后，自动解析并提取主题名称、核心关键词。

**复用基础**：现有 `POST /api/material/process-and-extract` 调用的 Dify 工作流（Key: `WORKFLOW_KEY = app-cArGQg7bAnePU0ts63FoHrAG`）。

**改造点**：
- 输入参数增加 `custom_theme_name`（用户输入的自定义主题名称）。
- 输出增加 `theme_name` 字段，由 AI 根据文档内容自动优化/确认主题名称。

| 节点 | 类型 | 说明 |
|------|------|------|
| 开始 | Start | 输入: `topic` (用户输入的主题名), `custom_theme_name` |
| 知识库检索 | Knowledge Retrieval | 从 `English_Pro_Scenarios` 检索上传文档的 top-10 片段 |
| LLM 萃取 | LLM | 见下方 Prompt |
| 代码解析 | Code | 将 LLM 输出解析为结构化 JSON |
| 结束 | End | 输出: `theme_name`, `extracted_words`, `key_phrases` |

**LLM Prompt**：
```text
你是一个商务英语教学场景萃取专家。用户上传了一份商务材料。

【用户拟定的主题名称】: {{custom_theme_name}}
【知识库检索到的文档片段】: {{knowledge_context}}

请完成以下任务：
1. 根据文档内容，优化/确认一个精确的主题名称（中英双语，如 "Tesla Q3 Earnings Call - 特斯拉Q3财报电话会议"）
2. 提取文档中最有价值的 15-20 个商务英语核心词汇（含英文、音标、中文释义）
3. 提取 5-8 个高频商务短语/表达

请以 JSON 格式输出：
{
  "theme_name": "...",
  "extracted_words": [{"word":"...", "ipa":"...", "meaning_zh":"..."}, ...],
  "key_phrases": ["...", ...]
}
```

**注意**：此工作流可以是现有 `material/process-and-extract` 工作流的增强版，复用同一个 API Key（`app-cArGQg7bAnePU0ts63FoHrAG`），只需在 Dify 后台添加 `custom_theme_name` 输入变量和上述 Prompt 逻辑。

---

#### 2.2 工作流 B：增强版每日长文与提纯工作流 (Enhanced Daily Extract)

**用途**：根据当前主题、用户上传的材料、历史去重信息和薄弱点，生成不重复的融合练习内容。

**基础**：现有 `POST /api/english/daily-extract` 调用的 Dify Chatflow（Key: `VITE_DIFY_ENGLISH_MASTERY_KEY = app-OShKY1EcVuLFkuxrpO28ZB0A`）。

| 节点 | 类型 | 说明 |
|------|------|------|
| 开始 | Start | 输入: `theme`, `cefr_level`, `genre`, **`history_exclude`**, **`user_flaws`** |
| 知识库检索 | Knowledge Retrieval | 从用户文档中检索与 `theme` 相关的 top-5 片段 (score ≥ 0.6) |
| 条件判断 | IF/ELSE | 如果 `history_exclude` 不为空，则进入「避重 Prompt」分支 |
| LLM 生成 - 避重 | LLM | 见下方 Prompt |
| LLM 生成 - 默认 | LLM | 当前现有的 Prompt |
| 词汇提取 | LLM | 从生成文章中提取新词汇/短语 |
| 结束 | End | 输出: `article`, `extracted_words`, `extracted_phrases` |

**避重 Prompt**：
```text
你是一个高阶商务英语教练。请根据以下输入生成一篇精听/阅读长文。

【当前主题】: {{theme}}
【难度等级】: {{cefr_level}}
【体裁】: {{genre}}

【用户已学词汇/主题 - 必须避免重复】: {{history_exclude}}
【用户薄弱点 - 需巧妙融入练习】: {{user_flaws}}

【知识库检索到的用户材料参考】: {{knowledge_context}}

要求：
1. 融合度：文章 50% 核心事实和术语基于【用户材料参考】，50% 场景扩展基于你的商务英语知识。
2. 避重性：绝对不能复用【已学词汇/主题】中列出的单词、短语或同义表达。必须围绕同一主题从全新角度切入。
3. 强化性：在文章中自然融入【用户薄弱点】涉及的发音难点词汇和语法结构（如虚拟语气、倒装句等），让用户在阅读中无痛复现。
4. 长度：300-500 词。
5. 输出纯英文文章，不要加任何 markdown 标题或解释。
```

**Dify 后台改造清单**：
1. 在「开始」节点添加两个新输入变量：
   - `history_exclude` (Text, 可选)
   - `user_flaws` (Text, 可选)
2. 在「知识库检索」节点后添加「条件判断」节点。
3. 新增一个「LLM 生成 - 避重」节点，使用上述 Prompt。
4. 保持原有的「LLM 生成 - 默认」节点不变（作为 fallback）。

---

### 三、后端改造方案

#### 3.1 新增数据库表

**文件位置**: `vocab-server/server.js` 初始化区块（约第 158 行 `personal_prototypes` 之后）

**表 1: `custom_themes`（自定义主题表）**
```sql
CREATE TABLE IF NOT EXISTS custom_themes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  theme_name TEXT NOT NULL,            -- 用户输入的主题名称
  display_name TEXT,                   -- AI 优化后的显示名称
  associated_file TEXT,                -- 原始上传文件名
  dify_document_id TEXT,               -- Dify 知识库文档 ID（用于后续检索过滤）
  dify_dataset_id TEXT,                -- Dify 知识库 ID
  extracted_keywords TEXT,             -- JSON 数组，AI 提取的关键词
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(user_id, theme_name)
);
```

**迁移策略**: 使用 `db.prepare(...).run()` 和 try-catch 包裹，确保对已有数据库安全。

**表 2: `generation_history`（每日生成历史表）**
```sql
CREATE TABLE IF NOT EXISTS generation_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  theme TEXT NOT NULL,                 -- 对应的主题名称
  generated_at INTEGER,               -- 生成时间戳
  article_summary TEXT,                -- 文章前 100 字符摘要
  keywords TEXT,                       -- JSON 数组，本次提取的关键词
  ttl_days INTEGER DEFAULT 3          -- 去重有效期（天），3天后自动过期
);
```

**用途**: 每次 AI 成功生成今日长文后，写入一条记录。下次请求时，查询当前主题最近 3 天的记录，拼接为 `history_exclude` 参数传给 Dify。

**索引建议**:
```sql
CREATE INDEX IF NOT EXISTS idx_gen_history_theme ON generation_history(user_id, theme, generated_at);
```

---

#### 3.2 新增 API 端点

**① `POST /api/theme/custom-add` — 创建自定义主题**

```javascript
// 请求体
{
  "themeName": "特斯拉Q3财报会议分析",   // 用户输入的主题名
  "file": {                              // 文件对象（base64 编码，复用 MaterialUploader 逻辑）
    "fileName": "tesla_earnings.pdf",
    "content": "base64EncodedContent..."
  },
  "userId": "default-user"
}

// 处理流程
// Step 1: 调用 Dify 知识库 API 上传文件 → 获取 documentId
// Step 2: 等待索引完成（轮询）
// Step 3: 调用 Dify 工作流 A 执行主题萃取 → 获取 theme_name, extracted_words
// Step 4: 将主题信息写入 custom_themes 表
// Step 5: 返回 { success: true, theme: { id, themeName, displayName, ... } }

// 响应
{
  "success": true,
  "theme": {
    "id": "uuid-xxxx",
    "themeName": "特斯拉Q3财报会议分析",
    "displayName": "Tesla Q3 Earnings Call - 特斯拉Q3财报电话会议",
    "associatedFile": "tesla_earnings.pdf",
    "extractedKeywords": ["gross margin", "deliveries", "regulatory credits", ...],
    "createdAt": 1717920000000
  }
}
```

**② `GET /api/theme/list` — 获取全部主题（含自定义）**

```javascript
// 查询参数: ?userId=default-user&stage=0-6

// 后端逻辑：
// 1. 查询 custom_themes 表中该用户的所有主题
// 2. 返回 { themes: [...自定义主题数组] }
// 注意：静态主题（BUSINESS_THEMES / GENERAL_THEMES）仍由前端持有，
//        此接口只返回自定义主题，前端负责合并。

// 响应
{
  "success": true,
  "themes": [
    {
      "id": "uuid-xxxx",
      "themeName": "特斯拉Q3财报会议分析",
      "displayName": "Tesla Q3 Earnings Call - 特斯拉Q3财报电话会议",
      "source": "custom",                    // "custom" | "system"
      "createdAt": 1717920000000
    }
  ]
}
```

**③ `DELETE /api/theme/custom/:id` — 删除自定义主题**

```javascript
// Step 1: 查询 custom_themes 获取 dify_document_id
// Step 2: 调用 Dify API 删除对应文档
// Step 3: 删除 custom_themes 表中的记录
// Step 4: 返回 { success: true }
```

---

#### 3.3 修改现有 API 端点

**`POST /api/english/daily-extract` — 增加去重与强化参数**

当前代码位置：`vocab-server/server.js` 第 1340 行附近。

**修改点**：
```javascript
// 在当前 Step 3 "调用 Dify 工作流" 之前，新增：

// Step 2.5: 构建去重上下文 (history_exclude) 与薄弱点 (user_flaws)
let historyExclude = '';
let userFlaws = '';

try {
  // 2.5a: 查询最近 3 天的生成历史关键词
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const historyRows = db.prepare(`
    SELECT keywords FROM generation_history 
    WHERE user_id = ? AND theme = ? AND generated_at > ?
    ORDER BY generated_at DESC
  `).all(userId, topic, cutoff);
  
  const allKeywords = [];
  for (const row of historyRows) {
    try {
      const kw = JSON.parse(row.keywords || '[]');
      allKeywords.push(...kw);
    } catch {}
  }
  historyExclude = [...new Set(allKeywords)].slice(0, 30).join(', ');
} catch (e) {
  console.warn('[Daily Extract] 构建去重上下文失败:', e.message);
}

try {
  // 2.5b: 获取用户最近的薄弱点
  const session = db.prepare(`
    SELECT extra_json FROM training_sessions 
    WHERE user_id = ? 
    ORDER BY training_date DESC LIMIT 1
  `).get(userId);
  
  if (session?.extra_json) {
    const extra = JSON.parse(session.extra_json);
    const ef = extra.englishFoundation || {};
    const flaws = [];
    if (ef.pronunciationNotes) flaws.push(`发音问题: ${ef.pronunciationNotes}`);
    if (ef.grammarNotes) flaws.push(`语法问题: ${ef.grammarNotes}`);
    userFlaws = flaws.join('; ');
  }
} catch (e) {
  console.warn('[Daily Extract] 构建薄弱点上下文失败:', e.message);
}

// 然后将 historyExclude 和 userFlaws 注入 Dify 请求的 inputs 中
// 修改原有的 inputs 对象：
// 原: inputs: { theme: topic || "General Business", cefr_level: cefrLevel, genre: genre }
// 新: inputs: { theme: topic || "General Business", cefr_level: cefrLevel, genre: genre, history_exclude: historyExclude, user_flaws: userFlaws }
```

**在 Step 3 成功返回后，新增写入历史记录**：
```javascript
// 在词汇成功入库后，追加：
try {
  const genId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO generation_history (id, user_id, theme, generated_at, article_summary, keywords)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    genId,
    userId,
    topic,
    Date.now(),
    (articleText || '').substring(0, 100),
    JSON.stringify(addedWords.map(w => w.word).slice(0, 15))
  );
} catch (e) {
  console.warn('[Daily Extract] 写入生成历史失败:', e.message);
}
```

---

### 四、前端 UI/UX 改造方案

#### 4.1 Theme Gateway 下拉框改造

**当前代码位置**: `src/components/modules/english/tabs/DashboardTab.tsx` 第 510-530 行附近。

**改造点**：

```
┌─────────────────────────────────────────────────────┐
│ 当前闭环主题 (Theme Gateway)                         │
│ ┌───────────────────────────────────┐ ┌───────────┐ │
│ │ 商务谈判：让步与施压        ▼    │ │ + 自定义   │ │
│ ├───────────────────────────────────┤ └───────────┘ │
│ │ 危机公关：外媒答疑                  │              │
│ │ 项目汇报：跨国董事会                │              │
│ │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│              │
│ │ 【自定义】Tesla Q3 Earnings Call  │              │
│ │ 【自定义】Apple Supplier Audit    │              │
│ └───────────────────────────────────┘              │
└─────────────────────────────────────────────────────┘
```

**代码改造方案**：
1. `EnglishContext.tsx` 中新增 `customThemes` 状态和 `refreshCustomThemes` 方法。
2. 修改 `getThemeOptions` 函数（或新增一个 hook），将静态主题与从 `/api/theme/list` 获取的自定义主题合并。
3. 下拉框中的系统预设主题与自定义主题之间用分隔线区分（使用 `<optgroup>` 或自定义下拉组件）。

**`EnglishContext.tsx` 新增内容**：
```typescript
// 新增类型
export interface CustomTheme {
  id: string;
  themeName: string;
  displayName: string;
  source: 'custom';
  createdAt: number;
}

// 新增状态
customThemes: CustomTheme[];
setCustomThemes: React.Dispatch<React.SetStateAction<CustomTheme[]>>;
refreshCustomThemes: () => Promise<void>;
```

#### 4.2 自定义主题创建模态框

**新组件**: `src/components/modules/english/tabs/CustomThemeModal.tsx`

**UI 设计**（三步骤向导）：

```
┌─────────────────────────────────────────────────┐
│  ✨ 创建自定义练习场景                           │
│  ─────────────────────────────────────────────  │
│                                                 │
│  Step 1: 场景命名                                │
│  ┌─────────────────────────────────────────────┐│
│  │ 输入场景名称，如"特斯拉Q3财报分析"...        ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Step 2: 上传学习材料                            │
│  ┌─────────────────────────────────────────────┐│
│  │  📎 点击或拖拽上传 PDF/Word/TXT/MD          ││
│  │  支持格式: .pdf .doc .docx .txt .md         ││
│  │  ─────────────────────────────────────      ││
│  │  tesla_earnings.pdf  ✓ 已选择               ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Step 3: AI 自动解析 & 确认                      │
│  ┌─────────────────────────────────────────────┐│
│  │  ⏳ 正在上传至 Dify 知识库...               ││
│  │  ⏳ 正在向量化索引...                       ││
│  │  ✅ AI 建议主题名: "Tesla Q3 Earnings Call  ││
│  │     - 特斯拉Q3财报电话会议"                 ││
│  │  ✅ 提取到 18 个核心词汇, 6 个高频短语      ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │    取  消     │  │  确认并激活此场景 →      │ │
│  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**交互流程**：
1. 用户输入主题名称 → 选择文件 → 点击"开始解析"。
2. 后端调用 `/api/theme/custom-add`，复用现有的 `MaterialUploader` → Dify 知识库上传 → 轮询索引 → 工作流萃取 逻辑。
3. 实时展示进度（SSE 或轮询状态）。
4. AI 返回优化后的主题名和关键词预览，用户确认后写入 `custom_themes` 表。
5. 自动将当前激活主题切换为新创建的自定义主题。

#### 4.3 多日停留状态指示器

**新增 UI 元素**: 在 Theme Gateway 旁边或通关状态指示器下方

```
┌─────────────────────────────────────────────────────┐
│ 当前闭环主题 (Theme Gateway)                         │
│ ┌───────────────────────────────┐ ┌───────────────┐ │
│ │ 商务谈判：让步与施压      ▼  │ │ 未达标 (强制) │ │
│ └───────────────────────────────┘ └───────────────┘ │
│ 当前通关进度：口语 7/10 | L3 最高分 6.5/8            │
│                                                     │
│ ┌─ 📊 闭环停留分析 ────────────────────────────┐    │
│ │ 🕐 已停留 3 天                                │    │
│ │ 📝 已生成 3 篇练习文章 (均不重复)              │    │
│ │ 📚 已学习 42 个生词 / 12 个短语               │    │
│ │ ⚠️ 薄弱点追踪: /θ/ 发音, 虚拟语气             │    │
│ │ 💡 今日建议: 重点练习让步状语从句 + /v/ vs /w/ │    │
│ └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**数据来源**: 前端在 Dashboard 挂载时调用一个新增的轻量级统计接口：
- `GET /api/theme/stay-stats?theme=xxx&userId=xxx`
- 返回: `{ stayDays, articleCount, wordCount, phraseCount, weakPoints, todaySuggestion }`

#### 4.4 MaterialUploader 改造

**改造点**：当前 `MaterialUploader` 仅用于"一键材料提纯"（提取词汇到生词本）。改造后需要支持两种模式：

1. **模式 A - 提纯模式**（现有功能）：提取词汇入库。
2. **模式 B - 自定义主题模式**（新增）：上传文件 + 创建自定义主题。

**实现方式**：
- 在 `MaterialUploader` 组件中新增 `mode` prop：`'extract' | 'create-theme'`。
- 当 `mode='create-theme'` 时，上传完成后调用 `/api/theme/custom-add` 而非 `/api/material/process-and-extract`。

---

### 五、检查清单与风险控制

| 关注点 | 措施 |
|--------|------|
| **旧版兼容** | 所有新增表和字段使用 `IF NOT EXISTS` + try-catch，不对现有表结构做破坏性变更 |
| **Dify 配额** | 每个自定义主题上传时清理 `English_Pro_Scenarios` 知识库的旧文档已由现有逻辑覆盖；考虑未来改用按标签过滤（`doc_metadata.theme`）而非清库 |
| **去重精度** | `history_exclude` 最长 30 个关键词，通过 Prompt 约束而非代码约束，效果取决于 LLM 遵守度 |
| **前端缓存** | 自定义主题列表在创建/删除后自动刷新，通过 `vocab-updated` 事件触发器通知 |
| **错误处理** | Dify 上传/检索失败时，系统降级为纯 AI 生成模式（不使用知识库上下文），确保用户不会白屏 |

---

### 六、测试验证计划

| 功能 | 测试用例 | 预期结果 |
|------|----------|----------|
| 创建自定义主题 | 输入"苹果Q4财报"，上传 apple_q4.pdf | 主题出现在下拉框【自定义】分组，可切换到该主题 |
| 去重推送 | 在同一主题下连续3天点击"AI 生成" | 3天生成的文章关键词无重复，主题相同但角度不同 |
| 薄弱点强化 | 在 pronunciationNotes 中记录 `/θ/ 发音` 后生成文章 | 生成文章中自然包含含 /θ/ 的词汇（如 think, through） |
| 知识库融合 | 上传的 PDF 包含 "gross margin 42%" | 生成文章中引用 "gross margin" 并围绕此数据展开 |

---

