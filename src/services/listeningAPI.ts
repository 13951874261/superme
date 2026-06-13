import { ComparisonResult } from '../types/listening';
import { transcribeAudioWithWhisper } from './difyAPI';

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
  // 为了防止单侧单词时间太短被大模型的 VAD (人声检测) 引擎当成噪音过滤掉，我们在前后各追加 0.5 秒静音。
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
  // 统一调用 transcribeAudioWithWhisper 以使用高精度的三个接口轮询
  return transcribeAudioWithWhisper(audioBlob);
}

function getUserCurrentProfile(): string {
  try {
    const raw = localStorage.getItem('User_Current_Profile') || localStorage.getItem('user_current_profile') || '';
    if (!raw) return '';
    if (raw.startsWith('[') && raw.endsWith(']')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.join('; ');
      }
    }
    return raw;
  } catch (e) {
    return localStorage.getItem('User_Current_Profile') || localStorage.getItem('user_current_profile') || '';
  }
}

/**
 * 运行 Listening_Comparison_Engine 工作流
 */
export async function runListeningEngine(userInput: string, standardText: string, theme: string): Promise<ComparisonResult> {
  const apiKey = getApiKey('DIFY_WORKFLOW_API_KEY') || getApiKey('DIFY_LISTEN_API_KEY'); // 兼容新版配置
  
  const response = await fetch(`${DIFY_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { 
        user_input: userInput, 
        standard_text: standardText, 
        theme: theme,
        user_current_profile: getUserCurrentProfile()
      },
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
  const response = await fetch('/api/tts/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: 'edge-tts/' + (localStorage.getItem('super_agent_default_voice') || 'en-GB-LibbyNeural')
    }),
  });

  if (!response.ok) throw new Error('生成高保真音频失败');
  
  const data = await response.json();
  if (!data.success || !data.audioUrl) {
    throw new Error('TTS 未返回有效音频 URL');
  }
  return data.audioUrl;
}

/**
 * 长音频数据结构
 */
export interface LongAudioSegment {
  index: number;
  title: string;
  start: number; // 秒
  end: number;   // 秒
  text: string;
  jargons: { word: string; meaning: string }[];
}

export interface LongAudio {
  id: string;
  title: string;
  description: string;
  duration: number; // 秒
  audioUrl: string;
  genre: 'news' | 'meeting' | 'podcast';
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1';
  segments: LongAudioSegment[];
}

/**
 * 获取长音频列表
 */
export async function fetchLongAudioList(): Promise<LongAudio[]> {
  const response = await fetch('/api/listen/long-audio/list');
  if (!response.ok) throw new Error('获取长音频列表失败');
  const data = await response.json();
  if (!data.success) throw new Error(data.error || '获取长音频列表失败');
  return data.data;
}

/**
 * 获取长音频详情（含分段）
 */
export async function fetchLongAudioDetail(id: string): Promise<LongAudio> {
  const response = await fetch(`/api/listen/long-audio/${id}`);
  if (!response.ok) throw new Error('获取长音频详情失败');
  const data = await response.json();
  if (!data.success) throw new Error(data.error || '获取长音频详情失败');
  return data.data;
}

