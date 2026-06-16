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

### 1.4 系统解锁登录模块 (LoginPage)
*   **业务需求**：为系统提供一道安全锁屏界面，防止未经授权的访问，在初次访问时强制进行密钥校验，并支持在系统后台动态修改系统解锁密码并自动保存。
*   **实现方法**：前端 `LoginPage.tsx` 响应用户输入的密钥，并与本地 `localStorage` 中的密码进行比对；若校验成功，则回调主应用的 `onUnlock` 解锁系统。
*   **工作流/API信息**：
    *   解锁密码存储：本地 `localStorage.getItem('super_agent_lock_password')`，默认缺省密码为 `'1'`。
    *   校验失败动作：触发 `playError()` 错误音效，输入框抖动 500ms 并清空密码输入。
*   **具体实现逻辑**：
    1.  **自适应聚焦与进入动效**：系统挂载时自动聚焦（`autoFocus`）密码输入框。背景采用高清壁纸（`login-bg.jpg`），配以 `framer-motion` 的 1.05x 至 1.0x 倍率淡入缩放（`scale`）及高斯模糊渐退动效，叠加上层科幻风格网格背景（`grid mesh`），实现高级的视觉过渡。
    2.  **密码碰撞与校验**：用户提交时，从本地 `localStorage` 读取密码比对：
        *   若一致：触发 `playSuccess()` 行政翻页音效，调用 `onUnlock()` 解锁系统，登录页面淡出。
        *   若不一致：触发 `playError()` 温柔低频和弦音效，密码输入框开启 500ms `isShaking` CSS 左右摆动抖动，弹出“系统秘钥验证未通过，请重试”气泡，并自动重置输入和重新聚焦。
    3.  **自适应视效**：登录框容器采用高强度毛玻璃滤镜（`backdrop-blur-xl`）与边框微光外发光效果，以保障暗光商务环境下的视觉体验。

### 1.5 全局背景自定义与图层控制模块 (BackgroundOverlay & GlobalSettingsPanel)
*   **业务需求**：提供沉浸式高管视觉定制服务，支持 8 套预设的高保真商务/自然场景背景大图切换，并支持背景显示开关、模糊度深度调节、掩层透明度微调，适配全天候高强度眼部抗疲劳要求。
*   **实现方法**：前端 `BackgroundOverlay.tsx` 从 `localStorage` 读取背景配置，监听全局事件并利用 `framer-motion` 执行平滑切图；用户在 `GlobalSettingsPanel.tsx` 进行可视化滑块调节与持久化写入。
*   **工作流/API信息**：
    *   全局事件总线：`global-settings-changed`。
    *   配置项存储：
        *   背景开关：`super_agent_bg_enabled` (默认为 `true`)
        *   当前背景索引：`super_agent_bg_index` (范围 0-7, 对应 bg-1 至 bg-8)
        *   高斯模糊值：`super_agent_bg_blur` (范围 0-24px, 默认 10px)
        *   掩层透明度：`super_agent_bg_opacity` (范围 10%-90%, 默认 45%)
*   **具体实现逻辑**：
    1.  **事件驱动联动**：`BackgroundOverlay` 组件挂载时，监听 `window` 的 `global-settings-changed` 事件。一旦全局控制台有任何滑块变动，背景层实时响应刷新。
    2.  **平滑交叉淡入淡出**：切图时采用 `framer-motion` 的 `AnimatePresence` 配合 `popLayout` 模式，以 0.6 秒的 `easeInOut` 曲线淡入新背景，避免闪烁。
    3.  **高精磨砂玻璃图层**：在图片层之上覆盖一个自适应 `backdrop-filter: blur()` 层，并通过带有 rgba 的颜色图层（`rgba(248, 249, 250, opacity)`）将背景色与系统主色调（Zinc 灰白）无缝融合，确保前台文字易读性。

### 1.6 侧边栏与每日习惯追踪系统 (Sidebar & Habit Tracker)
*   **业务需求**：在系统主侧边栏内嵌高管习惯打卡矩阵与日历视图，促进高管形成“深读、破局说、文治写、强体魄、修品德”的日常心智反射，并支持打卡记录的月度视图回溯。
*   **实现方法**：前端 `Sidebar.tsx` 读取本地状态 `habits`，通过 `motion` 进行按压与悬停交互反馈；提供月度打卡日历进行状态跟踪。
*   **工作流/API信息**：
    *   习惯打卡项：`read` (深度阅读)、`speak` (破局口语)、`write` (文治立言)、`exercise` (核心运动)、`goodDeed` (日行一善)。
    *   交互音效：点击打卡或翻页时触发 `playPageTurn()` 行政级翻页声，保证按压质感。
*   **具体实现逻辑**：
    1.  **三维立体打卡动效**：每个打卡卡片均装配 `motion.label`，在悬停时触发微缩放 `scale: 1.02` 及 Y 轴上浮 `translateY: -2`，按压时触发收缩反馈 `scale: 0.98`，使用全局弹簧动效 `GLOBAL_SPRING`（damping: 30, stiffness: 250）。
    2.  **打卡状态状态机**：打卡状态通过新颖的渐变背景色及边框高亮（已激活：橙色渐变 `from-white to-orange-50/20` 与橙色边框；未激活：锌色渐变 `from-white to-zinc-50/50` 与灰色边框）进行鲜明区隔。
    3.  **日历视图翻阅**：日历视图支持月份切换，翻页时触发 `playPageTurn()` 纸张音效，打卡成功激活粒子效果，提供沉浸式反馈。

### 1.7 全局动效与音效底座 (Confetti & Motion/Sound Foundation)
*   **业务需求**：为高强度高管心理训练提供舒缓且具成就感的全局视听反馈底座，避免廉价游戏音效，采用高质感“行政级水滴声”、“真实纸张翻页声”及“和弦提示音”，并在达成高分挑战时进行优雅的撒花庆祝。
*   **实现方法**：`soundEffects.ts` 基于 Web Audio API 自主合成声学波形；`Confetti.tsx` 整合 `canvas-confetti` 与 `framer-motion` 实现高管挑战达成视觉反馈。
*   **工作流/API信息**：
    *   `playClick` / `playSwitch` / `playReveal` / `playScan` 对应 **极致水滴声** (`playWaterDrop`)。
    *   `playSuccess` / `playSuccessCyber` / `playUpload` / `playPageTurn` 对应 **沙沙翻页声** (`playPageTurn`)。
    *   `playError` / `playErrorCyber` / `playHeartbeat` / `playGentleWarning` 对应 **和弦提示音** (`playGentleWarning`)。
*   **具体实现逻辑**：
    1.  **Web Audio 声学合成器**：
        *   **极致水滴声**：使用正弦波 (`sine`)，在 0.035 秒内将频率从 650Hz 指数拉升至 1150Hz，音量最大设为 0.012，并在 0.07 秒内指数衰减至 0.0001，使尾音温润柔和。
        *   **沙沙翻页声**：使用随机白噪声缓冲（`Math.random() * 2 - 1`），通过 `bandpass` 带通滤波器（中心频率从 600Hz 降至 180Hz），音量在 0.025s 内升至 0.01 并在 0.18s 内指数衰退，真实还原物理纸张质感。
        *   **和弦提示音**：使用双路正弦波，同时激发 329.63Hz (E4) 与 415.30Hz (G#4) 两个音轨，在 0.05 秒内淡入，0.4 秒内指数级淡出，创造温柔而不刺耳的警示感。
    2.  **行政级撒花反馈**：在口语或写作评分达标（>=8分）时，触发 `Confetti` 组件。组件在 300ms 延迟（确保进入动效完成）后向 60° 和 120° 两个方向发射两波优雅彩带（选用锌灰色与主色调橙色混合 `#71717A`、`#FF5722` 等），并伴随翻页声。顶部平滑滑出“✓ 挑战达成 (Challenge Completed)”胶囊通知。

### 1.8 提纯任务中心 (GlobalTaskCenter)
*   **业务需求**：提供一个全局的浮动任务管理器，展示用户发起的长文档解析、网页数据提取、以及视频音频转录等后台异步任务的处理进度与详细执行日志，并支持一键导入和物理下载。
*   **实现方法**：前端使用 `GlobalTaskCenter.tsx` 和 `TaskContext.tsx` 构建状态订阅机制。当后台转写完成，通过 CustomEvent 广播通知给上传模块进行一键提纯。
*   **工作流/API信息**：
    *   全局任务状态：通过 `useTask()` 挂载，管理 `tasks` 数组，每个任务包含 `id`、`type` ('video' | 'url')、`name`、`status` ('pending' | 'running' | 'completed' | 'failed')、`progress`、`logs` 和 `result` 等。
    *   广播通信事件：`import-virtual-material` (发送 `{ name, content, mimeType }` 载荷)。
*   **具体实现逻辑**：
    1.  **全局单体抽屉**：抽屉挂载于 `AppContent` 顶层，使用灰色背景头和高斯模糊遮罩（`backdrop-blur-sm`）。点击遮罩或右上角 X 即时收起。
    2.  **异步进度轮询与状态机渲染**：针对不同状态渲染不同视效：排队中（灰色进度条及 Loader2 转圈）、处理中（橙色进度条及实时百分比数值）、已就绪（绿色 Check 徽标）和失败（红色报错详情卡片）。
    3.  **日志终端回显**：内置折叠的模拟终端控制台。用户展开时可调取 `logs` 数组内容并渲染成黑底绿字单行滚屏文本，还原真实的底层执行链路。
    4.  **跨模块一键提纯联动**：任务就绪后，点击“导入并提纯”，抛出自定义事件 `import-virtual-material`。监听该事件的 `MaterialUploader` 捕获后，立即将转录出的文本重组为虚拟 `.txt` 文件并载入预览区，同时自动触发 Step 3 提纯流程，无缝闭环了“视频转写 ➔ 文本导入 ➔ Dify 提纯 ➔ SQLite 生词库”的长程链路。
    5.  **本地物理下载**：支持点击“下载”将转写的 Markdown 文本利用 `Blob` 及 `URL.createObjectURL` 转化为物理文件下载至本地。

### 1.9 控制论锁定拦截弹窗 (CyberneticLockModal)
*   **业务需求**：当用户在当前主题的目标指标未达成时（如口语交流不足10轮或纵深写作得分低于8分），拦截其他高级探索性沙盘模块，引导用户优先闭环主线目标。
*   **实现方法**：利用 `App.tsx` 计算的 `isLocked` 全局状态。如果为 `true` 且用户试图点击非英语引擎模块，则拦截并自动重定向回英语引擎，同时拉起 `CyberneticLockModal.tsx` 进行阻断提示。
*   **工作流/API信息**：
    *   硬锁定状态判断：`isLocked = isInterceptorEnabled && !masteryData._isInitial && (masteryData.oralCount < 10 || masteryData.maxWriteScore < 8)`。
    *   提示音效：当拦截弹窗唤醒时，自动播放 `playGentleWarning()` 和弦警示音。
*   **具体实现逻辑**：
    1.  **全局状态拦截路由**：一旦 `isLocked` 激活且 `activeModule !== 'english'`，`App.tsx` 会硬性将 `activeModule` 重定向回 `english`，确保流量无法外溢。
    2.  **优雅浮层过渡**：使用 `framer-motion` 的 `AnimatePresence` 处理弹窗的挂载与卸载。遮罩层执行简单的淡入淡出，内容卡片从 y=15px 位置伴随弹簧物理动效（`type: 'spring', damping: 24, stiffness: 200`）微弹滑入，消除生硬感。
    3.  **多指标进度盘点**：在弹窗中央以 Zinc 灰色卡片形式列出“当前主题阵地”与双维度达成度：
        *   口语沙盘：显示已进行轮数（如 3 / 10 轮），配合绿色（达标）或灰色（未达标）标签。
        *   纵深写作：显示最高得分（如 6 / 8 分），配合状态徽标。
    4.  **返回主题战场**：用户点击“返回主题战场”或遮罩层关闭弹窗，继续返回英语主线进行未尽的目标攻坚。


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
*   **业务需求**：针对本地文档、外部网页及音视频三种不同载体进行一键解构，提取核心专业术语和政商务搭配，持久化并自动存入生词库，构建统一的知识库提取中心。
*   **实现方法**：前端 `MaterialUploader.tsx` 提供 File、URL、Video 三合一选项卡交互，结合 Dify 后台向量化接口及 Node 本地代理上传接口。
*   **工作流/API信息**：
    *   本地文档提纯接口：`processMaterialsAndExtract`（调用 Dify 提纯 Workflow）。
    *   网页提取接口：`/api/materials/fetch-url`（解析干净的网页 Body 并返还）。
    *   视频转写接口：直接上传 `/api/materials/upload-direct`，分片上传 `/api/materials/upload-chunk`，合并分片 `/api/materials/merge-chunks`，发起转写 `/api/materials/fetch-video`。
*   **具体实现逻辑**：
    1.  **本地文档直接提纯**：用户拖入 PDF / Word / TXT / MD 后，前端通过 `FileReader` 载入文本预览；若为二进制大文件，则调用 `processMaterialsAndExtract`。后台执行清空知识库、上传、向量化分块、Dify 提取及 SQLite 去重保存。
    2.  **网页提取过滤**：用户在“网页提取”选项卡中粘贴链接，调用后端解析 Body。提取到的干净文本在前端封装成虚拟 `.txt` 文件放入材料区，用户点击“开始上传并提纯”即可走与本地文件相同的向量提纯路径。
    3.  **视频双轨制分片上传与转写**：
        *   **大小判别**：视频文件拖入后，若文件大小小于 30MB，进行直接单次上传。
        *   **分片切片上传**：若大于 30MB，前端按 `5MB` 尺寸将视频 Blob 切片，生成唯一 `uploadId`，按顺序分片上传。单片上传附带 3 次断线重试机制。
        *   **服务端合并与转录**：全部分片上传成功后，调用 `/api/materials/merge-chunks` 合并。合并成功后，服务端调用 Dify 转录引擎生成异步转写任务，并在前端 `TaskContext` 注册进度追踪，移交给“提纯任务中心”。

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
*   **业务需求**：打破单纯行政润色局限，以“商业价值转化”和“政治站位”为核心，提供公文三段式批阅、商务压缩以及提案高阶改造服务。
*   **实现方法**：前端 `WriteModule.tsx` / `WriteTab.tsx` 响应用户输入或“对标分析”事件，调用 `difyAPI.ts` 暴露的 `runEnglishWriteReview`。
*   **工作流/API信息**：
    *   API 路径：`POST /v1/workflows/run`
    *   Dify 密钥：环境变量 `VITE_DIFY_WRITE_GOVERNANCE_KEY` 与 `VITE_DIFY_WRITE_API_KEY`
*   **具体实现逻辑**：
    1.  **五大训练维度切换**：支持“体制内公文写作”、“高阶商务与提案”、“字数极限挑战”、“个人品牌与提炼”、“随笔与思辨闭环” 5 大核心实战方向。
    2.  **对标优秀文本与找差**：支持输入或一键导入 (.txt) 标杆文本。分析时将草稿与优秀文本的行文逻辑、政治站位和语气分寸进行全方位对比。
    3.  **大模型任务生成**：可实时调用 AI 任务生成引擎产生针对当前主题（如地缘政治、商务谈判）的刁钻模拟公文/信函任务，引导高管针对性答辩。
    4.  **字数挑战微调**：对“字数极限挑战”模式，可选压缩至 50/100/200 字或论点充分展开，智能研判高管表达的精炼度和核心提炼力。
    5.  **控制论闭环锁定拦截**：若 L3 级别得分低于 8 分，系统强制触发红线锁定逻辑：锁定当前模块输入，限制其他模块跳转。用户必须根据右侧面板提供的修改意见手动修改，或点击“一键采纳”AI 范文进行一键覆盖，方可解锁限制。
    6.  **动态复盘双因子链**：审阅完成后，自动从反馈 of L2/L3 中剥离出“今日核心问题（Key Issues）”与“明日提升重点（Next Steps）”，存入本地缓存，以实现每日学习的闭环追踪。

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
