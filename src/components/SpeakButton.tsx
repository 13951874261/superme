import React from 'react';
import { Volume2 } from 'lucide-react';

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


// 播放音频缓存
const audioCache = new Map<string, HTMLAudioElement>();
// 当前正在播放的音频实例
let currentAudio: HTMLAudioElement | null = null;

export async function speakEnglish(text: unknown, rate = 1.0, roleType?: 'ally' | 'blocker' | 'neutral' | 'ai') {
  const content = normalizeSpeakText(text);
  if (!content) return false;

  // 映射角色到高质量音色模型
  let model = 'edge-tts/en-US-AvaNeural';
  if (roleType === 'blocker') {
    model = 'edge-tts/en-US-GuyNeural'; // 较低沉的男声
  } else if (roleType === 'ally') {
    model = 'edge-tts/en-NZ-MollyNeural'; // 较轻快的女声
  } else if (roleType === 'neutral') {
    model = 'edge-tts/en-GB-SoniaNeural'; // 英音
  }

  // 构建缓存 key
  const cacheKey = `${model}_${content}`;

  try {
    // 停止当前正在播放的声音
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    let audio = audioCache.get(cacheKey);

    if (!audio) {
      // 触发后端 TTS 接口（内部调用 9router）
      const response = await fetch('/api/tts/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: content, model })
      });

      if (!response.ok) {
        throw new Error('TTS 请求失败: ' + response.statusText);
      }

      // 接收音频流并转换为 Blob URL
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      audio = new Audio(audioUrl);
      
      // 存入缓存
      audioCache.set(cacheKey, audio);
    }

    // 读取全局语速设置
    const globalRateMultiplier = parseFloat(localStorage.getItem('super_agent_global_rate') || '1.0');
    audio.playbackRate = rate * globalRateMultiplier;
    
    currentAudio = audio;
    await audio.play();
    return true;
  } catch (error) {
    console.error('发音播放失败:', error);
    
    // 如果高质量发音失败，静默降级到浏览器原生发音
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
    return false;
  }
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
  if (!content) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        speakEnglish(content, rate, roleType);
      }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-[#FF5722]/10 text-[#FF5722] hover:bg-[#FF5722] hover:text-white transition-colors ${label ? 'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest' : 'w-9 h-9'} ${className}`}
      title={title}
      aria-label={title}
    >
      <Volume2 className={iconClassName} />
      {label ? <span>{label}</span> : null}
    </button>
  );
}
