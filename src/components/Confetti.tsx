import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfettiProps {
  duration?: number;
  onComplete?: () => void;
}

export default function Confetti({ duration = 3000, onComplete }: ConfettiProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // 留出 300ms 运行退出动画
    const completeTimer = setTimeout(() => {
      setShow(false);
    }, Math.max(100, duration - 300));

    const destroyTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(completeTimer);
      clearTimeout(destroyTimer);
    };
  }, [duration, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="fixed top-8 left-1/2 -translate-x-1/2 z-[3000] flex items-center gap-3 bg-zinc-900 border border-zinc-800 text-white px-6 py-3.5 rounded-full shadow-2xl"
        >
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-zinc-950 font-black text-xs">✓</div>
          <span className="text-xs font-black uppercase tracking-widest text-zinc-100">挑战达成 (Challenge Completed)</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
