import React from 'react';
import { motion } from 'motion/react';
import { Mic, MessageSquare, PenTool, CheckCircle2, Circle } from 'lucide-react';
import type { MessageItem } from './oralWarRoom/types';

interface Props {
  improvElapsed: number;
  messages: MessageItem[];
  writeCompleted?: boolean;
  onNavigateWrite?: () => void;
}

const IMPROV_TARGET = 300;
const ROUND_TARGET = 10;
const SCORE_TARGET = 8;

function computeSandboxMetrics(messages: MessageItem[]) {
  const userMsgs = messages.filter(m => m.role === 'user');
  const scored = userMsgs.filter(m => m.feedback);
  const roundCount = userMsgs.length;
  if (scored.length === 0) {
    return { roundCount, logicOk: false, fluencyOk: false };
  }
  const avgLogic = scored.reduce((s, m) => s + (m.feedback?.logicScore ?? 0), 0) / scored.length;
  const avgFluency = scored.reduce((s, m) => s + (m.feedback?.fluencyScore ?? 0), 0) / scored.length;
  return {
    roundCount,
    logicOk: roundCount >= ROUND_TARGET && avgLogic >= SCORE_TARGET,
    fluencyOk: roundCount >= ROUND_TARGET && avgFluency >= SCORE_TARGET,
  };
}

export default function OralWarRoomThemeProgress({
  improvElapsed,
  messages,
  writeCompleted = false,
  onNavigateWrite,
}: Props) {
  const improvPassed = improvElapsed >= IMPROV_TARGET;
  const { roundCount, logicOk, fluencyOk } = computeSandboxMetrics(messages);
  const sandboxPassed = logicOk && fluencyOk;
  const allPassed = improvPassed && sandboxPassed && writeCompleted;

  const metrics = [
    {
      id: 'improv',
      label: '即兴 5 分钟',
      icon: Mic,
      passed: improvPassed,
      detail: improvPassed
        ? '已达标'
        : `${Math.floor(improvElapsed / 60)}:${String(improvElapsed % 60).padStart(2, '0')} / 5:00`,
    },
    {
      id: 'sandbox',
      label: '练习 10 轮 · 双 8 分',
      icon: MessageSquare,
      passed: sandboxPassed,
      detail: sandboxPassed
        ? `${roundCount} 轮 · 逻辑/表达 ≥8`
        : `${roundCount}/${ROUND_TARGET} 轮`,
    },
    {
      id: 'write',
      label: '书面闭环',
      icon: PenTool,
      passed: writeCompleted,
      detail: writeCompleted ? '信函已通过' : '待撰写',
      action: !writeCompleted && onNavigateWrite ? onNavigateWrite : undefined,
    },
  ];

  return (
    <div className="shrink-0 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-canvas)]/60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-ink-muted)]">
          主题达标 · 三项要求
        </span>
        {allPassed && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[9px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3" />
            可解锁下一主题
          </motion.span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {metrics.map(({ id, label, icon: Icon, passed, detail, action }) => (
          <div
            key={id}
            className={`rounded-xl border px-2.5 py-2 transition-all ${
              passed
                ? 'bg-emerald-50/80 border-emerald-200'
                : 'bg-white border-[var(--color-border)]'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              {passed ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="w-3 h-3 text-[var(--color-ink-muted)] shrink-0" />
              )}
              <Icon className={`w-3 h-3 shrink-0 ${passed ? 'text-emerald-600' : 'text-[var(--color-ink-muted)]'}`} />
              <span className={`text-[8px] font-black uppercase tracking-widest truncate ${
                passed ? 'text-emerald-700' : 'text-[var(--color-ink-secondary)]'
              }`}>
                {label}
              </span>
            </div>
            {action ? (
              <button
                type="button"
                onClick={action}
                className="text-[9px] font-bold text-[var(--color-accent)] hover:underline cursor-pointer"
              >
                {detail} →
              </button>
            ) : (
              <p className={`text-[9px] font-medium ${passed ? 'text-emerald-600' : 'text-[var(--color-ink-muted)]'}`}>
                {detail}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
