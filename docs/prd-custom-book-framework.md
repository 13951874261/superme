# PRD：自定义上传大部头书籍并解析理论框架

**版本**：V1.3
**日期**：2026-09-05
**状态**：已确认需求基线；当前发布范围为文本型 PDF、EPUB、MOBI、AZW3、TXT，扫描型 PDF 暂缓
**目标用户**：个人深度学习者
**产品范围**：听读、自定义知识库、表达训练
**MVP 原则**：支持 PDF、EPUB、MOBI、AZW3、TXT；保留可验证原始内容为证据事实源；正式多用户鉴权；最小学习闭环。

## 生产轻量发布范围（`BOOK_MVP_PROFILE=light`）

- 仅支持文本型 PDF、小型 EPUB、由 Calibre 转换的非 DRM MOBI/AZW3、TXT；扫描型 PDF 在 `BOOK_OCR_ENABLED=false` 下明确返回 `OCR_UNAVAILABLE`。
- 文件上限：PDF/EPUB/MOBI/AZW3 各 8 MiB，TXT 4 MiB；EPUB 或转换产物展开总量 24 MiB、单项 8 MiB、最多 1,000 项；正文展开后最多 2,000,000 字符。
- Calibre 转换最长 30 秒，转换 EPUB 最多 24 MiB。资源不足立即返回 HTTP 503、`RESOURCE_BUSY`、`retryable=true` 和“服务器繁忙，请稍后重试”，不进入长等待或自动重试。
- 上限依据：当前生产机总内存 3,565,101,056 字节（约 3.3 GiB）、可用内存约 2.09 GiB、Swap 已用约 1.76 GiB；已有真实校准仅证明 47.2 MiB EPUB 可解析时 RSS 峰值约 70 MiB、49 MiB TXT RSS 峰值约 303 MiB，但缺少完整人工质量批准及服务器冷热矩阵。因此轻量上限采用显著更保守值，不宣称“大部头已支持”。
- 未设置或设置为 `full` 时保留原有格式上限、60 秒重任务等待和 Swap < 512 MiB 硬 Gate。

---

## 1. Executive Summary

### Problem Statement

听读板块现有理论框架数量有限、内容固定，难以满足用户在心理学、逻辑学、表达、认知与决策等领域的个性化深度学习需求。

项目已有 PDF 提纯、Dify Workflow、知识抽屉、脑图、TTS 和表达训练能力，但当前链路仅适合短材料：

- PDF 通过 Base64 JSON 上传，内存开销高。
- 理论提取只处理前 6000 字。
- 缺少逐页来源、章节化解析、版本管理和断点恢复。
- 用户身份依赖客户端提交的 `userId`，无法保护私人书籍。
- Dify 共享 Dataset 存在跨用户污染风险。

### Proposed Solution

将现有“短 PDF 材料提纯”升级为私有、章节化、可恢复的大部头书籍学习流水线：

```text
可信身份认证
→ multipart 书籍上传
→ 格式、DRM、加密与资源预检
├─ 文本型 PDF：pdf-parse 逐页提取
├─ 扫描型 PDF：Umi-OCR 逐页识别 → Chat Completions 严格校对
├─ EPUB：直接解析目录、spine 与章节 XHTML
├─ MOBI/AZW3：Calibre 转为 EPUB → EPUB 解析
└─ TXT：编码识别 → 标题/章节切分
→ 章节识别与用户确认
→ Dify 逐章理论提取
→ 全书理论归并
→ 生成证据化理论树
→ 用户编辑并确认
→ 单节点听读
→ 一分钟复述/概念解释
```

MVP 复用：

- React、Vite、Express、SQLite。
- `multer`、`pdf-parse`。
- Dify Workflow。
- `knowledge_vault`、知识图谱和修订记录。
- D3 脑图。
- TTS、录音与表达复盘。
- 现有任务中心 UI。

MVP 新增：

- [Umi-OCR](https://github.com/hiroi-sora/Umi-OCR)：扫描型 PDF 逐页 OCR。
- 后端 OpenAI 兼容 `Chat Completions`：严格校正错别字、标点、断行和分段。
- OCR 原文、校对文本、差异记录与 PDF 页序映射。

MVP 不使用：

- Dify Dataset。
- Unstructured、MinerU。
- Redis、Neo4j、对象存储。
- 第二套前端。

### Success Criteria

#### 产品质量

1. 所有非结构节点均可追溯到直接证据或明确的来源节点集合。
2. 不出现伪造页码、伪造引文等严重幻觉。
3. 已完成章节结果在服务重启后不丢失。
4. 用户只能访问本人的书籍、任务、节点、证据和音频。
5. 删除请求生效后，书籍立即退出检索和生成功能。
6. 用户能够完成最小闭环：上传一本书 → 确认章节 → 获得理论树 → 检查证据 → 修订并确认 → 听读一个节点 → 完成一次表达练习。

#### 校准指标

使用 3–5 本合法样本建立基线，再冻结正式阈值：

- 证据有效率。
- 核心节点覆盖率。
- 严重幻觉数。
- 章节边界准确率。
- 首本书闭环完成率。
- 框架确认后听读或表达练习启动率。
- 首本书用户次周留存率：首次完成框架确认后的第 7–13 天内，再次完成至少一次节点听读或表达练习的用户占比。
- 单书解析成本。
- 峰值内存。
- 派生数据体积。
- 全书处理时长。

不得在基线压测前承诺固定的 50MB、500 页或处理时限。

---

## 2. User Experience & Functionality

### User Personas

#### 主要用户：个人深度学习者

- 拥有本人合法获取的专业书籍。
- 希望理解全书理论体系，而非只获得摘要。
- 关心概念之间的层级与论证关系。
- 希望检查 AI 结论对应的原文依据。
- 希望通过听读、复述和解释实现知识内化。
- 上传内容仅用于本人学习，不要求公开传播。

### User Stories

#### Story 1：可信登录

**As a** 用户，**I want to** 通过可信会话访问系统，**so that** 私人书籍不会被其他用户读取。

**Acceptance Criteria**

- 后端签发或验证不可伪造的会话凭据。
- API 从服务端认证上下文获取用户身份。
- 客户端提交的 `userId` 不参与资源归属判断。
- 会话支持到期、退出和撤销。
- 未认证请求返回 `401`。
- 访问其他用户资源返回统一授权错误，不泄露资源是否存在。
- 管理员访问私人书籍必须具备独立权限和审计记录。
- 未完成可信鉴权前，不得开放书籍上传。

#### Story 2：上传 PDF 或电子书

**As a** 用户，**I want to** 上传 PDF、EPUB、MOBI、AZW3 或 TXT，**so that** 系统可以创建私人书籍解析任务。

**Acceptance Criteria**

- MVP 仅接受 `PDF`、`EPUB`、`MOBI`、`AZW3`、`TXT`。
- 使用 `multipart/form-data` 流式上传和落盘。
- 禁止使用 Base64 JSON 传输整本书籍。
- 同时校验扩展名、MIME、文件签名或可识别容器结构；不得只信任文件名。
- PDF 分流为文本提取或逐页 OCR；EPUB 直接解析目录、spine 与章节 XHTML；MOBI/AZW3 使用 Calibre 转为 EPUB 后进入同一解析链；TXT 先识别编码，再按标题规则形成章节候选。
- MOBI/AZW3 转换必须在受限子进程中执行；输入、临时输出及最终 EPUB 均受体积和超时限制。
- 拒绝 DRM、加密、损坏、格式伪装及超过资源门槛的文件；不提供 DRM 解密或绕过。
- 文件路径由服务端生成，禁止直接使用原文件名拼接存储路径。
- 上传前显示私有使用与第三方 AI 处理提示。
- 用户必须确认拥有合法使用权。
- 校验成功后，必须先以同一数据库事务持久化书籍记录和解析任务，再返回成功。
- 接口立即返回 `bookId`、`jobId` 和任务初始状态；不得等待正文提取、格式转换、OCR 或理论提取完成。
- 前端收到成功响应后显示“上传成功，3 秒后进入任务中心”，展示 `3 → 2 → 1` 文本倒计时，并提供“立即查看任务”按钮。
- 倒计时从成功响应到达前端时开始，不从用户选择文件或上传开始时计算。
- 3 秒结束后自动进入任务中心，并通过 `jobId` 定位和高亮本次任务；任务中心从后端重新读取状态，不依赖上传页内存状态。
- 用户点击“立即查看任务”时取消倒计时并立即进入；组件卸载、重复点击或路由变化不得产生二次跳转。
- 自动跳转失败时保留成功提示、`jobId` 和“进入任务中心”按钮；不得重新上传或重复创建任务。
- 上传失败、格式预检失败或任务持久化失败时不启动倒计时、不跳转任务中心，并显示可操作的错误原因。
- `POST /api/books` 创建新书；同一用户上传相同文件哈希时返回已有书籍及其任务状态，不重复建书。不同哈希永远创建新书，不按标题或文件名自动归并；用户仅通过“上传新版”入口调用 revision API 将新文件绑定为既有书籍的新版本。
- 仅在用户明确选择“重新解析”后，为指定 `bookRevisionId` 创建新解析任务。
- 不跨用户共享文件或解析产物。

#### Story 3：解析扫描型 PDF

**As a** 用户，**I want to** 上传扫描型 PDF，**so that** 系统可以将页面图像识别为可用于学习的文本。

**Acceptance Criteria**

- 文本提取不足时，自动切换至同机 Docker 部署的 Umi-OCR。
- Umi-OCR 使用 Linux 无头模式，通过仅限本机访问的 HTTP API 调用。
- OCR 按 PDF 页序处理；任何一页结果都必须保留对应 PDF 页序。
- 保存不可变 OCR 原文、严格校对文本、逐项差异和处理版本。
- OCR 原文是扫描型 PDF 的证据事实源；校对文本仅用于章节识别和理论提取。
- LLM 仅允许修复明确错别字、标点、断行与段落，不得润色措辞、总结、扩写、删减事实、改变术语、数字、原意或主旨。
- 校对输出未通过内容约束时，保留 OCR 原文并将该页标记为待人工检查。
- 单页失败允许重试；不得因个别空白页导致全书失败。
- Umi-OCR 不可用时显示明确错误，不得跳过 OCR 后生成伪完整框架。

#### Story 4：拒绝不支持的书籍

**As a** 用户，**I want to** 获得明确的不支持提示，**so that** 不会等待无法完成的任务。

**Acceptance Criteria**

MVP 检测并拒绝：

- DRM、加密、密码保护、损坏或格式伪装的文件。
- 页数、页面尺寸、对象结构、压缩比、解压体积或容器文件数异常的文件。
- 超过解析时间、存储、内存或成本限制的文件。
- OCR 后仍无足够可识别内容的 PDF。
- 内容主要依赖暂时无法可靠还原的复杂公式、表格、手写体或图示的 PDF。
- EPUB 中的脚本、远程资源和危险链接不得执行或加载。
- MOBI/AZW3 转换失败或输出超过限制时停止处理并清理临时文件。
- TXT 编码无法可靠识别或解码错误率超过冻结门槛时要求用户重新选择编码或更换文件。

拒绝时显示明确原因，不调用后续理论提取 Workflow，临时文件按生命周期策略删除。

MVP 正式验收语言为简体中文和常规中英混排。繁体、纯英文、竖排和复杂多语言文档为实验性能力，不计入成功率。

#### Story 5：上传后进入任务中心并查看进度

显示文件校验、格式转换、逐页文本提取/OCR、章节识别、等待章节确认、章节理论提取、全书理论归并、框架质量检查、等待框架确认。

同时显示当前阶段、总章节数、已完成章节数、失败章节数、队列状态、错误原因、重试或用户处理入口。

**Acceptance Criteria**

- 上传成功 3 秒后自动进入任务中心；“立即查看任务”允许跳过等待。
- 跳转目标携带 `jobId`，任务中心自动定位并高亮本次任务；若任务已快速失败或完成，仍展示其真实最终状态。
- 任务中心直接请求 `GET /api/books/:bookId/jobs/:jobId` 精确读取本次任务；无 `jobId` 深链时才使用 `GET /api/books/:bookId/jobs/current`。找不到目标任务时显示明确错误及返回书籍列表入口。
- 浏览器刷新、前进后退或重新打开任务中心不重复创建任务。
- 倒计时和跳转提示支持屏幕阅读器；页面隐藏时仍以成功响应时间计算，恢复后若已满 3 秒则立即跳转。
- MVP 不展示精确剩余处理时间；3 秒仅代表进入任务中心的等待时间，不代表解析时长。
- 页面刷新后任务仍可查看。
- 服务重启后任务记录保留。
- 已完成步骤不得重复执行。
- lease 过期的运行任务可恢复为待执行状态。
- 单章节失败不删除其他章节结果。

#### Story 6：确认章节

- PDF 优先读取书签或目录，并以页序定位；EPUB/MOBI/AZW3 优先读取 TOC、spine 与资源路径；TXT 根据标题规则、行号和字符区间生成章节候选。
- 无可靠目录时，依据标题与文本特征生成候选，并按格式中立的来源位置区间切分，标记为“自动分段”。
- 每个章节保存标题、层级、顺序及起止来源定位：PDF 使用页序，EPUB/MOBI/AZW3 使用资源路径与章节内字符区间，TXT 使用行号与字符区间。
- 用户可在理论提取前修改章节标题和边界。
- 用户确认章节后才启动理论提取。
- 确认后的章节边界不可原地修改。
- 后续修改必须创建新的章节与框架版本。

#### Story 7：生成理论树草稿

- 每章独立提取，再执行全书归并。
- 不得只处理全书前 6000 字。
- 根节点固定为书籍。
- 内容层级允许 1–5 层，不强制制造固定三级结构。
- 优先忠实于原书章节与论证结构。
- MVP 节点类型：`topic`、`concept`、`claim`、`method`、`example`。
- MVP 正式关系仅为 `parent_of`。
- 对比、依赖、支持、反驳只作为关联建议。
- 理论树默认为草稿，不得自动同步到正式知识抽屉。
- 同时提供 D3 脑图和等价树形列表。

#### Story 8：查看节点证据

节点来源类型：

- `source_claim`：作者直接表达，必须绑定原文证据。
- `system_synthesis`：系统跨片段归纳，必须关联至少两个来源节点。
- `structural`：组织节点，不参与证据有效率。
- `user_added`：用户补充，不计入 AI 准确率。

节点详情显示来源类型、所属章节、来源位置、最小必要原文摘录、来源节点集合、置信等级、AI 提取版本。来源位置按格式展示：PDF 为第 N 页；EPUB/MOBI/AZW3 为章节名、资源路径与章节内位置；TXT 为行号和字符区间。不得为非 PDF 内容伪造页码。

置信等级：

- `high`：直接证据明确支持。
- `medium`：需要跨片段归纳。
- `low`：存在歧义，必须人工核验。

不展示未经校准的小数概率。

#### Story 9：编辑并确认框架

用户可以修改节点标题和说明、移动节点、合并重复节点、删除错误节点、新增用户节点、标记证据无效。

版本规则：

- 用户新增节点标记为 `user_added`。
- 删除全部有效来源后，节点退回待核验状态。
- 已确认框架保存为不可变快照。
- 确认后的修改产生新框架版本。
- 重解析产生新草稿，不覆盖旧框架或用户编辑。
- 用户明确选择采用新版或保留旧版。
- 已确认节点同步至现有 `knowledge_vault`。

#### Story 10：在听读模块学习书籍理论节点

**As a** 用户，**I want to** 在听读模块浏览书籍理论树并播放单个节点，**so that** 我能沿着框架理解和复习原书理论。

**入口与浏览**

- 听读是书籍上传和学习主入口；复用现有 `ListenModule` 页面壳、理论卡片/脑图双视图、D3 缩放折叠能力和资料抽屉入口，不新增第二套听读页面。
- 听读首页区分“内置理论”和“我的书籍”；用户选择书籍后默认打开其当前已确认框架。
- 理论树根节点为书名；节点显示名称、类型、所属章节、置信等级和听读状态。
- 卡片树与脑图必须展示相同节点集合；节点选择、展开状态和当前书籍在两种视图切换时保持一致。
- 未确认框架只允许预览和编辑，不允许生成正式听读内容；框架未完成时显示任务状态和“进入任务中心”。

**节点详情与文字稿**

- 选择节点后显示定义、最小必要原书依据、通俗解释、一个自测问题及“查看证据”。
- 仅已确认节点可生成正式听读文字稿；请求必须绑定 `bookId`、`frameworkRevisionId` 和 `nodeId`。
- 文字稿按“节点标题 → 理论定义 → 原书依据 → 通俗解释 → 自测问题”固定结构生成，不生成大段连续原文，不生成整书替代内容。
- `source_claim` 必须引用有效证据；`system_synthesis` 必须列出来源节点；`low` 置信节点在用户确认前不得生成听读。
- 文字稿始终可见，可在无音频时独立阅读；证据入口必须返回同一框架版本对应内容。

**TTS 与播放**

- 仅在用户点击播放或“生成音频”后调用 TTS；打开节点、浏览脑图、确认框架均不得自动调用。
- 复用现有 `/api/tts/speech`、音色/倍速、文本哈希缓存、同步/异步分流、分句预取和浏览器 `speechSynthesis` 降级。
- TTS 输入使用已保存文字稿，不直接朗读整章原文；单次最多 20,000 字符，超限必须拒绝或按句分段，不得静默截断造成内容缺失。
- 长 TTS 进入全局任务队列并与 OCR、Calibre、PDF 解析、本地 Whisper 互斥；队列锁定时显示“等待生成”，不得并发启动本地子进程。
- 播放支持播放、暂停、继续、停止、进度显示、倍速和音色；切换节点时停止旧音频，避免多音轨叠加。
- 远端 TTS 失败时允许一次受控重试；本地降级仍失败时保留文字稿并显示明确错误。任务已返回失败时立即停止轮询，不得继续轮询至超时。

**版本、缓存与删除**

- 保存文字稿/音频对应的节点 ID、框架版本、文本哈希、音色、语速、模型、生成状态和创建时间。
- 相同文字稿哈希、音色和语速可复用有效缓存；框架节点更新后不得误用旧缓存。
- 节点更新后，旧听读标记“基于历史版本”，允许回看但不得显示为当前版本。
- 删除书籍时同步禁用播放并进入音频删除清单；音频文件不得通过可猜测的永久公开 URL 暴露。

**Acceptance Criteria**

- 用户可从“我的书籍”进入已确认理论树，在卡片树和脑图间切换，并打开任一节点证据。
- 点击已确认节点的播放按钮后生成或复用音频；重复点击不会创建重复 TTS 任务。
- 页面刷新后仍能恢复当前书籍、框架版本、节点文字稿和有效音频状态。
- 节点未确认、证据无效、任务排队、TTS 失败、历史版本和书籍删除状态均有明确且可操作提示。
- 听读全过程支持键盘；播放器具有可访问名称、可见焦点和文本状态。

#### Story 11：基于理论节点进行表达练习

**As a** 用户，**I want to** 从已确认理论节点发起一分钟复述或概念解释，**so that** 我能检验自己是否真正理解并能清楚表达该理论。

**入口与题型**

- 表达是听读理论节点的下游复用入口；可从听读节点点击“去表达”，也可在现有 `SpeakModule` 的“理论训练”区选择书籍和节点，不新增顶级模块。
- MVP 仅提供 `one_minute_retell`（一分钟复述）与 `concept_explanation`（概念解释），不混入现有四类通用表达题型。
- 仅已确认且证据有效的节点可发起训练；请求必须绑定 `bookId`、`frameworkRevisionId`、`frameworkNodeId` 和 `trainingMode`，不得使用“最近五条知识”替代指定节点。
- 一分钟复述提示用户在 60 秒内、不照读原文地复述定义、关键机制和结论；概念解释提示用户在 60 秒内用通俗语言解释概念并给出一个例子。
- 题目只展示必要提示和节点标题；用户可主动查看证据，但查看后在结果中标记“训练中查看过资料”。

**录音与转写**

- 复用现有 `SpeakModule`、倒计时、任务中心、`/api/audio/transcriptions` 与本地 Whisper；录音实现优先复用现有 MIME 探测、权限处理、自动停止和资源释放能力。
- 录音上限固定 60 秒，允许提前停止；无有效音频、麦克风拒绝、格式不支持或转写为空时不得提交评分。
- 保存 `rawTranscript` 和 `polishedTranscript`；理论准确性、覆盖度及事实错误必须基于未被 LLM 改写的 `rawTranscript` 评分，润色文本仅用于可读展示。
- 本地 Whisper 与其他重任务共用全局信号量；繁忙时任务排队并显示状态，不得静默失败。
- 允许用户在提交评分前检查并修正明显转写错误；修改后同时保留原始转写、修订文本和“用户已修订”标记。

**评价契约**

- 一分钟复述返回：理论准确性、关键信息覆盖率、结构完整性、表达清晰度、时长控制。
- 概念解释返回：定义准确性、核心机制、例子质量、边界/反例、通俗清晰度。
- 每个维度由后端返回真实结构化分数、证据和改进建议；禁止前端从总分拆出伪分项，禁止展示静态伪评分。
- 理论准确性只评价内容，不受口音、音色或语速影响；表达流畅度不得改变理论准确性得分。
- 反馈必须指出遗漏、误用或新增的错误主张，并链接到指定节点的有效证据；无法由证据支持的批评不得作为事实错误。
- 结果包括总评、维度评分、遗漏/误用列表、推荐表达结构和一版示范回答；示范回答不得大段复制原书。

**持久化、历史与回链**

- 评估完成后复用 `training_sessions`、`training_attempts` 与知识使用轨迹，不新增平行训练历史系统。
- Phase 0 必须先修复 `training_sessions` 的用户隔离：唯一键改为 `user_id + training_date`，所有 upsert 和查询必须同时包含 `user_id`。
- 每次尝试保存题型、节点 ID、框架版本、原始/修订转写、录音时长、评价 JSON、任务 ID、是否查看资料和创建时间。
- 知识轨迹只记录本次指定节点，绑定 `attemptId` 和 `sessionId`；不得把自动注入的其他节点全部标记为已训练。
- 结果页提供“查看节点证据”“重新练习”“返回听读”；框架更新后旧结果标记为历史版本，不重新归属到新节点。
- 页面刷新或后台评估完成后，可从表达历史和任务中心恢复结果；删除书籍后禁止新训练，级联删除训练录音、原始/修订转写和评价 JSON，仅保留不可回链到用户、书籍或节点的聚合指标。

**Acceptance Criteria**

- 用户可从听读节点一键进入表达，并保持同一 `bookId`、框架版本和节点。
- 两种题型均限制为 60 秒；提前结束、权限拒绝、空音频、转写失败和评分失败都有可操作提示。
- 评分明确区分理论内容与表达质量，所有分项来自后端结构化结果。
- 每次成功训练均可在表达历史中恢复，并能回到当时版本的节点证据。
- 不同用户同日训练不会共享或覆盖 session；同一评分任务重试不会创建重复 attempt。
- 表达流程支持键盘操作；计时、录音、转写、排队和评分状态均提供文本反馈。

#### Story 12：取消任务

- 取消表示停止调度新步骤。
- 已发送的 Dify 请求可能无法立即取消，界面必须说明。
- 在途结果返回后，不得写入正式框架。
- 取消和任务完成使用条件状态更新，避免竞态。
- 已完成章节结果保留至规定过期时间。
- 恢复时创建新任务，不重新激活旧任务。
- 取消前已产生的调用量仍计入成本记录。

#### Story 13：删除书籍

删除状态：

```text
active → delete_requested → retrieval_disabled → deleting → deleted
deleting → delete_failed
```

- 请求删除后立即禁止检索、学习生成和重解析。
- 分项记录原始书籍、来源单元文本、转换产物、章节、框架版本、节点证据、听读音频、表达训练录音、转写、评价 JSON、知识来源关系和 Dify Workflow 运行 ID 的删除状态。
- 删除 `knowledge_vault` 中对应的来源关联。
- 知识节点没有其他来源后归档，不破坏仍被其他来源使用的节点。
- 删除失败可重试。
- 删除完成前不得复用原 `bookId`。
- 删除结果明确区分应用数据库和本地文件、Dify Workflow 临时处理内容、模型供应商日志或缓存、系统备份。

### Non-Goals

MVP 不包含：

- 精读模块接入：不生成逐段精读课程、批注、阅读测验或精读进度。
- 写作模块接入：不生成写作选题、提纲、仿写、作文评分或写作训练。
- `AZW`、`KFX`、`DOC/DOCX`、`FB2`、`CBZ/CBR`、`DJVU`、`HTML/MHTML`、`RTF` 等其他上传格式。
- Unstructured、MinerU。
- Dify Dataset、RAG、跨书检索。
- 多书批量上传。
- 公共书库或公开分享。
- DRM 绕过。
- 全文导出或大段连续原文输出。
- 整书替代性音频。
- 六类完整表达训练。
- 正式语义关系图谱。
- 多用户协作编辑。
- Redis、RabbitMQ、Kafka、Neo4j、对象存储。
- XMind、OPML 导出。
- 精确剩余时间预测。

---

## 3. AI System Requirements

### Tool Requirements

复用 `pdf-parse`、Dify Workflow、SQLite、D3、`knowledge_vault`、现有 TTS、录音与表达复盘。

新增 Umi-OCR Linux Docker 无头服务、后端 OpenAI 兼容 `Chat Completions` 校对调用、EPUB 章节解析和 Calibre `ebook-convert`。Umi-OCR 容器内监听 `0.0.0.0:1224`，Docker 仅向宿主机回环地址发布 `127.0.0.1:1224:1224`；不得绑定公网地址或在防火墙放行该端口。Calibre 仅由后端使用固定参数调用，不接受客户端命令参数。模型 API Key 仅从 systemd `EnvironmentFile` 读取。

MVP 不使用 Dify Dataset、Dify Knowledge API、Unstructured、MinerU、独立图数据库或独立任务队列。

### Canonical Source

原始逐页提取内容为证据事实源：

```text
source book
├─ 文本型 PDF → pdf-parse 原始逐页文本
├─ 扫描型 PDF → Umi-OCR 原始逐页 OCR → Chat Completions 严格校对文本
├─ EPUB → 原始章节 XHTML 的净化文本
├─ MOBI/AZW3 → Calibre 转换产物 → 对应原始章节文本
└─ TXT → 原始字节 + 已确认编码的规范化文本
                         ↓
                 chapter_revision
                         ↓
                 Dify Workflow
                         ↓
                 framework_revision
```

- 文本型 PDF 以 `pdf-parse` 原始逐页文本为证据事实源。
- 扫描型 PDF 以 Umi-OCR 原始逐页结果为证据事实源。
- EPUB 以源 EPUB 内对应章节 XHTML 的净化文本和资源路径为证据事实源。
- MOBI/AZW3 必须保留原始文件哈希、Calibre 版本、转换参数、转换产物哈希及章节映射；证据引用转换后章节文本并明确标记“格式转换文本”。
- TXT 保留原始字节哈希、检测编码和规范化文本；证据位置使用行号与字符区间，不伪造页码。
- LLM 校对文本是派生内容，不得替代原始证据。
- 章节和证据全部引用不可变 `book_revision` 及格式中立的来源定位。
- Dify 只接收校对或规范化章节文本及来源定位标记，不重新解析原始书籍。
- 禁止根据 Dify 或校对输出反向猜测页码、行号或章节位置。
- 原文件、OCR 引擎、转换工具、校对模型或解析器版本变化时创建新 `book_revision`。

### AI Processing Pipeline

1. **文档检测**：校验真实格式、DRM/加密状态、大小及格式专属复杂度；PDF 采集页数、页面像素和有效字符，EPUB/转换产物采集解压体积与文件数，TXT 采集编码与解码字符数。
2. **来源单元提取**：文本型 PDF 使用 `pdf-parse`，扫描型 PDF 使用 Umi-OCR；EPUB 读取 spine/XHTML；MOBI/AZW3 受限转换后读取 EPUB；TXT 按已确认编码读取。保存来源定位、原始提取文本、内容哈希、状态和异常标记。
3. **严格校对**：扫描型 PDF 逐页调用后端 `Chat Completions`，仅修复错别字、标点、断行和分段；保存校对文本、差异、模型和提示版本。校对不得覆盖 OCR 原文。
4. **章节识别**：按格式读取书签、TOC、spine 或标题规则，生成候选；用户确认后创建不可变 `chapter_revision`。
5. **章节理论提取**：Dify 接收章节 ID、标题、带来源定位文本、节点 Schema、不可信内容声明及输出限制。
6. **全书归并**：处理同义、重复、父子关系、跨章节归纳、来源完整性和严重冲突；不得删除章节原始结果。
7. **用户确认**：保存不可变 `framework_revision`，再同步知识抽屉。

### Prompt Injection Protection

- 书籍正文视为不可信数据。
- Workflow 禁止遵循正文内指令。
- 解析 Workflow 不配置副作用工具。
- 正文不得触发 HTTP、文件、数据库或外部搜索调用。
- 仅接受严格 JSON Schema。
- 拒绝秘密字段、系统提示、API Key 和外部调用指令。
- 输出来源定位必须属于输入 `source_unit_id` 及其合法定位范围：PDF 校验 `pageIndex`，EPUB/MOBI/AZW3 校验 `resourcePath + char range`，TXT 校验 `line/char range`。
- 原文证据必须在对应不可变来源单元中按冻结规则匹配。
- 安全评测集必须包含提示注入 PDF。

### Error Classification

- `retryable`：HTTP 429、临时网络失败、Dify 5xx、请求超时；最多重试 3 次，指数退避。
- `user_action_required`：扫描、加密、损坏、无文本、文件超限；不自动重试。
- `budget_exceeded`：预算耗尽；暂停并等待用户确认。
- `configuration_error`：API Key、Workflow、模型或 Schema 配置错误；禁止自动重试并告警。
- `validation_error`：Schema、来源定位或证据校验失败；只允许一次受限修复，再次失败则停止对应章节。

最小错误码契约：`UNSUPPORTED_FORMAT`/`DRM_PROTECTED`/`FILE_TOO_LARGE` 返回 `400/413` 并提示更换文件；`RESOURCE_BUSY` 返回 `429/503` 并提示排队或稍后重试；`OCR_UNAVAILABLE` 返回 `503` 并保留原任务；`JOB_NOT_FOUND` 返回 `404` 并提供书籍列表入口；`TRANSCRIPTION_EMPTY` 返回 `422` 并允许重新录音；`EVALUATION_FAILED` 返回 `502` 并允许幂等重试。后端响应必须包含稳定 `errorCode`，前端不得仅匹配错误文本。

### Cost Controls

Phase 0 压测后冻结单书最大输入 token、单章字符/token、Workflow 调用次数、重试成本、单书金额、单节点听读和单次练习成本。

- 创建任务前显示预估成本区间。
- 预算达到 80% 时预警。
- 达到 100% 时暂停。
- 用户确认追加预算后方可继续。
- TTS 和练习不得自动生成。
- 已成功章节不得因归并失败而重新调用。

### Evaluation Strategy

准备 3–5 本合法样本：简体中文心理学、逻辑或表达、常规中英混排；至少一本超过 300 页；至少一本提示注入测试 PDF。

标注协议：

- 每本书冻结核心节点金标。
- 金标包含名称、同义词、定义和来源定位。
- 两名评审独立标注，分歧由第三人裁决。
- 按书籍宏平均。
- 固定节点匹配和来源定位重叠规则：PDF 使用页码容差；EPUB/MOBI/AZW3 使用资源路径与字符区间；TXT 使用行号与字符区间。
- 模型、Prompt 或切片规则变化后重新评测。

指标字典：

- **证据有效率** = 有效 `source_claim` 数 / 全部 `source_claim` 数；按书籍计算后宏平均，排除 `structural`、`system_synthesis`、`user_added`。
- **核心节点覆盖率** = 被系统节点匹配的金标核心节点数 / 金标核心节点总数；同义词按冻结匹配表处理，按书籍宏平均。
- **严重幻觉数** = 伪造引文、伪造来源定位、与原书核心主张相反且无证据支持的节点总数；按书报告绝对值，任一本超过正式阈值即失败。
- **章节边界准确率** = 与金标边界在冻结容差内匹配的章节边界数 / 金标章节边界总数；PDF 使用页码容差，电子书/TXT 使用来源区间重叠阈值。
- **有效来源绑定率** = 具有全部必需有效来源的非结构 AI 节点数 / 非结构 AI 节点总数；排除 `structural`、`user_added`。
- **闭环完成率** = 完成“上传至一次表达练习”的首本书用户数 / 成功创建首本书任务的用户数；排除测试和管理员账号。
- **学习启动率** = 框架确认后 24 小时内启动节点听读或表达练习的用户数 / 完成框架确认的用户数。
- **首本书用户次周留存率** = 首次完成框架确认后第 7–13 天再次完成至少一次节点听读或表达练习的用户数 / 首次完成框架确认的用户数。

正式阈值、页码容差和来源区间重叠阈值记录在版本化《MVP 校准评测报告》中，由产品负责人和技术负责人共同批准。指标定义与正式阈值未冻结前，不得通过 MVP Release Gate。指标映射：“准确”由证据有效率和严重幻觉数衡量；“完整”由核心节点覆盖率衡量；“可追溯”由有效来源绑定率衡量；“学习使用”由框架确认后的听读/表达启动率衡量。

---

## 4. Technical Specifications

### Architecture Overview

```text
React
├─ 登录、multipart 上传、任务中心、章节确认
├─ D3 脑图/树形列表、证据详情
└─ 听读/表达
        │
        ▼
Express
├─ 会话鉴权、资源授权、书籍格式校验与内容提取
├─ SQLite 任务调度、Dify Workflow 代理
├─ 框架版本管理、TTS、删除调度
        │
        ├──────────────┐
        ▼              ▼
SQLite WAL           本地磁盘
                        │
                        ▼
                  Dify Workflow
```

### Integration Points

MVP 仅使用 Dify Workflow 进行章节理论提取、全书归并、单节点听读文本生成、表达练习生成及评价。

禁止将原始书籍上传到 Dify Dataset、客户端直连 Dify、前端保存 Dify API Key、解析 Workflow 使用副作用工具。

仅已确认框架节点同步到 `knowledge_vault`，并记录来源书籍、框架版本和节点 ID。单节点听读复用现有 TTS；表达练习复用录音、语音评价和表达复盘。

### Data Model

#### `books`

`id`、`owner_id`、`title`、`original_file_name`、`status`、`active_book_revision_id`、`active_framework_revision_id`、`created_at`、`updated_at`、`delete_requested_at`、`deleted_at`。

#### `book_revisions`

`id`、`book_id`、`source_file_hash`、`file_path`、`file_size`、`declared_extension`、`detected_format`、`detected_mime`、`validation_result_json`、`page_count`（可空）、`source_unit_count`、`parser_name`、`parser_version`、`conversion_tool`、`conversion_version`、`conversion_params_json`、`converted_file_hash`、`conversion_map_path`、`status`、`created_at`。转换字段仅 MOBI/AZW3 填写。

#### `book_source_units`

`id`、`book_revision_id`、`unit_type`、`unit_index`、`resource_path`、`raw_text_path`、`corrected_text_path`、`raw_text_hash`、`corrected_text_hash`、`correction_diff_path`、`extractor_version`、`correction_model`、`correction_prompt_version`、`locator_json`、`status`、`flags_json`。唯一约束：`book_revision_id + unit_type + unit_index`。

`unit_type`：PDF 为 `page`；EPUB/MOBI/AZW3 为 `xhtml`；TXT 为 `text_range`。`locator_json`：PDF 保存 `pageIndex`；EPUB/MOBI/AZW3 保存 `resourcePath + charStart + charEnd`；TXT 保存 `lineStart + lineEnd + charStart + charEnd`。

`knowledge_evidence.quote`、`quote_hash` 和证据有效性校验必须基于对应 `book_revision_id + source_unit_id` 的不可变原始提取文本。校对或格式转换文本仅用于检索和生成；展示时必须标记来源类型，不得冒充原始版式文本。无法在原始来源单元中精确或按冻结规则匹配的引文，不得创建 `source_claim`。

#### `chapter_revisions`

`id`、`book_revision_id`、`revision_number`、`status`、`confirmed_at`、`created_at`。

#### `book_chapters`

`id`、`chapter_revision_id`、`parent_id`、`title`、`level`、`sequence`、`start_locator_json`、`end_locator_json`。定位结构必须符合对应 `book_revision.detected_format`。

#### `framework_revisions`

`id`、`book_id`、`book_revision_id`、`chapter_revision_id`、`revision_number`、`status`、`model`、`workflow_version`、`prompt_version`、`created_at`、`confirmed_at`。

#### `framework_nodes`

`id`、`framework_revision_id`、`parent_id`、`node_type`、`origin`、`title`、`definition`、`confidence_level`、`sequence`、`status`。

#### `knowledge_evidence`

`id`、`framework_node_id`、`book_revision_id`、`chapter_id`、`source_unit_id`、`start_locator_json`、`end_locator_json`、`quote`、`quote_hash`、`is_valid`、`created_at`。

#### `node_listen_contents`

`id`、`book_id`、`framework_revision_id`、`framework_node_id`、`script_text`、`script_hash`、`source_node_ids_json`、`model`、`prompt_version`、`status`、`created_at`。唯一约束：`framework_revision_id + framework_node_id + script_hash`。

#### `node_listen_audios`

`id`、`listen_content_id`、`voice`、`speed`、`tts_model`、`audio_path`、`audio_hash`、`status`、`error_code`、`created_at`、`expires_at`。缓存复用键：`script_hash + voice + speed + tts_model`。

#### 复用 `training_sessions` / `training_attempts`

`training_sessions` 的唯一约束必须由全局 `training_date` 改为 `user_id + training_date`。`training_attempts` 复用现表，并在 `user_answer` JSON 中保存 `bookId`、`frameworkRevisionId`、`frameworkNodeId`、`trainingMode`、`rawTranscript`、`revisedTranscript`、`evaluation`、`taskId`、`viewedEvidence`；`scene_type` 取 `one_minute_retell` 或 `concept_explanation`。评分任务以 `taskId` 幂等，避免重试产生重复 attempt。

#### `book_jobs`

`id`、`book_id`、`owner_id`、`job_type`、`status`、`current_stage`、`idempotency_key`、`lease_token`、`lease_expires_at`、`heartbeat_at`、`cancel_requested_at`、`error_type`、`error_code`、`error_message`、`budget_used`、`created_at`、`started_at`、`finished_at`。

#### `book_job_steps`

`id`、`job_id`、`chapter_id`、`step_type`、`status`、`input_hash`、`attempt_count`、`lease_token`、`output_path`、`cost_amount`、`token_count`、`started_at`、`finished_at`。

#### `book_deletion_items`

`id`、`book_id`、`item_type`、`item_reference`、`status`、`attempt_count`、`last_error`、`deleted_at`。

### Job Semantics

1. 任务通过 SQLite 事务领取。
2. 仅允许 `pending/retrying → running` 条件更新。
3. 原子写入 `lease_token` 和 `lease_expires_at`。
4. 仅 lease 过期后允许其他 worker 接管。
5. heartbeat 定期延长 lease。
6. 完成写入必须验证当前 lease。
7. 取消和完成必须使用条件状态更新。
8. 相同章节 `input_hash` 可复用结果。
9. 服务启动时仅恢复 lease 已过期任务。
10. 已完成步骤不得自动重复调用 Dify。

### Global Resource Gate

目标服务器基线为约 3.3GiB RAM、2GiB Swap、59GB 磁盘。以下数值是 Phase 0 压测起始硬门槛，不是容量承诺；只有压测证据允许上调。

- 全机重任务总并发固定为 1。Umi-OCR、Calibre、`pdf-parse`、本地 Whisper、本地 Edge TTS 与章节 Dify Workflow 共用同一全局信号量，禁止分类并发。
- OCR 单时刻只处理一页；扫描 PDF 必须逐页渲染、逐页 OCR、逐页释放，禁止整书页面图片驻留内存。
- 上传并发为 2；等待队列最多 8 个任务，超限返回 `429` 或 `503`。
- 宿主机可用内存至少 1.2GiB 才领取重任务；低于 900MiB 停止领取；Swap 使用达到 512MiB 暂停新重任务；连续 60 秒发生 Swap in/out 则当前任务失败。
- 1 分钟 load average 超过 CPU 核数 × 1.5 时暂停领取。
- Node 使用 `--max-old-space-size=768`；systemd 起始限制为 `MemoryHigh=1100M`、`MemoryMax=1300M`。
- Umi-OCR 容器起始限制为 `--memory=1200m --memory-swap=1400m --cpus=1.5 --pids-limit=256`，并配置健康检查与失败重启。
- Calibre 在独立 transient scope 运行，起始限制为 `MemoryMax=900M`、`CPUQuota=150%`、`TasksMax=128`。
- 文本型 PDF 起始上限为 30MiB、300 页；扫描型 PDF 为 20MiB、150 页；EPUB、MOBI、AZW3 各为 50MiB；TXT 为 20MiB且解码后最多 2,000,000 字符。
- EPUB 与 Calibre 转换输出解压后最多 300MiB、10,000 个条目、单条目 20MiB、压缩比 100:1、嵌套深度 2；Calibre 输出文件最多 100MiB。任一超限立即终止并清理。
- 单页渲染最长边不超过 3500px、总像素不超过 12MP；OCR 从 150 DPI 起测，最高 200 DPI；单页超时 60 秒，整书超时 60 分钟。
- 单章最多 100,000 字符，整书提取文本最多 2,000,000 字符，TTS 单次输入最多 20,000 字符。
- 文件大小限制在 Multer 接收阶段执行；解压体积、条目数、单条目大小、压缩比和嵌套深度在完整解压或 DOM 构建前执行；书籍禁止 Base64 JSON 上传。Nginx 为书籍接口配置独立大小、超时、限速和连接数限制，不继承通用 1GiB 上传上限。
- 开工磁盘需求统一计算为 `required_space = source_size + max_temp_bytes + max_derived_bytes + 512MiB safety_margin`。起始值：PDF/TXT 的 `max_temp_bytes=source_size×2`，EPUB 为 300MiB，MOBI/AZW3 为 500MiB；`max_derived_bytes=min(source_size×5, 1GiB)`。可用空间不足 `required_space` 时拒绝开工。
- 可用磁盘低于 12GB 拒绝新书上传；低于 8GB 暂停全部重任务，只允许清理和删除。
- PDF 上传与解析分离；禁止 `fs.readFileSync` 整文件模式处理大文件，解析结果逐页落盘并及时释放。

### Storage Lifecycle

- `temp_chunks` TTL 为 2 小时；失败 OCR 页面图片 TTL 为 6 小时。
- 成功任务临时文件立即删除；失败任务临时文件最长保留 24 小时。
- SQLite DB + WAL 达到 800MiB 告警，达到 1GiB 停止写入新书任务。
- `VACUUM` 仅在低峰期独占重任务闸门执行，且可用磁盘至少为数据库大小的 2 倍。
- Phase 0 仍须冻结单用户存储配额、音频保留期、SQLite WAL checkpoint 周期、日志轮转周期和备份保留期。

文件存放于非公开目录，使用服务端生成路径，校验后原子移动，删除任务按清单逐项执行。禁止记录整本原文，禁止 Nginx 直接暴露书籍目录。

### API Requirements

- `POST /api/books`：成功时仅在书籍和任务已持久化后返回 `201`，响应包含 `bookId`、`jobId`、`jobStatus`、`createdAt`；前端据此启动 3 秒跳转。
- `GET /api/books`
- `GET /api/books/:bookId`
- `DELETE /api/books/:bookId`
- `POST /api/books/:bookId/revisions`
- `GET /api/books/:bookId/chapters`
- `PATCH /api/books/:bookId/chapter-draft`
- `POST /api/books/:bookId/chapters/confirm`
- `POST /api/books/:bookId/parse`：仅用于用户明确“重新解析”，必须提交 `Idempotency-Key` 和目标 `bookRevisionId`；初次上传不得调用。
- `GET /api/books/:bookId/jobs/current`：仅用于无 `jobId` 深链时读取当前任务。
- `GET /api/books/:bookId/jobs/:jobId`：按上传响应返回的 `jobId` 精确读取任务，并动态聚合 `totalChapters`、`completedChapters`、`failedChapters`、`queuePosition`、`currentStage`；重试中的失败步骤不计入最终失败数。
- `POST /api/books/:bookId/jobs/:jobId/retry`
- `POST /api/books/:bookId/jobs/:jobId/cancel`
- `GET /api/books/:bookId/frameworks`
- `GET /api/books/:bookId/frameworks/:revisionId`
- `PATCH /api/books/:bookId/frameworks/:revisionId/nodes/:nodeId`
- `POST /api/books/:bookId/frameworks/:revisionId/nodes/merge`
- `POST /api/books/:bookId/frameworks/:revisionId/confirm`
- `GET /api/books/:bookId/frameworks/:revisionId/nodes/:nodeId/evidence`
- `POST /api/books/:bookId/frameworks/:revisionId/nodes/:nodeId/listen-content`：幂等生成或返回节点听读文字稿。
- `GET /api/books/:bookId/frameworks/:revisionId/nodes/:nodeId/listen-content`：读取绑定当前版本的文字稿和音频状态。
- `POST /api/books/:bookId/frameworks/:revisionId/nodes/:nodeId/listen-audio`：用户主动触发 TTS；以文字稿哈希、音色、语速和模型幂等复用。
- `POST /api/books/:bookId/frameworks/:revisionId/nodes/:nodeId/exercises`：仅接受 `one_minute_retell` 或 `concept_explanation`，创建绑定指定节点的练习。
- `POST /api/books/:bookId/frameworks/:revisionId/nodes/:nodeId/exercises/:exerciseId/evaluate`：提交原始/修订转写和录音时长，异步评分；以评分任务 ID 幂等；返回 `taskId`、`status`、`createdAt`。
- `GET /api/books/:bookId/frameworks/:revisionId/nodes/:nodeId/exercises/:exerciseId`：精确读取练习与评分任务状态；`succeeded`、`failed`、`cancelled` 为终态，前端进入终态后立即停止轮询。
- `GET /api/books/:bookId/exercises`：读取当前用户的节点表达历史。

全部接口从认证上下文读取 `owner_id`，数据库查询包含 owner 条件，拒绝客户端覆盖 owner、文件路径和模型密钥，对所有子资源执行同等授权检查。

### Security & Privacy

上线阻断条件：

1. 建立可信服务端会话。
2. 完成资源级授权测试。
3. 轮换仓库中暴露过的 API Key。
4. 从版本控制中移除明文密钥。
5. 使用服务用户专属、权限 `0600` 的 systemd `EnvironmentFile` 分别保存 Chat Completions 与 Dify 密钥。
6. 两类 API Key 仅允许后端读取，独立配置、独立轮换；不得进入前端构建变量、API 响应、任务记录或日志。
7. Chat Completions API Base URL 使用服务端固定 HTTPS 白名单，禁止客户端覆盖。
8. 应用日志必须脱敏 Authorization、请求正文、供应商响应及错误体；禁止应用日志主动记录完整原文。
9. 将书籍正文标记为不可信输入。
10. 禁止解析 Workflow 使用副作用工具。
11. 删除请求后立即停止检索和生成。
12. 明示第三方模型的数据处理与保留边界。
13. Dify Workflow 运行日志可能包含章节输入、模型输出及节点跟踪；上线前必须启用 `WORKFLOW_LOG_CLEANUP_ENABLED=true`、设置经确认的 `WORKFLOW_LOG_RETENTION_DAYS`，限制 Dify 控制台管理员权限，并在删除清单中记录 Workflow 运行 ID。Dify 日志默认无限期保留，清理按日执行，不承诺即时删除。依据 Dify 官方文档“Logs / What Gets Logged / Log Retention”。

文件安全：联合校验扩展名、MIME、签名或容器结构，拒绝路径穿越、DRM、加密、损坏、格式伪装、压缩炸弹或异常复杂文件；设置上传、解压、转换、解析和 Workflow 超时；禁止执行嵌入脚本、附件和远程资源；文件不得位于公开目录。

数据隐私：书籍仅本人可见，不提供公开分享，不用于训练公共模型。应用日志只记录任务元数据；Dify Workflow 日志可能保存章节输入和输出，须按上述保留期自动清理并向用户披露。第三方模型日志和缓存依供应商政策处理，不承诺无法验证的即时删除。

版权边界：用户确认合法使用权；产品定位为私有学习工具；禁止公开传播全文或大段连续原文；不生成整书替代音频；证据采用最短必要摘录。

### Accessibility

- 脑图提供等价树形列表。
- 所有节点支持键盘访问。
- 展开、折叠和选中状态可被屏幕阅读器识别。
- 节点详情具有明确焦点顺序。
- 上传和任务进度使用文本状态，不只依赖颜色。
- 3 秒倒计时使用可读文本并以非打断式状态区域播报；“立即查看任务”支持键盘操作且焦点可见。
- 听读内容始终提供文字稿。

---

## 5. Risks & Roadmap

### Phased Rollout

#### Phase 0：上线前底座

- 可信多用户鉴权。
- API 资源授权。
- 密钥轮换及环境文件迁移。
- multipart 上传与上传成功 3 秒后进入任务中心。
- SQLite 任务 lease。
- 全局资源闸门。
- 本地文件生命周期。
- 3–5 本合法样本压测。
- 文件、成本和存储上限冻结。

#### MVP：PDF 与电子书核心闭环

- 支持 `PDF`、`EPUB`、`MOBI`、`AZW3`、`TXT` 上传及真实格式校验。
- PDF 类型检测；文本型使用 `pdf-parse` 逐页提取，扫描型使用 Umi-OCR 逐页识别。
- EPUB 直接解析目录、spine 与章节 XHTML；MOBI/AZW3 经受限 Calibre 转换后复用 EPUB 链；TXT 完成编码识别和章节候选切分。
- Chat Completions 严格校对扫描型 PDF，并保存 OCR 原文、校对文本、差异和页序映射。
- OCR 单页失败处理。
- 章节识别和用户确认。
- Dify 章节理论提取。
- 全书理论归并。
- 理论树及来源证据。
- 用户编辑、版本化和确认。
- 单节点听读。
- 一分钟复述。
- 概念解释。
- 任务取消、恢复和删除。

#### v1.2：学习增强与 OCR 质量升级

- 评估 Dify Knowledge Pipeline + Unstructured 作为复杂版面降级方案。
- 复杂公式、表格、手写体和图示增强。
- OCR 引擎质量对比与可切换策略。
- 失败页人工修订。
- 章节听读播放列表。
- 举例、反例、反驳、迁移和理论对比练习。
- 非树结构关联。
- 节点质量反馈。
- 理论框架安全导出。

#### v2.0：规模化

触发条件：并发任务超过单机能力、本地磁盘成为瓶颈、SQLite 锁竞争明显、OCR 质量不足或需要多实例部署。

候选能力：独立 worker、Redis 或专用队列、对象存储、独立 OCR、MinerU、更多电子书格式、多书理论比较、间隔复习、多模型审校。

### Technical Risks

- **P0 鉴权缺失**：可信鉴权和资源授权先于上传。
- **P0 低配服务器 OOM**：全局单重任务、流式上传、逐页落盘、真实服务器压测。
- **P0 理论幻觉**：证据匹配、来源分类、人工确认、严重幻觉发布门槛。
- **P0 任务重复执行**：SQLite 事务领取、lease、heartbeat、幂等键和输入哈希。
- **P0 删除不完整**：立即禁用检索、分项删除、失败重试、披露第三方保留边界。
- **P1 Dify 成本失控**：单书预算、阶段预算、80% 预警、100% 暂停、按需 TTS。
- **P1 章节识别错误**：提取前人工确认；修改时创建新版本。
- **P1 重复上传**：同用户 SHA-256 去重；不同哈希默认创建新书，仅用户通过“上传新版”入口时创建新 revision。
- **P1 提示注入**：正文视为数据、禁止副作用工具、严格校验和安全测试。
- **P1 版权争议**：私有用途、禁止分享、最小引用、禁止整书替代音频、第三方处理披露。

### Release Gates

**当前 OCR 发布决策（2026-09-06）**：扫描型 PDF 暂缓，原因是现有约 3.3GiB 主机无法满足 OCR 与 Node.js、SQLite 稳定共存的资源门槛。`BOOK_OCR_ENABLED=false`（未配置时同样关闭）是显式能力开关；关闭时扫描型 PDF 必须立即以 `OCR_UNAVAILABLE` 失败，提示改用文本型 PDF 或 EPUB/MOBI/AZW3/TXT，不排队、不重试、不生成后续框架、不启用本地回退。文本型 PDF 及其他 MVP 格式照常发布。恢复扫描型 PDF 前，必须使用独立 OCR 主机（内存至少 4GiB、推荐 8GiB）或将原机升级至 8GiB，并完成下列 OCR 压测、资源限制与故障恢复 Gate；本次暂缓不改变最终支持扫描型 PDF 的需求。

MVP 发布前必须通过：

- 多用户鉴权测试。
- 跨用户资源访问拒绝测试。
- 路径穿越、格式伪装、异常 PDF、压缩炸弹及 Calibre 输出超限测试。
- 提示注入 PDF/EPUB/TXT 测试。
- 听读卡片树/脑图节点一致性、节点证据跳转、框架版本绑定和刷新恢复测试。
- TTS 用户触发、幂等缓存、排队互斥、失败立即停止轮询、文字稿降级及删除禁用测试。
- 听读节点到表达的参数传递、两种 60 秒题型、录音权限/格式、原始转写评分、结构化分项和证据回链测试。
- 多用户同日 `training_sessions` 隔离、评分任务幂等、训练历史恢复及历史框架版本绑定测试。
- 上传成功响应、3 秒倒计时、立即查看、自动跳转失败降级及 `jobId` 定位测试。
- 上传失败或任务持久化失败时不跳转、不产生孤儿书籍或孤儿任务测试。
- 服务重启任务恢复测试。
- 任务重复领取测试。
- 取消与完成竞态测试。
- 删除级联与失败恢复测试。
- API Key 轮换。
- 明文密钥退出版本控制。
- 真实服务器完成 Umi-OCR 冷启动、连续逐页 OCR、大尺寸页面、失败重试及与 Node.js 并存压测。
- 冻结 Umi-OCR 容器资源限制、宿主机安全水位、页面渲染限制、单页超时和 OOM 恢复策略。
- 任一场景导致宿主机 OOM、持续 Swap 抖动或核心服务不可用时，扫描型 PDF 不得发布，须改用独立 OCR 主机或外部服务。
- 真实服务器内存、磁盘、耗时及成本压测。
- 校准集质量评测。
- 文件、页数、字符、成本和存储硬限制冻结。

#### 资源压测矩阵

每个用例至少执行冷启动 1 次、热启动 3 次：

- `PDF-T1`：5MiB/50 页文本 PDF；Node RSS 峰值低于 1.1GiB且不使用 Swap。
- `PDF-T2`：30MiB/300 页文本 PDF；无 OOM，新增 Swap 低于 256MiB，普通 API 健康延迟低于 2 秒。
- `PDF-T3`：20–30MiB 高压缩复杂 PDF；允许超时或受控拒绝，不得杀死 Node。
- `PDF-T4`：同时提交两个 30MiB PDF；仅一个运行，另一个持久等待。
- `OCR-1/2`：分别处理 20 页/150 DPI 与 150 页/200 DPI 扫描 PDF；宿主可用内存最低高于 800MiB，无持续 Swap 或容器 OOM。
- `OCR-3`：单页超过 12MP；预检拒绝，不进入 OCR。
- `OCR-4/5`：OCR 期间持续普通 API 流量并提交长 TTS；Node 不重启，SQLite p95 低于 500ms，TTS 排队。
- `CAL-1/2`：50MiB EPUB、MOBI/AZW3；Calibre RSS 低于 900MiB，输出超限时终止并清理。
- `CAL-3`：Calibre 与 OCR 同时提交；严格串行。
- `EPUB-1`：300MiB 解压内容；禁止完整 DOM 常驻，Node RSS 低于 1.1GiB。
- `TTS-1/2/3`：远端成功、失败转 Edge、三个长 TTS 同时提交；本地 TTS 独占重任务槽，临时文件可清理。
- `MIX-1`：OCR、Calibre、PDF、TTS 同时提交；仅一个重任务运行。
- `MIX-2`：两个 30MiB PDF 与两个 50MiB EPUB 上传；上传并发不超过 2，第三个请求受限。
- `DISK-1/2`：可用盘 11GB 时拒绝新书；中断分片上传在 2 小时内清理。
- `RESTART-1`：OCR 中重启 Node；任务按 lease 恢复或失败，不得重复执行或重复调用 Dify。
- `OOM-1`：人为压低 OCR 容器内存；仅容器失败，Node、Nginx、SQLite 存活。
- `SQLITE-1/VACUUM-1`：WAL 写压测与 1GiB DB 清理；不得长期锁库，清理期间不领取重任务。

#### 资源发布阻断条件

以下任一情况出现，对应扫描 PDF 或电子书链路不得上线：

1. 宿主机发生 OOM kill。
2. Node 或 SQLite 因 OCR/Calibre 重启。
3. Swap 持续增长，任务结束后 5 分钟仍未恢复。
4. 普通 API 健康检查连续 30 秒不可用。
5. 两类重任务实际并行。
6. 中断上传、失败 OCR 或失败 Calibre 留下永久临时文件。
7. Node RSS 超过 1.3GiB。
8. OCR 容器在 1.2GiB 限制下无法稳定完成门槛样本。
9. 服务重启后重复调用 Dify。
10. 文件大小、页数、像素或解压体积限制无法在重处理前执行。

### Open Questions / TBD

Phase 0 必须冻结：

- 压测后是否下调或凭证据上调当前 PDF、页数、像素、字符与资源起始硬门槛。
- 单书最大 token 和金额。
- 单用户存储配额。
- 取消任务和音频产物保留期。
- 备份保留期。
- Dify 模型供应商的数据保留政策。
- 正式质量阈值。
- 管理员访问私人书籍的审批规则。

---

## 最终结论

优先复用现有项目。MVP 聚焦“PDF/EPUB/MOBI/AZW3/TXT → 可验证原始内容提取或受控转换 → 章节 → 证据化理论树 → 人工确认 → 最小听读与表达闭环”；扫描型 PDF 增加逐页 OCR 与严格校对。复杂版面 OCR、更多电子书格式、完整练习体系及规模化基础设施按实际数据逐步引入。
