import { ComparisonResult } from '../types/listening';

// 优先从 localStorage 获取密钥，实现本地优先管理
const getApiKey = (keyName: string) => localStorage.getItem(keyName) || import.meta.env[`VITE_${keyName}`];

const DIFY_BASE_URL = import.meta.env.VITE_DIFY_BASE_URL || 'https://dify.234124123.xyz/v1'; // 适配自定义部署的 Dify

/**
 * 将任意 Audio Blob 转换为标准 PCM WAV Blob
 */
async function convertToWav(audioBlob: Blob): Promise<Blob> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const tempContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const originalBuffer = await tempContext.decodeAudioData(arrayBuffer);
  
  // 核心修复：强制重采样为 16kHz 单声道
  // 【关键追加】：为了防止单侧单词时间太短（<1秒）被大模型的 VAD (人声检测) 引擎当成噪音过滤掉，我们在前后各追加 0.5 秒静音。
  const targetSampleRate = 16000;
  const paddingSeconds = 0.5;
  const paddingFrames = Math.floor(paddingSeconds * targetSampleRate);
  const originalFrames = Math.ceil(originalBuffer.duration * targetSampleRate);
  const totalFrames = paddingFrames + originalFrames + paddingFrames;

  const offlineContext = new OfflineAudioContext(1, totalFrames, targetSampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = originalBuffer;
  source.connect(offlineContext.destination);
  // 在 0.5 秒处开始播放原始音频
  source.start(paddingSeconds);
  const audioBuffer = await offlineContext.startRendering();
  
  const numOfChan = 1;
  const length = audioBuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  
  const writeString = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + audioBuffer.length * numOfChan * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 16000 * numOfChan * 2, true);
  view.setUint16(32, numOfChan * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, audioBuffer.length * numOfChan * 2, true);
  
  const channelData = audioBuffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    let sample = channelData[i];
    sample = Math.max(-1, Math.min(1, sample));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, sample, true);
    offset += 2;
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * 调用 Dify 内置的语音转文字接口 (底层为阿里 Paraformer 或 Whisper)
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const apiKey = getApiKey('DIFY_STT_API_KEY');
  
  // 因为 Dify (部分版本或配置下) 不接受 WebM (415 Unsupported Media Type)，所以必须由前端转为 WAV
  const wavBlob = await convertToWav(audioBlob);
  
  const formData = new FormData();
  formData.append('file', wavBlob, 'recording.wav');

  const response = await fetch(`${DIFY_BASE_URL}/audio-to-text`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) throw new Error('语音识别请求失败');
  const data = await response.json();
  return data.text;
}

/**
 * 运行 Listening_Comparison_Engine 工作流
 */
export async function runListeningEngine(userInput: string, standardText: string): Promise<ComparisonResult> {
  const apiKey = getApiKey('DIFY_WORKFLOW_API_KEY');
  
  const response = await fetch(`${DIFY_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { user_input: userInput, standard_text: standardText },
      response_mode: 'blocking',
      user: 'local-user'
    }),
  });

  if (!response.ok) throw new Error('比对引擎运行失败');
  const data = await response.json();
  
  // 工作流节点输出的变量名为 result，内容为 JSON 字符串，需要解析
  const resultString = data.data?.outputs?.result;
  if (!resultString) throw new Error('工作流未返回有效结果');
  
  try {
    return JSON.parse(resultString) as ComparisonResult;
  } catch (e) {
    throw new Error('解析 AI 返回的 JSON 格式失败');
  }
}

/**
 * 调用 Dify 的 /text-to-audio 获取高保真 MP3 音频流
 */
export async function fetchDifyTTS(text: string, userId = 'default-user'): Promise<string> {
  const apiKey = getApiKey('DIFY_LISTEN_GEN_API_KEY') || getApiKey('DIFY_LISTEN_API_KEY');
  
  const response = await fetch(`${DIFY_BASE_URL}/text-to-audio`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      user: userId
    }),
  });

  if (!response.ok) throw new Error('生成高保真音频失败');
  
  const blob = await response.blob();
  return URL.createObjectURL(blob); // 返回可供 <audio> 播放的本地虚拟 URL
}
