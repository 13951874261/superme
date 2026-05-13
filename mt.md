收到！针对你将本地接口升级为线上域名 `https://app.liujingzhuwo.site/api/listening/materials` 的更新，我已经对整个“第四战役：听力盲听舱”的完整实现方案进行了全面梳理和适配。

以下是完整的目录修改、参考代码及 Dify 工作流更新方案，你可以直接复制并覆盖现有工程文件。

---

### 一、 修改文件目录概览

```text
superme/
├── vocab-server/
│   ├── db/
│   │   └── init.sql                 <-- [修改] 新增 listening_materials 表
│   ├── routes/
│   │   └── listening.js             <-- [新增] 接收 Dify Webhook、TTS 生成及前端查询接口
│   └── index.js                     <-- [修改] 挂载 /api/listening 路由
├── src/
│   ├── components/
│   │   └── BlindListeningCabin.tsx  <-- [新增] 盲听舱高阶播放器 (控制语速、隐藏/显示原文与潜台词)
│   └── api/
│       └── listeningApi.ts          <-- [新增] 前端请求接口

```

---

### 二、 Dify 工作流 DSL 修改（核心对接更新）

在你的 Dify 工作流中，找到负责发送数据的 **HTTP Request 节点**（ID: `1780000000005`，标题：`写入 vocab-server listening_materials`），将其中的 `url` 字段进行替换。

**修改前的节点配置片段：**

```yaml
      # ...省略其他配置...
      title: 写入 vocab-server listening_materials
      type: http-request
      url: http://localhost:3001/api/listening/materials

```

**修改后的节点配置片段：**

```yaml
      # ...省略其他配置...
      title: 写入 vocab-server listening_materials
      type: http-request
      url: https://app.liujingzhuwo.site/api/listening/materials

```

*注：请确保在 Dify 平台中重新发布该工作流，以使线上 Webhook 地址生效。*

---

### 三、 后端实现 (`vocab-server`)

#### 1. 数据库建表 (`vocab-server/db/init.sql`)

在现有的 `init.sql` 文件末尾追加以下表结构，严格对齐工作流输出的 JSON 格式：

```sql
-- 听力盲听舱语料表
CREATE TABLE IF NOT EXISTS listening_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content_text TEXT NOT NULL,         -- 英文原文
    audio_url TEXT,                     -- 音频文件路径 (TTS 生成或爬虫抓取)
    difficulty TEXT CHECK(difficulty IN ('A2', 'B1', 'B2', 'C1')), -- CEFR 分级
    category TEXT,                      -- 语料分类 (如: 商务谈判、政务发布)
    duration INTEGER,                   -- 时长预估(秒)
    has_subtext BOOLEAN DEFAULT 0,      -- 是否包含潜台词
    subtext_analysis TEXT,              -- 潜台词与博弈分析
    source_type TEXT,                   -- 来源类型 (tts 或 crawler)
    source_topic TEXT,                  -- 原始主题
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

```

#### 2. 核心路由与 Webhook 接收 (`vocab-server/routes/listening.js`)

创建该文件，用于接收 `app.liujingzhuwo.site` 域名下的外部请求，以及提供前端所需的查询和 TTS 接口。

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db'); // 请确保路径指向你的 sqlite/PG 实例

// 1. [Webhook] 接收 Dify HTTP 节点推送的数据并入库
// 外部访问地址将是: https://app.liujingzhuwo.site/api/listening/materials
router.post('/materials', async (req, res) => {
    try {
        // Dify 发送的数据是 JSON 格式
        const material = req.body; 
        
        const stmt = db.prepare(`
            INSERT INTO listening_materials 
            (title, content_text, audio_url, difficulty, category, duration, has_subtext, subtext_analysis, source_type, source_topic) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const info = stmt.run(
            material.title,
            material.content_text,
            material.audio_url || '',
            material.difficulty,
            material.category,
            material.duration,
            material.has_subtext ? 1 : 0,
            material.subtext_analysis,
            material.source?.type || 'tts',
            material.source?.topic || ''
        );
        
        res.status(200).json({ success: true, id: info.lastInsertRowid });
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. [TTS] 将已入库但无音频的记录转为语音 (后续可接入 OpenAI TTS 或 Edge-TTS)
router.post('/tts/:id', async (req, res) => {
    const { id } = req.params;
    // 预留接口逻辑：
    // 1. 查库获取 content_text
    // 2. 调用 TTS 服务生成音频 Buffer
    // 3. 写入本地 /public/audio 目录，获得 audio_url
    // 4. UPDATE listening_materials SET audio_url = ? WHERE id = ?
    res.json({ success: true, message: "TTS generated placeholder" });
});

// 3. [Query] 前端获取听力材料列表
router.get('/', async (req, res) => {
    const { difficulty, category } = req.query;
    let query = 'SELECT * FROM listening_materials WHERE 1=1';
    let params = [];
    
    if (difficulty) {
        query += ' AND difficulty = ?';
        params.push(difficulty);
    }
    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }
    query += ' ORDER BY created_at DESC';
    
    try {
        const materials = db.prepare(query).all(...params);
        res.json({ success: true, data: materials });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;

```

#### 3. 挂载路由 (`vocab-server/index.js`)

在入口文件中注册路由，确保 Nginx 代理 `app.liujingzhuwo.site/api/listening` 能够正确转发到此路由。

```javascript
// 在原有的路由注册区域添加：
const listeningRoutes = require('./routes/listening');
app.use('/api/listening', listeningRoutes);

```

---

### 四、 前端实现 (`src` 目录)

#### 1. 前端 API 封装 (`src/api/listeningApi.ts`)

```typescript
const BASE_URL = '/api/listening'; // 走 Vite proxy 或 Nginx 相对路径

export const fetchListeningMaterials = async (difficulty?: string, category?: string) => {
  const params = new URLSearchParams();
  if (difficulty) params.append('difficulty', difficulty);
  if (category) params.append('category', category);
  
  const response = await fetch(`${BASE_URL}?${params.toString()}`);
  return response.json();
};

```

#### 2. 盲听舱交互组件 (`src/components/BlindListeningCabin.tsx`)

支持高阶控制，满足你“训练听懂潜台词、分析角色社会层级、进行压力测试”的需求。

```tsx
import React, { useState, useRef } from 'react';

export interface ListeningMaterial {
  id: number;
  title: string;
  content_text: string;
  audio_url: string;
  difficulty: string;
  category: string;
  has_subtext: boolean;
  subtext_analysis: string;
}

export default function BlindListeningCabin({ material }: { material: ListeningMaterial }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [userNotes, setUserNotes] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);

  // 播放进度控制
  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += seconds;
    }
  };

  // 语速控制（压力测试）
  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = parseFloat(e.target.value);
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
      {/* 头部信息 */}
      <div className="flex justify-between items-start border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">🎧 {material.title}</h2>
        <div className="flex gap-2 mt-1">
          <span className="px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-700 rounded-full">{material.difficulty}</span>
          <span className="px-3 py-1 text-sm font-semibold bg-gray-100 text-gray-600 rounded-full">{material.category}</span>
        </div>
      </div>

      {/* 音频播放与高阶控制舱 */}
      <div className="bg-gray-50 p-4 rounded-lg flex flex-col gap-4">
        {material.audio_url ? (
          <audio ref={audioRef} src={material.audio_url} controls className="w-full" />
        ) : (
          <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200 text-center">
            ⚠️ 暂无音频文件，请在服务端触发 TTS 生成或上传音频
          </div>
        )}
        
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          <button onClick={() => handleSkip(-3)} className="px-4 py-2 bg-white border shadow-sm rounded hover:bg-gray-100 transition">⏪ 退3秒 (复听)</button>
          <button onClick={() => handleSkip(3)} className="px-4 py-2 bg-white border shadow-sm rounded hover:bg-gray-100 transition">进3秒 ⏩</button>
          <div className="flex items-center bg-white border shadow-sm rounded overflow-hidden">
            <span className="px-3 text-gray-500 bg-gray-50 border-r">语速</span>
            <select value={playbackRate} onChange={handleSpeedChange} className="px-3 py-2 focus:outline-none cursor-pointer">
              <option value="0.8">0.8x (慢速拆解)</option>
              <option value="1.0">1.0x (标准语速)</option>
              <option value="1.2">1.2x (会议语速)</option>
              <option value="1.5">1.5x (压力测试)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 盲听听写 / 心理侧写区 */}
      <div className="flex flex-col gap-2 mt-2">
        <label className="font-semibold text-gray-700 flex justify-between">
          <span>✍️ 盲听侧写笔记 (请记录关键意图/利益点/逻辑破绽)：</span>
        </label>
        <textarea 
          className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none leading-relaxed"
          placeholder="[训练要点] 不要急着看原文！尝试听出：&#10;1. 对方真实的利益诉求是什么？&#10;2. 这种表述方式暗示了TA在组织中的什么层级？&#10;3. 这句话的逻辑漏洞在哪里？"
          value={userNotes}
          onChange={(e) => setUserNotes(e.target.value)}
        />
      </div>

      {/* 原文与潜台词对照区 */}
      <div className="mt-2">
        <button 
          onClick={() => setShowAnalysis(!showAnalysis)}
          className={`w-full py-3 font-bold rounded-lg transition-all duration-300 shadow-sm ${
            showAnalysis 
            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'
          }`}
        >
          {showAnalysis ? '↑ 隐藏底牌' : '👁️ 翻开底牌 (核对原文与潜台词解析)'}
        </button>

        {showAnalysis && (
          <div className="mt-4 flex flex-col gap-4 animate-fade-in">
            <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
              <h3 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
                <span>📜</span> 英文原文
              </h3>
              <p className="text-gray-700 leading-relaxed font-serif text-lg">{material.content_text}</p>
            </div>
            
            {material.has_subtext && (
              <div className="p-5 bg-red-50 rounded-lg border border-red-100 shadow-sm">
                <h3 className="font-bold text-lg text-red-800 mb-3 flex items-center gap-2">
                  <span>🩸</span> 弦外之音与博弈拆解
                </h3>
                <div className="text-red-900 leading-relaxed whitespace-pre-wrap">{material.subtext_analysis}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

```

### 五、 完善方案与部署注意事项

1. **Nginx 配置检查**：
既然 API 改为了 `https://app.liujingzhuwo.site/api/listening/materials`，请确保你的 Nginx 配置文件（如 `nginx-site.conf.example` 的实际应用版）正确代理了 `/api` 前缀的请求。例如：
```nginx
location /api/ {
    proxy_pass http://localhost:3001/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

```


2. **Dify HTTP 节点安全验证**：
为了防止恶意接口调用，建议在 Dify 工作流的 HTTP Request 节点 Header 中加入鉴权（如 `Authorization: Bearer YOUR_SECRET_KEY`），并在 `listening.js` 路由中进行校验。
3. **音频生成落地**：
数据库录入完成后，`audio_url` 初始可能为空。你需要在前端增加一个管理员操作按钮，或者在后端使用定时任务（Cron），扫描 `audio_url = ''` 的记录，调用 TTS 服务（如 OpenAI、Azure TTS、Edge TTS 等）生成实体音频并保存，随后回写数据库完成最终闭环。