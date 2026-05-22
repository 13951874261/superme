# 高管能力特训数字沙盘 - 详细设计方案

## 1. 左侧栏目模块 (Sidebar)

### 1.1 即时答疑舱 (ChatModule)
*   **业务需求**：在左侧工作区提供轻量级的多模型即时问答服务，供用户在主工作区（如阅读、听力训练）遇到突发问题时进行快捷追问。
*   **实现方法**：前端 `ChatModule` 组件通过 `src/services/difyAPI.ts` 中的 `sendOralChatMessage(query, conversationId, userId)` 方法发起交互。
*   **工作流/API信息**：
    *   API 路径：`POST /v1/chat-messages` (基于 Dify 内置 Chat 应用)
    *   鉴权密钥：由环境变量 `VITE_DIFY_ORAL_API_KEY` 提供。
*   **具体实现逻辑**：前端组装用户 `query` 并带上当前会话的 `conversation_id` 发送请求至 Dify，采用 `blocking` 模式获取解答，并渲染在侧边栏聊天气泡中，保证了学习时的心流不被打断。

### 1.2 智能词典聚合 (DictionaryPanel)
*   **业务需求**：提供现代汉语、英英商务、英汉双向等深度的词典查阅服务，主要处理具有商业黑话或潜台词的高阶词汇。
*   **实现方法**：前端发起工作流请求，对应 Dify 的 `dict_tool_workflow.yml` 模板。
*   **工作流/API信息**：
    *   API 路径：`POST /v1/workflows/run`
    *   鉴权密钥：通常使用 `DIFY_DICT_TOOL_API_KEY` 环境注入。
*   **具体实现逻辑**：
    1.  传入 `inputs: { word, dict_type, direction, user_context, locale }`。
    2.  Dify 大模型工作流产出结果后，前端解析返回的 JSON `result`，提取出 `type` 与对应的 `payload` 结构体。
    3.  根据不同字典类型在 UI 渲染发音、商业注解、例句。
    4.  查阅完成后，提供“一键存入生词本”入口。

### 1.3 艾宾浩斯生词本 (VocabularyBook)
*   **业务需求**：自动接管用户主动查询或从各类语料中一键截获的生词，基于记忆曲线进行推送，确保生词被彻底内化。
*   **实现方法**：前后端分离，前端通过轮询或主动触发请求本地独立部署的 `vocab-server` 服务（基于 Node.js 与 better-sqlite3）。
*   **工作流/API信息**：
    *   底层数据库路径：`vocab-server/vocab.db`。
    *   核心通讯接口：
        *   获取今日复习任务：`GET /api/vocab/review`
        *   插入新词条：`POST /api/vocab/add`（或经由 `batch-add` 批量导入）。
        *   打卡与算法干预：`PUT /api/vocab/review/:id`
*   **具体实现逻辑**：
    1.  当新词入库时，初始化记忆参数，如 `ease_factor` (2.5) 与 `interval_days` (0)。
    2.  用户对弹出的复习卡片进行评价（`quality`：忘记到牢记的评级）。
    3.  服务端利用内部的 SM-2 函数重新计算 `ease_factor` 的增减与下一次的 `interval` 天数，随后刷新数据库中的 `next_review_date`，形成闭环记忆推送系统。

## 2. 英语引擎核心工作流模块 (English Engines)

### 2.1 听辨比对与潜台词解析引擎 (Listening Comparison Engine)
*   **业务需求**：跨国高管盲听音频并手写草稿后，系统比对草稿与标准文本的差异，指出连读弱读等听写盲区，并深度剖析标准文本背后的权力博弈、潜台词与职场黑话。
*   **实现方法**：前端组件 `ListenModule.tsx` 调用 `listeningAPI.ts` 暴露的 `runListeningEngine` 触发。
*   **工作流/API信息**：
    *   DSL 对应：`Listening_Comparison_Engine (1).yml`
    *   鉴权密钥：`VITE_DIFY_LISTEN_API_KEY`
*   **具体实现逻辑**：
    1.  前端将 `{ user_input, standard_text, theme }` 提交给 Dify 工作流。
    2.  Dify LLM 节点执行分析，严格输出 JSON 格式的 `result` 字符串。
    3.  前端将结果拦截并解析为结构体，分别渲染到“听写准确率与错误溯源（Comparison）”模块和“表面含义、潜台词、权力动态（Subtext）”模块。

### 2.2 多角色跨文化口语沙盘 (Oral Sandbox)
*   **业务需求**：建立模拟真实环境的虚拟谈判室，由 AI 扮演对立阵营（如借款方与牵头行），训练用户的口语应对与抗压逻辑。
*   **实现方法**：通过 Node.js 后端代理通信，调用 `difyAPI.ts` -> `/api/english/oral-sandbox`。
*   **具体实现逻辑**：
    1.  采用 Dify 的 Chatflow（对话型）模式，首轮输入包含角色配置、商业场景与文化背景参数。
    2.  交互过程中，系统不仅生成对话回复（`dialogue`），还将在后台并发进行逻辑破绽侦测（`flaw_analysis`）和隐秘意图判定（`hidden_intent`）。
    3.  每次对话携带固定的 `conversationId` 确保连续记忆流不断裂。

### 2.3 三段式公文批阅引擎 (Writing Review)
*   **业务需求**：用户起草英文邮件指令，AI 执行高管级的三维批改：底层语法是否正确、中层商业语气是否妥帖、顶层战略定位是否失格。
*   **实现方法**：调用 `difyAPI.ts` 中的 `runEnglishWriteReview`。
*   **工作流/API信息**：依赖密钥 `VITE_DIFY_WRITE_API_KEY`。
*   **具体实现逻辑**：
    1.  前端将用户填写的 `userText`（草稿）与 `mailIntent`（行文意图）下发至工作流。
    2.  工作流执行完毕后返回 `optimized_version`，并给出 `L1_Grammar`、`L2_Business_Tone`、`L3_Strategic_Position` 的三维降维诊断。

### 2.4 政商务物料词汇提纯闭环流水线 (Material Purify Pipeline)
*   **业务需求**：全自动处理长篇研报或会议录音，不仅用于检索，还要主动从长文中榨取高阶核心词汇供生词本使用。
*   **实现方法**：后端 `server.js` 中的高复杂度复合路由 `/api/material/process-and-extract`。
*   **具体实现逻辑（双密钥隔离设计）**：
    1.  **物理清场**：通过 `DATASET_KEY` 访问 Dify，寻找对应知识库（如 English_Pro_Scenarios），无情清空旧文档，避免交叉污染。
    2.  **强制重铸与装填**：将 Base64 文件发送入库，带有严格的层级分块（`hierarchical`）切割参数。
    3.  **高频状态轮询**：通过 `indexing-status` 接口高频探测向量化进度，成功后放行（超时则熔断）。
    4.  **核心抽取与暗桩入库**：调用 `WORKFLOW_KEY` 执行提纯，提取出的 `extractedWords` 将跳过前端，被直接插入 SQLite `vocabulary` 库，完成物理到数据的极速闭环。

### 2.5 商务造句与即兴演讲评测 (Sentence & Speech Eval)
*   **业务需求**：强制输出导向的训练，分别评估微观的长难句把控（造句）和宏观的逻辑阵地防守（即兴演讲）。
*   **实现方法**：调用 `runEnglishSentenceEvaluation` 与 `runImpromptuSpeechEvaluation`。
*   **工作流/API信息**：密钥分别为 `VITE_DIFY_SENTENCE_API_KEY` 与 `VITE_DIFY_SPEECH_EVAL_API_KEY`。
*   **具体实现逻辑**：
    1.  **微观造句**：比对 `targetWord`、`userSentence` 与 `theme`，输出是否达标的布尔值及修订方案。
    2.  **宏观演讲**：通过语音转文本（STT）拿到 `transcript`，发往评测工作流，进行四维雷达图（逻辑、词汇、流利、相关度）精准打分与深度反馈。
