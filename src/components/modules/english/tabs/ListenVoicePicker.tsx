import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { VOICE_OPTIONS, type VoiceOption } from '../../../../config/voices';

gsap.registerPlugin(useGSAP);

export interface ListenVoicePickerProps {
  value: string;
  onChange: (voiceId: string) => void;
}

export function ListenVoicePicker({ value, onChange }: ListenVoicePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected =
    VOICE_OPTIONS.find((v) => v.id === value) ||
    VOICE_OPTIONS.find((v) => v.id === 'en-US-BrianNeural');

  useGSAP(
    () => {
      if (!panelRef.current) return;
      const preferReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (open) {
        gsap.fromTo(
          panelRef.current,
          { autoAlpha: 0, y: preferReduced ? 0 : -6 },
          { autoAlpha: 1, y: 0, duration: preferReduced ? 0 : 0.18, ease: 'power2.out' }
        );
      } else {
        gsap.set(panelRef.current, { autoAlpha: 0, y: preferReduced ? 0 : -6 });
      }
    },
    { scope: rootRef, dependencies: [open], revertOnUpdate: true }
  );

  useGSAP(
    () => {
      const el = rootRef.current?.querySelector('[data-country-label]');
      if (!el) return;
      const preferReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      gsap.fromTo(el, { autoAlpha: preferReduced ? 1 : 0.4 }, { autoAlpha: 1, duration: preferReduced ? 0 : 0.2 });
    },
    { scope: rootRef, dependencies: [value], revertOnUpdate: true }
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex flex-[1_1_13rem] flex-wrap items-center gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`选择 Voice，当前 ${selected?.name || value}`}
        onClick={() => setOpen((v) => !v)}
        className="min-h-8 rounded-lg border border-white/10 bg-black/30 px-3 text-[11px] text-white/90 transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/60 cursor-pointer"
      >
        Voice: {selected?.name || value}
      </button>
      <span data-country-label className="text-[10px] text-white/50">
        国家: {selected?.country || '—'}
      </span>
      {open && (
        <div
          ref={panelRef}
          role="listbox"
          aria-label="Voice 列表"
          className="absolute left-0 top-full mt-1 z-30 max-h-56 w-72 overflow-y-auto overscroll-contain rounded-lg border border-white/10 bg-zinc-900 p-2 shadow-xl"
        >
          {VOICE_OPTIONS.map((voice: VoiceOption) => (
            <button
              key={voice.id}
              type="button"
              role="option"
              aria-selected={voice.id === value}
              className={`w-full text-left text-[10px] px-2 py-1.5 rounded cursor-pointer transition-colors ${
                voice.id === value ? 'bg-[#FF5722]/30 text-white' : 'text-white/80 hover:bg-white/10'
              }`}
              onClick={() => {
                onChange(voice.id);
                setOpen(false);
              }}
            >
              {voice.name} · {voice.country} · {voice.gender}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
