const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { validateUrl } = require('./urlValidator');
const taskQueue = require('./taskQueue');
const Database = require('better-sqlite3');
const crypto = require('crypto');

// 临时目录初始化
const TMP_VIDEO_DIR = process.env.TMP_VIDEO_DIR || path.join(__dirname, '../public/temp_videos');
if (!fs.existsSync(TMP_VIDEO_DIR)) {
  fs.mkdirSync(TMP_VIDEO_DIR, { recursive: true });
}

/**
 * 启动异步视频转写后台任务
 * @param {string} taskId 任务ID
 * @param {object} options 输入参数 ({ url, fileBase64, filePath, fileName, language, subtitle })
 */
async function startTranscribeTask(taskId, { url, fileBase64, filePath, fileName, language = 'auto', subtitle = '' }) {
  let videoPath = null;
  let audioPath = null;

  try {
    taskQueue.updateTask(taskId, { status: 'running', progress: 5, logs: ['正在初始化转写任务...'] });

    // 1. 获取视频资源
    if (url) {
      if (url.includes('/api/temp_videos/')) {
        let filename;
        try {
          const urlObj = new URL(url);
          filename = path.basename(urlObj.pathname);
        } catch (e) {
          filename = path.basename(url);
        }
        const localPath = path.join(TMP_VIDEO_DIR, filename);
        
        if (fs.existsSync(localPath)) {
          taskQueue.updateTask(taskId, { progress: 40, logs: ['检测到本地直链视频，直接使用本地文件，准备提取音轨...'] });
          videoPath = localPath;
        } else {
          throw new Error('本地直链对应的视频文件不存在');
        }
      } else {
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
        taskQueue.updateTask(taskId, { progress: 40, logs: ['视频下载完成，准备提取音轨'] });
      }
    } else if (filePath) {
      taskQueue.updateTask(taskId, { progress: 20, logs: ['接收到上传的视频文件...'] });
      videoPath = filePath;

      const stats = fs.statSync(videoPath);
      const maxBytes = (parseInt(process.env.MAX_VIDEO_UPLOAD_MB, 10) || 200) * 1024 * 1024;
      if (stats.size > maxBytes) {
        throw new Error(`上传视频文件过大，超出系统限制 (${process.env.MAX_VIDEO_UPLOAD_MB || 200}MB)`);
      }
      taskQueue.updateTask(taskId, { progress: 40, logs: ['视频文件就位，准备提取音轨'] });
    } else if (fileBase64) {
      taskQueue.updateTask(taskId, { progress: 20, logs: ['接收到上传的视频文件，正在还原...'] });
      const name = fileName || `uploaded_${taskId}.mp4`;
      videoPath = path.join(TMP_VIDEO_DIR, `video_${taskId}_${name}`);

      const base64Data = fileBase64.replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const maxBytes = (parseInt(process.env.MAX_VIDEO_UPLOAD_MB, 10) || 200) * 1024 * 1024;
      if (buffer.length > maxBytes) {
        throw new Error(`上传视频文件过大，超出系统限制 (${process.env.MAX_VIDEO_UPLOAD_MB || 200}MB)`);
      }

      fs.writeFileSync(videoPath, buffer);
      taskQueue.updateTask(taskId, { progress: 40, logs: ['视频文件还原成功，准备提取音轨'] });
    } else {
      throw new Error('未提供有效的视频链接或视频文件数据');
    }

    // 2. FFmpeg 音频提取 (MP3, 16kHz, 单声道)
    audioPath = path.join(TMP_VIDEO_DIR, `audio_${taskId}.mp3`);
    taskQueue.updateTask(taskId, { progress: 50, logs: ['启动 FFmpeg 音轨提取组件...'] });

    await new Promise((resolve, reject) => {
      // 提取音轨命令
      const cmd = `ffmpeg -y -i "${videoPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 "${audioPath}"`;
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error('[FFmpeg Error]:', stderr);
          reject(new Error(`音频提取失败 (系统可能未配置 FFmpeg 环境): ${error.message}`));
        } else {
          resolve();
        }
      });
    });

    taskQueue.updateTask(taskId, { progress: 65, logs: ['音轨提取成功 (16kHz 单声道 MP3)，开始上传至转写引擎...'] });

    // 3. 上传 MP3 到 Dify 平台获取 file_id
    const difyApiKey = process.env.DIFY_SPEECH_API_KEY || 'app-2LpliLyJ8viBKpacvyoOHSAV';
    const endpointBase = process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    const uploadFormData = new FormData();
    const audioBuffer = fs.readFileSync(audioPath);
    uploadFormData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'extracted_audio.mp3');
    uploadFormData.append('user', 'default-user');

    const uploadResponse = await fetch(`${endpointBase}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`
      },
      body: uploadFormData
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      throw new Error(`音频上传到识别平台失败: ${uploadResponse.status} - ${errText}`);
    }

    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.id;
    if (!fileId) {
      throw new Error('音频上传成功，但未返回文件ID');
    }

    taskQueue.updateTask(taskId, { progress: 75, logs: [`上传成功 (ID: ${fileId})，正在提交 Dify 语音转写工作流...`] });

    // 4. 调用 Dify 语音转写 Workflow
    const workflowResponse = await fetch(`${endpointBase}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          audio_file: {
            transfer_method: 'local_file',
            upload_file_id: fileId,
            type: 'audio'
          },
          language: language,
          subtitle: subtitle || ''
        },
        response_mode: 'blocking',
        user: 'default-user'
      })
    });

    if (!workflowResponse.ok) {
      const errText = await workflowResponse.text();
      throw new Error(`转写服务返回异常: ${workflowResponse.status} - ${errText}`);
    }

    const workflowResult = await workflowResponse.json();
    const outputs = workflowResult?.data?.outputs || {};
    
    // 获取转写产物（优先读取新工作流的 transcript_text 属性）
    const transcript = outputs.transcript_text || outputs.transcript || outputs.text || outputs.result || '';
    if (!transcript) {
      throw new Error('语音识别成功，但返回的文本为空。请确认视频内包含人声并选择了正确的语言');
    }

    taskQueue.updateTask(taskId, { progress: 95, logs: ['转写成果提取成功，正在封装虚拟材料...'] });

    // 5. 组装虚拟材料 VirtualMaterial
    const virtualMaterial = {
      name: fileName ? `${path.parse(fileName).name}_transcript.md` : `video_transcript_${taskId}.md`,
      content: `# 视频转写材料\n\n> 来源: ${url ? url : '本地上传视频'}\n> 识别语言: ${language}\n\n${transcript}`,
      mimeType: 'text/markdown',
      sourceType: 'video',
      sourceUrl: url || undefined
    };

    // 自动触发 Dify 知识库导入与提纯分析入库
    taskQueue.updateTask(taskId, { progress: 96, logs: ['转写成功！正在自动执行 Dify 知识库导入与提纯分析...'] });

    const DATASET_KEY = 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
    const WORKFLOW_KEY = 'app-cArGQg7bAnePU0ts63FoHrAG';
    const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

    // 1. 获取知识库列表，定位 English_Pro_Scenarios
    const dsResponse = await fetch(`${BASE_URL}/datasets?page=1&limit=100`, {
      headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
    });
    const dsData = await dsResponse.json();
    const dataset = dsData.data?.find(d => d.name === 'English_Pro_Scenarios');
    
    if (!dataset) {
      throw new Error('在 Dify 平台未找到名为 English_Pro_Scenarios 的知识库');
    }
    const datasetId = dataset.id;

    // 2. 清空旧文档
    taskQueue.updateTask(taskId, { logs: ['正在清空 Dify 知识库旧文档...'] });
    const docsResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/documents?page=1&limit=100`, {
      headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
    });
    const docsData = await docsResponse.json();
    const docIds = docsData.data?.map(d => d.id) || [];
    
    if (docIds.length > 0) {
      await Promise.all(docIds.map(docId => 
        fetch(`${BASE_URL}/datasets/${datasetId}/documents/${docId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
        })
      ));
    }

    // 3. 上传新文档并进行向量化
    taskQueue.updateTask(taskId, { logs: ['正在上传转写文件至 Dify 知识库...'] });
    const docBlob = new Blob([Buffer.from(virtualMaterial.content, 'utf-8')], { type: 'text/markdown' });
    const uploadDocFormData = new FormData();
    uploadDocFormData.append('file', docBlob, virtualMaterial.name);
    uploadDocFormData.append('data', JSON.stringify({ 
      indexing_technique: 'high_quality', 
      doc_form: 'hierarchical_model',
      process_rule: { 
        mode: 'hierarchical',
        rules: {
          pre_processing_rules: [
            { id: 'remove_extra_spaces', enabled: true },
            { id: 'remove_urls_emails', enabled: false }
          ],
          parent_mode: 'paragraph',
          segmentation: {
            separator: '\\n',
            max_tokens: 1000
          },
          subchunk_segmentation: {
            separator: '\\n',
            max_tokens: 200
          }
        }
      } 
    }));

    const uploadDocResponse = await fetch(`${BASE_URL}/datasets/${datasetId}/document/create_by_file`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DATASET_KEY}` },
      body: uploadDocFormData
    });
    
    if (!uploadDocResponse.ok) {
      const errText = await uploadDocResponse.text();
      throw new Error(`Dify 知识库文件入库遭拒: ${errText}`);
    }

    const uploadDocData = await uploadDocResponse.json();
    const documentId = uploadDocData.document?.id;
    const batchId = uploadDocData.batch; 

    if (!documentId || !batchId) {
      throw new Error('上传成功，但未从 Dify 拿到 batch ID');
    }

    // 4. 轮询嵌入状态
    let isIndexed = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusRes = await fetch(`${BASE_URL}/datasets/${datasetId}/documents/${batchId}/indexing-status`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${DATASET_KEY}` }
      });
      
      if (!statusRes.ok) continue;      
      const statusData = await statusRes.json();
      const docInfo = statusData.data?.[0];
      
      if (docInfo) {
        taskQueue.updateTask(taskId, { logs: [`知识库向量化进度: ${docInfo.indexing_status}`] });
        if (docInfo.indexing_status === 'completed') {
          isIndexed = true;
          break;
        } else if (docInfo.indexing_status === 'error') {
          throw new Error('Dify 向量化流水线切分报错');
        }
      }
    }

    if (!isIndexed) {
      throw new Error('Dify 向量化超时 (>120s)');
    }

    // 5. 触发 Dify 提纯工作流
    taskQueue.updateTask(taskId, { progress: 98, logs: ['知识库向量化就绪！开始运行 Dify 提纯分析工作流...'] });
    const wfResponse = await fetch(`${BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKFLOW_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: { topic: subtitle || 'General Business' },
        response_mode: 'blocking',
        user: 'system'
      })
    });
    
    const wfData = await wfResponse.json();
    if (!wfResponse.ok) throw new Error(`提纯工作流执行失败: ${JSON.stringify(wfData)}`);
    
    const wfOutputs = wfData?.data?.outputs || {};
    const rawExtracted = wfOutputs.extracted_words || wfOutputs.result || wfOutputs.text || '';
    
    let extractedWords = [];
    if (Array.isArray(rawExtracted)) {
      extractedWords = rawExtracted;
    } else if (typeof rawExtracted === 'string') {
      extractedWords = rawExtracted.split(/[,，\n]+/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 50);
    }

    // 6. 写入 SQLite
    taskQueue.updateTask(taskId, { logs: [`提纯提取成功，找到 ${extractedWords.length} 个候选词汇。正在查重新增至生词本...`] });
    const isProd = process.env.NODE_ENV === 'production';
    const dbPath = isProd ? '/var/www/super-agent/vocab.db' : path.join(__dirname, '../vocab.db');
    const db = new Database(dbPath);

    let addedCount = 0;
    const now = Date.now();
    for (const item of extractedWords) {
      const wordStr = typeof item === 'object' ? (item.word || JSON.stringify(item)) : item;
      const existing = db.prepare('SELECT id FROM vocabulary WHERE word = ? COLLATE NOCASE').get(wordStr);
      if (!existing) {
        const id = crypto.randomUUID();
        db.prepare(`
          INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, wordStr, 'ai_extracted', subtitle || 'material_extraction', JSON.stringify({ source: 'Video Auto Extraction' }), now, now, '[]');
        addedCount++;
      }
    }
    db.close();

    // 6. 成功更新任务
    taskQueue.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      logs: [`转写与自动提纯全部顺利完成！共新增 ${addedCount} 个词汇到生词本。`],
      result: virtualMaterial
    });

  } catch (err) {
    console.error(`[Video Transcribe Error - ${taskId}]:`, err);
    taskQueue.updateTask(taskId, {
      status: 'failed',
      progress: 100,
      logs: [`异常中断: ${err.message}`],
      error: err.message
    });
  } finally {
    // 垃圾清理
    try {
      if (videoPath && fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
      if (audioPath && fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    } catch (cleanupErr) {
      console.error('[Cleanup Error]:', cleanupErr);
    }
  }
}

module.exports = { startTranscribeTask };
