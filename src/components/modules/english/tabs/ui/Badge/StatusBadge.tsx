import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, Lock, Sparkles } from 'lucide-react';
import { SPRING_GENTLE } from '../animations/spring';

interface StatusBadgeProps {
  status: 'locked' | 'unlocked' | 'warning' | 'active';
  label: string;
  size?: 'sm' | 'md';
}

const CONFIG = {
  locked: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: Lock,
    iconColor: 'text-amber-500',
    pulse: true,
  },
  unlocked: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    pulse: false,
  },
  warning: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    icon: AlertTriangle,
    iconColor: 'text-orange-500',
    pulse: false,
  },
  active: {
    bg: 'bg-[var(--color-accent)]/10',
    border: 'border-[var(--color-accent)]/25',
    text: 'text-[var(--color-accent)]',
    icon: Sparkles,
    iconColor: 'text-[var(--color-accent)]',
    pulse: false,
  },
} as const;

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;
  const sizeClass = size === 'sm' ? 'px-2.5 py-1' : 'px-3.5 py-1.5';
  const iconSize = size === 'sm' ? 12 : 14;
  const textClass = size === 'sm' ? 'text-micro' : 'text-caption';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING_GENTLE}
      className={`inline-flex items-center gap-1.5 rounded-full border ${cfg.bg} ${cfg.border} ${sizeClass}`}
    >
      <Icon size={iconSize} className={cfg.iconColor} />
      <span className={`font-bold ${cfg.text} ${textClass} uppercase tracking-wider`}>
        {label}
      </span>
      {cfg.pulse && (
        <span className="relative flex h-2 w-2 ml-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
      )}
    </motion.div>
  );
}
