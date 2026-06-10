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
 * @param {object} options 输入参数 ({ url, fileBase64, filePath, fileName, language, subtitle })
 */
async function startTranscribeTask(taskId, { url, fileBase64, filePath, fileName, language = 'auto', subtitle = '' }) {
  let videoPath = null;
  let audioPath = null;

  try {
    taskQueue.updateTask(taskId, { status: 'running', progress: 5, logs: ['正在初始化转写任务...'] });

    // 1. 获取视频资源
    if (url) {
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

    taskQueue.updateTask(taskId, { progress: 95, logs: ['转写成果提取成功，正在封装虚拟材料并清理垃圾...'] });

    // 5. 组装虚拟材料 VirtualMaterial
    const virtualMaterial = {
      name: fileName ? `${path.parse(fileName).name}_transcript.md` : `video_transcript_${taskId}.md`,
      content: `# 视频转写材料\n\n> 来源: ${url ? url : '本地上传视频'}\n> 识别语言: ${language}\n\n${transcript}`,
      mimeType: 'text/markdown',
      sourceType: 'video',
      sourceUrl: url || undefined
    };

    // 6. 成功更新任务
    taskQueue.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      logs: ['转写任务已顺利完成！虚拟材料已生成。'],
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
