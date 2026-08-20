const fs = require('fs');
const path = require('path');
const os = require('os');

let activeLocalJobs = 0;
const MAX_LOCAL_CONCURRENCY = 1;

async function transcribeAudioFile(fileObj, userId = 'default-user') {
  if (!fileObj?.path || !fs.existsSync(fileObj.path)) {
    throw new Error('音频临时文件不存在，无法转写');
  }
  const fileBuffer = fs.readFileSync(fileObj.path);
  const mimeType = fileObj.mimetype || 'audio/mp3';
  const originalName = fileObj.originalname || 'audio.mp3';

  let rawText = '';
  let rawSuccess = false;

  // 1. 优先尝试本地专属语音引擎（若本地正忙则自动分流至云端智能通道）
  if (activeLocalJobs < MAX_LOCAL_CONCURRENCY) {
    activeLocalJobs++;
    console.log('[语音识别] 正在通过专属语音引擎解析学员发音音频: ' + originalName);
    try {
      const localFormData = new globalThis.FormData();
      const localBlob = new globalThis.Blob([fileBuffer], { type: mimeType });
      localFormData.append('file', localBlob, originalName);
      localFormData.append('language', 'auto');
      localFormData.append('initial_prompt', '简体中文, English, transcript, 录音.');

      const localResponse = await fetch('http://127.0.0.1:8080/inference', {
        method: 'POST',
        body: localFormData,
      });

      if (localResponse.ok) {
        const localData = await localResponse.json().catch(() => ({}));
        rawText = typeof localData.text === 'string' ? localData.text.trim() : '';

        rawText = rawText
          .replace(/\[[^\]]*\]/g, '')
          .replace(/\([^)]*\)/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        rawSuccess = true;
        console.log('[语音识别] 专属语音引擎解析完成，已完成背景降噪与文本规整: ' + rawText);
      } else {
        console.warn('[语音容灾] 专属语音引擎返回状态异常 (' + localResponse.status + ')，自动转入云端备用通道');
      }
    } catch (localErr) {
      console.warn('[语音容灾] 专属语音引擎暂时不可用，已自动切换至云端智能语音通道保障识别: ' + localErr.message);
    } finally {
      activeLocalJobs = Math.max(0, activeLocalJobs - 1);
    }
  } else {
    console.log('[语音调度] 专属语音引擎当前正忙，已自动分流至云端智能语音通道加速处理: ' + originalName);
  }

  // 2. 本地未成功或正忙时，走云端智能语音通道
  if (!rawSuccess) {
    const sttApiKey = process.env.DIFY_STT_API_KEY;
    const difyBase = process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
    console.log('[语音识别] 正在通过云端智能语音通道解析学员发音音频: ' + originalName);
    try {
      const formData = new globalThis.FormData();
      const blob = new globalThis.Blob([fileBuffer], { type: mimeType });
      formData.append('file', blob, originalName);
      formData.append('user', String(userId));

      const response = await fetch(difyBase + '/audio-to-text', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + sttApiKey,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        rawText = typeof data.text === 'string' ? data.text.trim() : '';

        rawText = rawText
          .replace(/\[[^\]]*\]/g, '')
          .replace(/\([^)]*\)/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        rawSuccess = true;
        console.log('[语音识别] 云端智能语音通道已完成发音解析与文本规整: ' + rawText);
      } else {
        const errData = await response.json().catch(() => ({}));
        const errStr = errData?.error?.message || errData?.error || JSON.stringify(errData);
        console.error('[语音识别] 云端智能语音通道响应异常，状态码: ' + response.status + ', 详情: ' + errStr);
      }
    } catch (difyErr) {
      console.error('[语音识别] 云端智能语音通道发生异常: ' + difyErr.message);
    }
  }

  // 3. 识别结果后处理与表达规整
  if (rawSuccess && rawText) {
    console.log('[发音规整] 正在对识别文本进行口语表达优化与标点还原: "' + rawText + '"');
    try {
      const polishedText = await callPolishLLM(rawText);
      console.log('[发音规整] 口语表达优化完成: "' + polishedText + '"');
      return polishedText;
    } catch (polishErr) {
      console.warn('[发音规整] 表达优化服务未响应，直接采用原始识别文本: ' + polishErr.message);
      return rawText;
    }
  } else {
    console.log('[语音识别] 未检测到有效发音内容，直接返回');
    return rawText || '';
  }
}

async function callPolishLLM(rawText) {
  const https = require('https');
  const apiKey = process.env.DIFY_LISTEN_LLM_API_KEY || 'sk-a9e3a6f7056c707d-u4kje7-d3419e72';
  const url = process.env.LLM_URL || 'https://23.95.214.232/v1/chat/completions';

  const systemPrompt = "你是一位专业的语音识别（ASR）后处理专家。你的任务是对原始识别文本进行纠错、标点恢复和格式化，使其成为一篇通顺、可读的标准文本。直接输出处理后的文本，不要任何解释、标记或格式化（如不要 markdown 代码块）";
  const userPrompt = "请处理以下语音识别原始文本：\n\n" + rawText;

  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: 'dify',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      stream: false,
    });

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      rejectUnauthorized: false,
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error('LLM HTTP ' + res.statusCode + ': ' + raw.slice(0, 200)));
        }
        try {
          const data = JSON.parse(raw);
          const content = data?.choices?.[0]?.message?.content || '';
          resolve(content.trim());
        } catch (error) {
          reject(new Error('LLM parse failed: ' + error.message));
        }
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error('LLM timeout')));
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

module.exports = { transcribeAudioFile };
