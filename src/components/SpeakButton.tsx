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

export function speakEnglish(text: unknown, rate = 0.92, roleType?: 'ally' | 'blocker' | 'neutral' | 'ai') {
  const content = normalizeSpeakText(text);
  if (!content || typeof window === 'undefined' || !('speechSynthesis' in window)) return false;

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = 'en-US';
  utterance.rate = rate;
  utterance.pitch = 1.0;

  const voices = synth.getVoices();
  const enVoices = voices.filter((voice) => /en/i.test(voice.lang) || /english/i.test(voice.name));
  
  if (roleType === 'blocker') {
    utterance.pitch = 0.7; // 低沉压迫
    utterance.rate = rate * 1.05;
    utterance.voice = enVoices.find(v => /male|guy/i.test(v.name)) || enVoices[0];
  } else if (roleType === 'ally') {
    utterance.pitch = 1.3; // 高频轻快
    utterance.rate = rate * 1.1;
    utterance.voice = enVoices.find(v => /female|girl/i.test(v.name)) || enVoices[enVoices.length - 1];
  } else if (roleType === 'neutral') {
    utterance.pitch = 1.0;
    utterance.rate = rate * 0.95;
    utterance.voice = enVoices.find(v => /google|microsoft/i.test(v.name)) || enVoices[0];
  } else if (roleType === 'ai') {
    utterance.pitch = 1.1;
    utterance.rate = rate * 1.1;
    const preferredVoice = enVoices.find((voice) => /en/i.test(voice.lang) || /english/i.test(voice.name));
    if (preferredVoice) utterance.voice = preferredVoice;
  } else {
    const preferredVoice = enVoices.find((voice) => /en/i.test(voice.lang) || /english/i.test(voice.name));
    if (preferredVoice) utterance.voice = preferredVoice;
  }

  synth.cancel();
  synth.speak(utterance);
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
