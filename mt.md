为了实现将政商务语料直接上传至 `English_Pro_Scenarios` 知识库并供 AI 提纯的需求，我们将采用“前端 Base64 转码 -> Node.js 后端代理 -> Dify 知识库 API”的架构。

这不仅能完美解决浏览器直接请求 Dify 导致的跨域 (CORS) 问题，还能隐藏您的 `DIFY_KB_API_KEY`，并利用现有的 SQLite 数据库记录每次上传的解析状态。

以下是具体的文档结构修改、文件命名及参考代码：

### 一、 修改的文档结构与文件名称

您需要在现有的 React 项目和后端目录中涉及以下 4 个文件：

```text
superme/
├── vocab-server/
│   └── .env                   # 1. 新增/修改：配置目标知识库的 ID 和 Key
├── src/
│   ├── services/
│   │   └── difyAPI.ts         # 2. 修改：新增前端调用后端上传接口的请求函数
│   ├── components/
│   │   └── MaterialUploader.tsx # 3. 修改：实现具体的拖拽/点击上传 UI 组件
│   └── modules/
│       └── EnglishModule.tsx  # 4. 确认：确保 MaterialUploader 组件被正确引入

```

---

### 二、 具体代码实现

#### 1. 后端环境配置 (`vocab-server/.env`)

在 `vocab-server` 目录下创建或修改 `.env` 文件，填入目标知识库的参数。您的 `server.js` 已经内置了读取这些变量的逻辑。

```env
# Dify 基础配置
DIFY_BASE_URL=https://dify.234124123.xyz

# English_Pro_Scenarios 知识库配置
DIFY_KB_DATASET_ID=f36f5681-86ed-483d-abc4-0f2376ec20e8
DIFY_KB_API_KEY=dataset-Jk5ehEEDT72wmXI5P68hcTlI

```

*(注：修改 `.env` 后，请重启 `vocab-server` 服务)*

#### 2. 前端 API 请求层 (`src/services/difyAPI.ts`)

在您的 `difyAPI.ts` 文件中，新增一个用于处理文件 Base64 转换并发送给本地 Node.js 服务器的函数。

```typescript
// src/services/difyAPI.ts 补充以下代码

const BACKEND_URL = 'http://localhost:3001'; // 确保指向您的 vocab-server 端口

/**
 * 将本地文件上传至后端，由后端代理转发至 Dify 知识库
 * @param file 用户选择的文件对象 (PDF, Word, TXT 等)
 * @param topic 当前的学习主题，用于知识库的 Metadata 标记
 */
export async function uploadMaterialToKB(file: File, topic: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async () => {
      try {
        // 剥离 data:application/pdf;base64, 前缀，只保留纯 Base64 字符串
        const base64String = (reader.result as string).split(',')[1];
        
        const response = await fetch(`${BACKEND_URL}/api/material/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64Content: base64String,
            topic: topic,
            sourceName: file.name,
            userId: 'default-user'
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '上传至知识库失败');
        }
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    
    // 触发读取操作
    reader.readAsDataURL(file);
  });
}

```

#### 3. 前端 UI 组件 (`src/components/MaterialUploader.tsx`)

实现一个具备加载状态、成功反馈的现代化上传组件。

```tsx
// src/components/MaterialUploader.tsx
import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { uploadMaterialToKB } from '../services/difyAPI';

interface MaterialUploaderProps {
  topicHint: string;
}

export default function MaterialUploader({ topicHint }: MaterialUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('idle');

    try {
      // 提取纯净的 topic 名称 (例如从 "投喂提纯材料 - 商务谈判" 中提取 "商务谈判")
      const pureTopic = topicHint.split('-')[1]?.trim() || topicHint;
      
      await uploadMaterialToKB(file, pureTopic);
      setUploadStatus('success');
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error.message || '上传失败，请检查网络或配置');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // 重置 input 允许重复上传同名文件
      }
    }
  };

  return (
    <div className="bg-[#202124] rounded-[2rem] p-8 text-white relative overflow-hidden mt-8">
      <div className="absolute top-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-blue-400 mb-2 flex items-center">
            <UploadCloud className="w-5 h-5 mr-2" /> 
            实战语料投喂 (Target Material)
          </h4>
          <p className="text-xs text-gray-400 font-medium">
            当前绑定主题：<span className="text-white">{topicHint}</span>
            <br/>支持 PDF / Word / TXT。上传后 Dify 将自动完成高质分块与向量化。
          </p>
        </div>

        <div className="flex-shrink-0">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.txt"
            className="hidden" 
            id="material-upload"
          />
          <label 
            htmlFor="material-upload"
            className={`flex items-center justify-center px-6 py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-lg
              ${isUploading ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 
                uploadStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                'bg-white text-[#202124] hover:bg-gray-200'}`}
          >
            {isUploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 解析向量化中...</>
            ) : uploadStatus === 'success' ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> 投喂成功</>
            ) : (
              <><FileText className="w-4 h-4 mr-2" /> 选择本地文档</>
            )}
          </label>
        </div>
      </div>

      {uploadStatus === 'error' && (
        <div className="relative z-10 mt-4 text-[10px] text-red-400 font-bold bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

```

#### 4. 确认前端模块挂载 (`src/components/modules/EnglishModule.tsx`)

在您的 `EnglishModule.tsx` 中，由于您已经导入并挂载了 `<MaterialUploader topicHint={\`投喂提纯材料 - ${theme}`} />`，当您完成上述 3 步代码保存后，该界面的投喂区域将自动激活。

### 💡 闭环工作流说明

当您在页面点击“选择本地文档”上传了一份例如外企内部的《Q3 Budget Review.pdf》后：

1. **数据流动**：前端组件拦截文件 -> 提取纯文本 Base64 -> Node.js 接收 -> 组装标准 `multipart/form-data` -> 击中 Dify `/v1/datasets/{id}/document/create-by-file` 接口。
2. **AI 提纯触发**：文件上传完毕并被 Dify 向量化后，当您随后触发您的 `english_mastery_logic` 提纯工作流时，Dify 会自动把这份新鲜的 PDF 内容作为“提纯底料”抓取出来，并严格按照您设定的“20 个核心词汇 + 10 个深度短语 + 5 个破绽词汇”提取为 JSON，最终自动存入艾宾浩斯生词本。