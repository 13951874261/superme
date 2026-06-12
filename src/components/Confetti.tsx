import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiProps {
  duration?: number;
  onComplete?: () => void;
}

export default function Confetti({ duration = 3000, onComplete }: ConfettiProps) {
  useEffect(() => {
    // 极低饱和度与高端行政配色：优雅灰色、白色、高雅微金色
    const colors = ['#E5E7EB', '#F3F4F6', '#FFFFFF', '#D4AF37', '#AA7C11'];
    
    // 触发一个极具克制力、低粒子数（约10-12个）的高雅纸屑喷洒特效
    confetti({
      particleCount: 12,
      spread: 50,
      origin: { y: 0.75 },
      colors: colors,
      scalar: 0.75, // 精致小巧的纸屑尺寸
      disableForReducedMotion: true,
      gravity: 1.1, // 下落稍快，不显拖沓
    });

    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return null; // canvas-confetti 自动维护全局 Canvas，组件无需挂载多余 DOM
}
