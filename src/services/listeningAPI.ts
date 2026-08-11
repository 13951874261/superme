import { ComparisonResult } from '../types/listening';
import { transcribeAudioWithWhisper } from './difyAPI';
import { getUserCurrentProfile, interceptOutputText } from '../utils/profileHelper';
import { buildTtsModel, requestTtsSpeech, type TtsSpeechResult } from './ttsAPI';


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

/**
 * 运行 Listening_Comparison_Engine 工作流
 */
export async function runListeningEngine(userInput: string, standardText: string, theme: string): Promise<ComparisonResult> {
  const profile = getUserCurrentProfile();
  const displayTheme = profile && !theme.includes('Weakness:') ? `${theme} (Weakness: ${profile})` : theme;
  const response = await fetch('/api/listen/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userInput,
      standardText,
      theme: displayTheme,
      user_current_profile: profile,
      userId: 'local-user',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success || !data?.result) {
    const error = data?.error || `比对引擎运行失败 (HTTP ${response.status})`;
    console.error('[listeningAPI] runListeningEngine HTTP error:', error, data);
    throw new Error(error);
  }
  interceptOutputText(data.result);
  return data.result as ComparisonResult;
}
export type TtsResponse = TtsSpeechResult;

/**
 * 调用 /api/tts/speech 获取高保真 MP3 音频流
 * 短文本同步返回 audioUrl；长文本自动进入异步轮询模式
 */
export async function fetchDifyTTS(text: string, options: { isAsync?: boolean } = {}): Promise<TtsResponse> {
  return requestTtsSpeech(text, {
    model: buildTtsModel(),
    isAsync: options.isAsync ?? true,
  });
}

/**
 * 轮询 TTS 任务状态，最长等待 30 分钟
 * 每 2 秒检查一次，直到任务完成或失败
 */
export async function pollTtsTask(taskId: string): Promise<string> {
  const MAX_ATTEMPTS = 360; // 360 × 5s = 30 分钟，容纳超长音频
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const res = await fetch(`/api/tts/task/${taskId}`);
      if (!res.ok) continue;
      const task = await res.json();

      if (task.status === 'completed' && task.audioUrl) {
        return task.audioUrl;
      }
      if (task.status === 'failed') {
        console.error('[listeningAPI] pollTtsTask task failed:', task.error);
        throw new Error(`音频合成失败: ${task.error || '未知错误'}`);
      }
      // pending / running 状态继续等待
    } catch (e) {
      // 网络异常，继续重试
      console.warn('[listeningAPI] pollTtsTask transient error:', e);
      continue;
    }
  }
  throw new Error('音频合成超时（已等待 30 分钟，请稍后重试）');
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
  if (!response.ok) {
    console.error('[listeningAPI] fetchLongAudioList HTTP failed:', response.status);
    throw new Error('获取长音频列表失败');
  }
  const data = await response.json();
  if (!data.success) {
    console.error('[listeningAPI] fetchLongAudioList data error:', data.error);
    throw new Error(data.error || '获取长音频列表失败');
  }
  return data.data;
}

/**
 * 获取长音频详情（含分段）
 */
export async function fetchLongAudioDetail(id: string): Promise<LongAudio> {
  const response = await fetch(`/api/listen/long-audio/${id}`);
  if (!response.ok) {
    console.error('[listeningAPI] fetchLongAudioDetail HTTP failed for ID:', id, response.status);
    throw new Error('获取长音频详情失败');
  }
  const data = await response.json();
  if (!data.success) {
    console.error('[listeningAPI] fetchLongAudioDetail data error:', data.error);
    throw new Error(data.error || '获取长音频详情失败');
  }
  return data.data;
}

