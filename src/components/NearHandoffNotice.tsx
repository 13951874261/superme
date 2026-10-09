import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { HandoffTone } from '../utils/backgroundHandoff';

gsap.registerPlugin(useGSAP);

export interface NearHandoffProps {
  anchor: HTMLElement;
  message: string;
  tone?: HandoffTone;
  duration?: number;
}

type NearState = NearHandoffProps & { id: number; top: number; left: number };

let nearEmitter: ((props: NearHandoffProps) => void) | null = null;
let nearSeq = 0;

export function showNearHandoff(props: NearHandoffProps): void {
  if (!props?.anchor || !props.message) return;
  nearEmitter?.(props);
}

const TONE_CLASS: Record<HandoffTone, string> = {
  info: 'bg-blue-600 text-white border-blue-500',
  success: 'bg-emerald-600 text-white border-emerald-500',
  error: 'bg-red-600 text-white border-red-500',
};

const NearBubble: React.FC<{ item: NearState; onDone: (id: number) => void }> = ({
  item,
  onDone,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.fromTo(
        ref.current,
        { autoAlpha: 0, y: 6, scale: 0.96 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.2, ease: 'power2.out' }
      );
      const hide = gsap.to(ref.current, {
        autoAlpha: 0,
        y: -4,
        duration: 0.18,
        delay: Math.max(0.4, (item.duration ?? 3200) / 1000 - 0.18),
        ease: 'power1.in',
        onComplete: () => onDone(item.id),
      });
      return () => {
        hide.kill();
      };
    },
    { dependencies: [item.id], scope: ref }
  );

  return (
    <div
      ref={ref}
      role="status"
      className={`fixed z-[3200] max-w-[240px] px-3 py-2 rounded-xl text-[11px] font-bold leading-snug shadow-lg border pointer-events-none ${TONE_CLASS[item.tone || 'info']}`}
      style={{ top: item.top, left: item.left }}
    >
      {item.message}
    </div>
  );
};

/** 挂在 App 根：承接 showNearHandoff */
export const NearHandoffHost: React.FC = () => {
  const [items, setItems] = useState<NearState[]>([]);

  useEffect(() => {
    nearEmitter = (props) => {
      const rect = props.anchor.getBoundingClientRect();
      const width = 240;
      let left = rect.left + rect.width / 2 - width / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      const preferAbove = rect.top > 72;
      const top = preferAbove ? Math.max(8, rect.top - 8 - 44) : rect.bottom + 8;
      const id = ++nearSeq;
      setItems((prev) => [
        ...prev.slice(-4),
        {
          id,
          anchor: props.anchor,
          message: props.message,
          tone: props.tone || 'info',
          duration: props.duration ?? 3200,
          top,
          left,
        },
      ]);
    };
    return () => {
      nearEmitter = null;
    };
  }, []);

  const remove = (id: number) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {items.map((item) => (
        <NearBubble key={item.id} item={item} onDone={remove} />
      ))}
    </>,
    document.body
  );
};
