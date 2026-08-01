import React, { useEffect, useState, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { gsap } from 'gsap';
import { playPageTurn } from '../utils/soundEffects';

interface ConfettiProps {
  duration?: number;
  onComplete?: () => void;
}

export default function Confetti({ duration = 3000, onComplete }: ConfettiProps) {
  const [show, setShow] = useState(true);
  const bannerRef = useRef<HTMLDivElement>(null);

  // 触发极简高端行政级彩带特效
  const fireConfetti = useCallback(() => {
    const colors = ['#71717A', '#A1A1AA', '#D4D4D8', '#FF5722']; // Zinc-500, Zinc-400, Zinc-300, Primary Accent (Orange)
    const particleCount = 60; // 保持粒子数量适中，避免廉价感

    const defaults: confetti.Options = {
      origin: { y: 0.7 },
      particleCount: particleCount,
      spread: 70,
      startVelocity: 15,
      decay: 0.9,
      ticks: 200,
      zIndex: 3000,
      colors: colors,
      shapes: ['square', 'circle'] as confetti.Shape[], // 使用方形和圆形粒子，避免过于花哨
      gravity: 0.8,
      scalar: 0.8,
    };

    // 发射两波彩带，模拟优雅的节奏
    confetti({
      ...defaults,
      angle: 60,
      spread: 50,
    });

    setTimeout(() => {
      confetti({
        ...defaults,
        angle: 120,
        spread: 50,
      });
    }, 250);

    // 播放沉浸式行政级音效（物理翻页质感）
    playPageTurn();
  }, []);

  useEffect(() => {
    if (bannerRef.current) {
      gsap.fromTo(
        bannerRef.current,
        { opacity: 0, y: -20, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }
      );
    }

    // 延迟 300ms 后触发特效与音效，确保用户体验到进入动画的过渡
    const confettiTimer = setTimeout(() => {
      fireConfetti();
    }, 300);

    // 提前 300ms 隐藏文字提示框，准备退出动画
    const completeTimer = setTimeout(() => {
      if (bannerRef.current) {
        gsap.to(bannerRef.current, {
          opacity: 0,
          y: -10,
          scale: 0.95,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: () => setShow(false),
        });
      } else {
        setShow(false);
      }
    }, Math.max(100, duration - 300));

    // 彻底销毁并触发 onComplete 回调
    const destroyTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(confettiTimer);
      clearTimeout(completeTimer);
      clearTimeout(destroyTimer);
    };
  }, [duration, onComplete, fireConfetti]);

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
  confetti({
    particleCount: 120,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#202124', '#FF5722', '#FFFFFF'],
  });
};
