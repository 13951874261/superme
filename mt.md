
非常清晰，原来的数据结构是做“准确率比对”和“潜台词解码”。

现在我们来重复用户的问题，进行需求复述与对齐，并提供我们的系统改造方案。
按照指示：
1. 完全充分明确需求，并举例说明经我确认后才允许修改。
2. 每次都先重复我的问题，如有不明确的需求不要猜，提供选项供我选择。
3. 必须每次都用中文来回答。
4. 语言必须是中文。

让我们设计长音频系统改造方案的思路：
### 1. UI/UX 改造方案
*   **播放器长音频适配**：
    *   **时间控制与快进/快退**：现有的播放器只有基本的 `PlayCircle`、进度条和倍速调整。对于 30 分钟音频，需要增加 `后退 10 秒` 和 `前进 10 秒` 按钮（用 `lucide-react` 的 `RotateCcw` 和 `RotateCw` ），方便用户回听模糊片段。
    *   **音轨波形图 / 分段滑块**：大进度条支持悬浮显示时间戳，并支持在进度条上标注分段标记（以 2-3 分钟为一个精听分段）。
    *   **音频分段选择器**：提供分段面板或下拉列表，如 `[00:00 - 02:30] Segment 1: Introduction`、`[02:30 - 06:15] Segment 2: Deep Dive`。用户点击后，播放器自动定位并循环播放（A-B Loop 模式）该区间。
*   **盲打与比对面板优化**：
    *   由于 30 分钟音频字数非常多（数千词），不能一次性比对所有内容，否则会超出 Dify API Token 限制，比对效果也会变差。
    *   因此，盲打和侧写解析均在**当前选中的分段**内进行。
    *   提供“分段保存”和“全局进度”展示，用户能清晰看到 30 分钟中自己完成了哪些部分的听写。

### 2. 前端改造方案
*   **上下文与状态存储**：
    *   在 `EnglishContext.tsx` 中引入长音频相关的全局状态：`isLongAudio` (是否是长音频)、`selectedSegment` (当前选中的音频分段索引)、`segments` (音频分段信息列表：含时间范围和标准文本)。
    *   支持加载外部音频源或静态长音频语料库的元数据。
*   **播放控制**：
    *   在 `ListenTab.tsx` 中，对 `audio` 的 `timeUpdate` 进行边界拦截：若启用了“单段循环模式（Loop Segment）”，当播放进度达到 `segment.end` 时，自动跳转回 `segment.start` 重新播放。
*   **比对逻辑适配**：
    *   当用户提交盲打结果时，只比对当前 Segment 的 `standard_text`，提升 Dify 侧写引擎的精确度，并降低 Token 消耗。

### 3. 后端与语料库改造方案
*   **长音频语料库源（后端/本地静态配置）**：
    *   建立一个 `longAudioMaterials` 静态配置文件或 API 服务，包含长音频的音频地址（如 CDN / 本地 public 文件夹下的音频文件路径）、分段列表（每个分段的起止时间、对应标准文本、黑话集）。
    *   提供预设的高频长音频：如 *2026年美联储发布会*、*微软商务对话录音*、*BBC 专题长访谈*（约 30 分钟）。
*   **Dify 侧写比对优化**：
    *   设计针对长音频片段的比对 Prompt。针对每个片段独立发送给 Dify 侧写工作流，防止一次性发送 30 分钟长文本导致模型崩溃或超时。

---

现在，我将按照 AGENTS.md 指令，用中文向用户提交这个方案进行确认。

首先，我需要**先重复用户的问题**，然后进行**需求复述与对齐（含具体实例确认）**，然后**制定详细行动计划（Planning Phase）**。

我先写出答复的整体草稿，保证流程严格、行文严谨、语调专业：

1. **重复问题**：
   "您的问题是：**10. 听力板块-长音频支持。需完善的菜单路径：听力板块。代码现状：目前库内调用的听力语料过短、偏少，无法满足沉浸式听力需求。需求提升点：引入长音频语料支持（如 30 分钟左右的英文新闻、长访谈、发布会、商务对话录音），并配合前端进度条与播放器进行长音频适配。请结合现有代码，给出系统改造方案。包括ui/ux，前端、后端等的详细改造方案。**"

2. **需求复述与对齐（结合实例）**：
   - 解释“长音频”和“短音频”的业务本质差异，以及为什么不能直接用原有的实时 TTS 生成 30 分钟音频（时间极长、字符超限）。
   - 提供一个具体的运行实例场景（比如加载一个“美联储2026年利率决议发布会” 30分钟 MP3）。
   - 举例说明在这个长音频下，UI 交互、分段播放、A-B 循环、分段盲打、调用 API 解码的具体数据流。

3. **系统改造方案**：
   - 分为 UI/UX、前端、后端/配置、Dify 工作流等维度的详细设计。

4. **计划阶段 (Planning Phase)**：
   - 列出明确的行动计划步骤，并在步骤中提出 2 个我们需要跟用户确认的模糊点选项，供用户选择。

我们开始组织并发出这次回复。不用调用其他的 tool，我们直接输出响应给用户确认。**您的问题是：**

> 10. 听力板块-长音频支持
> 需完善的菜单路径：听力板块
> 。
> 代码现状：目前库内调用的听力语料过短、偏少，无法满足沉浸式听力需求
> 。
> 需求提升点：引入长音频语料支持（如 30 分钟左右的英文新闻、长访谈、发布会、商务对话录音），并配合前端进度条与播放器进行长音频适配
> 。
> 请结合现有代码，给出系统改造方案。包括ui/ux，前端、后端等的详细改造方案。

---

好的，我已收到您的任务。为了保证系统改造精确符合您的预期，我们将严格按照“计划-执行-确认”流程进行。

### 第一步：需求复述与对齐

在原有系统中，听力板块采用**实时大模型生成文本剧本 -> 调用 Edge-TTS 生成高保真音频**的机制。这对于短篇幅（1-2分钟）非常适用，但在面对 30 分钟左右的沉浸式长音频时，存在以下痛点：
1. **生成受限**：大模型无法一次性稳定输出 30 分钟的英文稿件，且 Edge-TTS 实时转换 30 分钟音频极其缓慢并容易超时失败。
2. **交互脱节**：原播放器仅有基础进度条，无法精细化控制 30 分钟的音频；用户无法在 30 分钟的盲听下一次性盲打完几千词。
3. **API 溢出**：将 30 分钟（数千词）的盲打记录直接发送给 Dify 对比引擎，会导致 Token 溢出，且比对分析精度会大幅度下降。

#### 💡 改造核心逻辑：【预存语料 + 智能分段精听 + 增强型长音频播放器】
我们将听力板块由原来的“纯实时生成模式”升级为**“实时生成”与“长音频沉浸精听”双通道模式**。
* **对于长音频**：系统预置/加载现有的静态长音频文件（如 `.mp3` 格式的英文新闻或访谈），并为其配置一份带有时间戳打点的分段文本信息（例如每 2-3 分钟为一个 Segment 单元）。
* **对于播放器**：适配长音频进度条，提供段落书签、前/后退 10 秒微调、段落循环（A-B Loop）和进度持久化。
* **对于盲打与比对**：用户选择某一段落（如第 2 段：03:00 - 06:15）进行盲听和速记，点击“解码潜台词”时，前端仅将该段落的“用户盲打”与“标准原文”发送给 Dify 进行高精度差分比对，避免 Token 溢出。

#### 📝 具体数据实例确认

为了向您直观说明，我们以引入一个 **微软2026年开发者大会长访谈（Microsoft Build 2026 Q&A）** 为例，改造后的数据结构和交互流如下：

##### 1. 后端长音频语料配置结构 (例如 `src/config/longAudios.ts`)：
```typescript
{
  id: "ms-build-2026",
  title: "Microsoft Build 2026 CEO Q&A Interview",
  duration: 1800, // 30分钟 (1800秒)
  audioUrl: "/audio/ms_build_2026.mp3", // 长音频文件路径
  genre: "podcast",
  cefrLevel: "C1",
  segments: [
    {
      index: 0,
      title: "Part 1: The Copilot Evolution",
      start: 0,       // 0秒
      end: 180,       // 3分钟 (180秒)
      text: "Host: Welcome back to our tech daily podcast. Today we are joined by the CEO of Microsoft...",
      jargons: [{ word: "Copilot", meaning: "微软AI副驾驶工具" }]
    },
    {
      index: 1,
      title: "Part 2: Cloud Infrastructure & AI Scaling",
      start: 180,     // 180秒
      end: 420,       // 7分钟 (420秒)
      text: "CEO: In 2026, we are looking at scale at an unprecedented level. Our GPU cluster capacity...",
      jargons: [{ word: "GPU cluster", meaning: "GPU集群" }, { word: "Scaling", meaning: "横向扩展" }]
    }
    // ... 后续分段
  ]
}
```

##### 2. 交互与数据流向：
1. 用户在前端下拉菜单选择“**长音频模式**”，加载该篇 30 分钟访谈。
2. 进度条上会显示标记线（或者提供一个分段卡片列表），标出 `Part 1 [00:00-03:00]`、`Part 2 [03:00-07:00]`。
3. 用户选中 `Part 2`，点击播放。播放器会自动定位到 `03:00` 开始播放，且当播放到 `07:00` 时，自动**循环（A-B Loop）**播放该段，以便用户精听。
4. 用户在“盲打笔记区”写下他听到的第 2 段内容，并点击“解码当前段落潜台词”。
5. 前端调用 `runListeningEngine`，发送的参数为：
   * `userInput` = 用户盲打的第 2 段草稿。
   * `standardText` = 微软 CEO 访谈的第 2 段标准文本（`"CEO: In 2026, we are looking at scale..."`）。
6. 右侧显示针对该段的精准 Diff 分析和潜台词侧写。

---

### 第二步：详细系统改造方案

#### 一、 UI/UX 改造方案
1. **播放器面板升级**：
   * 增加 **后退 10 秒** (`RotateCcw`) 和 **前进 10 秒** (`RotateCw`) 的动作按钮，方便长音频微调。
   * 增加 **A-B 段落循环播放开关 (Loop Segment)**，激活时音频只在当前段落区间内播放和循环。
   * 引入 **分段快捷导航面板**：以折叠面板或列表形式在播放器下方展示各段的标题及起止时间（如 `00:00 - 03:00 第一部分`），支持一键定位播放。
2. **盲打与原文区域联动**：
   * 当长音频分段切换时，盲打笔记区自动缓存并切换当前段落的草稿，避免不同段落的文本重叠。
   * 原文遮罩模糊逻辑（盲听/看词）仅对当前所选分段生效。

#### 二、 前端架构改造方案
1. **全局上下文增强 (`EnglishContext.tsx`)**：
   * 新增状态变量：
     * `isLongAudioMode`: 是否为长音频精听模式。
     * `selectedLongAudioId`: 当前选中的预设长音频 ID。
     * `currentSegmentIndex`: 当前选中的段落索引（默认 0）。
     * `longAudioPlaylists`: 预设的长音频语料库列表。
2. **音频控制与钩子函数设计 (`ListenTab.tsx`)**：
   * 改写原生 `<audio>` 的 `onTimeUpdate` 事件监听器：
     * 如果 `isLongAudioMode` 为真，且启用了段落循环，当 `currentTime >= currentSegment.end` 时，重置 `audioRef.current.currentTime = currentSegment.start` 并继续播放。
     * 拖动进度条时，如果超出当前分段范围，自动更新对应的 `currentSegmentIndex` 状态。
3. **接口调用转换**：
   * 解析提交：在调用 `runListeningEngine` 时，根据 `isLongAudioMode` 自动提取当前分段的原文 `currentSegment.text` 传入比对引擎，而非整篇 30 分钟长文。

#### 三、 后端与语料库配置改造方案
1. **静态长音频配置文件设计 (`src/config/longAudioPresets.ts`)**：
   * 准备 3-5 套真实长音频预设。在没有云端后台存储服务的前提下，直接通过前端静态配置文件提供，并把音频文件放在 `public/audio/` 目录下（或者使用稳定的公网静态音频 URL，如英文新闻播客）。
2. **Dify API 兼容性**：
   * 原有的 Dify 听力比较流 `runListeningEngine` 不需要修改，因为它本身就是接收 `user_input` 和 `standard_text`。分段发送后，它能保持最佳的字词差异检测和情感侧写表现。

---

### 第三步：计划阶段 (Planning Phase) 与模糊点澄清

为了最稳妥地推进这一功能，我将该项改造拆分为如下 3 个步骤：
1. **配置层**：新建静态长音频配置文件 `longAudioPresets.ts`，放入测试用的长音频结构与标准字幕数据。
2. **前端与播放器适配**：在 `ListenTab.tsx` 中加入模式切换（短音频实时生成 vs. 长音频库精听）、加入分段选择卡片、升级播放器控制组件（包含 A-B 循环与 10s 前后退）。
3. **功能验证**：通过测试用例验证长音频播放的区间循环、分段盲打、以及调用 Dify API 的局部片段对比。

#### ❓ 需要您选择和确认的模糊点：

针对这个改造，有以下两个选项需要您进行确认：

**问题 1：关于长音频语料的来源，您倾向于哪种方案？**
* **选项 A (本地静态预设 - 推荐)**：在前端 `src/config/` 下建立静态配置文件，将音频 `.mp3` 资源直接放入项目的 `public/audio/` 目录中，无需配合修改额外的服务端数据库，安全且开发成本低。
* **选项 B (后端动态接口拉取)**：我们去修改后台的 Node 服务器（`vocab-server`），为长音频设计 API 接口供前端调用，以便将来动态添加长音频。

**问题 2：关于长音频的分段方式，您更倾向于哪种逻辑？**
* **选项 X (硬编码打点分段 - 推荐)**：长音频的标准文本在配置文件中就写好了固定时间戳（如第一段 0-3 分钟，第二段 3-7 分钟）。交互上最为稳定，且语义切分准确。
* **选项 Y (等时间自动切分)**：系统自动以每 3 分钟进行强制分割，不管原对话有没有说完。交互实现简单，但可能在句子中间被切断。

---
我的选择：
选项 B (后端动态接口拉取)：我们去修改后台的 Node 服务器（vocab-server），为长音频设计 API 接口供前端调用，以便将来动态添加长音频。

选项 X (硬编码打点分段 - 推荐)：长音频的标准文本在配置文件中就写好了固定时间戳（如第一段 0-3 分钟，第二段 3-7 分钟）。交互上最为稳定，且语义切分准确。

## 行动方案公示

### 后端步骤规划

1. **新建长音频配置数据文件**
   - 路径：`vocab-server/config/longAudios.json`
   - 内容：预设 3 套 30 分钟商业英语长音频元数据，每个音频含 `id`、`title`、`duration`、`audioUrl`、`genre`、`cefrLevel` 及 `segments` 数组（带起止秒数、标准文本和黑话集）。

2. **设计长音频 API 路由**
   - 路径：`vocab-server/server.js`
   - 接口：
     - `GET /api/listen/long-audio/list` → 返回所有长音频的概要列表。
     - `GET /api/listen/long-audio/:id` → 返回指定长音频的完整分段详情。
   - 数据来源为步骤 1 的 JSON 文件，中间增加 `require()` 缓存并根据 `audioUrl` 路径映射匹配静态文件目录。

3. **配置静态音频目录访问**
   - 在 `vocab-server/server.js` 用 `express.static` 挂载长音频静态文件目录，或复用现有逻辑确保音频资源可访问。

### 前端步骤规划

4. **新增长音频服务函数**
   - 路径：`src/services/listeningAPI.ts`
   - 添加 `fetchLongAudioList()` 与 `fetchLongAudioDetail(id)` 函数，对接后端新接口。

5. **扩展全局上下文**
   - 路径：`src/components/modules/english/context/EnglishContext.tsx`
   - 新增状态：`longAudios`、`selectedLongAudioId`、`currentSegmentIndex`、`loopEnabled`、`longAudioModeEnabled` 及 `segmentDrafts` 等 setter。

6. **UI/UX 改造**
   - 路径：`src/components/modules/english/tabs/ListenTab.tsx`
   - 功能点：
     - 增加“长音频精听”与“短音频生成”的模式切换按钮组。
     - 长音频选择器：下拉菜单加载后端返回的长音频列表，选中后更新上下文状态。
     - 分段导航条：横向分段缩略卡（标题 + 起止时间），当前选中段高亮，支持点击切换。
     - 播放器增强：增加后退／前进 10s 按钮、A‑B 段落循环开关、强制分段边界循环逻辑（`onTimeUpdate` 内拦截）。
     - 盲打与原文联动：切换分段时自动缓存笔记、刷新该段原文与隐藏状态。
     - 提交盲打时使用当前分段的 `text` 和 `userInput` 调用 `runListeningEngine`。

7. **测试与验证**
   - 后端：手动返回 `long-audio/list` 并抽样 `long-audio/:id` 验证 JSON 结构正确。
   - 前端：回归原有短音频完整流程；切换至长音频模式重现全链路（列表加载 → 分段播放 → 循环 → 盲打提交 → 反馈展示）。

---
好的，我已彻底摸清项目现有的 TTS 全链路。下面是针对长音频场景的 TTS 具体技术方案。

---

### 您的问题

> "文字转语音，调用目前项目通用的tts来实现。请明确具体技术方案。"

---

### 现有 TTS 架构梳理

我已追踪了项目完整的 TTS 调用链路：

```
前端 fetchDifyTTS(text)
  → POST /api/tts/speech  { input: text, model: 'edge-tts/en-GB-LibbyNeural' }
    → nginx 代理至 vocab-server (端口 3001)
      → server.js 做 MD5(input+model) 缓存检查
        → 缓存命中: 直接返回 /api/temp_audio/{md5}.mp3
        → 缓存未命中: 调用 Edge-TTS 外部 API (https://9router.234124123.xyz/v1/audio/speech)
          → 下载 MP3 写入 public/temp_audio/
          → 返回 /api/temp_audio/{md5}.mp3
```

**关键瓶颈：** Edge-TTS 单次请求处理文本长度有上限（通常 2000~3000 字符），生成 30 分钟语音（约 4000~6000 单词 / 2.5 万字符）会直接超时或失败。

---

### 长音频 TTS 具体技术方案

#### 方案核心思路：**"预生成整段 MP3 存为静态文件 + 分段文本按需走现有 TTS"**

长音频的音频文件与分段文本采用**分离处理**策略：

| 层级 | 产物 | 生成方式 | 用途 |
|------|------|----------|------|
| **整段 30 分钟 MP3** | 一个完整音频文件 | **离线预生成**（一次性脚本批量调用现有 TTS 后拼接）| 用户在长音频模式下**完整播放、拖拽进度条** |
| **每个分段的文本** | 若干段 2~3 分钟的短文本 | 配置文件中硬编码写入 | 用于**分段精听 / 盲打比对 / 按段唤起 TTS 复读** |

#### 具体实现步骤：

**① 新增长音频静态目录**

在 `vocab-server/server.js` 中新增一行静态挂载（与现有 `temp_audio` 并列）：

```js
app.use('/api/long_audio', express.static(path.join(__dirname, 'public', 'long_audio')));
```

**② 离线预生成脚本（一次性）**

新建 `vocab-server/scripts/pregen-long-audio.js`，逻辑如下：

1. 读取 `vocab-server/config/longAudios.json` 中的分段文本列表
2. 对每个 `segment.text` 逐段调用 **完全相同的现有 TTS 接口** `POST /api/tts/speech`
3. 下载各段 MP3 → 用 `ffmpeg` 或 Node.js 的音频拼接库（如 `audioconcat`）合并为完整的 30 分钟 MP3
4. 存入 `vocab-server/public/long_audio/{audioId}.mp3`

这样产出的音频**与项目现有 TTS 完全同音色、同声线**。

**③ 长音频配置文件中的 audioUrl**

```json
{
  "id": "ms-build-2026",
  "audioUrl": "/api/long_audio/ms_build_2026.mp3",
  "segments": [
    {
      "index": 0,
      "start": 0,
      "end": 180,
      "text": "Host: Welcome back to our tech daily podcast..."
    }
  ]
}
```

> `audioUrl` 指向预生成的整段 MP3，前端 `<audio>` 标签直接使用。

**④ 分段 TTS 复读（按需实时）**

当用户选中某个分段、点击"朗读本段"按钮时：

```ts
// 前端直接复用现有 fetchDifyTTS，只传当前分段的 text
const segmentAudioUrl = await fetchDifyTTS(currentSegment.text);
```

由于每段仅 2~3 分钟文本（约 300~500 词），**完全在现有 Edge-TTS 的处理能力范围内**，且会走 MD5 缓存，二次播放瞬间返回。

#### 整体架构图

```
┌─────────────────────────────────────────────────┐
│              长音频 TTS 技术方案                    │
├─────────────────────────────────────────────────┤
│                                                   │
│  【离线阶段：一次性预生成】                          │
│  longAudios.json → pregen-long-audio.js           │
│    ↓ 逐段调用现有 /api/tts/speech                  │
│    ↓ 拼接为完整 MP3                                │
│    → 存入 public/long_audio/*.mp3                  │
│                                                   │
│  【运行时：前端播放】                               │
│  ┌─────────────────────────────────────┐         │
│  │ <audio src="/api/long_audio/x.mp3"> │ ← 整段播放 │
│  │  进度条拖动 / 分段跳转 / A-B 循环    │         │
│  └─────────────────────────────────────┘         │
│                                                   │
│  【运行时：分段 TTS 复读】                          │
│  用户点击分段"朗读" → fetchDifyTTS(segment.text)    │
│    → 现有 /api/tts/speech → Edge-TTS             │
│    → MD5 缓存 → 极速返回                           │
│                                                   │
└─────────────────────────────────────────────────┘
```

---

### ⚠️ 一个需要您确认的细节

关于预生成脚本的 MP3 拼接方式，有两个选项：

- **选项 P1（ffmpeg 拼接 - 推荐）**：服务器安装 `ffmpeg`，用 `ffmpeg -f concat` 无损拼接各段 MP3。音质无损，拼接点无缝。
- **选项 P2（纯 Node.js 拼接）**：安装 `audioconcat` 或 `fluent-ffmpeg` npm 包，纯 JS 实现拼接。无需系统依赖，但可能有轻微拼接间隙。

---

好的，我现在给出具体的实现方案。基于您确认的选项 B + 选项 X + P1，我整理出完整的技术实现细节。

---

## 具体实现方案

### 一、后端实现

#### 1. 新增长音频配置数据文件

**文件路径：** `D:\cursor\work\super-agent\vocab-server\config\longAudios.json`

```json
[
  {
    "id": "ms-build-2026",
    "title": "Microsoft Build 2026 CEO Q&A Interview",
    "description": "微软2026年开发者大会CEO问答访谈，探讨AI与云计算未来",
    "duration": 1800,
    "audioUrl": "/api/long_audio/ms-build-2026.mp3",
    "genre": "meeting",
    "cefrLevel": "C1",
    "segments": [
      {
        "index": 0,
        "title": "Part 1: The Copilot Evolution",
        "start": 0,
        "end": 180,
        "text": "Host: Welcome back to our tech daily podcast. Today we are joined by the CEO of Microsoft, Satya Nadella, to discuss the future of AI in enterprise software. Satya, thank you for joining us.\n\nSatya: Thank you for having me. It's great to be here.",
        "jargons": [
          { "word": "Copilot", "meaning": "微软AI副驾驶工具" },
          { "word": "Enterprise software", "meaning": "企业级软件" }
        ]
      },
      {
        "index": 1,
        "title": "Part 2: Cloud Infrastructure & AI Scaling",
        "start": 180,
        "end": 420,
        "text": "Host: Let's talk about the infrastructure behind these AI capabilities. In 2026, we're seeing unprecedented scale. Can you elaborate on the GPU cluster expansion?\n\nSatya: Absolutely. In 2026, we are looking at scale at an unprecedented level. Our GPU cluster capacity has increased by over 500% compared to 2024. This allows us to serve millions of concurrent requests without latency degradation.",
        "jargons": [
          { "word": "GPU cluster", "meaning": "GPU计算集群" },
          { "word": "Scaling", "meaning": "横向扩展/规模伸缩" },
          { "word": "Latency degradation", "meaning": "延迟恶化" }
        ]
      },
      {
        "index": 2,
        "title": "Part 3: Developer Productivity",
        "start": 420,
        "end": 660,
        "text": "Host: How do you see AI affecting developer productivity in the coming years?\n\nSatya: We've seen a paradigm shift. Developers are now spending less time on boilerplate code and more time on creative problem-solving. Our internal data shows a 40% increase in code deployment frequency.",
        "jargons": [
          { "word": "Boilerplate code", "meaning": "样板代码/重复性代码" },
          { "word": "Code deployment", "meaning": "代码部署" }
        ]
      }
    ]
  },
  {
    "id": "fed-rate-2026",
    "title": "Federal Reserve Interest Rate Decision 2026",
    "description": "美联储2026年利率决议新闻发布会",
    "duration": 1740,
    "audioUrl": "/api/long_audio/fed-rate-2026.mp3",
    "genre": "news",
    "cefrLevel": "C1",
    "segments": [
      {
        "index": 0,
        "title": "Opening Statement",
        "start": 0,
        "end": 240,
        "text": "Good afternoon. The Federal Open Market Committee has decided to maintain the target range for the federal funds rate at 5.25% to 5.50%.",
        "jargons": [
          { "word": "Federal Open Market Committee", "meaning": "美联储公开市场委员会" },
          { "word": "Federal funds rate", "meaning": "联邦基金利率" }
        ]
      }
    ]
  }
]
```

#### 2. 后端 API 路由实现

**文件路径：** `D:\cursor\work\super-agent\vocab-server\server.js`

在文件顶部添加配置读取（已有 express，不需要额外 require）：

```js
// 读取长音频配置
const longAudiosConfig = require('./config/longAudios.json');

// 长音频列表接口
app.get('/api/listen/long-audio/list', (req, res) => {
  try {
    const list = longAudiosConfig.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      duration: item.duration,
      genre: item.genre,
      cefrLevel: item.cefrLevel,
      segmentCount: item.segments.length
    }));
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 长音频详情接口
app.get('/api/listen/long-audio/:id', (req, res) => {
  try {
    const { id } = req.params;
    const audio = longAudiosConfig.find(item => item.id === id);
    if (!audio) {
      return res.status(404).json({ success: false, error: 'Audio not found' });
    }
    res.json({ success: true, data: audio });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

在 `server.js` 中添加静态文件服务（找到现有的 `temp_audio` 静态服务附近）：

```js
// 静态文件服务：长音频文件
const longAudioDir = path.join(__dirname, 'public', 'long_audio');
if (!fs.existsSync(longAudioDir)) {
  fs.mkdirSync(longAudioDir, { recursive: true });
}
app.use('/api/long_audio', express.static(longAudioDir));
```

#### 3. 离线预生成脚本

**文件路径：** `D:\cursor\work\super-agent\vocab-server\scripts\pregen-long-audio.js`

```js
/**
 * 长音频预生成脚本
 * 使用方法: node scripts/pregen-long-audio.js
 * 需要先安装依赖: npm install axios fluent-ffmpeg
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');

// 配置
const CONFIG = {
  baseUrl: 'http://localhost:3001',
  outputDir: path.join(__dirname, '../public/long_audio'),
  configFile: path.join(__dirname, '../config/longAudios.json'),
  tempDir: path.join(__dirname, '../public/temp_audio')
};

// 确保目录存在
[CONFIG.outputDir, CONFIG.tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 读取配置
const longAudios = require(CONFIG.configFile);

/**
 * 调用现有 TTS 接口生成单段音频
 */
async function generateSegmentTTS(text, model = 'edge-tts/en-GB-LibbyNeural') {
  const response = await axios.post(`${CONFIG.baseUrl}/api/tts/speech`, {
    input: text,
    model: model
  });
  
  if (!response.data.success) {
    throw new Error('TTS generation failed');
  }
  
  // 下载音频文件
  const audioUrl = response.data.audioUrl;
  const fullUrl = audioUrl.startsWith('/') 
    ? `${CONFIG.baseUrl}${audioUrl}` 
    : audioUrl;
    
  const audioBuffer = await axios.get(fullUrl, { responseType: 'arraybuffer' });
  return audioBuffer.data;
}

/**
 * 拼接多段音频为完整 MP3
 */
async function concatAudioSegments(segments, outputPath) {
  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    
    segments.forEach((buffer, index) => {
      const tempPath = path.join(CONFIG.tempDir, `temp_segment_${index}.mp3`);
      fs.writeFileSync(tempPath, buffer);
      command = command.input(tempPath);
    });
    
    command
      .complexFilter('[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]', 'a')
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

/**
 * 主函数：逐个处理长音频
 */
async function main() {
  console.log('🚀 Starting long audio pre-generation...\n');
  
  for (const audio of longAudios) {
    console.log(`📦 Processing: ${audio.title}`);
    
    const outputPath = path.join(CONFIG.outputDir, `${audio.id}.mp3`);
    
    // 检查是否已存在
    if (fs.existsSync(outputPath)) {
      console.log(`   ⏭️  Already exists, skipping...`);
      continue;
    }
    
    try {
      // 逐段生成 TTS
      const buffers = [];
      for (let i = 0; i < audio.segments.length; i++) {
        const seg = audio.segments[i];
        console.log(`   🎤 Generating segment ${i + 1}/${audio.segments.length}...`);
        
        const buffer = await generateSegmentTTS(seg.text);
        buffers.push(buffer);
      }
      
      // 拼接并保存
      console.log(`   🔧 Concatenating segments...`);
      await concatAudioSegments(buffers, outputPath);
      
      console.log(`   ✅ Completed: ${audio.id}.mp3\n`);
      
      // 清理临时分段文件
      const tempFiles = fs.readdirSync(CONFIG.tempDir).filter(f => f.startsWith('temp_segment_'));
      tempFiles.forEach(f => fs.unlinkSync(path.join(CONFIG.tempDir, f)));
      
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}\n`);
    }
  }
  
  console.log('🎉 All pre-generation completed!');
}

main().catch(console.error);
```

**使用前需安装依赖：**

```bash
cd vocab-server
npm install axios fluent-ffmpeg
# 如果 ffmpeg 未安装，还需要安装 ffmpeg 并加入系统 PATH
# Windows: 下载 ffmpeg.exe 并放置到可访问目录
```

---

### 二、前端实现

#### 1. 新增长音频服务函数

**文件路径：** `D:\cursor\work\super-agent\src\services\listeningAPI.ts`

在文件末尾添加：

```ts
/**
 * 长音频数据结构
 */
export interface LongAudioSegment {
  index: number;
  title: string;
  start: number; // 秒
  end: number;   // 秒
  text: string;
  jargons: { word: string; meaning: string }[];
}

export interface LongAudio {
  id: string;
  title: string;
  description: string;
  duration: number; // 秒
  audioUrl: string;
  genre: 'news' | 'meeting' | 'podcast';
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1';
  segments: LongAudioSegment[];
}

/**
 * 获取长音频列表
 */
export async function fetchLongAudioList(): Promise<LongAudio[]> {
  const response = await fetch('/api/listen/long-audio/list');
  if (!response.ok) throw new Error('获取长音频列表失败');
  const data = await response.json();
  if (!data.success) throw new Error(data.error || '获取长音频列表失败');
  return data.data;
}

/**
 * 获取长音频详情（含分段）
 */
export async function fetchLongAudioDetail(id: string): Promise<LongAudio> {
  const response = await fetch(`/api/listen/long-audio/${id}`);
  if (!response.ok) throw new Error('获取长音频详情失败');
  const data = await response.json();
  if (!data.success) throw new Error(data.error || '获取长音频详情失败');
  return data.data;
}
```

#### 2. 扩展全局上下文

**文件路径：** `D:\cursor\work\super-agent\src\components\modules\english\context\EnglishContext.tsx`

查找现有状态定义位置，添加：

```ts
// 长音频相关状态
const [longAudios, setLongAudios] = useState<LongAudio[]>([]);
const [selectedLongAudioId, setSelectedLongAudioId] = useState<string | null>(null);
const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(0);
const [loopEnabled, setLoopEnabled] = useState<boolean>(false);
const [longAudioMode, setLongAudioMode] = useState<boolean>(false);
// 分段草稿缓存
const [segmentDrafts, setSegmentDrafts] = useState<Record<number, string>>({});
```

并将这些状态和方法通过 Provider 暴露出去。

#### 3. UI 改造（ListenTab.tsx）

**核心改造点说明：**

```
┌────────────────────────────────────────────────────────────────┐
│  模式切换按钮组                                                  │
│  [短音频生成模式] [长音频精听模式]                                 │
├────────────────────────────────────────────────────────────────┤
│  ▶ ═══════════════════●════════════════════════════ 02:30/30:00 │
│  [⏪ -10s] [⏩ +10s] [🔁 循环本段]                                 │
├────────────────────────────────────────────────────────────────┤
│  分段导航：                                                      │
│  [Part 1 00:00-03:00] [Part 2 03:00-07:00] [Part 3 07:00-11:00] │
├────────────────────────────────────────────────────────────────┤
│  左侧：播放器 + 当前分段原文（盲听/显示）                          │
│  右侧：盲打笔记区 + 解码按钮                                      │
└────────────────────────────────────────────────────────────────┘
```

需要添加的核心代码逻辑：

```tsx
// 分段播放时的循环逻辑
useEffect(() => {
  if (!audioRef.current || !longAudioMode || !loopEnabled) return;
  
  const audio = audioRef.current;
  const handleTimeUpdate = () => {
    const currentSegment = currentLongAudio?.segments[currentSegmentIndex];
    if (currentSegment && audio.currentTime >= currentSegment.end) {
      audio.currentTime = currentSegment.start;
      audio.play();
    }
  };
  
  audio.addEventListener('timeupdate', handleTimeUpdate);
  return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
}, [longAudioMode, loopEnabled, currentSegmentIndex, currentLongAudio]);

// 切换分段时的联动
useEffect(() => {
  if (!longAudioMode) return;
  // 自动加载对应分段的草稿
  setListenInput(segmentDrafts[currentSegmentIndex] || '');
  // 自动加载对应分段的原文
  setListenMaterial(currentLongAudio?.segments[currentSegmentIndex]?.text || '');
}, [currentSegmentIndex, longAudioMode]);
```

---

### 三、具体实施步骤

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | 新建 `vocab-server/config/longAudios.json` 并填入测试数据 | 新建 |
| 2 | 修改 `vocab-server/server.js` 添加 `/api/listen/long-audio/*` 接口和静态目录 | 修改 |
| 3 | 创建离线预生成脚本 `vocab-server/scripts/pregen-long-audio.js`（可选，后期执行） | 新建 |
| 4 | 前端 `src/services/listeningAPI.ts` 添加 `fetchLongAudioList` 和 `fetchLongAudioDetail` | 修改 |
| 5 | `src/components/modules/english/context/EnglishContext.tsx` 添加长音频相关状态 | 修改 |
| 6 | `src/components/modules/english/tabs/ListenTab.tsx` 实现完整的长音频 UI 和逻辑 | 修改 |
| 7 | 本地测试：启动后端、前端，验证长音频加载、播放、分段、盲打比对全流程 | 验证 |

---

**以上是完整的具体实现方案。请确认是否可以开始执行？**