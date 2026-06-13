import React, { useState, useEffect } from 'react';
import { Volume2, Loader2, Pause } from 'lucide-react';

interface SpeakButtonProps {
  text?: unknown;
  label?: string;
  className?: string;
  iconClassName?: string;
  title?: string;
  rate?: number;
  roleType?: 'ally' | 'blocker' | 'neutral' | 'ai';
}

function normalizeSpeakText(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// 句子切分：按句号、问号、叹号切分，避开常见英文缩写（Mr., Dr., e.g., i.e. 等）
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<!\b(?:Mr|Ms|Mrs|Dr|Co|Ltd|Inc|e\.g|i\.e|vs|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|St|Assoc|Univ|Prof|Dept))(?<=[.?!])\s+|\n+/i)
    .map(s => s.trim())
    .filter(Boolean);
}

// 播放音频缓存
const audioCache = new Map<string, HTMLAudioElement>();
// 当前正在播放的音频实例
let currentAudio: HTMLAudioElement | null = null;
// 当前处于播放状态的内容
let currentPlayingContent: string | null = null;

// 活动句子播放队列
let activeQueue: {
  sentences: string[];
  index: number;
  rate: number;
  isCancelled: boolean;
} | null = null;

// 分发 TTS 状态自定义事件，以便让对应的 SpeakButton 按钮切换 loading / playing / stopped 图标
function dispatchTtsState(content: string, state: 'loading' | 'playing' | 'stopped') {
  window.dispatchEvent(new CustomEvent('tts-state', { detail: { content, state } }));
}

// 分发 TTS 播放错误自定义事件，以提供红色的即时视觉报错反馈
function dispatchTtsError(content: string) {
  window.dispatchEvent(new CustomEvent('tts-error', { detail: { content } }));
}

// 流式句子队列播放器：实现“边听边预加载”极速体验
async function playSentenceQueue(sentences: string[], rate: number, content: string) {
  const voiceCode = localStorage.getItem('super_agent_default_voice') || 'en-GB-LibbyNeural';
  const model = `edge-tts/${voiceCode}`;
  const myQueue = {
    sentences,
    index: 0,
    rate,
    isCancelled: false
  };
  activeQueue = myQueue;

  const fetchAudioForSentence = async (idx: number): Promise<HTMLAudioElement> => {
    const sText = sentences[idx];
    const cacheKey = `${model}_${sText}`;
    let audio = audioCache.get(cacheKey);
    if (!audio) {
      const response = await fetch('/api/tts/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: sText, model })
      });
      if (!response.ok) {
        throw new Error('TTS Request failed: ' + response.statusText);
      }
      const resJson = await response.json();
      if (!resJson.success || !resJson.audioUrl) {
        throw new Error('Invalid TTS response');
      }
      audio = new Audio(resJson.audioUrl);
      audioCache.set(cacheKey, audio);
    }
    return audio;
  };

  const prefetchNext = (idx: number) => {
    if (idx + 1 < sentences.length) {
      fetchAudioForSentence(idx + 1).catch(() => {});
    }
    if (idx + 2 < sentences.length) {
      fetchAudioForSentence(idx + 2).catch(() => {});
    }
  };

  // 发送加载中状态
  dispatchTtsState(content, 'loading');

  for (let i = 0; i < sentences.length; i++) {
    if (myQueue.isCancelled) return;

    try {
      // 预加载后面的句子
      prefetchNext(i);
      
      // 获取当前句子的音频
      const audio = await fetchAudioForSentence(i);
      if (myQueue.isCancelled) return;

      const globalRateMultiplier = parseFloat(localStorage.getItem('super_agent_global_rate') || '1.0');
      audio.playbackRate = rate * globalRateMultiplier;

      currentAudio = audio;
      dispatchTtsState(content, 'playing');
      window.dispatchEvent(new CustomEvent('tts-sentence-progress', { detail: { content, index: i, sentence: sentences[i] } }));
      await new Promise<void>((resolve, reject) => {
        const onEnded = () => {
          audio.removeEventListener('ended', onEnded);
          audio.removeEventListener('error', onError);
          resolve();
        };
        const onError = (e: any) => {
          audio.removeEventListener('ended', onEnded);
          audio.removeEventListener('error', onError);
          reject(e);
        };
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        // 轮询检查队列是否被中途取消
        const checkInterval = setInterval(() => {
          if (myQueue.isCancelled) {
            clearInterval(checkInterval);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            audio.pause();
            audio.currentTime = 0;
            resolve();
          }
        }, 50);

        audio.play().catch((e) => {
          clearInterval(checkInterval);
          audio.removeEventListener('ended', onEnded);
          audio.removeEventListener('error', onError);
          reject(e);
        });
      });

    } catch (err) {
      console.error(`Queue playback failed at sentence ${i}:`, err);
      dispatchTtsError(content);
      // 降级：剩余未读部分使用浏览器原生合成器一次性播放
      if ('speechSynthesis' in window) {
        const remainingText = sentences.slice(i).join(' ');
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(remainingText);
        const langPrefix = voiceCode.split('-').slice(0, 2).join('-');
        utterance.lang = langPrefix || 'en-US';
        window.speechSynthesis.speak(utterance);
      }
      break;
    }
  }

  if (activeQueue === myQueue) {
    activeQueue = null;
    currentPlayingContent = null;
    dispatchTtsState(content, 'stopped');
  }
}

export async function speakEnglish(text: unknown, rate = 1.0, roleType?: 'ally' | 'blocker' | 'neutral' | 'ai') {
  const content = normalizeSpeakText(text);
  if (!content) return false;

  const voiceCode = localStorage.getItem('super_agent_default_voice') || 'en-GB-LibbyNeural';
  const model = `edge-tts/${voiceCode}`;

  // Toggle 功能：如果是相同内容正在播放，再次点击则停止播放
  if (currentPlayingContent === content) {
    if (activeQueue) {
      activeQueue.isCancelled = true;
      activeQueue = null;
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    currentPlayingContent = null;
    dispatchTtsState(content, 'stopped');
    return true;
  }
  
  // 否则，停止之前所有的播放
  if (activeQueue) {
    activeQueue.isCancelled = true;
    activeQueue = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (currentPlayingContent) {
    dispatchTtsState(currentPlayingContent, 'stopped');
  }
  
  currentPlayingContent = content;
  
  const sentences = splitIntoSentences(content);
  // 当文本包含多个句子且总长度较长时，使用流式句子队列播放，极大降低首字节卡顿感
  if (sentences.length > 1 && content.length > 120) {
    await playSentenceQueue(sentences, rate, content);
  } else {
    // 较短文本直接单请求播放
    const cacheKey = `${model}_${content}`;
    dispatchTtsState(content, 'loading');
    
    try {
      let audio = audioCache.get(cacheKey);
      if (!audio) {
        const response = await fetch('/api/tts/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: content, model })
        });
        if (!response.ok) throw new Error('TTS Request failed');
        const resJson = await response.json();
        if (!resJson.success || !resJson.audioUrl) throw new Error('Invalid URL');
        audio = new Audio(resJson.audioUrl);
        audioCache.set(cacheKey, audio);
      }
      
      const globalRateMultiplier = parseFloat(localStorage.getItem('super_agent_global_rate') || '1.0');
      audio.playbackRate = rate * globalRateMultiplier;
      currentAudio = audio;
      dispatchTtsState(content, 'playing');
      window.dispatchEvent(new CustomEvent('tts-sentence-progress', { detail: { content, index: 0, sentence: sentences[0] || content } }));      
      await new Promise<void>((resolve, reject) => {
        audio!.onended = () => resolve();
        audio!.onerror = (e) => reject(e);
        audio!.play().catch(reject);
      });
    } catch (error) {
      console.error('Single TTS playback failed:', error);
      dispatchTtsError(content);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(content);
        const langPrefix = voiceCode.split('-').slice(0, 2).join('-');
        utterance.lang = langPrefix || 'en-US';
        window.speechSynthesis.speak(utterance);
      }
    } finally {
      if (currentPlayingContent === content) {
        currentPlayingContent = null;
        dispatchTtsState(content, 'stopped');
        window.dispatchEvent(new CustomEvent('tts-stopped', { detail: { content } }));      }
    }
  }
  return true;
}

export default function SpeakButton({
  text,
  label,
  className = '',
  iconClassName = 'w-4 h-4',
  title = '播放英文发音',
  rate = 0.92,
  roleType,
}: SpeakButtonProps) {
  const content = normalizeSpeakText(text);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    const handleTtsState = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.content === content) {
        if (customEvent.detail.state === 'loading') {
          setIsLoading(true);
          setIsPlaying(false);
          setHasError(false);
        } else if (customEvent.detail.state === 'playing') {
          setIsLoading(false);
          setIsPlaying(true);
          setHasError(false);
        } else {
          setIsLoading(false);
          setIsPlaying(false);
        }
      } else {
        setIsLoading(false);
        setIsPlaying(false);
      }
    };

    const handleTtsError = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.content === content) {
        setIsLoading(false);
        setIsPlaying(false);
        setHasError(true);
        
        timer = setTimeout(() => {
          setHasError(false);
        }, 2000);
      }
    };

    window.addEventListener('tts-state', handleTtsState);
    window.addEventListener('tts-error', handleTtsError);
    return () => {
      window.removeEventListener('tts-state', handleTtsState);
      window.removeEventListener('tts-error', handleTtsError);
      if (timer) clearTimeout(timer);
    };
  }, [content]);

  if (!content) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        speakEnglish(content, rate, roleType);
      }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full transition-all duration-300 ${
        label ? 'px-4 py-2 text-[10px] font-black uppercase tracking-widest' : ''
      } ${
        hasError 
          ? 'bg-red-100 text-red-500 border border-red-300 hover:bg-red-200' 
          : isPlaying 
            ? 'bg-[#FF5722] text-white shadow-md' 
            : 'bg-[#FF5722]/10 text-[#FF5722] hover:bg-[#FF5722] hover:text-white'
      } ${!label && !className.includes('w-') ? 'w-9 h-9' : ''} ${className}`}
      title={hasError ? '播放失败' : isPlaying ? '停止播放' : title}
      aria-label={hasError ? '播放失败' : isPlaying ? '停止播放' : title}
    >
      {isLoading ? (
        <Loader2 className={`${iconClassName} animate-spin`} />
      ) : hasError ? (
        <Volume2 className={`${iconClassName} text-red-500 animate-bounce`} />
      ) : isPlaying ? (
        <Pause className={iconClassName} />
      ) : (
        <Volume2 className={iconClassName} />
      )}
      {label ? <span>{hasError ? '播放失败' : isPlaying ? '停止播放' : label}</span> : null}
    </button>
  );
}
