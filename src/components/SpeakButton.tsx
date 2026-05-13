import React from 'react';
import { Volume2 } from 'lucide-react';

interface SpeakButtonProps {
  text?: unknown;
  label?: string;
  className?: string;
  iconClassName?: string;
  title?: string;
  rate?: number;
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

export function speakEnglish(text: unknown, rate = 0.92) {
  const content = normalizeSpeakText(text);
  if (!content || typeof window === 'undefined' || !('speechSynthesis' in window)) return false;

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = 'en-US';
  utterance.rate = rate;

  const voices = synth.getVoices();
  const preferredVoice = voices.find((voice) => /en/i.test(voice.lang) || /english/i.test(voice.name));
  if (preferredVoice) utterance.voice = preferredVoice;

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
}: SpeakButtonProps) {
  const content = normalizeSpeakText(text);
  if (!content) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        speakEnglish(content, rate);
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
