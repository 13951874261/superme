import React, { useRef, useState } from 'react';
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
      if (open) {
        gsap.fromTo(
          panelRef.current,
          { autoAlpha: 0, y: -6 },
          { autoAlpha: 1, y: 0, duration: 0.18, ease: 'power2.out' }
        );
      } else {
        gsap.set(panelRef.current, { autoAlpha: 0, y: -6 });
      }
    },
    { scope: rootRef, dependencies: [open], revertOnUpdate: true }
  );

  useGSAP(
    () => {
      const el = rootRef.current?.querySelector('[data-country-label]');
      if (!el) return;
      gsap.fromTo(el, { autoAlpha: 0.4 }, { autoAlpha: 1, duration: 0.2 });
    },
    { scope: rootRef, dependencies: [value], revertOnUpdate: true }
  );

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-black/30 text-white/90 text-[10px] px-2.5 py-1 rounded-lg border border-white/10 hover:border-white/20 cursor-pointer"
      >
        Voice: {selected?.name || value}
      </button>
      <span data-country-label className="text-[10px] text-white/60">
        国家: {selected?.country || '—'}
      </span>
      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full mt-1 z-30 max-h-56 w-72 overflow-y-auto rounded-lg border border-white/10 bg-zinc-900 p-2 shadow-xl"
        >
          {VOICE_OPTIONS.map((voice: VoiceOption) => (
            <button
              key={voice.id}
              type="button"
              className={`w-full text-left text-[10px] px-2 py-1.5 rounded cursor-pointer ${
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
