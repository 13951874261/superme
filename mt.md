好的，我将完成最后一步。以下是汇总的**最终详细设计方案**，包含安全性、并发管控、测试方案及实施里程碑。

---

## 「一键材料提纯」扩展功能 —— 最终详细设计方案

---

### 一、总览

在现有 `MaterialUploader.tsx` 组件中，新增两种材料导入模式：

| 模式 | 入口 | 后端处理策略 | 输出 |
|------|------|-------------|------|
| **网页提取** | 粘贴 URL | 同步代理 → `POST https://9router.234124123.xyz/v1/web/fetch` | Markdown → 虚拟材料 → Dify 提纯 |
| **视频字幕** | 粘贴 URL / 上传视频 | 异步任务队列 → FFmpeg 提取音轨 → Dify Workflow 转写 | 字幕文本 → 虚拟材料 → Dify 提纯 |

**核心设计原则**：
- 后端代理所有第三方 API 调用（不暴露 API Key）
- 统一输出为 `VirtualMaterial` 对象（与现有文件处理流程无缝衔接）
- 视频转写采用异步任务模式（避免 HTTP 超时）
- 前端 UI 保持现有高质感设计语言

---

### 二、前端 API Schema 完整定义

#### 接口 1：网页抓取（同步阻塞，≤ 20s）

```
POST /api/materials/fetch-url
Content-Type: application/json

Request:
{
  "url": "https://www.wsj.com/world/middle-east/u-s-military-conducts-new-strikes-on-iran-416f76cf?mod=wsj_furtherreading_pos_1",
  "format": "markdown"
}

Response 200:
{
  "success": true,
  "title": "U.S. Military Conducts New Strikes on Iran-Backed Houthi Targets in Yemen",
  "markdown": "# U.S. Military Conducts New Strikes...\n\n...",
  "length": 4512
}

Response 4xx/5xx:
{
  "success": false,
  "error": "网页抓取失败：目标网站拒绝访问 (403)"
}
```

#### 接口 2：视频转写发起（异步，立即返回 taskId）

```
POST /api/materials/fetch-video
Content-Type: multipart/form-data  (上传文件)
 或 application/json (仅 URL)

Request (URL 模式):
{
  "url": "https://example.com/video.mp4",
  "language": "auto"
}

Request (文件上传模式):
multipart/form-data:
  file: <binary video file>
  language: "en"

Response 200:
{
  "success": true,
  "taskId": "task_video_transcribe_987654",
  "status": "pending"
}
```

#### 接口 3：异步任务状态轮询

```
GET /api/tasks/:taskId

Response 200 (进行中):
{
  "taskId": "task_video_transcribe_987654",
  "status": "running",
  "progress": 65,
  "logs": [
    "[09:30:25] 视频下载完成 (45.2 MB)",
    "[09:30:28] 音轨提取成功 (mp3, 16kHz)",
    "[09:30:30] 已提交至 Dify 语音转写服务..."
  ],
  "result": null
}

Response 200 (完成):
{
  "taskId": "task_video_transcribe_987654",
  "status": "completed",
  "progress": 100,
  "logs": [...],
  "result": {
    "title": "video_audio_transcript",
    "transcript": "Hello, welcome to this session on negotiation tactics...",
    "subtitle": "1\n00:00:01,000 --> 00:00:04,000\nHello, welcome to this session...",
    "duration": 482.5
  }
}

Response 200 (失败):
{
  "status": "failed",
  "error": "Dify 语音转写服务超时，请稍后重试"
}
```

#### 虚拟材料统一模型（前端内部传递）

```typescript
interface VirtualMaterial {
  name: string;        // "wsj_article.md" | "video_transcript.md"
  content: string;     // Markdown 文本内容
  mimeType: string;    // "text/markdown"
  sourceType: 'file' | 'url' | 'video';
  sourceUrl?: string;  // 原始来源 URL
}
```

---

### 三、后端架构详细设计

#### 3.1 目录/文件结构建议（新增部分）

```
vocab-server/
├── src/
│   ├── routes/
│   │   └── materials.ts          # 新增路由：/api/materials/*
│   ├── services/
│   │   ├── webFetcher.ts         # 网页抓取代理服务
│   │   ├── videoTranscriber.ts   # 视频下载 + FFmpeg + Dify 转写
│   │   └── taskQueue.ts          # 内存任务队列（或不依赖 Redis）
│   ├── utils/
│   │   ├── urlValidator.ts       # SSRF 防护 + URL 校验
│   │   └── markdownSanitizer.ts  # Markdown 内容清洗
│   └── types/
│       └── material.ts           # VirtualMaterial 等类型定义
└── .env.local                    # 环境变量
```

#### 3.2 网页抓取服务（`webFetcher.ts`）核心流程

```
1. 校验 URL（urlValidator）
   ├─ 协议必须为 http/https
   ├─ 禁止内网 IP（127.0.0.1, 10.x, 172.16-31.x, 192.168.x, ::1, 0.0.0.0）
   └─ 可选：域名白名单/黑名单检查

2. 发起代理请求 → https://9router.234124123.xyz/v1/web/fetch
   ├─ Headers: { Authorization: "Bearer <DIFY_FETCH_API_KEY>" }
   ├─ Body: { model: "fetch-combo", url, format: "markdown" }
   ├─ 超时：20 秒
   └─ 重试策略：失败时最多重试 1 次（间隔 2 秒）

3. 解析响应
   ├─ 提取 markdown 字段
   ├─ 清洗异常字符（移除 \x00, BOM, 敏感 header 信息）
   └─ 提取标题（第一个 # 或 <h1>）

4. 返回结果 → 前端
```

#### 3.3 视频转写服务（`videoTranscriber.ts`）核心流程

```
1. 资源获取
   ├─ 若有 URL → 下载视频至临时目录 (D:\cursor\work\super-agent\tmp\videos\)
   ├─ 若有 File → 直接读取
   └─ 大小限制检查 (默认 ≤ 200MB)

2. FFmpeg 音轨提取
   ├─ 命令: ffmpeg -i input.mp4 -vn -acodec libmp3lame -ar 16000 -ac 1 output.mp3
   ├─ 输出: 16kHz 单声道 MP3
   └─ 压缩后通常 ≤ 原始视频大小的 5%

3. Dify Workflow 调用
   ├─ POST https://9router.234124123.xyz/v1/workflows/run
   ├─ Headers: { Authorization: "Bearer <DIFY_SPEECH_API_KEY>" }
   ├─ Body (multipart): file=<output.mp3>, inputs={ language: "auto" }
   ├─ 超时：300 秒（5 分钟）
   └─ 若 blocking 模式超时 → 切换为轮询模式

4. 结果解析
   ├─ 提取 transcript（纯文本）
   ├─ 提取 subtitle（SRT/VTT，如有）
   └─ 封装为 VirtualMaterial

5. 清理临时文件
   └─ 删除下载的视频 + 提取的 MP3
```

#### 3.4 内存任务队列（不依赖 Redis 的轻量实现）

```typescript
// taskQueue.ts - 基于 Node.js EventEmitter 的轻量任务管理
interface TaskState {
  id: string;
  type: 'video_transcribe';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  result?: VirtualMaterial;
  error?: string;
  createdAt: number;
}

class InMemoryTaskQueue {
  private tasks = new Map<string, TaskState>();
  private TTL = 3600_000; // 1 小时后自动清理已完成任务

  createTask(type: string): TaskState { ... }
  getTask(id: string): TaskState | undefined { ... }
  updateTask(id: string, patch: Partial<TaskState>): void { ... }
  runInBackground(id: string, worker: () => Promise<VirtualMaterial>): void { ... }
  cleanup(): void { ... } // 定时清理过期任务
}
```

#### 3.5 环境变量清单

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DIFY_FETCH_API_KEY` | 网页抓取代理服务的 API Key | `sk-899c9c34738f61b5-2u53op-6ed8a313` |
| `DIFY_SPEECH_API_KEY` | Dify 语音转写 Workflow 的 API Key | `app-xxxxxxxxxx` |
| `FETCH_ENDPOINT_BASE` | 抓取端点基础 URL | `https://9router.234124123.xyz/v1` |
| `MAX_VIDEO_UPLOAD_MB` | 视频上传最大限制 | `200` |
| `MAX_FETCH_TIMEOUT_SEC` | 网页抓取超时秒数 | `20` |
| `ALLOWED_FETCH_DOMAINS` | 允许抓取的域名（逗号分隔，可选） | `wsj.com,reuters.com,bbc.com` |
| `TMP_VIDEO_DIR` | 视频临时存储目录 | `D:\cursor\work\super-agent\tmp\videos` |

---

### 四、安全性设计

| 风险 | 防护措施 |
|------|---------|
| **SSRF（服务端请求伪造）** | `urlValidator.ts` 解析 URL → 解析 DNS → 拒绝内网/回环地址 (RFC 1918, 127.x, ::1, 0.0.0.0)；禁止 `file://`, `gopher://` 等非 HTTP 协议 |
| **API Key 泄露** | 所有 Token 仅存于服务端环境变量；前端通过自身后端代理，绝不自带 Key |
| **反爬/法律风险** | 可选域名白名单机制；前端显示免责声明"仅供个人学习使用"；每次抓取记录来源 URL + 时间戳到审计日志 |
| **大文件攻击** | 视频上传大小限制 (`MAX_VIDEO_UPLOAD_MB`, 默认 200MB)；下载 URL 时校验 `Content-Length`，超限中断 |
| **并发洪水** | 每用户同时最多 1 个抓取 + 1 个转写任务执行中；后端全局并发上限（如 5 个转写任务同时运行） |
| **临时文件泄露** | 定期清理 `tmp/videos/` 下超过 30 分钟的文件；转写任务结束后立即删除本次产生的临时文件 |

---

### 五、测试方案

#### 5.1 单元测试

| 测试项 | 测试文件 | 覆盖内容 |
|--------|---------|---------|
| URL 合法性校验 | `urlValidator.test.ts` | 合法 URL 通过；内网 IP 拒绝；非法协议拒绝 |
| Markdown 清洗 | `markdownSanitizer.test.ts` | 移除 Null 字符、BOM、嵌入脚本 |
| VirtualMaterial 构建 | `material.test.ts` | 各来源类型正确赋值 |
| 任务队列 CRUD | `taskQueue.test.ts` | 创建/查询/更新/过期清理 |

#### 5.2 集成测试

| 测试项 | 说明 |
|--------|------|
| 网页抓取 → 虚拟材料 → `processMaterialsAndExtract` | Mock 外部 fetch 返回固定 Markdown；验证虚拟材料被正确消费 |
| 视频文件上传 → FFmpeg → Dify Mock → 虚拟材料 | Mock Dify 返回转写文本；验证 FFmpeg 调用正确 |
| 异步任务状态轮询 | 初始化任务 → 查询 pending → running → completed |
| 错误回退 | 模拟外部 fetch 超时 → 验证日志输出与错误提示 |
| 旧流程兼容 | 确认原始文件上传仍正常工作 |

#### 5.3 E2E 测试（前端）

| 测试用例 | 操作路径 | 预期结果 |
|---------|---------|---------|
| 网页提取 + 提纯 | Step 2 切换到「网页提取」→ 粘贴 URL → 预览 → Step 3 点击「开始提纯」 | 日志输出抓取成功 → 提纯完成 → 生词更新事件触发 |
| 视频转写 + 提纯 | Step 2 切换到「视频字幕」→ 粘贴视频 URL → Step 3 点击「开始提纯」 | 轮询进度条 → 转写完成 → 自动触发提纯 |
| 模式互斥 | 选择文件后切换到网页提取 | 之前的文件选择被清空 |
| 错误处理 | 输入无效 URL → 点击预览 | 显示红色错误提示"URL 格式非法" |

---

### 六、实施里程碑

| 阶段 | 内容 | 预估 |
|------|------|------|
| **M0 设计确认** | 本方案经您审核通过 | ✅ 当前 |
| **M1 后端骨架** | 新增路由 `materials.ts`、`urlValidator`、`markdownSanitizer`、`taskQueue` | 1 次会话 |
| **M2 网页抓取服务** | 实现 `webFetcher.ts`，端到端联调 `fetch-url` 接口 | 1 次会话 |
| **M3 视频转写服务** | 实现 `videoTranscriber.ts` + FFmpeg + Dify 调用 | 1-2 次会话 |
| **M4 前端改造** | `MaterialUploader.tsx` 增加 Tabs、预览、异步轮询 | 1 次会话 |
| **M5 集成测试** | 单元测试 + 集成测试 + E2E 验收 | 1 次会话 |
| **M6 上线观察** | 灰度开启，观察抓取成功率、转写时延、错误率 | 持续 |

---

### 七、风险与对策

| 风险 | 可能性 | 应对措施 |
|------|--------|---------|
| 外部 fetch 服务不稳定 | 中 | 后端实现本地 fallback（node-fetch + turndown 转 Markdown） |
| Dify 语音转写超时 | 高 | 异步队列 + 轮询 + 最长 10 分钟超时后标记失败 |
| FFmpeg 未安装在服务器上 | 中 | 部署脚本增加 FFmpeg 检测；若无则利用 Dify 直接接收视频 URL |
| 抓取目标站反爬（Cloudflare） | 中 | 用户建议自行下载为 MD 再上传；不做反向代理穿透 |

---

根据您的确认（1. 接受 Tabs 布局与两步式操作；2. 任务历史/任务列表上抬为全局可查看；3. 允许移动端全屏模态展示），我为您整理了**前端 UI/UX 的详细改造方案**。

---

# 前端 UI/UX 改造方案

---

## 1. 界面与交互流 (UI/UX Flows)

为了容纳新增的“网页提取”与“视频字幕”功能，我们将对 `MaterialUploader.tsx` 的 Step 2 进行重构，引入 Tabs 面板。同时，将在系统顶栏或侧边栏引入全局的“提纯任务历史”面板。

### 1.1 Step 2 三模式面板
我们对 `Step 2 选择材料` 区块进行水平分栏的 Tab 控制：
*   **外观样式**：使用现有 Tailwind 类保持品牌质感（灰色圆角卡片 `bg-[#f8f9fa] border-gray-100`）。
*   **Tabs 头部**：
    ```typescript
    // Tab 项的视觉状态定义
    const tabClass = (active: boolean) => `
      flex-1 py-2 text-xs font-black tracking-widest uppercase transition-all border-b-2 text-center cursor-pointer
      ${active ? 'border-[#FF5722] text-[#FF5722]' : 'border-transparent text-gray-400 hover:text-gray-600'}
    `;
    ```
*   **模式 A（上传文件）**：保持原有选择文档逻辑。
*   **模式 B（网页提取）**：
    *   用户在 URL 输入框输入网址。
    *   点击 **“预览网页内容”**（次级按钮，淡橘边框）。
    *   加载中状态：展示带旋转动画的 `Loader2` 骨架。
    *   预览展开：以卡片形式折叠展开。移动端下，预览卡片使用固定定位（`fixed inset-0 z-50 bg-white`）全屏模态展示，顶部带一个明显的“关闭”按钮。
    *   确认内容后，用户点击 Step 3 的 **“开始上传并提纯”**。
*   **模式 C（视频字幕）**：
    *   支持粘贴视频 URL（如 YouTube/Vimeo 或直接 MP4）或拖拽上传本地视频。
    *   提供语言检测下拉框（默认自动检测）。
    *   点击 **“开始转写并提纯”** 后，立即创建异步任务，返回 taskId 并将任务推进到全局任务中心。

---

### 1.2 全局提纯任务中心 (Global Task Center)
根据您的需求，任务列表将从局部组件中抽离，上抬至全局。

*   **入口设计**：
    在顶栏（Header）的右侧或导航区域新增一个 **“提纯任务中心”** 按钮。带有一个未读/进行中任务的徽章（Badge），如 `● 2`（代表 2 个视频转写任务正在后台处理）。
*   **抽屉面板 (Drawer)**：
    点击按钮后，从屏幕右侧滑出一个抽屉（Width: `w-96` 或 `sm:w-[400px]`），展示所有提纯任务的实时进度：
    ```
    ┌──────────────────────────────┐
    │  提纯任务中心            [X] │
    ├──────────────────────────────┤
    │  ● 视频: 商务谈判策略...     │
    │    [==== 正在转写 65% ===]   │
    │    • 日志: 已提取音轨...     │
    │                              │
    │  ✓ 网页: 华尔街日报新闻      │
    │    已提纯完成 (10个生词入库) │
    │    [下载 Markdown] [查看生词]│
    │                              │
    │  ✗ 网页: 某受限网站          │
    │    抓取失败: CF反爬阻断      │
    │    [重试] [查看详细错误]      │
    └──────────────────────────────┘
    ```
*   **状态共享**：
    前端使用全局状态管理（如 React Context 或简单的全局 Zustand 状态）来同步 `tasks` 数组，以保证无论用户在哪个页面，后台的视频转写和抓取进度都可以通过抽Drawer随时查看。

---

## 2. 关键组件签名与 Props

为了保持代码的高内聚、低耦合，我们建议将新增的前端 UI 拆分为三个独立子组件。

### 2.1 网页提取面板 (`UrlFetchPanel.tsx`)
```typescript
interface UrlFetchPanelProps {
  onFetchSuccess: (virtualFile: { name: string; content: string; mimeType: string }) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function UrlFetchPanel({ onFetchSuccess, isLoading, setIsLoading }: UrlFetchPanelProps) {
  const [url, setUrl] = useState('');
  const [previewData, setPreviewData] = useState<{ title: string; markdown: string } | null>(null);
  const [showMobileModal, setShowMobileModal] = useState(false);

  // 网页预览处理函数
  const handlePreview = async () => { ... };
  
  // 确认并送入提纯链
  const handleConfirm = () => { ... };

  return (
    // Tailwind UI 结构
  );
}
```

### 2.2 视频转写面板 (`VideoTranscribePanel.tsx`)
```typescript
interface VideoTranscribePanelProps {
  onTaskCreated: (taskId: string) => void;
}

export default function VideoTranscribePanel({ onTaskCreated }: VideoTranscribePanelProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('auto');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 发起转写任务
  const handleSubmit = async () => { ... };

  return (
    // 拖拽文件区 & URL 输入区 & 语言选择区
  );
}
```

### 2.3 全局任务中心抽屉 (`GlobalTaskCenter.tsx`)
```typescript
interface TaskItem {
  id: string;
  type: 'url' | 'video';
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  error?: string;
}

export default function GlobalTaskCenter() {
  const { tasks, isOpen, setIsOpen, removeTask, retryTask } = useGlobalTasks(); // 假设从自定义 Hook/Context 获取

  return (
    // 右侧滑出 Drawer UI，使用 transition-transform
  );
}
```

---

## 3. 前端实现伪代码 (Zustand/Context 状态共享)

为了支撑全局任务历史，我们使用一个简单的任务状态管理 Store（以自定义 Hook 为例）：

```typescript
// src/store/useTaskStore.ts
import { create } from 'zustand';

interface TaskState {
  tasks: TaskItem[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  addTask: (task: TaskItem) => void;
  updateTask: (id: string, patch: Partial<TaskItem>) => void;
  startPolling: (id: string) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isOpen: false,
  setIsOpen: (open) => set({ isOpen: open }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (id, patch) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, ...patch } : t)
  })),
  startPolling: (id) => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/tasks/${id}`);
      const data = await res.json();
      
      get().updateTask(id, {
        status: data.status,
        progress: data.progress,
        logs: data.logs,
        error: data.error
      });

      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(interval);
        if (data.status === 'completed') {
          // 触发系统生词本刷新事件
          window.dispatchEvent(new Event('vocab-updated'));
        }
      }
    }, 2000);
  }
}));
```

---

## 4. 关键集成修改点 (`MaterialUploader.tsx`)

在主组件中引入这些新的子面板：

```typescript
// src/components/MaterialUploader.tsx (修改伪代码示意)
export default function MaterialUploader({ topicHint, onUploadSuccess }) {
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'video'>('file');
  const [virtualMaterial, setVirtualMaterial] = useState<VirtualMaterial | null>(null);
  const addTask = useTaskStore(state => state.addTask);
  const startPolling = useTaskStore(state => state.startPolling);

  // 接管网页预览成功后的流转
  const handleUrlFetchSuccess = (material: VirtualMaterial) => {
    setVirtualMaterial(material);
    // 更新主组件的“已选择文件”展示
  };

  // 接管视频转写任务创建后的流转
  const handleVideoTaskCreated = (taskId: string) => {
    addTask({
      id: taskId,
      type: 'video',
      name: '后台转写视频材料...',
      status: 'pending',
      progress: 5,
      logs: ['任务已提交，排队中...']
    });
    startPolling(taskId);
  };

  return (
    <div className="bg-white rounded-[2rem] ...">
      {/* Step 2 Header & Tabs */}
      <div className="flex border-b border-gray-100 mb-4">
        <button className={tabClass(activeTab === 'file')} onClick={() => setActiveTab('file')}>上传文件</button>
        <button className={tabClass(activeTab === 'url')} onClick={() => setActiveTab('url')}>网页提取</button>
        <button className={tabClass(activeTab === 'video')} onClick={() => setActiveTab('video')}>视频字幕</button>
      </div>

      {/* Mode Panels */}
      {activeTab === 'file' && <FileUploaderPanel ... />}
      {activeTab === 'url' && (
        <UrlFetchPanel 
          onFetchSuccess={handleUrlFetchSuccess} 
          isLoading={isLoading} 
          setIsLoading={setIsLoading} 
        />
      )}
      {activeTab === 'video' && (
        <VideoTranscribePanel 
          onTaskCreated={handleVideoTaskCreated} 
        />
      )}

      {/* Step 3 执行区域保持兼容 */}
    </div>
  );
}
```

---

