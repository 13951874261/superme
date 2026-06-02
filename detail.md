# 高管能力特训数字沙盘 - 全景详细设计方案

## 1. 辅助与支撑模块 (Sidebar Auxiliary Modules)

### 1.1 即时答疑舱 (ChatModule)
*   **业务需求**：在系统侧边栏常驻，为用户在主工作区（进行政策阅读、英语听力等高强度训练）时，提供轻量级的多模型即时问答服务，允许对突发语境、特定黑话或概念进行快速追问，确保心流不被打断。
*   **实现方法**：前端 `ChatModule` 组件基于 React 管理状态，通过 `src/services/difyAPI.ts` 封装的 `sendOralChatMessage(query, conversationId, userId)` 向 Node 服务/Dify API 发送请求。
*   **工作流/API信息**：
    *   API 路径：`POST /v1/chat-messages` (接入 Dify Chat 聊天应用)
    *   底层 API 地址：`${import.meta.env.VITE_DIFY_API_BASE_URL}/chat-messages`
    *   鉴权密钥：环境变量 `VITE_DIFY_ORAL_API_KEY`
*   **具体实现逻辑**：
    1.  用户在侧栏输入框输入文本，前端捕获输入并携带 `conversation_id`（若已存在）以及 `user` 标识。
    2.  请求使用 `blocking` 阻塞响应模式，接收 Dify 引擎计算完成的完整回复，并动态追加至前端消息流列表。
    3.  侧栏自动滚动探底，实现沉浸式即时追问。

### 1.2 智能词典聚合 (DictionaryPanel)
*   **业务需求**：支持“现代汉语词典”、“英英商务词典”、“英汉双向译制”三种模式，专治商务俚语、职场黑话及潜台词穿透。
*   **实现方法**：前端 `DictionaryPanel.tsx` 响应用户输入或“划线取词”事件，通过 `vocabAPI.ts` 的 `queryDictionary` 向后端发起查询。
*   **工作流/API信息**：
    *   前端请求路径：`POST /api/dify/dict-query`
    *   后端承接机制：在 `vocab-server/server.js` 中当前为**仿真存根路由**，返回 `{ mocked: true }`；在生产环境中映射至对应的 Dify 工作流 `dict_tool_workflow.yml`。
    *   映射 Dify 密钥：由配置文件或代理层中的 `DIFY_DICT_TOOL_API_KEY` 或 `VITE_DIFY_ENRICH_API_KEY` 鉴权。
*   **具体实现逻辑**：
    1.  前端传入参数 `{ word, dictType, direction: 'auto', locale: 'zh-CN' }`。
    2.  后端代理层转发请求至 Dify 工作流，进行深度词源和跨文化职场弦外之音的剖析。
    3.  前端捕获返回的结构化 JSON `payload`。
    4.  根据所选词典类型，在 UI 中将释义字段（词条、词性、核心译义、商务语境、易混词、职场弦外之音）渲染为多签页（Tabs）卡片。
    5.  提供“收录生词本”动作按钮，一键触发本地 SQLite 存储。

### 1.3 艾宾浩斯生词本 (VocabularyBook)
*   **业务需求**：全自动接管用户查询记录或从各沙盘中一键截获的硬核词汇，根据艾宾浩斯记忆曲线算法动态编排复习天数，确保词汇和用法彻底进入长期记忆。
*   **实现方法**：前后端分离，前端组件 `VocabularyBook` 频繁与本地部署的 Node.js + SQLite 服务交互。
*   **工作流/API信息**：
    *   SQLite 数据库表：`vocabulary`
    *   数据表结构：`id (TEXT)`, `word (TEXT)`, `dict_type (TEXT)`, `category (TEXT)`, `payload (TEXT, 存储 JSON 字符串)`, `added_at (INTEGER)`, `repetitions (INTEGER)`, `ease_factor (REAL)`, `interval_days (INTEGER)`, `next_review_date (INTEGER)`, `review_history (TEXT, 存储 JSON 数组)`。
    *   核心 API 接口：
        *   获取今日复习任务：`GET /api/vocab/review`
        *   插入新词条：`POST /api/vocab/add`
        *   回调批量存入：`POST /api/vocab/batch-add`
        *   复习打卡提交：`PUT /api/vocab/review/:id`
        *   人工干预频率：`PUT /api/vocab/manual-intervention/:id`
*   **具体实现逻辑**：
    1.  **艾宾浩斯/SM-2 算法实现**：新词入库时，初始化 `repetitions = 0`，`ease_factor = 2.5`，`interval_days = 0`。
    2.  当用户进行打卡复习时，选择掌握质量 `quality`（0-5分）。
    3.  若 `quality >= 3`（记住/轻松），`repetitions` 递增，间隔天数按 `interval * ease_factor` 递增；若 `quality < 3`（朦胧/完全忘记），则 `repetitions` 重置为 0，`interval_days` 回归 1。
    4.  重新计算 `ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))`，其最低红线限制为 1.3。
    5.  利用当前时间戳 + `interval_days * 86400000` 刷新 `next_review_date` 字段，实现精准的算法过滤调度。


## 2. 英语引擎核心工作流模块 (English Mastery & Evaluation Engines)

### 2.1 听辨比对与潜台词解析引擎 (Listening Comparison Engine)
*   **业务需求**：跨国高管盲听高难度商务或政务音频，手写听写草稿。系统进行精细的文本比对，标记出连读、弱读等个人发音及听音盲区，并深度解读标准文本中的政治隐喻、职场权力潜台词。
*   **实现方法**：前端 `ListenModule.tsx` / `ListenTab.tsx` 调用 `listeningAPI.ts` 中的 `runListeningEngine` 方法提交数据。
*   **工作流/API信息**：
    *   API 路径：`POST /v1/workflows/run`
    *   Dify 密钥：环境变量 `VITE_DIFY_LISTEN_API_KEY`
*   **具体实现逻辑**：
    1.  前端将用户填写的草稿 `user_input`、标准文本 `standard_text` 及当前的业务场景主题 `theme` 打包传入。
    2.  Dify 工作流执行差异比对并进行深度潜台词剖析，强约束输出 JSON。
    3.  前端拆解返回的 JSON 结构体，分别输出听写精准度百分比、错误词溯源（在文本中高亮标红差异）以及潜台词因果链解析卡片。

### 2.2 多角色跨文化口语沙盘 (Oral Sandbox)
*   **业务需求**：提供仿真银团贷款、危机公关等 5 大高压对抗谈判阵地，由 AI 同时扮演多方对手和助攻，测试并训练用户的高级口语反击与心理防线。
*   **实现方法**：前端 `OralWarRoom.tsx` 通过 `src/services/difyAPI.ts` 封装的 `sendOralChatMessage` 保持连续对话。
*   **工作流/API信息**：
    *   API 路径：`POST /v1/chat-messages` (接入 Dify Chatflow 模式)
    *   Dify 密钥：环境变量 `VITE_DIFY_ORAL_API_KEY`
*   **具体实现逻辑**：
    1.  **开场白与指令注入**：首轮发言自动追加隐式指令（例如 `[系统隐性指令：切换场景 scene-1]`）以及选定的难度模式（如 `standard` 或 `hardcore` 极限施压）。
    2.  **角色多重演绎**：Dify 智能体在单个会话中根据上下文切换不同说话者（如 CEO 盟友或 CFO 阻碍者），并通过返回的 JSON 明确区分 `current_speaker` 与 `dialogue`。
    3.  **多维度实时解析**：每次 AI 回复还会自动附加 `hidden_intent`（隐藏意图分析）、`flaw_point`（发现的用户的口语表达破绽）与 `feedback_strategy`（谈判策略改进意见）。
    4.  **长按发送与倒计时熔断**：前端支持 Web Speech API 的 SpeechRecognition 录音，当开启 10 秒倒计时，若耗尽则自动截断语音识别文本并发送，强迫用户脱口反击。

### 2.3 三段式公文批阅引擎 (Writing Review)
*   **业务需求**：针对英文邮件、公文起草进行三级纵深诊断：基础合规、中层逻辑/语气妥帖性、顶层战略站位与政治敏感性。
*   **实现方法**：前端调用 `difyAPI.ts` 暴露的 `runEnglishWriteReview`。
*   **工作流/API信息**：
    *   API 路径：`POST /v1/workflows/run`
    *   Dify 密钥：环境变量 `VITE_DIFY_WRITE_API_KEY`
*   **具体实现逻辑**：
    1.  前端收集用户的原始撰写文本 `userText` 和希望达到的核心意图描述 `mailIntent`。
    2.  Dify 工作流进行三层过滤重构，并产出高维度的重写范本。
    3.  前端渲染三级折叠诊断面板，高亮展示战略性漏洞并提供优化方案。

### 2.4 政商务物料词汇提纯闭环流水线 (Material Purify Pipeline)
*   **业务需求**：针对用户上传的商业研报、会议记录等长文档，进行自动的分块向量化存储。一方面供知识检索使用，另一方面由 AI 深度提炼其中的高阶词汇和核心搭配，自动汇入本地生词本。
*   **实现方法**：前端触发物理上传，后端 Node.js `server.js` 统一接管 `/api/material/process-and-extract`。
*   **工作流/API信息**：
    *   **双密钥隔离机制**：使用 `DATASET_KEY` 鉴权知识库增删改，使用 `WORKFLOW_KEY` 启动提纯大模型。
*   **具体实现逻辑**：
    1.  **物理清场**：查询 English_Pro_Scenarios 知识库，遍历并彻底删除上一轮导入的文件，实现空间隔离。
    2.  **高精度分块入库**：将新文件流通过 Base64 解密为 Buffer 形式，注入 `create_by_file` API，参数强制设为 `hierarchical_model`（父子层级切分模型：父块 max_tokens 1000 确保因果完整，子块 max_tokens 200 保证检索精确度）。
    3.  **高频向量进度探测**：后端以每 3 秒一次的频次轮询 `indexing-status` 状态，最多持续 120 秒。一旦状态变更为 `completed` 即放行。
    4.  **无缝数据暗桩落库**：放行后自动触发提纯 Workflow，抓取输出的 `extracted_words` 术语集，在 Node 端通过 SQLite 事务批量且去重写入 `vocabulary` 生词表，不经过前端而直接固化底层数据。

### 2.5 商务造句与即兴演讲评测 (Sentence & Speech Eval)
*   **业务需求**：结合造句与即兴演讲进行实战评测。造句强调单词在复杂长难句中的商务语法规范性；演讲则侧重于宏观的逻辑防守和表达流畅度。
*   **实现方法**：调用 `difyAPI.ts` 暴露的 `runSpeechPrompter` 与 `runEnhancedSpeechEvaluation`。
*   **工作流/API信息**：
    *   大纲与思维导图生成密钥：`VITE_DIFY_SPEECH_PROMPTER_API_KEY`
    *   音频评测引擎密钥：`VITE_DIFY_SPEECH_EVAL_API_KEY`
    *   商务造句密钥：`VITE_DIFY_SENTENCE_API_KEY`
*   **具体实现逻辑**：
    1.  **造句评测**：前端收集 `targetWord` 与 `userSentence` 送入 Dify 工作流，研判单词语用是否妥帖。
    2.  **演讲大纲与思维导图**：提供演讲主题及难度（基础/中等/进阶），通过 `runSpeechPrompter` 生成结构化提纲、黄金表达短语和思维导图节点（`mindmap`）。
    3.  **多维音频评估**：用户长按麦克风进行即兴演说，录音生成 WebM 音频文件。前端调用 `runEnhancedSpeechEvaluation`，直接上传音频数据并附带 `theme` 与 `duration_minutes`。
    4.  Dify 进行语音切分与大模型分析，反馈多维打分（逻辑、词汇、流利度、相关性、结构）及口音与表达语速诊断（`audio_features`）。

### 2.6 发音纠正与声学诊断引擎 (Pronunciation Assessment Engine)
*   **业务需求**：针对特定词句，提供音标级纠音服务。不仅判断对错，还要定位丢音、多音或元音错位的具体声学问题，并给出舌位改善方案。
*   **实现方法**：前端基于 Web Audio 录音后，通过 `difyAPI.ts` 进行两阶段调用：
    1. 调用 `audioToText`（语音转文字，鉴权：`VITE_DIFY_STT_API_KEY`）获取识别结果 `recognizedText`。
    2. 前端请求后端 `/api/pronunciation-assessment` 代理服务，将目标文本与识别文本进行精细化评估。
*   **工作流/API信息**：
    *   后端代理路径：`POST /api/pronunciation-assessment`
    *   后端鉴权密钥：由环境变量 `DIFY_PRONUNCIATION_API_KEY`（或前端兼容的 `VITE_PRONUNCIATION_API_KEY`）注入。
*   **具体实现逻辑**：
    1.  后端接收前端传递的 `{ targetText, recognizedText }`。
    2.  向 Dify 工作流发送请求，工作流对目标和识别文本进行差分算法解析。
    3.  提取出结构化结果，包括发音准确度评分 `score`、目标词音标 `phonetic`、发音问题类型 `issue_type`（如重音偏移、不发音、丢音等）以及改善建议 `suggestion`。
    4.  数据返回前端，渲染为音学漏洞定位雷达。

### 2.7 每日即时唤醒舱 (Daily Wakeup Routine)
*   **业务需求**：每日清晨首次登录时，根据用户当前关注的商务方向，生成一份快速听力、核心句式与今日热点的“咖啡级”轻量级唤醒训练。
*   **实现方法**：调用 `difyAPI.ts` 中的 `runEnglishWakeupRoutine`。
*   **工作流/API信息**：
    *   Dify 密钥：环境变量 `VITE_DIFY_WAKEUP_API_KEY`。
*   **具体实现逻辑**：
    1.  前端获取当前的主题参数（如“华尔街财报”、“中东地缘政治”），作为 `theme` 传入。
    2.  Dify 文本生成工作流产出今日重点词汇、配套发音音频链接以及一句商业格言。
    3.  在系统首页以悬浮卡片形态动态渲染，完成每日开机的心智激活。


## 3. 核心沙盘战力训练模块 (Core Leadership Sandbox Modules)

### 3.1 洞察 ｜ 人性解码与破绽识别沙盘 (Insight / Listen Module)
*   **业务需求**：聚焦于截获的日常/政商场景对话，剖析字面意思之下的权力站位、利益诉求与弦外之音。用户进行文字侧写记录，系统评估其侧写洞察深度。
*   **实现方法**：前端 `ListenModule.tsx` 调用 `fetchDynamicInsightScenario` 动态出题，用户答题后调用 `fetchInsightFeedback` 获取导师解析。
*   **工作流/API信息**：
    *   动态出题接口：使用 `VITE_DIFY_INSIGHT_GEN_KEY`（指向 Dify 文本生成应用）。
    *   反馈评估接口：使用 `VITE_DIFY_INSIGHT_LISTEN_KEY`（指向 Dify 工作流应用）。
*   **具体实现逻辑**：
    1.  **出题机制**：前端挂载或用户切换“体制内/外企/通用逻辑”分类时，触发 `fetchDynamicInsightScenario(category)`。Dify 自动实时生成该类别下的对话文本。
    2.  **侧写作答**：用户在“您的侧写笔记”文本框输入对对话细节的敏感分析与潜台词研判。
    3.  **多维侧写矩阵**：点击“提交审判”后，工作流执行深度推演，返回 Markdown 渲染的导师多维判语，指出用户错失的微表情、权力陷阱和动机破绽。

### 3.2 说服 ｜ 高阶影响力与精准提问 (Speak / Speak Module)
*   **业务需求**：针对商务施压、即兴反击和结构化说服场景，要求用户起草应对策略，重构话术，将弱势立场扭转为主导者。
*   **实现方法**：前端 `SpeakModule.tsx` 收集多维上下文，调用 `runSpeakInfluenceEngine` 执行评估。
*   **工作流/API信息**：
    *   API 路径：`POST /v1/workflows/run`
    *   Dify 密钥：环境变量 `VITE_DIFY_SPEAK_INFLUENCE_KEY`
*   **具体实现逻辑**：
    1.  **参数化上下文**：用户选择训练模式（“结构化表达”、“精准提问”、“即兴反击”），输入设定沟通场景、你的身份、受众身份以及原始话术。
    2.  **高维策略推演**：工作流分析原始话术并输出 `SpeakInfluenceResult`：
        *   `score`：分寸与逻辑战力打分（0-100）。
        *   `critique`：破绽与失分点（Critique）。
        *   `framework_analysis`：高维策略重构（将失误重构为战术框架）。
        *   `revised_version`：满分实战话术（Golden Script）。
    3.  **高能声光电拦截提示**：
        *   若用户未填满参数直接提交，触发悬浮声光电 Toast。
        *   **声**：Web Audio API 合成激光警报音效。
        *   **光**：外发光渐变彩虹色边框 (`bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500`)。
        *   **电**：闪烁的金色闪电图标（`lucide-react` 的 `Zap` 动画跳跃）。

### 3.3 解构 ｜ 认知穿透与因果降维 (Read / Read Module)
*   **业务需求**：深度解析行业政策、财务报表、外企邮件或长篇书籍，对复杂文本进行剥离，揭示背后的本质意图和因果关系。
*   **实现方法**：前端 `ReadModule.tsx` 将体裁映射至对应分析管道，调用 `runCognitivePenetrationEngine`。
*   **工作流/API信息**：
    *   API 路径：`POST /v1/workflows/run`
    *   Dify 密钥：环境变量 `VITE_DIFY_READ_PENETRATION_KEY`
*   **具体实现逻辑**：
    1.  **多场景分支结构**：
        *   **Policy (政策精神)**：拆解出表面结论、隐藏意图、行业影响、险与机。
        *   **Report (财报研判)**：剥离商业模式、市场痛点、盈逻辑漏洞、溯源话术。
        *   **Email (外企邮件)**：提炼出剥离逻辑、立场反转、反制追问。
        *   **Book (书目提纯)**：解构思想精粹、逻辑偏颇、职场变现点。
    2.  **音效与动态震抖 (声与电)**：如果接口响应异常或接口超时，触发 `playError()` 音频特效，同时前端页面进行 CSS 级 `shake` 剧烈抖动与悬浮报错气泡弹出。

### 3.4 立言 ｜ 决策文治与价值提炼 (Write / Write Module)
*   **业务需求**：打破单纯的行政润色局限，以“商业价值转化”和“政治站位”为核心，提供公文三段式批阅、商务压缩以及提案高阶改造服务。
*   **实现方法**：前端 `WriteModule.tsx` 调用 `fetch` 接口向工作流引擎发起请求。
*   **工作流/API信息**：
    *   API 路径：`POST /v1/workflows/run`
    *   Dify 密钥：环境变量 `VITE_DIFY_WRITE_GOVERNANCE_KEY`
*   **具体实现逻辑**：
    1.  **配置分析模式**：支持“三级纵深批阅”（排版格式合规、逻辑连贯性、高管战略站位）、“商务行文与压缩”（语体分寸与极限压缩）、“业务提案与包装”（诊断行政局限，提炼核心商业价值，生成高阶业务提案范本）。
    2.  **赛博朋克深空扫描遮罩 (声、光、电)**：
        *   执行时，系统锁定全屏，弹出赛博朋克高能分析控制台。
        *   **光**：顶部边缘有橙色/玫瑰红脉冲激光光条（`@keyframes scanline`）在卡片上不停扫射移位。
        *   **声**：Web Audio API 以 800ms 的间隔，循环发出低频电信号滴答声 (`scan`)。
        *   **电**：正中央的心电图波形（`lucide-react` 的 `Activity`）进行高频脉冲跳动，终端不断打字输出动态分析状态。

### 3.5 驭心 ｜ 高管层博弈系统 (Game Theory / GameTheoryModule)
*   **业务需求**：用户面临体制内政治博弈或权力重组挑战，选择博弈模型，装配目标对手的人性弱点档案，系统推演多步因果链并打分。若分析出高危险性，将对手人性原型归入 SQLite 数据库。
*   **实现方法**：前端 `GameTheoryModule.tsx` 通过 Node.js 代理发起 `/api/game-theory/analyze`。对手档案的增删改查则通过专有 SQLite 交互端点实现。
*   **工作流/API信息**：
    *   博弈分析密钥：`VITE_DIFY_GAME_THEORY_KEY`
    *   本地数据库表：`personal_prototypes`（存储人性弱点、动机死穴与归档原型的对应关系）
*   **具体实现逻辑**：
    1.  **人性档案装配**：用户通过本地数据库组件录入或加载特定利益相关人特征（如：姓名、行为风格、致命弱点、核心动机）。
    2.  **博弈场景融合**：选择博弈模型（囚徒困境、智猪博弈、信息不对称、冷酷触发）后，前端将人性原型文本动态编入 `case_text`，作为上下文提交。
    3.  **多级因果传导链**：大模型进行 10 重长程因果传导推演，输出评分与攻防判定。
    4.  **自动死穴捕获**：若分析产出的 JSON 中含有新生成的 `prototype_archive` 结构体，后端将自动提取其内容并使用 `upsert` 方法无缝存入本地 SQLite 中，形成用户专属的“死穴情报库”。

### 3.6 娱乐 ｜ 高阶审美与阶层软实力 (Aesthetics / EntertainmentModule)
*   **业务需求**：面向高管社交，提供敬酒分寸、茶礼、雪茄品鉴、艺术拍卖等实景社交博弈推演，研判用户的社交站位、话语策略与阶层分寸。
*   **实现方法**：前端 `EntertainmentModule.tsx` 调用 difyAPI 中的 Dify 后端服务。
*   **工作流/API信息**：
    *   Dify 密钥：环境变量 `VITE_DIFY_HIGH_AESTHETICS_KEY`
*   **具体实现逻辑**：
    1.  **70/30 赛博分屏交互**：左侧 70% 宽幅渲染极具视觉质感的多维度实景场景选项及应答台，右侧 30% 渲染雷达脉冲扫描仪。
    2.  **多波声学合成反馈**：请求过程中，Web Audio API 生成包含低频电波扫描（200Hz - 600Hz 频率斜坡上升）、终点钟琴三和弦（双音高重叠）等极其丰富的高阶科技感音效。
    3.  **激光电场扫射动效**：当大模型评估用户在餐桌、茶道中的站位失职时，屏幕周圈爆发出红色多重脉冲电波。

### 3.7 深渊 ｜ 潜意识树洞与进化中枢 (WeeklyChatModule)
*   **业务需求**：为高管提供绝对私密的压力宣泄与认知重组空间。宣泄内心的权力欲望、工作倦怠或阴暗情绪，系统提供下周题库与生词的动态进化调整方案。
*   **实现方法**：前端 `WeeklyChatModule.tsx` 提供加密宣泄空间，利用静态神经网络演化存根模拟心智进化路径。
*   **具体实现逻辑**：
    1.  用户在此输入本周遭遇的暗算或情绪状态，系统模拟“端到端全链路加密”，提供绝对的安全感。
    2.  系统模拟“神经突触演化分析”或“下周题库调优预案”，动态告知用户下周生词本和阅读材料的主动偏向（如：当检测到用户展现防御性妥协时，进化中枢会在下周自动注入更具侵略性与进攻色彩的 20 个高管动词），提供高度拟真化的“大脑同谋”心智机制。
