：

### 1. 后端新增直接上传视频接口与静态视频目录配置

修改文件：`D:\cursor\work\super-agent\vocab-server\server.js`

**修改内容 A：公开视频目录静态访问**
在配置静态目录的地方（约第 28 行），添加对 `temp_videos` 视频存储目录的静态映射：
```javascript
// 静态文件服务：视频暂存目录
const uploadDir = path.join(__dirname, 'public', 'temp_videos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/api/temp_videos', express.static(uploadDir));
```

**修改内容 B：新增 `/api/materials/upload-direct` 接口**
在文件后半部分（与分片上传接口平级，约第 2895 行）添加此接口：
```javascript
// 直接上传视频文件并返回直链
app.post('/api/materials/upload-direct', upload.single('video'), (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: '未上传视频文件' });
    }

    // 为防止文件名冲突且保留后缀，对文件名进行安全重命名
    const ext = path.extname(file.originalname) || '.mp4';
    const newFilename = `${file.filename}${ext}`;
    const newPath = path.join(uploadDir, newFilename);
    
    fs.renameSync(file.path, newPath);

    // 获取当前请求的主机名与协议，拼接成直链 URL
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const directUrl = `${protocol}://${host}/api/temp_videos/${newFilename}`;

    res.json({
      success: true,
      url: directUrl,
      fileName: file.originalname
    });
  } catch (error) {
    console.error('[Upload Direct Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

### 2. 后端修改视频解析逻辑，支持本地直链文件直接处理

修改文件：`D:\cursor\work\super-agent\vocab-server\services\videoTranscriber.js`

**修改内容：优化 `startTranscribeTask` 获取视频资源部分**
在开始解析视频时（约第 25 行），增加对本地直链 URL 的识别拦截。如果 `url` 中包含 `/api/temp_videos/` 路径，则无需通过 HTTP 网络下载，直接提取文件名并在本地读取对应的文件，绕过 DNS 校验限制：
```javascript
    // 1. 获取视频资源
    if (url) {
      // 检查是否为本地上传的直链视频，若是则直接使用本地文件路径
      if (url.includes('/api/temp_videos/')) {
        const urlObj = new URL(url);
        const filename = path.basename(urlObj.pathname);
        const localPath = path.join(TMP_VIDEO_DIR, filename);
        
        if (fs.existsSync(localPath)) {
          taskQueue.updateTask(taskId, { progress: 40, logs: ['检测到本地直链视频，直接使用本地文件，准备提取音轨...'] });
          videoPath = localPath;
        } else {
          throw new Error('本地直链对应的视频文件不存在');
        }
      } else {
        // 原有外部 URL 校验与下载逻辑
        taskQueue.updateTask(taskId, { progress: 10, logs: [`校验视频链接: ${url}`] });
        const isValid = await validateUrl(url);
        if (!isValid) {
          throw new Error('视频链接格式非法或为受限的内部地址');
        }

        taskQueue.updateTask(taskId, { progress: 15, logs: ['开始从链接下载视频...'] });
        videoPath = path.join(TMP_VIDEO_DIR, `video_${taskId}.mp4`);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`视频下载失败，HTTP 状态码: ${response.status}`);
        }

        // 检查 Content-Length 限制 (默认 200MB)
        const contentLength = response.headers.get('content-length');
        const maxBytes = (parseInt(process.env.MAX_VIDEO_UPLOAD_MB, 10) || 200) * 1024 * 1024;
        if (contentLength && parseInt(contentLength, 10) > maxBytes) {
          throw new Error(`视频文件过大，超出系统限制 (${process.env.MAX_VIDEO_UPLOAD_MB || 200}MB)`);
        }

        const fileStream = fs.createWriteStream(videoPath);
        const reader = response.body.getReader();
        
        let downloadedBytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fileStream.write(Buffer.from(value));
          downloadedBytes += value.length;
          
          if (downloadedBytes > maxBytes) {
            fileStream.close();
            throw new Error(`视频文件过大，超出系统限制 (${process.env.MAX_VIDEO_UPLOAD_MB || 200}MB)`);
          }
        }
        fileStream.close();
        taskQueue.updateTask(taskId, { progress: 40, logs: ['视频下载完成，准备提取音轨...'] });
      }
    } else if (filePath) {
      // ... 原有逻辑保持不变
```

---

### 3. 前端修改上传逻辑，优先直接上传，失败后 fallback 到分片上传

修改文件：`D:\cursor\work\super-agent\src\components\VideoTranscribePanel.tsx`

**修改内容：重写 `handleSubmit` 的 `selectedFile` 上传逻辑**
将前端原本的“直接进行分片上传”改为“优先直接上传，若报错则退回原分片上传”：
```typescript
      if (selectedFile) {
        let directUploadSuccess = false;
        let taskId = '';

        try {
          // 步骤 1：尝试直接上传
          setSubmitStatus('正在尝试直接上传视频文件...');
          const directFormData = new FormData();
          directFormData.append('video', selectedFile);

          const uploadRes = await fetch(`${API_BASE}/api/materials/upload-direct`, {
            method: 'POST',
            body: directFormData,
          });

          if (!uploadRes.ok) {
            throw new Error(`直接上传失败，HTTP 状态码: ${uploadRes.status}`);
          }

          const uploadData = await uploadRes.json();
          if (!uploadData.success || !uploadData.url) {
            throw new Error(uploadData.error || '直接上传未返回有效直链');
          }

          // 步骤 2：使用返回的直链 URL 调用解析接口
          setSubmitStatus('直接上传成功！正在提交视频直链并创建转写任务...');
          const parseFormData = new FormData();
          parseFormData.append('language', language);
          parseFormData.append('subtitle', topicHint);
          parseFormData.append('url', uploadData.url);

          const parseRes = await fetch(`${API_BASE}/api/materials/fetch-video`, {
            method: 'POST',
            body: parseFormData,
          });

          if (!parseRes.ok) {
            throw new Error(`提交直链解析失败，HTTP 状态码: ${parseRes.status}`);
          }

          const parseData = await parseRes.json();
          if (!parseData.success) {
            throw new Error(parseData.error || '创建转写任务失败');
          }

          taskId = parseData.taskId;
          directUploadSuccess = true;
          setSubmitStatus('任务已成功建立！');
        } catch (directError: any) {
          console.warn('[Direct Upload Failed, falling back to chunks]:', directError);
          // 步骤 3：直接上传失败，进行退回分片上传的托底处理
          setSubmitStatus('直接上传受限或失败，正在启动备用分片上传方案...');
          
          const uploadId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
          const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB 一个分片
          const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);

          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
            const chunkBlob = selectedFile.slice(start, end);

            let success = false;
            let retries = 3;
            while (retries > 0 && !success) {
              try {
                const chunkFormData = new FormData();
                chunkFormData.append('uploadId', uploadId);
                chunkFormData.append('chunkIndex', String(i));
                chunkFormData.append('totalChunks', String(totalChunks));
                chunkFormData.append('chunk', chunkBlob, selectedFile.name);

                const percent = Math.round((i / totalChunks) * 100);
                setSubmitStatus(`正在分片上传视频 (${i + 1}/${totalChunks}) - 进度: ${percent}% ...`);

                const chunkRes = await fetch(`${API_BASE}/api/materials/upload-chunk`, {
                  method: 'POST',
                  body: chunkFormData,
                });

                if (!chunkRes.ok) {
                  throw new Error(`HTTP 错误 ${chunkRes.status}`);
                }
                success = true;
              } catch (err: any) {
                retries--;
                if (retries <= 0) {
                  throw new Error(`分片 (${i + 1}/${totalChunks}) 上传失败: ${err.message || '网络连接中断，请重试'}`);
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }
          }

          // 所有分片上传完毕，合并分片
          setSubmitStatus('分片上传完成，正在通知服务器合并文件并创建转写任务...');
          const mergeRes = await fetch(`${API_BASE}/api/materials/merge-chunks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              uploadId,
              fileName: selectedFile.name,
              language,
              subtitle: topicHint,
              totalChunks,
            }),
          });

          if (!mergeRes.ok) {
            throw new Error('分片合并请求失败');
          }

          const mergeData = await mergeRes.json();
          if (!mergeData.success) {
            throw new Error(mergeData.error || '分片合并转写失败');
          }
          taskId = mergeData.taskId;
        }

        // 通知上层组件任务已成功建立
        onTaskCreated(taskId);
      } else {
        // ... 原有 URL 链接提交逻辑
```

---

