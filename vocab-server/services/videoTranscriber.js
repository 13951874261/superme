const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { validateUrl } = require('./urlValidator');
const taskQueue = require('./taskQueue');

// 临时目录初始化
const TMP_VIDEO_DIR = process.env.TMP_VIDEO_DIR || path.join(__dirname, '../public/temp_videos');
if (!fs.existsSync(TMP_VIDEO_DIR)) {
  fs.mkdirSync(TMP_VIDEO_DIR, { recursive: true });
}

/**
 * 启动异步视频转写后台任务
 * @param {string} taskId 任务ID
 * @param {object} options 输入参数 ({ url, fileBase64, filePath, fileName, language, subtitle, keepVideo, skipVocab })
 */
async function startTranscribeTask(taskId, {
  url,
  fileBase64,
  filePath,
  fileName,
  language = 'auto',
  subtitle = '',
  keepVideo = false,
  skipVocab = false,
  deferComplete = false,
} = {}) {
  let videoPath = null;
  let audioPath = null;

  try {
    taskQueue.updateTask(taskId, { status: 'running', progress: 5, logs: ['正在初始化转写任务…'] });

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
          taskQueue.updateTask(taskId, { progress: 40, logs: ['检测到本地直链视频，直接使用本地文件，准备提取音轨…'] });
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

        taskQueue.updateTask(taskId, { progress: 15, logs: ['开始从链接下载视频…'] });
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
      taskQueue.updateTask(taskId, { progress: 20, logs: ['接收到上传的视频文件…'] });
      videoPath = filePath;

      const stats = fs.statSync(videoPath);
      const maxBytes = (parseInt(process.env.MAX_VIDEO_UPLOAD_MB, 10) || 200) * 1024 * 1024;
      if (stats.size > maxBytes) {
        throw new Error(`上传视频文件过大，超出系统限制 (${process.env.MAX_VIDEO_UPLOAD_MB || 200}MB)`);
      }
      taskQueue.updateTask(taskId, { progress: 40, logs: ['视频文件就位，准备提取音轨'] });
    } else if (fileBase64) {
      taskQueue.updateTask(taskId, { progress: 20, logs: ['接收到上传的视频文件，正在还原…'] });
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
    taskQueue.updateTask(taskId, { progress: 50, logs: ['启动 FFmpeg 音轨提取组件…'] });

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

    taskQueue.updateTask(taskId, { progress: 65, logs: ['音轨提取成功 (16kHz 单声道 MP3)，开始本机 Whisper 切片转写…'] });

    // 3. 本机 Whisper：固定 5 分钟切片、串行识别、失败片标注缺口、整段润色
    const { transcribeAudioFileSliced } = require('./audioTranscriptionService');
    const sttResult = await transcribeAudioFileSliced(audioPath, {
      language,
      onProgress: ({ message, index, chunkCount }) => {
        const base = 65;
        const span = 25;
        let progress = base;
        if (typeof index === 'number' && chunkCount > 0) {
          progress = Math.min(90, base + Math.floor(((index + 1) / chunkCount) * span));
        }
        taskQueue.updateTask(taskId, {
          progress,
          logs: [message || '本机 Whisper 转写中…'],
        });
      },
    });

    const transcript = String(sttResult?.text || '').trim();
    if (!transcript) {
      throw new Error('语音识别成功，但返回的文本为空。请确认视频内包含人声并选择了正确的语言');
    }

    const gapCount = Array.isArray(sttResult.gaps) ? sttResult.gaps.length : 0;
    const chunkCount = sttResult.chunkCount || 0;
    taskQueue.updateTask(taskId, {
      progress: 95,
      logs: [
        gapCount > 0
          ? `转写完成：共 ${chunkCount} 片，其中 ${gapCount} 片失败已标注缺口，正在封装虚拟材料…`
          : `转写完成：共 ${chunkCount} 片，正在封装虚拟材料…`,
      ],
    });

    // 4. 组装虚拟材料 VirtualMaterial
    const virtualMaterial = {
      name: fileName ? `${path.parse(fileName).name}_transcript.md` : `video_transcript_${taskId}.md`,
      content: `# 视频转写材料\n\n> 来源: ${url ? url : '本地上传视频'}\n> 识别语言: ${language}\n> 引擎: 本机 Whisper（5分钟切片）\n${gapCount > 0 ? `> 缺口片数: ${gapCount}\n` : ''}\n${transcript}`,
      mimeType: 'text/markdown',
      sourceType: 'video',
      sourceUrl: url || undefined,
      transcript: String(transcript),
      videoPath: keepVideo ? videoPath : undefined,
    };

    if (skipVocab) {
      if (!deferComplete) {
        taskQueue.updateTask(taskId, {
          status: 'completed',
          progress: 100,
          logs: ['转写完成（已跳过生词本提纯）'],
          result: virtualMaterial,
        });
      } else {
        taskQueue.updateTask(taskId, {
          progress: 70,
          logs: ['转写完成，等待后续抽取…'],
        });
      }
      return virtualMaterial;
    }

    // 自动触发 Dify 知识库导入与提纯分析入库
    taskQueue.updateTask(taskId, { progress: 96, logs: ['转写成功！正在自动执行 Dify 知识库导入与提纯分析…'] });

    const DATASET_KEY = process.env.DIFY_VIDEO_DATASET_KEY || 'dataset-Jk5ehEEDT72wmXI5P68hcTlI';
    const WORKFLOW_KEY = process.env.DIFY_VIDEO_WORKFLOW_KEY || 'app-cArGQg7bAnePU0ts63FoHrAG';
    const BASE_URL = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
    const KNOWLEAGE_PRO_SCENARIOS_DATASET_ID = 'c53857b1-f54f-42ef-a6e8-fe54e9333862';

    // 1. 使用固定 ID 访问 Knowleage_Pro_Scenarios 知识库
    const datasetId = KNOWLEAGE_PRO_SCENARIOS_DATASET_ID;

    // 2. 清空旧文档
    taskQueue.updateTask(taskId, { logs: ['正在清空 Knowleage_Pro_Scenarios 知识库旧文档…'] });
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
    taskQueue.updateTask(taskId, { logs: ['正在上传转写文件至 Dify 知识库…'] });
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
    taskQueue.updateTask(taskId, { progress: 98, logs: ['知识库向量化就绪！开始运行 Dify 提纯分析工作流…'] });
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
    const classified = classifyExtractedItems(rawExtracted);

    virtualMaterial.article = transcript;
    virtualMaterial.words = classified.words;
    virtualMaterial.phrases = classified.phrases;
    virtualMaterial.sentences = classified.sentences;

    const totalCandidates = classified.words.length + classified.phrases.length + classified.sentences.length;
    taskQueue.updateTask(taskId, {
      logs: [
        totalCandidates > 0
          ? `提纯提取成功：生词 ${classified.words.length} / 短语 ${classified.phrases.length} / 句型 ${classified.sentences.length}。不写入生词本，请逐条点「+ 收录」。`
          : '提纯完成，未抽出词句。不写入生词本。',
      ],
    });

    taskQueue.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      logs: ['转写与提纯完成。候选已在「上传材料」中展示，请手动收录。'],
      result: virtualMaterial,
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
      if (!keepVideo && videoPath && fs.existsSync(videoPath)) {
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

/**
 * 仅转写本地视频文件，不写生词本、不结束外部任务编排以外的逻辑。
 * 供 tactics_ingest 复用；默认保留视频文件。
 */
async function extractTranscriptFromLocalVideo({
  taskId,
  filePath,
  fileName,
  language = 'auto',
  keepVideo = true,
} = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('视频文件不存在');
  }
  const nestedTaskId = taskId || `inline_${Date.now()}`;
  // 复用 startTranscribeTask 的 STT 段：用临时 task 状态更新同一 taskId
  const result = await startTranscribeTask(nestedTaskId, {
    filePath,
    fileName: fileName || path.basename(filePath),
    language,
    keepVideo,
    skipVocab: true,
    deferComplete: true,
  });
  return {
    transcript: String((result && result.transcript) || '').trim(),
    videoPath: filePath,
    virtualMaterial: result,
  };
}

function itemText(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  return String(item.word || item.phrase || item.sentence || item.text || '').trim();
}

function countWords(str) {
  if (!str || typeof str !== 'string') return 0;
  return str
    .trim()
    .replace(/[.!?,;:'"()[\]{}]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function classifyByWordCount(wordStr) {
  const trimmed = String(wordStr || '').trim();
  if (!trimmed) return 'ai_extracted';
  const wc = countWords(trimmed);
  const endsWithPunctuation = /[.!?]$/.test(trimmed);
  if (wc >= 5 && endsWithPunctuation) return 'ai_sentence';
  if (wc >= 2 && !endsWithPunctuation) return 'ai_phrase';
  return 'ai_extracted';
}

function classifyExtractedItems(rawExtracted) {
  let extractedItems = [];
  if (Array.isArray(rawExtracted)) {
    extractedItems = rawExtracted;
  } else if (typeof rawExtracted === 'string') {
    let cleanJson = rawExtracted.trim();
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.substring(7);
    else if (cleanJson.startsWith('```')) cleanJson = cleanJson.substring(3);
    if (cleanJson.endsWith('```')) cleanJson = cleanJson.substring(0, cleanJson.length - 3);
    cleanJson = cleanJson.trim();
    try {
      const parsed = JSON.parse(cleanJson);
      if (parsed.words && Array.isArray(parsed.words)) extractedItems.push(...parsed.words);
      if (parsed.phrases && Array.isArray(parsed.phrases)) extractedItems.push(...parsed.phrases);
      if (parsed.sentences && Array.isArray(parsed.sentences)) {
        extractedItems.push(...parsed.sentences.map((s) => (
          typeof s === 'string' ? { word: s, is_sentence: true } : s
        )));
      }
      if (extractedItems.length === 0 && Array.isArray(parsed)) extractedItems = parsed;
    } catch (_) {
      extractedItems = cleanJson.split(/[,，\n]+/).map((s) => s.trim()).filter((s) => s.length > 0 && s.length < 200);
    }
  }

  const words = [];
  const phrases = [];
  const sentences = [];
  for (const item of extractedItems) {
    const text = itemText(item);
    if (!text) continue;
    const dictType = (item && item.is_sentence) ? 'ai_sentence' : classifyByWordCount(text);
    if (dictType === 'ai_sentence') sentences.push(text);
    else if (dictType === 'ai_phrase') phrases.push(text);
    else words.push(text);
  }
  return { words, phrases, sentences };
}

module.exports = { startTranscribeTask, extractTranscriptFromLocalVideo };
