const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

let activeLocalJobs = 0;
const MAX_LOCAL_CONCURRENCY = 1;
const SLICE_SECONDS = 300; // 固定 5 分钟/片

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatMmSs(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function cleanWhisperText(text) {
  return String(text || '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function acquireLocalSlot({ wait = false, timeoutMs = 30 * 60 * 1000, label = '' } = {}) {
  const started = Date.now();
  while (activeLocalJobs >= MAX_LOCAL_CONCURRENCY) {
    if (!wait) {
      console.log('[语音调度] 专属语音引擎当前正忙，拒绝新请求: ' + label);
      throw new Error('专属语音引擎正忙，请稍后重试');
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error('专属语音引擎长时间繁忙，请稍后重试');
    }
    console.log('[语音调度] 专属语音引擎正忙，排队等待: ' + label);
    await sleep(2000);
  }
  activeLocalJobs++;
}

function releaseLocalSlot() {
  activeLocalJobs = Math.max(0, activeLocalJobs - 1);
}

/**
 * 单次本机 Whisper 推理（不润色）
 */
async function inferLocalWhisperOnce(filePath, {
  originalName = 'audio.mp3',
  mimeType = 'audio/mp3',
  language = 'auto',
  waitForSlot = false,
} = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('音频临时文件不存在，无法转写');
  }

  await acquireLocalSlot({ wait: waitForSlot, label: originalName });
  console.log('[语音识别] 正在通过专属语音引擎解析学员发音音频: ' + originalName);

  let rawText = '';
  let rawSuccess = false;
  let failReason = '';

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const localFormData = new globalThis.FormData();
    const localBlob = new globalThis.Blob([fileBuffer], { type: mimeType });
    localFormData.append('file', localBlob, originalName);
    localFormData.append('language', language || 'auto');
    localFormData.append('initial_prompt', '简体中文, English, transcript, 录音.');

    const localResponse = await fetch('http://127.0.0.1:8080/inference', {
      method: 'POST',
      body: localFormData,
    });

    if (localResponse.ok) {
      const localData = await localResponse.json().catch(() => ({}));
      rawText = cleanWhisperText(typeof localData.text === 'string' ? localData.text : '');
      rawSuccess = true;
      console.log('[语音识别] 专属语音引擎解析完成，已完成背景降噪与文本规整: ' + rawText);
    } else {
      failReason = '专属语音引擎返回状态异常 (' + localResponse.status + ')';
      console.warn('[语音容灾] ' + failReason + '，已中止（不再降级云端 STT）');
    }
  } catch (localErr) {
    failReason = localErr.message || '专属语音引擎暂时不可用';
    console.warn('[语音容灾] 专属语音引擎暂时不可用，已中止（不再降级云端 STT）: ' + failReason);
  } finally {
    releaseLocalSlot();
  }

  if (!rawSuccess) {
    throw new Error('本地 Whisper 转写失败，请确认 whisper-server 是否可用: ' + (failReason || 'unknown'));
  }
  return rawText;
}

async function polishTranscriptOrFallback(rawText) {
  if (!rawText) return '';
  console.log('[发音规整] 正在对识别文本进行口语表达优化与标点还原: "' + rawText.slice(0, 200) + (rawText.length > 200 ? '…' : '') + '"');
  try {
    const polishedText = await callPolishLLM(rawText);
    const finalText = (polishedText && String(polishedText).trim()) || rawText;
    if (!polishedText || !String(polishedText).trim()) {
      console.warn('[发音规整] 润色结果为空，回退原始文本');
    } else {
      console.log('[发音规整] 口语表达优化完成，长度: ' + finalText.length);
    }
    return finalText;
  } catch (polishErr) {
    console.warn('[发音规整] 表达优化服务未响应，直接采用原始识别文本: ' + polishErr.message);
    return rawText;
  }
}

async function transcribeAudioFile(fileObj, userId = 'default-user') {
  if (!fileObj?.path || !fs.existsSync(fileObj.path)) {
    throw new Error('音频临时文件不存在，无法转写');
  }
  const mimeType = fileObj.mimetype || 'audio/mp3';
  const originalName = fileObj.originalname || 'audio.mp3';

  const rawText = await inferLocalWhisperOnce(fileObj.path, {
    originalName,
    mimeType,
    waitForSlot: false,
  });

  if (!rawText) {
    console.log('[语音识别] 未检测到有效发音内容，直接返回');
    return '';
  }
  return polishTranscriptOrFallback(rawText);
}

function listChunkFiles(chunkDir, prefix) {
  return fs.readdirSync(chunkDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.mp3'))
    .sort()
    .map((name) => path.join(chunkDir, name));
}

async function splitAudioIntoSlices(audioPath, chunkDir, sliceSeconds = SLICE_SECONDS) {
  if (!fs.existsSync(chunkDir)) {
    fs.mkdirSync(chunkDir, { recursive: true });
  }
  const prefix = 'chunk_';
  const pattern = path.join(chunkDir, `${prefix}%03d.mp3`);
  const cmd = `ffmpeg -y -i "${audioPath}" -f segment -segment_time ${sliceSeconds} -ar 16000 -ac 1 -acodec libmp3lame "${pattern}"`;

  await new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (error) {
        console.error('[FFmpeg Slice Error]:', stderr);
        reject(new Error(`音频切片失败: ${error.message}`));
      } else {
        resolve();
      }
    });
  });

  const chunks = listChunkFiles(chunkDir, prefix);
  if (chunks.length === 0) {
    // 极短音频可能未产出 segment，回退整文件
    return [audioPath];
  }
  return chunks;
}

/**
 * 长音频：固定 5 分钟切片 → 串行本机 Whisper → 失败片标注缺口 → 整段润色一次
 * @returns {{ text: string, gaps: Array<{ index: number, startSec: number, endSec: number, reason: string }>, chunkCount: number }}
 */
async function transcribeAudioFileSliced(audioPath, {
  language = 'auto',
  sliceSeconds = SLICE_SECONDS,
  onProgress,
  userId = 'default-user',
} = {}) {
  if (!audioPath || !fs.existsSync(audioPath)) {
    throw new Error('音频文件不存在，无法切片转写');
  }

  const chunkDir = path.join(os.tmpdir(), `whisper-slices-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  let chunkPaths = [];

  try {
    if (typeof onProgress === 'function') {
      onProgress({ stage: 'slice', message: `正在按 ${sliceSeconds}s 切片…` });
    }
    chunkPaths = await splitAudioIntoSlices(audioPath, chunkDir, sliceSeconds);
    const chunkCount = chunkPaths.length;
    console.log(`[语音切片] 共 ${chunkCount} 片，开始串行转写`);

    const parts = [];
    const gaps = [];

    for (let i = 0; i < chunkCount; i++) {
      const startSec = i * sliceSeconds;
      const endSec = (i + 1) * sliceSeconds;
      const rangeLabel = `${formatMmSs(startSec)}-${formatMmSs(endSec)}`;
      const chunkPath = chunkPaths[i];
      const chunkName = path.basename(chunkPath);

      if (typeof onProgress === 'function') {
        onProgress({
          stage: 'transcribe',
          message: `正在转写第 ${i + 1}/${chunkCount} 片 (${rangeLabel})…`,
          index: i,
          chunkCount,
        });
      }

      try {
        const piece = await inferLocalWhisperOnce(chunkPath, {
          originalName: chunkName,
          mimeType: 'audio/mpeg',
          language,
          waitForSlot: true,
        });
        if (piece) {
          parts.push(piece);
        } else {
          console.log(`[语音切片] 第 ${i + 1} 片无有效人声，跳过`);
        }
      } catch (chunkErr) {
        const marker = `[转写缺口 ${rangeLabel}]`;
        parts.push(marker);
        gaps.push({
          index: i,
          startSec,
          endSec,
          reason: chunkErr.message || 'whisper failed',
        });
        console.warn(`[语音切片] 第 ${i + 1} 片失败，跳过并标注: ${chunkErr.message}`);
      }
    }

    const joined = parts.join('\n').trim();
    const successCount = chunkCount - gaps.length;
    // 全部失败（每片都进 gaps）或拼接后无任何文本
    if (!joined || successCount === 0) {
      throw new Error('本地 Whisper 切片转写全部失败，请确认 whisper-server 是否可用');
    }

    if (typeof onProgress === 'function') {
      onProgress({
        stage: 'polish',
        message: gaps.length
          ? `转写完成（含 ${gaps.length} 处缺口），正在整段润色…`
          : '转写完成，正在整段润色…',
        gaps,
      });
    }

    const text = await polishTranscriptOrFallback(joined);
    return { text, gaps, chunkCount };
  } finally {
    try {
      if (fs.existsSync(chunkDir)) {
        for (const f of fs.readdirSync(chunkDir)) {
          try { fs.unlinkSync(path.join(chunkDir, f)); } catch (_) {}
        }
        try { fs.rmdirSync(chunkDir); } catch (_) {}
      }
    } catch (cleanupErr) {
      console.warn('[语音切片] 临时切片清理失败:', cleanupErr.message);
    }
  }
}

async function callPolishLLM(rawText) {
  const { chatCompletions, extractAssistantContent, DEFAULT_LLM_KEY } = require('./openaiCompatLlm');
  const apiKey = process.env.LISTEN_LLM_API_KEY || process.env.DIFY_LISTEN_LLM_API_KEY || DEFAULT_LLM_KEY;
  const systemPrompt = "你是一位专业的语音识别（ASR）后处理专家。你的任务是对原始识别文本进行纠错、标点恢复和格式化，使其成为一篇通顺、可读的标准文本。直接输出处理后的文本，不要任何解释、标记或格式化（如不要 markdown 代码块）。若输入已通顺、仅为单词/短词、你不确定如何纠正，或无法有效润色，必须原样输出输入文本，禁止输出空字符串。仅当输入本身为空或仅为杂音标签时才输出空字符串。请保留文本中形如 [转写缺口 MM:SS-MM:SS] 的缺口标记，不要删除或改写。";
  const userPrompt = "请处理以下语音识别原始文本：\n\n" + rawText;
  const data = await chatCompletions({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    timeoutMs: 120000,
    apiKey,
  });
  const content = extractAssistantContent(data).trim();
  return content || String(rawText || '').trim();
}

module.exports = {
  transcribeAudioFile,
  transcribeAudioFileSliced,
  callPolishLLM,
  SLICE_SECONDS,
  MAX_LOCAL_CONCURRENCY,
};
