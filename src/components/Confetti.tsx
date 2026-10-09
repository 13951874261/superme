import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { gsap } from 'gsap';
import { playPageTurn } from '../utils/soundEffects';

interface ConfettiProps {
  duration?: number;
  onComplete?: () => void;
}

/** Shared light palette for celebration bursts (banner + bypass helpers). */
export const CELEBRATION_CONFETTI_COLORS = ['#71717A', '#A1A1AA', '#D4D4D8', '#FF5722'] as const;

/** Extremely light burst — feedback over spectacle; safe under frequent re-renders. */
export const LIGHT_CONFETTI_OPTIONS: confetti.Options = {
  particleCount: 18,
  spread: 46,
  startVelocity: 12,
  decay: 0.92,
  ticks: 90,
  gravity: 0.9,
  scalar: 0.7,
  colors: [...CELEBRATION_CONFETTI_COLORS],
  shapes: ['square', 'circle'] as confetti.Shape[],
  zIndex: 3000,
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function fireLightBurst(originY = 0.7) {
  if (prefersReducedMotion()) return;

  const defaults: confetti.Options = {
    ...LIGHT_CONFETTI_OPTIONS,
    origin: { y: originY },
  };

  // Single wave only — avoids stacking cost under re-mount races
  confetti({
    ...defaults,
    angle: 90,
    spread: 55,
  });
}

export default function Confetti({ duration = 2200, onComplete }: ConfettiProps) {
  const [show, setShow] = useState(true);
  const bannerRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let cancelled = false;

    if (bannerRef.current) {
      gsap.fromTo(
        bannerRef.current,
        { opacity: 0, y: -20, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }
      );
    }

    const confettiTimer = setTimeout(() => {
      if (cancelled) return;
      fireLightBurst(0.7);
      playPageTurn();
    }, 300);

    const completeTimer = setTimeout(() => {
      if (cancelled) return;
      if (bannerRef.current) {
        gsap.to(bannerRef.current, {
          opacity: 0,
          y: -10,
          scale: 0.95,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: () => {
            if (!cancelled) setShow(false);
          },
        });
      } else {
        setShow(false);
      }
    }, Math.max(100, duration - 300));

    const destroyTimer = setTimeout(() => {
      if (cancelled) return;
      onCompleteRef.current?.();
    }, duration);

    return () => {
      cancelled = true;
      clearTimeout(confettiTimer);
      clearTimeout(completeTimer);
      clearTimeout(destroyTimer);
    };
    // Single-fire per mount: onComplete held in ref so parent re-renders do not re-burst
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional; duration only
  }, [duration]);

  if (!show) return null;

  return (
    <div
      ref={bannerRef}
      className="fixed top-8 left-1/2 -translate-x-1/2 z-[3000] flex items-center gap-3 bg-zinc-900 border border-zinc-800 text-white px-6 py-3.5 rounded-full shadow-2xl"
    >
      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-zinc-950 font-black text-xs">✓</div>
      <span className="text-xs font-black uppercase tracking-widest text-zinc-100">挑战达成 (Challenge Completed)</span>
    </div>
  );
}

export const showConfetti = () => {
  if (prefersReducedMotion()) return;
  confetti({
    ...LIGHT_CONFETTI_OPTIONS,
    origin: { y: 0.6 },
    colors: ['#202124', '#FF5722', '#FFFFFF'],
  });
};
