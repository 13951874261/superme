import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Trophy } from 'lucide-react';
import { playSuccess } from '../../utils/soundEffects';

const TARGET_SECONDS = 300;

interface Props {
  elapsed: number;
  isActive: boolean;
  onElapsedChange: (seconds: number | ((prev: number) => number)) => void;
  onActiveChange: (active: boolean) => void;
  onMilestone?: () => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function OralWarRoomImprovTimer({
  elapsed,
  isActive,
  onElapsedChange,
  onActiveChange,
  onMilestone,
}: Props) {
  const passed = elapsed >= TARGET_SECONDS;

  useEffect(() => {
    if (!isActive || passed) return;
    const id = window.setInterval(() => {
      onElapsedChange((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isActive, passed, onElapsedChange]);

  useEffect(() => {
    if (elapsed === TARGET_SECONDS) {
      playSuccess();
      onMilestone?.();
    }
  }, [elapsed, onMilestone]);

  if (!isActive && elapsed === 0) return null;

  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-1">
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest shadow-[var(--shadow-sm)] ${
          passed
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-white border-[var(--color-border)] text-[var(--color-ink-secondary)]'
        }`}
      >
        <Clock className="w-3.5 h-3.5" />
        <span>即兴 {formatTime(elapsed)}</span>
        <span className="text-[var(--color-ink-muted)] font-bold">/ 5:00</span>
        {!passed && (
          <button
            type="button"
            onClick={() => onActiveChange(false)}
            className="ml-1 text-[8px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] cursor-pointer"
          >
            暂停
          </button>
        )}
      </motion.div>

      <AnimatePresence>
        {passed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-brand)] text-white text-[9px] font-black uppercase tracking-widest shadow-[var(--shadow-card)]"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            即兴 5 分钟达标
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
