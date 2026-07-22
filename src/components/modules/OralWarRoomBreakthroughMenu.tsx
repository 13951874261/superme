import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Scale, Eye } from 'lucide-react';
import { playBreakthrough } from '../../utils/soundEffects';
import type { BreakthroughType } from './oralWarRoom/types';

interface Props {
  position: { x: number; y: number };
  selectedText: string;
  onBreakthrough: (type: BreakthroughType) => void;
  onClose: () => void;
}

const BREAKTHROUGH_TYPES = [
  {
    type: 'logic' as const,
    label: '逻辑破绽',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    hoverBg: 'hover:bg-amber-100',
    desc: '以偏概全 / 诉诸经验 / 虚假两难',
  },
  {
    type: 'fact' as const,
    label: '事实矛盾',
    icon: Scale,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    hoverBg: 'hover:bg-blue-100',
    desc: '前后矛盾 / 数据模糊 / 逻辑滑坡',
  },
  {
    type: 'intent' as const,
    label: '意图避重',
    icon: Eye,
    color: 'text-[var(--color-accent)]',
    bg: 'bg-[var(--color-accent)]/10',
    border: 'border-[var(--color-accent)]/25',
    hoverBg: 'hover:bg-[var(--color-accent)]/15',
    desc: '避重就轻 / 推诿扯皮 / 隐秘转移话题',
  },
];

export default function OralWarRoomBreakthroughMenu({ position, selectedText, onBreakthrough, onClose }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 10000, transform: 'translateX(-50%)' }}
        className="w-72"
        data-breakthrough-menu
      >
        <div className="bg-white/95 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-modal)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-canvas)]/50 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-ink-muted)]">破绽识别</span>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onClose(); }}
              className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] cursor-pointer text-xs"
            >
              ×
            </button>
          </div>

          <div className="px-4 py-2 border-b border-[var(--color-border)]">
            <p className="text-[10px] text-[var(--color-ink-secondary)] leading-relaxed italic truncate">
              &ldquo;{selectedText}&rdquo;
            </p>
          </div>

          <div className="p-2 space-y-1.5">
            {BREAKTHROUGH_TYPES.map(({ type, label, icon: Icon, color, bg, border, hoverBg, desc }) => (
              <button
                key={type}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  playBreakthrough();
                  onBreakthrough(type);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${bg} ${border} ${hoverBg}`}
              >
                <Icon className={`w-4 h-4 ${color} shrink-0`} />
                <div className="text-left">
                  <span className={`text-[10px] font-black ${color}`}>{label}</span>
                  <p className="text-[9px] text-[var(--color-ink-muted)] mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
